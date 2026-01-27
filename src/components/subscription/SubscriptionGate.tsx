import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, CreditCard, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { hasActiveSubscription, isSaasAdmin } = useAuth();
  const navigate = useNavigate();

  // SaaS admins or users with active subscription can access everything
  if (hasActiveSubscription() || isSaasAdmin()) {
    return <>{children}</>;
  }

  // Show restricted mode overlay
  return (
    <div className="relative">
      {/* Blurred content in background */}
      <div className="pointer-events-none select-none filter blur-sm opacity-50">
        {children}
      </div>

      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md lg:left-64"
      >
        <div className="max-w-md mx-4 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl p-8 shadow-xl border border-border"
          >
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-8 w-8 text-primary" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">
              Ative sua Assinatura
            </h2>
            <p className="text-muted-foreground mb-6">
              Para utilizar todas as funcionalidades do StackClinic, você precisa ativar um plano de assinatura.
            </p>

            <div className="space-y-3 text-left mb-6">
              <div className="flex items-center gap-3 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Agenda inteligente com IA</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Lembretes automáticos via WhatsApp</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Gestão financeira completa</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>CRM e marketing integrado</span>
              </div>
            </div>

            <Button 
              size="lg" 
              className="w-full gradient-primary text-primary-foreground"
              onClick={() => navigate('/pricing')}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Ver Planos e Assinar
            </Button>

            <p className="text-xs text-muted-foreground mt-4">
              Teste grátis por 14 dias. Cancele quando quiser.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
