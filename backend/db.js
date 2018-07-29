const util = require('util');
const Nedb = require('nedb');
const bcrypt = require('bcrypt');
const _ = require('lodash');

const l = require('./log');
const f = require('./f');

const DBS = ['users', 'localIps', 'devices', 'remoteHosts'];

const makeDb = name => 
  new Nedb({
    filename: `./data/${name}.db`,
    autoload: true
  });

const db = DBS.reduce((a, n) => (a[n] = makeDb(n)) && a, {});

const INDEXES = {
  users: 'username',
  devices: 'mac',
  localIps: 'ip',
  remoteHosts: 'host'
};

Object.keys(INDEXES).forEach(dbn => 
  db[dbn].ensureIndex({ fieldName: INDEXES[dbn], unique: true },
    e => e && console.log(e)
  )
);

db.remoteHosts.ensureIndex({ fieldName: 'latestHit' }, 
    e => e && console.log(e));

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

function makeHostUpdate(raw) {
  if (!raw.host) { throw new Error('makeHostUpdate(raw) req host, was: ' + JSON.stringify(raw, null, 2)); }
  const $set = (a, b, n, op, p) => b[n] && (_.set(a, `${op&&op+'.'||''}${n}${p&&'s'||''}`, b[n]));
  const out = {};
  $set(out, raw, 'latestHit', '$set');
  $set(out, raw, 'latestMac', '$set');
  $set(out, raw, 'assocHost', '$addToSet', true);
  $set(out, raw, 'source', '$addToSet', true);
  $set(out, raw, 'protocol', '$addToSet', true);
  $set(out, raw, 'service', '$addToSet', true);
  $set(out, raw, 'mac', '$addToSet', true);
  if (raw.latestHit) {
    const ymdh = f.ymdh(raw.latestHit);
    const path = `hits.y${ymdh[0]}.m${ymdh[1]}.d${ymdh[2]}.h${ymdh[3]}`;
    out.$inc = {};
    out.$inc[path] = 1;
  }
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

module.exports.updateDeviceHostHit = d => new Promise((res, rej) => {
  if (!d.mac) { throw new Error('updateDeviceHostHit expected a mac, doc was ',d); }
  const update = f.makeDeviceHostHitUpdate(d.host, d.latestHit);
  db.devices.update({ mac: d.mac }, update, {}, (e, n) => {
    e && console.log('updateDeviceHostHit error', e, JSON.stringify(d, null, 2));
    res();
  });
});

module.exports.updateDeviceByIp = d => new Promise((res, rej) => {
  if (!d.ip) { throw new Error('db.js updateDeviceByIp, must have ip! was: ', d); }
  db.devices.findOne({ 'latestIp.ip': d.ip }, (e, old) => {
    d.mac = old.mac;
    db.devices.update(
      { mac: old.mac }, 
      makeDevice(d, old), 
      { upsert: true }, 
      (e, replacementCount, upserted) => {
        e ? rej(e) : res()
      }
    );
  })
});

module.exports.ipToMac = f.memoizePeriodic(ip => new Promise((res, rej) => 
  db.devices.findOne({ 'latestIp.ip': ip }, { mac: 1 }, (err, d) => {
    err && (console.log(`ipToMac(${ip}) error: `, err));
    d ? res(d.mac) : res();
  })
));

module.exports.getDevices = (searchObj) => 
  new Promise((res, rej) => {
    db.devices.find(searchObj || {}, { hits: 0 }, (e, ds) => e ? rej(e) : res(ds));
  });

module.exports.getDevice = mac => new Promise((res, rej) =>
  db.devices.findOne({ mac: mac }, (e, d) => e ? rej(e) : res(d)));

module.exports.getDeviceHits = (mac, from, to) => new Promise((res, rej) => {

});

function handleNewHost(hostDoc) {
  // console.log('NEW HOST', JSON.stringify(hostDoc));
  if (hostDoc.birthday) { return; } // already has birthday
  db.remoteHosts.update({ host: hostDoc.host }, { $set: { birthday: new Date() } }, (err, r) => {
    err && (console.log(`handleNewHost(${hostDoc.host}) error: `, err, JSON.stringify(hostDoc)));
  })
}

module.exports.updateRemoteHostHit = (raw) => {
  const forDb = makeHostUpdate(raw);
  //console.log('>>>> makeHostUpdate wet run:\n', JSON.stringify(forDb,null,2), '\n\n');
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

module.exports.getRemoteHosts = (sortField, sortDir, skip, limit) => new Promise((res, rej) => {
  let sort = {};
  sortField && (sort[sortField] = sortDir) || (sort.latestHit = -1);
  db.remoteHosts.find({}, { hits: 0 })
    .sort(sort)
    .skip(skip||0)
    .limit(limit||30)
    .exec((e, ds) => {
      e && console.log('getRemoteHosts() error', e);
      res(ds);
    })
});

module.exports.getActiveHosts = (from, to) => new Promise((res, rej) => {
  const x = f.makeHitsByDateSearch(from, to);
  db.remoteHosts.find(x.find, x.proj, (e,ds) =>{
    e && console.log(e);
    //ds.forEach(x => console.log(x.host, x.hits.y2018.m6.d23, x.hits.y2018.m6.d24));
    res(ds);
  })
});






