import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Search,
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/services/api';

interface Clinic {
  id: number;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  onboarding_completed: boolean;
  created_at: string;
  owner_name: string;
  subscription_status: string;
  subscription_plan: string;
  total_users: number;
}

export default function AdminClinics() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchClinics();
  }, []);

  async function fetchClinics() {
    try {
      const res = await api.get<{ clinics: Clinic[]; pagination: any }>('/admin/clinics');
      if (res.success && res.data?.clinics) {
        setClinics(res.data.clinics);
      }
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredClinics = clinics.filter(
    (clinic) =>
      clinic.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clinic.cnpj?.includes(searchTerm) ||
      clinic.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSubscriptionBadge = (status: string, plan: string) => {
    const statusConfig: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      trial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      suspended: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return (
      <Badge className={statusConfig[status] || 'bg-slate-700 text-slate-300'}>
        {status} {plan && `• ${plan}`}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8 bg-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Clínicas</h1>
          <p className="text-slate-400">Gerenciar todas as clínicas cadastradas</p>
        </div>
        <Badge variant="outline" className="text-slate-400 border-slate-700">
          {clinics.length} clínicas
        </Badge>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, CNPJ ou proprietário..."
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

      {/* Clinics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClinics.map((clinic, index) => (
          <motion.div
            key={clinic.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{clinic.name}</h3>
                      <p className="text-sm text-slate-400">{clinic.cnpj || 'CNPJ não informado'}</p>
                    </div>
                  </div>
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
                      <DropdownMenuItem className="text-slate-300 hover:text-white focus:text-white focus:bg-slate-800">
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-slate-300 hover:text-white focus:text-white focus:bg-slate-800">
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-slate-800">
                        Suspender
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {getSubscriptionBadge(clinic.subscription_status, clinic.subscription_plan)}
                  <Badge
                    className={
                      clinic.onboarding_completed
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-slate-700/50 text-slate-400'
                    }
                  >
                    {clinic.onboarding_completed ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Onboarding OK
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Onboarding Pendente
                      </span>
                    )}
                  </Badge>
                </div>

                {/* Contact info */}
                <div className="space-y-2 text-sm">
                  {clinic.phone && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Phone className="h-4 w-4" />
                      {clinic.phone}
                    </div>
                  )}
                  {clinic.email && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="h-4 w-4" />
                      {clinic.email}
                    </div>
                  )}
                  {clinic.address && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{clinic.address}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-sm">
                  <div className="text-slate-400">
                    <span className="text-white font-medium">{clinic.total_users || 0}</span> usuários
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Calendar className="h-3 w-3" />
                    {new Date(clinic.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {filteredClinics.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            Nenhuma clínica encontrada
          </div>
        )}
      </div>
    </div>
  );
}
