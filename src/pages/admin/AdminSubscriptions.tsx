import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  MoreHorizontal,
  Building2,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Subscription {
  id: number;
  clinica_id: number;
  clinic_name: string;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    try {
      const res = await api.get<{ subscriptions: Subscription[]; pagination: any }>('/admin/subscriptions');
      if (res.success && res.data?.subscriptions) {
        setSubscriptions(res.data.subscriptions);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateSubscriptionStatus(id: number, status: string) {
    try {
      const res = await api.post('/admin/subscriptions', { id, status });
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Status da assinatura atualizado' });
        fetchSubscriptions();
      } else {
        toast({ title: 'Erro', description: res.error || 'Falha ao atualizar', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro de conexão', variant: 'destructive' });
    }
  }

  const filteredSubscriptions = subscriptions.filter(
    (sub) =>
      sub.clinic_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.plan?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'trial':
        return <Clock className="h-4 w-4 text-blue-400" />;
      case 'suspended':
        return <AlertCircle className="h-4 w-4 text-amber-400" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      active: { label: 'Ativo', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      trial: { label: 'Trial', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      suspended: { label: 'Suspenso', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      cancelled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };
    const c = config[status] || { label: status, className: 'bg-slate-700 text-slate-300' };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const config: Record<string, string> = {
      basic: 'bg-slate-700/50 text-slate-300',
      professional: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
      enterprise: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
    return (
      <Badge className={config[plan] || 'bg-slate-700 text-slate-300'}>
        {plan?.charAt(0).toUpperCase() + plan?.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8 bg-slate-800" />
        <Skeleton className="h-[500px] bg-slate-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Assinaturas</h1>
          <p className="text-slate-400">Gerenciar assinaturas e planos das clínicas</p>
        </div>
        <Badge variant="outline" className="text-slate-400 border-slate-700">
          {subscriptions.length} assinaturas
        </Badge>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por clínica ou plano..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
          <Filter className="h-4 w-4 mr-2" />
          Filtros
        </Button>
      </div>

      {/* Subscriptions Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-4 text-slate-400 font-medium">Clínica</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Plano</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Período</th>
                  <th className="text-left p-4 text-slate-400 font-medium">Criado em</th>
                  <th className="text-right p-4 text-slate-400 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((sub, index) => (
                  <motion.tr
                    key={sub.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{sub.clinic_name}</p>
                          <p className="text-sm text-slate-400">ID: {sub.clinica_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{getPlanBadge(sub.plan)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(sub.status)}
                        {getStatusBadge(sub.status)}
                      </div>
                    </td>
                    <td className="p-4">
                      {sub.status === 'trial' && sub.trial_ends_at ? (
                        <div className="text-sm">
                          <p className="text-slate-300">Trial até</p>
                          <p className="text-slate-400">
                            {new Date(sub.trial_ends_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ) : sub.current_period_end ? (
                        <div className="text-sm">
                          <p className="text-slate-300">Renova em</p>
                          <p className="text-slate-400">
                            {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Calendar className="h-4 w-4" />
                        {new Date(sub.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700">
                          <DropdownMenuItem
                            onClick={() => updateSubscriptionStatus(sub.id, 'active')}
                            className="text-green-400 hover:text-green-300 focus:text-green-300 focus:bg-slate-800"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Ativar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateSubscriptionStatus(sub.id, 'trial')}
                            className="text-blue-400 hover:text-blue-300 focus:text-blue-300 focus:bg-slate-800"
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Definir como Trial
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-700" />
                          <DropdownMenuItem
                            onClick={() => updateSubscriptionStatus(sub.id, 'suspended')}
                            className="text-amber-400 hover:text-amber-300 focus:text-amber-300 focus:bg-slate-800"
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Suspender
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateSubscriptionStatus(sub.id, 'cancelled')}
                            className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-slate-800"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))}
                {filteredSubscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Nenhuma assinatura encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
