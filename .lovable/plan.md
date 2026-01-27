

# Plano: Correção do Modal de Detalhes e Visualização de Conversa

## Problemas Identificados

### Problema 1: Erro "Token não fornecido" no endpoint de conversa
O endpoint `/api/appointments/{id}/conversation` está chamando `Tenant::getClinicId()`, que por sua vez chama `Auth::requireAuth()`. Esta função **exige autenticação** e retorna erro "Token não fornecido" se não encontrar o header Authorization.

**Causa raiz**: O endpoint está funcionando corretamente do ponto de vista de código - o problema é que provavelmente o token **não está sendo enviado** na requisição, ou o endpoint não está recebendo o header corretamente.

Olhando o `api.ts`, o método `getAppointmentConversation` usa o método genérico `request<T>()` que **inclui o token** automaticamente na linha 34-36:
```typescript
const token = localStorage.getItem('stackclinic_token');
if (token) {
  defaultHeaders['Authorization'] = `Bearer ${token}`;
}
```

O problema pode ser que o token não está no localStorage naquele momento, ou há um problema no backend com a extração do header.

### Problema 2: Warning de Acessibilidade (aria-describedby)
O Radix UI Dialog exige um `DialogDescription` para acessibilidade. O `AppointmentDetailModal` tem `DialogHeader` e `DialogTitle`, mas **não tem `DialogDescription`**.

### Problema 3: Layout "bugado" do modal
Olhando o screenshot, o layout parece funcional mas pode ser melhorado:
- Os cards de Data e Horário estão muito apertados na grid
- O texto da data está muito longo ("Quarta-Feira, 28 De Janeiro De 2026")

---

## Arquivos a Modificar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| `src/components/agenda/AppointmentDetailModal.tsx` | Frontend | Adicionar DialogDescription, ajustar layout |
| `src/components/agenda/ConversationDrawer.tsx` | Frontend | Adicionar SheetDescription para resolver warning |
| `backend/api/appointments/conversation.php` | Backend | Adicionar logs para debug |

---

## Mudanças Técnicas

### 1. Adicionar DialogDescription no Modal de Detalhes

O warning do Radix UI pede um `Description` para acessibilidade. Vamos adicionar um `DialogDescription` visualmente oculto:

```tsx
import { DialogDescription } from '@/components/ui/dialog';

// No DialogHeader, após DialogTitle:
<DialogHeader>
  <DialogTitle>Detalhes do Agendamento</DialogTitle>
  <DialogDescription className="sr-only">
    Informações completas sobre o agendamento selecionado
  </DialogDescription>
</DialogHeader>
```

### 2. Adicionar SheetDescription no Drawer de Conversa

O mesmo problema ocorre no Sheet (que usa DialogPrimitive internamente):

```tsx
import { SheetDescription } from '@/components/ui/sheet';

// No SheetHeader, após SheetTitle:
<SheetHeader>
  <SheetTitle>Conversa do Agendamento</SheetTitle>
  <SheetDescription className="sr-only">
    Histórico de mensagens da conversa que originou este agendamento
  </SheetDescription>
</SheetHeader>
```

### 3. Melhorar Layout do Modal

Ajustar o grid para ser mais responsivo e formatar a data de forma mais compacta:

```tsx
// Mudar format da data para versão mais curta
const formattedDate = format(parseISO(appointment.date), "EEE, dd/MM/yyyy", { locale: ptBR });

// Ajustar grid para flex em mobile
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

### 4. Debug do Endpoint de Conversa

Adicionar logs no `conversation.php` para identificar se o token está chegando:

```php
// No início do arquivo, após cors.php
$debugLog = __DIR__ . '/../debug.log';
file_put_contents($debugLog, "\n=== CONVERSATION DEBUG ===\n", FILE_APPEND);
file_put_contents($debugLog, "URI: " . $_SERVER['REQUEST_URI'] . "\n", FILE_APPEND);
file_put_contents($debugLog, "Authorization present: " . (isset($_SERVER['HTTP_AUTHORIZATION']) ? 'SIM' : 'NAO') . "\n", FILE_APPEND);
```

---

## Resumo das Correções

| Problema | Solução |
|----------|---------|
| Warning aria-describedby | Adicionar `DialogDescription` e `SheetDescription` com `sr-only` |
| Layout apertado | Ajustar grid para `grid-cols-1 sm:grid-cols-2` |
| Data muito longa | Usar formato curto: "Qua, 28/01/2026" |
| Token não fornecido | Adicionar logs no backend para debug, verificar se token está no localStorage |

---

## Código das Correções

### AppointmentDetailModal.tsx - Alterações

1. Importar `DialogDescription`:
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // ADICIONAR
  DialogFooter,
} from '@/components/ui/dialog';
```

2. Adicionar description no header:
```tsx
<DialogHeader>
  <DialogTitle>Detalhes do Agendamento</DialogTitle>
  <DialogDescription className="sr-only">
    Informações completas sobre o agendamento selecionado
  </DialogDescription>
</DialogHeader>
```

3. Ajustar formato da data:
```tsx
const formattedDate = format(parseISO(appointment.date), "EEE, dd/MM/yyyy", { locale: ptBR });
```

4. Ajustar grid para responsivo:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

### ConversationDrawer.tsx - Alterações

1. Importar `SheetDescription`:
```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
```

2. Adicionar description:
```tsx
<SheetHeader>
  <SheetTitle>Conversa do Agendamento</SheetTitle>
  <SheetDescription className="sr-only">
    Histórico de mensagens da conversa que originou este agendamento
  </SheetDescription>
</SheetHeader>
```

---

## Teste de Validação

1. Abrir a agenda e clicar em um agendamento
2. Verificar que o modal abre sem warnings no console
3. Verificar que o layout está melhor (data mais curta, grid responsivo)
4. Clicar em "Ver Conversa"
5. Se ainda mostrar "Token não fornecido", verificar:
   - No DevTools → Application → Local Storage → `stackclinic_token`
   - No DevTools → Network → Request Headers → Authorization
6. Se o token existir mas não estiver chegando no backend, o problema está no .htaccess ou configuração do servidor

