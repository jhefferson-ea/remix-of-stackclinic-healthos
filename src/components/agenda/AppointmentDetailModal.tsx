import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, User, Clock, FileText, Calendar, MessageSquare } from 'lucide-react';
import { ConversationDrawer } from './ConversationDrawer';
import { api, type Appointment } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AppointmentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onSuccess: () => void;
}

export function AppointmentDetailModal({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: AppointmentDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConversation, setShowConversation] = useState(false);

  const handleDelete = async () => {
    if (!appointment) return;
    
    setIsDeleting(true);
    try {
      const res = await api.deleteAppointment(appointment.id);
      if (res.success) {
        toast({
          title: 'Agendamento cancelado',
          description: 'O agendamento foi removido com sucesso.',
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Não foi possível cancelar o agendamento',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao cancelar agendamento',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  if (!appointment) return null;

  const formattedDate = format(parseISO(appointment.date), "EEE, dd/MM/yyyy", { locale: ptBR });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Agendamento</DialogTitle>
            <DialogDescription className="sr-only">
              Informações completas sobre o agendamento selecionado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{appointment.patient_name}</p>
                <p className="text-sm text-muted-foreground">{appointment.patient_phone}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-medium capitalize">{formattedDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="text-sm font-medium">{appointment.time} ({appointment.duration} min)</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Procedimento</p>
                <p className="text-sm font-medium">{appointment.procedure || 'Consulta'}</p>
              </div>
            </div>

            {appointment.notes && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                <p className="text-sm">{appointment.notes}</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Fechar
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowConversation(true)}
              className="flex-1"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Ver Conversa
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowConfirmDelete(true)}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Cancelar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Sim, Cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConversationDrawer
        open={showConversation}
        onOpenChange={setShowConversation}
        appointmentId={appointment.id}
      />
    </>
  );
}
