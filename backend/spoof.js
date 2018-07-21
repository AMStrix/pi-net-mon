const childProcess = require('child_process');
const sh = require('shelljs');
const nmap = require('./node-nmap');

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
  spoofing: {

  }
};

function addError(e) {
  console.log('ERROR spoof.js', e);
  state.errors.push(e.toString());
}

const thisMac = f.memoizePeriodic(() => {
  let ifconfig = sh.exec("ifconfig eth0", {silent:true}).stdout;
  let macSearch = /ether\s((\w{2}:){5}\w{2})/.exec(ifconfig);
  return macSearch.length === 3 ? macSearch[1].toUpperCase() : null;
});

const thisIp = f.memoizePeriodic(() => {
  let ifconfig = sh.exec("ifconfig eth0", {silent:true}).stdout;
  let ipSearch = /inet\s([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/.exec(ifconfig);
  return ipSearch.length === 2 ? ipSearch[1] : null;
});

const localRange = f.memoizePeriodic(() => {
  let iproute = sh.exec('ip route', {silent:true}).stdout;
  let search = /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\/[0-9]+/.exec(iproute);
  return search.length === 1 ? search[0] : null;
});

const thisGateway = f.memoizePeriodic(() => {
  let iproute = sh.exec('ip route', {silent:true}).stdout;
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
      });
      ds.forEach(db.updateLocalIp);
      ds.forEach(db.updateDevice);
    });
    currentPingSweep.on('error', addError);
  }
}

function portScanLoop() {
  if (currentPortScan) { return; } // one at a time
  db.getDevices().then(ds => {
    ds.forEach(d => {
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
        res();
        state.portScan.scanStart = (new Date()).toISOString();
        state.portScan.host = ip;
        state.portScan.processing = true;
        currentPortScan = new nmap.OsAndPortScan(ip);
        currentPortScan.on('error', addError);
        currentPortScan.on('complete', ds => {
          state.portScan.processing = false;
          state.portScan.scanTime = currentPortScan.scanTime;
          ds.forEach(d => {
            !d.mac && d.ip === thisIp() && (d.mac = thisMac());
            d.lastPortscanTime = new Date();
            db.updateDevice(d);
          });
          currentPortScan = null;
          setTimeout(portScan, 0); // try to consume queue
        })
      }
    });
  });
}


function spoofInit() {
  let fwdOn = sh.exec(
    "echo 1 > /proc/sys/net/ipv4/ip_forward ", 
    { silent: true }
  ).stdout;
  if (process.getuid() !== 0) {
    throw new Error('spoofInit: Must be run as root!');
  }
}

function spoofable(ip) {
  return ip !== thisIp() && ip !== thisGateway() && !spoofing[ip];
}

function spoofLoop() {
  db.getDevices({ isSpoof: true }).then(ds => {
    //ds.forEach(d => console.log('isSpoof', d.mac));
    ds.forEach(d => arpSpoof(d.latestIp.ip));
  });
  db.getDevices({ isSpoof: false }).then(ds => {
    const kill = spoofChild => spoofChild && spoofChild.kill('SIGINT');
    ds.forEach(d => kill(spoofing[d.latestIp.ip]));
  });
}

function arpSpoof(ip) {
  if (ip === thisIp()) {
    throw Error('cannot spoof pi-net-mon sensor');
  } else if (ip === thisGateway()) {
    throw Error('cannot spoof gateway');
  }
  if (!spoofable(ip)) { return; }

  let args = ['-i', 'eth0', '-t', ip, '-r', thisGateway()];
  let child = childProcess.spawn('arpspoof', args);
  spoofing[ip] = child;
  //child.stdout.on('data', d => console.log('DATA', d.toString()));
  //child.stderr.on('data', e => console.log('ERROR', e.toString()));
  child.on('close', x => {
    console.log('CLOSE arpspoof', ip, 'code: ', x);
    spoofing[ip] = null; // clear the child after close
  });
}
//arpSpoof('192.168.0.101');
//arpSpoof('192.168.0.111');
//db.updateDevice({ mac: 'B8:27:EB:CB:37:2E', isSpoof: true });

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

module.exports.start = () => {
  if (running) return;
  running = true;
  updateState();
  setInterval(updateState, 1000);
  pingSweep();
  setInterval(pingSweep, 60 * 1000 * 20);
  portScanLoop();
  setInterval(portScanLoop, 60 * 1000);
  spoofLoop();
  setInterval(spoofLoop, 60 * 1000);
};

module.exports.scanIp = ip => {
  return portScan(ip);
}

module.exports.spoofDevice = (ip, isSpoof) => {
  if (thisGateway() === ip) {
    return Promise.resolve('cannot spoof gateway ' + ip);
  }
  if (thisIp() === ip) {
    return Promise.resolve('cannot spoof pi-net-mon device' + ip);
  }
  return db.updateDeviceByIp({ ip: ip, isSpoof: isSpoof })
    .then(x => spoofLoop() || null) // null is no-error
}

module.exports.onExit = cleanupArpSpoof;

spoofInit();

// todo:
// avahi-browse -atp --resolve (.local address finding)
// detect ip changes for a mac, then adjust spoofer &etc.
