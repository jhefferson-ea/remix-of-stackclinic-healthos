import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function SubscriptionBanner() {
  const { user, hasActiveSubscription, isSaasAdmin } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Don't show for SaaS admins or if dismissed
  if (isSaasAdmin() || dismissed) return null;

  // Don't show if has active subscription
  if (hasActiveSubscription()) return null;

  const isPending = user?.subscription_status === 'pending';
  const isSuspended = user?.subscription_status === 'suspended';

  return (
    <div className={`px-4 py-3 flex items-center justify-between gap-4 ${
      isSuspended ? 'bg-destructive/10 border-b border-destructive/20' : 'bg-warning/10 border-b border-warning/20'
    }`}>
      <div className="flex items-center gap-3">
        {isSuspended ? (
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        ) : (
          <Clock className="h-5 w-5 text-warning shrink-0" />
        )}
        <p className={`text-sm font-medium ${isSuspended ? 'text-destructive' : 'text-warning-foreground'}`}>
          {isSuspended 
            ? 'Sua assinatura foi suspensa. Regularize para continuar usando o sistema.'
            : isPending 
              ? 'Ative sua assinatura para desbloquear todas as funcionalidades.'
              : 'Seu período de teste expirou. Assine para continuar.'
          }
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          variant={isSuspended ? 'destructive' : 'default'}
          onClick={() => navigate('/pricing')}
        >
          {isSuspended ? 'Regularizar' : 'Assinar Agora'}
        </Button>
        <button 
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
