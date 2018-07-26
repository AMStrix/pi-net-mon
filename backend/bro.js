const fs = require('fs');
const util = require('util');
const sh = require('shelljs');
const Tail = require('tail').Tail;
const readdir = util.promisify(fs.readdir);

const l = require('./log');
const f = require('./f');
const db = require('./db');

const BROBIN = 'sudo /opt/nsm/bro/bin/broctl';

const state = {
  version: null,
  isDeployed: false,
  status: null,
  errors: [],
};

let deploying = false;

function init() {
  watchLogs();
}

function addError(e) {
  l.info('ERROR bro.js', e);
  state.errors.push(e.toString());
  return true;
}

const cmdVersion = f.memoizePeriodic(() => {
  let out = sh.exec(BROBIN + ' --version', { silent: true }).stdout;
  return out;
});

const cmdStatus = f.memoizePeriodic(() => {
  let out = sh.exec(BROBIN + ' status', { silent: true }).stdout;
  let search = /bro\s+standalone\s+localhost\s+(\w+)/.exec(out);
  return search.length === 2 ? search[1] : null;
}, 1000*60*5);

const cmdDeploy = () => {
  if (deploying) { return false; }
  deploying = true;
  let out = sh.exec(BROBIN + ' deploy', { silent: false });
  deploying = false;
  cmdStatus.clear();
  return true;
}

let lastDnsUid = null;
const broHandlers = {
  http: d => {
    d = JSON.parse(d);
    l.info(`bro http > ${d['id.orig_h']} ${d.method} ${d.host} ${d['id.resp_h']} ${d.uri}`);
    db.ipToMac(d['id.orig_h']).then(mac => 
      db.updateRemoteHostHit({
        host: d.host,
        latestHit: new Date(d.ts*1000),
        latestMac: mac,
        assocHost: d['id.resp_h'],
        source: 'http',
        protocol: null,
        service: 'http',
        mac: mac
      })
    )
  },
  ssl: d => {
    d = JSON.parse(d);
    l.info(`bro ssl > ${d['id.orig_h']} ${d.version} ${d.server_name} ${d['id.resp_h']}`);
    db.ipToMac(d['id.orig_h']).then(mac => 
      db.updateRemoteHostHit({
        host: d.server_name || d['id.resp_h'],
        latestHit: new Date(d.ts*1000),
        latestMac: mac,
        assocHost: d.server_name ? d['id.resp_h'] : null,
        source: 'ssl',
        protocol: null,
        service: 'ssl',
        mac: mac
      })
    )
  },
  conn: d => {

  },
  dns: d => {
    d = JSON.parse(d);
    if (d.uid === lastDnsUid) { return; } // 2 ident. dns entries coming on the log
    lastDnsUid = d.uid;
    l.info(`bro dns > ${d['id.orig_h']} ${d.query} ${d.uid}`);
    if (d['id.resp_p'] != 53) return; // ignore avahi/bonjour & 137 &etc. for now
    if (!d.query) return; // ignore if no query (host)
    const hitTime = new Date(d.ts * 1000);
    db.ipToMac(d['id.orig_h']).then(mac => 
      mac && // only if we have a mac (for ipv6 addys)
      db.updateRemoteHostHit({
        host: d.query,
        latestHit: hitTime,
        latestMac: mac,
        //assocHost: d['id.resp_h'], //gateway, consider "answers array"
        source: 'dns',
        protocol: d.proto,
        service: 'dns',
        mac: mac
      }) &&
      db.updateDeviceHostHit({
        host: d.query,
        latestHit: hitTime,
        mac: mac
      })
    )
  }
}

function handleFilechange(src, d) {
  broHandlers[src] && broHandlers[src](d);
}

const watching = {};

function touch(path) {
  fs.closeSync(fs.openSync(path, 'a'));
}

function watch(eventSource, path) {
  touch(path); // touch (in case non-existing)
  l.info('bro.js watching bro log file ' + path);
  watching[eventSource] = new Tail(path, { follow: true });
  watching[eventSource].on('line', d => handleFilechange(eventSource, d));
  watching[eventSource].on('error', e => {
    touch(path);
    l.error('bro.js watch bro log file error: ' + JSON.stringify(e, null, 2));
    watching[eventSource].unwatch();
    watching[eventSource].watch();
  });
}

function watchLogs() {
  const logDir = '/opt/nsm/bro/logs/current/';
  const logs = ['http', 'conn', 'dns', 'files', 'ssl'];
  logs.forEach(l => watch(l, logDir + l + '.log'));
}

module.exports.getState = () => 
  new Promise((res, rej) => {
    state.version = cmdVersion();
    state.status = cmdStatus();
    state.isDeployed = state.status === 'stopped' ? false : true;
    res(state)
  })
  .catch(e => addError('updateState error: ' + e) && state);

module.exports.deploy = () => new Promise((res, rej) => {
  cmdDeploy();
  res(state);
});

init();
