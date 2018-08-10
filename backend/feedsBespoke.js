const https = require('https');
const _ = require('lodash');
const moment = require('moment');
const { promisify } = require('util');
const fs = require('fs');

const abuseCh = {
  name: 'ABUSE.ch',
  url: 'https://abuse.ch',
  description: `abuse.ch is operated by a random swiss guy fighting malware for non-profit,
running a couple of projects helping internet service providers and network operators protecting
their infrastructure from malware. IT-Security researchers, vendors and law enforcement agencies rely
on data from abuse.ch, trying to make the internet a safer place.`,
  feeds: [
    {
      name: 'ZeuS domain blocklist (BadDomains)',
      infoUrl: 'https://zeustracker.abuse.ch/blocklist.php',
      url: 'https://zeustracker.abuse.ch/blocklist.php?download=baddomains',
      type: 'domain'
    },
    {
      name: 'ZeuS IP blocklist (BadIPs)',
      infoUrl: 'https://zeustracker.abuse.ch/blocklist.php',
      url: 'https://zeustracker.abuse.ch/blocklist.php?download=badips',
      type: 'ip'
    },
    {
      name: 'Feodo Domain Blocklist',
      infoUrl: 'https://feodotracker.abuse.ch/blocklist/',
      url: 'https://feodotracker.abuse.ch/blocklist/?download=domainblocklist',
      type: 'domain'
    },
    {
      name: 'Feodo IP Blocklist',
      infoUrl: 'https://feodotracker.abuse.ch/blocklist/',
      url: 'https://feodotracker.abuse.ch/blocklist/?download=ipblocklist',
      type: 'ip'
    },
    {
      name: 'Feodo BadIP Blocklist (BadIPs)',
      infoUrl: 'https://feodotracker.abuse.ch/blocklist/',
      url: 'https://feodotracker.abuse.ch/blocklist/?download=badips',
      type: 'ip'
    },
    {
      name: 'Ransomware Botnet C&C Domains',
      infoUrl: 'https://ransomwaretracker.abuse.ch/blocklist/',
      url: 'https://ransomwaretracker.abuse.ch/downloads/RW_DOMBL.txt',
      type: 'domain'
    },
    {
      name: 'Ransomware Botnet C&C IPs',
      infoUrl: 'https://ransomwaretracker.abuse.ch/blocklist/',
      url: 'https://ransomwaretracker.abuse.ch/downloads/RW_IPBL.txt',
      type: 'ip'
    }
  ]
};

const openPhish = {
  name: 'OpenPhish',
  url: 'https://openphish.com',
  description: 'Timely. Accurate. Relevant Threat Intelligence.'
  feeds: [
    {
      name: 'Phishing Feed (Community)',
      infoUrl: 'https://openphish.com/phishing_feeds.html',
      url: 'https://openphish.com/feed.txt',
      type: 'url'
    }
  ]
}
