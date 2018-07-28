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

function interpolateLastHour(arr) {
  let minutes = (new Date()).getMinutes();
  let pct = minutes/60;
  let prev = arr[arr.length-2].v;
  let pen = arr[arr.length-1].v;
  arr[arr.length-1].v = (1 - pct) * prev + pct * pen;
  return arr;
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
  return interpolateLastHour(out.reverse());
}

module.exports.isHostNewToday = host => {
  return host.birthday ?
    (new Date()).getDate() === (new Date(host.birthday)).getDate() :
    false;
}

function genDeepKeysByHour(from, to) {
  const hr = 1000 * 60 * 60;
  const hrCnt = (to - from) / hr;
  const keys = _.range(hrCnt).map(h => {
    const d = new Date(from.getTime() + (h * hr));
    return {
      key: `y${d.getUTCFullYear()}.m${d.getUTCMonth()}.d${d.getUTCDate()}.h${d.getUTCHours()}`,
      hr: moment(d).format('ha')
    };
  });
  return keys;
};
module.exports.deviceHostsToActivity24h = hitsString => {
  const hits = JSON.parse(hitsString);
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + 1); // include full hour
  const yesterday = new Date(Date.now() - 1000*60*60*23);
  const keys = genDeepKeysByHour(yesterday, now);
  const sums = keys.reduce((a, ko) => {
    if (_.get(hits, ko.key)) {
      a.push({
        ts: ko.hr,
        sum: _.values(_.get(hits, ko.key)).reduce((a,x) => a+x, 0),
        h: _.get(hits, ko.key)
      });
    } else {
      a.push({ ts: ko.hr, sum: 0, h: {} }); // no activity
    }
    return a;
  }, []);
  const topHostsMap = sums.reduce((a, s) => {
    _.keys(s.h).forEach(k => a[k] ? a[k] += s.h[k] : a[k] = s.h[k]);
    return a;
  }, {});
  let topHostsArr = _.keys(topHostsMap)
    .map(k => ({ h: k, v: topHostsMap[k] }))
    .sort((a, b) => b.v - a.v);
  const otherHostsArr = _.drop(topHostsArr, 5);
  topHostsArr = _.take(topHostsArr, 5);
  const keepHosts = topHostsArr.reduce((a, x) => (a[x.h] = true) && a, {});
  //const sumOtherHosts = otherHostsArr.reduce((a, x) => (a[x] = true) && a, {});
  _.forIn(sums, (v, k) => {
    const rem = [];
    let othersSum = 0;
    _.forIn(v.h, (hits, host) => {
      if (!keepHosts[host]) {
        othersSum += hits;
        rem.push(host);
      }
    });
    rem.forEach(r => delete v.h[r]);
    v.otherSum = othersSum;
  });
  // fill in missing top hosts (when they have 0 hits) so chart can render
  sums.forEach(s => topHostsArr.forEach(th => {
    if (!s.h[th.h]) {
      s.h[th.h] = 0;
    }
  }));
  const totalOtherSum = sums.reduce((tot, s) => s.otherSum + tot, 0);
  return { data: sums, topHosts: topHostsArr, totalOtherSum: totalOtherSum };
}















