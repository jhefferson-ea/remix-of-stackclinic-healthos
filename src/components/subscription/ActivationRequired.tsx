import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CreditCard, Shield, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

const features = [
  'Agenda inteligente com IA',
  'Gestão de pacientes e prontuário',
  'WhatsApp integrado',
  'Financeiro e relatórios',
  'Marketing automatizado',
  'Suporte prioritário',
];

export function ActivationRequired() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full text-center px-4"
      >
        {/* Welcome Icon */}
        <div className="mb-8">
          <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center mx-auto shadow-lg shadow-primary/25">
            <Sparkles className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>

        {/* Welcome Message */}
        <h1 className="text-3xl font-bold text-foreground mb-3">
          Bem-vindo ao StackClinic, {user?.name?.split(' ')[0]}! 🎉
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Sua conta foi criada com sucesso! Para acessar todas as funcionalidades,
          ative seu plano agora.
        </p>

        {/* Features Preview */}
        <Card className="p-6 mb-8 text-left bg-muted/30">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Funcionalidades Incluídas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-2 text-sm"
              >
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            size="lg"
            onClick={() => navigate('/pricing')}
            className="gradient-primary text-primary-foreground h-14 px-10 text-lg font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
          >
            <CreditCard className="h-5 w-5 mr-3" />
            Escolher Meu Plano
          </Button>
        </motion.div>

        {/* Trial Info */}
        <p className="text-sm text-muted-foreground mt-6 flex items-center justify-center gap-2">
          <Zap className="h-4 w-4 text-warning" />
          Todos os planos incluem 14 dias de teste grátis
        </p>
      </motion.div>
    </div>
  );
}
