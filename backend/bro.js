const fs = require('fs');
const util = require('util');
const Tail = require('tail').Tail;
const readdir = util.promisify(fs.readdir);

const l = require('./log');
const f = require('./f');
const db = require('./db');

const BROBIN = '/opt/nsm/bro/bin/broctl';

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
  l.error('bro.js', e);
  state.errors.push(e.toString());
  return true;
}

const cmdVersion = f.memoizePeriodic(() => 
  f.cli(BROBIN, ['--version']).catch(e => 'bro.js cmdVersion() error: ' + e.message)
);

const cmdStatus = f.memoizePeriodic(() => {
  const parse = (lines) => {
    const search = /bro\s+standalone\s+localhost\s+(\w+)/.exec(lines);
    return search.length === 2 ? search[1] : null;
  }
  return f.cli(BROBIN, ['status'])
    .then(parse)
    .catch(obj => {
      if (obj.error) {
        return 'bro.js cmdStatus() error: ' + e.message;
      } else if (obj.code == 1) { // crashed
        return parse(obj.out);
      }
      return `bro.js cmdStatus() exit code ${obj.code} output: ${obj.out}`;
    })
}, 1000*60*5);

const cmdDeploy = () => {
  if (deploying) { return false; }
  deploying = true;
  return f.cli(BROBIN, ['deploy'])
    .then(out => {
      l.info(`bro.js cmdDeploy() ${out}`);
      deploying = false;
      cmdStatus.clear()
    })
    .catch(obj => {
      l.error(`bro.js cmdDeploy() ${obj.code&&('code '+obj.code)} ${obj.out||''} ${obj.error||''}`);
      deploying = false;
      cmdStatus.clear()
      return null;
    });
}

let lastDnsUid = null;
const broHandlers = {
  http: d => {
    d = JSON.parse(d);
    l.info(`bro http > ${d['id.orig_h']} ${d.method} ${d.host} ${d['id.resp_h']} ${d.uri}`);
    const hitTime = new Date(d.ts * 1000);
    db.ipToMac(d['id.orig_h']).then(mac => 
      db.updateRemoteHostHit({
        host: d.host,
        latestHit: hitTime,
        latestMac: mac,
        assocHost: d['id.resp_h'],
        source: 'http',
        protocol: null,
        service: 'http',
        mac: mac
      }) &&
      db.updateDeviceHostHit({
        host: d.host,
        latestHit: hitTime,
        mac: mac
      })
    )
  },
  ssl: d => {
    d = JSON.parse(d);
    l.info(`bro ssl > ${d['id.orig_h']} ${d.version} ${d.server_name} ${d['id.resp_h']}`);
    const hitTime = new Date(d.ts * 1000);
    db.ipToMac(d['id.orig_h']).then(mac => 
      db.updateRemoteHostHit({
        host: d.server_name || d['id.resp_h'],
        latestHit: hitTime,
        latestMac: mac,
        assocHost: d.server_name ? d['id.resp_h'] : null,
        source: 'ssl',
        protocol: null,
        service: 'ssl',
        mac: mac
      }) &&
      db.updateDeviceHostHit({
        host: d.server_name || d['id.resp_h'],
        latestHit: hitTime,
        mac: mac
      })
    )
  },
  conn: d => {

  },
  dns: d => {
    // TODO: look into filtering "rcode_name":"NXDOMAIN"
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
    Promise.all([cmdVersion(), cmdStatus()])
      .then(([version, status]) =>{
        state.version = version;
        state.status = status;
        state.isDeployed = state.status === 'stopped' ? false : true;
        res(state)
      });
  })
  .catch(e => addError('updateState error: ' + e) && state);

module.exports.deploy = () => new Promise((res, rej) => {
  cmdDeploy();
  res(state);
});

init();
