import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Calendar,
  DollarSign,
  FileText,
  Image,
  Mic,
  AlertTriangle,
  Clock,
  Download,
  StopCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  api,
  type PatientDetail as PatientDetailType,
  type TimelineEvent,
  type Anamnesis,
  type GalleryImage,
} from '@/services/api';

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<PatientDetailType | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionSession, setTranscriptionSession] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadPatientData(parseInt(id));
    }
  }, [id]);

  async function loadPatientData(patientId: number) {
    setIsLoading(true);
    const [patientRes, timelineRes, anamnesisRes, galleryRes] = await Promise.all([
      api.getPatientDetail(patientId),
      api.getPatientTimeline(patientId),
      api.getPatientAnamnesis(patientId),
      api.getPatientGallery(patientId),
    ]);

    if (patientRes.success && patientRes.data) setPatient(patientRes.data);
    if (timelineRes.success && timelineRes.data) setTimeline(timelineRes.data);
    if (anamnesisRes.success && anamnesisRes.data) setAnamnesis(anamnesisRes.data);
    if (galleryRes.success && galleryRes.data) setGallery(galleryRes.data);

    setIsLoading(false);
  }

  const handleStartRecording = async () => {
    if (!id) return;
    const res = await api.startTranscription(parseInt(id));
    if (res.success && res.data) {
      setTranscriptionSession(res.data.session_id);
      setIsRecording(true);
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleGenerateSummary = async () => {
    if (!id || !transcriptionSession) return;
    const res = await api.generateAiSummary(parseInt(id), transcriptionSession);
    if (res.success && res.data) {
      setAiSummary(res.data.summary);
    }
  };

  const handleGenerateDocument = async (type: 'atestado' | 'receita') => {
    if (!id) return;
    const res = await api.generateDocument(parseInt(id), type, {
      content: 'Conteúdo do documento',
    });
    if (res.success && res.data) {
      window.open(res.data.pdf_url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 rounded-xl bg-muted" />
        <div className="h-96 rounded-xl bg-muted" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground">Paciente não encontrado</p>
        <Link to="/app/pacientes">
          <Button variant="link" className="mt-2">
            Voltar para lista
          </Button>
        </Link>
      </div>
    );
  }

  const timelineIcons = {
    appointment: Calendar,
    payment: DollarSign,
    file: FileText,
    note: FileText,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <Link to="/app/pacientes" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Link>

      {/* Patient Header */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {patient.avatar ? (
              <img src={patient.avatar} alt={patient.name || 'Paciente'} className="h-full w-full rounded-full object-cover" />
            ) : (
              (patient.name?.charAt(0) || 'P').toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{patient.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {patient.phone}
              </span>
              {patient.convenio && (
                <span className="inline-flex items-center rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">
                  {patient.convenio}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="icon">
              <Phone className="h-4 w-4" />
            </Button>
            <Button className="gradient-primary">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chamar no Zap
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
          <TabsTrigger value="scribe">IA Scribe</TabsTrigger>
          <TabsTrigger value="galeria">Galeria</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="text-lg font-semibold mb-4">Histórico do Paciente</h3>
          {timeline.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
          ) : (
            <div className="relative space-y-6 pl-8">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
              {timeline.map((event) => {
                const Icon = timelineIcons[event.type] || FileText;
                return (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-5 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-3 w-3 text-primary" />
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{event.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {event.date}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Anamnese Tab */}
        <TabsContent value="anamnese" className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="text-lg font-semibold mb-4">Anamnese Digital</h3>
          
          {/* Alerts */}
          {anamnesis?.alerts && anamnesis.alerts.length > 0 && (
            <div className="mb-6 space-y-2">
              {anamnesis.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg p-3 border',
                    alert.severity === 'high'
                      ? 'bg-destructive/10 border-destructive/30 text-destructive'
                      : 'bg-warning/10 border-warning/30 text-warning'
                  )}
                >
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold">{alert.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Questions */}
          <div className="space-y-4">
            {anamnesis?.questions.map((q) => (
              <div key={q.id} className="border-b border-border pb-4 last:border-0">
                <p className="text-sm font-medium text-muted-foreground">{q.question}</p>
                <p className="mt-1 text-foreground">{q.answer}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* IA Scribe Tab */}
        <TabsContent value="scribe" className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="text-lg font-semibold mb-4">IA Scribe - Transcrição</h3>
          
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className={cn(
              'h-24 w-24 rounded-full flex items-center justify-center transition-all',
              isRecording
                ? 'bg-destructive/10 animate-pulse'
                : 'bg-primary/10'
            )}>
              <Mic className={cn(
                'h-10 w-10',
                isRecording ? 'text-destructive' : 'text-primary'
              )} />
            </div>

            <div className="flex gap-3">
              {!isRecording ? (
                <Button onClick={handleStartRecording}>
                  <Mic className="h-4 w-4 mr-2" />
                  Ouvir Consulta
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleStopRecording}>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Parar Gravação
                </Button>
              )}
              
              {transcriptionSession && !isRecording && (
                <Button variant="secondary" onClick={handleGenerateSummary}>
                  Gerar Resumo IA
                </Button>
              )}
            </div>

            {aiSummary && (
              <div className="w-full mt-6 rounded-lg bg-muted/50 p-4">
                <h4 className="font-semibold mb-2">Resumo da Consulta</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiSummary}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="galeria" className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="text-lg font-semibold mb-4">Galeria - Antes e Depois</h3>
          {gallery.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <Image className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma imagem cadastrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gallery.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img
                    src={img.url}
                    alt={img.description || 'Imagem'}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      img.type === 'before' ? 'bg-warning text-warning-foreground' : 'bg-success text-success-foreground'
                    )}>
                      {img.type === 'before' ? 'Antes' : 'Depois'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documentos" className="bg-card rounded-xl border border-border p-6 shadow-card">
          <h3 className="text-lg font-semibold mb-4">Documentos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleGenerateDocument('atestado')}
              className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Atestado Médico</p>
                <p className="text-sm text-muted-foreground">Gerar com assinatura digital</p>
              </div>
              <Download className="h-5 w-5 text-muted-foreground ml-auto" />
            </button>

            <button
              onClick={() => handleGenerateDocument('receita')}
              className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Receituário</p>
                <p className="text-sm text-muted-foreground">Gerar com assinatura digital</p>
              </div>
              <Download className="h-5 w-5 text-muted-foreground ml-auto" />
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
