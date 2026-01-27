import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Loader2, AlertTriangle, Bot, User, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  appointmentCreated?: {
    date: string;
    time: string;
    procedure?: string;
  };
}

export default function ChatSimulator() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionPhone, setSessionPhone] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.simulateChat({
        message: userMessage.content,
        session_phone: sessionPhone || undefined,
      });

      if (res.success && res.data) {
        // Salva session_phone para manter contexto
        if (res.data.session_phone && !sessionPhone) {
          setSessionPhone(res.data.session_phone);
        }

        // Se veio erro junto com a resposta, mostra no console para debug
        if (res.data.error) {
          console.error('AI Processing Error:', res.data.error);
        }

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: res.data.error 
            ? `${res.data.response}\n\n🔴 Debug: ${res.data.error}` 
            : res.data.response,
          timestamp: new Date(),
          appointmentCreated: res.data.appointment_created,
        };

        setMessages(prev => [...prev, aiMessage]);

        // Toast se agendamento foi criado
        if (res.data.appointment_created) {
          toast({
            title: '✅ Agendamento criado!',
            description: `${res.data.appointment_created.date} às ${res.data.appointment_created.time}`,
          });
        }
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Falha ao processar mensagem',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Chat simulator error:', error);
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = async () => {
    if (!sessionPhone) {
      setMessages([]);
      return;
    }

    try {
      await api.clearSimulatorSession(sessionPhone);
      setMessages([]);
      setSessionPhone(null);
      toast({
        title: 'Chat limpo',
        description: 'Sessão de simulação reiniciada',
      });
    } catch {
      // Limpa localmente mesmo se falhar no backend
      setMessages([]);
      setSessionPhone(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Simulador de Chat
                <Badge variant="outline" className="text-amber-600 border-amber-500">
                  MODO TESTE
                </Badge>
              </CardTitle>
              <CardDescription>
                Teste a IA como se fosse um cliente no WhatsApp
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Warning Banner */}
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-3 py-2 rounded-lg">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Este simulador usa a mesma lógica do WhatsApp real. Agendamentos criados aqui são reais!
          </span>
        </div>

        {/* Chat Area */}
        <div className="border rounded-lg bg-background">
          <ScrollArea className="h-[300px] p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Bot className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">
                  Envie uma mensagem para iniciar a conversa
                </p>
                <p className="text-xs mt-1">
                  Experimente: "Quero agendar uma consulta"
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        msg.role === 'user'
                          ? 'bg-green-600 text-white'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {msg.role === 'user' ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                        <span className="text-[10px] opacity-70">
                          {msg.role === 'user' ? 'Você (cliente)' : 'IA'}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      
                      {/* Appointment Created Indicator */}
                      {msg.appointmentCreated && (
                        <div className="mt-2 pt-2 border-t border-white/20 flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Agendado: {msg.appointmentCreated.date} às {msg.appointmentCreated.time}
                          </span>
                        </div>
                      )}
                      
                      <span className="text-[10px] opacity-50 block mt-1">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Digitando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite como se fosse um cliente..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Sugestões:</span>
          {[
            'Quero agendar uma consulta',
            'Quais horários disponíveis para amanhã?',
            'Quanto custa uma consulta?',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              disabled={isLoading}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
