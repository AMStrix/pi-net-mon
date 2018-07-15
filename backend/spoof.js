const sh = require('shelljs');
const nmap = require('./node-nmap');

const db = require('./db');

const INTERFACE = 'eth0';
let running = false;
let currentPingSweep = null;

// let qs = new nmap.QuickScan('192.168.0.1-255');
// let hosts;

// qs.on('complete', d => hosts = d);
// qs.on('error', d => console.log('error', d));

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
      ds.forEach(d => { 
        if (d.ip === hostIp) { 
          d.mac = thisMac();
          d.isSensor = true; 
        } 
      });
      //console.log(ds);
      ds.forEach(db.updateLocalIp);
      ds.forEach(db.updateDevice);
    });
    currentPingSweep.on('error', addError);
  }
}

function portScan() {
  
}

function updateState() {
  //console.log('currentPingSweep', currentPingSweep ? currentPingSweep.scanTime : 'not running');
  if (currentPingSweep) {
    state.pingSweep.scanTime = currentPingSweep.scanTime;
  }
}

//pingSweep();
//console.log(localRange())
//console.log(thisIp());
//console.log(sh.exec("ifconfig eth0", {silent:true}).stdout);

module.exports = {};

module.exports.state = state;

module.exports.start = () => {
  if (running) return;
  running = true;
  updateState();
  setInterval(updateState, 1000);
  pingSweep();
  setInterval(pingSweep, 60 * 1000 * 20);
};
