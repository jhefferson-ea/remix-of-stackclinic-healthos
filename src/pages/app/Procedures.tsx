import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, ClipboardList, Clock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, type Procedure } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

export default function Procedures() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDuration, setFormDuration] = useState('30');

  useEffect(() => {
    loadProcedures();
  }, []);

  const loadProcedures = async () => {
    setIsLoading(true);
    const res = await api.getProcedures();
    if (res.success && res.data) {
      setProcedures(res.data);
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao carregar procedimentos',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const openCreateModal = () => {
    setSelectedProcedure(null);
    setFormName('');
    setFormPrice('');
    setFormDuration('30');
    setIsModalOpen(true);
  };

  const openEditModal = (procedure: Procedure) => {
    setSelectedProcedure(procedure);
    setFormName(procedure.name);
    setFormPrice(procedure.price.toFixed(2));
    setFormDuration(procedure.duration.toString());
    setIsModalOpen(true);
  };

  const openDeleteDialog = (procedure: Procedure) => {
    setSelectedProcedure(procedure);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Nome do procedimento é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    const price = parseFloat(formPrice.replace(',', '.')) || 0;
    const duration = parseInt(formDuration);

    setIsSaving(true);

    if (selectedProcedure) {
      // Update
      const res = await api.updateProcedure(selectedProcedure.id, {
        name: formName.trim(),
        price,
        duration,
      });
      if (res.success) {
        toast({
          title: 'Sucesso!',
          description: 'Procedimento atualizado com sucesso',
        });
        loadProcedures();
        setIsModalOpen(false);
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Erro ao atualizar procedimento',
          variant: 'destructive',
        });
      }
    } else {
      // Create
      const res = await api.createProcedure({
        name: formName.trim(),
        price,
        duration,
      });
      if (res.success) {
        toast({
          title: 'Sucesso!',
          description: 'Procedimento criado com sucesso',
        });
        loadProcedures();
        setIsModalOpen(false);
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Erro ao criar procedimento',
          variant: 'destructive',
        });
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedProcedure) return;

    const res = await api.deleteProcedure(selectedProcedure.id);
    if (res.success) {
      toast({
        title: 'Sucesso!',
        description: 'Procedimento excluído com sucesso',
      });
      loadProcedures();
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao excluir procedimento',
        variant: 'destructive',
      });
    }
    setIsDeleteDialogOpen(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Procedimentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre os serviços oferecidos pela clínica
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Procedimento
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Procedimentos
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{procedures.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Preço Médio
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {procedures.length > 0
                ? formatCurrency(
                    procedures.reduce((acc, p) => acc + p.price, 0) / procedures.length
                  )
                : 'R$ 0,00'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Duração Média
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {procedures.length > 0
                ? formatDuration(
                    Math.round(
                      procedures.reduce((acc, p) => acc + p.duration, 0) / procedures.length
                    )
                  )
                : '0 min'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : procedures.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">
                Nenhum procedimento cadastrado
              </h3>
              <p className="text-muted-foreground mt-1">
                Clique em "Novo Procedimento" para começar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procedures.map((procedure) => (
                  <TableRow key={procedure.id}>
                    <TableCell className="font-medium">{procedure.name}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(procedure.price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDuration(procedure.duration)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(procedure)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(procedure)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {selectedProcedure ? 'Editar Procedimento' : 'Novo Procedimento'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Consulta, Retorno, Limpeza"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0,00"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Duração Padrão</Label>
                <Select value={formDuration} onValueChange={setFormDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutos</SelectItem>
                    <SelectItem value="20">20 minutos</SelectItem>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : selectedProcedure ? (
                  'Salvar'
                ) : (
                  'Criar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir procedimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o procedimento "{selectedProcedure?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
