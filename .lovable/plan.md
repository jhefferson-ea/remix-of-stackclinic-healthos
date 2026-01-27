

# Plano: Corrigir Salvamento de Mensagens + Token de Autenticação

## Problemas Identificados

### Problema 1: Mensagens não salvas na tabela `whatsapp_messages`

**Diagnóstico**: Olhando o print da tabela:
- Só existem mensagens `direction = 'incoming'` (do usuário)
- **Faltam as respostas da IA** (`direction = 'outgoing'`)

**Causa raiz**: O arquivo `simulate-chat.php` (simulador de chat) **NÃO está salvando mensagens** na tabela `whatsapp_messages`. Ele apenas armazena no JSON da sessão (`whatsapp_sessions.context`).

O salvamento de mensagens (`INSERT INTO whatsapp_messages`) só existe no `webhook/whatsapp.php` (para WhatsApp real), mas o simulador não faz isso.

**Fluxo atual (ERRADO)**:
```text
simulate-chat.php:
  ✓ Salva contexto em whatsapp_sessions.context (JSON)
  ✗ NÃO salva em whatsapp_messages (tabela)
```

### Problema 2: Token de autenticação não chega ao backend

**Diagnóstico**: Mesmo enviando `Authorization` e `X-Auth-Token`, o backend retorna "Token não fornecido".

**Causa raiz**: O servidor (Hostinger LiteSpeed) pode estar removendo os headers. O fallback do X-Auth-Token existe, mas precisa ser garantido que:
1. O header está sendo listado corretamente no CORS
2. O `.htaccess` está passando o header para o PHP

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/ai/simulate-chat.php` | Salvar mensagens incoming/outgoing na tabela `whatsapp_messages` |
| `backend/api/.htaccess` | Adicionar regra para passar X-Auth-Token |
| `backend/api/helpers/Auth.php` | Melhorar debug do X-Auth-Token |

---

## Mudanças Técnicas

### 1. Salvar Mensagens no Simulador (`simulate-chat.php`)

Adicionar dois INSERTs após processar a mensagem:

```php
// =========================================
// 10. SALVA MENSAGENS na tabela whatsapp_messages
// =========================================

// Salva mensagem INCOMING (do usuário)
$stmt = $db->prepare("
    INSERT INTO whatsapp_messages 
    (clinica_id, paciente_id, phone, direction, message, message_type, ai_processed, created_at)
    VALUES (:clinica_id, :paciente_id, :phone, 'incoming', :message, 'text', 1, NOW())
");
$stmt->execute([
    ':clinica_id' => $clinicaId,
    ':paciente_id' => $paciente ? $paciente['id'] : null,
    ':phone' => $sessionPhone,
    ':message' => $message
]);

// Salva mensagem OUTGOING (da IA)
$stmt = $db->prepare("
    INSERT INTO whatsapp_messages 
    (clinica_id, paciente_id, phone, direction, message, message_type, ai_processed, function_calls, tokens_used, created_at)
    VALUES (:clinica_id, :paciente_id, :phone, 'outgoing', :message, 'text', 1, :function_calls, :tokens_used, NOW())
");
$stmt->execute([
    ':clinica_id' => $clinicaId,
    ':paciente_id' => $paciente ? $paciente['id'] : null,
    ':phone' => $sessionPhone,
    ':message' => $responseText,
    ':function_calls' => json_encode($result['function_calls'] ?? null),
    ':tokens_used' => $result['tokens_used'] ?? 0
]);
```

### 2. Garantir Header X-Auth-Token no .htaccess

Adicionar regra explícita para o X-Auth-Token:

```apache
# Pass X-Auth-Token header to PHP (fallback para Authorization)
SetEnvIfNoCase X-Auth-Token "(.+)" HTTP_X_AUTH_TOKEN=$1
RewriteCond %{HTTP:X-Auth-Token} .
RewriteRule .* - [E=HTTP_X_AUTH_TOKEN:%{HTTP:X-Auth-Token}]
```

### 3. Melhorar Debug no Auth.php

Mover o fallback do X-Auth-Token para **antes** do retorno null, e adicionar mais logs:

```php
// 5. FALLBACK: X-Auth-Token ANTES de retornar null
$xAuthToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? null;

// Também tenta via getallheaders (case-insensitive)
if (!$xAuthToken && function_exists('getallheaders')) {
    $headers = getallheaders();
    $debugLog[] = "--- Buscando X-Auth-Token em getallheaders ---";
    foreach ($headers as $key => $value) {
        $keyLower = strtolower($key);
        if ($keyLower === 'x-auth-token') {
            $xAuthToken = $value;
            $debugLog[] = "FOUND X-Auth-Token via getallheaders!";
            break;
        }
    }
}

if ($xAuthToken) {
    file_put_contents($logFile, "TOKEN VIA X-Auth-Token: SIM (len=" . strlen($xAuthToken) . ")\n\n", FILE_APPEND);
    return $xAuthToken;
}
```

---

## Diagrama do Fluxo Corrigido

```text
SIMULADOR (frontend)
    │
    ▼ POST /api/ai/simulate-chat (com Authorization e X-Auth-Token)
    │
backend/api/ai/simulate-chat.php
    │
    ├── 1. Autentica via Tenant::getClinicId()
    ├── 2. Processa mensagem com OpenAI
    ├── 3. Atualiza whatsapp_sessions (contexto)
    │
    ├── 4. [NOVO] INSERT whatsapp_messages (incoming)  ← mensagem do usuário
    └── 5. [NOVO] INSERT whatsapp_messages (outgoing)  ← resposta da IA
    
Agora ao clicar "Ver Conversa":
    │
    ▼ GET /api/appointments/{id}/conversation
    │
    └── SELECT FROM whatsapp_messages WHERE phone = session_phone
        └── Retorna TODAS as mensagens (incoming + outgoing)
```

---

## Sequência de Validação

1. **Após implementação**: Iniciar nova conversa no simulador
2. **Verificar no banco**: `SELECT * FROM whatsapp_messages ORDER BY id DESC LIMIT 10`
   - Deve ter mensagens `incoming` E `outgoing`
3. **Agendar pelo simulador**: Seguir fluxo completo até confirmar
4. **Verificar agendamento**: Conferir se `session_phone` foi preenchido em `agendamentos`
5. **Testar "Ver Conversa"**: Clicar no agendamento → Ver Conversa
   - Deve exibir o histórico completo

---

## Sobre a Tabela `whatsapp_messages`

A conversa fica gravada em:
- **Tabela**: `whatsapp_messages`
- **Campos principais**:
  - `clinica_id`: ID da clínica
  - `phone`: Identificador da sessão (ex: `S16_lk9z3f1a`)
  - `direction`: `'incoming'` (usuário) ou `'outgoing'` (IA)
  - `message`: Texto da mensagem
  - `created_at`: Data/hora

O vínculo com agendamento:
- **Tabela**: `agendamentos`
- **Campo**: `session_phone` → Link para `whatsapp_messages.phone`

---

## Resumo

| O que estava errado | O que será corrigido |
|---------------------|---------------------|
| Simulador não salva em `whatsapp_messages` | Adicionar 2 INSERTs (incoming + outgoing) |
| X-Auth-Token pode não passar pelo .htaccess | Adicionar regra SetEnvIfNoCase |
| "Ver Conversa" não mostra nada | Com mensagens salvas, vai funcionar |

