import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  DollarSign,
  UserPlus,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';

interface DashboardStats {
  total_clinics: number;
  clinics_with_onboarding: number;
  total_users: number;
  active_users: number;
  subscriptions_by_status: Record<string, number>;
  subscriptions_by_plan: Record<string, number>;
  mrr: number;
  new_users_30d: number;
  recent_clinics: Array<{
    id: number;
    name: string;
    created_at: string;
    onboarding_completed: boolean;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await api.get<DashboardStats>('/admin/dashboard');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch admin dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8 bg-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'MRR',
      value: formatCurrency(stats?.mrr || 0),
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      change: '+12%',
    },
    {
      title: 'Clínicas Ativas',
      value: stats?.clinics_with_onboarding || 0,
      subtitle: `de ${stats?.total_clinics || 0} total`,
      icon: Building2,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      title: 'Usuários Ativos',
      value: stats?.active_users || 0,
      subtitle: `de ${stats?.total_users || 0} total`,
      icon: Users,
      color: 'from-violet-500 to-purple-600',
    },
    {
      title: 'Novos (30 dias)',
      value: stats?.new_users_30d || 0,
      icon: UserPlus,
      color: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard Admin</h1>
        <p className="text-slate-400">Visão geral do StackClinic SaaS</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpiCards.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{kpi.title}</p>
                    <p className="text-2xl font-bold text-white">{kpi.value}</p>
                    {kpi.subtitle && (
                      <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
                    )}
                    {kpi.change && (
                      <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {kpi.change} vs mês anterior
                      </p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${kpi.color}`}>
                    <kpi.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Subscriptions by Status */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-violet-400" />
              Assinaturas por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats?.subscriptions_by_status || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        status === 'active'
                          ? 'bg-green-500'
                          : status === 'trial'
                          ? 'bg-blue-500'
                          : status === 'suspended'
                          ? 'bg-amber-500'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="text-slate-300 capitalize">{status}</span>
                  </div>
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions by Plan */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-400" />
              Distribuição por Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats?.subscriptions_by_plan || {}).map(([plan, count]) => {
                const total = Object.values(stats?.subscriptions_by_plan || {}).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 capitalize">{plan}</span>
                      <span className="text-white font-semibold">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Clinics */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-400" />
            Clínicas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.recent_clinics?.map((clinic) => (
              <div
                key={clinic.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{clinic.name}</p>
                    <p className="text-sm text-slate-400">
                      Criada em {new Date(clinic.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={clinic.onboarding_completed ? 'default' : 'secondary'}
                  className={
                    clinic.onboarding_completed
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-slate-700 text-slate-300'
                  }
                >
                  {clinic.onboarding_completed ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Onboarding OK
                    </span>
                  ) : (
                    'Pendente'
                  )}
                </Badge>
              </div>
            ))}
            {(!stats?.recent_clinics || stats.recent_clinics.length === 0) && (
              <p className="text-slate-400 text-center py-8">Nenhuma clínica cadastrada ainda</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
