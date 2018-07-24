const express = require('express');

const session = require('./session');
const gql = require('./gql');

const l = require('./log');
const spoof = require('./spoof');

const app = express();

app.use(session);
app.use((req, res, next) => {
  if (req.session.x) { req.session.x = req.session.x + 1; }
  else { req.session.x = 1; }
  next();
})
app.use('/graphql', gql);
app.listen(4000, () => l.info('GraphQL started on localhost:4000/graphql'));


async function handleExit(signal) {
  l.info(`*** pi-net-mon shutting down (${signal}) ***`);
  spoof.onExit().then(() => process.exit());
}

function handleSignal(signal, fn) {
  process.on(signal, () => fn(signal));
}
handleSignal('SIGTERM', handleExit);
handleSignal('SIGINT', handleExit);
handleSignal('SIGHUP', handleExit);
