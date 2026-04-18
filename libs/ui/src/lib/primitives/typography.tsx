import * as React from 'react';
import { cn } from '../utils';

type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'mono'
  | 'code'
  | 'label'
  | 'overline';

type TypographyWeight =
  | 'normal'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'extrabold';

type TypographyColor =
  | 'default'
  | 'muted'
  | 'accent'
  | 'danger'
  | 'success';

interface TypographyProps {
  variant: TypographyVariant;
  as?: React.ElementType;
  weight?: TypographyWeight;
  color?: TypographyColor;
  truncate?: boolean;
  className?: string;
  children: React.ReactNode;
  /** For label variant — associates with an input */
  htmlFor?: string;
}

const DEFAULT_ELEMENT: Record<TypographyVariant, React.ElementType> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  body: 'p',
  'body-sm': 'p',
  caption: 'span',
  mono: 'span',
  code: 'code',
  label: 'label',
  overline: 'span',
};

const VARIANT_CLASSES: Record<TypographyVariant, string> = {
  h1: 'text-2xl font-bold',
  h2: 'text-xl font-bold',
  h3: 'text-lg font-semibold',
  h4: 'text-base font-semibold',
  h5: 'text-sm font-semibold',
  h6: 'text-xs font-semibold',
  body: 'text-sm',
  'body-sm': 'text-xs',
  caption: 'text-xs text-muted-foreground',
  mono: 'text-xs font-mono tabular-nums',
  code: 'font-mono text-xs bg-muted px-1.5 py-0.5 rounded',
  label: 'text-sm font-medium',
  overline:
    'text-[11px] font-bold uppercase tracking-widest text-muted-foreground',
};

const WEIGHT_CLASSES: Record<TypographyWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
};

const COLOR_CLASSES: Record<TypographyColor, string> = {
  default: '',
  muted: 'text-muted-foreground',
  accent: 'text-primary',
  danger: 'text-red-500',
  success: 'text-emerald-500',
};

export function Typography({
  variant,
  as,
  weight,
  color = 'default',
  truncate,
  className,
  children,
  htmlFor,
  ...props
}: TypographyProps & React.HTMLAttributes<HTMLElement>) {
  const Component = as || DEFAULT_ELEMENT[variant];

  return (
    <Component
      className={cn(
        VARIANT_CLASSES[variant],
        weight && WEIGHT_CLASSES[weight],
        COLOR_CLASSES[color],
        truncate && 'truncate',
        className,
      )}
      {...(variant === 'label' && htmlFor ? { htmlFor } : {})}
      {...props}
    >
      {children}
    </Component>
  );
}

export type { TypographyProps, TypographyVariant, TypographyWeight, TypographyColor };
