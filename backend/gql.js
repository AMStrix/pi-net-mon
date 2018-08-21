const expressGraphql = require('express-graphql');
const { 
    buildSchema,
    GraphQLScalarType
} = require('graphql');
const { Kind } = require('graphql/language');
const _ = require('lodash');

const { ymdh } = require('./f');
const install = require('./install');
const spoof = require('./spoof');
const bro = require('./bro');
const broalyzer = require('./broalyzer');
const db = require('./db');
const feeds = require('./feeds');

spoof.start();

let schema = buildSchema(`
  scalar Date

  type InstallStatus {
    hasAdmin: Boolean
    hasBro: Boolean
    steps: [InstallStep]
  }
  type InstallStep {
    disp: String
    messages: [String]
    processing: Boolean
    complete: Boolean
    error: String
  }
  type Ip {
    ip: String!
    seen: Date
  }
  type Port {
    port: Int
    protocol: String
    service: String
    seen: Date
  }
  type Device {
    id: String!
    mac: String!
    name: String
    vendor: String
    birthday: Date
    os: String
    latestIp: Ip
    ips: [Ip]
    ports: [Port]
    isSensor: Boolean
    isGateway: Boolean
    isSpoof: Boolean
    spoofConflict: Boolean
    lastPortscanTime: Date
    beingPortscanned: Boolean
  }
  type BroStatus {
    version: String
    isDeployed: Boolean
    status: String
    errors: [String]
  }
  type Status {
    authed: Boolean
    authError: String
  }
  type ScanStatus {
    host: String
    scanStart: String
    scanTime: Int
    processing: Boolean
  }
  type SpoofStatus {
    errors: [String]
    pingSweep: ScanStatus
    portScan: ScanStatus
  }
  type ScanResult {
    devices: [Device]
    spoofStatus: SpoofStatus
    scanError: String
  }
  type SpoofResult {
    devices: [Device]
    spoofError: String
  }
  type DeviceResult {
    device: Device
    error: String
  }
  type RemoteHost {
    id: String!
    host: String!
    birthday: Date
    latestHit: Date
    latestMac: String
    latestDeviceName: String
    assocHosts: [String]
    sources: [String]
    protocols: [String]
    services: [String]
    macs: [String]
    devices: [Device]
    hits: String
  }
  type Feed {
    id: String!
    type: String
    description: String
    name: String
    lastupdate: String
    datatype: String
    frequency: Int
    active: Boolean
    count: Int
    rulesCount: Int
    processing: Boolean
    error: String
  }
  type RemoteHostsPage {
    hosts: [RemoteHost]
    count: Int
  }


  type Query {
    installStatus: InstallStatus
    installBro: Boolean
    broStatus: BroStatus
    status: Status
    devices: [Device]
    device(mac: String!): Device
    spoofStatus: SpoofStatus
    remoteHost(host: String!): RemoteHost
    remoteHosts(sortField: String, sortDir: Int, skip: Int, limit: Int, hostSearch: String, filter: String): [RemoteHost]
    remoteHostsPage(sortField: String, sortDir: Int, skip: Int, limit: Int, hostSearch: String, filter: String): RemoteHostsPage
    allHostHits24hr(date: Date!): String
    deviceHits24hr(mac: String!, date: Date!): String
    hostHits24hr(host: String!, date: Date!): String
    threatFeeds: [Feed]
  }

  type Mutation {
    createAdmin(user: String!, pass: String!): String
    login(user: String!, pass: String!): Status
    scan(ip: String!): ScanResult
    spoofDevice(mac: String!, isSpoof: Boolean): SpoofResult
    deployBro: BroStatus,
    nameDevice(mac: String!, name: String!): DeviceResult
    activateThreatFeed(id: String!, active: Boolean!): [Feed]
  }

`);

function dateToIsoString(obj, field) {
  if (obj[field]) {
    obj[field] = obj[field].toISOString();
  }
  return obj;
}

function devicesToGql(devices) {
  devices.forEach(deviceToGql);
  return devices;
};

function deviceToGql(d) {
  if (!d) return null;
  d.beingPortscanned = d.latestIp.ip === spoof.state.portScan.host;
  d.spoofConflict = spoof.state.spoofRejects[d.mac] || false;
  d.id = d.mac;
  d.ips && (d.ips = Object.values(d.ips));
  d.ports && (d.ports = Object.values(d.ports));
  return d;
}

function hostsToGql(hs) {
  hs.forEach(hostToGql);
  return hs;
}

function hostToGql(h) {
  h.id = h.host;
  return h;
}

function populateHostDevices(h) {
    return Promise
      .all(h.macs.map(m => db.getDevice(m).then(deviceToGql)))
      .then(devs => _.filter(devs, d => d ? true : false))
      .then(devs => _.set(h, 'devices', devs));
}

function login({user, pass}, {session}) {
  return db.authorize(user, pass)
    .then(err => {
      session.authed = true;
      return err;
    })
    .then(err =>  err && ({
        authError: err,
        authed: false
      }) || ({ 
        authed: true 
      }));
}

function status(_, {session}) {
  return {
    authed: session.authed
  };
}

function checkAuth(session) {
  console.log('check auth', session);
}

let root = {
  installStatus: install.getState,
  devices: () => db.getDevices().then(devicesToGql),
  device: ({mac}) => db.getDevice(mac).then(deviceToGql),
  broStatus: bro.getState,
  status: status,
  spoofStatus: () => spoof.state,
  remoteHost: ({host}) => db.getRemoteHost(host)
    .then(hostToGql)
    .then(populateHostDevices),
  remoteHosts: ({sortField, sortDir, skip, limit, hostSearch, filter}) => 
    db.getRemoteHosts(sortField, sortDir, skip, limit, hostSearch, filter)
    .then(hostsToGql),
  remoteHostsPage: ({sortField, sortDir, skip, limit, hostSearch, filter}) => 
    db.getRemoteHostsPage(sortField, sortDir, skip, limit, hostSearch, filter)
    .then(x => {
      x.hosts = hostsToGql(x.hosts);
      return x;
    }),
  allHostHits24hr: ({date}) => broalyzer
    .getHitsForAllHosts24hr(new Date(date))
    .then(JSON.stringify),
  deviceHits24hr: ({mac, date}) => broalyzer
    .getHitsForDevice24hr(mac, new Date(date))
    .then(JSON.stringify),
  hostHits24hr: ({host, date}) => broalyzer
    .getHitsForHost24hr(host, new Date(date))
    .then(JSON.stringify),
  threatFeeds: () => feeds.getFeeds(),

  createAdmin: ({user, pass}) => install.createAdmin(user, pass),
  installBro: install.install,
  login: login,
  scan: ({ip}) => 
    Promise.resolve([])
      .then(a => spoof.scanIp(ip).then(e => a.concat(e)))
      .then(a => db.getDevices().then(ds => a.concat([devicesToGql(ds)])))
      .then(([scanError, devices]) => ({
        scanError: scanError,
        spoofStatus: spoof.state,
        devices: devices
      })),
  deployBro: bro.deploy,
  spoofDevice: ({mac, isSpoof}) => 
    Promise.resolve([])
      .then(a => spoof.spoofDevice(mac, isSpoof).then(e => a.concat(e)))
      .then(a => db.getDevices().then(ds => a.concat([devicesToGql(ds)])))
      .then(([spoofErr, devices]) => ({
          spoofError: spoofErr,
          devices: devices
      })),
  nameDevice: ({mac, name}) =>
    db.nameDevice(mac, name)
      .then(deviceToGql)
      .then(d => ({ device: d }))
      .catch(e => ({ error: e })),
  activateThreatFeed: ({id, active}) => feeds.activateFeed(id, active),
};
module.exports = expressGraphql({
  schema: schema,
  rootValue: root,
  graphiql: true
});