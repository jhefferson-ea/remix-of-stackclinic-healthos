import { useState, useEffect } from 'react';
import { Loader2, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScheduleDay {
  day: number;
  day_name: string;
  open: string;
  close: string;
  active: boolean;
}

interface ProfessionalScheduleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: number | null;
  professionalName: string;
}

const defaultDays: ScheduleDay[] = [
  { day: 0, day_name: 'Domingo', open: '08:00', close: '12:00', active: false },
  { day: 1, day_name: 'Segunda', open: '08:00', close: '18:00', active: true },
  { day: 2, day_name: 'Terça', open: '08:00', close: '18:00', active: true },
  { day: 3, day_name: 'Quarta', open: '08:00', close: '18:00', active: true },
  { day: 4, day_name: 'Quinta', open: '08:00', close: '18:00', active: true },
  { day: 5, day_name: 'Sexta', open: '08:00', close: '18:00', active: true },
  { day: 6, day_name: 'Sábado', open: '08:00', close: '12:00', active: false },
];

export function ProfessionalSchedule({ open, onOpenChange, professionalId, professionalName }: ProfessionalScheduleProps) {
  const [schedule, setSchedule] = useState<ScheduleDay[]>(defaultDays);
  const [clinicSchedule, setClinicSchedule] = useState<ScheduleDay[]>([]);
  const [useClinicSchedule, setUseClinicSchedule] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && professionalId) {
      loadSchedule();
    }
  }, [open, professionalId]);

  async function loadSchedule() {
    if (!professionalId) return;
    setIsLoading(true);
    const res = await api.getProfessionalSchedule(professionalId);
    if (res.success && res.data) {
      setClinicSchedule(res.data.clinic_schedule);
      setUseClinicSchedule(!res.data.has_custom_schedule);
      
      if (res.data.has_custom_schedule && res.data.schedule.length > 0) {
        // Merge with default days to ensure all days are present
        const merged = defaultDays.map(d => {
          const existing = res.data.schedule.find(s => s.day === d.day);
          return existing || d;
        });
        setSchedule(merged);
      } else {
        // Use clinic schedule as base
        const merged = defaultDays.map(d => {
          const clinicDay = res.data.clinic_schedule.find(s => s.day === d.day);
          return clinicDay || d;
        });
        setSchedule(merged);
      }
    }
    setIsLoading(false);
  }

  function updateDay(dayIndex: number, field: 'open' | 'close' | 'active', value: string | boolean) {
    setSchedule(prev => prev.map((d, i) => 
      i === dayIndex ? { ...d, [field]: value } : d
    ));
  }

  async function handleSave() {
    if (!professionalId) return;
    setIsSaving(true);
    
    const res = await api.updateProfessionalSchedule(professionalId, {
      use_clinic_schedule: useClinicSchedule,
      schedule: useClinicSchedule ? undefined : schedule.map(s => ({
        day: s.day,
        open: s.open,
        close: s.close,
        active: s.active
      }))
    });
    
    if (res.success) {
      toast({
        title: 'Horário atualizado',
        description: useClinicSchedule 
          ? `${professionalName} usando horário da clínica` 
          : `Horário personalizado salvo para ${professionalName}`,
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao atualizar horário',
        variant: 'destructive',
      });
    }
    
    setIsSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Horário de {professionalName}
          </DialogTitle>
          <DialogDescription>
            Configure os horários de atendimento deste profissional
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Toggle for clinic schedule */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="font-medium text-foreground">Usar horário da clínica</p>
                <p className="text-sm text-muted-foreground">
                  Mesmo horário de funcionamento geral
                </p>
              </div>
              <Switch
                checked={useClinicSchedule}
                onCheckedChange={setUseClinicSchedule}
              />
            </div>
            
            {/* Custom schedule */}
            {!useClinicSchedule && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {schedule.map((day, idx) => (
                  <div
                    key={day.day}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      day.active ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'
                    )}
                  >
                    <Switch
                      checked={day.active}
                      onCheckedChange={(checked) => updateDay(idx, 'active', checked)}
                    />
                    <span className={cn(
                      'w-20 font-medium',
                      day.active ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {day.day_name}
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={day.open}
                        onChange={(e) => updateDay(idx, 'open', e.target.value)}
                        disabled={!day.active}
                        className="w-28"
                      />
                      <span className="text-muted-foreground">às</span>
                      <Input
                        type="time"
                        value={day.close}
                        onChange={(e) => updateDay(idx, 'close', e.target.value)}
                        disabled={!day.active}
                        className="w-28"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
