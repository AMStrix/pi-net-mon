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
  type Device {
    mac: String!,
    vendor: String,
    ips: [Ip],
    isSensor: Boolean
  }
  type BroStatus {
    isDeployed: Boolean
  }

  type Query {
    installStatus: InstallStatus,
    installBro: Boolean,
    broStatus: BroStatus,
    devices: [Device]
  }
  type Mutation {
    createAdmin(user: String!, pass: String!): String,
  }
`);

function devicesToGql(devices) {
  devices.forEach(d => d.ips = Object.values(d.ips));
  return devices;
};

let root = {
  installStatus: install.getState,
  createAdmin: install.createAdmin,
  installBro: install.install,
  devices: () => db.getDevices().then(devicesToGql),
  broStatus: { isDeployed: false }
};

module.exports = expressGraphql({
  schema: schema,
  rootValue: root,
  graphiql: true
});