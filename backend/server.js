let express = require('express');

let session = require('./session');
let gql = require('./gql');
let spoof = require('./spoof');

var app = express();

app.use(session);
app.use((req, res, next) => {
  if (req.session.x) { req.session.x = req.session.x + 1; }
  else { req.session.x = 1; }
  next();
})
app.use('/graphql', gql);
app.listen(4000, () => console.log('GraphQL started on localhost:4000/graphql'));

process.on('SIGINT', () => spoof.cleanup().then(process.exit(0)));
