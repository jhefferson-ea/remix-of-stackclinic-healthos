

# Plano: Corrigir Bloqueio de Segurança do Ngrok

## Problema Identificado

O **ngrok grátis** exibe uma página de verificação de segurança para requisições que não incluem o header especial `ngrok-skip-browser-warning`. 

Quando o PHP faz requisições via cURL, ele pode estar recebendo essa página HTML ao invés do JSON esperado da Evolution API, causando erros intermitentes (404, 400).

---

## Solução

Adicionar o header `ngrok-skip-browser-warning` em todas as requisições feitas pelo `EvolutionService.php`.

---

## Alteração Necessária

**Arquivo:** `backend/api/services/EvolutionService.php`

**Local:** Método `makeRequest()` - linhas 378-385

**Código atual:**
```php
$headers = [
    'Content-Type: application/json',
    'Accept: application/json'
];

if ($this->apiKey) {
    $headers[] = 'apikey: ' . $this->apiKey;
}
```

**Código corrigido:**
```php
$headers = [
    'Content-Type: application/json',
    'Accept: application/json',
    'ngrok-skip-browser-warning: true'  // Bypass ngrok free tier warning page
];

if ($this->apiKey) {
    $headers[] = 'apikey: ' . $this->apiKey;
}
```

---

## Por que isso funciona

De acordo com a documentação do ngrok (e a própria imagem que você enviou), existem 3 formas de remover a página de aviso:

1. **Enviar header `ngrok-skip-browser-warning`** ✅ (nossa solução)
2. Usar User-Agent customizado
3. Fazer upgrade para conta paga

A opção 1 é a mais simples e não requer mudanças na conta do ngrok.

---

## Fluxo Corrigido

```text
                    SEM o header                    COM o header
                   +-------------+                 +-------------+
  PHP cURL         |  ngrok      |                 |  ngrok      |
  request    -->   |  retorna    |           -->   |  passa      |
                   |  HTML de    |                 |  direto     |
                   |  verificação|                 |  para API   |
                   +-------------+                 +-------------+
                         |                               |
                         v                               v
                   JSON decode                     JSON válido
                   FALHA                           da Evolution API
```

---

## Detalhes Técnicos

- **Arquivo:** `backend/api/services/EvolutionService.php`
- **Linha:** 378-381 (array de headers)
- **Mudança:** Adicionar `'ngrok-skip-browser-warning: true'` ao array

---

## Após Implementação

1. Faça upload do arquivo `EvolutionService.php` atualizado
2. Tente conectar o WhatsApp novamente
3. Todas as requisições agora devem bypassar a página de verificação do ngrok
4. Os erros intermitentes devem parar

---

## Benefício

Esta correção garante que **100% das requisições** ao ngrok recebam resposta JSON válida, eliminando os problemas de conexão causados pela página de verificação.

