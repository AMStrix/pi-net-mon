import _ from 'lodash';
import moment from 'moment';

function sumLeavesDay(tree) {
  const start = new Date();
  const mkey = d => 'd' + d.getUTCDate() + 'h' + d.getUTCHours();
  const keys = _.range(24).map(h => {
      let k = mkey(start);
      start.setHours(start.getHours() -1);
      return k;
    }).reduce((a, k) => (a[k] = true) && a, {});
  const filter = (v, p, gp) => keys[gp + p] ? v : 0;
  return sumLeaves(tree, null, null, filter);
}

const sumLeaves = (x, p, gp, filter) => {
  if (_.isObject(x)) {
    return Object.keys(x).reduce((a, k) => a + sumLeaves(x[k], k, p, filter), 0);
  }
  return filter(x, p, gp);
}

const processActiveHostHitSums = module.exports.processActiveHostHitSums = activeHosts => {
  const o = {};
  o.hosts = activeHosts && activeHosts
    .map(h => Object.assign({ hitCount: sumLeavesDay(JSON.parse(h.hits)) }, h))
    .sort((a, b) => b.hitCount - a.hitCount) || [];
  o.hosts = o.hosts.filter(x => x.hitCount > 0);
  o.count = o.hosts.length;
  o.max = o.hosts.length && o.hosts[0].hitCount;
  return o;
}

function groupHourlySums(sums, host) {
  const hits = JSON.parse(host.hits);
  const pullHours = (x, p, gp) => {
    _.isObject(x) && Object.keys(x).forEach(k => pullHours(x[k], k, p));
    if (_.isNumber(x)) {
      sums[gp+p] = (sums[gp+p] || 0) + x;
    }
  };
  pullHours(hits);
  return sums;
}

module.exports.processActiveHostsHourlySums = activeHosts => {
  const map = activeHosts && activeHosts
    .reduce(groupHourlySums, {}) || [];
  let max = Object.values(map).reduce((m, x) => m > x ? m : x, 0);
  const start = new Date();
  const mkey = d => 'd' + d.getUTCDate() + 'h' + d.getUTCHours();
  const out = _.range(24).map(h => {
    let k = mkey(start);
    let d = new Date(+start);
    let z = { ts: moment(d).format('ha'), v: (map[k] || 0) };
    start.setHours(start.getHours() - 1);
    return z;
  });
  const isMaxima = (x, i, arr) => {
    const gt = (a, b) => _.isNumber(b) ? a > b : true;
    const m = gt(x, arr[i-1]) && gt(x, arr[i+1]);
    const sig = (x, b, a) => 
      (Math.abs(x - b) > 0.05 * max) || (Math.abs(x - b) > 0.05 * max);
    m && sig(x, arr[i-1], arr[i+1]) && (out[i].maxima = true);
  }
  out.map(x => x.v).map((x, i, arr) => isMaxima(x,i,arr));
  return out.reverse();
}