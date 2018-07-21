const util = require('util');
const Nedb = require('nedb');
const bcrypt = require('bcrypt');
const _ = require('lodash');

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
  localIps: 'ip'
};
Object.keys(INDEXES).forEach(dbn => 
  db[dbn].ensureIndex({ fieldName: INDEXES[dbn], unique: true },
    e => e && console.log(e)
  )
);

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

module.exports.getDevices = (searchObj) => 
  new Promise((res, rej) => {
    db.devices.find(searchObj || {}, (e, ds) => e ? rej(e) : res(ds));
  }
);

// one time mutations
// db.devices.find({}, (e,ds) => {
//   ds.forEach(d => {
//     console.log(d.mac, d.latestIp);
//     //console.log(d.mac, d.ips);
//     if (!d.latestIp) {
//       d.latestIp = Object.values(d.ips)[0];
//       db.devices.update({ mac: d.mac }, d, console.log);
//     }
//   })
// })
// db.devices.update({}, { $set: { isSpoof: false }}, { multi: true }, (e, n) => 
//   console.log('isSpoof false set on ' + n + ' devices')
// );

// db.remoteDomains.update(
//   { domain: 'test.xxx'}, 
//   { domain: 'test.xxx', hitsHr: [0,0,0,0,0] }, 
//   { upsert: true },
//   (e, reps, up) => {
//     db.remoteDomains.findOne({domain: 'test.xxx'}, (e, d) => {
//       console.log('findOne', d);
//     })
//   }
// );
// db.remoteDomains.findOne({domain: 'test.xxx'}, (e, d) => {
//   console.log('before', d);
//   db.remoteDomains.update(
//     {domain: d.domain}, 
//     //{ $pop: { hitsHr: -1 }, $push: { hitsHr: 0 }, $inc: { 'hitsHr.4': 1 }}, 
//     { $inc: { 'hits.2018.7.6.12': 1 }}, // use tree
//     (e,r,u) => {
//       console.log('update', e, r, u);
//       db.remoteDomains.findOne({domain: 'test.xxx'}, (e, d) => {
//         console.log('after', d);
//       });
//     }
//   )
// })




