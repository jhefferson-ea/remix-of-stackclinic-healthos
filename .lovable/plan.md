

# Plano: Consertar a IA para Conversar Corretamente

## Diagnóstico Técnico

### Bug 1: Estado não persiste entre mensagens
O método `processMessageWithState` retorna `$collectedData` sem atualizações. Os dados que a IA extrai da conversa são **perdidos**.

### Bug 2: Extração de procedimento falha para sintomas
"Dor no siso" não casa com nenhum procedimento cadastrado. A extração retorna `null`, mas a IA **inventa** um procedimento em vez de perguntar.

### Bug 3: A IA ignora as instruções do prompt
Mesmo recebendo "Procedimento: ❌ NÃO INFORMADO", a IA responde sugerindo "canal" - alucinação típica do GPT-4o-mini.

### Bug 4: Regra de negócio não implementada
Cliente disse "dor no siso" → deveria ser tratado como **Consulta**, não como sugestão de procedimento.

---

## Solução

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/services/OpenAIService.php` | Corrigir extração, atualizar estado, melhorar prompt |
| `backend/api/ai/simulate-chat.php` | Pequenos ajustes de persistência |

---

## Mudanças Técnicas

### 1. Nova Regra: Sintomas → Consulta

Quando o cliente descreve um problema (dor, desconforto, inchaço, etc.) sem pedir um procedimento específico, o sistema deve tratar como "Consulta" automaticamente.

```php
// Em extractDataFromMessage()
$symptomKeywords = ['dor', 'doendo', 'inchado', 'sangr', 'quebr', 'caiu', 'mole'];
$hasSymptom = false;
foreach ($symptomKeywords as $kw) {
    if (stripos($messageLower, $kw) !== false) {
        $hasSymptom = true;
        break;
    }
}

// Se tem sintoma e NÃO pediu procedimento específico → Consulta
if ($hasSymptom && empty($extracted['procedure'])) {
    $extracted['procedure'] = 'Consulta';
    $extracted['procedure_id'] = null; // Busca depois
}
```

### 2. Aliases para Procedimentos

Criar mapeamento de termos comuns para procedimentos reais.

```php
private function findProcedureByAlias($term, $clinicaId) {
    $aliases = [
        'canal' => ['canal', 'endodontia', 'tratamento de canal'],
        'siso' => ['siso', 'extração', 'terceiro molar', 'dente do juízo'],
        'limpeza' => ['limpeza', 'profilaxia', 'tartaro'],
        'clareamento' => ['clareamento', 'branqueamento'],
        'implante' => ['implante', 'implant'],
        'ortodontia' => ['aparelho', 'ortodont', 'alinhar'],
        'consulta' => ['consulta', 'avaliação', 'avaliaç', 'checkup', 'check-up']
    ];
    
    $termLower = mb_strtolower($term, 'UTF-8');
    
    foreach ($aliases as $category => $terms) {
        foreach ($terms as $alias) {
            if (stripos($termLower, $alias) !== false) {
                // Busca procedimento que contenha a categoria
                $stmt = $this->db->prepare("
                    SELECT id, name, duration FROM procedimentos 
                    WHERE clinica_id = :cid AND active = 1 
                    AND (name LIKE :term1 OR name LIKE :term2)
                    LIMIT 1
                ");
                $stmt->execute([
                    ':cid' => $clinicaId, 
                    ':term1' => "%{$category}%",
                    ':term2' => "%{$alias}%"
                ]);
                $proc = $stmt->fetch();
                if ($proc) return $proc;
            }
        }
    }
    return null;
}
```

### 3. Atualizar Estado na Resposta

O método `processMessageWithState` precisa atualizar `collected_data` com dados que a IA extraiu via tool calls.

```php
// Em handleToolCalls()
if ($result['function_calls']) {
    foreach ($result['function_calls'] as $call) {
        if ($call['function'] === 'checkAvailability') {
            // Se chamou checkAvailability, a data está confirmada
            $collectedData['date'] = $call['arguments']['date'] ?? $collectedData['date'];
        }
        if ($call['function'] === 'createAppointment' && $call['result']['success']) {
            // Limpa após sucesso
            $collectedData = [...reset...];
        }
    }
}
$result['collected_data'] = $collectedData; // AGORA RETORNA ATUALIZADO
```

### 4. Prompt Mais Rígido (Anti-Alucinação)

```php
$systemPrompt = <<<PROMPT
Você é {$aiName}, atendente da {$clinicName}. HOJE: {$currentDate} ({$currentDayName}) às {$currentTime}

PROCEDIMENTOS:
{$proceduresList}

# ESTADO ATUAL DA CONVERSA
{$stateInfo}

# REGRAS ABSOLUTAS (SIGA OU A CONVERSA FALHARÁ)

1. NUNCA SUGIRA procedimentos. Se o cliente descrever sintomas, trate como "Consulta".
2. Se "Procedimento" está como NÃO INFORMADO acima, você DEVE perguntar: "Qual procedimento deseja agendar?"
3. APENAS uma pergunta por mensagem. MÁXIMO 2 frases.
4. Use checkAvailability ANTES de oferecer horários.
5. NUNCA invente dados. Use EXATAMENTE o que está em "ESTADO ATUAL".
6. Só chame createAppointment quando TODOS os campos acima estiverem preenchidos.

EXEMPLOS CORRETOS:
- Cliente: "oi" → Você: "Olá! Como posso ajudar?"
- Cliente: "estou com dor no siso" → Você: "Vou agendar uma consulta para você. Para qual data prefere?"
- Cliente: "quero fazer canal" → (detecta procedimento) → Você: "Para qual data prefere?"
PROMPT;
```

### 5. Log de Debug Melhorado

```php
error_log("===== MENSAGEM DO CLIENTE =====");
error_log($message);
error_log("===== DADOS EXTRAÍDOS =====");
error_log(json_encode($extractedData));
error_log("===== STEP CALCULADO =====");
error_log($currentStep);
```

---

## Fluxo Corrigido

```text
Cliente: "oi"
→ extractDataFromMessage: nenhum dado
→ currentStep: "greeting"
→ IA: "Olá! Como posso ajudar?"

Cliente: "estou com dor no siso e queria marcar"
→ extractDataFromMessage: detecta "dor" → procedure = "Consulta"
→ currentStep: "date"
→ IA: "Vou agendar uma consulta para você. Para qual data prefere?"

Cliente: "30/01 às 10h"
→ extractDataFromMessage: date = "2026-01-30", time = "10:00"
→ currentStep: "name" (procedure, date, time preenchidos)
→ IA: "Perfeito! Para finalizar, qual seu nome completo?"

Cliente: "João Silva"
→ extractDataFromMessage: patient_name = "João Silva"
→ currentStep: "confirm"
→ IA chama createAppointment
→ IA: "Consulta agendada para 30/01/2026 às 10:00 para João Silva. Até lá!"
```

---

## Resumo das Mudanças

| Mudança | Motivo |
|---------|--------|
| Sintomas → Consulta | Cliente descreveu problema, não procedimento |
| Aliases de procedimentos | "canal" → "Tratamento de Canal" |
| Atualizar collected_data no retorno | Estado não estava persistindo |
| Prompt anti-alucinação | Regras mais rígidas para evitar invenção |
| Logs de debug | Facilitar troubleshooting |

---

## Testes de Validação

1. "oi" → saudação simples
2. "estou com dor no siso" → pergunta data (não sugere canal)
3. "quero fazer canal" → pergunta data (reconhece o procedimento)
4. "30/01 às 10h" → pergunta nome (não repete pergunta de procedimento)
5. "João Silva" → confirma agendamento
6. Verificar logs para ver estado em cada passo

