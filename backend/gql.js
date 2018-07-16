let expressGraphql = require('express-graphql');
let { 
    buildSchema
} = require('graphql');

let install = require('./install');
let spoof = require('./spoof');
let db = require('./db');

spoof.start();

let schema = buildSchema(`
  type InstallStatus {
    hasAdmin: Boolean,
    hasBro: Boolean,
    steps: [InstallStep]
  }
  type InstallStep {
    disp: String,
    messages: [String],
    processing: Boolean,
    complete: Boolean,
    error: String
  }
  type Ip {
    ip: String!,
    seen: String
  }
  type Port {
    port: Int,
    protocol: String,
    service: String,
    seen: String
  }
  type Device {
    mac: String!,
    vendor: String,
    os: String,
    ips: [Ip],
    ports: [Port],
    isSensor: Boolean,
    isGateway: Boolean,
    lastPortscanTime: String
  }
  type BroStatus {
    isDeployed: Boolean
  }
  type Status {
    authed: Boolean,
    authError: String
  }
  type ScanStatus {
    host: String,
    scanStart: String,
    scanTime: Int,
    processing: Boolean
  }
  type SpoofStatus {
    errors: [String],
    pingSweep: ScanStatus,
    portScan: ScanStatus
  }


  type Query {
    installStatus: InstallStatus,
    installBro: Boolean,
    broStatus: BroStatus,
    status: Status,
    devices: [Device],
    spoofStatus: SpoofStatus
  }

  type Mutation {
    createAdmin(user: String!, pass: String!): String,
    login(user: String!, pass: String!): Status
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
  createAdmin: ({user, pass}) => install.createAdmin(user, pass),
  installBro: install.install,
  devices: () => db.getDevices().then(devicesToGql),
  broStatus: { isDeployed: false },
  status: status,
  login: login,
  spoofStatus: () => spoof.state
};

module.exports = expressGraphql({
  schema: schema,
  rootValue: root,
  graphiql: true
});