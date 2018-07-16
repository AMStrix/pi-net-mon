let session = require('express-session');
let NedbSessionStore = require('nedb-session-store')(session);

const sessionStore = new NedbSessionStore({ filename: './data/session.db' });

module.exports = session({
  secret: 'asdfasdfawwe232rew@#$@#sasg44',
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    httpOnly: true,
    maxAge: 365 * 24* 60 * 60 * 1000,
    secure: false
  },
  store: sessionStore
});

//sessionStore.clear();
