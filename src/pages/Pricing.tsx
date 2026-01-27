import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Loader2, ArrowLeft, Sparkles, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { api, SubscriptionPlan } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export default function Pricing() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const { user, refreshSubscriptionStatus, hasActiveSubscription } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    // If already has active subscription, redirect to app or onboarding
    if (hasActiveSubscription() && user) {
      if (!user.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/app');
      }
    }
  }, [hasActiveSubscription, user, navigate]);

  async function loadPlans() {
    const res = await api.getSubscriptionPlans();
    if (res.success && res.data) {
      setPlans(res.data);
    }
    setLoading(false);
  }

  async function handleSubscribe(planId: string) {
    if (!user) {
      navigate('/auth');
      return;
    }

    setSubscribing(planId);

    try {
      const res = await api.subscribe(planId);
      
      if (res.success) {
        toast({
          title: 'Assinatura Ativada! 🎉',
          description: 'Bem-vindo ao StackClinic! Vamos configurar sua clínica.',
        });
        
        await refreshSubscriptionStatus();
        
        // Redirect to onboarding
        navigate('/onboarding');
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Não foi possível processar a assinatura',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro de conexão. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubscribing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SC</span>
            </div>
            <span className="font-semibold text-lg">StackClinic</span>
          </Link>
          
          {user ? (
            <div className="text-sm text-muted-foreground">
              Logado como <span className="font-medium text-foreground">{user.email}</span>
            </div>
          ) : (
            <Link to="/auth">
              <Button variant="outline">Entrar</Button>
            </Link>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-16">
        <Link
          to={user ? '/app' : '/'}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Escolha o Plano Ideal para sua Clínica
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comece hoje e transforme a gestão da sua clínica. Todos os planos incluem 14 dias de teste grátis.
          </p>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`relative p-6 h-full flex flex-col ${
                plan.popular 
                  ? 'border-2 border-primary shadow-lg shadow-primary/10' 
                  : 'border-border'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Mais Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      R$ {plan.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="lg"
                  className={`w-full ${plan.popular ? 'gradient-primary text-primary-foreground' : ''}`}
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={subscribing !== null}
                >
                  {subscribing === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Começar Agora'
                  )}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Features */}
        <div className="mt-20 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold mb-2">Seguro e Confiável</h4>
            <p className="text-sm text-muted-foreground">
              Seus dados protegidos com criptografia de ponta
            </p>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold mb-2">IA Integrada</h4>
            <p className="text-sm text-muted-foreground">
              Automação inteligente para sua rotina
            </p>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-semibold mb-2">Suporte Rápido</h4>
            <p className="text-sm text-muted-foreground">
              Time dedicado para ajudar você
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-muted-foreground mt-12">
          * Ambiente de demonstração - Pagamentos simulados, sem cobrança real.
        </p>
      </main>
    </div>
  );
}
