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
    device: Device,
    error: String
  }
  type RemoteHost {
    id: String!
    host: String!
    birthday: Date
    latestHit: Date
    latestMac: String
    latestDeviceName: String
    assocHost: [String]
    sources: [String]
    protocols: [String]
    services: [String]
    macs: [String]
    hits: String
  }


  type Query {
    installStatus: InstallStatus
    installBro: Boolean
    broStatus: BroStatus
    status: Status
    devices: [Device]
    device(mac: String!): Device
    spoofStatus: SpoofStatus
    remoteHosts(sortField: String, sortDir: Int, skip: Int, limit: Int): [RemoteHost]
    activeHosts(period: String): [RemoteHost]
    deviceHits24hr(mac: String!, date: Date!): String
  }

  type Mutation {
    createAdmin(user: String!, pass: String!): String
    login(user: String!, pass: String!): Status
    scan(ip: String!): ScanResult
    spoofDevice(ip: String!, isSpoof: Boolean): SpoofResult
    deployBro: BroStatus,
    nameDevice(mac: String!, name: String!): DeviceResult
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
  d.beingPortscanned = d.latestIp.ip === spoof.state.portScan.host;
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
  h.hits && (h.hits = JSON.stringify(h.hits));
  h.id = h.host;
  return h;
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
  remoteHosts: ({sortField, sortDir, skip, limit}) => 
    db.getRemoteHosts(sortField, sortDir, skip, limit)
    .then(hostsToGql),
  activeHosts: ({period}) => {
    return db.getActiveHosts(new Date(Date.now() - 1000*60*60*24), new Date())
      .then(hostsToGql);
  },
  deviceHits24hr: ({mac, date}) => broalyzer
    .getHitsForDevice24hr(mac, date)
    .then(x => JSON.stringify(x)),

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
  spoofDevice: ({ip, isSpoof}) => 
    Promise.resolve([])
      .then(a => spoof.spoofDevice(ip, isSpoof).then(e => a.concat(e)))
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
};
module.exports = expressGraphql({
  schema: schema,
  rootValue: root,
  graphiql: true
});