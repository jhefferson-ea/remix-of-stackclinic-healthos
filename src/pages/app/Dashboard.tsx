import { useEffect, useState } from 'react';
import { DollarSign, Calendar, Users, TrendingUp } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { SmartFeed } from '@/components/dashboard/SmartFeed';
import { HumorChart } from '@/components/dashboard/HumorChart';
import { ActivationRequired } from '@/components/subscription/ActivationRequired';
import { api, type DashboardSummary, type SmartFeedItem, type HumorData } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [smartFeed, setSmartFeed] = useState<SmartFeedItem[]>([]);
  const [humorData, setHumorData] = useState<HumorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, hasActiveSubscription, isSaasAdmin } = useAuth();

  // Check if user needs to activate subscription first
  const needsActivation = !isSaasAdmin() && user?.subscription_status === 'pending';

  useEffect(() => {
    // Don't load dashboard data if user needs activation
    if (needsActivation) {
      setIsLoading(false);
      return;
    }

    async function loadDashboard() {
      setIsLoading(true);
      
      const [summaryRes, feedRes, humorRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getSmartFeed(),
        api.getHumorChart(),
      ]);

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
      if (feedRes.success && feedRes.data) {
        setSmartFeed(feedRes.data);
      }
      if (humorRes.success && humorRes.data) {
        setHumorData(humorRes.data);
      }

      setIsLoading(false);
    }

    loadDashboard();
  }, [needsActivation]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Show activation screen if subscription is pending
  if (needsActivation) {
    return <ActivationRequired />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da sua clínica</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Faturamento"
          value={summary ? formatCurrency(summary.faturamento.hoje) : 'R$ 0'}
          subtitle={summary ? `Mês: ${formatCurrency(summary.faturamento.mes)}` : undefined}
          change={summary?.faturamento.variacao}
          changeLabel="vs mês anterior"
          icon={<DollarSign className="h-6 w-6" />}
          variant="primary"
        />
        <KpiCard
          title="Agendamentos"
          value={summary ? `${summary.agendamentos.realizados}/${summary.agendamentos.total}` : '0/0'}
          subtitle="Realizados / Total"
          icon={<Calendar className="h-6 w-6" />}
        />
        <KpiCard
          title="Novos Pacientes"
          value={summary?.novosPacientes.total || 0}
          change={summary?.novosPacientes.crescimento}
          changeLabel="este mês"
          icon={<Users className="h-6 w-6" />}
        />
        <KpiCard
          title="Taxa de Confirmação"
          value={summary ? `${Math.round((summary.agendamentos.realizados / summary.agendamentos.total) * 100) || 0}%` : '0%'}
          subtitle="Agendamentos confirmados"
          icon={<TrendingUp className="h-6 w-6" />}
          variant="success"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Smart Feed */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Smart Feed</h2>
                <p className="text-sm text-muted-foreground">Tarefas e alertas gerados por IA</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {smartFeed.length} pendentes
              </span>
            </div>
            <SmartFeed items={smartFeed} isLoading={isLoading} />
          </div>
        </div>

        {/* Humor Chart */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Satisfação</h2>
              <p className="text-sm text-muted-foreground">Média das avaliações</p>
            </div>
            <HumorChart data={humorData} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
