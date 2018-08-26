const childProcess = require('child_process');
const _ = require('lodash');
const nmap = require('./node-nmap');

const l = require('./log');
const f = require('./f');
const db = require('./db');

const PORTSCAN_STALE = 60 * 1000 * 60 * 12;
const INTERFACE = 'eth0';
let running = false;
let currentPingSweep = null;
let currentPortScan = null;
let attemptPortScan = null;
const portScanQueue = [];
let spoofing = {};

let state = {
  errors: [],
  pingSweep: {
    scanStart: null,
    processing: false,
    scanTime: null,
  },
  portScan: {
    scanStart: null,
    processing: false,
    scanTime: null,
    host: null
  },
  spoofRejects: {}
};

function addError(e) {
  l.error('spoof.js error' + JSON.stringify(e));
  console.log('ERROR spoof.js', e);
  state.errors.push(e.toString());
}

const thisMac = f.memoizePeriodic(() => {
  let ifconfig = f.cliSync('ifconfig', ['eth0']);
  let macSearch = /ether\s((\w{2}:){5}\w{2})/.exec(ifconfig);
  return macSearch.length === 3 ? macSearch[1].toUpperCase() : null;
});

const thisIp = f.memoizePeriodic(() => {
  let ifconfig = f.cliSync('ifconfig', ['eth0']);
  let ipSearch = /inet\s([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/.exec(ifconfig);
  return ipSearch.length === 2 ? ipSearch[1] : null;
});

const localRange = f.memoizePeriodic(() => {
  let iproute = f.cliSync('ip', ['route']);
  let search = /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\/[0-9]+/.exec(iproute);
  return search.length === 1 ? search[0] : null;
});

const thisGateway = f.memoizePeriodic(() => {
  let iproute = f.cliSync('ip', ['route']);
  let gwSearch = /default\svia\s([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/.exec(iproute);
  return gwSearch.length === 2 ? gwSearch[1] : null;
});

function pingSweep() {
  let range = localRange();
  if (range !== null) {
    state.pingSweep.scanStart = (new Date()).toISOString();
    state.pingSweep.processing = true;
    currentPingSweep = new nmap.NmapScan(range, '-sn');
    currentPingSweep.on('complete', ds => {
      state.pingSweep.processing = false;
      state.pingSweep.scanTime = currentPingSweep.scanTime;
      const hostIp = thisIp();
      const gwIp = thisGateway();
      ds.forEach(d => { 
        if (d.ip === hostIp) { 
          d.mac = thisMac();
          d.isSensor = true; 
        } 
        if (d.ip === gwIp) {
          d.isGateway = true;
        }
        d.seen = new Date();
      });
      ds.forEach(db.updateLocalIp);
      ds.forEach(db.updateDevice);
    });
    currentPingSweep.on('error', addError);
  }
}

const removeOldDuplicateIps = ds => _.values(
  ds.reduce((a, d) => {
    const exist = a[d.latestIp.ip];
    if (!exist || (exist && exist.latestIp.seen - d.latestIp.seen < 0)) {
      a[d.latestIp.ip] = d;
    }
    return a;
  }, {})
);

function portScanLoop() {
  if (currentPortScan) { return; } // one at a time
  db.getDevices().then(ds => {
    removeOldDuplicateIps(ds).forEach(d => {
      portScanIfStale(d.latestIp.ip, d.lastPortscanTime);
    })
  });
}

function isHostUp(ip, cb) {
  let ping = new nmap.NmapScan(ip, '-sn');
  ping.on('complete', ds => {
    cb(ds.length === 1 && ds[0] || null);
  });
}

function portScanIfStale(ip, lastScanTime) {
  let now = new Date();
  if (!lastScanTime || now - lastScanTime > PORTSCAN_STALE) {
    portScanQueue.push(ip);
    portScan();
  }
}

function portScan(forcedIp) {
  return new Promise((res, rej) => {
    if (currentPortScan) { 
      res('portscan in progress');
      return; 
    }
    let popped = portScanQueue.pop();
    let ip = forcedIp || popped;
    if (!ip) {
      res(); // queue empty
      return;
    }
    currentPortScan = true; // lock-in now, will get set to nmap obj
    isHostUp(ip, isUp => {
      if (!isUp) {
        currentPortScan = null; // unlock
        res('host down');
        setTimeout(portScan, 0);
      }
      if (isUp) {
        state.portScan.scanStart = (new Date()).toISOString();
        state.portScan.host = ip;
        state.portScan.processing = true;
        currentPortScan = new nmap.OsAndPortScan(ip);
        currentPortScan.on('error', addError);
        currentPortScan.on('complete', ds => {
          state.portScan.host = null;
          state.portScan.processing = false;
          state.portScan.scanTime = currentPortScan.scanTime;
          ds.forEach(d => {
            !d.mac && d.ip === thisIp() && (d.mac = thisMac());
            d.lastPortscanTime = new Date();
            d.seen = new Date();
            d.openPorts && d.openPorts.forEach(p => p.seen = new Date());
            db.updateDevice(d);
          });
          currentPortScan = null;
          setTimeout(portScan, 0); // try to consume queue
        });
        res();
      }
    });
  });
}

function spoofable(mac, ip) {
  return ip !== thisIp() && ip !== thisGateway() && !spoofing[mac];
}

function spoofLoop() {
  db.getDevices({ isSpoof: true }).then(ds => {
    const toSpoof = {};
    const rejects = [];
    const ipChange = [];
    // resolve stale ips
    ds.forEach(d => {
      const exist = toSpoof[d.latestIp.ip];
      if (exist) {
        if (exist.latestIp.seen < d.latestIp.seen) {
          rejects.push(toSpoof[d.latestIp.ip]);
          toSpoof[d.latestIp.ip] = d;
        } else {
          rejects.push(d);
        }
      } else {
        toSpoof[d.latestIp.ip] = d;
      }
    });
    // resolve ip changes
    _.values(spoofing).forEach(c => {
      const inToSpoof = _.find(_.values(toSpoof), { mac: c._mac });
      if (inToSpoof && inToSpoof.latestIp.ip != c._ip) {
        l.info(`spoof.spoofLoop ip change ${c._mac} ${c._ip} -> ${inToSpoof.latestIp.ip}`);
        delete toSpoof[inToSpoof.latestIp.ip]; 
        rejects.push(inToSpoof);
      }
    });
    _.values(toSpoof).forEach(d => arpSpoof(d.mac, d.latestIp.ip));
    state.spoofRejects = rejects.reduce((a, d) => (a[d.mac] = true) && a, {});
    l.debug(`spoof.spoofLoop spoofing ${_.values(toSpoof).map(d => d.mac).join(', ')}`);
    l.debug(`spoof.spoofLoop rejects ${rejects.map(d => d.mac).join(', ')}`);
    return rejects;
  }).then(rejects => {
    const kill = spoofChild => spoofChild && spoofChild.kill('SIGINT');
    rejects.forEach(d => kill(spoofing[d.mac]));
    db.getDevices({ isSpoof: false })
      .then(ds => {
        ds.forEach(d => kill(spoofing[d.mac]));
      });
  });
}

function arpSpoof(mac, ip) {
  if (ip === thisIp()) {
    throw Error('cannot spoof pi-net-mon sensor');
  } else if (ip === thisGateway()) {
    throw Error('cannot spoof gateway');
  }
  if (!spoofable(mac, ip)) { return; }

  let args = ['-i', 'eth0', '-t', ip, '-r', thisGateway()];
  let child = childProcess.spawn('arpspoof', args);
  child._ip = ip;
  child._mac = mac;
  spoofing[mac] = child;
  child.stdout.on('data', d => l.debug(d));
  child.stderr.on('data', e => l.debug(e));
  child.on('close', x => {
    l.info(`CLOSE arpspoof ${ip} with code: ${x}`);
    delete spoofing[mac]; // clear the child after close
  });
  child.on('error', e => {
    l.error('arpSpoof ' + ip + JSON.stringify(e));
  })
}

function cleanupArpSpoof() {
  let kills = Object.values(spoofing).map(child =>
    new Promise((res, rej) => {
      child.on('close', res);
      child.kill('SIGINT');
    })
  );
  return Promise.all(kills);
}

function updateState() {
  if (currentPingSweep) {
    state.pingSweep.scanTime = currentPingSweep.scanTime;
  }
}

module.exports = {};

module.exports.state = state;

const start = () => {
  if (running) return;
  running = true;
  updateState();
  setInterval(updateState, 1000);
  pingSweep();
  setInterval(pingSweep, 60 * 1000 * 5);
  portScanLoop();
  setInterval(portScanLoop, 60 * 1000);
  spoofLoop();
  setInterval(spoofLoop, 60 * 1000);
};

module.exports.scanIp = ip => {
  return portScan(ip);
}

module.exports.spoofDevice = (mac, isSpoof) => db.getDevice(mac)
  .then(d => {
    const {mac, latestIp: {ip}} = d;
    l.info(`spoof.spoofDevice ${mac} ${isSpoof}`);
    if (thisGateway() === ip) return 'cannot spoof gateway ' + ip;
    if (thisIp() === ip) return 'cannot spoof pi-net-mon device' + ip;
    return db.updateDevice({ mac: mac, isSpoof: isSpoof })
      .then(x => spoofLoop() || null) // null is no-error
  });

module.exports.onExit = cleanupArpSpoof;

module.exports.init = () => {
  f.cliSync('sysctl', ['-w', 'net.ipv4.ip_forward=1']);
  if (process.getuid() !== 0) {
    return Promise.reject('spoofInit: Must be run as root!');
  }
  start();
  return Promise.resolve();
};


// todo:
// avahi-browse -atp --resolve (.local address finding)
// detect ip changes for a mac, then adjust spoofer &etc.
