import React from 'react';
import type { DoraRating } from '../../api/types';

const RATING_STYLES: Record<DoraRating, { background: string; color: string; border: string }> = {
  elite: { background: '#14532d', color: '#86efac', border: '#166534' },
  high:  { background: '#1e3a5f', color: '#93c5fd', border: '#1d4ed8' },
  medium:{ background: '#451a03', color: '#fdba74', border: '#92400e' },
  low:   { background: '#450a0a', color: '#fca5a5', border: '#991b1b' },
};

export function RatingBadge({ rating }: { rating: DoraRating }) {
  const s = RATING_STYLES[rating];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 9999,
        background: s.background,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}
    >
      {rating}
    </span>
  );
}
