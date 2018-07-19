const fs = require('fs');
const sh = require('shelljs');

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