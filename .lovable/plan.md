
# Plano: Coleta de Telefone + Validação de Paciente + Visualização de Conversa

## Resumo do que será implementado

1. **IA pedir telefone do paciente** antes de confirmar agendamento
2. **Validar se paciente já existe** pelo telefone no banco de dados
3. **Associar agendamento a paciente existente** se encontrado
4. **Mostrar botão "Ver conversa"** no modal de detalhes do agendamento
5. **Criar modal/drawer** para exibir o histórico da conversa

---

## Arquitetura Atual (Diagnóstico)

### Fluxo de Dados Atual
```text
collected_data = {
    procedure: null,
    date: null,
    time: null,
    patient_name: null,
    patient_phone: null  // <-- Existe mas NÃO é pedido pela IA
}
```

### Problemas Identificados
1. O `patient_phone` existe no estado mas a IA **não o pede** (não está no prompt)
2. O `createAppointment` aceita telefone mas é **opcional** (linha 529 do OpenAIService)
3. Não há validação de paciente existente antes de criar um novo
4. Não há vínculo entre `agendamentos` e `whatsapp_messages` (falta coluna para associar)
5. O modal `AppointmentDetailModal` não tem botão para ver conversa

---

## Mudanças Planejadas

### Arquivos a Modificar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `backend/api/services/OpenAIService.php` | Backend | Adicionar passo "phone" no fluxo, validar paciente existente |
| `backend/api/ai/simulate-chat.php` | Backend | Passar session_phone para o service |
| `backend/database-update-v7.sql` | SQL | Adicionar coluna `session_phone` na tabela `agendamentos` |
| `backend/api/appointments/conversation.php` | Backend (novo) | Endpoint para buscar mensagens de um agendamento |
| `src/components/agenda/AppointmentDetailModal.tsx` | Frontend | Adicionar botão "Ver conversa" |
| `src/components/agenda/ConversationDrawer.tsx` | Frontend (novo) | Componente para exibir histórico |
| `src/services/api.ts` | Frontend | Adicionar método `getAppointmentConversation` |

---

## Detalhes Técnicos

### 1. Adicionar Passo "phone" no Fluxo da IA

**Arquivo:** `backend/api/services/OpenAIService.php`

Atualizar a função `determineCurrentStep()` para incluir telefone:

```php
public function determineCurrentStep($collectedData) {
    if (!empty($collectedData['patient_name']) && 
        !empty($collectedData['patient_phone']) &&  // NOVO
        !empty($collectedData['date']) && 
        !empty($collectedData['time']) && 
        !empty($collectedData['procedure'])) {
        return 'confirm';
    }
    if (!empty($collectedData['patient_name'])) {
        return 'phone';  // NOVO PASSO
    }
    if (!empty($collectedData['time'])) {
        return 'name';
    }
    // ... resto igual
}
```

Atualizar `getNextStepInstruction()`:

```php
private function getNextStepInstruction($collectedData) {
    // ... passos anteriores ...
    if (empty($collectedData['patient_name'])) {
        return "Pergunte o nome completo do paciente.";
    }
    if (empty($collectedData['patient_phone'])) {
        return "Pergunte o número de telefone para contato (com DDD).";
    }
    return "TODOS OS DADOS COLETADOS! Use createAppointment...";
}
```

Atualizar o prompt para exibir status do telefone:

```php
$phoneStatus = $collectedData['patient_phone'] 
    ? "✅ {$collectedData['patient_phone']}" 
    : '❌ NÃO INFORMADO';
```

### 2. Validar Paciente Existente pelo Telefone

**Arquivo:** `backend/api/services/OpenAIService.php` (função `createAppointment`)

```php
private function createAppointment($date, $time, $procedureName, $patientName, $patientPhone, $clinicaId, $sessionPhone = null) {
    // ... validações ...
    
    // NOVO: Busca paciente existente pelo telefone
    $existingPatient = null;
    if ($patientPhone) {
        $stmt = $this->db->prepare("
            SELECT id, name, phone FROM pacientes 
            WHERE clinica_id = :clinica_id AND phone = :phone
            LIMIT 1
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':phone' => $patientPhone]);
        $existingPatient = $stmt->fetch();
    }
    
    if ($existingPatient) {
        // Usa paciente existente
        $this->paciente = $existingPatient;
        error_log("Paciente EXISTENTE encontrado: ID {$existingPatient['id']}");
    } elseif (!$this->paciente) {
        // Cria novo paciente (código atual)
        // ...
    }
    
    // Cria agendamento COM session_phone para vincular conversa
    $stmt = $this->db->prepare("
        INSERT INTO agendamentos (..., session_phone)
        VALUES (..., :session_phone)
    ");
}
```

### 3. Adicionar Coluna na Tabela agendamentos

**Novo arquivo:** `backend/database-update-v7.sql`

```sql
-- Vincula agendamento à sessão de conversa WhatsApp
ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS session_phone VARCHAR(20) NULL 
    COMMENT 'Telefone/ID da sessão WhatsApp que originou o agendamento'
    AFTER notes;

-- Índice para buscar agendamentos por sessão
CREATE INDEX IF NOT EXISTS idx_agendamento_session 
ON agendamentos(session_phone);
```

### 4. Endpoint para Buscar Conversa do Agendamento

**Novo arquivo:** `backend/api/appointments/conversation.php`

```php
<?php
// GET /api/appointments/{id}/conversation
// Retorna mensagens da sessão que originou o agendamento

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$clinicaId = Tenant::getClinicId();

// Extrai ID do agendamento da URL
preg_match('/\/appointments\/(\d+)\/conversation/', $_SERVER['REQUEST_URI'], $matches);
$appointmentId = $matches[1] ?? null;

if (!$appointmentId) {
    Response::badRequest('ID do agendamento não informado');
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Busca session_phone do agendamento
    $stmt = $db->prepare("
        SELECT session_phone FROM agendamentos 
        WHERE id = :id AND clinica_id = :clinica_id
    ");
    $stmt->execute([':id' => $appointmentId, ':clinica_id' => $clinicaId]);
    $appointment = $stmt->fetch();
    
    if (!$appointment || !$appointment['session_phone']) {
        Response::success([
            'messages' => [],
            'message' => 'Este agendamento não possui conversa registrada'
        ]);
        exit;
    }
    
    // Busca mensagens da sessão
    $stmt = $db->prepare("
        SELECT direction, message, created_at 
        FROM whatsapp_messages 
        WHERE clinica_id = :clinica_id AND phone = :phone
        ORDER BY created_at ASC
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId, 
        ':phone' => $appointment['session_phone']
    ]);
    $messages = $stmt->fetchAll();
    
    Response::success(['messages' => $messages]);
    
} catch (Exception $e) {
    Response::serverError('Erro ao buscar conversa');
}
```

### 5. Atualizar Modal de Detalhes do Agendamento

**Arquivo:** `src/components/agenda/AppointmentDetailModal.tsx`

Adicionar botão "Ver Conversa" e estado para o drawer:

```tsx
import { MessageSquare } from 'lucide-react';
import { ConversationDrawer } from './ConversationDrawer';

// Dentro do componente:
const [showConversation, setShowConversation] = useState(false);

// No JSX, adicionar botão antes do "Cancelar Agendamento":
<Button
  variant="outline"
  onClick={() => setShowConversation(true)}
  className="flex-1"
>
  <MessageSquare className="h-4 w-4 mr-2" />
  Ver Conversa
</Button>

// E o drawer:
<ConversationDrawer
  open={showConversation}
  onOpenChange={setShowConversation}
  appointmentId={appointment.id}
/>
```

### 6. Criar Componente ConversationDrawer

**Novo arquivo:** `src/components/agenda/ConversationDrawer.tsx`

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { Loader2, User, Bot } from 'lucide-react';
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
    const res = await api.getAppointmentConversation(appointmentId);
    if (res.success && res.data) {
      setMessages(res.data.messages || []);
      if (res.data.messages.length === 0) {
        setError('Este agendamento não possui conversa registrada.');
      }
    } else {
      setError(res.error || 'Erro ao carregar conversa');
    }
    setIsLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle>Conversa do Agendamento</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <p className="text-center text-muted-foreground py-8">{error}</p>
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
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
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
                    <p>{msg.message}</p>
                    <p className="text-[10px] opacity-60 mt-1">
                      {format(new Date(msg.created_at), 'HH:mm')}
                    </p>
                  </div>
                  {msg.direction === 'outgoing' && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
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
```

### 7. Adicionar Método na API do Frontend

**Arquivo:** `src/services/api.ts`

```typescript
async getAppointmentConversation(appointmentId: number) {
  return this.request<{ 
    messages: Array<{ direction: string; message: string; created_at: string }> 
  }>(`/appointments/${appointmentId}/conversation`);
}
```

---

## Fluxo de Conversa Atualizado

```text
Cliente: "oi"
→ IA: "Olá! Como posso ajudar?"

Cliente: "quero marcar consulta"
→ collected_data = { procedure: "Consulta" }
→ IA: "Para qual data prefere?"

Cliente: "amanhã 10h"
→ collected_data = { procedure: "Consulta", date: "2026-01-28", time: "10:00" }
→ IA: "Para finalizar, qual seu nome completo?"

Cliente: "João Silva"
→ collected_data = { ..., patient_name: "João Silva" }
→ IA: "E qual seu telefone para contato (com DDD)?"  <-- NOVO

Cliente: "11999887766"
→ collected_data = { ..., patient_phone: "11999887766" }
→ Backend verifica: SELECT * FROM pacientes WHERE phone = '11999887766'
→ Se encontrar: usa paciente existente
→ Se não: cria novo paciente
→ Cria agendamento com session_phone vinculado
→ IA: "Pronto! Consulta agendada para 28/01 às 10:00 para João Silva."
```

---

## Resumo das Mudanças

| Mudança | Impacto |
|---------|---------|
| Novo passo "phone" no fluxo | IA pede telefone antes de confirmar |
| Validação de paciente existente | Evita duplicatas, associa corretamente |
| Coluna `session_phone` em agendamentos | Vincula agendamento à conversa |
| Endpoint `/appointments/{id}/conversation` | API para buscar mensagens |
| Botão "Ver Conversa" no modal | UX para profissional ver histórico |
| Componente ConversationDrawer | Exibe mensagens em formato chat |

---

## Ordem de Implementação

1. Criar `backend/database-update-v7.sql` (migração)
2. Atualizar `OpenAIService.php` (fluxo + validação)
3. Atualizar `simulate-chat.php` (passar session_phone)
4. Criar `appointments/conversation.php` (endpoint)
5. Atualizar `api.ts` (método frontend)
6. Criar `ConversationDrawer.tsx` (componente)
7. Atualizar `AppointmentDetailModal.tsx` (botão + drawer)

---

## Testes de Validação

1. Iniciar conversa no simulador
2. Passar pelo fluxo: procedimento → data → horário → nome → **telefone**
3. Verificar se agendamento foi criado com `session_phone`
4. Na agenda, clicar no agendamento
5. Clicar em "Ver Conversa"
6. Verificar se o histórico da conversa aparece corretamente
7. Testar com telefone de paciente já existente (deve associar, não criar novo)
