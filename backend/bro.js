const fs = require('fs');
const util = require('util');
const sh = require('shelljs');
const Tail = require('tail').Tail;
const readdir = util.promisify(fs.readdir);

const f = require('./f');

const BROBIN = 'sudo /opt/nsm/bro/bin/broctl';

const state = {
  version: null,
  isDeployed: false,
  status: null,
  errors: [],
};

let deploying = false;

function init() {

}

function addError(e) {
  console.log('ERROR bro.js', e);
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
  // todo - state.isDeployed/state.status
  cmdStatus.clear();
  //console.log('cmdDeploy out', out);
  return true;
}

const broHandlers = {
  http: d => {
    d = JSON.parse(d);
    console.log('http| ', d['id.orig_h'], d.method, d.host, d['id.resp_h']);
  },
  conn: d => {

  },
  dns: d => {
    d = JSON.parse(d);
    console.log('dns| ', d['id.orig_h'], d.query)
  }
}

function handleFilechange(src, d) {
  broHandlers[src] && broHandlers[src](d);
}

const watching = {};

function watch(eventSource, path) {
  fs.closeSync(fs.openSync(path, 'a')); // touch (in case non-existing)
  console.log(eventSource, path);
  watching[eventSource] = new Tail(path, { follow: true });
  watching[eventSource].on('line', d => handleFilechange(eventSource, d));
  watching[eventSource].on('error', e => {
    console.log('bro.js watch error: ', e);
    console.log('...try to unwatch, then watch again to remedy.');
    watching[eventSource].unwatch();
    watching[eventSource].watch();
  });
}

function watchLogs() {
  const logDir = '/opt/nsm/bro/logs/current/';
  const logs = ['http', 'conn', 'dns', 'files'];
  logs.forEach(l => watch(l, logDir + l + '.log'));
}
watchLogs();

function updateState() {
  return new Promise((res, rej) => {
    state.version = cmdVersion();
    state.status = cmdStatus();
    state.isDeployed = state.status === 'stopped' ? false : true;
    res(state)
  }).catch(e => addError('updateState error: ' + e) && state);
}
module.exports.getState = updateState;

module.exports.deploy = () => new Promise((res, rej) => {
  cmdDeploy();
  res(state);
});

// sudo /opt/nsm/bro/bin/broctl deploy
// sudo /opt/nsm/bro/bin/broctl start
// /opt/nsm/bro/logs/current/

///opt/nsm/bro/logs/current
//communication.log  conn.log  loaded_scripts.log  packet_filter.log  reporter.log  stats.log  stderr.log  stdout.log  weird.log