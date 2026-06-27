import { niceHourTicks, niceCountTicks } from '../api/chartUtils';

// ---------------------------------------------------------------------------
// niceHourTicks
// ---------------------------------------------------------------------------

describe('niceHourTicks', () => {
  it('returns a fallback range when max is 0', () => {
    const ticks = niceHourTicks(0);
    expect(ticks[0]).toBe(0);
    expect(ticks.length).toBeGreaterThan(1);
  });

  it('always starts at 0', () => {
    expect(niceHourTicks(3)[0]).toBe(0);
    expect(niceHourTicks(25)[0]).toBe(0);
    expect(niceHourTicks(100)[0]).toBe(0);
  });

  it('last tick is >= maxHours', () => {
    for (const max of [1, 3.5, 10, 24, 48, 100, 168]) {
      const ticks = niceHourTicks(max);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it('produces at most 7 ticks', () => {
    for (const max of [0.5, 2, 8, 24, 72, 168]) {
      expect(niceHourTicks(max).length).toBeLessThanOrEqual(7);
    }
  });

  it('all ticks are evenly spaced (constant step)', () => {
    for (const max of [3, 10, 50, 120]) {
      const ticks = niceHourTicks(max);
      if (ticks.length < 2) continue;
      const step = ticks[1] - ticks[0];
      for (let i = 2; i < ticks.length; i++) {
        expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 6);
      }
    }
  });

  it('picks 1h intervals for ~6h max', () => {
    const ticks = niceHourTicks(6);
    const step = ticks[1] - ticks[0];
    expect(step).toBe(1);
  });

  it('picks 4h intervals for ~15h max', () => {
    const ticks = niceHourTicks(15);
    const step = ticks[1] - ticks[0];
    expect(step).toBe(4);
  });

  it('picks 12h intervals for ~3-day max', () => {
    // ceil(72/12)=6 satisfies <=6 before 24h step is reached
    const ticks = niceHourTicks(72);
    const step = ticks[1] - ticks[0];
    expect(step).toBe(12);
  });

  it('picks 24h intervals for ~5-day max', () => {
    // ceil(120/24)=5 satisfies <=6
    const ticks = niceHourTicks(120);
    const step = ticks[1] - ticks[0];
    expect(step).toBe(24);
  });
});

// ---------------------------------------------------------------------------
// niceCountTicks
// ---------------------------------------------------------------------------

describe('niceCountTicks', () => {
  it('returns a fallback range when max is 0', () => {
    const ticks = niceCountTicks(0);
    expect(ticks[0]).toBe(0);
    expect(ticks.length).toBeGreaterThan(1);
  });

  it('always starts at 0', () => {
    expect(niceCountTicks(1)[0]).toBe(0);
    expect(niceCountTicks(10)[0]).toBe(0);
    expect(niceCountTicks(100)[0]).toBe(0);
  });

  it('last tick is >= maxCount', () => {
    for (const max of [1, 3, 7, 12, 50, 100]) {
      const ticks = niceCountTicks(max);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });

  it('produces at most 6 ticks', () => {
    for (const max of [1, 5, 10, 25, 100]) {
      expect(niceCountTicks(max).length).toBeLessThanOrEqual(6);
    }
  });

  it('all ticks are integers', () => {
    for (const max of [3, 7, 15, 50]) {
      niceCountTicks(max).forEach(t => expect(Number.isInteger(t)).toBe(true));
    }
  });

  it('step is 1 for small counts', () => {
    const ticks = niceCountTicks(4);
    expect(ticks[1] - ticks[0]).toBe(1);
  });

  it('step is at least 1 even for max=1', () => {
    const ticks = niceCountTicks(1);
    expect(ticks[1] - ticks[0]).toBeGreaterThanOrEqual(1);
  });

  it('step scales up for large counts', () => {
    const ticks = niceCountTicks(100);
    const step = ticks[1] - ticks[0];
    expect(step).toBeGreaterThan(1);
  });
});
