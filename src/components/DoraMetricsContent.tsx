import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { InfoCard } from '@backstage/core-components';
import { doraMetricsApiRef } from '../api/types';
import type { DoraEnvironment, DoraHistoryPoint, DoraMetrics, DoraMetricValue, DoraTargets, PrDetail } from '../api/types';
import { RatingBadge } from './ui/badge';
import { Card, CardLabel, CardFooter, CardDescription } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ExternalLink } from 'lucide-react';

const ANNOTATION_PROJECT_SLUG = 'github.com/project-slug';
/** Override the global environments list for this specific entity. JSON array of DoraEnvironment objects. */
const ANNOTATION_ENVIRONMENTS = 'dora-metrics/environments';
/** Override the global performance targets for this specific entity. JSON object matching DoraTargets. */
const ANNOTATION_TARGETS = 'dora-metrics/targets';

/** Parse entity annotation overrides. Returns undefined for malformed JSON to fail gracefully. */
function parseAnnotationJson<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

const DATE_RANGE_OPTIONS = [
  { value: '7',  label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const d = Math.floor(totalMinutes / (24 * 60));
  const h = Math.floor((totalMinutes % (24 * 60)) / 60);
  const m = totalMinutes % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

// Red → Orange → Yellow → Lime → Green gradient (slowest to fastest)
const DURATION_GRADIENT = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80'];

function durationColor(index: number, total: number): string {
  if (total <= 1) return DURATION_GRADIENT[0];
  const step = (DURATION_GRADIENT.length - 1) / (total - 1);
  return DURATION_GRADIENT[Math.round(index * step)];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Period-over-period delta — compares last bucket vs second-to-last bucket
function buildDeltaLabel(
  values: number[],
  unit: string,
  lowerIsBetter: boolean,
): { text: string; tooltip: string; good: boolean } | null {
  if (values.length < 2) return null;
  const curr = values[values.length - 1];
  const prev = values[values.length - 2];
  const diff = curr - prev;
  if (Math.abs(diff) < 0.001) return null;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? '↑' : '↓';

  const fmt = (v: number) =>
    unit === 'hours'    ? formatDuration(v) :
    unit === '%'        ? `${Math.round(v * 10) / 10}%` :
    unit === 'per week' ? `${Math.round(v * 10) / 10}/wk` :
                          `${Math.round(v * 10) / 10} ${unit}`;

  const direction = good ? 'improving' : 'worsening';
  return {
    text: `${arrow} ${fmt(Math.abs(diff))} ${direction}`,
    tooltip: `Latest period: ${fmt(curr)} · Previous period: ${fmt(prev)}\nEach period = one time bucket (~1/7th of your selected date range)`,
    good,
  };
}

// ─── Loading overlay ────────────────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Establishing routes…',
  'Syncing catalog…',
  'Loading plugins…',
  'Fetching PR data…',
  'Reading entity graph…',
];
const STAGES = ['FETCH', 'PARSE', 'SCORE', 'RENDER'] as const;
const FONT_IMPACT = '"Impact","Haettenschweiler","Franklin Gothic Heavy","Arial Black",sans-serif';
const FONT_MONO   = '"JetBrains Mono","Fira Code","Consolas",monospace';

function DoraLoadingOverlay() {
  const theme  = useTheme();
  const isDark = theme.palette.type === 'dark';

  const [activeStage, setActiveStage] = useState(0);
  const [msgKey,  setMsgKey]          = useState(0);
  const [msgIdx,  setMsgIdx]          = useState(0);

  useEffect(() => {
    const st = setInterval(() => setActiveStage(s => (s + 1) % STAGES.length), 800);
    return () => clearInterval(st);
  }, []);

  useEffect(() => {
    const mt = setInterval(() => { setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length); setMsgKey(k => k + 1); }, 2200);
    return () => clearInterval(mt);
  }, []);

  const textShadow = isDark
    ? '3px 3px 0 #C24E00, 6px 6px 0 #902800, 9px 9px 0 #5A1800, 12px 12px 0 rgba(0,0,0,0.55), 0 0 60px rgba(250,100,0,0.45)'
    : '3px 3px 0 #C24E00, 6px 6px 0 #902800, 9px 9px 0 rgba(80,20,0,0.28), 0 0 32px rgba(250,100,0,0.22)';

  const mutedColor    = isDark ? '#3f3f46' : '#a1a1aa';
  const subtitleColor = isDark ? '#52525b' : '#71717a';
  const borderColor   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  return (
    <>
      {/* Frosted glass backdrop — blurs whatever is behind */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, zIndex: 900,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: isDark ? 'rgba(6,6,9,0.65)' : 'rgba(253,252,251,0.70)',
      }} />

      {/* Centered card */}
      <div style={{
        position: 'fixed', zIndex: 901,
        top: '50%', left: '50%',
        transform: 'translateX(-50%) translateY(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '48px 56px 40px',
        borderRadius: 20,
        background: isDark ? 'rgba(9,9,12,0.82)' : 'rgba(255,255,255,0.88)',
        border: `1px solid ${borderColor}`,
        boxShadow: isDark
          ? '0 0 0 1px rgba(250,100,0,0.06), 0 32px 80px rgba(0,0,0,0.65)'
          : '0 32px 80px rgba(0,0,0,0.12)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        animation: 'dlsCardIn 0.35s cubic-bezier(0.34,1.2,0.64,1) both',
        overflow: 'visible',
      }}>

      {/* Breathing ambient glow — inside card */}
      <div aria-hidden style={{
        position: 'absolute', width: 500, height: 360,
        left: '50%', top: '50%',
        transform: 'translateX(-50%) translateY(-50%)',
        background: `radial-gradient(ellipse at center, ${isDark ? 'rgba(250,100,0,0.08)' : 'rgba(250,100,0,0.05)'} 0%, transparent 70%)`,
        animation: 'dlsBreath 3.2s ease-in-out infinite',
        pointerEvents: 'none', borderRadius: 20,
      }} />

        {/* DORA wordmark */}
        <div style={{ display: 'flex', lineHeight: 1, marginBottom: 6 }}>
          {['D','O','R','A'].map((letter, i) => (
            <span key={i} style={{
              fontFamily: FONT_IMPACT, fontWeight: 900, fontSize: 110,
              color: '#FA6400', letterSpacing: '0.04em', display: 'inline-block',
              transform: 'skewX(-6deg)', textShadow,
              WebkitTextStroke: '0.5px #C24E00',
              animation: `dlsLetterDrop 0.6s cubic-bezier(0.34,1.45,0.64,1) ${i * 0.1}s both`,
            }}>
              {letter}
            </span>
          ))}
        </div>

        {/* Subtitle */}
        <span style={{ fontFamily: 'Inter,system-ui,sans-serif', fontSize: 13, fontWeight: 400,
          letterSpacing: '0.06em', color: subtitleColor, marginBottom: 32,
          animation: 'dlsFadeUp 0.4s ease 0.55s both' }}>
          Metrics
        </span>

        {/* Pipeline stages */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20, animation: 'dlsFadeUp 0.4s ease 0.7s both' }}>
          {STAGES.map((stage, i) => {
            const isActive   = i === activeStage;
            const isComplete = i < activeStage;
            return (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 64 }}>
                  <div style={{ position: 'relative', width: 12, height: 12 }}>
                    {isActive && (
                      <div style={{ position: 'absolute', inset: -6, borderRadius: '50%',
                        border: '1.5px solid rgba(250,100,0,0.5)', animation: 'dlsPulse 1s ease-out infinite' }} />
                    )}
                    <div style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: (isActive || isComplete) ? '#FA6400' : (isDark ? '#27272a' : '#e4e4e7'),
                      border: `2px solid ${(isActive || isComplete) ? '#C24E00' : (isDark ? '#3f3f46' : '#d4d4d8')}`,
                      boxShadow: isActive ? '0 0 14px rgba(250,100,0,0.7)' : 'none',
                      transition: 'background 0.3s, box-shadow 0.3s',
                    }} />
                  </div>
                  <span style={{ fontFamily: 'Inter,system-ui,sans-serif', fontSize: 8, fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: isActive ? '#FA6400' : isComplete ? mutedColor : mutedColor,
                    transition: 'color 0.3s' }}>
                    {stage}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div style={{ width: 32, height: 2, marginBottom: 14, position: 'relative', overflow: 'hidden',
                    background: isDark ? '#27272a' : '#e4e4e7', borderRadius: 2 }}>
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 2, background: '#FA6400',
                      transformOrigin: 'left center',
                      transform: `scaleX(${i < activeStage ? 1 : isActive ? 0.5 : 0})`,
                      transition: 'transform 0.4s ease',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Status message */}
        <span key={msgKey} style={{ fontFamily: FONT_MONO, fontSize: 11,
          color: mutedColor, letterSpacing: '0.04em', animation: 'dlsFadeUp 0.3s ease both' }}>
          {LOADING_MESSAGES[msgIdx]}
        </span>

      </div>{/* end card */}

      <style>{`
        @keyframes dlsLetterDrop {
          from { opacity: 0; transform: skewX(-6deg) translateY(-32px) scale(1.1); }
          65%  { transform: skewX(-6deg) translateY(6px) scale(0.95); }
          to   { opacity: 1; transform: skewX(-6deg) translateY(0) scale(1); }
        }
        @keyframes dlsFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dlsBreath {
          0%, 100% { transform: translateX(-50%) translateY(-50%) scale(0.85); opacity: 0.6; }
          50%       { transform: translateX(-50%) translateY(-50%) scale(1.2);  opacity: 1; }
        }
        @keyframes dlsPulse {
          from { transform: scale(0.6); opacity: 0.9; }
          to   { transform: scale(2.2); opacity: 0; }
        }
        @keyframes dlsCardIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-46%); }
          to   { opacity: 1; transform: translateX(-50%) translateY(-50%); }
        }
      `}</style>
    </>
  );
}

// ─── Compact sparkline (with hover tooltip + date axis) ────────────────────

function CompactSparkline({
  values,
  weekLabels,
  color,
  type,
  formatValue,
  height = 36,
}: {
  values: number[];
  weekLabels: string[];
  color: string;
  type: 'bar' | 'line';
  formatValue: (v: number) => string;
  height?: number;
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const VW = 400; // viewBox units
  const mutedBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tooltipBg   = isDark ? '#1c1c20' : '#ffffff';
  const tooltipBdr  = isDark ? '#3f3f46' : '#e4e4e7';
  const tooltipText = isDark ? '#ededef' : '#111114';
  const font = 'Inter,system-ui,sans-serif';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    setHoverIdx(Math.max(0, Math.min(values.length - 1, Math.round(relX * (values.length - 1)))));
  };

  if (type === 'bar') {
    const max = Math.max(...values, 1);
    const gap = 4;
    const barW = (VW - gap * (values.length - 1)) / values.length;

    const hoverX = hoverIdx !== null
      ? hoverIdx * (barW + gap) + barW / 2
      : null;
    const tooltipX = hoverX !== null ? Math.min(hoverX - 34, VW - 72) : 0;

    return (
      <div>
        <svg viewBox={`0 0 ${VW} ${height}`} width="100%" style={{ display: 'block', overflow: 'visible' }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
          {values.map((v, i) => {
            const h = Math.max(2, (v / max) * (height - 4));
            return (
              <rect key={i} x={i * (barW + gap)} y={height - h} width={barW} height={h} rx={1.5}
                fill={color} opacity={i === hoverIdx ? 1 : 0.3 + (i / values.length) * 0.55} />
            );
          })}
          <line x1={0} y1={height - 0.5} x2={VW} y2={height - 0.5} stroke={mutedBorder} strokeWidth={1} />
          {hoverIdx !== null && hoverX !== null && (
            <>
              <rect x={tooltipX} y={2} width={72} height={22} rx={4} fill={tooltipBg} stroke={tooltipBdr} strokeWidth={1} />
              <text x={tooltipX + 36} y={17} textAnchor="middle" fill={tooltipText} fontSize={9} fontWeight={600} fontFamily={font}>
                {weekLabels[hoverIdx]}: {formatValue(values[hoverIdx])}
              </text>
            </>
          )}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 9, color: isDark ? '#3f3f46' : '#a1a1aa' }}>{weekLabels[0]}</span>
          <span style={{ fontSize: 9, color: isDark ? '#3f3f46' : '#a1a1aa' }}>{weekLabels[weekLabels.length - 1]}</span>
        </div>
      </div>
    );
  }

  if (values.length < 2) return null;
  const max = Math.max(...values, 0.01);
  const min = Math.min(...values);
  const range = max - min || max || 1;
  const pad = 3;
  const pts = values.map((v, i): [number, number] => [
    (i / (values.length - 1)) * (VW - pad * 2) + pad,
    (height - pad * 2) - ((v - min) / range) * (height - pad * 2 - 2) + pad,
  ]);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${pts[pts.length-1][0]},${height} L${pts[0][0]},${height} Z`;
  const hoverPt = hoverIdx !== null ? pts[hoverIdx] : null;
  const tooltipX2 = hoverPt ? Math.min(hoverPt[0] - 34, VW - 72) : 0;

  return (
    <div>
      <svg viewBox={`0 0 ${VW} ${height}`} width="100%" style={{ display: 'block', overflow: 'visible' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
        <path d={area} fill={color} opacity={0.07} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === hoverIdx ? 3.5 : i === pts.length - 1 ? 2.5 : 0} fill={color} />
        ))}
        <line x1={0} y1={height - 0.5} x2={VW} y2={height - 0.5} stroke={mutedBorder} strokeWidth={1} />
        {hoverPt && hoverIdx !== null && (
          <>
            <line x1={hoverPt[0]} y1={0} x2={hoverPt[0]} y2={height} stroke={color} strokeWidth={1} strokeDasharray="2 2" opacity={0.4} />
            <rect x={tooltipX2} y={2} width={72} height={22} rx={4} fill={tooltipBg} stroke={tooltipBdr} strokeWidth={1} />
            <text x={tooltipX2 + 36} y={17} textAnchor="middle" fill={tooltipText} fontSize={9} fontWeight={600} fontFamily={font}>
              {weekLabels[hoverIdx]}: {formatValue(values[hoverIdx])}
            </text>
          </>
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 9, color: isDark ? '#3f3f46' : '#a1a1aa' }}>{weekLabels[0]}</span>
        <span style={{ fontSize: 9, color: isDark ? '#3f3f46' : '#a1a1aa' }}>{weekLabels[weekLabels.length - 1]}</span>
      </div>
    </div>
  );
}

// ─── Detailed interactive chart ────────────────────────────────────────────

interface ChartTooltipState {
  x: number;
  y: number;
  primary: string;
  secondary?: string;
}

function DetailedChart({
  values,
  weekLabels,
  bucketMidMs,
  color,
  type,
  formatValue,
  prs,
  days,
  hoveredPrNumber,
  onPrHover,
}: {
  values: number[];
  weekLabels: string[];
  bucketMidMs: number[];
  color: string;
  type: 'bar' | 'line';
  formatValue: (v: number) => string;
  prs?: PrDetail[];
  days: number;
  hoveredPrNumber?: number | null;
  onPrHover?: (num: number | null) => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<ChartTooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const W = 800, H = 260;
  const PAD = { top: 16, right: 16, bottom: 36, left: 56 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  // Y scale: based on bucket values only so the trend line is clearly readable.
  // PR dots that fall outside this range are rendered clamped to chart area.
  const dataMax = Math.max(...values, 0.01);
  const dataMin = type === 'line' ? Math.min(...values, 0) : 0;
  const dataRange = dataMax - dataMin || dataMax || 1;
  const yScale = (v: number) => cH - ((v - dataMin) / dataRange) * cH;

  // Shared timestamp-based x-axis
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const rangeMs  = days * 24 * 60 * 60 * 1000;
  const xTime = (ms: number) => Math.max(0, Math.min(cW, ((ms - cutoffMs) / rangeMs) * cW));

  const xIdx = (i: number) => bucketMidMs.length === values.length
    ? xTime(bucketMidMs[i])
    : (values.length > 1 ? (i / (values.length - 1)) * cW : cW / 2);

  const pts: [number, number][] = values.map((v, i) => [PAD.left + xIdx(i), PAD.top + yScale(v)]);
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = pts.length > 1
    ? `${linePath} L${pts[pts.length-1][0]},${PAD.top+cH} L${pts[0][0]},${PAD.top+cH} Z`
    : '';

  const gap  = 6;
  const barW = values.length > 1 ? (cW - gap * (values.length - 1)) / values.length : cW;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => dataMin + t * dataRange);
  const gridColor  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const axisColor  = isDark ? '#3f3f46' : '#d4d4d8';
  const labelColor = isDark ? '#52525b' : '#a1a1aa';
  const font       = 'Inter,system-ui,sans-serif';
  const gradId     = `dg_${color.replace('#','')}`;

  // Find the nearest bucket index for a given timestamp
  const nearestBucket = (ms: number): number => {
    if (bucketMidMs.length === 0) return 0;
    let best = 0, bestDist = Infinity;
    bucketMidMs.forEach((mid, i) => {
      const d = Math.abs(ms - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left - PAD.left * (rect.width / W)) / (rect.width * cW / W);
    const idx  = Math.max(0, Math.min(values.length - 1, Math.round(relX * (values.length - 1))));
    setHoverIdx(idx);
    const cRect = containerRef.current?.getBoundingClientRect();
    const x = cRect ? e.clientX - cRect.left : 0;
    const y = cRect ? e.clientY - cRect.top  : 0;
    setTooltip({ x, y, primary: formatValue(values[idx]), secondary: weekLabels[idx] });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={() => { setHoverIdx(null); setTooltip(null); }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          {/* Clip PR dots to the chart area */}
          <clipPath id={`prClip_${gradId}`}>
            <rect x={PAD.left} y={PAD.top - 8} width={cW} height={cH + 16} />
          </clipPath>
        </defs>

        {/* Grid + Y-axis */}
        {yTicks.map((v, i) => {
          const y = PAD.top + yScale(v);
          return (
            <g key={i}>
              {i > 0 && <line x1={PAD.left} y1={y} x2={PAD.left+cW} y2={y} stroke={gridColor} strokeWidth={1} strokeDasharray="3 4" />}
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill={labelColor} fontSize={10} fontFamily={font}>
                {formatValue(v)}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} y1={PAD.top+cH} x2={PAD.left+cW} y2={PAD.top+cH} stroke={axisColor} strokeWidth={1} />

        {/* Chart body */}
        {type === 'bar' ? (
          values.map((v, i) => {
            const bH = Math.max(2, ((v - dataMin) / dataRange) * cH);
            const x  = PAD.left + i * (barW + gap);
            return (
              <rect key={i} x={x} y={PAD.top+cH-bH} width={barW} height={bH} rx={3}
                fill={color} opacity={i === hoverIdx ? 0.95 : 0.4 + (i / Math.max(values.length - 1, 1)) * 0.45} />
            );
          })
        ) : (
          <>
            {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
            <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y}
                r={i === hoverIdx ? 5.5 : 4}
                fill={isDark ? '#0f0f12' : '#ffffff'} stroke={color}
                strokeWidth={i === hoverIdx ? 2.5 : 1.5} />
            ))}
          </>
        )}

        {/* PR data-point dots — x at bucket midpoint, y at actual duration (clamped to chart) */}
        {prs && type === 'line' && (
          <g clipPath={`url(#prClip_${gradId})`}>
            {prs.map((pr, dotIdx) => {
              const mergedMs = new Date(pr.mergedAt).getTime();
              const bIdx = nearestBucket(mergedMs);
              // Small deterministic jitter within the bucket to avoid overlap
              const jitter = ((pr.number * 17 + dotIdx * 11) % 13 - 6) * 5;
              const px = PAD.left + xIdx(bIdx) + jitter;
              // Clamp y: PR may be faster or slower than bucket avg; always visible
              const rawPy = PAD.top + yScale(pr.durationHours);
              const py = Math.max(PAD.top + 4, Math.min(PAD.top + cH - 4, rawPy));
              const isHov = pr.number === hoveredPrNumber;

              // Thin connector from dot to the bucket trend point
              const trendPt = pts[bIdx];

              return (
                <g key={pr.number} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => {
                    e.stopPropagation();
                    const cRect = containerRef.current?.getBoundingClientRect();
                    const x = cRect ? e.clientX - cRect.left : 0;
                    const y = cRect ? e.clientY - cRect.top  : 0;
                    setTooltip({ x, y,
                      primary: `#${pr.number}: ${pr.title}`,
                      secondary: `${formatValue(pr.durationHours)} · ${new Date(pr.mergedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` });
                    onPrHover?.(pr.number);
                  }}
                  onMouseLeave={() => { setTooltip(null); onPrHover?.(null); }}>
                  {trendPt && (
                    <line x1={px} y1={py} x2={trendPt[0]} y2={trendPt[1]}
                      stroke={color} strokeWidth={isHov ? 1 : 0.5}
                      strokeDasharray="2 3" opacity={isHov ? 0.5 : 0.2} />
                  )}
                  <circle cx={px} cy={py} r={isHov ? 11 : 7} fill={color} opacity={isHov ? 0.2 : 0.1} />
                  <circle cx={px} cy={py} r={isHov ? 5.5 : 3.5}
                    fill={isHov ? color : (isDark ? '#1a1a20' : '#fff')}
                    stroke={color} strokeWidth={isHov ? 0 : 1.5}
                    opacity={isHov ? 1 : 0.8} />
                </g>
              );
            })}
          </g>
        )}

        {/* Hover crosshair */}
        {hoverIdx !== null && type === 'line' && pts[hoverIdx] && (
          <>
            <line x1={pts[hoverIdx][0]} y1={PAD.top} x2={pts[hoverIdx][0]} y2={PAD.top+cH}
              stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.3} />
            <line x1={PAD.left} y1={pts[hoverIdx][1]} x2={PAD.left+cW} y2={pts[hoverIdx][1]}
              stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.2} />
          </>
        )}

        {/* X-axis labels */}
        {weekLabels.map((lbl, i) => {
          const total = weekLabels.length;
          const step  = Math.max(1, Math.floor(total / 5));
          if (i !== 0 && i !== total - 1 && i % step !== 0) return null;
          const x = type === 'bar'
            ? PAD.left + i * (barW + gap) + barW / 2
            : PAD.left + xIdx(i);
          return (
            <text key={i} x={x} y={H - 8} textAnchor="middle" fill={labelColor} fontSize={10} fontFamily={font}>
              {lbl}
            </text>
          );
        })}
      </svg>

      {/* Absolute tooltip — positioned relative to the chart container */}
      {tooltip && (() => {
        const TW = 220;
        const cW2 = containerRef.current?.offsetWidth ?? 800;
        const nearRight = tooltip.x + TW + 12 > cW2;
        return (
          <div style={{
            position: 'absolute',
            left: nearRight ? tooltip.x - TW - 8 : tooltip.x + 8,
            top: tooltip.y - 36,
            zIndex: 9999, pointerEvents: 'none',
            background: isDark ? '#18181b' : '#ffffff',
            border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
            borderRadius: 7, padding: '7px 10px',
            boxShadow: isDark ? '0 6px 20px rgba(0,0,0,0.55)' : '0 6px 20px rgba(0,0,0,0.10)',
            width: TW,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#ededef' : '#111114',
              fontFamily: font, lineHeight: 1.4 }}>
              {tooltip.primary}
            </div>
            {tooltip.secondary && (
              <div style={{ fontSize: 11, color: isDark ? '#71717a' : '#a1a1aa', fontFamily: font, marginTop: 2 }}>
                {tooltip.secondary}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Detailed overlay ──────────────────────────────────────────────────────

interface ExpandedCardData {
  title: string;
  metric: DoraMetricValue;
  description: string;
  lowerIsBetter: boolean;
  sparklineValues: number[];
  sparklineType: 'bar' | 'line';
  sparklineColor: string;
  weekLabels: string[];
  bucketMidMs: number[];
  prs?: PrDetail[];
  /** Override the section header above the PR list (default: "All deployments"). */
  prListLabel?: string;
}

function DetailedOverlay({
  data,
  days,
  onClose,
}: {
  data: ExpandedCardData;
  days: number;
  onClose: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const [hoveredPrNumber, setHoveredPrNumber] = useState<number | null>(null);
  const prRowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Auto-scroll to the highlighted PR row when hover comes from the chart
  useEffect(() => {
    if (hoveredPrNumber !== null) {
      const el = prRowRefs.current.get(hoveredPrNumber);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [hoveredPrNumber]);

  const { title, metric, description, lowerIsBetter, sparklineValues, sparklineType, sparklineColor, weekLabels, bucketMidMs, prs, prListLabel } = data;
  const isDeployFreq  = sparklineType === 'bar';
  const displayValue  = metric.unit === 'hours' ? formatDuration(metric.value) : String(metric.value);
  const displayUnit   = metric.unit === 'hours' ? '' : metric.unit;
  const formatVal     = (v: number) => metric.unit === 'hours' ? formatDuration(v) : `${Math.round(v * 10) / 10}`;
  const borderColor   = isDark ? '#27272a' : '#e4e4e7';
  const mutedColor    = isDark ? '#52525b' : '#a1a1aa';
  const targetLabel   = lowerIsBetter
    ? `Target: < ${metric.unit === 'hours' ? formatDuration(metric.target) : metric.target} ${displayUnit}`
    : `Target: ≥ ${metric.target} ${displayUnit}`;

  // Group deployment PRs by date (for the date table)
  const prsByDate = isDeployFreq && prs ? prs.reduce((acc, pr) => {
    const date = new Date(pr.mergedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(pr);
    return acc;
  }, {} as Record<string, PrDetail[]>) : {};
  const sortedDates = Object.keys(prsByDate).sort(
    (a, b) => new Date(prsByDate[b][0].mergedAt).getTime() - new Date(prsByDate[a][0].mergedAt).getTime()
  );

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 499,
        background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(4px)',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translateX(-50%) translateY(-50%)',
        width: 'min(92vw, 960px)',
        maxHeight: 'calc(100vh - 80px)',
        zIndex: 500,
        background: isDark ? '#09090c' : '#fafafa',
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'detailExpandIn 0.2s cubic-bezier(0.34,1.2,0.64,1)',
        boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.7)' : '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
              {title} · {weekLabels[0]} – {weekLabels[weekLabels.length - 1]}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 52, fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {displayValue}
              </span>
              {displayUnit && (
                <span style={{ fontSize: 18, color: mutedColor, fontWeight: 500 }}>{displayUnit}</span>
              )}
              <RatingBadge rating={metric.rating} />
            </div>
            <div style={{ fontSize: 12, color: mutedColor, marginTop: 6 }}>
              {description} · <span style={{ fontStyle: 'italic' }}>{targetLabel}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            all: 'unset', cursor: 'pointer', width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            color: mutedColor, fontSize: 18, fontWeight: 300, transition: 'all 0.12s', flexShrink: 0,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; }}>
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Chart */}
          {weekLabels.length >= 2 ? (
            <DetailedChart
              values={sparklineValues} weekLabels={weekLabels}
              bucketMidMs={bucketMidMs}
              color={sparklineColor} type={sparklineType}
              formatValue={formatVal} prs={isDeployFreq ? undefined : prs} days={days}
              hoveredPrNumber={hoveredPrNumber} onPrHover={setHoveredPrNumber}
            />
          ) : (
            <div style={{ color: mutedColor, fontSize: 13, textAlign: 'center', padding: '48px 0' }}>
              Not enough data — select a wider date range.
            </div>
          )}

          {/* === Deployment Frequency: PRs grouped by date === */}
          {isDeployFreq && prs && prs.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: mutedColor, textTransform: 'uppercase',
                letterSpacing: '0.12em', marginBottom: 12,
                borderTop: `1px solid ${borderColor}`, paddingTop: 12 }}>
                {prListLabel ?? 'All deployments'} · {prs.length} PR{prs.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sortedDates.map(date => (
                  <div key={date}>
                    {/* Date header */}
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: sparklineColor,
                      marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>{date}</span>
                      <span style={{ color: mutedColor, fontWeight: 500 }}>· {prsByDate[date].length} PR{prsByDate[date].length > 1 ? 's' : ''}</span>
                    </div>
                    {/* PR rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12,
                      borderLeft: `2px solid ${sparklineColor}22` }}>
                      {prsByDate[date].map(pr => (
                        <div key={pr.number} style={{
                          display: 'flex', flexDirection: 'column', gap: 5,
                          padding: '7px 10px', borderRadius: 7,
                          background: isDark ? '#0d0d10' : '#f7f7f9',
                          border: `1px solid ${borderColor}`,
                          transition: 'background 0.12s',
                        }}>
                          {/* Row 1: number + title + lead time + link */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: mutedColor, flexShrink: 0, minWidth: 36 }}>
                              #{pr.number}
                            </span>
                            <span style={{ fontSize: 12, color: theme.palette.text.primary, flex: 1,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pr.title}>
                              {pr.title}
                            </span>
                            <span style={{ fontSize: 10, color: mutedColor, flexShrink: 0 }}>
                              {formatDuration(pr.durationHours)} lead
                            </span>
                            <a href={pr.url} target="_blank" rel="noopener noreferrer"
                              style={{ color: mutedColor, flexShrink: 0 }}>
                              <ExternalLink size={11} />
                            </a>
                          </div>
                          {/* Row 2: author badge */}
                          {pr.author && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {pr.authorAvatar ? (
                                <img src={pr.authorAvatar} alt={pr.author}
                                  style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                                    border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}` }} />
                              ) : (
                                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                                  background: isDark ? '#27272a' : '#e4e4e7',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 8, fontWeight: 700, color: mutedColor }}>
                                  {pr.author[0].toUpperCase()}
                                </div>
                              )}
                              <a href={`https://github.com/${pr.author}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 10, fontWeight: 500, color: mutedColor,
                                  textDecoration: 'none', letterSpacing: '0.01em' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FA6400'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = mutedColor; }}>
                                @{pr.author}
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === Lead Time / MTTR: duration-ranked PR list with hover linking === */}
          {!isDeployFreq && prs && prs.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: mutedColor, textTransform: 'uppercase',
                letterSpacing: '0.12em', marginBottom: 10,
                borderTop: `1px solid ${borderColor}`, paddingTop: 12 }}>
                {title.toLowerCase().includes('restore') ? 'Slowest Hotfix PRs' : 'Slowest PRs'}
                {' '}· hover a row to highlight on chart
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {prs.map((pr, i) => {
                  const col    = durationColor(i, prs.length);
                  const maxDur = prs[0].durationHours;
                  const barPct = maxDur > 0 ? (pr.durationHours / maxDur) * 100 : 0;
                  const isHov  = pr.number === hoveredPrNumber;
                  return (
                    <div key={pr.number}
                      ref={(el) => {
                        if (el) prRowRefs.current.set(pr.number, el);
                        else prRowRefs.current.delete(pr.number);
                      }}
                      onMouseEnter={() => setHoveredPrNumber(pr.number)}
                      onMouseLeave={() => setHoveredPrNumber(null)}
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        background: isHov
                          ? (isDark ? '#18181f' : '#f0f0ff')
                          : (isDark ? '#111114' : '#f4f4f6'),
                        border: `1px solid ${isHov ? `${sparklineColor}55` : borderColor}`,
                        display: 'flex', flexDirection: 'column', gap: 5,
                        transition: 'background 0.12s, border-color 0.12s',
                        cursor: 'default',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: col, flexShrink: 0 }}>#{pr.number}</span>
                        <span style={{ fontSize: 12, color: theme.palette.text.primary, flex: 1,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={pr.title}>
                          {pr.title}
                        </span>
                        <span style={{ fontSize: 10, color: mutedColor, flexShrink: 0 }}>
                          {new Date(pr.mergedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <a href={pr.url} target="_blank" rel="noopener noreferrer"
                          style={{ color: mutedColor, flexShrink: 0, transition: 'color 0.12s' }}>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AnimatedBar widthPct={barPct} color={col} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: col, minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
                          {formatDuration(pr.durationHours)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes detailExpandIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-46%); }
          to   { opacity: 1; transform: translateX(-50%) translateY(-50%); }
        }
      `}</style>
    </>
  );
}

// ─── Animated bar ──────────────────────────────────────────────────────────

function AnimatedBar({ widthPct, color }: { widthPct: number; color: string }) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';

  useEffect(() => {
    const timer = setTimeout(() => setWidth(widthPct), 80);
    return () => clearTimeout(timer);
  }, [widthPct]);

  return (
    <div
      ref={ref}
      style={{
        background: isDark ? '#1a1a1e' : '#f0f0f2',
        borderRadius: 4,
        height: 5,
        overflow: 'hidden',
        flex: 1,
        minWidth: 40,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 0 6px ${color}88`,
        }}
      />
    </div>
  );
}

// ─── Metric cards ──────────────────────────────────────────────────────────

function MetricCard({
  title,
  metric,
  description,
  lowerIsBetter = false,
  sparklineData,
  sparklineType = 'line',
  sparklineColor,
  weekLabels,
  onExpand,
  expandLabel,
}: {
  title: string;
  metric: DoraMetricValue;
  description: string;
  lowerIsBetter?: boolean;
  sparklineData?: number[];
  sparklineType?: 'bar' | 'line';
  sparklineColor?: string;
  weekLabels?: string[];
  onExpand?: () => void;
  /** Persistent label shown in the card footer (instead of the hover-only "expand ↗"). */
  expandLabel?: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const [hovered, setHovered] = useState(false);

  const displayValue = metric.unit === 'hours' ? formatDuration(metric.value) : metric.value;
  const displayUnit  = metric.unit === 'hours' ? '' : metric.unit;
  const targetValue  = metric.unit === 'hours' ? formatDuration(metric.target) : metric.target;
  const targetLabel  = lowerIsBetter
    ? `Target: < ${targetValue} ${displayUnit}`.trim()
    : `Target: ≥ ${targetValue} ${displayUnit}`.trim();

  const hasSparkline = sparklineData && sparklineData.length >= 2 && weekLabels && weekLabels.length >= 2;
  const delta = hasSparkline ? buildDeltaLabel(sparklineData!, metric.unit, lowerIsBetter) : null;
  const formatVal = (v: number) => metric.unit === 'hours' ? formatDuration(v) : `${Math.round(v * 10) / 10}`;

  return (
    <Card
      style={{ cursor: onExpand ? 'pointer' : undefined }}
      onClick={onExpand}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <CardLabel>{title}</CardLabel>
        {onExpand && (
          <span style={{
            fontSize: 9, fontWeight: 600, color: isDark ? '#3f3f46' : '#d4d4d8',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
            letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0,
          }}>
            expand ↗
          </span>
        )}
      </div>
      {/* Right-aligned column: delta trend + direction hint stacked */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {delta && (
          <span title={delta.tooltip} style={{
            fontSize: 10, fontWeight: 600, cursor: 'help',
            color: delta.good ? '#4ade80' : '#f87171',
            background: delta.good
              ? (isDark ? 'rgba(74,222,128,0.08)' : 'rgba(74,222,128,0.12)')
              : (isDark ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.12)'),
            padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
          }}>
            {delta.text}
          </span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: isDark ? '#3f3f46' : '#d4d4d8',
          whiteSpace: 'nowrap',
        }}>
          {lowerIsBetter ? '↓ lower = better' : '↑ higher = better'}
        </span>
      </div>
      {/* Value row: big number + unit */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: isDark ? '#f4f4f5' : '#111114', lineHeight: 1 }}>
          {displayValue}
        </span>
        {displayUnit && (
          <span style={{ fontSize: 14, color: isDark ? '#71717a' : '#71717a', fontWeight: 500 }}>
            {displayUnit}
          </span>
        )}
      </div>
      <RatingBadge rating={metric.rating} />
      {hasSparkline && (
        <div style={{ marginTop: 2 }}>
          <CompactSparkline
            values={sparklineData!}
            weekLabels={weekLabels!}
            color={sparklineColor ?? '#FA6400'}
            type={sparklineType}
            formatValue={formatVal}
          />
        </div>
      )}
      <CardDescription>{description}</CardDescription>
      <CardFooter>
        <span style={{ fontWeight: 600, color: isDark ? '#a1a1aa' : '#52525b' }}>
          {targetLabel}
        </span>
        {expandLabel && onExpand && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: '#FA6400',
            letterSpacing: '0.04em',
            marginLeft: 'auto',
          }}>
            {expandLabel}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

function NaCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardLabel>{title}</CardLabel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: '#52525b', lineHeight: 1 }}>N/A</span>
      </div>
      <CardDescription muted>{description}</CardDescription>
    </Card>
  );
}

// ─── Filter label ──────────────────────────────────────────────────────────

function FilterLabel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: theme.palette.text.primary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function DoraMetricsContent() {
  const { entity } = useEntity();
  const doraApi = useApi(doraMetricsApiRef);
  const muiTheme = useTheme();
  const textPrimary = muiTheme.palette.text.primary;
  const textSecondary = muiTheme.palette.text.secondary;

  const projectSlug = entity.metadata.annotations?.[ANNOTATION_PROJECT_SLUG] ?? '';
  const annotations = entity.metadata.annotations ?? {};

  // Per-repo overrides from catalog-info.yaml annotations
  const annotationEnvs = parseAnnotationJson<DoraEnvironment[]>(annotations[ANNOTATION_ENVIRONMENTS]);
  const annotationTargets = parseAnnotationJson<Partial<DoraTargets>>(annotations[ANNOTATION_TARGETS]);

  const environments: DoraEnvironment[] = annotationEnvs ?? doraApi.getEnvironments();
  const defaultEnv = environments[0];
  const defaultDays = doraApi.getDefaultDays();

  // Use environment name as the selection key (branch can be a multi-value pattern)
  const [selectedEnvName, setSelectedEnvName] = useState<string>(defaultEnv?.name ?? '');
  const [selectedDays, setSelectedDays] = useState<string>(String(defaultDays));

  const selectedEnv = environments.find(e => e.name === selectedEnvName) ?? defaultEnv;
  const days = parseInt(selectedDays, 10);

  const [metrics, setMetrics] = useState<DoraMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [history, setHistory] = useState<DoraHistoryPoint[] | null>(null);
  const [expanded, setExpanded] = useState<ExpandedCardData | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectSlug) {
      setError(new Error(`Entity is missing the "${ANNOTATION_PROJECT_SLUG}" annotation.`));
      setLoading(false);
      return () => { cancelled = true; };
    }
    if (!selectedEnv) {
      setError(new Error('No environments configured for DORA metrics.'));
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError(null);
    setHistory(null);

    doraApi
      .getMetrics(projectSlug, selectedEnv, days, annotationTargets ?? undefined)
      .then(data => {
        if (!cancelled) { setMetrics(data); setLoading(false); }
      })
      .catch((err: Error) => {
        if (!cancelled) { setError(err); setLoading(false); }
      });

    doraApi
      .getHistory(projectSlug, selectedEnv, days)
      .then(data => { if (!cancelled) setHistory(data); })
      .catch(() => { /* history is optional — fail silently */ });

    return () => { cancelled = true; };
    // selectedEnv?.name is intentional — avoids re-render loops from object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doraApi, projectSlug, selectedEnv?.name, days, annotationTargets]);

  if (loading) return <DoraLoadingOverlay />;

  if (error) {
    return (
      <InfoCard title="DORA Metrics">
        <div style={{ padding: 24, color: '#f87171' }}>
          <span style={{ fontWeight: 600 }}>Error: </span>{error.message}
        </div>
      </InfoCard>
    );
  }

  if (!metrics) return null;

  return (
    <InfoCard title=" ">
      <div style={{ padding: '4px 0', position: 'relative' }}>
        {/* Detailed overlay */}
        {expanded && (
          <DetailedOverlay data={expanded} days={days} onClose={() => setExpanded(null)} />
        )}

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: textPrimary, letterSpacing: '-0.02em' }}>DORA Metrics</div>
          {selectedEnv && (
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 5 }}>
              Showing metrics for{' '}
              <strong style={{ color: textPrimary }}>{selectedEnv.name}</strong>
              {' '}—{' '}
              <span style={{ fontFamily: 'monospace' }}>{selectedEnv.branch}</span>
            </div>
          )}
        </div>

        {/* Filters row — left aligned */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          {environments.length > 1 && (
            <div>
              <FilterLabel>Environment</FilterLabel>
              <Select value={selectedEnvName} onValueChange={setSelectedEnvName}>
                <SelectTrigger><SelectValue placeholder="Select environment" /></SelectTrigger>
                <SelectContent>
                  {environments.map(env => (
                    <SelectItem key={env.name} value={env.name}>
                      {env.name} ({env.branch})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <FilterLabel>Date Range</FilterLabel>
            <Select value={selectedDays} onValueChange={setSelectedDays}>
              <SelectTrigger><SelectValue placeholder="Select date range" /></SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metric cards — sparklines inline, click to expand */}
        {(() => {
          const wkLabels   = history?.map(h => h.weekLabel) ?? [];
          const deployData = history?.map(h => h.deploymentCount) ?? [];
          const leadData   = history?.map(h => h.leadTimeHours) ?? [];
          const cfrData    = history?.map(h => h.changeFailureRate ?? 0) ?? [];
          const mttrData   = history?.map(h => h.mttrHours ?? 0) ?? [];

          const bmMs = history?.map(h => h.bucketMidMs) ?? [];

          const mkExpand = (
            title: string, metric: DoraMetricValue, description: string,
            lowerIsBetter: boolean, sparklineValues: number[],
            sparklineType: 'bar' | 'line', sparklineColor: string, prs?: PrDetail[],
            prListLabel?: string,
          ) => () => setExpanded({
            title, metric, description, lowerIsBetter,
            sparklineValues, sparklineType, sparklineColor,
            weekLabels: wkLabels, bucketMidMs: bmMs, prs, prListLabel,
          });

          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <MetricCard
                title="Deployment Frequency"
                metric={metrics.deploymentFrequency}
                description="How often code is deployed to this branch"
                sparklineData={deployData}
                sparklineType="bar"
                sparklineColor="#FA6400"
                weekLabels={wkLabels}
                onExpand={mkExpand('Deployment Frequency', metrics.deploymentFrequency,
                  'How often code is deployed to this branch', false, deployData, 'bar', '#FA6400',
                  metrics.deploymentFrequency.slowestPRs)}
              />
              <MetricCard
                title="Lead Time for Changes"
                metric={metrics.leadTime}
                description="Average time from PR creation to merge"
                lowerIsBetter
                sparklineData={leadData}
                sparklineType="line"
                sparklineColor="#818cf8"
                weekLabels={wkLabels}
                onExpand={mkExpand('Lead Time for Changes', metrics.leadTime,
                  'Average time from PR creation to merge', true, leadData, 'line', '#818cf8', metrics.leadTime.slowestPRs)}
              />
              {metrics.changeFailureRate !== null ? (
                <MetricCard
                  title="Change Failure Rate"
                  metric={metrics.changeFailureRate}
                  description="% of all merged PRs that were hotfixes"
                  lowerIsBetter
                  sparklineData={cfrData}
                  sparklineType="line"
                  sparklineColor="#f87171"
                  weekLabels={wkLabels}
                  onExpand={mkExpand('Change Failure Rate', metrics.changeFailureRate,
                    '% of all merged PRs that were hotfixes', true, cfrData, 'line', '#f87171')}
                />
              ) : (
                <NaCard title="Change Failure Rate" description="Only tracked on production branches" />
              )}
              {metrics.mttr !== null ? (
                <MetricCard
                  title="Mean Time to Restore"
                  metric={metrics.mttr}
                  description="Avg time from hotfix PR open to merge"
                  lowerIsBetter
                  sparklineData={mttrData}
                  sparklineType="line"
                  sparklineColor="#fbbf24"
                  weekLabels={wkLabels}
                  onExpand={mkExpand('Mean Time to Restore', metrics.mttr,
                    'Avg time from hotfix PR open to merge', true, mttrData, 'line', '#fbbf24', metrics.mttr.slowestPRs)}
                />
              ) : (
                <NaCard title="Mean Time to Restore" description="Only tracked on production branches" />
              )}
              {metrics.numberOfHotfixes !== null ? (
                <MetricCard
                  title="Hotfixes to Production"
                  metric={metrics.numberOfHotfixes}
                  description={`PRs labeled '${selectedEnv?.label ?? 'hotfix'}' merged to production`}
                  lowerIsBetter
                  expandLabel={metrics.numberOfHotfixes.value > 0 ? `View ${metrics.numberOfHotfixes.value} PR${metrics.numberOfHotfixes.value !== 1 ? 's' : ''} →` : undefined}
                  onExpand={mkExpand(
                    'Hotfixes to Production',
                    metrics.numberOfHotfixes,
                    `PRs labeled '${selectedEnv?.label ?? 'hotfix'}' merged to production`,
                    true,
                    [],
                    'bar',
                    '#f87171',
                    metrics.numberOfHotfixes.slowestPRs,
                    'All hotfixes',
                  )}
                />
              ) : (
                <NaCard title="Hotfixes to Production" description="Only tracked on production branches" />
              )}
            </div>
          );
        })()}

      </div>
    </InfoCard>
  );
}
