const util = require('util');
const Nedb = require('nedb');
const bcrypt = require('bcrypt');
const _ = require('lodash');

const db = {
  users: new Nedb({ 
    filename: './data/users.db', 
    autoload: true 
  }),
  localIps: new Nedb({
    filename: './data/localIps.db',
    autoload: true
  }),
  devices: new Nedb({
    filename: './data/devices.db',
    autoload: true
  })
};


// indexes
db.users.ensureIndex({ fieldName: 'username', unique: true }, 
  e => e && console.log(e));

db.devices.ensureIndex({ fieldName: 'mac', unique: true }, 
  e => e && console.log(e));

db.localIps.ensureIndex({ fieldName: 'ip', uniuqe: true },
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
    ports: {}
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

module.exports.updateDevice = (d) => {
  db.devices.findOne({ mac: d.mac }, (e, old) => {
    db.devices.update(
      { mac: d.mac }, 
      makeDevice(d, old), 
      { upsert: true }, 
      (e, replacementCount, upserted) => {}
    );
  })

}

module.exports.getDevices = () => 
  new Promise((res, rej) => {
    db.devices.find({}, (e, ds) => e ? rej(e) : res(ds));
  });

// mutate in latestIp
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



