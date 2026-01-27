

# Plano: Correção de Ordenação, Timezone e Otimização do Banco

## Problemas Identificados

### 1. Mensagens em Ordem Errada no Drawer
**Diagnóstico**: O endpoint `conversation.php` ordena por `ORDER BY created_at ASC`, que deveria funcionar. Porém, o problema é que as mensagens estão sendo inseridas com timestamps errados devido a:
- O `simulate-chat.php` usa `NOW()` para ambas as mensagens (incoming e outgoing), que são inseridas no mesmo segundo
- Como `incoming` e `outgoing` têm o mesmo timestamp, a ordem fica indeterminada

**Solução**: Adicionar `ORDER BY id ASC` (que é sequencial e garantido) em vez de `created_at`.

### 2. IA Não Respeita Horário de Funcionamento
**Diagnóstico**: A função `checkAvailability()` (linhas 713-800) consulta corretamente `horario_funcionamento`:
```php
$stmt = $this->db->prepare("
    SELECT `open`, `close` FROM horario_funcionamento 
    WHERE clinica_id = :clinica_id AND day = :day_of_week AND active = 1
");
```

O problema é a comparação `$isToday && $startTime <= $now`:
```php
$now = time();  // Usa timestamp do SERVIDOR (que pode estar 3h adiantado)
$isToday = (date('Y-m-d') === $date);
while ($startTime < $endTime) {
    if ($isToday && $startTime <= $now) $isAvailable = false;  // PROBLEMA AQUI
}
```

O servidor está em UTC (3h adiantado em relação a Brasília). Se você está às 20h, o servidor acha que são 23h, e descarta todos os horários.

**Solução**: Configurar timezone do PHP para America/Sao_Paulo no início dos scripts.

### 3. Fuso Horário do Banco (3h adiantado)
**Diagnóstico**: O banco (MySQL/MariaDB) e o PHP estão usando UTC por padrão, enquanto você está no fuso de Brasília (UTC-3).

Quando o código faz `NOW()` ou `date('Y-m-d H:i:s')`, ele grava no horário do servidor (UTC), não no seu horário local.

**Solução**: 
1. Definir timezone no PHP: `date_default_timezone_set('America/Sao_Paulo')`
2. Definir timezone na conexão MySQL: `SET time_zone = '-03:00'`

### 4. Escalabilidade do Banco (1 linha por mensagem)
**Diagnóstico**: Sim, cada mensagem gera uma linha. Isso é o padrão da indústria (WhatsApp, Telegram, todos fazem assim).

**Por que é OK**:
- Índices já existem: `idx_wpp_msg_phone_date` em `(phone, created_at DESC)`
- Queries são filtradas por `clinica_id` + `phone`, muito rápidas
- 100 clínicas × 100 mensagens/dia × 365 dias = ~3.6M linhas/ano = trivial para MySQL

**Otimizações recomendadas**:
1. Adicionar política de arquivamento (mover mensagens > 1 ano para tabela `whatsapp_messages_archive`)
2. Adicionar índice composto para a query de conversa: `(clinica_id, phone, id)`
3. Para consultas do drawer, limitar a últimas 100 mensagens

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/config/Database.php` | Configurar timezone na conexão |
| `backend/api/appointments/conversation.php` | Ordenar por `id` em vez de `created_at` |
| `backend/api/services/OpenAIService.php` | Adicionar timezone no início |
| `backend/api/ai/simulate-chat.php` | Adicionar timezone no início |

---

## Mudanças Técnicas

### 1. Configurar Timezone na Conexão do Banco

**Arquivo**: `backend/api/config/Database.php`

```php
public function getConnection() {
    $this->conn = null;
    
    // Define timezone do PHP para Brasília
    date_default_timezone_set('America/Sao_Paulo');

    try {
        $this->conn = new PDO(
            "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
            $this->username,
            $this->password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        
        // Define timezone do MySQL para Brasília
        $this->conn->exec("SET time_zone = '-03:00'");
        
    } catch(PDOException $exception) {
        error_log("Connection error: " . $exception->getMessage());
        throw new Exception("Erro de conexão com o banco de dados");
    }

    return $this->conn;
}
```

### 2. Ordenar Mensagens por ID (Garantido Sequencial)

**Arquivo**: `backend/api/appointments/conversation.php`

Alterar de:
```php
ORDER BY created_at ASC
```

Para:
```php
ORDER BY id ASC
```

O `id` é auto-increment e garante a ordem de inserção, enquanto `created_at` pode ter colisões quando duas mensagens são inseridas no mesmo segundo.

### 3. Adicionar Timezone nos Scripts Principais

**Arquivos**: `backend/api/services/OpenAIService.php` e `backend/api/ai/simulate-chat.php`

Adicionar no início de cada arquivo (após os `require_once`):

```php
// Garante timezone de Brasília
date_default_timezone_set('America/Sao_Paulo');
```

---

## Sobre a Escalabilidade

A estrutura atual (1 mensagem = 1 linha) é a forma correta. Alternativas como agrupar mensagens em JSON seriam piores para:
- Busca por conteúdo
- Ordenação
- Paginação
- Índices

**Quando preocupar**: A partir de ~10M+ linhas, considerar particionamento por data ou arquivamento.

**Otimizações futuras (não urgentes)**:
1. Criar job de arquivamento mensal para mensagens antigas
2. Limitar query do drawer a 100 mensagens mais recentes
3. Adicionar índice `(clinica_id, phone, id)` para acelerar ainda mais

---

## Resumo das Correções

| Problema | Causa | Solução |
|----------|-------|---------|
| Mensagens embaralhadas | Mesmo `created_at` para incoming/outgoing | Ordenar por `id ASC` |
| IA ignora horário de funcionamento | Timezone do servidor = UTC | Configurar `America/Sao_Paulo` |
| Banco 3h adiantado | MySQL usando UTC por padrão | `SET time_zone = '-03:00'` na conexão |
| Escalabilidade | Preocupação prematura | Estrutura atual é correta; adicionar arquivamento futuro |

---

## Sequência de Validação

1. **Testar ordenação**: Abrir "Ver Conversa" e verificar se as mensagens estão na ordem correta
2. **Testar timezone**: Verificar no banco se `created_at` agora grava no horário de Brasília
3. **Testar IA + horário**: Configurar clínica para funcionar até 23:59 e testar agendamento às 21h
4. **Verificar disponibilidade**: A IA deve retornar horários disponíveis para o dia atual

