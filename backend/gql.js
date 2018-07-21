const expressGraphql = require('express-graphql');
const { 
    buildSchema
} = require('graphql');

const install = require('./install');
const spoof = require('./spoof');
const bro = require('./bro');
const db = require('./db');

spoof.start();

let schema = buildSchema(`
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
    seen: String
  }
  type Port {
    port: Int
    protocol: String
    service: String
    seen: String
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
    latestHit: String
    assocHost: [String]
    sources: [String]
    protocols: [String]
    services: [String]
    macs: [String]
  }


  type Query {
    installStatus: InstallStatus
    installBro: Boolean
    broStatus: BroStatus
    status: Status
    devices: [Device]
    spoofStatus: SpoofStatus
    remoteHosts: [RemoteHost]
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
  devices.forEach(d => d.ips && 
    (d.ips = Object.values(d.ips).map(x => dateToIsoString(x, 'seen'))));
  devices.forEach(d => d.ports && 
    (d.ports = Object.values(d.ports).map(x => dateToIsoString(x, 'seen'))));
  devices.forEach(d => d.lastPortscanTime && 
    (d.lastPortscanTime = d.lastPortscanTime.toISOString()));
  devices.forEach(d => d.latestIp = dateToIsoString(d.latestIp, 'seen'));
  return devices;
};

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
  broStatus: bro.getState,
  status: status,
  spoofStatus: () => spoof.state,
  remoteHosts: () => db.getRemoteHosts().then(hs =>
    hs.map(h => dateToIsoString(h, 'latestHit'))),
  
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
      }))
};

module.exports = expressGraphql({
  schema: schema,
  rootValue: root,
  graphiql: true
});