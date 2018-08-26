const _ = require('lodash');
const broalyzer = require('./broalyzer');

describe('updateTree', () => {
  const updateTree = broalyzer.updateTree;
  it('produces history tree from input', () => {
    const tree = {};
    const mac = 'MA:CA:DR:ES:SS:00',
      ip = '192.168.0.123',
      host = 'test.host.com',
      date = new Date('2018-11-25T12:34:57.000Z'),
      source = 'ssl',
      uid = 'FaKeUid4zIher3';
    updateTree(tree, mac, ip, host, date, source, uid);
    const expected = { "y2018": { "m10": { "d25": { "h12": {
      "host": {
        "test.host.com": {
          "hits": 1,
          "device": {
            "MA:CA:DR:ES:SS:00": {
              "uids": [
                "FaKeUid4zIher3"
              ],
              "hits": 1,
              "source": {
                "ssl": {
                  "hits": 1
                }}}}}},
      "device": {
        "MA:CA:DR:ES:SS:00": {
          "hits": 1,
          "host": {
            "test.host.com": {
              "uids": [
                "FaKeUid4zIher3"
              ],
              "hits": 1,
              "source": {
                "ssl": {
                  "hits": 1
                }}}}}}
    }}}}};
    expect(tree).toEqual(expected);
    // should increment
    const nextUid = 'n3wF4keID';
    updateTree(tree, mac, ip, host, date, source, nextUid);
    const incremented = _.cloneDeep(expected);
    incremented.y2018.m10.d25.h12.host[host].hits = 2;
    incremented.y2018.m10.d25.h12.host[host].device[mac].hits = 2;
    incremented.y2018.m10.d25.h12.host[host].device[mac].source[source].hits = 2;
    incremented.y2018.m10.d25.h12.host[host].device[mac].uids.push(nextUid);
    incremented.y2018.m10.d25.h12.device[mac].hits = 2;
    incremented.y2018.m10.d25.h12.device[mac].host[host].hits = 2;
    incremented.y2018.m10.d25.h12.device[mac].host[host].source[source].hits = 2;
    incremented.y2018.m10.d25.h12.device[mac].host[host].uids.push(nextUid);
    expect(tree).toEqual(incremented);
  });

});