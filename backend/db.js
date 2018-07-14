const util = require('util');
const Nedb = require('nedb');

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

//db.users.remove({}, {multi: true}); 
//db.localIps.find({}, (e, d) => d.forEach(console.log));


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
  if (d.mac) {
    dev = {
      mac: d.mac,
      vendor: d.vendor,
      ips: {},
      isSensor: d.isSensor ? true : false
    };
    dev.ips[ipToKey(d.ip)] = {
      ip: d.ip,
      seen: (new Date()).toISOString()
    };
  }
  return dev;
}


// exports
module.exports = {};

module.exports.getAdmin = () => 
  new Promise((res, rej) => {
    db.users.findOne({ role: 'admin' },(e, d) => {
      e ? rej(e) : res(d);
    });
  });

module.exports.createAdmin = (user, pass) => 
  new Promise((res, rej) => {
    db.users.insert({ 
      username: user, 
      password: pass, 
      role: 'admin' 
    }, (e, d) => {
      e ? rej(e) : res(d);
    });
  });

module.exports.updateLocalIp = (d) => {
  //console.log('db.updateLocalIp', makeLocalIp(d));
  db.localIps.update({ ip: d.ip }, makeLocalIp(d), { upsert: true }, (e, reps, up) => {
    //console.log('e, reps, up', e, reps, up);
  });
}
 
module.exports.updateDevice = (d) => {
  //console.log('db.updateDevice', makeDevice(d));
  db.devices.update({ mac: d.mac }, makeDevice(d), { upsert: true }, (e, reps, up) => {
    //console.log('e, reps, up', e, reps, up);
  });
}

module.exports.getDevices = () => {
  return new Promise((res, rej) => {
    db.devices.find({}, (e, ds) => e ? rej(e) : res(ds));
  });
}







