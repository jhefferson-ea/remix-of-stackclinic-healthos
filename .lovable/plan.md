

# Plano: Tornar a IA Robusta para Conversas Multi-Turn

## Diagnóstico

A IA funciona quando você manda tudo em uma mensagem, mas se perde em conversas de múltiplas mensagens porque:

1. **Modelo muito simples**: GPT-4o-mini tem limitações em manter contexto
2. **Prompt muito extenso**: Muitas regras confundem o modelo
3. **Falta estado explícito**: A IA não sabe o que já foi coletado

## Solução: Estado Explícito + Prompt Enxuto

A estratégia é manter um **objeto de estado** que diz para a IA exatamente o que já foi coletado e o que falta, eliminando a necessidade de ela "deduzir" isso do histórico.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/ai/simulate-chat.php` | Gerenciar estado da conversa (dados coletados) |
| `backend/api/services/OpenAIService.php` | Receber e usar estado, simplificar prompt |

---

## Detalhes Técnicos

### 1. Novo Formato de Contexto de Sessão

```php
// Em simulate-chat.php
$conversationContext = [
    'messages' => [...],  // Histórico de mensagens
    'collected_data' => [
        'procedure' => null,     // Ex: "Limpeza"
        'date' => null,          // Ex: "2026-01-28"
        'time' => null,          // Ex: "14:00"
        'patient_name' => null,  // Ex: "João Silva"
        'patient_phone' => null  // Opcional
    ],
    'current_step' => 'greeting', // greeting|procedure|date|time|name|confirm
    'last_activity' => '...'
];
```

### 2. Função para Detectar Dados na Mensagem

No `OpenAIService.php`, criar lógica que detecta automaticamente se a mensagem contém dados:

```php
private function extractDataFromMessage($message, $currentData) {
    $extracted = $currentData;
    
    // Detecta nomes (2+ palavras, primeira letra maiúscula)
    if (preg_match('/^[A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+/', $message)) {
        $extracted['patient_name'] = trim($message);
    }
    
    // Detecta telefones
    if (preg_match('/\(?\d{2}\)?\s*\d{4,5}[\-\s]?\d{4}/', $message, $m)) {
        $extracted['patient_phone'] = preg_replace('/\D/', '', $m[0]);
    }
    
    // Detecta horários
    if (preg_match('/(\d{1,2})[:h]?(\d{2})?/', $message, $m)) {
        $hour = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $min = $m[2] ?? '00';
        $extracted['time'] = "{$hour}:{$min}";
    }
    
    // Detecta datas relativas
    if (stripos($message, 'amanhã') !== false) {
        $extracted['date'] = date('Y-m-d', strtotime('+1 day'));
    }
    
    return $extracted;
}
```

### 3. Prompt Simplificado com Estado Explícito

```php
$stateInfo = "
# DADOS JÁ COLETADOS NESTA CONVERSA
- Procedimento: " . ($collectedData['procedure'] ?? 'NÃO INFORMADO') . "
- Data: " . ($collectedData['date'] ?? 'NÃO INFORMADO') . "
- Horário: " . ($collectedData['time'] ?? 'NÃO INFORMADO') . "
- Nome do paciente: " . ($collectedData['patient_name'] ?? 'NÃO INFORMADO') . "

# PRÓXIMO PASSO
" . $this->getNextStepInstruction($collectedData) . "
";
```

### 4. Função para Determinar Próximo Passo

```php
private function getNextStepInstruction($data) {
    if (empty($data['procedure'])) {
        return "Pergunte qual procedimento deseja agendar.";
    }
    if (empty($data['date'])) {
        return "Pergunte para qual data prefere.";
    }
    if (empty($data['time'])) {
        return "Use checkAvailability para mostrar horários disponíveis e pergunte qual prefere.";
    }
    if (empty($data['patient_name'])) {
        return "Pergunte o nome completo do paciente.";
    }
    return "Todos os dados coletados! Use createAppointment para confirmar.";
}
```

### 5. Prompt Reduzido e Focado

```php
$systemPrompt = <<<PROMPT
Você é {$aiName}, atendente virtual da {$clinicName}.

HOJE: {$currentDate} ({$currentDayName}) - AGORA: {$currentTime}

PROCEDIMENTOS:
{$proceduresList}

{$stateInfo}

REGRAS:
1. Faça apenas UMA pergunta por mensagem
2. Seja objetivo e direto (máximo 2 frases)
3. Use checkAvailability antes de oferecer horários
4. Só use createAppointment quando tiver TODOS os dados
5. NUNCA invente dados - use apenas o que o cliente informou
PROMPT;
```

### 6. Fluxo Atualizado no simulate-chat.php

```php
// Após processar com OpenAI, atualiza o estado
if ($result['success']) {
    // Extrai dados da mensagem do cliente
    $newData = $openai->extractDataFromMessage($message, $collectedData);
    
    // Se houve function call de createAppointment com sucesso
    if ($result['function_calls']) {
        foreach ($result['function_calls'] as $call) {
            if ($call['function'] === 'createAppointment' && $call['result']['success']) {
                // Limpa estado após sucesso
                $collectedData = ['procedure' => null, 'date' => null, ...];
            }
        }
    }
    
    $conversationContext['collected_data'] = $newData;
}
```

---

## Mudanças nos Parâmetros OpenAI

| Parâmetro | Antes | Depois | Motivo |
|-----------|-------|--------|--------|
| `temperature` | 0.3 | 0.2 | Mais determinístico |
| `max_tokens` | 500 | 300 | Respostas mais curtas |
| `model` | gpt-4o-mini | gpt-4o-mini | Manter (custo) |

---

## Exemplo de Conversa Esperada

```text
Sessão inicia:
collected_data = {procedure: null, date: null, time: null, patient_name: null}

Cliente: "oi"
→ IA detecta: nenhum dado
→ Próximo passo: saudação
→ IA: "Olá! Sou Ana da Clínica. Como posso ajudar?"

Cliente: "quero agendar consulta"
→ IA detecta: intenção de agendar
→ collected_data = {procedure: "Consulta", ...}
→ Próximo passo: perguntar data
→ IA: "Para qual data você prefere?"

Cliente: "amanhã"
→ extractDataFromMessage detecta "amanhã"
→ collected_data = {procedure: "Consulta", date: "2026-01-28", ...}
→ Próximo passo: mostrar horários
→ IA chama checkAvailability
→ IA: "Temos 09:00, 10:00, 14:00. Qual prefere?"

Cliente: "14h"
→ extractDataFromMessage detecta "14:00"
→ collected_data = {..., time: "14:00", patient_name: null}
→ Próximo passo: perguntar nome
→ IA: "Para finalizar, qual seu nome completo?"

Cliente: "João Silva"
→ extractDataFromMessage detecta nome
→ collected_data = {..., patient_name: "João Silva"}
→ Próximo passo: confirmar
→ IA chama createAppointment
→ IA: "Pronto! Consulta agendada: 28/01/2026 às 14:00 para João Silva."
```

---

## Testes de Validação

1. Enviar "oi" → saudação
2. Enviar "quero agendar" → pergunta procedimento
3. Enviar "consulta" → pergunta data
4. Enviar "amanhã" → mostra horários
5. Enviar "10h" → pergunta nome
6. Enviar "João Silva" → confirma agendamento
7. Verificar se cada resposta é curta (1-2 frases)
8. Verificar se não há perguntas repetidas

---

## Resumo das Mudanças

| Mudança | Impacto |
|---------|---------|
| Estado explícito (`collected_data`) | IA sabe exatamente o que já tem |
| Extração automática de dados | Detecta informações sem depender só da IA |
| Próximo passo calculado | IA sempre sabe o que fazer |
| Prompt 60% menor | Menos confusão para o modelo |
| Respostas limitadas a 300 tokens | Mais objetivas |

