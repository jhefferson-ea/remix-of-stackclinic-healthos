
# Plano: Refatoração Completa da IA do Chat Simulator

## Problemas Identificados

### 1. **IA "Alucinando" e Repetindo Perguntas**
- O prompt atual não mantém estado da conversa de forma explícita
- A IA não sabe em qual etapa do fluxo está
- O histórico de mensagens é passado mas sem contexto estruturado
- A IA recebe tools demais (getPatientInfo não faz sentido no contexto do simulador)

### 2. **IA Alterou Nome da Clínica**
- **BUG CRÍTICO**: A função `createAppointment` usa `$clinica['name']` que pode estar sendo passado de forma incorreta
- Possível SQL injection via argumentos da IA (ex: IA passa `patient_name` contendo SQL)
- Não há sanitização dos dados vindos da IA

### 3. **Falta Validação da Agenda do Profissional**
- O sistema está consultando `horario_funcionamento` mas não valida se há bloqueios específicos
- A tabela `agendamentos` tem `usuario_id` (profissional) mas a IA não usa isso
- Como você confirmou que é "Por Clínica", precisamos garantir que `usuario_id` seja NULL ou um default

### 4. **Tools Desnecessárias**
- `getPatientInfo` não deve existir (paciente só é criado ao confirmar agendamento)
- Falta sanitização nos argumentos das tools

---

## Solução Proposta

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/services/OpenAIService.php` | Refatoração completa do prompt, remoção de tools desnecessárias, adição de estado de conversa, sanitização |

---

## Detalhes Técnicos

### 1. Remover Tool `getPatientInfo`

A tool `getPatientInfo` não faz sentido porque:
- O paciente só é criado ao confirmar agendamento (regra que você escolheu)
- No contexto do WhatsApp, a pessoa é desconhecida até informar o nome

```php
// REMOVER esta tool do array getAvailableTools():
[
    'type' => 'function',
    'function' => [
        'name' => 'getPatientInfo',
        // ...
    ]
]
```

### 2. Novo System Prompt com Máquina de Estados

O problema principal é que a IA não sabe "em qual passo está". Vamos criar um prompt que force a IA a seguir uma máquina de estados:

```php
$systemPrompt = <<<PROMPT
# IDENTIDADE
Você é {$aiName}, atendente virtual da clínica {$clinicName}.
Especialidade: {$category}

# DATA E HORA ATUAL
Hoje: {$currentDate} ({$currentDayName})
Agora: {$currentTime}

# INFORMAÇÕES DA CLÍNICA
- Endereço: {$address}
- Telefone: {$phone}

# PROCEDIMENTOS DISPONÍVEIS (use exatamente estes nomes)
{$proceduresList}

# HORÁRIOS DE FUNCIONAMENTO
{$workingHours}

# TOM: {$toneInstruction}

# FLUXO DE AGENDAMENTO (SIGA RIGOROSAMENTE)

Você deve seguir EXATAMENTE esta sequência para agendar:

**PASSO 1 - SAUDAÇÃO**
Se o cliente mandou "oi", "olá", "bom dia", etc:
→ Responda: "Olá! Sou {$aiName} da {$clinicName}. Como posso ajudar?"
→ NÃO pergunte mais nada, aguarde a resposta.

**PASSO 2 - PROCEDIMENTO**
Se o cliente quer agendar mas não disse qual procedimento:
→ Pergunte: "Qual procedimento você gostaria de agendar?"
→ Se ele disser algo que não está na lista, diga que vai verificar com a equipe.

**PASSO 3 - DATA**
Se o cliente já escolheu o procedimento mas não a data:
→ Pergunte: "Para qual data você prefere?"
→ Aceite "amanhã", "segunda", datas específicas, etc.

**PASSO 4 - VERIFICAR HORÁRIOS**
Se o cliente informou a data:
→ Use a função checkAvailability com a data
→ Mostre no máximo 5 horários disponíveis
→ Pergunte qual horário prefere

**PASSO 5 - NOME**
Se o cliente escolheu o horário:
→ Pergunte: "Para finalizar, preciso do seu nome completo."

**PASSO 6 - CONFIRMAR**
Somente quando tiver: procedimento + data + horário + nome:
→ Use a função createAppointment
→ Confirme o agendamento com os dados

# REGRAS ABSOLUTAS

1. NUNCA pule passos - siga a ordem exata
2. NUNCA faça duas perguntas na mesma mensagem
3. NUNCA invente procedimentos ou preços
4. NUNCA chame createAppointment sem ter o nome do cliente
5. Se não entendeu algo, peça para o cliente repetir
6. Se o cliente pedir para falar com humano, use transferToHuman

# EXEMPLOS DE INTERAÇÕES CORRETAS

Exemplo 1:
Cliente: oi
IA: Olá! Sou {$aiName} da {$clinicName}. Como posso ajudar?

Cliente: quero agendar
IA: Qual procedimento você gostaria de agendar?

Cliente: limpeza
IA: Ótimo! Para qual data você prefere a limpeza?

Cliente: amanhã
IA: [chama checkAvailability] Temos horários às 09:00, 10:00, 14:00, 15:00 e 16:00. Qual prefere?

Cliente: 14h
IA: Perfeito! Para finalizar, preciso do seu nome completo.

Cliente: João Silva
IA: [chama createAppointment] Pronto! Agendamento confirmado: Limpeza em 28/01/2026 às 14:00 para João Silva. Até lá!

{$customPrompt}
PROMPT;
```

### 3. Sanitização de Dados da IA

Antes de usar qualquer dado vindo da IA em queries SQL:

```php
private function createAppointment($date, $time, $procedureName, $patientName, $patientPhone, $clinicaId) {
    // SANITIZAÇÃO - impede SQL injection e valores maliciosos
    $patientName = trim(strip_tags($patientName ?? ''));
    $procedureName = trim(strip_tags($procedureName ?? ''));
    $patientPhone = preg_replace('/[^0-9]/', '', $patientPhone ?? '');
    
    // Validação de formato de data
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return ['success' => false, 'error' => 'Formato de data inválido'];
    }
    
    // Validação de formato de hora
    if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
        return ['success' => false, 'error' => 'Formato de hora inválido'];
    }
    
    // Validação de nome (mínimo 3 caracteres)
    if (strlen($patientName) < 3) {
        return ['success' => false, 'error' => 'Nome do paciente é obrigatório'];
    }
    
    // ... resto do código
}
```

### 4. Correção do INSERT de Agendamento

O INSERT atual usa `patient_id` mas a tabela tem `paciente_id`:

```php
// ANTES (incorreto):
$stmt = $this->db->prepare("
    INSERT INTO agendamentos (clinica_id, patient_id, date, time, ...)
");

// DEPOIS (correto - verificar nome real da coluna):
$stmt = $this->db->prepare("
    INSERT INTO agendamentos (clinica_id, paciente_id, date, time, duration, `procedure`, procedimento_id, status, notes)
    VALUES (:clinica_id, :paciente_id, :date, :time, :duration, :procedure, :procedimento_id, 'confirmed', 'Agendado via WhatsApp')
");
```

### 5. Adicionar Logs de Debug

Para ajudar a identificar problemas futuros:

```php
private function processMessage($message, $conversationHistory = []) {
    $systemMessage = $this->buildSystemMessage();
    
    // LOG: Ver o prompt completo
    error_log("===== OPENAI SYSTEM PROMPT =====");
    error_log($systemMessage);
    error_log("===== HISTÓRICO (" . count($conversationHistory) . " mensagens) =====");
    error_log(json_encode($conversationHistory));
    
    // ... resto do código
}
```

### 6. Ajustar Parâmetros da OpenAI

```php
$data = [
    'model' => $this->model,
    'messages' => $messages,
    'temperature' => 0.2,  // AINDA MAIS BAIXA para consistência máxima
    'max_tokens' => 400,   // Respostas mais curtas = menos divagação
    'presence_penalty' => 0.1,  // Evita repetição
    'frequency_penalty' => 0.1  // Evita repetição de frases
];
```

---

## Resumo das Mudanças

| Mudança | Impacto |
|---------|---------|
| Remover `getPatientInfo` | Evita erros de tool call desnecessária |
| Novo prompt com máquina de estados | IA segue fluxo passo a passo |
| Exemplos de diálogo no prompt | IA aprende por exemplo |
| Sanitização de dados | Segurança contra SQL injection |
| Correção do INSERT | Evita erros de coluna inexistente |
| Temperature 0.2 | Respostas mais previsíveis |
| Logs de debug | Facilita troubleshooting |

---

## Teste de Validação

1. Limpar sessão do simulador
2. Enviar "oi" → deve receber saudação curta
3. Enviar "quero agendar" → deve perguntar qual procedimento
4. Seguir o fluxo até confirmar agendamento
5. Verificar se paciente foi criado SOMENTE após agendamento
6. Verificar se o nome da clínica NÃO foi alterado
