const childProcess = require('child_process');
const _ = require('lodash');
const l = require('./log');

const cli = module.exports.cli = (cmd, args) => new Promise((res, rej) => {
  l.debug(`f.js cli(${cmd}, ${JSON.stringify(args)})`);
  let out = '';
  const child = childProcess.spawn(cmd, args);
  child.stdout.on('data', d => out+=d);
  child.stderr.on('data', d => out+=d);
  child.on('close', code => {
    l.debug(`f.js cli(${cmd}, ${JSON.stringify(args)}) closed with code ${code} & output: ${'\n'+out}`);
    code === 0 && res(out) || rej({ code: code, out: out});
  });
  child.on('error', e => {
    l.error(`f.js cli(${cmd}, ${JSON.stringify(args)}) error ${e.stack}`)
    rej({ out: out, error: e });
  });
});

const cliSync = module.exports.cliSync = (cmd, args) => {
  l.debug(`f.js cliSync(${cmd}, ${JSON.stringify(args)})`);
  const child = childProcess.spawnSync(cmd, args);
  if (child.error) {
    l.error(`f.js cliSync(${cmd}, ${JSON.stringify(args)}) error ${e.stack}`);
  }
  if (child.stdout) {
    const out = child.stdout.toString();
    l.debug(`f.js cliSync(${cmd}, ${JSON.stringify(args)}) out: ${'\n'+out}`);
    return out;
  }
  return null;
};

module.exports.memoizePeriodic = (fn, stale) => {
  const defaultStale = 1000 * 60 * 60;
  let cache = {};
  let outFn = (...args) => {
    let c = cache[args[0]];
    if (c && Date.now() - c.t < (stale || defaultStale)) {
      return c.v;
    } else {
      let res = fn(args[0]);
      cache[args[0]] = { v: res, t: Date.now() };
      return cache[args[0]].v;
    }
  }
  outFn.clear = (arg) => arg && cache[arg] ? (cache[arg] = null) : (cache = {});
  outFn.stale = stale || defaultStale;
  return outFn;
};

module.exports.promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
    promise
      .then(result => func()
      .then(Array.prototype.concat.bind(result))), Promise.resolve([]));

module.exports.ymdh = ymdh = date => [
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate(),
  date.getUTCHours()
];

