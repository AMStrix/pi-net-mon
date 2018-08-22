const os = require('os');
const fs = require('fs');
const fsr = require('fs-reverse');
const zlib = require('zlib');
const readline = require('readline');
const { promisify } = require('util');
const _ = require('lodash');
const moment = require('moment');
const filesize = require('filesize');

const { isStringIp } = require('./f');
const l = require('./log');
const alerts = require('./alerts');
const db = require('./db'); //nedb

const LOGS = '/opt/nsm/bro/logs/';


module.exports = {};

const dateToLogDir = date => moment(date).format('YYYY-MM-DD');

const pReaddir = promisify(fs.readdir);

const logNameToType = (name) => /([^:]*)\.\d\d:/.exec(name)[1];

const logNameToDate = (name, date) => {
  const startHour = /(\d\d):/.exec(name)[1];
  const hrDate = new Date(+date);
  hrDate.setHours(parseInt(startHour), 0, 0, 0);
  return hrDate;
};

const msToEpochHr = ms => Math.round(ms / (1000 * 60 * 60));

const dateToEpochHr = date => msToEpochHr(date.getTime());

const logDir = () => pReaddir(LOGS);

const logsForDay = (date) => logDir()
  .then(roots => {
    const dayDirName = dateToLogDir(date);
    return pReaddir(LOGS + dayDirName)
      .catch(e => {
        if (e.code == 'ENOENT') {
          l.info(`no bro logs for ${dayDirName}`);
        } else {
          l.error(`error finding bro logs for ${dayDirName} ${e}`);
        }
        return [];
      });
  });

const gunzip = file => {
  const readStream = fs.createReadStream(file);
  return readline.createInterface({
    input: readStream.pipe(zlib.createGunzip()),
    crlfDelay: Infinity
  });
};

const ignoreBroFile = name => {
  const ignore = ['conn-summary'];
  return ignore.reduce((ig, ign) => ig || name.indexOf(ign) === 0, false);
};

const parseFile = (name, date, handler) => new Promise((res, rej) => {
  const broType = logNameToType(name);
  const hrDate = logNameToDate(name, date);
  const hrEpoch = dateToEpochHr(hrDate);
  const path = LOGS + dateToLogDir(date) + '/' + name;
  !ignoreBroFile(name) && gunzip(path).on('line', x => handler(x, broType)).on('close', res) || res();
});

const parseFiles = async (names, date) => {
  const lineHandler = broLineHandler();
  // bring dns to top of list for ip -> host lookup for ssl &etc.
  names.sort((a,b) => b.startsWith('dns.') && 1 || -1);
  for (var i = 0; i < names.length; i++) {
    await parseFile(names[i], date, lineHandler); // sequential!
  } 
  return processBroResultsByUid(lineHandler.results);
};

const processDay = (date) => logsForDay(date)
  .then((files) => parseFiles(files, date));

const broLineHandler = () => {
  const logByUid = {};
  const handle = (line, broType) => {
    try {
      const l = JSON.parse(line);
      l.broType = broType;
      logByUid[l.uid] ? (logByUid[l.uid].push(l)) : (logByUid[l.uid] = [l]);
    } catch (e) { console.log('ERROR json parse, LINE: ', line, e.message); }
  };
  handle.results = logByUid;
  return handle;
};

const processBroResultsByUid = async byUid => {
  // let countByBroType = _.values(byUid).reduce((counts, arr) => {
  //   const k = arr.reduce((a,x) => a + '-' + x.broType, '');
  //   counts[k] ? counts[k]++ : counts[k] = 1; 
  //   return counts;
  // }, {});
  const byUidArr = _.values(byUid);
  l.info('processBroResultsByUid byUidArr.length: '+byUidArr.length);
  let progress = 0;
  let dbCallQueue = [];
  for (let i = 0; i < byUidArr.length; i++) {
    (progress % 1000 === 0) && 
      l.info('processBroResultsByUid progress: ' + 
        Math.round((progress / byUidArr.length) * 100) +'%');
    await processBroResultByUid(byUidArr[i]);
    progress++;
  }
  //console.log(JSON.stringify(r, null, 4));
  console.log(`max: ${durationMax}, avg: ${durationTotal/durationCount}`)
  saveTree();
};



const extractBroUid = group => {
  const uid = group[0].uid;
  return uid;
};

const extractPrimaryBroType = group => {
  const primary = group.find(x => x.broType != 'conn'); 
  if (!primary) {
    l.debug(`broalyzer.extractPrimaryBroType no primary type for ${extractBroUid(group)}, using 'conn'`);
    return 'conn';
  }
  return primary.broType;
};

const extractBroTypes = group => {
  return group.map(x => x.broType);
};

const extractMacFromGroup = group => {
  const conn = _.find(group, 'orig_l2_addr');
  return conn.orig_l2_addr.toUpperCase();
};

const processBroResultByUid = group => {
  const primaryType = extractPrimaryBroType(group);
  const cif = (fn, x) => fn && fn(x);
  return broHandlerAll(group)
    .then(() => cif(broHandlers[primaryType], group));
};



const eventsByUid = {};

const ignoreBroEventSources = ['files'];

const bufferEventByUid = (uid, event) => {
  l.debug(`bufferEventByUid ${event.broType}:${event.uid}`);
  let eventByUid = eventsByUid[uid];
  !eventByUid && (eventByUid = eventsByUid[uid] = []);
  eventByUid.push(event);
};

module.exports.handleBroEvent = (source, event) => {
  if (ignoreBroEventSources.find(ig => ig == source)) return;
  event.broType = source;
  event.buffAt = Date.now();
  bufferEventByUid(event.uid, event);
};

function watchEventsByUidBuffer() {
  _.values(eventsByUid).forEach((events) => {
    // here we assume all bro events with same uid happen within given duration
    const {uid, broType, service, proto, buffAt} = events[0];
    const hasConn = _.find(events, { broType: 'conn' });
    if (Date.now() - buffAt > 5000 && hasConn) {
      l.debug(`watchEventsByUid del&proc ${events.map(x => x.broType)}/${service||proto}:${uid}`);
      processBroResultByUid(events);
      delete eventsByUid[uid];
    }
  });
}



const broHandlers = {};

const broHandlerAll = group => {
  return alerts.catchThreats(group)
    .then(() => alerts.catchDomainThreats(group));
};

const extractBroHost = group => {
  const host = ['host', 'server_name', 'query']
    .map(fn => (_.find(group, fn)||{})[fn])
    .find(z => z);
  return host;
}

const extractBroAssocIps = group => {
  const primaryType = extractPrimaryBroType(group);
  let ips = [];
  if (primaryType == 'dns') {
    ips = _.get(_.find(group, 'answers'), 'answers', [])
      .filter(isStringIp);
  } else {
    ips = [group[0]['id.resp_h']];
  }
  return ips;
}

const extractCommonBroFields = group => {
  group.sort((a,b) => a.ts - b.ts);
  const get = (g, f) => _.find(g, x => x[f] !== undefined)[f];
  return {
    uid: extractBroUid(group),
    mac: extractMacFromGroup(group),
    tsms: group[0].ts * 1000,
    origIp: get(group, 'id.orig_h'),
    respIp: get(group, 'id.resp_h'),
    port: get(group, 'id.resp_p'),
    host: extractBroHost(group),
    ips: extractBroAssocIps(group),
    localOrig: get(group, 'local_orig'),
    localResp: get(group, 'local_resp')
  }
};

const resolveHost = (host, respIp) => host ? Promise.resolve(host) : db.getHostForIp(respIp);


broHandlers.dns = group => {
  const {uid, mac, tsms, host, origIp, respIp, port, ips} = extractCommonBroFields(group);
  const time = new Date(tsms);
  if (port == 53 && host) {
    l.verbose(`bro dns > ${origIp}/${mac} ${host} (${respIp})`);
    return Promise.all(ips.map(ip => db.addIpToHost(ip, host, time)))
      .then(() => updateTree(mac, origIp, host, time, 'dns', uid))
      .then(() => updateDb(mac, origIp, host, time, 'dns'));
  }
  return Promise.resolve();
};

broHandlers.http = group => {
  const {uid, mac, tsms, host, origIp, respIp, ips} = extractCommonBroFields(group);
  const time = new Date(tsms);
  l.verbose(`bro http > ${origIp}/${mac} ${host} (${respIp})`);
  return (host ? db.addIpToHost(respIp, host, time) : Promise.resolve())
    .then(() => resolveHost(host, respIp))
    .catch(() => {
      l.info(`XXXXXXXXXXXXXX broalyzer.http no host for ${respIp}/${host} ${uid} ${e}`)
      return respIp; // fallback to response ip
    })
    .then(h => updateTree(mac, origIp, h, time, 'http', uid).then(() => h))
    .then(h => updateDb(mac, origIp, h, time, 'http', respIp).then(() => h));
};

broHandlers.ssl = group => {
  const {uid, mac, tsms, host, origIp, respIp, ips} = extractCommonBroFields(group);
  const time = new Date(tsms);
  l.verbose(`bro ssl > ${origIp}/${mac} ${host} (${respIp})`);
  return (host ? db.addIpToHost(respIp, host, time) : Promise.resolve())
    .then(() => resolveHost(host, respIp))
    .catch(() => {
      l.info(`XXXXXXXXXXXXXX broalyzer.ssl no host for ${respIp}/${host} ${uid} ${e}`)
      return respIp; // fallback to response ip
    })
    .then(h => updateTree(mac, origIp, h, time, 'ssl', uid).then(() => h))
    .then(h => updateDb(mac, origIp, h, time, 'ssl', respIp).then(() => h));
};

const updateDb = (mac, ip, host, date, source, hostIp) => 
  db.updateRemoteHostHit({
    host: host,
    latestHit: date,
    latestMac: mac,
    assocHost: hostIp,
    source: source,
    protocol: null,
    service: null,
    mac: mac
  });


const tree = {};

const setGetPath = (r, p, def) => {
  let exist = _.get(r, p); // exists
  let ret = exist;
  if (!exist) {
    _.set(r, p, def); // NE, init
    ret = def; // tag it
  }
  return ret;
};

const hoursAgo = (h, nowms) => new Date(nowms - h * 1000*60*60);

const makeHrPath = d =>
  `y${d.getUTCFullYear()}.m${d.getUTCMonth()}.d${d.getUTCDate()}.h${d.getUTCHours()}`;

const makeDayPath = d =>
  `y${d.getUTCFullYear()}.m${d.getUTCMonth()}.d${d.getUTCDate()}`;

const updateTree = (mac, ip, host, date, source, uid) => new Promise((res, rej) => {
  // time
  const hrNode = setGetPath(tree, makeHrPath(date), { host: {}, device: {} });

  // time - host
  const hostNode = hrNode.host[host] = hrNode.host[host] || { hits: 0 };
  hostNode.hits++;

  // time - host - dev
  const hostDevNode = setGetPath(hostNode, 'device.'+mac, { uids: [], hits: 0 });
  hostDevNode.hits++;
  hostDevNode.uids.push(uid);

  // time - host - dev - source
  const hostDevSourceNode = setGetPath(hostDevNode, 'source.'+source, { hits: 0 });
  hostDevSourceNode.hits++;

  // time - dev
  const devNode = hrNode.device[mac] = hrNode.device[mac] || { hits: 0 };
  devNode.hits++;

  // time - dev - host 
  const devHostNodeParent = setGetPath(devNode, 'host', {}); // hosts have dots, so extra step
  const devHostNode = devHostNodeParent[host] = devHostNodeParent[host] || { uids: [], hits: 0 };
  devHostNode.hits++;
  devHostNode.uids.push(uid);

  // time - dev - host - source
  const devHostSourceNode = setGetPath(devHostNode, 'source.'+source, { hits: 0 });
  devHostSourceNode.hits++;

  res();
});


const make24hrDates = toms => _.range(0, 25)
  .map(h => hoursAgo(h, toms))
  .map(d => d.setMinutes(0, 0, 0) && d)
  .reverse();

const make24hrPaths = toms =>  make24hrDates(toms)
  .map(d => ({ path: makeHrPath(d), date: d }));

module.exports.getHitsForDevice24hr = (mac, date) => 
  new Promise((res, rej) => {
    const paths = make24hrPaths(date.getTime());
    const deviceByHr = paths.map(p => ({ 
      time: p.date, 
      device: _.get(tree, `${p.path}.device.${mac}`, { hits: 0, host: {} })
    }));
    res(deviceByHr);
  });

module.exports.getHitsForHost24hr = (host, date) =>
  new Promise((res, rej) => {
    const paths = make24hrPaths(date.getTime());
    const pToArr = (p, x) => {
      const arr = p.split('.');
      return arr.concat(x || []);
    };
    const hostByHr = paths.map(p => ({ 
      time: p.date, 
      host: _.get(tree, pToArr(p.path, ['host', host]), { hits: 0, device: {} })
    }));
    res(hostByHr);
  });

module.exports.getHitsForAllHosts24hr = date => 
  new Promise((res, rej) => {
    const paths = make24hrPaths(date.getTime());
    const hostsByHour = paths.map(p => ({
      time: p.date,
      host: _.get(tree, `${p.path}.host`, {})
    }));
    res(hostsByHour);
  });

const loadTreeHrSnapshot = () => promisify(fs.readFile)('data/snapshot.hr.tree')
  .then(data => {
    const size = filesize(Buffer.byteLength(data));
    const {snapshotTime, snapshotSubtree, snapshotPath} = JSON.parse(data);
    l.info(`broalyzer.loadTreeHrSnapshot snapshot found ${snapshotPath} (${size})`);
    if (Date.now() - snapshotTime > 1000*60*60 * 12) { // any time in last 12 hrs
      l.info(`broalyzer.loadTreeHrSnapshot snapshot stale ${moment(snapshotTime).fromNow()}`);
    } else {
      l.info(`broalyzer.loadTreeHrSnapshot loading snapshot from ${moment(snapshotTime).fromNow()}`);
      _.set(tree, snapshotPath, snapshotSubtree);
    }
  })
  .catch(e => {
    l.info(`broalyzer.loadTreeHrSnapshot no snapshot found`);
  });

function gzipAndB64(string) {
  return promisify(zlib.deflate)(string)
    .then(buffer => buffer.toString('base64'));
}
function gunzipFromB64(string) {
  const buffer = Buffer.from(string, 'base64');
  return promisify(zlib.unzip)(buffer)
    .then(buffer.toString());
}

const makeSnapshotJson = (path, subtree, archive) => JSON.stringify({
  snapshotTime: Date.now(),
  snapshotPath: path,
  snapshotSubtree: subtree,
  archive: archive ? true : false
});

const saveTreeSnapshot = (path, subtree, suffix) => {
  const json = makeSnapshotJson(path, subtree, false);
  const size = filesize(Buffer.byteLength(json));
  const filename = `data/snapshot.${suffix}.tree`;
  l.info(`broalyzer.saveTreeSnapshot for ${path} in ${filename} (${size})`);
  return promisify(fs.writeFile)(filename, json);
};

const saveTreeArchive = (path, subtree, suffix) => gzipAndB64(JSON.stringify(subtree))
  .then(deflatedSubtree => {
    const json = makeSnapshotJson(path, deflatedSubtree, true);
    const size = filesize(Buffer.byteLength(json));
    const filename = `data/archive.${suffix}.tree`;
    l.info(`broalyzer.saveTreeArchive for ${path} in ${filename} (${size})`);
    return promisify(fs.appendFile)(filename, (os.EOL + json));
  });

function saveTreeHrSnapshot(force) {
  const now = new Date();
  const nowHrPath = makeHrPath(now);
  const nowHr = _.get(tree, nowHrPath);
  if (nowHr && (force || !nowHr.lastSnapshot || Date.now() - nowHr.lastSnapshot > 1000*60)) {
    return saveTreeSnapshot(nowHrPath, nowHr, 'hr')
      .then(() => {
        nowHr.lastSnapshot = now.getTime();
      })
  }
  return Promise.resolve();
}

function saveTreeHrArchive() {
  const nowms = Date.now();
  const paths = _.range(1, 13).map(hr => makeHrPath(hoursAgo(hr, nowms))).reverse();
  const subTrees = paths.forEach(path => {
    const subtree = _.get(tree, path);
    if (subtree && !subtree.archived) {
      subtree.archived = true;
      saveTreeArchive(path, subtree, 'hr');
    }
  });
}

function loadTreeHrArchive() {
  const nowms = Date.now();
  const paths = _.range(1, 24).map(hr => makeHrPath(hoursAgo(hr, nowms)));
  const processLine = line => {
    const {snapshotTime, snapshotPath, snapshotSubtree} = JSON.parse(line);
    if (paths.indexOf(snapshotPath) > -1) {
      gunzipFromB64(snapshotSubtree)
        .then(unzipped => {
          const size = filesize(Buffer.byteLength(unzipped));
          l.info(`broalyzer.loadTreeHrArchive for ${snapshotPath} (${size})`);
          return unzipped;
        })
        .then(unzipped => _.set(tree, snapshotPath, JSON.parse(unzipped)));
    } else {
      reader.destroy();
    }
  }
  const reader = fsr('data/archive.hr.tree').on('data', processLine);
}
loadTreeHrArchive();

function arborist() {
  saveTreeHrSnapshot();
  saveTreeHrArchive();
}


let watchEventsByUidBufferIntervalId = null;
let arboristIntervalId = null;
const init = module.exports.init = () => {
  return loadTreeHrSnapshot()
    .then(() => {
      !arboristIntervalId && (arboristIntervalId = setInterval(arborist, 30000));
    })
    .then(() => {
      !watchEventsByUidBufferIntervalId &&
        (watchEventsByUidBufferIntervalId = setInterval(watchEventsByUidBuffer, 1000));
    });
};

module.exports.onExit = () => {
  clearInterval(watchEventsByUidBufferIntervalId);
  clearInterval(arboristIntervalId);
  return saveTreeHrSnapshot(true);
};
// function saveTree() {
//   return promisify(fs.writeFile)('data/current.tree', JSON.stringify(tree));
// }

// const day = 1000*60*60*24;
// processDay(new Date(Date.now() - 4*day))
//   // .then(_ => processDay(new Date(Date.now() - 5*day)))
//   // .then(_ => processDay(new Date(Date.now() - 6*day)))
//   // .then(_ => processDay(new Date(Date.now() - 7*day)))
//   // .then(_ => processDay(new Date(Date.now() - 8*day)))
//   // .then(_ => processDay(new Date(Date.now() - 9*day)))
//   .then(() => console.log('DONE!')); 

// TODO: explore bro logs for more gold
// let stats = {
//   uids: {},
//   uidObs: {},
//   totalCount: 0,
//   sourceCount: {},
// };
// function updateStats(src, uid, d) {
//   d._src = src;
//   if (!stats.uids[uid]) {
//     stats.uids[uid] = true;
//     stats.uidObs[uid] = [];
//   }
//   stats.uidObs[uid].push(d);
//   stats.totalCount++;
//   !stats.sourceCount[src] && (stats.sourceCount[src] = 1) || stats.sourceCount[src]++;
// }
// function printUidInfo() {
//   const pl = d => 
//   `${moment(d.ts*1000).format('M/D H:mm:ss.S')}\t${d._src}
//     ${d['id.orig_h']} => ${d['id.resp_h']} 
//     ${d.duration} (${d.query})`;
//   _.values(stats.uidObs).forEach(arr => {
//     if (arr.length > 1) {
//       arr.forEach((x,i) => console.log(i + '|  ' + pl(x)));
//       console.log(' ');
//     }
//   })
// } 








































