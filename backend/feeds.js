
// isc.sans.edu api feeds downloader

const https = require('https');
const _ = require('lodash');
const moment = require('moment');
const { promisify } = require('util');
const fs = require('fs');

const l = require('./log');

const fmt = d => moment(d).format('YYYY-MM-DD');
const API = 'https://isc.sans.edu/api/';
const FEEDS = `${API}threatfeeds/?json`;
const FEED = (id, f, t) => `${API}threatlist/${id}/${fmt(f)}/${fmt(t)}/?json`;
const FEEDS_FILE = 'data/feeds.feeds.tree';
const THREATS_FILE = 'data/feeds.threats.tree';

const state = {
  feeds: {},
  ips: {},
  domains: {}
};

const get = (url) => new Promise((res, rej) => {
  l.info(`feeds.get ${url}`)
  let data = '';
  https.get(url, resp => {
    if (resp.statusCode != 200) {
      const err = `feeds.get failed, status ${resp.statusCode} ${url}`;
      console.log(err);
      rej(err);
    } else {    
      resp.on('data', chunk => data += chunk);
      resp.on('end', (x) => {
        // console.log('END |'+data+'|');
        let json;
        try {
          json = JSON.parse(data);
        } catch (e) {
          const err = `feeds.get could not parse ${url}, data: "${data}"`;
          l.error(err);
          rej(err);
        }
        res(json);
      });
    }
  }).on('error', e => {
    const err = `feeds.get ${url} error ${e}`;
    l.error(err);
    rej(err);
  });
});

const fetchFeedList = () => {
  return get(FEEDS);
};

const fetchThreatFeed = id => {
  let f = new Date(Date.now() - 1000*60*60*24 * 365);
  const t = new Date();
  const lastPull = state.feeds[id].lastPull;
  state.feeds[id].error = null;
  if (lastPull) {
    f = new Date(lastPull);
    l.info(`feeds.fetchThreatFeed updating ${id} from ${f} to now`);
  } else {
    l.info(`feeds.fetchThreatFeed initial pull of ${id} from ${f} to now`);
  }
  const url = FEED(id, f, t);
  return get(url)
    .then(x => {
      state.feeds[id].lastPull = t.getTime();
      saveFeedsState(); // persist
      return x;
    })
    .catch(e => {
      state.feeds[id].error = `${moment(t).format('M/D k:mm')} ${e}`;
      return null;
    });
}

const processFeedList = (feeds) => {
  l.info(`feeds.processFeedList processing ${feeds.length} feeds`);
  feeds.forEach(f => {
    if (state.feeds[f.type]) {
      state.feeds[f.type] = _.defaults({
        description: f.description,
        frequency: f.frequency,
        datatype: f.datatype,
        lastupdate: f.lastupdate
      }, state.feeds[f.type]);
    } else {
      state.feeds[f.type] = _.defaults(f, { id: f.type, active: false });
    }
  });
};

const saveFeedsState = () => {
  const write = promisify(fs.writeFile);
  return write(FEEDS_FILE, JSON.stringify(state.feeds));
};

const loadFeedsState = () => {
  const read = promisify(fs.readFile);
  return read(FEEDS_FILE)
    .catch(e => {
      l.error(`feeds.loadFeedsState unable to load ${FEEDS_FILE} error: ${e}`);
      return Promise.reject();
    })
    .then(data => {
      const json = JSON.parse(data);
      l.info(`feeds.loadFeedsState loaded ${_.values(json).length} feeds from ${FEEDS_FILE}`);
      state.feeds = json;
    });
};

const saveThreatsState = () => {
  const write = promisify(fs.writeFile);
  return write(THREATS_FILE, JSON.stringify({ ips: state.ips, domains: state.domains }));
};

const loadThreatsState = () => {
  const read = promisify(fs.readFile);
  return read(THREATS_FILE)
    .catch(e => {
      l.error(`feeds.loadThreatsState unable to load ${THREATS_FILE} error: ${e}`);
      return Promise.reject();
    })
    .then(data => {
      const json = JSON.parse(data);
      const countStr = `${_.values(json.ips).length}/${_.values(json.domains).length}`;
      l.info(`feeds.loadThreatsState loaded ips/domains ${countStr} from ${THREATS_FILE}`);
      state.ips = json.ips;
      state.domains = json.domains;
    });
};

const mergeThreatFeed = (feed, source) => {
  let domainCount = 0, ipv4Count = 0;
  feed.forEach(x => {
    if (x.domain) {
      domainCount++;
      state.domains[x.domain] = _.defaults(x, { feed: source });
    } 
    if (x.ipv4) {
      ipv4Count++;
      state.ips[x.ipv4] = _.defaults(x, { feed: source });
    }
  });
  state.feeds[source].rulesCount = 
    _.values(state.domains).filter(x => x.feed == source).length +
    _.values(state.ips).filter(x => x.feed == source).length;
  l.info(`feeds.mergeThreatFeed merged ${domainCount} domains, ${ipv4Count} ips`);
  return Promise.resolve();
}

const addThreatsById = id => {
  // load feeds assoc with id
  state.feeds[id].processing = true;
  return fetchThreatFeed(id)
    .then(x => x || [])
    .then(feed => mergeThreatFeed(feed, id))
    .then(() => state.feeds[id].processing = false)
    .then(saveThreatsState);
}

const removeThreatsById = id => {
  // remove ips/domains assoc with id
  state.feeds[id].processing = true;
  const ips = _.values(state.ips).filter(x => x.feed == id).map(x => x.ipv4);
  const domains = _.values(state.domains).filter(x => x.feed == id).map(x => x.domain);
  ips.forEach(ip => (delete state.ips[ip]));
  domains.forEach(dom => (delete state.domains[dom]));
  state.feeds[id].rulesCount = 0;
  state.feeds[id].processing = false;
  l.info(`feeds.deactivateFeed(${id}) removed ${ips.length} ips, ${domains.length} domains`);
  return saveThreatsState();
}

const refreshThreatsLoop = async () => {
  const toUpdate = _.values(state.feeds).reduce((a, f) => {
    f.active && (Date.now() - f.lastPull > 1000*60*60 * 24) && a.push(f);
    return a;
  }, []);
  if (toUpdate.length > 0) {
    // update
    l.info(`feeds.refreshThreatsLoop refreshing ${toUpdate.length} feeds`);
    for (let i = 0; i < toUpdate.length; i++) {
      await addThreatsById(toUpdate[i].id);
    }
  }
}

const refreshFeedsLoop = () => {
  fetchFeedList()
    .then(processFeedList)
    .then(saveFeedsState);
}

let refreshThreatsLoopInterval = null;
let refreshFeedsLoopInterval = null;

module.exports = {};

module.exports.getIps = () => state.ips;
module.exports.getDomains = () => state.domains;

module.exports.init = () => {
  return loadFeedsState()
    .catch(() => 
      fetchFeedList()
        .then(processFeedList)
        .then(saveFeedsState)
        .catch(e => l.error(e))
    )
    .then(loadThreatsState)
    .catch(x => x)
    .then(() => {
      _.values(state.feeds).forEach(f => f.processing = false);
      refreshThreatsLoopInterval = setInterval(refreshThreatsLoop, 1000 * 60);
      refreshFeedsLoopInterval = setInterval(refreshFeedsLoop, 1000 * 60 * 60);
    });
};

module.exports.getFeeds = () => Promise.resolve(_.cloneDeep(_.values(state.feeds)));

module.exports.activateFeed = (id, active) => {
  const feed = state.feeds[id];
  feed.active = active;
  saveFeedsState();
  active ? addThreatsById(id) : removeThreatsById(id);
  return [feed];
};

module.exports.forceFeedUpdate = (id) => {
  const feed = state.feeds[id];
  const exists = feed ? true : false;
  const active = feed && feed.active || false;
  if (!exists) return { error: `feed ${id} does not exist` };
  if (exists && !active) return { error: `cannot update inactive feed ${id}` };
  addThreatsById(id);
}


