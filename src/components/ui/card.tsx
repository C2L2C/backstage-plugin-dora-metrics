import React, { useState } from 'react';
import { useTheme } from '@material-ui/core/styles';

export function Card({
  children, style, onClick, onMouseEnter, onMouseLeave,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => { setHovered(true); onMouseEnter?.(); }}
      onMouseLeave={() => { setHovered(false); onMouseLeave?.(); }}
      onClick={onClick}
      style={{
        background: isDark ? '#0f0f12' : '#ffffff',
        border: `1px solid ${hovered
          ? (isDark ? '#3f3f46' : '#c4c4c8')
          : (isDark ? '#27272a' : '#e4e4e7')}`,
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        flex: '1 1 200px',
        minWidth: 180,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered
          ? (isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.08)')
          : 'none',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      color: theme.palette.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
    }}>
      {children}
    </div>
  );
}

export function CardValue({ value, unit }: { value: number | string; unit: string }) {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 36, fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 14, color: theme.palette.text.secondary, fontWeight: 500 }}>{unit}</span>
    </div>
  );
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  return (
    <div style={{
      fontSize: 12,
      color: theme.palette.text.secondary,
      borderTop: `1px solid ${isDark ? '#27272a' : '#e4e4e7'}`,
      paddingTop: 10,
      marginTop: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      {children}
    </div>
  );
}

export function CardDescription({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  return (
    <div style={{ fontSize: 12, color: muted ? (isDark ? '#3f3f46' : '#a1a1aa') : theme.palette.text.secondary }}>
      {children}
    </div>
  );
}
