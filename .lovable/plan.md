
# Plano: Criar Caixa de Simulação de Chat para Testar IA

## Objetivo

Criar um componente temporário na tela de WhatsApp Config que simula uma conversa de WhatsApp para testar:
- Integração com a API da OpenAI
- Cadastro automático de clientes (leads)
- Criação de agendamentos pela IA

---

## Arquitetura da Solução

```text
+---------------------------+       +----------------------------+       +------------------+
|   Frontend (React)        |       |   Backend (PHP)            |       |   OpenAI API     |
|                           |       |                            |       |                  |
|   ChatSimulator           | ----> |  /api/ai/simulate-chat     | ----> |  GPT-4o-mini     |
|   Component               |       |                            |       |                  |
+---------------------------+       +----------------------------+       +------------------+
         ^                                    |
         |                                    v
         |                          +-------------------+
         +------------------------  |  Resposta IA      |
                                    |  + Function Calls |
                                    +-------------------+
```

---

## Componentes a Criar

### 1. Backend: Novo Endpoint `/api/ai/simulate-chat`

**Arquivo:** `backend/api/ai/simulate-chat.php`

Este endpoint vai:
- Receber mensagem do "cliente simulado"
- Usar a mesma lógica do webhook WhatsApp
- Criar paciente lead se necessário
- Processar com OpenAI (mesmo fluxo do webhook)
- Retornar a resposta da IA

**Diferenças do webhook real:**
- Não depende da Evolution API
- Não precisa de instância WhatsApp conectada
- Usa telefone fictício para identificar sessão

### 2. Frontend: Componente `ChatSimulator`

**Arquivo:** `src/components/whatsapp/ChatSimulator.tsx`

Interface visual que simula um chat WhatsApp:
- Área de mensagens com scroll
- Input para digitar mensagens
- Botões de enviar
- Visual estilo WhatsApp (balões verdes/brancos)
- Loading indicator quando IA processa
- Botão para limpar conversa

---

## Detalhes de Implementação

### Backend: simulate-chat.php

```text
Fluxo do Endpoint:

1. Recebe POST com { message: string, phone: string (opcional) }
2. Autentica usuário (usa clinica_id dele)
3. Busca/cria paciente lead com telefone fictício
4. Carrega histórico da sessão de simulação
5. Chama OpenAIService->processMessage()
6. Salva mensagens no histórico de simulação
7. Retorna resposta da IA + info do paciente + agendamento se criado
```

**Tabela temporária ou session storage:**
- Usaremos a tabela `whatsapp_messages` com um telefone marcador (ex: "SIMULATOR_999")
- Ou podemos criar uma tabela `simulation_messages` separada

### Frontend: ChatSimulator.tsx

```text
Estado do Componente:
- messages: Array<{role: 'user' | 'assistant', content: string, timestamp: Date}>
- isLoading: boolean
- sessionPhone: string (gerado ao abrir)

Funções:
- sendMessage(): POST /api/ai/simulate-chat
- clearChat(): Limpa mensagens e reseta sessão
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `backend/api/ai/simulate-chat.php` | Criar | Endpoint de simulação |
| `backend/api/index.php` | Modificar | Adicionar rota do endpoint |
| `src/components/whatsapp/ChatSimulator.tsx` | Criar | Componente de chat |
| `src/pages/app/WhatsAppConfig.tsx` | Modificar | Adicionar ChatSimulator |
| `src/services/api.ts` | Modificar | Adicionar método simulateChat() |

---

## Interface Visual Planejada

```text
+------------------------------------------------------+
|  📱 Simulador de Chat (MODO TESTE)                   |
|------------------------------------------------------|
|                                                      |
|     +------------------------------------------+     |
|     |  Olá! Gostaria de agendar uma consulta  | <-- User
|     +------------------------------------------+     |
|                                                      |
|  +----------------------------------------------+    |
|  | Olá! Sou a Atendente Virtual da Clínica.    |    |
|  | Temos horários disponíveis para amanhã.     | <-- AI
|  | Qual horário você prefere?                  |    |
|  +----------------------------------------------+    |
|                                                      |
|     +------------------------------------------+     |
|     |  Pode ser às 14h?                        | <-- User
|     +------------------------------------------+     |
|                                                      |
|  +----------------------------------------------+    |
|  | Perfeito! Agendei sua consulta para amanhã  |    |
|  | às 14h. Qual seu nome completo?             | <-- AI
|  +----------------------------------------------+    |
|                                                      |
+------------------------------------------------------+
|  [                    Digite sua mensagem...    ] 📤 |
+------------------------------------------------------+
|  [🗑️ Limpar Chat]  [⚠️ Este é um modo de teste]     |
+------------------------------------------------------+
```

---

## Comportamento Esperado

1. **Usuário abre a página WhatsApp Config**
   - Vê a caixa de simulação no topo (antes do status de conexão)
   
2. **Usuário envia mensagem como "cliente"**
   - Mensagem aparece no chat (lado direito, verde)
   - Loading aparece enquanto IA processa
   
3. **IA responde**
   - Resposta aparece (lado esquerdo, branco)
   - Se IA criou agendamento, mostra toast de confirmação
   
4. **Usuário pode testar fluxos:**
   - "Quero agendar uma consulta" → IA verifica disponibilidade
   - "Amanhã às 14h" → IA cria agendamento
   - "Meu nome é João Silva" → IA atualiza paciente

---

## Considerações de Segurança

- Endpoint protegido por autenticação JWT
- Usa clinica_id do usuário logado
- Pacientes de simulação são criados como leads com telefone especial
- Mensagens são salvas para debug

---

## Limpeza Futura

Quando não precisar mais da simulação:
1. Remover `ChatSimulator` do WhatsAppConfig
2. Deletar arquivo `simulate-chat.php`
3. Limpar mensagens de simulação do banco
4. Remover rota do index.php
