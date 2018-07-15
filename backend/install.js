const fs = require('fs');
const sh = require('shelljs');

let db = require('./db');

const BRO_DEPS = [
  "libssl1.0-dev",
  "libgeoip-dev",
  "cmake", 
  "flex", 
  "bison", 
  "libpcap-dev", 
  "python-dev", 
  "python-pip", 
  "python-scapy", 
  "swig", 
  "zip", 
  "git", 
  "nmap", 
  "tcpdump", 
  "texinfo"
];

let isInstalling = false;

class InstallStep {
  constructor(disp, exec) {
    this.disp = disp;
    this.messages = [];
    this.processing = false;
    this.complete = false;
    this.error = null;
    this.exec = exec.bind(this);
  } 
  shex(cmd, err) {
    return new Promise((res, rej) => {
      this.processing = true;
      let child = sh.exec(cmd, { async: true , silent: true});
      child.stderr.on('data', data => {
        this.messages.push(data);
      });
      child.stdout.on('data', data => {
        this.messages.push(data);
      });
      child.on('exit', code => {
        this.processing = false;
        if (code === 0) {
          this.complete = true;
          res();
        } else {
          this.complete = false;
          this.error = err + ', exit code: ' + code;
          rej(this.error);
        }
      })
    })
  }
  getState() {
    return {
      disp: this.disp,
      messages: this.messages,
      processing: this.processing,
      complete: this.complete,
      error: this.error
    };
  }
}



const steps = [

  new InstallStep('Install bro dependencies', function() {
    let depsString = BRO_DEPS.reduce((a,x)=> a + ' ' + x, '');
    return this.shex(
      'sudo apt-get -y install ' + depsString, 
      'error installing packages'
    );
  }),

  new InstallStep('Install GeoLiteCity database', function() {
    const uri = 'http://geolite.maxmind.com/download/geoip/database/GeoLiteCity.dat.gz';
    let cmd = `cd bro && wget -nc -nv ${uri} && gunzip -f GeoLiteCity.dat.gz && ` + 
              'sudo mv GeoLiteCity.dat /usr/share/GeoIP/GeoIPCity.dat';
    return this.shex(cmd, 'error installing geoip database');
  }),

  new InstallStep('Install GeoLiteCityv6 database', function() {
    const uri = 'http://geolite.maxmind.com/download/geoip/database/GeoLiteCityv6-beta/GeoLiteCityv6.dat.gz';
    let cmd = `cd bro && wget -nc -nv ${uri} && gunzip -f GeoLiteCityv6.dat.gz && ` + 
              'sudo mv GeoLiteCityv6.dat /usr/share/GeoIP/GeoIPCityv6.dat';
    return this.shex(cmd, 'error installing geoip database');
  }),

  new InstallStep('Download bro', function() {
    const uri = 'https://www.bro.org/downloads/bro-2.5.1.tar.gz';
    return this.shex(
      'mkdir -p bro && cd bro && sudo wget -nc -nv ' + uri,
      'error downloading bro'
    );
  }),

  new InstallStep('Extract bro', function() {
    return this.shex(
      'cd bro && sudo tar --skip-old-files -xzf bro-2.5.1.tar.gz', 
      'error extracting bro');
  }),

  new InstallStep('Configure bro', function() {
    return this.shex(
      'sudo mkdir -p /opt/nsm/bro && cd bro/bro-2.5.1 &&' + 
        ' sudo ./configure --prefix=/opt/nsm/bro',
      'error configuring bro'
    );
  }),

  new InstallStep('Build bro', function() {
    return this.shex(
      'cd bro/bro-2.5.1 && sudo make',
      'error building bro'
    );
  }),

  new InstallStep('Install bro', function() {
    return this.shex(
      'cd bro/bro-2.5.1 && sudo make install',
      'error building bro'
    );
  }),

];

const promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
    promise
      .then(result => func()
      .then(Array.prototype.concat.bind(result))), Promise.resolve([]));

function install() {
  if (!isInstalling) {
    isInstalling = true;
    promiseSerial(steps.map(s => s.exec))
      .then(x => {isInstalling = false})
      .catch(e => {isInstalling = false; console.log(e); });
  }
}

function hasBro() {
  return new Promise((res, rej) => {
    fs.access('/opt/nsm/bro/bin/bro', fs.constants.F_OK, e => {
      if (e) {
        res(false);
      } else {
        let versionMatched = sh.exec('/opt/nsm/bro/bin/bro -version', { silent: true })
          .stdout
          .endsWith('version 2.5.1\n');
        res(versionMatched)
      }
    });
  });
}

async function hasAdmin(a,req,c) {
  let admin;
  try {
    admin = await db.getAdmin();
  } catch (e) {
    console.log('db.getAdmin() error', e);
  }
  return admin ? true : false;
}

async function createAdmin(user, pass) {
  let res;
  try {
    res = await db.createAdmin(user, pass);
    return null;
  } catch (e) {
    return 'DB error: ' + e.message;
  }
}

module.exports = {
  createAdmin: createAdmin,
  install: install,
  getState: () => {
    return { 
      hasBro: () => hasBro(),
      hasAdmin: () => hasAdmin(),
      steps: steps.map(s => s.getState()) 
    };
  }
}
