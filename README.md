
Setup steps on RaspberryPI 3 B + 2018-06-27-raspbian-stretch-lite

pi@pi-net-mon:~ $ cat /etc/os-release 
PRETTY_NAME="Raspbian GNU/Linux 9 (stretch)"
NAME="Raspbian GNU/Linux"
VERSION_ID="9"
VERSION="9 (stretch)"
...


NODEJS v8 Installation (apt-get is v4)

pi@pi-net-mon:~ $ uname -m
armv7l

pi@pi-net-mon:~ $ wget https://nodejs.org/dist/v8.11.3/node-v8.11.3-linux-armv7l.tar.xz

pi@pi-net-mon:~ $ tar xf node-v8.11.3-linux-armv7l.tar.xz

pi@pi-net-mon:~ $ cd node-v8.11.3-linux-armv7l/

pi@pi-net-mon:~/node-v8.11.3-linux-armv7l $ sudo cp -R * /usr/local/
pi@pi-net-mon:~/node-v8.11.3-linux-armv7l $ node -v
v8.11.3
pi@pi-net-mon:~/node-v8.11.3-linux-armv7l $ npm -v
5.6.0

