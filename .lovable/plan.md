

# Plano: Melhorar Qualidade das Respostas da IA no Chat Simulator

## Problema Identificado

As respostas da IA estão "perdidas" e incoerentes porque:
1. O **system prompt** é muito genérico e não guia a IA sobre como conduzir uma conversa
2. A **temperatura** está em 0.7 (alta demais para atendimento)
3. Faltam **instruções de fluxo** - quando perguntar o quê, em que ordem
4. A IA não sabe que está **simulando WhatsApp** onde o cliente pode ser novo

---

## Solução

Reescrever o `buildSystemMessage()` com um prompt estruturado que:
- Define claramente a persona e contexto
- Estabelece um fluxo de conversa lógico
- Dá exemplos de interações
- Reduz a temperatura para respostas mais consistentes

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/api/services/OpenAIService.php` | Reescrever system prompt e reduzir temperatura |

---

## Detalhes Técnicos

### 1. Novo System Prompt (método `buildSystemMessage`)

```php
$systemPrompt = <<<PROMPT
# IDENTIDADE
Você é {$aiName}, atendente virtual da {$clinicName}.
Especialidade: {$category}
Data de hoje: {$currentDate} ({$currentDayName})
Hora atual: {$currentTime}

# CONTEXTO
Você está conversando via WhatsApp. O cliente pode ser um paciente existente ou alguém novo que nunca veio à clínica.

# INFORMAÇÕES DA CLÍNICA
Endereço: {$address}
Telefone: {$phone}

# PROCEDIMENTOS E PREÇOS
{$proceduresList}

# HORÁRIOS DE FUNCIONAMENTO
{$workingHours}

# TOM DE COMUNICAÇÃO
{$toneInstruction}

# REGRAS IMPORTANTES

## Saudações
- Quando o cliente disser "oi", "olá", "bom dia", etc., responda de forma acolhedora e pergunte como pode ajudar.
- Exemplo: "Olá! Bem-vindo(a) à {$clinicName}! Sou {$aiName}, como posso ajudar você hoje?"

## Agendamentos
1. Se o cliente quiser agendar, pergunte PRIMEIRO qual procedimento/serviço deseja
2. Depois pergunte para qual data prefere
3. Use checkAvailability para buscar horários disponíveis
4. Ofereça as opções de horário de forma resumida (máximo 5-6 horários por vez)
5. Quando o cliente escolher horário, pergunte o NOME COMPLETO dele
6. Só chame createAppointment quando tiver: data, hora e nome do cliente

## Informações
- Só forneça preços e informações que estão listados acima
- Se perguntarem algo que você não sabe, diga que vai verificar com a equipe

## Transferência
- Se o cliente pedir para falar com atendente/humano/secretária, use transferToHuman
- Se a conversa ficar muito complexa ou o cliente ficar frustrado, ofereça transferir

## Respostas
- Seja OBJETIVO e DIRETO
- Use frases curtas (máximo 3 frases por resposta quando possível)
- Não repita informações que já foram ditas
- Não faça múltiplas perguntas de uma vez - uma pergunta por mensagem

{$customPrompt}
PROMPT;
```

### 2. Reduzir Temperatura (método `callOpenAI`)

```php
$data = [
    'model' => $this->model,
    'messages' => $messages,
    'temperature' => 0.3,  // Era 0.7 - mais consistente agora
    'max_tokens' => 500    // Era 1000 - respostas mais concisas
];
```

### 3. Adicionar nome do dia da semana

```php
$currentDate = date('d/m/Y');
$currentTime = date('H:i');
$daysOfWeek = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
$currentDayName = $daysOfWeek[date('w')];
```

---

## Comparação Antes x Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Temperatura | 0.7 (criativo) | 0.3 (consistente) |
| Max tokens | 1000 | 500 |
| Fluxo de agendamento | Genérico | Passo a passo detalhado |
| Saudações | Não mencionado | Exemplo incluído |
| Tom de resposta | Não definido | "Objetivo e direto, frases curtas" |
| Dia da semana | Não incluído | Incluído para contexto de agenda |

---

## Exemplo de Fluxo Esperado

**Antes (problemático):**
```
Usuário: oi
IA: [resposta confusa ou tentando agendar direto]
```

**Depois (esperado):**
```
Usuário: oi
IA: Olá! Bem-vindo(a) à Clínica Exemplo! Sou Ana, como posso ajudar você hoje?

Usuário: quero agendar consulta
IA: Claro! Qual procedimento você gostaria de agendar?

Usuário: limpeza dental
IA: Ótimo! Para qual data você prefere?

Usuário: amanhã
IA: [chama checkAvailability] 
    Temos os seguintes horários disponíveis amanhã: 09:00, 10:00, 14:00, 15:00, 16:00. Qual prefere?

Usuário: 14:00
IA: Perfeito! Para confirmar o agendamento, preciso do seu nome completo.

Usuário: João Silva
IA: [chama createAppointment]
    Pronto! Seu agendamento está confirmado:
    📅 Limpeza Dental
    📆 28/01/2026 às 14:00
    
    Até lá!
```

---

## Teste de Validação

1. Enviar "oi" - deve receber saudação amigável
2. Enviar "quero agendar" - deve perguntar qual procedimento
3. Seguir o fluxo até confirmar agendamento
4. Verificar se as respostas são curtas e objetivas
5. Verificar se a IA não faz múltiplas perguntas de uma vez

