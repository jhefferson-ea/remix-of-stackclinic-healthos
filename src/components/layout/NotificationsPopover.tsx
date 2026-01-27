import { useState, useEffect } from 'react';
import { Bell, AlertCircle, Cake, Clock, TrendingUp, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api, type SmartFeedItem } from '@/services/api';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  alert: AlertCircle,
  birthday: Cake,
  reminder: Clock,
  opportunity: TrendingUp,
  success: CheckCircle,
};

const styleMap: Record<string, { bg: string; border: string; icon: string }> = {
  alert: { bg: 'bg-destructive/10', border: 'border-destructive/20', icon: 'text-destructive' },
  birthday: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', icon: 'text-pink-500' },
  reminder: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-500' },
  opportunity: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-500' },
  success: { bg: 'bg-primary/10', border: 'border-primary/20', icon: 'text-primary' },
};

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<SmartFeedItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    const res = await api.getSmartFeed();
    if (res.success && res.data) {
      setNotifications(res.data);
    }
    setIsLoading(false);
  };

  // Refresh when popover opens
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const unreadCount = notifications.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Notificações</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {unreadCount} {unreadCount === 1 ? 'item' : 'itens'}
              </span>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma notificação pendente
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notification) => {
                const Icon = iconMap[notification.type] || Bell;
                const styles = styleMap[notification.type] || styleMap.reminder;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50',
                      styles.bg,
                      styles.border
                    )}
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        styles.bg
                      )}
                    >
                      <Icon className={cn('h-5 w-5', styles.icon)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-foreground line-clamp-1">
                          {notification.title}
                        </p>
                        {notification.priority === 'high' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-medium flex-shrink-0">
                            Urgente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="border-t border-border p-3">
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
              Ver todas as notificações
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
