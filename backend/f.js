const childProcess = require('child_process');
const _ = require('lodash');
const l = require('./log');

const cli = module.exports.cli = (cmd, args) => new Promise((res, rej) => {
  l.verbose(`f.js cli(${cmd}, ${JSON.stringify(args)})`);
  let out = '';
  const child = childProcess.spawn(cmd, args);
  child.stdout.on('data', d => out+=d);
  child.stderr.on('data', d => out+=d);
  child.on('close', code => {
    l.verbose(`f.js cli(${cmd}, ${JSON.stringify(args)}) closed with code ${code} & output: ${'\n'+out}`);
    code === 0 && res(out) || rej({ code: code, out: out});
  });
  child.on('error', e => {
    l.error(`f.js cli(${cmd}, ${JSON.stringify(args)}) error ${e.stack}`)
    rej({ out: out, error: e });
  });
});

const cliSync = module.exports.cliSync = (cmd, args) => {
  l.verbose(`f.js cliSync(${cmd}, ${JSON.stringify(args)})`);
  const child = childProcess.spawnSync(cmd, args);
  if (child.error) {
    l.error(`f.js cli(${cmd}, ${JSON.stringify(args)}) error ${e.stack}`);
  }
  if (child.stdout) {
    const out = child.stdout.toString();
    l.verbose(`f.js cli(${cmd}, ${JSON.stringify(args)}) out: ${'\n'+out}`);
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

module.exports.dateToArray = dateToArray = d => _.dropRight(ymdh(d));

module.exports.makeDatePath = makeDatePath = d => {
  const dArr = dateToArray(d);
  const bp = (s, p, v) => _.isNumber(v) ? (s + '.' + p + v) : s;
  const makePath = (y, m, d, h) => _.zip(['y', 'm', 'd', 'h'], [y, m, d, h])
    .reduce((a, x) => bp(a, x[0], x[1]), 'hits');
  return makePath.apply(null, dArr);
};

module.exports.makeHitsByDateSearch = (from, to) => {
  const pathFrom = makeDatePath(from);
  const pathTo = makeDatePath(to);
  const find = { $or: [{}, {}] }; 
  const op = _.isNumber(from[3]) && { $gt: 0 } || { $exists: true };
  find.$or[0][pathFrom] = op;
  find.$or[1][pathTo] = op;
  const proj = { host: 1 }; 
  proj[pathFrom] = 1;
  proj[pathTo] = 1;
  return { find: find, proj: proj };
};

const hostToKey = (h) => h.replace(/\./g, '_');
const keyToHost = (h) => h.replace(/_/g, '.');
module.exports.makeDeviceHostHitUpdate = (host, date) => {
  const out = {};
  const hKey = hostToKey(host);
  const ymdhArr = ymdh(date);
  const pathSum = `hitsSum.${hKey}`;
  const path = `hits.y${ymdhArr[0]}.m${ymdhArr[1]}.d${ymdhArr[2]}.h${ymdhArr[3]}.host${hKey}`;
  out.$inc = {};
  out.$inc[pathSum] = 1;
  out.$inc[path] = 1;
  return out;
};