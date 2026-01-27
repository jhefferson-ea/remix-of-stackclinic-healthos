

# Plano: Corrigir Erro "Método não permitido" no Simulador de Chat

## Problema Identificado

O simulador de chat está retornando `{"success":false,"error":"Método não permitido"}` ao enviar mensagens POST.

**Análise:**
- O status HTTP é 200, mas a resposta contém erro
- O ngrok da Evolution API está recebendo requisições (indicando possível conflito de rotas)
- O endpoint `/api/ai/simulate-chat` está configurado corretamente no `index.php`

## Causa Raiz

Há um bug lógico no arquivo `simulate-chat.php`:

```php
// Linha 17-59: Bloco DELETE
if ($method === 'DELETE') {
    // ... código ...
    Response::success(['cleared' => true]);
    // FALTA: exit; aqui!
}

// Linha 62-64: Esta verificação é alcançada APÓS o bloco DELETE
if ($method !== 'POST') {
    Response::methodNotAllowed();  // <-- Problema!
}
```

O problema é a **estrutura condicional**:
1. Para requisições **DELETE**: O bloco executa e `Response::success()` tem `exit()`, então deveria parar
2. Para requisições **POST**: Pula o bloco DELETE e passa pela verificação - deveria funcionar

**Possível causa adicional:** O método DELETE pode estar falhando silenciosamente antes do `Response::success()`, fazendo o script continuar para a verificação `if ($method !== 'POST')`.

## Solução

### 1. Corrigir estrutura condicional no `simulate-chat.php`

Reorganizar a lógica para usar `if-elseif` explícito e adicionar `exit;` após blocos que chamam Response:

```php
$method = $_SERVER['REQUEST_METHOD'];

// DELETE: Limpar sessão
if ($method === 'DELETE') {
    // ... código existente ...
    Response::success(['cleared' => true]);
    exit;  // Garantia extra
}

// POST: Processar mensagem
if ($method === 'POST') {
    // ... código existente do POST ...
}

// Qualquer outro método
Response::methodNotAllowed();
```

### 2. Adicionar logs de debug temporários

Para identificar exatamente onde está falhando:

```php
error_log("simulate-chat.php - Method: " . $_SERVER['REQUEST_METHOD']);
error_log("simulate-chat.php - URI: " . $_SERVER['REQUEST_URI']);
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/ai/simulate-chat.php` | Corrigir estrutura condicional, adicionar exit explícito |

## Detalhes Técnicos

### Mudança na estrutura do arquivo:

**Antes:**
```php
if ($method === 'DELETE') {
    // código DELETE
    Response::success();
}

if ($method !== 'POST') {
    Response::methodNotAllowed();
}

// código POST
```

**Depois:**
```php
if ($method === 'DELETE') {
    // código DELETE
    Response::success();
    exit;
}

if ($method !== 'POST') {
    Response::methodNotAllowed();
    exit;
}

// código POST
```

## Teste de Validação

1. Acessar a página WhatsApp Config
2. Enviar uma mensagem no simulador (ex: "oi")
3. Verificar se a resposta da IA aparece sem erro
4. Testar o botão "Limpar" para verificar se DELETE funciona

