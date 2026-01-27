import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar, Clock } from 'lucide-react';
import { api, type Patient, type Procedure } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { format, getDay, parse } from 'date-fns';
import { BlockConflictDialog } from './BlockConflictDialog';

interface Block {
  id: number;
  title: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  recurring: boolean;
  specific_date?: string;
}

interface NewAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialDate?: Date;
  blocks?: Block[];
}

export function NewAppointmentModal({ open, onOpenChange, onSuccess, initialDate, blocks = [] }: NewAppointmentModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [selectedProcedure, setSelectedProcedure] = useState<string>('');
  const [date, setDate] = useState(format(initialDate || new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('30');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingProcedures, setIsLoadingProcedures] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictingBlocks, setConflictingBlocks] = useState<Block[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPatients();
      loadProcedures();
    }
  }, [open]);

  useEffect(() => {
    if (initialDate) {
      setDate(format(initialDate, 'yyyy-MM-dd'));
    }
  }, [initialDate]);

  const loadPatients = async () => {
    setIsLoadingPatients(true);
    const res = await api.getPatients(searchQuery);
    if (res.success && res.data) {
      setPatients(res.data);
    }
    setIsLoadingPatients(false);
  };

  const loadProcedures = async () => {
    setIsLoadingProcedures(true);
    const res = await api.getProcedures();
    if (res.success && res.data) {
      setProcedures(res.data);
    }
    setIsLoadingProcedures(false);
  };

  const handleProcedureChange = (procedureId: string) => {
    setSelectedProcedure(procedureId);
    const proc = procedures.find(p => p.id.toString() === procedureId);
    if (proc) {
      setDuration(proc.duration.toString());
    }
  };

  const findConflictingBlocks = (): Block[] => {
    const selectedDate = parse(date, 'yyyy-MM-dd', new Date());
    const dayOfWeek = getDay(selectedDate);
    const appointmentHour = parseInt(time.split(':')[0]);
    
    return blocks.filter(block => {
      const blockStartHour = parseInt(block.start_time.split(':')[0]);
      const blockEndHour = parseInt(block.end_time.split(':')[0]);
      const isInTimeRange = appointmentHour >= blockStartHour && appointmentHour < blockEndHour;
      
      // Check recurring block
      if (block.recurring && block.day_of_week === dayOfWeek && isInTimeRange) {
        return true;
      }
      
      // Check specific date block
      if (block.specific_date === date && isInTimeRange) {
        return true;
      }
      
      return false;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatient) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione um paciente',
        variant: 'destructive',
      });
      return;
    }

    if (!date || !time) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Data e horário são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Check for block conflicts
    const conflicts = findConflictingBlocks();
    if (conflicts.length > 0) {
      setConflictingBlocks(conflicts);
      setShowConflictDialog(true);
      return;
    }

    await createAppointment();
  };

  const createAppointment = async () => {
    setIsLoading(true);

    const selectedProc = procedures.find(p => p.id.toString() === selectedProcedure);

    const res = await api.createAppointment({
      patient_id: parseInt(selectedPatient),
      date,
      time,
      duration: parseInt(duration),
      procedure: selectedProc?.name || '',
      procedimento_id: selectedProcedure ? parseInt(selectedProcedure) : undefined,
    });

    if (res.success && res.data && typeof res.data === 'object' && 'id' in res.data) {
      toast({
        title: 'Sucesso!',
        description: 'Agendamento criado com sucesso',
      });
      onSuccess();
      handleClose();
    } else if (res.success && (!res.data || !('id' in res.data))) {
      toast({
        title: 'Erro inesperado',
        description: 'Servidor respondeu sucesso, mas não retornou o agendamento. Verifique o console.',
        variant: 'destructive',
      });
      console.error('Resposta inesperada do servidor:', res);
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao criar agendamento',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleProceedWithConflict = async () => {
    setShowConflictDialog(false);
    setIsLoading(true);

    // Delete all conflicting blocks first
    try {
      await Promise.all(
        conflictingBlocks.map(block => api.deleteBlock(block.id))
      );
      
      toast({
        title: 'Bloqueio removido',
        description: 'O bloqueio foi excluído para permitir o agendamento',
      });

      // Then create the appointment
      await createAppointment();
    } catch (error) {
      console.error('Erro ao excluir bloqueios:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir bloqueio. Tente novamente.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleCancelConflict = () => {
    setShowConflictDialog(false);
    setConflictingBlocks([]);
  };

  const handleClose = () => {
    setSelectedPatient('');
    setSelectedProcedure('');
    setDuration('30');
    setConflictingBlocks([]);
    onOpenChange(false);
  };

  const timeSlots = Array.from({ length: 24 }).map((_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minutes}`;
  }).filter(t => {
    const hour = parseInt(t.split(':')[0]);
    return hour >= 8 && hour < 20;
  });

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Novo Agendamento
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingPatients ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : patients.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum paciente encontrado
                      </div>
                    ) : (
                      patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id.toString()}>
                          {patient.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Data *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Horário *</Label>
                  <Select value={time} onValueChange={setTime}>
                    <SelectTrigger>
                      <Clock className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Procedimento</Label>
                <Select value={selectedProcedure} onValueChange={handleProcedureChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingProcedures ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : procedures.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum procedimento cadastrado
                      </div>
                    ) : (
                      procedures.map((proc) => (
                        <SelectItem key={proc.id} value={proc.id.toString()}>
                          {proc.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proc.price)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Duração</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1h30</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Agendar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BlockConflictDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflictingBlocks={conflictingBlocks}
        onProceedAndDelete={handleProceedWithConflict}
        onCancel={handleCancelConflict}
      />
    </>
  );
}
