### pi-net-mon
A lightweight network monitoring solution for RaspberryPI3.

![pi-net-mon demo](https://amstrix.github.io/images/pi-net-mon_demo_1.gif)

### Features
- show devices on network
- nickname devices on network
- keep host activity stats
- search visited hosts
- research links for host to popular threat analysis sites
- check IPs & hosts against threat feeds from [isc.sans.edu](https://isc.sans.edu)

### Requirements  
**hardware**: RaspberryPI 3 (connected via ethernet, heatsink recommended)  
**os**: [2018-06-27-raspbian-stretch-lite](http://downloads.raspberrypi.org/raspbian_lite/images/raspbian_lite-2018-06-29/)  
**node**: NodeJS v8.11.3

#### Please note, this is a work in progress. Do not expose this device to WAN or use on a critical LAN, it uses ARP spoofing to gather information.

### Setup steps
1. Install raspbian. [instructions](https://www.raspberrypi.org/documentation/installation/installing-images/)
1. Place an empty file named "ssh" without extension in the root SD card directory. (enables ssh)  
On macs, for example: `touch /Volumes/boot/ssh`
1. Connect the pi via ethernet cable to your lan. Plug in power.
1. Find the IP of the pi (often done via the router @ http://192.168.0.1)
1. `ssh pi@<raspberry pi IP>` password 'raspberry'
1. `sudo raspi-config`  
localization options > change timezone > (select your timezone)  
(optional, requires reboot) network options > Hostname > enter 'pi-net-mon' as hostname
1. if you changed the hostname, then `ssh pi@pi-net-mon.local` password 'raspberry'
1. Install NodeJS v8 & everything else (entire process will take several hours):
```
wget https://nodejs.org/dist/v8.11.3/node-v8.11.3-linux-armv7l.tar.xz
tar xf node-v8.11.3-linux-armv7l.tar.xz
cd node-v8.11.3-linux-armv7l/
sudo cp -R * /usr/local/
node -v (should output v8.11.3)
sudo apt install git
cd ~
git clone https://github.com/AMStrix/pi-net-mon.git
cd pi-net-mon/frontend/
npm install (this will take time)
npm run build (this, also, will take time)
cd ../backend/
npm install (more time)
sudo node install.service.js 
```
 
 After a few moments, visit pi-net-mon.local or the IP of the device in a browser. Create a user, and allow the bro installation to proceed. The bro installation takes about 2.5 hours to compile.

