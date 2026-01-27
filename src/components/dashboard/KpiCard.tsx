import { ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

export function KpiCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  variant = 'default',
}: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = change === 0;

  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground',
    success: 'bg-gradient-to-br from-success to-success/80 text-success-foreground',
    warning: 'bg-gradient-to-br from-warning to-warning/80 text-warning-foreground',
  };

  const iconBgStyles = {
    default: 'bg-primary/10 text-primary',
    primary: 'bg-primary-foreground/20 text-primary-foreground',
    success: 'bg-success-foreground/20 text-success-foreground',
    warning: 'bg-warning-foreground/20 text-warning-foreground',
  };

  return (
    <div className={cn('kpi-card', variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn(
            'text-sm font-medium',
            variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
          )}>
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className={cn(
              'mt-1 text-sm',
              variant === 'default' ? 'text-muted-foreground' : 'opacity-70'
            )}>
              {subtitle}
            </p>
          )}
          {change !== undefined && (
            <div className="mt-3 flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
                  variant === 'default'
                    ? isPositive
                      ? 'bg-success/10 text-success'
                      : isNegative
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    : 'bg-white/20'
                )}
              >
                {isPositive && <ArrowUp className="h-3 w-3" />}
                {isNegative && <ArrowDown className="h-3 w-3" />}
                {isNeutral && <Minus className="h-3 w-3" />}
                {Math.abs(change)}%
              </span>
              {changeLabel && (
                <span className={cn(
                  'text-xs',
                  variant === 'default' ? 'text-muted-foreground' : 'opacity-70'
                )}>
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={cn(
          'rounded-xl p-3',
          iconBgStyles[variant]
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}
