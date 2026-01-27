

# Plano: Corrigir Erro "Falha ao processar com IA" no Chat Simulator

## Problema Identificado

O simulador de chat está funcionando corretamente (status HTTP 200, retornando JSON válido), porém o `OpenAIService` está falhando ao chamar a API da OpenAI. 

O erro "Falha ao processar com IA" ocorre quando o método `callOpenAI()` retorna `null` (linha 49-53 do arquivo).

**Possíveis causas:**
- Chave de API da OpenAI inválida, expirada ou com limite de uso esgotado
- Erro HTTP da OpenAI (401 Unauthorized, 429 Rate Limit, 500 Server Error)
- Timeout ou erro de conexão cURL
- O código não retorna detalhes do erro, apenas loga no servidor

---

## Solução

### 1. Melhorar logging de erros no OpenAIService

Modificar o método `callOpenAI()` para:
- Retornar detalhes do erro em vez de apenas `null`
- Logar a resposta da OpenAI em caso de falha
- Propagar a mensagem de erro para o frontend

### 2. Propagar erro detalhado no processMessage

Em vez de retornar apenas "Falha ao processar com IA", retornar:
- O código HTTP da resposta
- A mensagem de erro da OpenAI (ex: "API key invalid")
- Detalhes do erro cURL se houver

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/services/OpenAIService.php` | Melhorar tratamento de erros e logging |

---

## Detalhes Técnicos

### Mudança no método `callOpenAI()`:

**Antes:**
```php
if ($httpCode !== 200) {
    error_log("OpenAI HTTP Error {$httpCode}: " . $response);
    return null;  // <-- Perde informação do erro
}
```

**Depois:**
```php
if ($httpCode !== 200) {
    error_log("OpenAI HTTP Error {$httpCode}: " . $response);
    $decoded = json_decode($response, true);
    return [
        'error' => true,
        'http_code' => $httpCode,
        'message' => $decoded['error']['message'] ?? $response
    ];
}
```

### Mudança no método `processMessage()`:

**Antes:**
```php
if (!$response) {
    return ['success' => false, 'error' => 'Falha ao processar com IA'];
}
```

**Depois:**
```php
if (!$response || isset($response['error'])) {
    $errorMsg = $response['message'] ?? 'Falha ao conectar com a IA';
    error_log("OpenAI Error Details: " . json_encode($response));
    return [
        'success' => false,
        'error' => $errorMsg,
        'debug' => $response
    ];
}
```

---

## Diagnóstico Esperado

Após aplicar esta correção, o erro específico aparecerá no chat, por exemplo:
- `"Incorrect API key provided"` → Chave inválida
- `"Rate limit exceeded"` → Limite de uso esgotado
- `"Connection timeout"` → Problema de rede

Isso permitirá identificar a causa raiz e corrigi-la (provavelmente renovar ou verificar a chave da OpenAI).

---

## Teste de Validação

1. Acessar a página WhatsApp Config
2. Enviar uma mensagem no simulador (ex: "oi")
3. O erro detalhado da OpenAI deve aparecer no chat
4. Verificar se é problema de chave, quota ou conexão
5. Se for chave, atualizar no OpenAIService.php ou configurar variável de ambiente

