import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  MoreHorizontal,
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Trash2,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface SaasAdmin {
  id: number;
  user_id: number;
  name: string;
  email: string;
  saas_role: string;
  created_at: string;
}

export default function AdminTeam() {
  const [admins, setAdmins] = useState<SaasAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('support');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    try {
      const res = await api.get<SaasAdmin[]>('/admin/saas-team');
      if (res.success && res.data) {
        setAdmins(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch SaaS admins:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddAdmin() {
    if (!newAdminEmail) {
      toast({ title: 'Erro', description: 'Informe o email do usuário', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // First find user by email
      const res = await api.post('/admin/saas-team', {
        email: newAdminEmail,
        role: newAdminRole,
      });

      if (res.success) {
        toast({ title: 'Sucesso', description: 'Admin adicionado com sucesso' });
        setIsAddDialogOpen(false);
        setNewAdminEmail('');
        setNewAdminRole('support');
        fetchAdmins();
      } else {
        toast({ title: 'Erro', description: res.error || 'Falha ao adicionar admin', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro de conexão', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveAdmin(userId: number) {
    if (userId === user?.id) {
      toast({ title: 'Erro', description: 'Você não pode remover a si mesmo', variant: 'destructive' });
      return;
    }

    try {
      const res = await api.delete(`/admin/saas-team?user_id=${userId}`);
      if (res.success) {
        toast({ title: 'Sucesso', description: 'Admin removido com sucesso' });
        fetchAdmins();
      } else {
        toast({ title: 'Erro', description: res.error || 'Falha ao remover admin', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro de conexão', variant: 'destructive' });
    }
  }

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <ShieldCheck className="h-4 w-4 text-violet-400" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-400" />;
      case 'support':
        return <ShieldAlert className="h-4 w-4 text-amber-400" />;
      default:
        return <Eye className="h-4 w-4 text-slate-400" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { label: string; className: string }> = {
      super_admin: { label: 'Super Admin', className: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
      admin: { label: 'Admin', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      support: { label: 'Suporte', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      viewer: { label: 'Visualizador', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    };
    const c = config[role] || { label: role, className: 'bg-slate-700 text-slate-300' };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8 bg-slate-800" />
        <Skeleton className="h-[400px] bg-slate-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Equipe SaaS</h1>
          <p className="text-slate-400">Gerenciar administradores do painel SaaS</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Adicionar Admin SaaS</DialogTitle>
              <DialogDescription className="text-slate-400">
                Adicione um usuário existente como administrador do SaaS.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  Email do Usuário
                </label>
                <Input
                  placeholder="usuario@email.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">
                  Nível de Acesso
                </label>
                <Select value={newAdminRole} onValueChange={setNewAdminRole}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="admin" className="text-white">Admin</SelectItem>
                    <SelectItem value="support" className="text-white">Suporte</SelectItem>
                    <SelectItem value="viewer" className="text-white">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddAdmin}
                disabled={isSubmitting}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {isSubmitting ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAdmins.map((admin, index) => (
          <motion.div
            key={admin.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-lg">
                        {admin.name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        {admin.name}
                        {admin.user_id === user?.id && (
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                            Você
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-slate-400 flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {admin.email}
                      </p>
                    </div>
                  </div>
                  {admin.saas_role !== 'super_admin' && admin.user_id !== user?.id && (
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
                          onClick={() => handleRemoveAdmin(admin.user_id)}
                          className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-slate-800"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover Admin
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  {getRoleIcon(admin.saas_role)}
                  {getRoleBadge(admin.saas_role)}
                </div>

                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Calendar className="h-4 w-4" />
                  Desde {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {filteredAdmins.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            Nenhum administrador encontrado
          </div>
        )}
      </div>
    </div>
  );
}
