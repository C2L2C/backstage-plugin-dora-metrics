/**
 * Generate clean hour-interval Y-axis ticks for time-based DORA charts.
 * Picks the smallest interval from a fixed set that keeps tick count ≤ 6.
 */
export function niceHourTicks(maxHours: number): number[] {
  if (maxHours <= 0) return [0, 4, 8, 12, 16];
  const steps = [0.25, 0.5, 1, 2, 4, 6, 8, 12, 24, 48, 72, 96, 168];
  const step = steps.find(s => Math.ceil(maxHours / s) <= 6) ?? 168;
  const top = Math.ceil(maxHours / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 0.001; v += step) ticks.push(v);
  return ticks;
}

/**
 * Generate integer Y-axis ticks for count-based DORA charts.
 * Picks a step size that keeps tick count ≤ 6, minimum step of 1.
 */
export function niceCountTicks(maxCount: number): number[] {
  if (maxCount <= 0) return [0, 1, 2, 3, 4, 5];
  const step = Math.max(1, Math.ceil(maxCount / 5));
  const top = Math.ceil(maxCount / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 0.001; v += step) ticks.push(v);
  return ticks;
}
