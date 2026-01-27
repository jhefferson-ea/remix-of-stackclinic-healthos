import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Clock, Ban, Calendar } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface BlockTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const weekDays = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

export function BlockTimeModal({ open, onOpenChange, onSuccess }: BlockTimeModalProps) {
  const [title, setTitle] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [specificDate, setSpecificDate] = useState('');
  const [blockType, setBlockType] = useState<'recurring' | 'specific'>('recurring');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Título é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (blockType === 'recurring' && selectedDays.length === 0) {
      toast({
        title: 'Selecione dias',
        description: 'Selecione pelo menos um dia da semana',
        variant: 'destructive',
      });
      return;
    }

    if (blockType === 'specific' && !specificDate) {
      toast({
        title: 'Selecione a data',
        description: 'Selecione uma data específica para o bloqueio',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    const res = await api.blockTimeSlot({
      title: title.trim(),
      days: blockType === 'recurring' ? selectedDays : [],
      start_time: startTime,
      end_time: endTime,
      recurring: blockType === 'recurring',
      specific_date: blockType === 'specific' ? specificDate : undefined,
    });

    if (res.success) {
      toast({
        title: 'Sucesso!',
        description: 'Horário bloqueado com sucesso',
      });
      onSuccess();
      handleClose();
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao bloquear horário',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    setTitle('');
    setSelectedDays([]);
    setStartTime('12:00');
    setEndTime('13:00');
    setSpecificDate('');
    setBlockType('recurring');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-secondary" />
            Bloquear Horário
          </DialogTitle>
          <DialogDescription>
            Bloqueie horários na sua agenda para compromissos pessoais ou ausências.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Almoço, Mestrado, Reunião..."
                disabled={isLoading}
              />
            </div>

            <Tabs value={blockType} onValueChange={(v) => setBlockType(v as 'recurring' | 'specific')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="recurring">Semanal</TabsTrigger>
                <TabsTrigger value="specific">Data Específica</TabsTrigger>
              </TabsList>
              
              <TabsContent value="recurring" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((day) => (
                      <div
                        key={day.value}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={selectedDays.includes(day.value)}
                          onCheckedChange={() => toggleDay(day.value)}
                          disabled={isLoading}
                        />
                        <Label
                          htmlFor={`day-${day.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="specific" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="specificDate">Data</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="specificDate"
                      type="date"
                      value={specificDate}
                      onChange={(e) => setSpecificDate(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Início</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Fim</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
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
                'Bloquear Horário'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
