import { useEffect, useState } from 'react';
import { Gift, Users, DollarSign, Copy, Check, TrendingUp, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { KpiCard } from '@/components/dashboard/KpiCard';
import { api, type PartnerProgram, type PartnerStats } from '@/services/api';

export default function Partners() {
  const [program, setProgram] = useState<PartnerProgram | null>(null);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const [programRes, statsRes, codeRes] = await Promise.all([
      api.getPartnerProgram(),
      api.getPartnerStats(),
      api.getReferralCode(),
    ]);

    if (programRes.success && programRes.data) setProgram(programRes.data);
    if (statsRes.success && statsRes.data) setStats(statsRes.data);
    if (codeRes.success && codeRes.data) setReferralCode(codeRes.data.code);
    setIsLoading(false);
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const progressPercentage = program
    ? (program.current_referrals / program.target_referrals) * 100
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Programa de Parceiros</h1>
        <p className="text-muted-foreground">Indique e ganhe benefícios exclusivos</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Indicações Totais"
          value={stats?.total_referrals || 0}
          icon={<Users className="h-6 w-6" />}
        />
        <KpiCard
          title="Indicações Ativas"
          value={stats?.active_referrals || 0}
          subtitle="Clientes ativos"
          icon={<TrendingUp className="h-6 w-6" />}
          variant="success"
        />
        <KpiCard
          title="Comissão Total"
          value={formatCurrency(stats?.total_commission || 0)}
          icon={<DollarSign className="h-6 w-6" />}
          variant="primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gamification Progress */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center">
              <Target className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Próxima Meta</h2>
              <p className="text-sm text-muted-foreground">{program?.next_milestone}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Circular Progress */}
            <div className="flex items-center justify-center py-6">
              <div className="relative h-40 w-40">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${progressPercentage * 2.83} 283`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-foreground">
                    {program?.current_referrals || 0}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    de {program?.target_referrals || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-muted-foreground">
                Faltam{' '}
                <span className="font-semibold text-primary">
                  {(program?.target_referrals || 0) - (program?.current_referrals || 0)}
                </span>{' '}
                indicações para{' '}
                <span className="font-semibold text-foreground">isenção da mensalidade</span>
              </p>
            </div>
          </div>
        </div>

        {/* Referral Code & Wallet */}
        <div className="space-y-6">
          {/* Referral Code */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Seu Código</h2>
                <p className="text-sm text-muted-foreground">Compartilhe e ganhe</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-center">
                <span className="text-2xl font-bold tracking-wider text-foreground">
                  {referralCode || 'CARREGANDO...'}
                </span>
              </div>
              <Button variant="secondary" size="icon" onClick={handleCopyCode}>
                {copied ? (
                  <Check className="h-5 w-5 text-success" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Wallet */}
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 shadow-card text-primary-foreground">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Carteira</h2>
                <p className="text-sm opacity-80">Economia gerada</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-4xl font-bold">
                {formatCurrency(program?.total_savings || 0)}
              </p>
              <p className="text-sm opacity-80 mt-1">em descontos e bônus</p>
            </div>

            <div className="mt-6 pt-4 border-t border-primary-foreground/20">
              <div className="flex justify-between text-sm">
                <span className="opacity-80">Próximo crédito</span>
                <span className="font-medium">R$ 50,00 por indicação</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <h2 className="text-lg font-semibold mb-6">Como Funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-primary">1</span>
            </div>
            <h3 className="font-medium text-foreground mb-2">Compartilhe seu Código</h3>
            <p className="text-sm text-muted-foreground">
              Envie seu código exclusivo para colegas profissionais
            </p>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-primary">2</span>
            </div>
            <h3 className="font-medium text-foreground mb-2">Eles se Cadastram</h3>
            <p className="text-sm text-muted-foreground">
              Quando ativarem a conta, você ganha R$ 50 de crédito
            </p>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-primary">3</span>
            </div>
            <h3 className="font-medium text-foreground mb-2">Isenção de Mensalidade</h3>
            <p className="text-sm text-muted-foreground">
              Com 10 indicações ativas, sua mensalidade é isenta!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
