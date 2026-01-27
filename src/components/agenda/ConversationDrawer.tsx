import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Loader2, User, Bot, MessageSquareOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Message {
  direction: 'incoming' | 'outgoing';
  message: string;
  created_at: string;
}

interface ConversationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: number;
}

export function ConversationDrawer({ open, onOpenChange, appointmentId }: ConversationDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && appointmentId) {
      loadConversation();
    }
  }, [open, appointmentId]);

  const loadConversation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAppointmentConversation(appointmentId);
      if (res.success && res.data) {
        const msgs = (res.data.messages || []).map(m => ({
          ...m,
          direction: m.direction as 'incoming' | 'outgoing'
        }));
        setMessages(msgs);
        if (!res.data.has_conversation) {
          setError(res.data.message || 'Este agendamento não possui conversa registrada.');
        }
      } else {
        setError(res.error || 'Erro ao carregar conversa');
      }
    } catch {
      setError('Erro ao carregar conversa');
    }
    setIsLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle>Conversa do Agendamento</SheetTitle>
          <SheetDescription className="sr-only">
            Histórico de mensagens da conversa que originou este agendamento
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquareOff className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex gap-2',
                    msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.direction === 'incoming' && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                      msg.direction === 'outgoing'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      msg.direction === 'outgoing' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    )}>
                      {format(new Date(msg.created_at), 'HH:mm')}
                    </p>
                  </div>
                  {msg.direction === 'outgoing' && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
