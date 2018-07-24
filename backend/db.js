const util = require('util');
const Nedb = require('nedb');
const bcrypt = require('bcrypt');
const _ = require('lodash');

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
  let now = new Date();
  d.mac = d.mac.toUpperCase();
  if (d.ip) {
    let ipObj = { ip: d.ip, seen: now };
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
      x.seen = now;
      a[x.port] = x;
      return a;
    }, {});
    delete d.openPorts;
  }
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

module.exports.createAdmin = (user, pass) => 
  new Promise((res, rej) => {
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

module.exports.updateDevice = d => new Promise((res, rej) => {
  if (!d.mac) { throw new Error('db.js updateDevice, must have mac! was: ', d); }
  db.devices.findOne({ mac: d.mac }, (e, old) => {
    db.devices.update(
      { mac: d.mac }, 
      makeDevice(d, old), 
      { upsert: true }, 
      (e, replacementCount, upserted) => {
        e ? rej(e) : res()
      }
    );
  })
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
    db.devices.find(searchObj || {}, (e, ds) => e ? rej(e) : res(ds));
  });


function makeHostUpdate(raw) {
  if (!raw.host) { throw new Error('makeHostUpdate(raw) req host, was: ' + raw); }
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
  const bp = (s, p, v) => _.isNumber(v) ? (s + '.' + p + v) : s;
  const makePath = (y, m, d, h) => _.zip(['y', 'm', 'd', 'h'], [y, m, d, h])
    .reduce((a, x) => bp(a, x[0], x[1]), 'hits');
  const pathFrom = makePath.apply(null, from);
  const pathTo = makePath.apply(null, to);
  const find = { $or: [{}, {}] }; 
  const op = _.isNumber(from[3]) && { $gt: 0 } || { $exists: true };
  find.$or[0][pathFrom] = op;
  find.$or[1][pathTo] = op;
  const proj = { host: 1 }; 
  proj[pathFrom] = 1;
  proj[pathTo] = 1;
  db.remoteHosts.find(find, proj, (e,ds) =>{
    e && console.log(e);
    //ds.forEach(x => console.log(x.host, x.hits.y2018.m6.d23, x.hits.y2018.m6.d24));
    res(ds);
  })
});






