

## Plano: Corrigir Reset de Instancia WhatsApp Presa

O endpoint `/instance/restart/{id}` nao existe nesta versao da Evolution API. Precisamos usar os endpoints corretos para "desbloquear" a instancia presa.

---

## Problema Identificado

```
URL: /instance/restart/stackclinic_16
HTTP Code: 404
Response: {"error":"Not Found","message":["Cannot GET /instance/restart/stackclinic_16"]}
```

A instancia `stackclinic_16` esta presa no estado `"connecting"` e retorna `{"count":0}` (sem QR disponivel).

---

## Solucao

Substituir o `restartInstance()` por **logoutInstance()** que usa o endpoint correto:

```
DELETE /instance/logout/{instanceName}
```

Este endpoint desconecta a sessao do WhatsApp sem deletar a instancia, permitindo que uma nova conexao (e novo QR code) seja gerada.

---

## Arquivos a Modificar

### 1. `backend/api/services/EvolutionService.php`

**Substituir `restartInstance()` por `logoutInstance()`:**

```php
public function logoutInstance() {
    $debugLogFile = __DIR__ . '/../debug.log';
    file_put_contents($debugLogFile, "LOGOUT_INSTANCE: instanceId=" . ($this->instanceId ?: 'NULL') . "\n", FILE_APPEND);
    
    if (!$this->instanceId) {
        return ['success' => false, 'error' => 'Instancia nao configurada'];
    }
    
    // DELETE /instance/logout/{instanceName} - desconecta sessao do WhatsApp
    $response = $this->makeRequest("/instance/logout/{$this->instanceId}", 'DELETE');
    file_put_contents($debugLogFile, "LOGOUT_INSTANCE: Response = " . json_encode($response) . "\n", FILE_APPEND);
    
    return ['success' => true];
}
```

**Atualizar `generateQRCode()` para usar logout ao inves de restart:**

```php
public function generateQRCode() {
    $debugLogFile = __DIR__ . '/../debug.log';
    file_put_contents($debugLogFile, "\nGENERATE_QRCODE: instanceId=" . ($this->instanceId ?: 'NULL') . "\n", FILE_APPEND);
    
    if (!$this->instanceId) {
        return ['success' => false, 'error' => 'Instancia nao configurada'];
    }
    
    // Primeira tentativa
    $response = $this->makeRequest("/instance/connect/{$this->instanceId}", 'GET');
    file_put_contents($debugLogFile, "GENERATE_QRCODE: Response = " . json_encode($response) . "\n", FILE_APPEND);
    
    // Se retornou count:0 (sem QR), faz logout e tenta novamente
    if ($response && isset($response['count']) && $response['count'] === 0) {
        file_put_contents($debugLogFile, "GENERATE_QRCODE: count=0 detectado, fazendo logout...\n", FILE_APPEND);
        
        // Faz logout para resetar a sessao
        $this->logoutInstance();
        
        // Aguarda 3 segundos para o logout processar
        sleep(3);
        
        // Tenta novamente gerar QR
        $response = $this->makeRequest("/instance/connect/{$this->instanceId}", 'GET');
        file_put_contents($debugLogFile, "GENERATE_QRCODE: Response apos logout = " . json_encode($response) . "\n", FILE_APPEND);
    }
    
    // Verifica se tem QR code na resposta
    if ($response && (isset($response['code']) || isset($response['base64']))) {
        $qrCode = $response['base64'] ?? $response['code'] ?? null;
        
        return [
            'success' => true,
            'qrcode' => $qrCode,
            'pairingCode' => $response['pairingCode'] ?? null,
            'count' => $response['count'] ?? null
        ];
    }
    
    return ['success' => false, 'error' => 'Falha ao gerar QR Code'];
}
```

---

## Fluxo Corrigido

```text
Usuario clica "Conectar WhatsApp"
           |
           v
+------------------------+
| GET /instance/connect/ |
+------------------------+
           |
           v
    +---------------+
    | count = 0 ?   |
    +-------+-------+
            |
     +------+------+
     | SIM         | NAO
     v             v
+---------------+   +-------------+
| DELETE        |   | Retorna QR  |
| /instance/    |   +-------------+
| logout/       |
+---------------+
     |
     v
+-------------+
| Aguarda 3s  |
+-------------+
     |
     v
+------------------------+
| GET /instance/connect/ |
| (nova tentativa)       |
+------------------------+
     |
     v
+-------------+
| Retorna QR  |
+-------------+
```

---

## Resumo de Mudancas

| Metodo Antigo | Metodo Novo | Endpoint |
|---------------|-------------|----------|
| `restartInstance()` | `logoutInstance()` | `DELETE /instance/logout/{id}` |

---

## Arquivos para Upload

| Arquivo Local | Destino no Servidor |
|--------------|---------------------|
| `backend/api/services/EvolutionService.php` | `public_html/api/services/EvolutionService.php` |

---

## Resultado Esperado

1. O log deve mostrar:
   - `count=0 detectado, fazendo logout...`
   - `LOGOUT_INSTANCE: Response = {"status":"success",...}`
   - `Response apos logout = {"code": "...", "pairingCode": "..."}`

2. O QR Code deve aparecer na interface

---

## Nota Tecnica

O endpoint `DELETE /instance/logout/{id}` ja esta implementado no metodo `disconnect()` existente. Estamos apenas criando uma versao separada `logoutInstance()` com logging detalhado para debug e uso no fluxo de retry do QR code.

