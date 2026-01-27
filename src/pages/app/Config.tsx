import { useEffect, useState, useRef } from 'react';
import { Building2, Upload, Clock, Save, Loader2, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, type ClinicConfig } from '@/services/api';
import { TeamManagement } from '@/components/config/TeamManagement';
import { AnamneseBuilder } from '@/components/config/AnamneseBuilder';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const weekDays = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export default function Config() {
  const [config, setConfig] = useState<ClinicConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  // Ensure all 7 days exist in working_hours
  const ensureAllDays = (hours: { day: number; open: string; close: string; active: boolean }[] | undefined) => {
    return weekDays.map(day => {
      const existing = hours?.find(wh => wh.day === day.value);
      return existing || { day: day.value, open: '08:00', close: '18:00', active: false };
    });
  };

  async function loadConfig() {
    setIsLoading(true);
    const res = await api.getClinicConfig();
    if (res.success && res.data) {
      // Merge working_hours with default 7 days
      const mergedHours = ensureAllDays(res.data.working_hours);
      setConfig({ ...res.data, working_hours: mergedHours });
      setLogoPreview(res.data.logo_url || null);
    }
    setIsLoading(false);
  }

  const handleChange = (field: keyof ClinicConfig, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const handleWorkingHoursChange = (
    dayIndex: number,
    field: 'open' | 'close' | 'active',
    value: string | boolean
  ) => {
    if (!config) return;
    
    const newHours = config.working_hours.map((wh) => {
      if (wh.day === dayIndex) {
        return { ...wh, [field]: value };
      }
      return wh;
    });
    
    setConfig({ ...config, working_hours: newHours });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    const res = await api.uploadLogo(file);
    if (res.success && res.data) {
      setConfig((prev) => prev ? { ...prev, logo_url: res.data!.logo_url } : null);
    } else {
      toast({
        title: 'Erro ao enviar logo',
        description: res.error || 'Não foi possível enviar o arquivo',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!config) return;
    
    setIsSaving(true);
    await api.updateClinicConfig(config);
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua clínica e equipe</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Agendamento</span>
          </TabsTrigger>
          <TabsTrigger value="anamnese" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Anamnese</span>
          </TabsTrigger>
          {hasPermission('manage_team') && (
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Equipe</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Clinic Info */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Dados da Clínica</h2>
                  <p className="text-sm text-muted-foreground">Informações gerais</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Nome da Clínica
                  </label>
                  <Input
                    value={config?.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Nome da clínica"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">CNPJ</label>
                  <Input
                    value={config?.cnpj || ''}
                    onChange={(e) => handleChange('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Telefone</label>
                  <Input
                    value={config?.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
                  <Input
                    value={config?.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="contato@clinica.com"
                    type="email"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">Endereço</label>
                  <Input
                    value={config?.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Rua, número, bairro, cidade - UF"
                  />
                </div>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <h2 className="font-semibold text-foreground mb-4">Logo da Clínica</h2>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group"
              >
                {logoPreview ? (
                  <>
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="h-full w-full object-contain p-4"
                    />
                    <div className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="h-8 w-8 text-background" />
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Upload className="h-10 w-10 mb-2" />
                    <p className="text-sm font-medium">Clique para enviar</p>
                    <p className="text-xs">PNG, JPG até 2MB</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Horário de Funcionamento</h2>
                <p className="text-sm text-muted-foreground">Configure os dias e horários</p>
              </div>
            </div>

            <div className="space-y-4">
              {weekDays.map((day) => {
                const hours = config?.working_hours.find((wh) => wh.day === day.value);
                return (
                  <div
                    key={day.value}
                    className="flex items-center gap-4 py-3 border-b border-border last:border-0"
                  >
                    <div className="w-32">
                      <span className="font-medium text-foreground">{day.label}</span>
                    </div>
                    <Switch
                      checked={hours?.active ?? false}
                      onCheckedChange={(checked) =>
                        handleWorkingHoursChange(day.value, 'active', checked)
                      }
                    />
                    {hours?.active && (
                      <>
                        <Input
                          type="time"
                          value={hours.open}
                          onChange={(e) =>
                            handleWorkingHoursChange(day.value, 'open', e.target.value)
                          }
                          className="w-32"
                        />
                        <span className="text-muted-foreground">até</span>
                        <Input
                          type="time"
                          value={hours.close}
                          onChange={(e) =>
                            handleWorkingHoursChange(day.value, 'close', e.target.value)
                          }
                          className="w-32"
                        />
                      </>
                    )}
                    {!hours?.active && (
                      <span className="text-sm text-muted-foreground">Fechado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Anamnese Tab */}
        <TabsContent value="anamnese">
          <AnamneseBuilder />
        </TabsContent>

        {/* Team Tab */}
        {hasPermission('manage_team') && (
          <TabsContent value="team">
            <TeamManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
