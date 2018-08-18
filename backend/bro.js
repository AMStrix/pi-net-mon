const fs = require('fs');
const util = require('util');
const Tail = require('tail').Tail;
const readdir = util.promisify(fs.readdir);

const l = require('./log');
const f = require('./f');
const db = require('./db');
const ba = require('./broalyzer');

const BROBIN = '/opt/nsm/bro/bin/broctl';

const state = {
  version: null,
  isDeployed: false,
  status: null,
  errors: [],
};

let deploying = false;

function init() {
  cmdDeploy()
    .then(() => watchLogs());
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

function handleFilechange(broType, d) {
  ba.handleBroEvent(broType, JSON.parse(d));
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
