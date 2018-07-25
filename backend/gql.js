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
    mac: String!
    vendor: String
    os: String
    latestIp: Ip
    ips: [Ip]
    ports: [Port]
    isSensor: Boolean
    isGateway: Boolean
    isSpoof: Boolean
    lastPortscanTime: String
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
    spoofStatus: SpoofStatus
    scanError: String
  }
  type SpoofResult {
    devices: [Device]
    spoofError: String
  }
  type RemoteHost {
    host: String
    birthday: Date
    latestHit: Date
    latestMac: String
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
  }

  type Mutation {
    createAdmin(user: String!, pass: String!): String
    login(user: String!, pass: String!): Status
    scan(ip: String!): ScanResult
    spoofDevice(ip: String!, isSpoof: Boolean): SpoofResult
    deployBro: BroStatus
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
  d.ips && (d.ips = Object.values(d.ips));
  d.ports && (d.ports = Object.values(d.ports));
  return d;
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

const histPaths = {
  '1h': d => [ymdh(new Date(+d - 1000*60*60)), ymdh(d)],
  '1d': d => [_.dropRight(ymdh(new Date(+d - 1000*60*60*24))), _.dropRight(ymdh(d))]
};

let root = {
  installStatus: install.getState,
  devices: () => db.getDevices().then(devicesToGql),
  device: ({mac}) => db.getDevice(mac).then(deviceToGql),
  broStatus: bro.getState,
  status: status,
  spoofStatus: () => spoof.state,
  remoteHosts: ({sortField, sortDir, skip, limit}) => 
    db.getRemoteHosts(sortField, sortDir, skip, limit)
    .then(hs => hs.map(h => h)),
  activeHosts: ({period}) => {
    let args = histPaths[period](new Date());
    return db.getActiveHosts.apply(null, args)
      .then(ahs => ahs.map(ah => (ah.hits=JSON.stringify(ah.hits))&&ah));
  },

  createAdmin: ({user, pass}) => install.createAdmin(user, pass),
  installBro: install.install,
  login: login,
  scan: ({ip}) => spoof.scanIp(ip).then((e) => {
    return {
      scanError: e,
      spoofStatus: spoof.state
    };
  }),
  deployBro: bro.deploy,
  spoofDevice: ({ip, isSpoof}) => 
    Promise.resolve([])
      .then(a => spoof.spoofDevice(ip, isSpoof).then(e => a.concat(e)))
      .then(a => db.getDevices().then(ds => a.concat([devicesToGql(ds)])))
      .then(([spoofErr, devices]) => ({
          spoofError: spoofErr,
          devices: devices
      })),

  Date: () => console.log('Hello world')
};
module.exports = expressGraphql({
  schema: schema,
  rootValue: root,
  graphiql: true
});