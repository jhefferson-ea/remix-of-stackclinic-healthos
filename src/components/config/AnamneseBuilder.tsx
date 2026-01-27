import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Edit2, Eye, Save, Loader2, FileText, AlertTriangle, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AnamneseQuestion {
  id: number;
  question: string;
  type: 'text' | 'yes_no' | 'options' | 'photo';
  options?: string[];
  is_alert: boolean;
  order: number;
}

const questionTypes = [
  { value: 'text', label: 'Texto Livre' },
  { value: 'yes_no', label: 'Sim/Não' },
  { value: 'options', label: 'Lista de Opções' },
  { value: 'photo', label: 'Foto' },
];

export function AnamneseBuilder() {
  const [questions, setQuestions] = useState<AnamneseQuestion[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AnamneseQuestion | null>(null);
  
  // Form state
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'text' | 'yes_no' | 'options' | 'photo'>('text');
  const [questionOptions, setQuestionOptions] = useState('');
  const [isAlert, setIsAlert] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    setIsLoading(true);
    const res = await api.getAnamneseQuestions();
    if (res.success && res.data) {
      setQuestions(res.data.questions || []);
      setIsEnabled(res.data.enabled ?? true);
    }
    setIsLoading(false);
  }

  const handleOpenModal = (question?: AnamneseQuestion) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionText(question.question);
      setQuestionType(question.type);
      setQuestionOptions(question.options?.join(', ') || '');
      setIsAlert(question.is_alert);
    } else {
      setEditingQuestion(null);
      setQuestionText('');
      setQuestionType('text');
      setQuestionOptions('');
      setIsAlert(false);
    }
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!questionText.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Digite a pergunta',
        variant: 'destructive',
      });
      return;
    }

    const newQuestion: AnamneseQuestion = {
      id: editingQuestion?.id || Date.now(),
      question: questionText.trim(),
      type: questionType,
      options: questionType === 'options' ? questionOptions.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      is_alert: isAlert,
      order: editingQuestion?.order || questions.length + 1,
    };

    let updatedQuestions: AnamneseQuestion[];
    if (editingQuestion) {
      updatedQuestions = questions.map(q => q.id === editingQuestion.id ? newQuestion : q);
    } else {
      updatedQuestions = [...questions, newQuestion];
    }

    setQuestions(updatedQuestions);
    setIsModalOpen(false);
    
    // Save to backend
    await saveQuestions(updatedQuestions);
  };

  const handleDeleteQuestion = async (id: number) => {
    const updatedQuestions = questions.filter(q => q.id !== id);
    setQuestions(updatedQuestions);
    await saveQuestions(updatedQuestions);
  };

  const saveQuestions = async (questionsToSave: AnamneseQuestion[]) => {
    setIsSaving(true);
    const res = await api.saveAnamneseQuestions({
      enabled: isEnabled,
      questions: questionsToSave,
    });
    
    if (res.success) {
      toast({
        title: 'Salvo!',
        description: 'Roteiro de anamnese atualizado',
      });
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao salvar',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    setIsEnabled(enabled);
    await saveQuestions(questions);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Roteiro de Anamnese</h2>
              <p className="text-sm text-muted-foreground">
                Configure as perguntas que o bot fará antes da consulta
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="anamnese-enabled" className="text-sm">Ativar</Label>
              <Switch
                id="anamnese-enabled"
                checked={isEnabled}
                onCheckedChange={handleToggleEnabled}
              />
            </div>
            <Button variant="outline" onClick={() => setIsPreviewOpen(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>
      </div>

      {/* Trigger Configuration */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-info" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Gatilho de Envio</h3>
            <p className="text-sm text-muted-foreground">
              Quando o bot deve enviar a anamnese automaticamente
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox id="trigger-schedule" defaultChecked />
              <Label htmlFor="trigger-schedule" className="font-medium cursor-pointer">
                Após agendamento confirmado
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Envia anamnese automaticamente quando um agendamento é confirmado
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox id="trigger-24h" defaultChecked />
              <Label htmlFor="trigger-24h" className="font-medium cursor-pointer">
                24h antes da consulta
              </Label>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              Lembrete para preencher caso ainda não tenha respondido
            </p>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-foreground">Perguntas ({questions.length})</h3>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Pergunta
          </Button>
        </div>

        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhuma pergunta cadastrada</p>
            <Button className="mt-4" onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeira Pergunta
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-lg border',
                  question.is_alert
                    ? 'border-warning/50 bg-warning/5'
                    : 'border-border bg-muted/30'
                )}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {index + 1}.
                    </span>
                    <span className="font-medium text-foreground">{question.question}</span>
                    {question.is_alert && (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {questionTypes.find(t => t.value === question.type)?.label}
                    </span>
                    {question.options && question.options.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({question.options.length} opções)
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenModal(question)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => handleDeleteQuestion(question.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {isSaving && (
          <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando...
          </div>
        )}
      </div>

      {/* Add/Edit Question Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="questionText">Texto da Pergunta</Label>
              <Input
                id="questionText"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Ex: Qual o motivo da sua consulta?"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Resposta</Label>
              <Select value={questionType} onValueChange={(v) => setQuestionType(v as typeof questionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {questionTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {questionType === 'options' && (
              <div className="space-y-2">
                <Label htmlFor="questionOptions">Opções (separadas por vírgula)</Label>
                <Input
                  id="questionOptions"
                  value={questionOptions}
                  onChange={(e) => setQuestionOptions(e.target.value)}
                  placeholder="Opção 1, Opção 2, Opção 3"
                />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isAlert"
                checked={isAlert}
                onCheckedChange={(checked) => setIsAlert(checked as boolean)}
              />
              <Label htmlFor="isAlert" className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Destacar resposta positiva em vermelho no prontuário
                </div>
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveQuestion}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-success" />
              Preview WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-[#e5ddd5] rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
              {/* Bot greeting */}
              <div className="flex justify-start">
                <div className="bg-card rounded-lg px-4 py-2 max-w-[85%] shadow-sm">
                  <p className="text-sm">
                    Olá! 👋 Antes da sua consulta, preciso fazer algumas perguntas. Vamos lá?
                  </p>
                </div>
              </div>
              
              {questions.map((q, index) => (
                <div key={q.id} className="space-y-2">
                  {/* Bot question */}
                  <div className="flex justify-start">
                    <div className="bg-card rounded-lg px-4 py-2 max-w-[85%] shadow-sm">
                      <p className="text-sm">
                        <span className="font-medium">{index + 1}.</span> {q.question}
                      </p>
                      {q.type === 'yes_no' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Responda: Sim ou Não
                        </p>
                      )}
                      {q.type === 'options' && q.options && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Opções: {q.options.join(', ')}
                        </p>
                      )}
                      {q.type === 'photo' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📷 Envie uma foto
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* User response placeholder */}
                  <div className="flex justify-end">
                    <div className="bg-[#dcf8c6] rounded-lg px-4 py-2 max-w-[85%] shadow-sm">
                      <p className="text-sm text-muted-foreground italic">
                        (Resposta do paciente)
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Bot closing */}
              {questions.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-card rounded-lg px-4 py-2 max-w-[85%] shadow-sm">
                    <p className="text-sm">
                      Obrigado! ✅ Suas respostas foram registradas. Até a consulta!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
