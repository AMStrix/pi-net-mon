const _ = require('lodash');

const { isStringIp } = require('./f');
const db = require('./db');
const feeds = require('./feeds');

const poopInfo = eventGroup => {
  console.log('BRO event ', eventGroup[0].uid);
  console.log('    > types ', eventGroup.map(e => e.broType).join(', '));
  const conns = _.filter(eventGroup, { broType: 'conn'});
  console.log('    > conns count', conns.length);
  console.log('    > local o/r', conns[0].local_orig, conns[0].local_resp);
  console.log('    > proto/service', conns[0].proto, conns[0].service);
};

const get = (g, f, d) => {
  const match = _.find(g, x => x[f] !== undefined);
  if (match) return match[f];
  return d || null;
};

const extractIps = eventGroup => {
  const uid = get(eventGroup, 'uid');
  const localResp = get(eventGroup, 'local_resp');
  const respIp = get(eventGroup, 'id.resp_h');
  const dnsAnswers = get(eventGroup, 'answers', []);
  const ips = !localResp && [respIp].concat(dnsAnswers) || dnsAnswers;
  return ips.filter(isStringIp);
};

module.exports.catchThreats = eventGroup => new Promise((res, rej) => {
  const mac = get(eventGroup, 'orig_l2_addr').toUpperCase();
  const origIp = get(eventGroup, 'id.orig_h');
  const host = ['host', 'server_name', 'query']
    .map(fn => (_.find(eventGroup, fn)||{})[fn])
    .find(z => z);

  const ips = extractIps(eventGroup);
  const ipThreat = ips.map(ip => feeds.getIps()[ip]).filter(x => x)[0];
  const domainThreat = feeds.getDomains()[host];
  
  (domainThreat || ipThreat) && bufferThreat({
    key: mac + (ipThreat&&ipThreat.ipv4 || host),
    ip: ipThreat && ipThreat.ipv4 || null,
    domain: host || null,
    mac: mac,
    ipThreat: ipThreat,
    domainThreat: domainThreat
  });

  res();
});

const THREAT_BUFFER_TIMEOUT = 5000;
const threatCache = {};
const bufferThreat = threat => {
  const key = threat.key;
  threat.time = Date.now();
  threatCache[key] = threat;
  setTimeout(() => drainThreat(key), THREAT_BUFFER_TIMEOUT + 1);
}
const drainThreat = key => {
  const exist = threatCache[key];
  if (exist && Date.now() - exist.time > THREAT_BUFFER_TIMEOUT) {
    delete threatCache[key];
    addThreatFeedAlert(_.defaults({
      time: new Date(exist.time),
      level: 10,
      type: 'threatFeedMatch'
    }, exist));
  }
}

module.exports.catchDomainThreats = eventGroup => new Promise((res, rej) => {
  res();
});

const addThreatFeedAlert = alert => {
  return db.addAlert(alert);
};