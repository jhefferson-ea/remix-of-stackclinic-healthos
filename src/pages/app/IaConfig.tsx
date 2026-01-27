import { useEffect, useState } from 'react';
import { Bot, Sparkles, Clock, MessageCircle, XCircle, User, Edit2, Send, Plus, Trash2, Users, Bell, Search, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { api, type AiConfig, type LiveChat, type CustomTrigger, type Patient, type PatientGroup } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

const personalities = [
  { value: 'nutri', label: 'Nutricionista', description: 'Tom motivador e encorajador' },
  { value: 'dentista', label: 'Dentista', description: 'Tom clínico e profissional' },
  { value: 'psico', label: 'Psicólogo', description: 'Tom acolhedor e empático' },
  { value: 'dermato', label: 'Dermatologista', description: 'Tom técnico e explicativo' },
  { value: 'pediatra', label: 'Pediatra', description: 'Tom amigável e tranquilizador' },
];

const eventTypes = [
  { value: 'after_appointment', label: 'Após consulta', description: 'X horas após uma consulta' },
  { value: 'before_appointment', label: 'Antes da consulta', description: 'X horas antes de uma consulta' },
  { value: 'birthday', label: 'Aniversário', description: 'No dia do aniversário do paciente' },
  { value: 'inactive', label: 'Paciente inativo', description: 'Após X dias sem visita' },
  { value: 'post_procedure', label: 'Pós-procedimento', description: 'Acompanhamento após procedimento' },
];

// Static patient groups (fallback) - will be merged with dynamic groups from API
const staticPatientGroups = [
  { value: 'all', label: 'Todos os pacientes' },
  { value: 'recent', label: 'Pacientes recentes (30 dias)' },
  { value: 'inactive_30', label: 'Inativos há 30 dias' },
  { value: 'inactive_60', label: 'Inativos há 60 dias' },
  { value: 'inactive_90', label: 'Inativos há 90+ dias' },
];

interface SimulatedMessage {
  id: number;
  sender: 'patient' | 'bot';
  text: string;
  time: string;
}

export default function IaConfig() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [liveChats, setLiveChats] = useState<LiveChat[]>([]);
  const [customTriggers, setCustomTriggers] = useState<CustomTrigger[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dynamicGroups, setDynamicGroups] = useState<PatientGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit trigger modal
  const [isEditTriggerOpen, setIsEditTriggerOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<string | null>(null);
  const [triggerValue, setTriggerValue] = useState('24');
  const [triggerUnit, setTriggerUnit] = useState('hours');
  
  // Custom trigger modal
  const [isCustomTriggerOpen, setIsCustomTriggerOpen] = useState(false);
  const [editingCustomTrigger, setEditingCustomTrigger] = useState<CustomTrigger | null>(null);
  const [customTriggerForm, setCustomTriggerForm] = useState<CustomTrigger>({
    name: '',
    message: '',
    trigger_type: 'recurring',
    interval_hours: 4,
    target_type: 'all',
    enabled: true,
  });
  
  // Patient search
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  
  // Simulated chat
  const [simulatedMessages, setSimulatedMessages] = useState<SimulatedMessage[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const [configRes, chatsRes, triggersRes, patientsRes, groupsRes] = await Promise.all([
      api.getAiConfig(),
      api.getLiveChats(),
      api.getCustomTriggers(),
      api.getPatients(),
      api.getPatientGroups(),
    ]);

    if (configRes.success && configRes.data) setConfig(configRes.data);
    if (chatsRes.success && chatsRes.data) setLiveChats(chatsRes.data);
    if (triggersRes.success && triggersRes.data) setCustomTriggers(triggersRes.data);
    if (patientsRes.success && patientsRes.data) setPatients(patientsRes.data);
    if (groupsRes.success && groupsRes.data) setDynamicGroups(groupsRes.data);
    setIsLoading(false);
  }

  // Combine static groups with dynamic groups from API
  const patientGroups = [
    ...staticPatientGroups,
    ...dynamicGroups.map(g => ({ value: `group_${g.id}`, label: `📁 ${g.name} (${g.member_count})` }))
  ];

  const handleConfigChange = async (key: keyof AiConfig, value: unknown) => {
    if (!config) return;
    
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    
    setIsSaving(true);
    await api.updateAiConfig({ [key]: value });
    setIsSaving(false);
  };

  const handleTakeOver = async (chatId: string) => {
    await api.takeOverChat(chatId);
    loadData();
  };

  const handleEditTrigger = (trigger: string) => {
    setEditingTrigger(trigger);
    if (trigger === 'reminder') {
      setTriggerValue('24');
      setTriggerUnit('hours');
    } else if (trigger === 'auto_cancel') {
      setTriggerValue(config?.auto_cancel_hours?.toString() || '2');
      setTriggerUnit('hours');
    }
    setIsEditTriggerOpen(true);
  };

  const handleSaveTrigger = () => {
    if (editingTrigger === 'auto_cancel') {
      handleConfigChange('auto_cancel_hours', parseInt(triggerValue));
    }
    setIsEditTriggerOpen(false);
    toast({
      title: 'Gatilho atualizado',
      description: 'Configuração salva com sucesso',
    });
  };

  const handleOpenCustomTriggerModal = (trigger?: CustomTrigger) => {
    if (trigger) {
      setEditingCustomTrigger(trigger);
      setCustomTriggerForm(trigger);
      // If it's a specific patient, find the patient name
      if (trigger.target_type === 'specific_patient' && trigger.target_value) {
        const patient = patients.find(p => p.id.toString() === trigger.target_value);
        setPatientSearchQuery(patient?.name || '');
      }
    } else {
      setEditingCustomTrigger(null);
      setCustomTriggerForm({
        name: '',
        message: '',
        trigger_type: 'recurring',
        interval_hours: 4,
        target_type: 'all',
        enabled: true,
      });
      setPatientSearchQuery('');
    }
    setIsCustomTriggerOpen(true);
  };

  const handleSaveCustomTrigger = async () => {
    if (!customTriggerForm.name || !customTriggerForm.message) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e mensagem são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Validate specific patient selection
    if (customTriggerForm.target_type === 'specific_patient' && !customTriggerForm.target_value) {
      toast({
        title: 'Selecione um paciente',
        description: 'Escolha o paciente que receberá este gatilho',
        variant: 'destructive',
      });
      return;
    }

    const payload = editingCustomTrigger 
      ? { ...customTriggerForm, id: editingCustomTrigger.id }
      : customTriggerForm;

    const res = await api.saveCustomTrigger(payload);
    
    if (res.success) {
      toast({
        title: 'Sucesso!',
        description: editingCustomTrigger ? 'Gatilho atualizado' : 'Gatilho criado',
      });
      loadData();
      setIsCustomTriggerOpen(false);
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao salvar gatilho',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCustomTrigger = async (id: number) => {
    const res = await api.deleteCustomTrigger(id);
    if (res.success) {
      toast({ title: 'Gatilho excluído' });
      setCustomTriggers(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setCustomTriggerForm(prev => ({
      ...prev,
      target_value: patient.id.toString(),
    }));
    setPatientSearchQuery(patient.name);
    setShowPatientSearch(false);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearchQuery.toLowerCase())
  );

  const handleSimulateMessage = () => {
    const patientMessage: SimulatedMessage = {
      id: Date.now(),
      sender: 'patient',
      text: 'Olá! Gostaria de agendar uma consulta para amanhã',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    
    setSimulatedMessages(prev => [...prev, patientMessage]);
    
    setTimeout(() => {
      const botMessage: SimulatedMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Olá! 👋 Claro, temos horários disponíveis amanhã às 9h, 14h e 16h. Qual horário prefere?',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setSimulatedMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  const getTriggerTypeLabel = (type: string) => {
    switch (type) {
      case 'recurring': return 'Recorrente';
      case 'one_time': return 'Uma vez';
      case 'event_based': return 'Baseado em evento';
      default: return type;
    }
  };

  const getTargetTypeLabel = (type: string, value?: string) => {
    if (type === 'specific_patient' && value) {
      const patient = patients.find(p => p.id.toString() === value);
      return patient ? patient.name : 'Paciente específico';
    }
    if (type === 'patient_group' && value) {
      const group = patientGroups.find(g => g.value === value);
      return group?.label || value;
    }
    return 'Todos pacientes';
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Central de IA</h1>
        <p className="text-muted-foreground">Configure o comportamento do bot WhatsApp</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          {/* Personality */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Personalidade do Bot</h2>
                <p className="text-sm text-muted-foreground">Escolha o tom de comunicação</p>
              </div>
            </div>

            <Select
              value={config?.personality}
              onValueChange={(value) => handleConfigChange('personality', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma personalidade" />
              </SelectTrigger>
              <SelectContent>
                {personalities.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div>
                      <p className="font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Built-in Triggers */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Gatilhos Automáticos</h2>
                <p className="text-sm text-muted-foreground">Ações automáticas do bot</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div className="flex items-center gap-3 flex-1">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Lembrete 24h antes</p>
                    <p className="text-sm text-muted-foreground">Enviar lembrete de consulta</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditTrigger('reminder')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={config?.reminder_24h}
                    onCheckedChange={(checked) => handleConfigChange('reminder_24h', checked)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div className="flex items-center gap-3 flex-1">
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Cobrar confirmação</p>
                    <p className="text-sm text-muted-foreground">Solicitar confirmação do paciente</p>
                  </div>
                </div>
                <Switch
                  checked={config?.request_confirmation}
                  onCheckedChange={(checked) => handleConfigChange('request_confirmation', checked)}
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 flex-1">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Cancelar se não responder</p>
                    <p className="text-sm text-muted-foreground">
                      Cancelar após {config?.auto_cancel_hours || 24}h sem resposta
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditTrigger('auto_cancel')}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={config?.auto_cancel}
                    onCheckedChange={(checked) => handleConfigChange('auto_cancel', checked)}
                  />
                </div>
              </div>
            </div>

            {isSaving && (
              <p className="text-xs text-muted-foreground text-center mt-4">Salvando...</p>
            )}
          </div>

          {/* Custom Triggers */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Gatilhos Personalizados</h2>
                  <p className="text-sm text-muted-foreground">Crie lembretes e mensagens customizadas</p>
                </div>
              </div>
              <Button size="sm" onClick={() => handleOpenCustomTriggerModal()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </div>

            {customTriggers.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhum gatilho customizado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Crie lembretes como "Beber água a cada 4h"
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customTriggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground truncate">{trigger.name}</p>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded',
                          trigger.enabled ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                        )}>
                          {trigger.enabled ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {getTriggerTypeLabel(trigger.trigger_type)}
                        {trigger.trigger_type === 'recurring' && ` • A cada ${trigger.interval_hours}h`}
                        {' • '}
                        {getTargetTypeLabel(trigger.target_type, trigger.target_value)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenCustomTriggerModal(trigger)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => trigger.id && handleDeleteCustomTrigger(trigger.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Chat */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Conversas Ativas</h2>
                <p className="text-sm text-muted-foreground">Assuma o controle quando necessário</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleSimulateMessage}>
              <Send className="h-4 w-4 mr-2" />
              Simular Mensagem
            </Button>
          </div>

          {liveChats.length === 0 && simulatedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-medium">Aguardando novas mensagens...</p>
              <p className="text-sm text-muted-foreground mt-1">
                As conversas do WhatsApp aparecerão aqui
              </p>
              <Button className="mt-4" variant="outline" onClick={handleSimulateMessage}>
                <Send className="h-4 w-4 mr-2" />
                Testar com Mensagem Simulada
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Simulated Messages */}
              {simulatedMessages.length > 0 && (
                <div className="border border-border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center">
                      <User className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Simulação de Chat</p>
                      <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Modo Teste</span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {simulatedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex',
                          msg.sender === 'patient' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'rounded-lg px-3 py-2 max-w-[80%]',
                            msg.sender === 'patient'
                              ? 'bg-success/20 text-foreground'
                              : 'bg-card border border-border text-foreground'
                          )}
                        >
                          <p className="text-sm">{msg.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">{msg.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real chats */}
              {liveChats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center gap-4 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{chat.patient_name}</p>
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        chat.status === 'bot'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-success/10 text-success'
                      )}>
                        {chat.status === 'bot' ? 'Bot' : 'Humano'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{chat.last_message}</p>
                  </div>
                  {chat.unread > 0 && (
                    <span className="h-5 w-5 rounded-full bg-secondary text-secondary-foreground text-xs flex items-center justify-center font-medium">
                      {chat.unread}
                    </span>
                  )}
                  {chat.status === 'bot' && (
                    <Button size="sm" variant="outline" onClick={() => handleTakeOver(chat.id)}>
                      Assumir
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Built-in Trigger Modal */}
      <Dialog open={isEditTriggerOpen} onOpenChange={setIsEditTriggerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Configurar Gatilho</DialogTitle>
            <DialogDescription>Ajuste o tempo do gatilho automático</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label htmlFor="triggerValue">Tempo</Label>
                <Input
                  id="triggerValue"
                  type="number"
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  min="1"
                  max="72"
                />
              </div>
              <div className="flex-1">
                <Label>Unidade</Label>
                <Select value={triggerUnit} onValueChange={setTriggerUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas antes</SelectItem>
                    <SelectItem value="days">Dias antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTriggerOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTrigger}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Trigger Modal */}
      <Dialog open={isCustomTriggerOpen} onOpenChange={setIsCustomTriggerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomTrigger ? 'Editar Gatilho' : 'Novo Gatilho Personalizado'}
            </DialogTitle>
            <DialogDescription>
              Crie lembretes automáticos para enviar via WhatsApp
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="triggerName">Nome do Gatilho</Label>
              <Input
                id="triggerName"
                value={customTriggerForm.name}
                onChange={(e) => setCustomTriggerForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Lembrete de hidratação"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="triggerMessage">Mensagem</Label>
              <Textarea
                id="triggerMessage"
                value={customTriggerForm.message}
                onChange={(e) => setCustomTriggerForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Ex: Olá! 💧 Lembre-se de beber água! Hidratação é fundamental para sua saúde."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Gatilho</Label>
                <Select 
                  value={customTriggerForm.trigger_type} 
                  onValueChange={(v) => setCustomTriggerForm(prev => ({ ...prev, trigger_type: v as 'recurring' | 'one_time' | 'event_based' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">Recorrente</SelectItem>
                    <SelectItem value="one_time">Uma vez</SelectItem>
                    <SelectItem value="event_based">Baseado em evento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {customTriggerForm.trigger_type === 'recurring' && (
                <div className="space-y-2">
                  <Label htmlFor="intervalHours">Intervalo (horas)</Label>
                  <Input
                    id="intervalHours"
                    type="number"
                    value={customTriggerForm.interval_hours}
                    onChange={(e) => setCustomTriggerForm(prev => ({ ...prev, interval_hours: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max="168"
                  />
                </div>
              )}
            </div>

            {/* Event-based configuration */}
            {customTriggerForm.trigger_type === 'event_based' && (
              <div className="space-y-4 p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">Configuração do Evento</Label>
                </div>
                
                <div className="space-y-2">
                  <Label>Tipo de Evento</Label>
                  <Select 
                    value={customTriggerForm.target_value?.split(':')[0] || 'after_appointment'} 
                    onValueChange={(v) => setCustomTriggerForm(prev => ({ 
                      ...prev, 
                      target_value: `${v}:${prev.interval_hours || 24}` 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {eventTypes.map((event) => (
                        <SelectItem key={event.value} value={event.value}>
                          <div>
                            <p className="font-medium">{event.label}</p>
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventDelay">Tempo após evento (horas)</Label>
                  <Input
                    id="eventDelay"
                    type="number"
                    value={customTriggerForm.interval_hours}
                    onChange={(e) => setCustomTriggerForm(prev => ({ ...prev, interval_hours: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max="720"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Select 
                value={customTriggerForm.target_type} 
                onValueChange={(v) => {
                  setCustomTriggerForm(prev => ({ 
                    ...prev, 
                    target_type: v as 'all' | 'specific_patient' | 'patient_group',
                    target_value: v === 'all' ? undefined : prev.target_value
                  }));
                  if (v === 'specific_patient') {
                    setShowPatientSearch(true);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Todos os pacientes
                    </div>
                  </SelectItem>
                  <SelectItem value="specific_patient">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Paciente específico
                    </div>
                  </SelectItem>
                  <SelectItem value="patient_group">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Grupo de pacientes
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Patient search */}
            {customTriggerForm.target_type === 'specific_patient' && (
              <div className="space-y-2">
                <Label>Buscar Paciente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={patientSearchQuery}
                    onChange={(e) => {
                      setPatientSearchQuery(e.target.value);
                      setShowPatientSearch(true);
                    }}
                    onFocus={() => setShowPatientSearch(true)}
                    placeholder="Digite o nome do paciente..."
                    className="pl-10"
                  />
                </div>
                
                {showPatientSearch && patientSearchQuery && (
                  <div className="border border-border rounded-lg max-h-40 overflow-y-auto bg-popover">
                    {filteredPatients.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        Nenhum paciente encontrado
                      </div>
                    ) : (
                      filteredPatients.slice(0, 5).map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                          onClick={() => handleSelectPatient(patient)}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{patient.name}</p>
                            <p className="text-xs text-muted-foreground">{patient.phone}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                
                {customTriggerForm.target_value && (
                  <p className="text-xs text-success flex items-center gap-1">
                    ✓ Paciente selecionado: {patients.find(p => p.id.toString() === customTriggerForm.target_value)?.name}
                  </p>
                )}
              </div>
            )}

            {/* Patient group selection */}
            {customTriggerForm.target_type === 'patient_group' && (
              <div className="space-y-2">
                <Label>Selecionar Grupo</Label>
                <Select 
                  value={customTriggerForm.target_value || ''} 
                  onValueChange={(v) => setCustomTriggerForm(prev => ({ ...prev, target_value: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientGroups.map((group) => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="triggerEnabled"
                checked={customTriggerForm.enabled}
                onCheckedChange={(checked) => setCustomTriggerForm(prev => ({ ...prev, enabled: checked }))}
              />
              <Label htmlFor="triggerEnabled" className="cursor-pointer">
                Gatilho ativo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomTriggerOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCustomTrigger}>
              {editingCustomTrigger ? 'Atualizar' : 'Criar Gatilho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
