const util = require('util');
const Nedb = require('nedb');
const bcrypt = require('bcrypt');
const _ = require('lodash');

const l = require('./log');
const f = require('./f');

const DBS = ['users', 'localIps', 'devices', 'remoteHosts', 'ipToHost', 'alerts'];

let db = null;

const dbOnload = (name, e, res, rej) => {
  if (!e) {
    l.info(`db.js loaded ${name}.db success`);
    res();
  } else {
    l.error(`db.js problem loading ${name}.db : ${'\n'+e.stack}`);
    rej();
  }
};

const makeDb = name => {
  let res, rej;
  const promise = new Promise((resolve, reject) => {
    res = resolve;
    rej = reject;
  });
  const onload = e => dbOnload(name, e, res, rej);
  const db =new Nedb({
    filename: `./data/${name}.db`,
    autoload: true,
    onload: onload
  });
  return {name, db, onload, promise};
};

const makeDatabases = () => {
  l.info('db.makeDatabases initializing...');
  const makeRes = DBS.map(makeDb);
  const db = makeRes.reduce((a, x) => (a[x.name] = x.db) && a, {});
  const onloadPromises = makeRes.map(x => x.promise);
  const INDEXES = {
    users: 'username',
    devices: 'mac',
    localIps: 'ip',
    remoteHosts: 'host',
    ipToHost: 'ip'
  };
  Object.keys(INDEXES).forEach(dbn => {
    db[dbn].ensureIndex(
      { fieldName: INDEXES[dbn], unique: true },
      e => e && l.error(`db.js problem indexing ${dbn}.db : ${'\n'+e.stack}`)
    );
    db[dbn].persistence.setAutocompactionInterval(1000*60*30);
    db[dbn].on('compaction.done', () =>  l.info(`db.js ${dbn} compaction done`));
  });
  db.remoteHosts.ensureIndex({ fieldName: 'latestHit' }, 
      e => e && l.error(`db.js problem indexing remoteHosts.db (latestHit) : ${'\n'+e.stack}`));
  db.alerts.ensureIndex({ fieldName: 'time' },
      e => e && l.error(`dbjs problem indexing alerts.db (time) : ${'\n'+e.stack}`));
  db.alerts.ensureIndex({ fieldName: 'archive' },
      e => e && l.error(`dbjs problem indexing alerts.db (archive) : ${'\n'+e.stack}`));

  return Promise.all(onloadPromises).then(() => db);
};

// data manipulation
function makeLocalIp(d) {
  let ip = { 
    ip: d.ip, 
    seen: new Date() 
  };
  if (d.mac) {
    ip.macs = {};
    ip.macs[d.mac] = {
      mac: d.mac,
      seen: new Date()
    }
  }
  return ip;
}

function ipToKey(ip) { return ip.replace(/\./g, '-'); }

function deviceRawToDb(d) {
  d.mac = d.mac.toUpperCase();
  if (d.ip && d.seen) {
    let ipObj = { ip: d.ip, seen: d.seen };
    d.latestIp = ipObj;
    d.ips = {};
    d.ips[ipToKey(d.ip)] = ipObj;
    delete d.ip;
  }
  if (d.osNmap) {
    d.os = d.osNmap;
    delete d.osNmap;
  }
  if (d.openPorts) {
    d.ports = d.openPorts.reduce((a, x) => {
      a[x.port] = x;
      return a;
    }, {});
    delete d.openPorts;
  }
  delete d.seen;
  return d;
}

function makeDevice(d, old) {
  let defaultDevice = { 
    ips: {},
    ports: {},
    isSpoof: false
  }; 
  let inbound = deviceRawToDb(d)
  let updated = _.defaultsDeep(inbound, old || {}, defaultDevice);
  return updated;
}

const $set = (a, b, n, op, p) => b[n] && (_.set(a, `${op&&op+'.'||''}${n}${p&&'s'||''}`, b[n]));
function makeHostUpdate(raw) {
  if (!raw.host) { throw new Error('makeHostUpdate(raw) req host, was: ' + JSON.stringify(raw, null, 2)); }
  const out = {};
  $set(out, raw, 'latestHit', '$set');
  $set(out, raw, 'latestMac', '$set');
  $set(out, raw, 'assocHost', '$addToSet', true);
  $set(out, raw, 'source', '$addToSet', true);
  $set(out, raw, 'protocol', '$addToSet', true);
  $set(out, raw, 'service', '$addToSet', true);
  $set(out, raw, 'mac', '$addToSet', true);
  return out;
}

// exports
module.exports = {};

module.exports.authorize = (user, pass) => 
  new Promise((res, rej) => {
    db.users.findOne({ username: user }, (e, d) => {
      if (!d) {
        res('username');
        return;
      }
      bcrypt.compare(pass, d.password, (err, match) => {
        match && res() || res('password');  
      })
    })
  });

module.exports.getAdmin = () => 
  new Promise((res, rej) => {
    db.users.findOne({ role: 'admin' },(e, d) => {
      e ? rej(e) : res(d);
    });
  });

module.exports.createAdmin = (user, pass) => new Promise((res, rej) => {
  bcrypt.hash(pass, 10, (err, passHash) => {
    if (err) { 
      rej(e); 
    } else {
      db.users.insert({ 
        username: user, 
        password: passHash, 
        role: 'admin' 
      }, (e, d) => {
        e ? rej(e) : res(d);
      });
    }
  });
});

module.exports.updateLocalIp = (d) => {
  db.localIps.update(
    { ip: d.ip }, 
    makeLocalIp(d), 
    { upsert: true }, 
    (e, reps, up) => {}
  );
}

function handleNewDevice(d) {
  if (d.birthday) { return; } // already has birthday
  db.devices.update({ mac: d.mac }, { $set: { birthday: new Date() } }, (err, r) => {
    err && (console.log(`handleNewDevice(${d.mac}) error: `, err, JSON.stringify(d)));
  })
}

module.exports.updateDevice = d => new Promise((res, rej) => {
  if (!d.mac) { throw new Error('db.js updateDevice, must have mac! was: ', d); }
  db.devices.findOne({ mac: d.mac }, (e, old) => {
    db.devices.update(
      { mac: d.mac }, 
      makeDevice(d, old), 
      { upsert: true }, 
      (e, replacementCount, upserted) => {
        upserted && handleNewDevice(upserted);
        e ? rej(e) : res();
      }
    );
  })
});

module.exports.nameDevice = (mac, name) => new Promise((res, rej) => {
  if (name.length === 0) { rej('please enter a name'); return; }
  if (name.length > 35) { rej('name should be less than 35 chars'); return; }
  db.devices.update({ mac: mac }, { $set: { name: name } }, { returnUpdatedDocs: true }, (e, n, d) => {
    e && console.log('nameDevice error', e, JSON.stringify(ds ,null, 2));
    res(d);
  });
});

module.exports.ipToMac = f.memoizePeriodic(ip => new Promise((res, rej) => 
  db.devices.find({ 'latestIp.ip': ip }, { mac: 1, 'latestIp.seen': 1 }, (err, ds) => {
    err && (console.log(`ipToMac(${ip}) error: `, err));
    if (ds && ds.length) {
      const sorted = _.sortBy(ds, ['latestIp.seen']).reverse();
      res(sorted[0].mac);
    } else {
      res();
    }
  })
));

module.exports.macToName = f.memoizePeriodic(mac => new Promise((res, rej) => 
  db.devices.findOne({ 'mac': mac }, { name: 1 }, (err, d) => {
    err && (console.log(`macToName(${mac}) error: `, err));
    d ? res(d.name) : res();
  })
));

module.exports.getDevices = (searchObj) =>
  new Promise((res, rej) => {
    db.devices.find(searchObj || {}, {}, (e, ds) => {
      e ? rej(e) : res(ds);
    });
  });

module.exports.getDevice = mac => new Promise((res, rej) =>
  db.devices.findOne({ mac: mac }, (e, d) => e ? rej(e) : res(d)));

function handleNewHost(hostDoc) {
  if (hostDoc.birthday) { return; } // already has birthday
  db.remoteHosts.update({ host: hostDoc.host }, { $set: { birthday: new Date() } }, (err, r) => {
    err && (console.log(`handleNewHost(${hostDoc.host}) error: `, err, JSON.stringify(hostDoc)));
  })
}

module.exports.updateRemoteHostHit = (raw) => {
  const forDb = makeHostUpdate(raw);
  return new Promise((res, rej) => {
    db.remoteHosts.update(
      { host: raw.host },
      forDb,
      { upsert: true },
      (e, reps, upserted) => {
        e && console.log('updateRemoteHost error', e, JSON.stringify(raw));
        upserted && handleNewHost(upserted);
        res();
      }
    )
  });
}

module.exports.addIpToHost = (ip, host, time) => new Promise((res, rej) => {
  db.ipToHost.update(
    { ip: ip }, 
    { ip: ip, host: host, time: time },
    { upsert: true },
    (e, reps, upserted) => {
      e && l.error(`db.addIpToHost ${ip} -> ${host} error: ${'\n'+e}`);
      res();
    })
});

module.exports.getHostForIp = ip => new Promise((res, rej) => {
  db.ipToHost.findOne({ ip: ip }, {}, (e, d) => {
    e && l.error(`db.getHostForIp(${ip}) error: ${e}`);
    d && res(d.host) || rej();
  });
});

const strToRegex = str => new RegExp(str.replace(/[^0-9a-z-.]/g, '').replace('.', '\\.'));

module.exports.getRemoteHostsPage = (sortField, sortDir, skip, limit, hostSearch, filter) => new Promise((res, rej) => {
  const search = {};
  hostSearch && (search.host = strToRegex(hostSearch));
  filter && (search.macs = { $in: [ filter ] });
  getRemoteHosts(sortField, sortDir, skip, limit, hostSearch, filter)
    .then(hosts => {
      db.remoteHosts.count(search, (e, count) => res({
        hosts: hosts,
        count: count
      }));
    });
});

const getRemoteHosts = module.exports.getRemoteHosts = (sortField, sortDir, skip, limit, hostSearch, filter) => new Promise((res, rej) => {
  const search = {};
  hostSearch && (search.host = strToRegex(hostSearch));
  filter && (search.macs = { $in: [ filter ] });
  let sort = {};
  sortField && (sort[sortField] = sortDir) || (sort.latestHit = -1);
  db.remoteHosts.find(search, {})
    .sort(sort)
    .skip(skip||0)
    .limit(limit||30)
    .exec((e, ds) => e && rej(e) || res(ds));
});

module.exports.getRemoteHost = h => new Promise((res, rej) => {
  db.remoteHosts.findOne({ host: h }, {}, (e, d) => {
    e && l.error(`db.getRemoteHost(${h}) error: ${e}`);
    res(d);
  })
});

module.exports.addAlert = (raw) => new Promise((res, rej) => {
  db.alerts.insert(raw, (e, doc) => {
    e && l.error(`db.addAlert error ${e} raw ${raw}`);
    res(doc);
  });
});

module.exports.getAlerts = (archived, deviceFilter, ipFilter, hostFilter) => 
  new Promise((res, rej) => {
    const search = archived ?
      { archive: true } :
      { $not: { archive: true } };
    db.alerts.find(search)
      .sort({ time: -1 })
      .limit(100)
      .exec((e, ds) => e && rej(e) || res(ds));
  });

module.exports.alertCount = level => new Promise((res, rej) => {
  db.alerts.count({ $not: { archive: true }, level: { $gte: level } }, (e, c) => {
    e && rej(e) || res(c);
  });
});

module.exports.archiveAlert = id => new Promise((res, rej) => {
  db.alerts.update(
    { _id: id }, 
    { $set: { archive: true, archiveTime: new Date() } }, 
    { returnUpdatedDocs: true, multi: false },
    (e, c, d) => e && rej(e) || res(d)
  );
});

module.exports.ignoreAlert = id => new Promise((res, rej) => {
  db.alerts.findOne({ _id: id }, {}, (e, d) => {
    e && rej(e);
    if (d) {
      const delSearch = {};
      d.domainThreat && (delSearch['domainThreat.domain'] = d.domainThreat.domain);
      d.ipThreat && (delSearch['ipThreat.ipv4'] = d.ipThreat.ipv4);
      deleteAlerts(delSearch).then(() => res(d.domainThreat || d.ipThreat));
    }
  })
});

module.exports.deleteAlert = id => deleteAlerts({ _id: id });

const deleteAlerts = module.exports.deleteAlerts = search => new Promise((res, rej) => {
  db.alerts.remove(search, { multi: true }, (e, c) => {
    e && rej(e);
    if (_.isNumber(c)) {
      l.info(`db.deleteAlerts ${JSON.stringify(search)} deleted ${c} alerts`);
      res(c);
    }
  });
});


module.exports.init = () => makeDatabases()
  .then(initializedDb => {
    db = initializedDb;
  });
// db.alerts.update({}, { $unset: { deviceName: true }}, { multi: true }, console.log);
// db.remoteHosts.update({}, { $unset: { latestDeviceName: true }}, { multi: true }, console.log);
