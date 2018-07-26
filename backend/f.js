const _ = require('lodash');

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