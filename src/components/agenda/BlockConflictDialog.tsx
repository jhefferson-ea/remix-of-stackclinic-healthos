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
import { AlertTriangle, Ban, Calendar } from 'lucide-react';

interface Block {
  id: number;
  title: string;
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
  recurring: boolean;
  specific_date?: string | null;
  usuario_id?: number | null;
}

interface BlockConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictingBlocks: Block[];
  onProceedAndDelete: () => void;
  onCancel: () => void;
}

export function BlockConflictDialog({
  open,
  onOpenChange,
  conflictingBlocks,
  onProceedAndDelete,
  onCancel,
}: BlockConflictDialogProps) {
  const blockTitles = conflictingBlocks.map(b => b.title).join(', ');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Conflito de Horário Detectado
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Existe um <strong>bloqueio de agenda</strong> para este horário:
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
              <Ban className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{blockTitles}</span>
            </div>
            <p className="text-sm">
              O que você deseja fazer?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCancel} className="flex-1">
            <Ban className="h-4 w-4 mr-2" />
            Cancelar e Manter Bloqueio
          </AlertDialogCancel>
          <AlertDialogAction onClick={onProceedAndDelete} className="flex-1">
            <Calendar className="h-4 w-4 mr-2" />
            Agendar e Excluir Bloqueio
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
