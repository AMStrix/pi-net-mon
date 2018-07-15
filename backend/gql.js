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
  type Status {
    authed: Boolean,
    authError: String
  }


  type Query {
    installStatus: InstallStatus,
    installBro: Boolean,
    broStatus: BroStatus,
    status: Status,
    devices: [Device]
  }

  type Mutation {
    createAdmin(user: String!, pass: String!): String,
    login(user: String!, pass: String!): Status
  }

`);

function devicesToGql(devices) {
  devices.forEach(d => d.ips = Object.values(d.ips));
  return devices;
};

function login({user, pass}, {session}) {
  console.log('u/p', user, pass);
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
};

module.exports = expressGraphql({
  schema: schema,
  rootValue: root,
  graphiql: true
});