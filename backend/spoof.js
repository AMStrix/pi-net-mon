const sh = require('shelljs');
const nmap = require('./node-nmap');

const db = require('./db');

const INTERFACE = 'eth0';
let running = false;
let currentPingSweep = null;
let currentPortScan = null;
let attemptPortScan = null;

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
  }
};

function addError(e) {
  console.log('ERROR spoof.js', e);
  state.errors.push(e.toString());
}

function thisMac() {
  let ifconfig = sh.exec("ifconfig eth0", {silent:true}).stdout;
  let macSearch = /ether\s((\w{2}:){5}\w{2})/.exec(ifconfig);
  return macSearch.length === 3 ? macSearch[1].toUpperCase() : null;
}

function thisIp() {
  let ifconfig = sh.exec("ifconfig eth0", {silent:true}).stdout;
  let ipSearch = /inet\s([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/.exec(ifconfig);
  return ipSearch.length === 2 ? ipSearch[1] : null;
}

function localRange() {
  let ip = thisIp();
  return ip ? ip + '/24' : null;
}

function thisGateway() {
  let iproute = sh.exec('ip route', {silent:true}).stdout;
  let gwSearch = /default\svia\s([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/.exec(iproute);
  return gwSearch.length === 2 ? gwSearch[1] : null;
}

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

function latestDeviceIp(dev) {
  return Object.values(dev.ips).reduce((latest, ip) => {
    if (latest.seen - ip.seen > 0) {
      return latest;
    } else {
      return ip;
    }
  });
}

function portScanLoop() {
  if (currentPortScan) { return; } // one at a time
  let staleAfter = 60 * 1000 * 60 * 12; // 12 hrs
  let now = new Date();
  db.getDevices().then(ds => {
    ds.forEach(d => {
      if (!d.lastPortscanTime || now - d.lastPortscanTime > staleAfter) {
        portScan(latestDeviceIp(d).ip);
      }
    })
  });
}

function portScan(ip) {
  if (currentPortScan) { return; }
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
  })
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
};

module.exports.scanIp = ip => {
  portScan(ip);
}
