import { AlertTriangle, Cake, Clock, TrendingUp, CheckCircle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { SmartFeedItem } from '@/services/api';

interface SmartFeedProps {
  items: SmartFeedItem[];
  isLoading?: boolean;
}

const iconMap = {
  alert: AlertTriangle,
  birthday: Cake,
  reminder: Clock,
  opportunity: TrendingUp,
  success: CheckCircle,
};

const styleMap = {
  alert: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    icon: 'text-destructive',
  },
  birthday: {
    bg: 'bg-secondary/10',
    border: 'border-secondary/20',
    icon: 'text-secondary',
  },
  reminder: {
    bg: 'bg-info/10',
    border: 'border-info/20',
    icon: 'text-info',
  },
  opportunity: {
    bg: 'bg-success/10',
    border: 'border-success/20',
    icon: 'text-success',
  },
  success: {
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    icon: 'text-primary',
  },
};

export function SmartFeed({ items, isLoading }: SmartFeedProps) {
  const navigate = useNavigate();

  const handleAction = (action: string | undefined) => {
    if (!action) return;
    
    switch (action) {
      case 'confirm_appointments':
        navigate('/app/agenda?status=pending&date=tomorrow');
        break;
      case 'view_inadimplentes':
        navigate('/app/financeiro?filter=inadimplentes');
        break;
      case 'send_birthday_msg':
        // Future: open birthday message modal
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <CheckCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Nenhuma tarefa pendente</p>
        <p className="text-sm text-muted-foreground/70 mt-1">Tudo em dia por aqui!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = iconMap[item.type] || AlertTriangle;
        const styles = styleMap[item.type] || styleMap.reminder;

        return (
          <div
            key={item.id}
            className={cn(
              'group flex items-start gap-4 rounded-xl border p-4 transition-all duration-200 cursor-pointer hover:shadow-md',
              styles.bg,
              styles.border
            )}
          >
            <div className={cn('rounded-lg p-2', styles.bg)}>
              <Icon className={cn('h-5 w-5', styles.icon)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                </div>
                {item.priority === 'high' && (
                  <span className="shrink-0 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    Urgente
                  </span>
                )}
              </div>
              {item.action && (
                <button 
                  onClick={() => handleAction(item.action)}
                  className="mt-2 inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {item.action === 'confirm_appointments' ? 'Confirmar agendamentos' : 
                   item.action === 'view_inadimplentes' ? 'Ver inadimplentes' :
                   item.action === 'send_birthday_msg' ? 'Enviar mensagem' :
                   item.action}
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
