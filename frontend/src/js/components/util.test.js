const util = require('./util');

require('babel-polyfill');

describe('deviceHostsToActivity24h', () => {
  const RealDate = Date;
  function mockDate (isoDate) {
    global.Date = class extends RealDate {
      constructor (x) {
        super();
        if (x) {
          return new RealDate(x);
        }
        return new RealDate(isoDate);
      }
    };
    global.Date.now = () => (new Date()).getTime();
  }
  afterEach(() => {
    global.Date = RealDate;
  });

  it('should return time, value data grouped by hour', () => {
    mockDate((new Date(2018, 6, 27, 17)).toISOString());
    const input = JSON.stringify({
      y2018: {
        m6: {
          d26: {
            h16: { hostOUTSIDE_com: 9 },
            h17: { hostOUTSIDE_com: 9},
            h18: { hostA_com: 1, hostB_com: 1, hostC_com: 1, hostD_com: 1 },
            h23: { hostW_com: 10, hostX_com: 10, hostY_com: 10, hostZ_com: 10 }
          },
          d27: {
            h0: { hostA_com: 1, hostB_com: 1, hostC_com: 1, hostD_com: 1 },
            h16: { hostA_com: 1, hostB_com: 1, hostC_com: 1, hostD_com: 1, hostZ_com: 10 },
            h17: { hostW_com: 10, hostX_com: 10, hostY_com: 10, hostZ_com: 10 },
            h18: { hostOUTSIDE_com: 9 }
          }
        }
      }
    }); 
    const emptyHour = h => ({ ts: h, sum: 0, otherSum: 0, h: { hostA_com: 0, hostW_com: 0, hostX_com: 0, hostY_com: 0, hostZ_com: 0 } });
    const out = {
      totalOtherSum: 9,
      topHosts: [
        {"h": "hostZ_com", "v": 30},
        {"h": "hostW_com", "v": 20},
        {"h": "hostX_com", "v": 20},
        {"h": "hostY_com", "v": 20},
        {"h": "hostA_com", "v": 3}
      ],
      data: [
        { ts: '6pm', sum: 4, otherSum: 3, h: { hostA_com: 1, hostW_com: 0, hostX_com: 0, hostY_com: 0, hostZ_com: 0 } },
        emptyHour('7pm'), emptyHour('8pm'), emptyHour('9pm'), emptyHour('10pm'),
        { ts: '11pm', sum: 40, otherSum: 0, h: { hostA_com: 0, hostW_com: 10, hostX_com: 10, hostY_com: 10, hostZ_com: 10 } },
        { ts: '12am', sum: 4, otherSum: 3, h: { hostA_com: 1, hostW_com: 0, hostX_com: 0, hostY_com: 0, hostZ_com: 0  } },
        emptyHour('1am'),emptyHour('2am'),emptyHour('3am'),emptyHour('4am'),emptyHour('5am'),emptyHour('6am'),
        emptyHour('7am'),emptyHour('8am'),emptyHour('9am'),emptyHour('10am'),emptyHour('11am'),emptyHour('12pm'),
        emptyHour('1pm'),emptyHour('2pm'),emptyHour('3pm'),
        { ts: '4pm', sum: 14, otherSum: 3, h: { hostA_com: 1, hostW_com: 0, hostX_com: 0, hostY_com: 0, hostZ_com: 10 } }, 
        { ts: '5pm', sum: 40, otherSum: 0, h: { hostA_com: 0, hostW_com: 10, hostX_com: 10, hostY_com: 10, hostZ_com: 10 } }
      ]
    }
    expect(util.deviceHostsToActivity24h(input)).toEqual(out);
  });

});