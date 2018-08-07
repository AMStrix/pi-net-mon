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
  const isMaxima = (x, i, arr, pArr) => {
    const gt = (a, b) => _.isNumber(b) ? a > b : true;
    const m = gt(x, arr[i-1]) && gt(x, arr[i+1]);
    const sig = (x, b, a) => 
      (Math.abs(x - b) > 0.05 * max) || (Math.abs(x - b) > 0.05 * max);
    m && sig(x, arr[i-1], arr[i+1]) && (pArr[i].maxima = true);
  }
  out.map(x => x.v).map((x, i, arr) => isMaxima(x, i, arr, out));
  return interpolateLastHour(out.reverse());
}

module.exports.isHostNewToday = host => {
  return host.birthday ?
    (new Date()).getDate() === (new Date(host.birthday)).getDate() :
    false;
}

const tagMaxima = (x, i, arr, pArr, max) => {
  const gt = (a, b) => _.isNumber(b) ? a > b : true;
  const m = gt(x, arr[i-1]) && gt(x, arr[i+1]);
  const sig = (x, b, a) => 
    (Math.abs(x - b) > 0.05 * max) || (Math.abs(x - b) > 0.05 * max);
  m && sig(x, arr[i-1], arr[i+1]) && (pArr[i].maxima = true);
}

module.exports.processAllHostHitsForChart = hitString => {
  const fromServer = JSON.parse(hitString);
  const sumByHr = fromServer.map(hr => {
    const hrLabel = moment(hr.time).format('ha');
    const sum = _.values(hr.host).reduce((sum, {hits}) => sum+hits, 0);
    return { ts: hrLabel, v: sum };
  });
  const max = sumByHr.reduce((m, x) => Math.max(m, x.v), 0);
  sumByHr.map(x => x.v).forEach((x, i, arr) => tagMaxima(x, i, arr, sumByHr, max));
  return sumByHr;
}

module.exports.processDeviceHitsForChart = hitString => {
  const fromServer = JSON.parse(hitString);
  // top hosts
  const hosts = fromServer.reduce((hosts, hr) => {
    _.forEach(hr.device.host, (v, k) => {
      hosts[k] ? (hosts[k] += v.hits) : (hosts[k] = v.hits);
    });
    return hosts;
  }, {});
  const hostsArr = _.transform(hosts, (a, v, k) => a.push([k, v]), []);
  hostsArr.sort((a, b) => b[1] - a[1]);
  const topHostsArr = _.take(hostsArr, 5).map(x => ({ h: x[0], v: x[1] }));
  const topHostsMap = topHostsArr.reduce((a, h) => (a[h.h] = true) && a, {});
  const totalOtherSum = _.drop(hostsArr, 5).reduce((a, x) => a += x[1], 0);
  // data 
  const data = fromServer.map(item => {
    const hrLabel = moment(item.time).format('ha');
    const topH = _.transform(topHostsMap, (a, v, k) => {
      item.device.host[k] && (a[k] = item.device.host[k].hits) || (a[k] = 0);
    }, {});
    const topHSum = _.reduce(topH, (a, v) => a + v, 0);
    return {
      ts: hrLabel,
      sum: item.device.hits,
      otherSum: item.device.hits - topHSum,
      h: topH
    }
  });
  return {
    totalOtherSum: totalOtherSum,
    topHosts: topHostsArr,
    data: data
  }
}















