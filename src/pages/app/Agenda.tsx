import { useEffect, useState } from 'react';
import { format, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, isSameDay, isSameMonth, getDay, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Phone, Clock, CheckCircle, XCircle, AlertTriangle, Bell, Users, Plus, Ban, Loader2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api, type Appointment, type AiSuggestion, type WaitingListPatient } from '@/services/api';
import { NewAppointmentModal } from '@/components/agenda/NewAppointmentModal';
import { BlockTimeModal } from '@/components/agenda/BlockTimeModal';
import { AppointmentDetailModal } from '@/components/agenda/AppointmentDetailModal';

interface Block {
  id: number;
  title: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  recurring: boolean;
  specific_date?: string;
}

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isBlockTimeOpen, setIsBlockTimeOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentDate, view]);

  async function loadData() {
    setIsLoading(true);
    
    const [appointmentsRes, suggestionsRes, waitingRes] = await Promise.all([
      api.getAppointments(),
      api.getAiSuggestions(),
      api.getWaitingList(),
    ]);

    if (appointmentsRes.success && appointmentsRes.data) {
      const data = appointmentsRes.data as { appointments?: Appointment[]; blocks?: Block[] } | Appointment[];
      if ('appointments' in data && 'blocks' in data) {
        setAppointments(data.appointments || []);
        setBlocks(data.blocks || []);
      } else if (Array.isArray(data)) {
        setAppointments(data);
      }
    }
    if (suggestionsRes.success && suggestionsRes.data) {
      setSuggestions(suggestionsRes.data);
    }
    if (waitingRes.success && waitingRes.data) {
      setWaitingList(waitingRes.data);
    }
    setIsLoading(false);
  }

  const handleApprove = async (id: number) => {
    await api.approveAiSlot(id);
    loadData();
  };

  const handleReject = async (id: number) => {
    await api.rejectAiSlot(id);
    setSuggestions(suggestions.filter(s => s.id !== id));
  };

  const handleNotifyWaitingList = async () => {
    await api.notifyWaitingList();
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (view === 'month') {
      setCurrentDate(prev => addMonths(prev, direction === 'next' ? 1 : -1));
    } else {
      const days = view === 'week' ? 7 : 1;
      setCurrentDate(prev => addDays(prev, direction === 'next' ? days : -days));
    }
  };

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setIsDetailOpen(true);
  };

  const handleDayClick = (day: Date) => {
    if (view === 'month') {
      setCurrentDate(day);
      setView('day');
    }
  };

  const weekDays = view === 'week' 
    ? Array.from({ length: 7 }).map((_, i) =>
        addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i)
      )
    : [currentDate];

  const hours = Array.from({ length: 12 }).map((_, i) => 8 + i);

  const statusColors: Record<string, string> = {
    confirmed: 'bg-success/20 border-success/40 text-success',
    pending: 'bg-warning/20 border-warning/40 text-warning',
    cancelled: 'bg-destructive/20 border-destructive/40 text-destructive',
  };

  const getAppointmentsForSlot = (day: Date, hour: number) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return appointments.filter(apt => {
      const aptHour = parseInt(apt.time.split(':')[0]);
      return apt.date === dateStr && aptHour === hour;
    });
  };

  const getAppointmentsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return appointments.filter(apt => apt.date === dateStr);
  };

  const getBlocksForSlot = (day: Date, hour: number) => {
    const dayOfWeek = getDay(day);
    const dateStr = format(day, 'yyyy-MM-dd');
    
    return blocks.filter(block => {
      const blockStartHour = parseInt(block.start_time.split(':')[0]);
      const blockEndHour = parseInt(block.end_time.split(':')[0]);
      
      const isInTimeRange = hour >= blockStartHour && hour < blockEndHour;
      
      if (block.recurring && block.day_of_week === dayOfWeek && isInTimeRange) {
        return true;
      }
      
      if (block.specific_date === dateStr && isInTimeRange) {
        return true;
      }
      
      return false;
    });
  };

  // Month view helpers
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = addDays(endOfMonth(currentDate), 6 - getDay(endOfMonth(currentDate)));
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda Inteligente</h1>
          <p className="text-muted-foreground">Gerencie seus agendamentos com IA</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setIsNewAppointmentOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
          <Button variant="outline" onClick={() => setIsBlockTimeOpen(true)}>
            <Ban className="h-4 w-4 mr-2" />
            Bloquear Horário
          </Button>
          <div className="flex items-center rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setView('day')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-l-lg transition-colors',
                view === 'day' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setView('week')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                view === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setView('month')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-r-lg transition-colors',
                view === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              Mês
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="xl:col-span-3">
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleNavigate('prev')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold capitalize">
                {view === 'day' 
                  ? format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
                }
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleNavigate('next')}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Month View */}
            {view === 'month' && (
              <>
                {/* Week day headers */}
                <div className="grid grid-cols-7 border-b border-border">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
                    <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7">
                  {monthDays.map((day, idx) => {
                    const dayAppointments = getAppointmentsForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          'min-h-[100px] p-2 border-b border-r border-border cursor-pointer hover:bg-muted/50 transition-colors',
                          !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                          isToday && 'bg-primary/5'
                        )}
                      >
                        <p className={cn(
                          'text-sm font-medium mb-1',
                          isToday && 'text-primary',
                          !isCurrentMonth && 'text-muted-foreground'
                        )}>
                          {format(day, 'd')}
                        </p>
                        {dayAppointments.length > 0 && (
                          <div className="space-y-1">
                            {dayAppointments.slice(0, 2).map((apt) => (
                              <div
                                key={apt.id}
                                className={cn(
                                  'text-xs p-1 rounded truncate',
                                  statusColors[apt.status] || statusColors.pending
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAppointmentClick(apt);
                                }}
                              >
                                {apt.time} - {apt.patient_name}
                              </div>
                            ))}
                            {dayAppointments.length > 2 && (
                              <p className="text-xs text-muted-foreground">
                                +{dayAppointments.length - 2} mais
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Day/Week View */}
            {(view === 'day' || view === 'week') && (
              <>
                {/* Week Days Header */}
                <div className={cn(
                  "grid border-b border-border",
                  view === 'week' ? 'grid-cols-8' : 'grid-cols-2'
                )}>
                  <div className="p-3 text-center text-sm font-medium text-muted-foreground">
                    Hora
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'p-3 text-center border-l border-border',
                        isSameDay(day, new Date()) && 'bg-primary/5'
                      )}
                    >
                      <p className="text-xs text-muted-foreground uppercase">
                        {format(day, 'EEE', { locale: ptBR })}
                      </p>
                      <p className={cn(
                        'text-lg font-semibold',
                        isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground'
                      )}>
                        {format(day, 'd')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Time Slots */}
                <div className="max-h-[500px] overflow-y-auto">
                  {hours.map((hour) => (
                    <div 
                      key={hour} 
                      className={cn(
                        "grid border-b border-border last:border-b-0",
                        view === 'week' ? 'grid-cols-8' : 'grid-cols-2'
                      )}
                    >
                      <div className="p-3 text-center text-sm text-muted-foreground border-r border-border">
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </div>
                      {weekDays.map((day) => {
                        const dayAppointments = getAppointmentsForSlot(day, hour);
                        const dayBlocks = getBlocksForSlot(day, hour);

                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            className={cn(
                              'min-h-[60px] p-1 border-l border-border',
                              isSameDay(day, new Date()) && 'bg-primary/5',
                              dayBlocks.length > 0 && 'bg-muted/50'
                            )}
                          >
                            {/* Show blocks */}
                            {dayBlocks.map((block) => (
                              <div
                                key={`block-${block.id}`}
                                className="rounded-lg border p-2 text-xs bg-muted border-muted-foreground/30 text-muted-foreground mb-1"
                              >
                                <p className="font-medium truncate flex items-center gap-1">
                                  <Ban className="h-3 w-3" />
                                  {block.title}
                                </p>
                                <p className="text-[10px] opacity-60">{block.start_time} - {block.end_time}</p>
                              </div>
                            ))}
                            
                            {/* Show appointments */}
                            {dayAppointments.map((apt) => (
                              <div
                                key={apt.id}
                                onClick={() => handleAppointmentClick(apt)}
                                className={cn(
                                  'rounded-lg border p-2 text-xs cursor-pointer transition-all hover:shadow-md',
                                  statusColors[apt.status] || statusColors.pending
                                )}
                              >
                                <p className="font-medium truncate">{apt.patient_name}</p>
                                <p className="truncate opacity-80">{apt.procedure || 'Consulta'}</p>
                                <p className="text-[10px] opacity-60">{apt.time}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Suggestions */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Encaixe IA</h3>
                <p className="text-xs text-muted-foreground">Sugestões inteligentes</p>
              </div>
            </div>

            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma sugestão no momento
              </p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-lg border border-border p-3 bg-muted/30"
                  >
                    <p className="text-sm text-foreground">{suggestion.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestion.suggested_action}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleApprove(suggestion.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleReject(suggestion.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waiting List */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Lista de Espera</h3>
                  <p className="text-xs text-muted-foreground">{waitingList.length} pacientes</p>
                </div>
              </div>
            </div>

            {waitingList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum paciente aguardando
              </p>
            ) : (
              <>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {waitingList.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {patient.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{patient.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {patient.preferred_time}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full mt-4"
                  variant="secondary"
                  onClick={handleNotifyWaitingList}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Notificar Lista
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <NewAppointmentModal
        open={isNewAppointmentOpen}
        onOpenChange={setIsNewAppointmentOpen}
        onSuccess={loadData}
        initialDate={currentDate}
        blocks={blocks}
      />
      <BlockTimeModal
        open={isBlockTimeOpen}
        onOpenChange={setIsBlockTimeOpen}
        onSuccess={loadData}
      />
      <AppointmentDetailModal
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        appointment={selectedAppointment}
        onSuccess={loadData}
      />
    </div>
  );
}
