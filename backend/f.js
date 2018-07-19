

module.exports.memoizePeriodic = (fn, stale) => {
  const defaultStale = 1000 * 60 * 60;
  let cache = {};
  let outFn = (...args) => {
    if (cache.v && Date.now() - cache.t < (stale || defaultStale)) {
      return cache.v;
    } else {
      let res = fn();
      cache.v = res;
      cache.t = Date.now();
      return cache.v;
    }
  }
  outFn.clear = () => cache.t = 0;
  return outFn;
};
