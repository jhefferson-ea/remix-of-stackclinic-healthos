
# Plano: Corrigir Erro 404 - Instância WhatsApp Não Existe

## Problema Identificado

A Evolution API retorna **404 Not Found** porque a instância `stackclinic_16_260127132652` não existe mais. Quando você reiniciou o Docker/ngrok, as instâncias antigas foram perdidas.

## Causa Raiz

O banco de dados da sua clínica ainda tem o `evolution_instance_id` antigo salvo, mas essa instância não existe mais na Evolution API.

---

## Solução em 2 Partes

### Parte 1: Atualizar o Backend PHP

**Arquivo:** `backend/api/config/whatsapp.php`

**Mudança:** Antes de tentar conectar, verificar se a instância existe na Evolution API. Se não existir (404), limpar o banco e criar uma nova instância.

```text
Fluxo Atualizado:
+------------------+     +-------------------+     +------------------+
| POST /whatsapp   | --> | Verifica se       | --> | Instância existe |
| (Conectar)       |     | instância existe  |     | → Gera QR Code   |
+------------------+     +-------------------+     +------------------+
                               |
                               | 404 Not Found
                               v
                         +-------------------+
                         | Limpa instance_id |
                         | do banco e cria   |
                         | nova instância    |
                         +-------------------+
```

### Parte 2: Adicionar Método de Verificação no EvolutionService

**Arquivo:** `backend/api/services/EvolutionService.php`

**Mudança:** Adicionar método `instanceExists()` que verifica se a instância existe na Evolution API.

---

## Alterações Específicas

### 1. EvolutionService.php - Novo Método

Adicionar método para verificar se instância existe:

```php
/**
 * Verifica se a instância existe na Evolution API
 */
public function instanceExists() {
    if (!$this->instanceId) {
        return false;
    }
    
    $response = $this->makeRequest("/instance/connectionState/{$this->instanceId}", 'GET');
    
    // Se retornou null, a instância não existe (404)
    return $response !== null;
}
```

### 2. whatsapp.php - Verificação antes de conectar

No método POST, antes de tentar gerar QR, verificar se a instância existe:

```php
// Se tem instância salva, verificar se ainda existe na Evolution API
if ($clinica['evolution_instance_id']) {
    $exists = $evolution->instanceExists();
    
    if (!$exists) {
        // Instância não existe mais, limpar do banco
        $stmt = $db->prepare("
            UPDATE clinica 
            SET evolution_instance_id = NULL, 
                whatsapp_connected = 0, 
                whatsapp_phone = NULL
            WHERE id = :id
        ");
        $stmt->execute([':id' => $clinicaId]);
        
        // Atualizar variável local
        $clinica['evolution_instance_id'] = null;
    }
}

// Agora segue o fluxo normal de criar instância se não existir
```

---

## Detalhes Técnicos

### Arquivos a Modificar

1. **`backend/api/services/EvolutionService.php`**
   - Adicionar método `instanceExists()` (após linha 121)

2. **`backend/api/config/whatsapp.php`**  
   - Adicionar verificação de existência no método POST (após linha 84)

### Fluxo Corrigido

```text
Usuário clica "Conectar WhatsApp"
         ↓
Backend verifica: instância existe na Evolution API?
         ↓
    [NÃO - 404]              [SIM]
         ↓                      ↓
Limpa banco de dados     Tenta gerar QR Code
         ↓                      ↓
Cria nova instância      Retorna QR para usuário
         ↓
Configura webhook
         ↓
Retorna QR para usuário
```

---

## Após Implementação

1. Faça upload dos dois arquivos PHP atualizados para seu servidor
2. Tente conectar o WhatsApp novamente
3. O sistema vai detectar que a instância antiga não existe
4. Automaticamente criar uma nova instância
5. Retornar o QR Code para você escanear

---

## Benefício

Essa correção torna o sistema **resiliente a reinicializações** do Docker/ngrok. Sempre que a instância não existir mais, o sistema automaticamente cria uma nova.
