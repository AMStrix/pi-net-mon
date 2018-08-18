const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

const f = require('./f');

const workingPath = path.resolve(__dirname);
const serverPath = path.resolve(__dirname, 'server.js');
const systemPath = path.resolve('/etc/systemd/system', 'pi-net-mon.service');

const service = `
[Unit]
Description=pi-net-mon
After=network.target

[Service]
WorkingDirectory=${workingPath}
ExecStart=/usr/local/bin/node ${serverPath}
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;

console.log('1. Created service definition\n', service);

console.log(`2. Writing definition to [${systemPath}]`);

try {
  fs.writeFileSync(systemPath, service);
} catch (e) {
  switch(e.code) {
    case 'EACCES': 
      console.log('! ERROR, could not write service file, please run with "sudo node install.service"');
      break;
    default:
      console.log('! ERROR, could not write service file: \n', e);
  }
  return;
}

const cli = (cmd, args) => new Promise((res, rej) => {
  let out = '';
  const child = childProcess.spawn(cmd, args);
  child.stdout.on('data', d => out+=d);
  child.stderr.on('data', d => out+=d);
  child.on('close', code => {
    code === 0 && res(out) || rej({ code: code, out: out});
  });
  child.on('error', e => {
    rej({ out: out, error: e });
  });
});

cli('sudo', ['systemctl', 'enable', 'pi-net-mon.service'])
  .then(x => console.log('3. Enabled service'))
  .then(cli('sudo', ['systemctl', 'start', 'pi-net-mon.service']))
  .then(x => console.log('4. Started service'))
  .catch(x => console.log('! ERROR, failed to enable/start service: ', x.out, x.error))

// const enable = childProcess.spawnSync('sudo', ['systemctl', 'enable', 'pi-net-mon.service'], { shell: true });
// if (enable.error) {
//   console.log('! ERROR, could not enable service: \n', enable.error.toString());
//   console.log('! stdout: \n', enable.stdout.toString(), enable.stderr.toString());
//   return;
// }
// if (!enable.error && enable.stdout || enable.stderr) {
//   console.log('3. Enable service: \n', enable.stdout.toString(), enable.stderr.toString());
// }
