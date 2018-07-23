

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
  return outFn;
};

module.exports.promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
    promise
      .then(result => func()
      .then(Array.prototype.concat.bind(result))), Promise.resolve([]));

module.exports.ymdh = date => [
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate(),
  date.getUTCHours()
];