import { useState, useEffect } from 'react';
import { Plus, Users, Trash2, Edit2, Check, X, Loader2, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { api, type PatientGroup, type Patient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface PatientGroupsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: Patient[];
}

export function PatientGroupsModal({ open, onOpenChange, patients }: PatientGroupsModalProps) {
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<PatientGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  
  // Create/Edit group
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PatientGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Manage members
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadGroups();
    }
  }, [open]);

  async function loadGroups() {
    setIsLoading(true);
    const res = await api.getPatientGroups();
    if (res.success && res.data) {
      setGroups(res.data);
    }
    setIsLoading(false);
  }

  const handleOpenEditModal = (group?: PatientGroup) => {
    if (group) {
      setEditingGroup(group);
      setGroupName(group.name);
      setGroupDescription(group.description || '');
    } else {
      setEditingGroup(null);
      setGroupName('');
      setGroupDescription('');
    }
    setIsEditModalOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do grupo',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    
    const res = editingGroup
      ? await api.updatePatientGroup(editingGroup.id, { name: groupName, description: groupDescription })
      : await api.createPatientGroup({ name: groupName, description: groupDescription });

    if (res.success) {
      toast({ title: editingGroup ? 'Grupo atualizado!' : 'Grupo criado!' });
      loadGroups();
      setIsEditModalOpen(false);
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao salvar grupo',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  const handleDeleteGroup = async (group: PatientGroup) => {
    if (!confirm(`Excluir o grupo "${group.name}"?`)) return;
    
    const res = await api.deletePatientGroup(group.id);
    if (res.success) {
      toast({ title: 'Grupo excluído' });
      setGroups(prev => prev.filter(g => g.id !== group.id));
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao excluir grupo',
        variant: 'destructive',
      });
    }
  };

  const handleOpenMembersModal = async (group: PatientGroup) => {
    setSelectedGroup(group);
    setSelectedPatients([]);
    setPatientSearch('');
    
    // Load current members
    const res = await api.getPatientGroup(group.id);
    if (res.success && res.data) {
      setGroupMembers(res.data.members.map(m => m.id));
    }
    
    setIsMembersModalOpen(true);
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedPatients.length === 0) return;
    
    setIsSaving(true);
    const res = await api.addPatientsToGroup(selectedGroup.id, selectedPatients);
    
    if (res.success) {
      toast({ title: `${res.data?.added || 0} paciente(s) adicionado(s)` });
      loadGroups();
      setIsMembersModalOpen(false);
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao adicionar membros',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  const handleRemoveMember = async (patientId: number) => {
    if (!selectedGroup) return;
    
    const res = await api.removePatientsFromGroup(selectedGroup.id, [patientId]);
    if (res.success) {
      setGroupMembers(prev => prev.filter(id => id !== patientId));
      loadGroups();
    }
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) &&
    !groupMembers.includes(p.id)
  );

  const togglePatient = (patientId: number) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Grupos de Pacientes
            </DialogTitle>
            <DialogDescription>
              Organize seus pacientes em grupos para campanhas e gatilhos
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Button onClick={() => handleOpenEditModal()} className="w-full mb-4">
              <Plus className="h-4 w-4 mr-2" />
              Novo Grupo
            </Button>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum grupo criado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie grupos para organizar campanhas e gatilhos
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{group.name}</p>
                      {group.description && (
                        <p className="text-sm text-muted-foreground truncate">{group.description}</p>
                      )}
                      <Badge variant="secondary" className="mt-1">
                        {group.member_count} paciente{group.member_count !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenMembersModal(group)}
                        title="Gerenciar membros"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenEditModal(group)}
                        title="Editar grupo"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteGroup(group)}
                        title="Excluir grupo"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Group Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex: Pós-operatório"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Descrição do grupo..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGroup} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingGroup ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Modal */}
      <Dialog open={isMembersModalOpen} onOpenChange={setIsMembersModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Membros: {selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              Adicione ou remova pacientes do grupo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Current members */}
            {groupMembers.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Membros atuais ({groupMembers.length})
                </Label>
                <ScrollArea className="h-32 rounded border border-border p-2">
                  <div className="space-y-1">
                    {groupMembers.map(memberId => {
                      const patient = patients.find(p => p.id === memberId);
                      if (!patient) return null;
                      return (
                        <div key={memberId} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                          <span className="text-sm">{patient.name}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleRemoveMember(memberId)}
                          >
                            <UserMinus className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Add new members */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Adicionar pacientes
              </Label>
              <Input
                placeholder="Buscar pacientes..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="mb-2"
              />
              <ScrollArea className="h-48 rounded border border-border p-2">
                {filteredPatients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum paciente disponível
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => togglePatient(patient.id)}
                      >
                        <Checkbox
                          checked={selectedPatients.includes(patient.id)}
                          onCheckedChange={() => togglePatient(patient.id)}
                        />
                        <span className="text-sm">{patient.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMembersModalOpen(false)}>
              Fechar
            </Button>
            <Button 
              onClick={handleAddMembers} 
              disabled={selectedPatients.length === 0 || isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Adicionar {selectedPatients.length > 0 ? `(${selectedPatients.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
