import { useEffect, useState } from 'react';
import { Users, Clock, Send, Star, MessageSquare, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { api, type MarketingStats, type InactivePatient, type ReviewConfig, type PatientGroup } from '@/services/api';

export default function Marketing() {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [inactivePatients, setInactivePatients] = useState<InactivePatient[]>([]);
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [reviewConfig, setReviewConfig] = useState<ReviewConfig>({
    auto_request: false,
    min_rating: 4,
    delay_hours: 24,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState(
    'Oi [Nome], faz tempo que não te vejo! Que tal agendar uma consulta de retorno? Temos novidades incríveis para você! 😊'
  );
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  // Campaign filter state
  const [campaignTarget, setCampaignTarget] = useState<'inactive' | 'group' | 'all'>('inactive');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const [statsRes, patientsRes, groupsRes] = await Promise.all([
      api.getMarketingStats(),
      api.getInactivePatients(),
      api.getPatientGroups(),
    ]);

    if (statsRes.success && statsRes.data) setStats(statsRes.data);
    if (patientsRes.success && patientsRes.data) {
      setInactivePatients(patientsRes.data);
      setSelectedPatients(patientsRes.data.map((p) => p.id));
    }
    if (groupsRes.success && groupsRes.data) setGroups(groupsRes.data);
    setIsLoading(false);
  }

  const handleOpenCampaignModal = () => {
    setCampaignTarget('inactive');
    setSelectedGroupId('');
    setSelectedPatients(inactivePatients.map((p) => p.id));
    setShowCampaignModal(true);
  };

  const handleTargetChange = async (target: 'inactive' | 'group' | 'all') => {
    setCampaignTarget(target);
    
    if (target === 'inactive') {
      setSelectedPatients(inactivePatients.map((p) => p.id));
    } else if (target === 'all') {
      // Get all patients
      const res = await api.getPatients();
      if (res.success && res.data) {
        setSelectedPatients(res.data.map((p) => p.id));
      }
    }
  };

  const handleGroupChange = async (groupId: string) => {
    setSelectedGroupId(groupId);
    if (groupId) {
      const res = await api.getPatientGroup(parseInt(groupId));
      if (res.success && res.data?.members) {
        setSelectedPatients(res.data.members.map((m) => m.id));
      }
    }
  };

  const handleSendCampaign = async () => {
    setIsSending(true);
    await api.sendCampaign(selectedPatients, campaignMessage);
    setIsSending(false);
    setShowCampaignModal(false);
    loadData();
  };

  const handleReviewConfigChange = async (key: keyof ReviewConfig, value: unknown) => {
    const newConfig = { ...reviewConfig, [key]: value };
    setReviewConfig(newConfig);
    await api.updateReviewConfig(newConfig);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
        <p className="text-muted-foreground">CRM e campanhas de resgate</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pacientes Inativos"
          value={stats?.inactive_6months || 0}
          subtitle="> 6 meses sem consulta"
          icon={<Users className="h-6 w-6" />}
          variant="warning"
        />
        <KpiCard
          title="Campanhas Enviadas"
          value={stats?.campaigns_sent || 0}
          subtitle="Este mês"
          icon={<Send className="h-6 w-6" />}
        />
        <KpiCard
          title="Taxa de Resposta"
          value={`${stats?.response_rate || 0}%`}
          icon={<TrendingUp className="h-6 w-6" />}
          variant="success"
        />
        <KpiCard
          title="Avaliações Pendentes"
          value={stats?.pending_reviews || 0}
          subtitle="Aguardando envio"
          icon={<Star className="h-6 w-6" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inactive Patients */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Pacientes Sumidos</h2>
                <p className="text-sm text-muted-foreground">&gt; 6 meses sem consulta</p>
              </div>
            </div>
            <Button onClick={handleOpenCampaignModal}>
              <Send className="h-4 w-4 mr-2" />
              Disparar Campanha
            </Button>
          </div>

          {inactivePatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhum paciente inativo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selectedPatients.length === inactivePatients.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPatients(inactivePatients.map((p) => p.id));
                          } else {
                            setSelectedPatients([]);
                          }
                        }}
                        className="rounded border-border"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Nome
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Telefone
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Última Visita
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Total Gasto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inactivePatients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedPatients.includes(patient.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPatients([...selectedPatients, patient.id]);
                            } else {
                              setSelectedPatients(selectedPatients.filter((id) => id !== patient.id));
                            }
                          }}
                          className="rounded border-border"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium">{patient.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{patient.phone}</td>
                      <td className="py-3 px-4 text-muted-foreground">{patient.last_visit}</td>
                      <td className="py-3 px-4">{formatCurrency(patient.total_spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Google Reviews Config */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Star className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Google Reviews</h2>
              <p className="text-sm text-muted-foreground">Configuração automática</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Envio Automático</p>
                <p className="text-sm text-muted-foreground">
                  Solicitar avaliação após consulta
                </p>
              </div>
              <Switch
                checked={reviewConfig.auto_request}
                onCheckedChange={(checked) => handleReviewConfigChange('auto_request', checked)}
              />
            </div>

            <div className="pt-4 border-t border-border">
              <p className="font-medium text-foreground mb-2">Nota Mínima Interna</p>
              <p className="text-sm text-muted-foreground mb-4">
                Enviar pedido apenas se nota interna for maior que:
              </p>
              <div className="flex gap-2">
                {[3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleReviewConfigChange('min_rating', rating)}
                    className={`flex-1 py-2 rounded-lg border transition-colors ${
                      reviewConfig.min_rating === rating
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {rating} ★
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="font-medium text-foreground mb-2">Delay de Envio</p>
              <p className="text-sm text-muted-foreground">
                Enviar {reviewConfig.delay_hours}h após a consulta
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Modal */}
      <Dialog open={showCampaignModal} onOpenChange={setShowCampaignModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Campanha de Resgate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Target Selection */}
            <div className="space-y-2">
              <Label>Destinatários</Label>
              <Tabs value={campaignTarget} onValueChange={(v) => handleTargetChange(v as 'inactive' | 'group' | 'all')}>
                <TabsList className="w-full">
                  <TabsTrigger value="inactive" className="flex-1">Inativos</TabsTrigger>
                  <TabsTrigger value="group" className="flex-1">Por Grupo</TabsTrigger>
                  <TabsTrigger value="all" className="flex-1">Todos</TabsTrigger>
                </TabsList>
                
                <TabsContent value="inactive" className="mt-3">
                  <p className="text-sm text-muted-foreground">
                    {inactivePatients.length} pacientes sem consulta há mais de 6 meses
                  </p>
                </TabsContent>
                
                <TabsContent value="group" className="mt-3">
                  <Select value={selectedGroupId} onValueChange={handleGroupChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          Nenhum grupo criado
                        </SelectItem>
                      ) : (
                        groups.map((group) => (
                          <SelectItem key={group.id} value={group.id.toString()}>
                            {group.name} ({group.member_count} pacientes)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </TabsContent>
                
                <TabsContent value="all" className="mt-3">
                  <p className="text-sm text-muted-foreground">
                    Todos os pacientes cadastrados
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            <div>
              <Label className="mb-2 block">Mensagem</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Enviando para {selectedPatients.length} pacientes
              </p>
              <Textarea
                value={campaignMessage}
                onChange={(e) => setCampaignMessage(e.target.value)}
                rows={5}
                placeholder="Digite a mensagem..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Use [Nome] para personalizar com o nome do paciente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendCampaign} disabled={isSending || selectedPatients.length === 0}>
              {isSending ? 'Enviando...' : 'Enviar Campanha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
