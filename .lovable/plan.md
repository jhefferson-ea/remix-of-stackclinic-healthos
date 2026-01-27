
# Plano: Corrigir Nomes de Colunas nas Queries SQL do OpenAIService

## Problema Identificado

O erro `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'day_of_week'` ocorre porque as queries SQL no `OpenAIService.php` usam nomes de colunas incorretos que não correspondem ao schema real do banco de dados.

---

## Análise das Diferenças

### Tabela `horario_funcionamento`
| Código atual (errado) | Schema real do banco |
|-----------------------|---------------------|
| `day_of_week` | `day` |
| `open_time` | `open` |
| `close_time` | `close` |

### Tabela `bloqueios_agenda`
| Código atual | Schema real |
|--------------|-------------|
| `day_of_week` ✅ | `day_of_week` (se tabela foi criada via v2.sql) |
| `clinica_id` ✅ | `clinica_id` (adicionado via v4.sql) |

---

## Correções Necessárias

### Arquivo: `backend/api/services/OpenAIService.php`

#### 1. Método `checkAvailability()` - Linhas 327-334

**Código atual:**
```php
$stmt = $this->db->prepare("
    SELECT open_time, close_time 
    FROM horario_funcionamento 
    WHERE clinica_id = :clinica_id AND day_of_week = :day_of_week AND active = 1
");
```

**Código corrigido:**
```php
$stmt = $this->db->prepare("
    SELECT `open`, `close` 
    FROM horario_funcionamento 
    WHERE clinica_id = :clinica_id AND day = :day_of_week AND active = 1
");
```

#### 2. Uso das colunas retornadas - Linhas 345-346

**Código atual:**
```php
$startTime = strtotime($workingHours['open_time']);
$endTime = strtotime($workingHours['close_time']);
```

**Código corrigido:**
```php
$startTime = strtotime($workingHours['open']);
$endTime = strtotime($workingHours['close']);
```

#### 3. Método `getWorkingHours()` - Verificar se também usa nomes errados

Preciso verificar este método também pois é usado no system prompt.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/services/OpenAIService.php` | Corrigir nomes de colunas SQL |

---

## Detalhes Técnicos

Linhas a modificar no `OpenAIService.php`:

1. **Linha ~328-331**: Query de horário de funcionamento
   - `open_time` → `open`
   - `close_time` → `close`
   - `day_of_week` → `day`

2. **Linha ~345-346**: Acesso aos campos retornados
   - `$workingHours['open_time']` → `$workingHours['open']`
   - `$workingHours['close_time']` → `$workingHours['close']`

3. **Método `getWorkingHours()`** (se existir): Mesmas correções

---

## Validação

Após aplicar as correções:
1. Acessar a página de WhatsApp
2. Enviar uma mensagem no simulador (ex: "Quero agendar uma consulta")
3. A IA deve responder normalmente sem erro SQL
4. Testar fluxo de agendamento completo
