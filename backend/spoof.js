const childProcess = require('child_process');
const sh = require('shelljs');
const nmap = require('./node-nmap');

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

function memoizePeriodic(fn) {
  let cache = {};
  return (...args) => {
    if (cache.v && Date.now() - cache.t < 1000 * 60 * 60) {
      return cache.v;
    } else {
      let res = fn();
      cache.v = res;
      cache.t = Date.now();
      return cache.v;
    }
  }
}

function addError(e) {
  console.log('ERROR spoof.js', e);
  state.errors.push(e.toString());
}

const thisMac = memoizePeriodic(() => {
  let ifconfig = sh.exec("ifconfig eth0", {silent:true}).stdout;
  let macSearch = /ether\s((\w{2}:){5}\w{2})/.exec(ifconfig);
  return macSearch.length === 3 ? macSearch[1].toUpperCase() : null;
});

const thisIp = memoizePeriodic(() => {
  let ifconfig = sh.exec("ifconfig eth0", {silent:true}).stdout;
  let ipSearch = /inet\s([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/.exec(ifconfig);
  return ipSearch.length === 2 ? ipSearch[1] : null;
});

const localRange = memoizePeriodic(() => {
  let iproute = sh.exec('ip route', {silent:true}).stdout;
  let search = /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\/[0-9]+/.exec(iproute);
  return search.length === 1 ? search[0] : null;
});

const thisGateway = memoizePeriodic(() => {
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

function spoofable(d) {
  //console.log('latestIp', d.latestIp);
  let ip = d.latestIp.ip;
  if (ip !== thisIp() && ip !== thisGateway() && !spoofing[ip]) {
    console.log('i want to spoof', d.mac, ip);
  }
}

function spoofLoop() {
  db.getDevices().then(ds => {
    ds.forEach(d => {
      spoofable(d) && arpSpoof(d.ip, thisGateway());
    })
  });
}

function arpSpoof(ip) {
  if (ip === thisIp()) {
    throw Error('cannot spoof pi-net-mon sensor');
  } else if (ip === thisGateway()) {
    throw Error('cannot spoof gateway');
  }
  if (spoofing[ip]) { return; }
/*
  let child = childProcess.spawn('arpspoof',['-i', 'eth0', '-t', ip, '-r', thisGateway()]);
  spoofing[ip] = child;
  //child.stdout.on('data', d => console.log('DATA', d.toString()));
  //child.stderr.on('data', e => console.log('ERROR', e.toString()));
  child.on('close', x => {
    console.log('CLOSE arpspoof', ip, 'code: ', x);
    spoofing[ip] = null; // clear the child after close
  });
  */
  //setTimeout(() => child.kill('SIGINT'), 35000);
}

function cleanupArpSpoof() {
  return new Promise((res, rej) => {
    Object.values(spoofing).forEach(child => {
      console.log('CLEANUP');
      child.kill('SIGINT');
      res();
    });
  });
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

module.exports.cleanup = cleanupArpSpoof;

spoofInit();
