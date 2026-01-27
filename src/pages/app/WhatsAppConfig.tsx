import { useState, useEffect } from 'react';
import { 
  MessageSquare, QrCode, Wifi, WifiOff, 
  Bot, Settings, RefreshCw, Loader2, Save, Phone
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import ChatSimulator from '@/components/whatsapp/ChatSimulator';

interface WhatsAppStatus {
  connected: boolean;
  phone?: string;
  instance_id?: string;
  state?: string;
  ai_name?: string;
  ai_tone?: string;
  system_prompt_custom?: string;
  pairingCode?: string;
  qrcode?: string;
  pending?: boolean;
  message?: string;
}

export default function WhatsAppConfig() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState('');
  const [waitingForQr, setWaitingForQr] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);
  
  // Config form
  const [aiName, setAiName] = useState('');
  const [aiTone, setAiTone] = useState('casual');
  const [customPrompt, setCustomPrompt] = useState('');
  
  const { toast } = useToast();
  
  useEffect(() => {
    loadStatus();
  }, []);
  
  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.getWhatsAppConfig();
      if (res.success && res.data) {
        setStatus(res.data);
        setAiName(res.data.ai_name || 'Atendente Virtual');
        setAiTone(res.data.ai_tone || 'casual');
        setCustomPrompt(res.data.system_prompt_custom || '');
      }
    } catch (error) {
      console.error('Error loading WhatsApp status:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleConnect = async (phone?: string) => {
    setConnecting(true);
    setQrCode(null);
    setPairingCode(null);
    setWaitingForQr(false);
    setPollAttempts(0);
    
    try {
      const res = await api.connectWhatsApp(phone ? { phone } : undefined);
      
      if (res.success && res.data) {
        if (res.data.connected) {
          toast({
            title: 'WhatsApp conectado!',
            description: `Conectado ao número ${res.data.phone}`,
          });
          loadStatus();
        } else if (res.data.qrcode || res.data.pairingCode) {
          if (res.data.qrcode) setQrCode(res.data.qrcode);
          if (res.data.pairingCode) setPairingCode(res.data.pairingCode);
          toast({
            title: 'Conexão iniciada',
            description: res.data.qrcode ? 'Escaneie o QR Code' : 'Use o código de pareamento',
          });
        } else if (res.data.pending) {
          setWaitingForQr(true);
          toast({
            title: 'Gerando QR...',
            description: res.data.message || 'A instância está iniciando. Aguarde alguns segundos.',
          });

          const pollInterval = setInterval(async () => {
            setPollAttempts((prev) => prev + 1);
            const statusRes = await api.getWhatsAppConfig(true);

            if (statusRes.success && statusRes.data?.connected) {
              clearInterval(pollInterval);
              setQrCode(null);
              setPairingCode(null);
              setWaitingForQr(false);
              loadStatus();
              toast({
                title: 'WhatsApp conectado!',
                description: 'Seu WhatsApp foi conectado com sucesso',
              });
              return;
            }

            if (statusRes.success && statusRes.data?.qrcode) {
              setQrCode(statusRes.data.qrcode);
              setPairingCode(statusRes.data.pairingCode || null);
              setWaitingForQr(false);
              clearInterval(pollInterval);
            } else if (statusRes.success && statusRes.data?.pairingCode) {
              setPairingCode(statusRes.data.pairingCode);
              setWaitingForQr(false);
              clearInterval(pollInterval);
            }
          }, 3000);

          setTimeout(() => {
            clearInterval(pollInterval);
            setWaitingForQr(false);
            toast({
              title: 'QR ainda não disponível',
              description: 'Se o QR não aparecer, tente o pareamento informando seu número (com DDD).',
              variant: 'destructive',
            });
          }, 120000);
        }
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Falha ao conectar WhatsApp',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };
  
  const handleDisconnect = async () => {
    try {
      const res = await api.disconnectWhatsApp();
      
      if (res.success) {
        toast({
          title: 'Desconectado',
          description: 'WhatsApp desconectado com sucesso',
        });
        loadStatus();
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao desconectar',
        variant: 'destructive',
      });
    }
  };
  
  const handleSaveConfig = async () => {
    setSaving(true);
    
    try {
      const res = await api.updateWhatsAppConfig({
        ai_name: aiName,
        ai_tone: aiTone,
        system_prompt_custom: customPrompt,
      });
      
      if (res.success) {
        toast({
          title: 'Salvo!',
          description: 'Configurações do bot atualizadas',
        });
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Falha ao salvar',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-muted-foreground">
            Configure o atendimento automatizado via WhatsApp
          </p>
        </div>
        <Button variant="outline" onClick={loadStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>
      
      {/* Chat Simulator - Temporary for Testing */}
      <ChatSimulator />
      
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                status?.connected ? 'bg-green-500/10' : 'bg-muted'
              }`}>
                {status?.connected ? (
                  <Wifi className="h-6 w-6 text-green-500" />
                ) : (
                  <WifiOff className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">Status da Conexão</CardTitle>
                <CardDescription>
                  {status?.connected 
                    ? `Conectado ao ${status.phone || 'WhatsApp'}`
                    : 'WhatsApp não conectado'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={status?.connected ? 'default' : 'secondary'}>
              {status?.connected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{status.phone}</span>
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                Desconectar
              </Button>
            </div>
          ) : qrCode || pairingCode || waitingForQr ? (
            <div className="flex flex-col items-center gap-4 py-4">
              {waitingForQr ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Aguardando QR Code... (tentativa {Math.max(1, pollAttempts)})</span>
                </div>
              ) : qrCode ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Escaneie o QR Code abaixo com seu WhatsApp
                  </p>
                  <div className="bg-white p-4 rounded-lg">
                    {/* Evolution API v2 retorna string QR, v1 retorna base64 */}
                    {qrCode.startsWith('data:') || qrCode.length > 500 ? (
                      <img 
                        src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} 
                        alt="QR Code WhatsApp" 
                        className="w-64 h-64"
                      />
                    ) : (
                      <QRCodeSVG 
                        value={qrCode} 
                        size={256}
                        level="M"
                      />
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  QR Code ainda não disponível. Você pode usar o <span className="font-medium">código de pareamento</span> informando seu número.
                </p>
              )}

              {pairingCode && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    Código de pareamento:
                  </p>
                  <code className="text-lg font-mono font-bold bg-muted px-3 py-1 rounded">
                    {pairingCode}
                  </code>
                </div>
              )}

              {!status?.connected && !qrCode && (
                <div className="w-full max-w-sm space-y-2">
                  <Label htmlFor="pairing-phone">Seu número (com DDD)</Label>
                  <Input
                    id="pairing-phone"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    placeholder="Ex: 11999998888"
                  />
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleConnect(pairingPhone)}
                    disabled={connecting || !pairingPhone.trim()}
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      'Gerar código de pareamento'
                    )}
                  </Button>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => handleConnect()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar novo QR Code
              </Button>
            </div>
          ) : (
            <Button onClick={() => handleConnect()} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Conectar WhatsApp
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
      
      {/* Bot Configuration */}
      <Tabs defaultValue="personality">
        <TabsList>
          <TabsTrigger value="personality">
            <Bot className="h-4 w-4 mr-2" />
            Personalidade
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Settings className="h-4 w-4 mr-2" />
            Regras Personalizadas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="personality" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Personalidade do Bot</CardTitle>
              <CardDescription>
                Configure como o assistente virtual se apresenta e interage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-name">Nome do Assistente</Label>
                  <Input
                    id="ai-name"
                    value={aiName}
                    onChange={(e) => setAiName(e.target.value)}
                    placeholder="Ex: Ana, Assistente Virtual"
                  />
                  <p className="text-xs text-muted-foreground">
                    Como o bot se apresentará aos pacientes
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ai-tone">Tom da Conversa</Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">
                        Formal - Profissional e respeitoso
                      </SelectItem>
                      <SelectItem value="casual">
                        Casual - Amigável e descontraído
                      </SelectItem>
                      <SelectItem value="empathetic">
                        Empático - Acolhedor e compreensivo
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="pt-4">
                <Button onClick={handleSaveConfig} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Regras Personalizadas</CardTitle>
              <CardDescription>
                Adicione instruções específicas para o comportamento do bot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-prompt">Instruções Adicionais</Label>
                <Textarea
                  id="custom-prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={`Exemplos de regras:
- Sempre pergunte o nome do paciente se for a primeira vez
- Ofereça desconto de 10% para primeiras consultas
- Não agende em cima da hora do almoço (12h-13h)
- Priorize encaixes para urgências
- Mencione que temos estacionamento gratuito`}
                  className="min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground">
                  Estas regras serão adicionadas ao contexto do bot
                </p>
              </div>
              
              <div className="pt-4">
                <Button onClick={handleSaveConfig} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Regras
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <MessageSquare className="h-8 w-8 text-primary shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold">Como funciona o atendimento automático</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• O bot responde mensagens automaticamente 24/7</li>
                <li>• Pacientes podem agendar consultas pelo WhatsApp</li>
                <li>• O sistema verifica disponibilidade em tempo real</li>
                <li>• Novos contatos são salvos automaticamente como leads</li>
                <li>• A qualquer momento o paciente pode pedir para falar com humano</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
