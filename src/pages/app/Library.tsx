import { useEffect, useState, useRef } from 'react';
import { FileText, Upload, Search, Plus, Copy, Check, FolderOpen, User, Hash, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { api, type LibraryFile, type Shortcut, type Patient } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

const categories = [
  { value: 'geral', label: 'Geral' },
  { value: 'dietas', label: 'Dietas' },
  { value: 'pos-op', label: 'Pós-Operatório' },
  { value: 'orientacoes', label: 'Orientações' },
  { value: 'termos', label: 'Termos' },
  { value: 'exames', label: 'Exames' },
  { value: 'receitas', label: 'Receitas' },
];

export default function Library() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('geral');
  const [uploadPatientId, setUploadPatientId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Shortcut modal
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [newShortcut, setNewShortcut] = useState({ command: '', file_id: 0, file_name: '' });
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const [filesRes, shortcutsRes, patientsRes] = await Promise.all([
      api.getLibraryFiles(),
      api.getShortcuts(),
      api.getPatients(),
    ]);

    if (filesRes.success && filesRes.data) setFiles(filesRes.data);
    if (shortcutsRes.success && shortcutsRes.data) setShortcuts(shortcutsRes.data);
    if (patientsRes.success && patientsRes.data) setPatients(patientsRes.data);
    setIsLoading(false);
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadModal(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    const res = await api.uploadFile(selectedFile, uploadCategory);
    
    if (res.success) {
      toast({
        title: 'Sucesso!',
        description: 'Arquivo enviado com sucesso',
      });
      loadData();
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadCategory('geral');
      setUploadPatientId('');
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao enviar arquivo',
        variant: 'destructive',
      });
    }
    setIsUploading(false);
  };

  const handleSaveShortcut = async () => {
    if (!newShortcut.command || !newShortcut.file_id) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Comando e arquivo são obrigatórios',
        variant: 'destructive',
      });
      return;
    }
    
    const res = await api.saveShortcut({
      command: newShortcut.command.startsWith('/') ? newShortcut.command : `/${newShortcut.command}`,
      file_id: newShortcut.file_id,
      file_name: newShortcut.file_name,
    });
    
    if (res.success) {
      toast({ title: 'Atalho criado com sucesso!' });
      setShowShortcutModal(false);
      setNewShortcut({ command: '', file_id: 0, file_name: '' });
      loadData();
    } else {
      toast({
        title: 'Erro',
        description: res.error || 'Erro ao criar atalho',
        variant: 'destructive',
      });
    }
  };

  const handleCopyShortcut = (command: string, id: number) => {
    navigator.clipboard.writeText(command);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter files based on search and category
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || file.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedFiles = filteredFiles.reduce((acc, file) => {
    const category = file.category || 'geral';
    if (!acc[category]) acc[category] = [];
    acc[category].push(file);
    return acc;
  }, {} as Record<string, LibraryFile[]>);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Biblioteca</h1>
          <p className="text-muted-foreground">Arquivos, documentos e atalhos WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="by-category">Por Categoria</TabsTrigger>
          <TabsTrigger value="shortcuts">Atalhos</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar arquivos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory || "__all__"} onValueChange={(v) => setSelectedCategory(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Files Grid */}
            <div className="lg:col-span-2 space-y-6">
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground">Nenhum arquivo</h3>
                  <p className="text-muted-foreground mt-1">
                    Faça upload do seu primeiro arquivo
                  </p>
                  <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Fazer Upload
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {filteredFiles.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col items-center text-center"
                    >
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <p className="font-medium text-foreground text-sm truncate w-full">
                        {file.name}
                      </p>
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {categories.find((c) => c.value === file.category)?.label || file.category}
                      </Badge>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <h3 className="font-semibold text-foreground mb-4">Resumo</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total de arquivos</span>
                    <span className="font-semibold">{files.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Atalhos WhatsApp</span>
                    <span className="font-semibold">{shortcuts.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Categorias</span>
                    <span className="font-semibold">{Object.keys(groupedFiles).length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Atalhos Rápidos</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowShortcutModal(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {shortcuts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum atalho configurado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shortcuts.slice(0, 5).map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between rounded-lg border border-border p-2 hover:bg-muted/30 transition-colors"
                      >
                        <div className="truncate flex-1">
                          <p className="font-mono text-sm font-medium text-primary">{shortcut.command}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleCopyShortcut(shortcut.command, shortcut.id!)}
                        >
                          {copiedId === shortcut.id ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="by-category" className="mt-6">
          <div className="space-y-8">
            {Object.entries(groupedFiles).map(([category, categoryFiles]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <Hash className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">
                    {categories.find((c) => c.value === category)?.label || category}
                  </h3>
                  <Badge variant="outline">{categoryFiles.length}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {categoryFiles.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col items-center text-center"
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <p className="font-medium text-foreground text-sm truncate w-full">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{file.type}</p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="shortcuts" className="mt-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-semibold text-foreground text-lg">Atalhos WhatsApp</h2>
                <p className="text-sm text-muted-foreground">Envie arquivos rapidamente via comandos</p>
              </div>
              <Button onClick={() => setShowShortcutModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Atalho
              </Button>
            </div>

            {shortcuts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Hash className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-foreground">Nenhum atalho configurado</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Crie atalhos para enviar arquivos rapidamente no WhatsApp. 
                  Por exemplo: /dieta envia automaticamente o PDF de dieta.
                </p>
                <Button className="mt-4" onClick={() => setShowShortcutModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Atalho
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-lg font-medium text-primary">{shortcut.command}</p>
                      <p className="text-sm text-muted-foreground truncate">{shortcut.file_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopyShortcut(shortcut.command, shortcut.id!)}
                      >
                        {copiedId === shortcut.id ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md overflow-visible max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload de Arquivo</DialogTitle>
            <DialogDescription>Configure as opções do arquivo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedFile && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="relative z-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="z-[200]">
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paciente (opcional)</Label>
              <Select value={uploadPatientId || "__none__"} onValueChange={(v) => setUploadPatientId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="relative z-10">
                  <SelectValue placeholder="Arquivo geral (todos)" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="z-[200] max-h-60">
                  <SelectItem value="__none__">Arquivo geral (todos)</SelectItem>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id.toString()}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {patient.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shortcut Modal */}
      <Dialog open={showShortcutModal} onOpenChange={setShowShortcutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Atalho WhatsApp</DialogTitle>
            <DialogDescription>
              Crie um comando para enviar arquivos rapidamente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="command">Comando</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">/</span>
                <Input
                  id="command"
                  value={newShortcut.command.replace('/', '')}
                  onChange={(e) => setNewShortcut({ ...newShortcut, command: e.target.value })}
                  placeholder="dieta"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O paciente digitará este comando no WhatsApp
              </p>
            </div>
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Select
                value={newShortcut.file_id.toString()}
                onValueChange={(value) => {
                  const file = files.find((f) => f.id === parseInt(value));
                  setNewShortcut({
                    ...newShortcut,
                    file_id: parseInt(value),
                    file_name: file?.name || '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um arquivo" />
                </SelectTrigger>
                <SelectContent>
                  {files.map((file) => (
                    <SelectItem key={file.id} value={file.id.toString()}>
                      {file.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShortcutModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveShortcut}>Criar Atalho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
