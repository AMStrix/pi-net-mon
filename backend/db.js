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
// db.devices.remove({}, {multi: true}); 

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

function makeDevice(d) {
  let dev = null;
  let now = new Date();
  if (d.mac) {
    dev = {
      mac: d.mac,
      ips: {}
    };
    d.vendor && (dev.vendor = d.vendor);
    d.osNmap && (dev.os = d.osNmap);
    d.isSensor && (dev.isSensor = true);
    d.isGateway && (dev.isGateway = true);
    d.lastPortscanTime && (dev.lastPortscanTime = d.lastPortscanTime);
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
  //console.log('TODO create updatePing and updatePorts');
  //console.log('TODO mark devices that exist but did not return in pingsweep/scan as down, lastDownTime')
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







