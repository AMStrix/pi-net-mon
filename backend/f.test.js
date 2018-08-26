const f = require('./f');

describe('memoizePeriodic', () => {

  const RealDate = Date;

  function mockDate (isoDate) {
    global.Date = class extends RealDate {
      constructor () {
        return new RealDate(isoDate);
      }
    };
    global.Date.now = () => (new Date()).getTime();
  }

  afterEach(() => {
    global.Date = RealDate;
  });

  it('mockDate should be mocked', () => {
    mockDate('2017-11-25T12:34:56.000Z');
    expect((new Date()).toISOString()).toEqual('2017-11-25T12:34:56.000Z');
    mockDate('2017-11-25T12:34:57.000Z');
    expect((new Date()).toISOString()).toEqual('2017-11-25T12:34:57.000Z');
    mockDate(1000);
    expect(Date.now()).toBe(1000);
  });

  it('should cache results, no args', () => {
    const fn = jest.fn().mockReturnValue(123);
    const memed = f.memoizePeriodic(fn);
    expect(memed()).toEqual(123);
    expect(memed()).toEqual(123);
    expect(fn.mock.calls.length).toBe(1);
  });

  it('should cache results, with one arg', () => {
    const fn = jest.fn()
      .mockReturnValueOnce(123)
      .mockReturnValueOnce(234);
    const m = f.memoizePeriodic(fn);
    expect(m('a')).toEqual(123);
    expect(m('b')).toEqual(234);
    expect(m('a')).toEqual(123);
    expect(m('b')).toEqual(234);
    expect(fn.mock.calls.length).toBe(2);
  });

  it('should call fn again after default stale', () => {
    const fn = jest.fn()
      .mockReturnValueOnce(123)
      .mockReturnValueOnce(234)
      .mockReturnValueOnce(345);
    const m = f.memoizePeriodic(fn);
    mockDate(Date.now()); // freeze time
    expect(m()).toEqual(123);
    expect(m()).toEqual(123);
    expect(fn.mock.calls.length).toBe(1);
    mockDate(Date.now() + m.stale);
    expect(m()).toEqual(234);
    expect(m()).toEqual(234);
    expect(fn.mock.calls.length).toBe(2);
    mockDate(Date.now() + m.stale);
    expect(m()).toEqual(345);
    expect(m()).toEqual(345);
    expect(fn.mock.calls.length).toBe(3);
  });

  it('should call fn again after stale', () => {
    const fn = jest.fn()
      .mockReturnValueOnce(123)
      .mockReturnValueOnce(234)
      .mockReturnValueOnce(345);
    const m = f.memoizePeriodic(fn, 1000);
    mockDate(Date.now()); // freeze time
    expect(m()).toEqual(123);
    expect(m()).toEqual(123);
    expect(fn.mock.calls.length).toBe(1);
    mockDate(Date.now() + 1001);
    expect(m()).toEqual(234);
    expect(m()).toEqual(234);
    expect(fn.mock.calls.length).toBe(2);
    mockDate(Date.now() + 1001);
    expect(m()).toEqual(345);
    expect(m()).toEqual(345);
    expect(fn.mock.calls.length).toBe(3);
  });

  it('should call fn again after clear()', () => {
    const fn = jest.fn()
      .mockReturnValueOnce(123)
      .mockReturnValueOnce(234)
      .mockReturnValueOnce(345);
    const m = f.memoizePeriodic(fn);
    expect(m()).toEqual(123);
    expect(fn.mock.calls.length).toBe(1);
    m.clear();
    expect(m()).toEqual(234);
    expect(fn.mock.calls.length).toBe(2);
    m.clear();
    expect(m()).toEqual(345);
    expect(fn.mock.calls.length).toBe(3);
  });
});

describe('ymdh', () => {
  it('should return array of UTC year, month, day, hour for date', () => {
    const date = new Date('2017-11-25T12:34:56.000Z');
    const arr = [2017, 10, 25, 12]; // months 0 indexed
    expect(f.ymdh(date)).toEqual(arr);
  });
});







