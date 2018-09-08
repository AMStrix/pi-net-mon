const express = require('express');
const path = require('path');

const session = require('./session');
const gql = require('./gql');

const l = require('./log');
const broalyzer = require('./broalyzer');
const spoof = require('./spoof');
const feeds = require('./feeds');
const db = require('./db');
const install = require('./install');
const bro = require('./bro');

const app = express();

db.init()
  .then(() => {
    const { hasAdmin, hasBro } = install.getState();
    Promise.all([hasAdmin(), hasBro()])
      .then(([admin, bro]) => {
        if (!admin || !bro) {
          init();
        } else {
          finishInit();
        }
      });
  });

const finishInit = () => spoof.init()
  .then(bro.init)
  .then(broalyzer.init)
  .then(feeds.init)
  .then(init);

let serverRunning = false;
function init() {
  if ( serverRunning ) return;
  app.use(session);
  app.use((req, res, next) => {
    if (req.session.x) { req.session.x = req.session.x + 1; }
    else { req.session.x = 1; }
    next();
  });
  app.use(express.static('../frontend/dist'));
  app.use('/graphql', gql);
  app.use('/*', (req, res) => {
    res.sendFile(path.resolve('../frontend/dist/index.html'));
  });
  app.listen(80, () => l.info('Server started on port 80'));
  serverRunning = true;
}

function handleExit(signal) {
  l.info(`*** pi-net-mon shutting down (${signal}) ***`);
  spoof.onExit()
    .then(() => broalyzer.onExit())
    .then(() => process.exit());
}

function handleSignal(signal, fn) {
  process.on(signal, () => fn(signal));
}
handleSignal('SIGTERM', handleExit);
handleSignal('SIGINT', handleExit);
handleSignal('SIGHUP', handleExit);

module.exports = { finishInit };