import { cn } from '../utils';

interface SectionTitleProps {
  icon?: React.ReactNode;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SectionTitle({
  icon,
  title,
  size = 'md',
  className,
}: SectionTitleProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 font-semibold text-foreground',
        sizeClasses[size],
        className,
      )}
    >
      {icon && <span className="text-primary">{icon}</span>}
      {title}
    </div>
  );
}

export type { SectionTitleProps };
