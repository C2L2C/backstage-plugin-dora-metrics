import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { useTheme } from '@material-ui/core/styles';
import { Check, ChevronDown } from 'lucide-react';

export function Select({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      {children}
    </SelectPrimitive.Root>
  );
}

export function SelectTrigger({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  return (
    <SelectPrimitive.Trigger
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        borderRadius: 6,
        border: `1px solid ${isDark ? '#3f3f46' : '#d4d4d8'}`,
        background: isDark ? '#18181b' : '#ffffff',
        color: isDark ? '#f4f4f5' : '#111114',
        padding: '6px 12px',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        minWidth: 180,
        outline: 'none',
      }}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown size={14} style={{ color: isDark ? '#a1a1aa' : '#71717a', flexShrink: 0 }} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <SelectPrimitive.Value placeholder={placeholder} />;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        style={{
          background: isDark ? '#18181b' : '#ffffff',
          border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
          borderRadius: 8,
          padding: 4,
          boxShadow: isDark
            ? '0 4px 24px rgba(0,0,0,0.4)'
            : '0 4px 24px rgba(0,0,0,0.12)',
          zIndex: 9999,
          minWidth: 180,
        }}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  return (
    <SelectPrimitive.Item
      value={value}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 28px 6px 8px',
        borderRadius: 4,
        fontSize: 14,
        color: isDark ? '#f4f4f5' : '#111114',
        cursor: 'pointer',
        outline: 'none',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = isDark ? '#27272a' : '#f4f4f6';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <SelectPrimitive.ItemIndicator
        style={{ position: 'absolute', right: 8, display: 'flex' }}
      >
        <Check size={12} style={{ color: isDark ? '#a1a1aa' : '#71717a' }} />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
