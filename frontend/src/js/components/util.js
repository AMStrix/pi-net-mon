import _ from 'lodash';
import moment from 'moment';

function interpolateLastHour(arr) {
  let minutes = (new Date()).getMinutes();
  let pct = minutes/60;
  let prev = arr[arr.length-2].v;
  let pen = arr[arr.length-1].v;
  arr[arr.length-1].v = (1 - pct) * prev + pct * pen;
  return arr;
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

module.exports.processAllHostHitsForActive = hitString => {
  const fromServer = JSON.parse(hitString);
  const hostsMap = fromServer.reduce((hs, hr) => {
    _.forEach(hr.host, ({hits}, k) => {
      hs[k] ? (hs[k] += hits) : (hs[k] = hits);
    });
    return hs;
  }, {});
  const hosts = _.map(hostsMap, (v, k) => ({ host: k, hitCount: v }));
  hosts.sort((a, b) => b.hitCount - a.hitCount);
  const max = hosts.length && hosts[0].hitCount || 0;
  return {
    hosts: hosts,
    max: max
  };
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

const parseQueryValue = v => /^[-]?[\d]+$/.test(v) && parseInt(v, 10) || v;
module.exports.parseQuery = qs => 
  qs.replace('?', '')
    .split('&')
    .map(s => s.split('='))
    .reduce((a, x) => (a[x[0]] = parseQueryValue(x[1])) && a, {})||{};














