import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Mail, MoreVertical, Loader2, Copy, Check, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  active: boolean;
  status?: string;
  created_at: string;
}

interface InviteResult {
  name: string;
  email: string;
  tempPassword: string;
}

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  doctor: 'Médico',
  secretary: 'Secretária',
};

const roleColors: Record<string, string> = {
  owner: 'bg-primary/10 text-primary',
  doctor: 'bg-info/10 text-info',
  secretary: 'bg-secondary/10 text-secondary',
};

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  inactive: 'Inativo',
};

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/30',
  pending: 'bg-warning/10 text-warning border-warning/30',
  inactive: 'bg-muted text-muted-foreground border-border',
};

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'doctor' | 'secretary'>('doctor');
  const [isInviting, setIsInviting] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<'doctor' | 'secretary'>('doctor');
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    setIsLoading(true);
    const res = await api.getTeamMembers();
    if (res.success && res.data) {
      setMembers(res.data);
    }
    setIsLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();

    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha nome e email',
        variant: 'destructive',
      });
      return;
    }

    setIsInviting(true);

    const res = await api.inviteTeamMember({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
    });

    if (res.success && res.data) {
      // Show password modal instead of toast
      setInviteResult({
        name: res.data.name || inviteName.trim(),
        email: res.data.email || inviteEmail.trim(),
        tempPassword: res.data.temp_password || '',
      });
      setIsInviteOpen(false);
      setInviteName('');
      setInviteEmail('');
      setIsPasswordModalOpen(true);
      loadTeam();
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao convidar membro',
        variant: 'destructive',
      });
    }

    setIsInviting(false);
  }

  async function copyPassword() {
    if (inviteResult?.tempPassword) {
      await navigator.clipboard.writeText(inviteResult.tempPassword);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }

  function closePasswordModal() {
    setIsPasswordModalOpen(false);
    setInviteResult(null);
    setIsCopied(false);
  }

  async function handleToggleActive(member: TeamMember) {
    const res = await api.updateTeamMember(member.id, {
      action: 'toggle_active',
      active: !member.active,
    });

    if (res.success) {
      toast({
        title: member.active ? 'Usuário desativado' : 'Usuário ativado',
      });
      loadTeam();
    } else {
      toast({
        title: 'Erro',
        description: res.error,
        variant: 'destructive',
      });
    }
  }

  async function handleResetPassword(member: TeamMember) {
    const res = await api.updateTeamMember(member.id, {
      action: 'reset_password',
    });

    if (res.success) {
      toast({
        title: 'Senha resetada',
        description: `Nova senha: ${res.data?.temp_password || 'Enviada por email'}`,
      });
    } else {
      toast({
        title: 'Erro',
        description: res.error,
        variant: 'destructive',
      });
    }
  }

  async function handleChangeRole() {
    if (!selectedMember) return;
    
    const res = await api.updateTeamMember(selectedMember.id, {
      action: 'update_role',
      role: newRole,
    });

    if (res.success) {
      toast({
        title: 'Cargo atualizado',
        description: `${selectedMember.name} agora é ${roleLabels[newRole]}`,
      });
      setIsRoleModalOpen(false);
      setSelectedMember(null);
      loadTeam();
    } else {
      toast({
        title: 'Erro',
        description: res.error,
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteMember(member: TeamMember) {
    if (!confirm(`Tem certeza que deseja remover ${member.name} da equipe?`)) return;
    
    const res = await api.deleteTeamMember(member.id);

    if (res.success) {
      toast({
        title: 'Membro removido',
        description: `${member.name} foi removido da equipe`,
      });
      loadTeam();
    } else {
      toast({
        title: 'Erro',
        description: res.error,
        variant: 'destructive',
      });
    }
  }

  function openRoleModal(member: TeamMember) {
    setSelectedMember(member);
    setNewRole(member.role as 'doctor' | 'secretary');
    setIsRoleModalOpen(true);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Gestão de Equipe</h2>
            <p className="text-sm text-muted-foreground">{members.length} membros</p>
          </div>
        </div>
        <Button onClick={() => setIsInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Membro
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Membro</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cargo</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-foreground">{member.name}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {member.email}
                  </div>
                </td>
                <td className="p-4">
                  <Badge className={cn('font-normal', roleColors[member.role])}>
                    <Shield className="h-3 w-3 mr-1" />
                    {roleLabels[member.role]}
                  </Badge>
                </td>
                <td className="p-4">
                  <Badge 
                    variant="outline" 
                    className={cn('font-normal', statusColors[member.status || (member.active ? 'active' : 'inactive')])}
                  >
                    {statusLabels[member.status || (member.active ? 'active' : 'inactive')]}
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  {member.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openRoleModal(member)}>
                          Alterar Cargo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(member)}>
                          {member.active ? 'Desativar Acesso' : 'Ativar Acesso'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(member)}>
                          Resetar Senha
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteMember(member)}
                          className="text-destructive focus:text-destructive"
                        >
                          Remover da Equipe
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Convidar Membro
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inviteName">Nome</Label>
                <Input
                  id="inviteName"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Nome completo"
                  disabled={isInviting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  disabled={isInviting}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'doctor' | 'secretary')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Médico</SelectItem>
                    <SelectItem value="secretary">Secretária</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)} disabled={isInviting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isInviting}>
                {isInviting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Convite'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Role Change Modal */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Alterar Cargo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Alterando cargo de <strong>{selectedMember?.name}</strong>
            </p>
            <div className="space-y-2">
              <Label>Novo Cargo</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as 'doctor' | 'secretary')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Médico</SelectItem>
                  <SelectItem value="secretary">Secretária</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRoleModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangeRole}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Result Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={closePasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-success" />
              Membro Convidado!
            </DialogTitle>
            <DialogDescription>
              O membro foi adicionado com sucesso. Compartilhe as credenciais abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="font-medium text-foreground">{inviteResult?.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{inviteResult?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Senha Temporária</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-md bg-background border border-border font-mono text-sm">
                    {inviteResult?.tempPassword}
                  </code>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyPassword}
                    className="shrink-0"
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ Guarde esta senha! Ela não será exibida novamente.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={closePasswordModal} className="w-full">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
