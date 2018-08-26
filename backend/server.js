const express = require('express');

const session = require('./session');
const gql = require('./gql');

const l = require('./log');
const broalyzer = require('./broalyzer');
const spoof = require('./spoof');
const feeds = require('./feeds');
const db = require('./db');

const app = express();

db.init()
  .then(spoof.init)
  .then(broalyzer.init)
  .then(feeds.init)
  .then(init);

function init() {
  app.use(session);
  app.use((req, res, next) => {
    if (req.session.x) { req.session.x = req.session.x + 1; }
    else { req.session.x = 1; }
    next();
  });
  app.use(express.static('../frontend/dist'));
  app.use('/graphql', gql);
  app.listen(4000, () => l.info('GraphQL started on localhost:4000/graphql'));
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
