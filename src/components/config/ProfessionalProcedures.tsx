import { useState, useEffect } from 'react';
import { Loader2, Stethoscope, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Procedure {
  id: number;
  name: string;
  price: number;
  duration: number;
  assigned: boolean;
}

interface Professional {
  id: number;
  name: string;
  role: string;
}

interface ProfessionalProceduresProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: number | null;
  professionalName: string;
}

export function ProfessionalProcedures({ open, onOpenChange, professionalId, professionalName }: ProfessionalProceduresProps) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && professionalId) {
      loadProcedures();
    }
  }, [open, professionalId]);

  async function loadProcedures() {
    if (!professionalId) return;
    setIsLoading(true);
    const res = await api.getProfessionalProcedures(professionalId);
    if (res.success && res.data) {
      setProcedures(res.data.procedures);
      setSelectedIds(res.data.procedures.filter(p => p.assigned).map(p => p.id));
    }
    setIsLoading(false);
  }

  function toggleProcedure(id: number) {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(pid => pid !== id) 
        : [...prev, id]
    );
  }

  async function handleSave() {
    if (!professionalId) return;
    setIsSaving(true);
    
    const res = await api.updateProfessionalProcedures(professionalId, selectedIds);
    
    if (res.success) {
      toast({
        title: 'Procedimentos atualizados',
        description: `${selectedIds.length} procedimentos vinculados a ${professionalName}`,
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao atualizar procedimentos',
        variant: 'destructive',
      });
    }
    
    setIsSaving(false);
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Procedimentos de {professionalName}
          </DialogTitle>
          <DialogDescription>
            Selecione quais procedimentos este profissional pode realizar
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : procedures.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum procedimento cadastrado na clínica
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
            {procedures.map((proc) => (
              <div
                key={proc.id}
                onClick={() => toggleProcedure(proc.id)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedIds.includes(proc.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <Checkbox
                  checked={selectedIds.includes(proc.id)}
                  onCheckedChange={() => toggleProcedure(proc.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{proc.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(proc.price)} • {proc.duration} min
                  </p>
                </div>
                {selectedIds.includes(proc.id) && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            ))}
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
                Salvar ({selectedIds.length} selecionados)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
