const os = require('os');
const fs = require('fs');
const fsr = require('fs-reverse');
const zlib = require('zlib');
const readline = require('readline');
const { promisify } = require('util');
const _ = require('lodash');
const moment = require('moment');
const filesize = require('filesize');

const f = require('./f');
const l = require('./log');
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

const processBroResultByUid = async arr => {
  const uid = arr[0].uid;
  const types = _.uniq(arr.map(x => x.broType));
  const dbCalls = [];
  for (let i = 0; i < types.length; i++) {
    if (broHandlers[types[i]]) {
      const res = await broHandlers[types[i]](arr);
      broHandlerAll(arr);
      res && dbCalls.push(res);
    }
  }
  return Promise.resolve(dbCalls);
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
  //console.log(source, event.uid, new Date(event.ts*1000));
  event.broType = source; // tag it
  event.buffAt = Date.now(); // tag it
  bufferEventByUid(event.uid, event);
  //console.log(JSON.stringify(eventsByUidBuffer, null, 4));
};

function watchEventsByUidBuffer() {
  _.values(eventsByUid).forEach((events) => {
    // here we assume all bro events with same uid happen within given duration
    const {uid, broType, service, proto, buffAt} = events[0];
    if (Date.now() - buffAt > 5000) {
      l.debug(`watchEventsByUid del&proc ${broType}/${service||proto}:${uid}`);
      processBroResultByUid(events);
      delete eventsByUid[uid];
    }
  });
}



const broHandlers = {};

const isStringIp = s => s.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);

let durationMax = 0;
let durationTotal = 0;
let durationCount = 0;
const broHandlerAll = group => {
  group.forEach(x => {
    if (x.duration) { 
      durationMax = Math.max(x.duration, durationMax);
      durationTotal += x.duration;
      durationCount++;
    }
    if (x.duration > 40) {
      //console.log(JSON.stringify(group, null, 4));
    }
  })
};

broHandlers.dns = group => {
  const uid = group[0].uid;
  const tsms = group[0].ts * 1000;
  const host = (_.find(group, 'query')||{}).query;
  group.sort((a,b) => a.ts - b.ts);
  if (host) {
    let ips = _.get(_.find(group, 'answers'), 'answers', []);
    const weird = (_.find(group, { broType: 'weird' })||{}).name;
    ips = ips.reduce((a, x) => (isStringIp(x)&&a.push(x)&&a)||a, []);
    ips.forEach(ip => db.addIpToHost(ip, host, new Date(tsms)));
  }
  const origIp = group[0]['id.orig_h'];
  const respIp = group[0]['id.resp_h'];
  const port = group[0]['id.resp_p'];
  if (port == 53 && host) {
    l.verbose(`bro dns > ${origIp} ${host} (${respIp})`);
    return updateTree(origIp, host, new Date(tsms), 'dns', uid)
      .then(() => updateDb(origIp, host, new Date(tsms), 'dns', respIp));
  }
  return Promise.resolve();
};

broHandlers.http = group => {
  const uid = group[0].uid;
  group.sort((a,b) => a.ts - b.ts);
  const tsms = group[0].ts * 1000;
  const origIp = group[0]['id.orig_h'];
  const respIp = group[0]['id.resp_h'];
  let host = _.get(_.find(group, 'host'), 'host');
  l.verbose(`bro http > ${origIp} ${host} (${respIp})`);
  if (!host) { 
    l.info(`XXXXXXXXXXXXXX broalyser.http did not see a host for ${respIp} (http)`);
    return db.getHostForIp(respIp)
      .then(hostFromDb => udpateDb(origIp, hostFromDb, new Date(tsms), 'http', respIp))
      .catch(() => l.info(`XXXXXXXXXXXXXX broalyzer.http no host for ${respIp} from db.getHostForIp`))
      .then(() => updateDb(origIp, respIp, new Date(tsms), 'http')); // set host to ip
  } else {
    return updateTree(origIp, host, new Date(tsms), 'http', uid)
      .then(() => db.addIpToHost(respIp, host, new Date(tsms)))
      .then(() => updateDb(origIp, host, new Date(tsms), 'http', respIp));
  }
  return Promise.resolve();
};

broHandlers.ssl = group => {
  const uid = group[0].uid;
  group.sort((a,b) => a.ts - b.ts);
  const tsms = group[0].ts * 1000;
  const origIp = group[0]['id.orig_h'];
  const respIp = group[0]['id.resp_h'];
  let host = _.get(_.find(group, 'server_name'), 'server_name');
  l.verbose(`bro ssl > ${origIp} ${host} (${respIp})`);
  if (!host) { 
    l.info(`XXXXXXXXXXXXXX broalyser.ssl did not see a host for ${respIp} (ssl)`);
    return db.getHostForIp(respIp)
      .then(hostFromDb => udpateDb(origIp, hostFromDb, new Date(tsms), 'ssl', respIp))
      .catch(() => l.info(`XXXXXXXXXXXXXX broalyzer.ssl no host for ${respIp} from db.getHostForIp`))
      .then(() => updateDb(origIp, respIp, new Date(tsms), 'ssl')); // set host to ip
  } else {
    return updateTree(origIp, host, new Date(tsms), 'ssl', uid)
      .then(() => db.addIpToHost(respIp, host, new Date(tsms)))
      .then(() => updateDb(origIp, host, new Date(tsms), 'ssl', respIp));
  }
  return Promise.resolve();
};

const updateDb = (ip, host, date, source, hostIp) => db.ipToMac(ip)
  .then(mac => 
    db.updateRemoteHostHit({
      host: host,
      latestHit: date,
      latestMac: mac,
      assocHost: hostIp,
      source: source,
      protocol: null,
      service: null,
      mac: mac
    })
  );


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

const updateTree = (ip, host, date, source, uid) => {
 return db.ipToMac(ip) 
  .then(mac => {

    // time
    const hrNode = setGetPath(tree, makeHrPath(date), { host: {}, device: {} });

    // time - dev
    const hostNode = hrNode.host[host] = hrNode.host[host] || { hits: 0 };
    hostNode.hits++;

    // time - dev - host
    const hostDevNode = setGetPath(hostNode, 'device.'+mac, { uids: [], hits: 0 });
    hostDevNode.hits++;
    hostDevNode.uids.push(uid);

    // time - dev - host - source
    const hostDevSourceNode = setGetPath(hostDevNode, 'source.'+source, { hits: 0 });
    hostDevSourceNode.hits++;

    // time - host
    const devNode = hrNode.device[mac] = hrNode.device[mac] || { hits: 0 };
    devNode.hits++;

    // time - host - dev 
    const devHostNodeParent = setGetPath(devNode, 'host', {}); // hosts have dots, so extra step
    const devHostNode = devHostNodeParent[host] = devHostNodeParent[host] || { uids: [], hits: 0 };
    devHostNode.hits++;
    devHostNode.uids.push(uid);

    // time -host - dev - source
    const devHostSourceNode = setGetPath(devHostNode, 'source.'+source, { hits: 0 });
    devHostSourceNode.hits++;
  })
};

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
    res(null);
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








































