const util = require('util');
const Nedb = require('nedb');
const bcrypt = require('bcrypt');

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


// db.users.find({}, (e, d) => d.forEach(console.log));
// db.users.remove({}, {multi: true}); 


// data manipulation
function makeLocalIp(d) {
  let ip = { 
    ip: d.ip, 
    seen: (new Date()).toISOString() 
  };
  if (d.mac) {
    ip.macs = {};
    ip.macs[d.mac] = {
      mac: d.mac,
      seen: (new Date()).toISOString()
    }
  }
  return ip;
}

function ipToKey(ip) { return ip.replace(/\./g, '-'); }

function makeDevice(d) {
  let dev = null;
  let now = (new Date()).toISOString();
  if (d.mac) {
    dev = {
      mac: d.mac,
      vendor: d.vendor,
      os: d.osNmap || null,
      ips: {}
    };
    d.osNmap && (dev.os = d.osNmap);
    d.isSensor && (dev.isSensor = true);
    d.isGateway && (dev.isGateway = true);
    dev.ips[ipToKey(d.ip)] = {
      ip: d.ip,
      seen: now
    };
    if (d.openPorts && d.openPorts.length > 0) {
      dev.ports = d.openPorts.reduce((a, x) => {
        x.seen = now;
        a[x.port] = x;
        return a;
      }, {});
    }
  }
  return dev;
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
  db.devices.update(
    { mac: d.mac }, 
    {$set: makeDevice(d)}, 
    { upsert: true }, 
    (e, reps, up) => {}
  );
}

module.exports.getDevices = () => {
  return new Promise((res, rej) => {
    db.devices.find({}, (e, ds) => e ? rej(e) : res(ds));
  });
}







