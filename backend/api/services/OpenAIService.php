<?php
/**
 * StackClinic - OpenAI Service
 * Processamento de mensagens com GPT e Function Calling
 * 
 * REGRAS DE NEGÓCIO:
 * - Agenda é POR CLÍNICA (não por profissional)
 * - Paciente só é criado ao CONFIRMAR agendamento
 * - Dados obrigatórios: procedimento + data + hora + nome completo
 * - IA só pode: informar valores/horários e agendar (restrito)
 */

class OpenAIService {
    private $apiKey;
    private $model = 'gpt-4o-mini';
    private $db;
    private $clinica;
    private $paciente;
    
    public function __construct($db, $clinica, $paciente = null) {
        // Use environment variable or fallback to direct key
        $this->apiKey = getenv('OPENAI_API_KEY') ?: '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';
        $this->db = $db;
        $this->clinica = $clinica;
        $this->paciente = $paciente;
    }
    
    /**
     * Processa uma mensagem e retorna a resposta da IA
     */
    public function processMessage($message, $conversationHistory = []) {
        $systemMessage = $this->buildSystemMessage();
        
        // LOG: Debug do prompt (comentar em produção)
        error_log("===== OPENAI SYSTEM PROMPT =====");
        error_log(substr($systemMessage, 0, 500) . "...");
        error_log("===== HISTÓRICO (" . count($conversationHistory) . " mensagens) =====");
        
        $messages = [
            ['role' => 'system', 'content' => $systemMessage]
        ];
        
        // Adiciona histórico da conversa
        foreach ($conversationHistory as $msg) {
            $messages[] = [
                'role' => $msg['direction'] === 'incoming' ? 'user' : 'assistant',
                'content' => $msg['message']
            ];
        }
        
        // Adiciona mensagem atual
        $messages[] = ['role' => 'user', 'content' => $message];
        
        // Define as tools disponíveis (APENAS as necessárias)
        $tools = $this->getAvailableTools();
        
        // Faz a chamada para a OpenAI
        $response = $this->callOpenAI($messages, $tools);
        
        // Verifica erros detalhados
        if (!$response || isset($response['error'])) {
            $errorMsg = $response['message'] ?? 'Falha ao conectar com a IA';
            error_log("OpenAI Error Details: " . json_encode($response));
            return [
                'success' => false,
                'error' => $errorMsg,
                'debug' => $response
            ];
        }
        
        // Verifica se há function calls
        $assistantMessage = $response['choices'][0]['message'] ?? null;
        
        if (isset($assistantMessage['tool_calls'])) {
            // Processa as function calls
            return $this->handleToolCalls($assistantMessage, $messages, $tools);
        }
        
        return [
            'success' => true,
            'response' => $assistantMessage['content'] ?? 'Desculpe, não consegui processar sua mensagem.',
            'tokens_used' => $response['usage']['total_tokens'] ?? 0,
            'function_calls' => null
        ];
    }
    
    /**
     * Monta o system message com MÁQUINA DE ESTADOS para guiar a IA
     */
    private function buildSystemMessage() {
        // Dados da clínica (SOMENTE LEITURA - nunca alterar)
        $clinicName = $this->clinica['name'] ?? 'Clínica';
        $aiName = $this->clinica['ai_name'] ?? 'Atendente Virtual';
        $category = $this->getCategoryLabel($this->clinica['category'] ?? 'outro');
        $aiTone = $this->clinica['ai_tone'] ?? 'casual';
        $customPrompt = $this->clinica['system_prompt_custom'] ?? '';
        $address = $this->clinica['address'] ?? '';
        $phone = $this->clinica['phone'] ?? '';
        
        // Busca procedimentos da clínica
        $procedures = $this->getProcedures();
        $proceduresList = '';
        if (empty($procedures)) {
            $proceduresList = "- Consulta Geral: Preço a consultar\n";
        } else {
            foreach ($procedures as $proc) {
                $proceduresList .= "- {$proc['name']}: R$ " . number_format($proc['price'], 2, ',', '.') . " ({$proc['duration']} min)\n";
            }
        }
        
        // Busca horários de funcionamento
        $workingHours = $this->getWorkingHours();
        
        // Tom da conversa
        $toneInstruction = match($aiTone) {
            'formal' => 'Use linguagem formal e profissional. Trate o paciente por "senhor" ou "senhora".',
            'empathetic' => 'Seja acolhedor e empático. Demonstre compreensão e cuidado com o paciente.',
            default => 'Seja amigável e natural. Use uma linguagem acessível e descontraída.',
        };
        
        // Data e hora atual
        $currentDate = date('d/m/Y');
        $currentTime = date('H:i');
        $daysOfWeek = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
        $currentDayName = $daysOfWeek[date('w')];
        
        $systemPrompt = <<<PROMPT
# IDENTIDADE
Você é {$aiName}, atendente virtual da clínica {$clinicName}.
Especialidade: {$category}

# DATA E HORA ATUAL
Hoje: {$currentDate} ({$currentDayName})
Agora: {$currentTime}

# INFORMAÇÕES DA CLÍNICA (NUNCA ALTERE ESTES DADOS)
- Nome: {$clinicName}
- Endereço: {$address}
- Telefone: {$phone}

# PROCEDIMENTOS DISPONÍVEIS (use exatamente estes nomes)
{$proceduresList}

# HORÁRIOS DE FUNCIONAMENTO
{$workingHours}

# TOM: {$toneInstruction}

# FLUXO DE AGENDAMENTO (SIGA RIGOROSAMENTE ESTA ORDEM)

Você DEVE seguir EXATAMENTE esta sequência. NÃO pule passos:

**PASSO 1 - SAUDAÇÃO**
Se o cliente mandou "oi", "olá", "bom dia", "boa tarde", "boa noite", etc:
→ Responda: "Olá! Sou {$aiName} da {$clinicName}. Como posso ajudar?"
→ PARE. Aguarde a resposta do cliente.

**PASSO 2 - IDENTIFICAR INTENÇÃO**
Se o cliente quer agendar mas NÃO disse qual procedimento:
→ Pergunte: "Qual procedimento você gostaria de agendar?"
→ Liste os procedimentos disponíveis se necessário.
→ PARE. Aguarde a resposta.

**PASSO 3 - DATA**
Se o cliente JÁ escolheu o procedimento mas NÃO informou a data:
→ Pergunte: "Para qual data você prefere?"
→ Aceite: "amanhã", "segunda", "dia 15", datas específicas, etc.
→ PARE. Aguarde a resposta.

**PASSO 4 - VERIFICAR HORÁRIOS**
Se o cliente informou a data:
→ Use a função checkAvailability com a data (formato YYYY-MM-DD)
→ Se não houver horários, informe e pergunte outra data
→ Se houver, mostre NO MÁXIMO 5 horários
→ Pergunte: "Qual horário prefere?"
→ PARE. Aguarde a resposta.

**PASSO 5 - NOME DO PACIENTE**
Se o cliente escolheu o horário:
→ Pergunte: "Para finalizar, preciso do seu nome completo."
→ PARE. Aguarde a resposta.

**PASSO 6 - CONFIRMAR AGENDAMENTO**
SOMENTE quando você tiver TODOS os dados: procedimento + data + horário + nome completo:
→ Use a função createAppointment com todos os dados
→ Confirme: "Pronto! Agendamento confirmado: [procedimento] em [data] às [hora] para [nome]. Até lá!"

# REGRAS ABSOLUTAS (NUNCA VIOLE)

1. NUNCA pule passos - siga a ordem 1→2→3→4→5→6
2. NUNCA faça duas perguntas na mesma mensagem
3. NUNCA invente procedimentos, preços ou horários
4. NUNCA chame createAppointment sem ter o NOME COMPLETO do cliente
5. NUNCA altere dados da clínica (nome, endereço, etc.)
6. Se não entendeu algo, peça para o cliente repetir
7. Se o cliente pedir para falar com humano, use transferToHuman

# INTERPRETAÇÃO DE DATAS

- "amanhã" → dia seguinte ao atual
- "segunda", "terça", etc → próximo dia da semana
- "dia 15" → dia 15 do mês atual (ou próximo se já passou)
- Converta SEMPRE para formato YYYY-MM-DD antes de chamar checkAvailability

# EXEMPLOS DE INTERAÇÕES CORRETAS

Exemplo 1 - Fluxo completo:
Cliente: oi
IA: Olá! Sou {$aiName} da {$clinicName}. Como posso ajudar?

Cliente: quero agendar
IA: Qual procedimento você gostaria de agendar?

Cliente: limpeza
IA: Ótimo! Para qual data você prefere a limpeza?

Cliente: amanhã
IA: [chama checkAvailability] Temos horários disponíveis amanhã: 09:00, 10:00, 14:00, 15:00 e 16:00. Qual prefere?

Cliente: 14h
IA: Perfeito! Para finalizar, preciso do seu nome completo.

Cliente: João Silva
IA: [chama createAppointment] Pronto! Agendamento confirmado: Limpeza em 28/01/2026 às 14:00 para João Silva. Até lá!

Exemplo 2 - Cliente já sabe o que quer:
Cliente: quero agendar limpeza para amanhã às 10h
IA: [chama checkAvailability para verificar] Ótimo! O horário das 10:00 está disponível. Para confirmar, preciso do seu nome completo.

Cliente: Maria Santos
IA: [chama createAppointment] Pronto! Agendamento confirmado: Limpeza em 28/01/2026 às 10:00 para Maria Santos. Até lá!

Exemplo 3 - Horário não disponível:
Cliente: quero às 14h
IA: [após checkAvailability mostrar que 14h não está disponível] Infelizmente o horário das 14:00 não está disponível. Temos: 09:00, 10:00, 15:00 e 16:00. Qual prefere?

# INSTRUÇÕES ADICIONAIS
{$customPrompt}
PROMPT;

        return $systemPrompt;
    }
    
    /**
     * Define as tools (functions) disponíveis para a IA
     * REMOVIDO: getPatientInfo (paciente só é criado ao confirmar)
     */
    private function getAvailableTools() {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'checkAvailability',
                    'description' => 'Verifica horários disponíveis na agenda para uma data específica. Use SEMPRE antes de confirmar um horário.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'date' => [
                                'type' => 'string',
                                'description' => 'Data no formato YYYY-MM-DD (ex: 2026-01-28)'
                            ]
                        ],
                        'required' => ['date']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'createAppointment',
                    'description' => 'Cria um novo agendamento. IMPORTANTE: Só chame esta função quando tiver TODOS os dados: data, horário, procedimento e nome completo do paciente.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'date' => [
                                'type' => 'string',
                                'description' => 'Data no formato YYYY-MM-DD'
                            ],
                            'time' => [
                                'type' => 'string',
                                'description' => 'Horário no formato HH:MM (ex: 14:00)'
                            ],
                            'procedure_name' => [
                                'type' => 'string',
                                'description' => 'Nome do procedimento exatamente como listado'
                            ],
                            'patient_name' => [
                                'type' => 'string',
                                'description' => 'Nome completo do paciente (OBRIGATÓRIO)'
                            ],
                            'patient_phone' => [
                                'type' => 'string',
                                'description' => 'Telefone do paciente (opcional)'
                            ]
                        ],
                        'required' => ['date', 'time', 'procedure_name', 'patient_name']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'transferToHuman',
                    'description' => 'Transfere a conversa para um atendente humano. Use quando o cliente solicitar ou quando a situação for muito complexa.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'reason' => [
                                'type' => 'string',
                                'description' => 'Motivo da transferência'
                            ]
                        ],
                        'required' => ['reason']
                    ]
                ]
            ]
        ];
    }
    
    /**
     * Processa as tool calls da IA
     */
    private function handleToolCalls($assistantMessage, $messages, $tools) {
        $toolCalls = $assistantMessage['tool_calls'];
        $functionResults = [];
        
        // Adiciona a mensagem do assistente com tool_calls
        $messages[] = $assistantMessage;
        
        foreach ($toolCalls as $toolCall) {
            $functionName = $toolCall['function']['name'];
            $arguments = json_decode($toolCall['function']['arguments'], true) ?? [];
            
            // LOG: Debug das chamadas
            error_log("===== TOOL CALL: {$functionName} =====");
            error_log("Arguments: " . json_encode($arguments));
            
            // Executa a função
            $result = $this->executeFunction($functionName, $arguments);
            
            error_log("Result: " . json_encode($result));
            
            $functionResults[] = [
                'function' => $functionName,
                'arguments' => $arguments,
                'result' => $result
            ];
            
            // Adiciona o resultado da função às mensagens
            $messages[] = [
                'role' => 'tool',
                'tool_call_id' => $toolCall['id'],
                'content' => json_encode($result)
            ];
        }
        
        // Faz nova chamada para a IA processar os resultados
        $response = $this->callOpenAI($messages, $tools);
        
        // Verifica erros detalhados na segunda chamada também
        if (!$response || isset($response['error'])) {
            $errorMsg = $response['message'] ?? 'Falha ao processar resultados das funções';
            error_log("OpenAI Tool Results Error: " . json_encode($response));
            return [
                'success' => false,
                'error' => $errorMsg,
                'debug' => $response
            ];
        }
        
        $finalMessage = $response['choices'][0]['message']['content'] ?? 'Pronto! Como posso ajudar mais?';
        
        return [
            'success' => true,
            'response' => $finalMessage,
            'tokens_used' => $response['usage']['total_tokens'] ?? 0,
            'function_calls' => $functionResults
        ];
    }
    
    /**
     * Executa uma função específica
     */
    private function executeFunction($functionName, $arguments) {
        $clinicaId = $this->clinica['id'];
        
        switch ($functionName) {
            case 'checkAvailability':
                $date = $this->sanitizeDate($arguments['date'] ?? '');
                if (!$date) {
                    return ['available' => false, 'error' => 'Data inválida'];
                }
                return $this->checkAvailability($date, $clinicaId);
                
            case 'createAppointment':
                return $this->createAppointment(
                    $this->sanitizeDate($arguments['date'] ?? ''),
                    $this->sanitizeTime($arguments['time'] ?? ''),
                    $this->sanitizeString($arguments['procedure_name'] ?? ''),
                    $this->sanitizeString($arguments['patient_name'] ?? ''),
                    $this->sanitizePhone($arguments['patient_phone'] ?? ''),
                    $clinicaId
                );
                
            case 'transferToHuman':
                return $this->transferToHuman($this->sanitizeString($arguments['reason'] ?? 'Solicitação do paciente'));
                
            default:
                return ['error' => 'Função não reconhecida'];
        }
    }
    
    // ========================================
    // FUNÇÕES DE SANITIZAÇÃO (Segurança)
    // ========================================
    
    /**
     * Sanitiza string removendo tags e caracteres perigosos
     */
    private function sanitizeString($value) {
        if (!$value) return '';
        return trim(strip_tags($value));
    }
    
    /**
     * Sanitiza data para formato YYYY-MM-DD
     */
    private function sanitizeDate($value) {
        if (!$value) return null;
        
        // Remove qualquer coisa que não seja número ou hífen
        $clean = preg_replace('/[^0-9\-]/', '', $value);
        
        // Valida formato
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $clean)) {
            return null;
        }
        
        // Valida se é uma data real
        $parts = explode('-', $clean);
        if (!checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
            return null;
        }
        
        return $clean;
    }
    
    /**
     * Sanitiza hora para formato HH:MM
     */
    private function sanitizeTime($value) {
        if (!$value) return null;
        
        // Remove qualquer coisa que não seja número ou dois-pontos
        $clean = preg_replace('/[^0-9:]/', '', $value);
        
        // Valida formato
        if (!preg_match('/^\d{2}:\d{2}$/', $clean)) {
            // Tenta corrigir formato "9:00" para "09:00"
            if (preg_match('/^(\d{1,2}):(\d{2})$/', $clean, $matches)) {
                $clean = str_pad($matches[1], 2, '0', STR_PAD_LEFT) . ':' . $matches[2];
            } else {
                return null;
            }
        }
        
        // Valida range (00:00 a 23:59)
        $parts = explode(':', $clean);
        if ((int)$parts[0] > 23 || (int)$parts[1] > 59) {
            return null;
        }
        
        return $clean;
    }
    
    /**
     * Sanitiza telefone removendo tudo que não for número
     */
    private function sanitizePhone($value) {
        if (!$value) return '';
        return preg_replace('/[^0-9]/', '', $value);
    }
    
    // ========================================
    // FUNÇÕES DE NEGÓCIO
    // ========================================
    
    /**
     * Verifica horários disponíveis (considera bloqueios e agendamentos existentes)
     */
    private function checkAvailability($date, $clinicaId) {
        // Valida se data não é passada
        if (strtotime($date) < strtotime(date('Y-m-d'))) {
            return [
                'available' => false,
                'message' => 'Não é possível agendar para datas passadas'
            ];
        }
        
        // Busca agendamentos existentes
        $stmt = $this->db->prepare("
            SELECT time, duration 
            FROM agendamentos 
            WHERE clinica_id = :clinica_id 
            AND date = :date 
            AND status NOT IN ('cancelled', 'no_show')
            ORDER BY time
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':date' => $date]);
        $appointments = $stmt->fetchAll();
        
        // Busca bloqueios (específicos da data ou recorrentes)
        $dayOfWeek = date('w', strtotime($date));
        $stmt = $this->db->prepare("
            SELECT start_time, end_time 
            FROM bloqueios_agenda 
            WHERE clinica_id = :clinica_id 
            AND (
                specific_date = :date 
                OR (recurring = 1 AND day_of_week = :day_of_week)
            )
        ");
        $stmt->execute([
            ':clinica_id' => $clinicaId, 
            ':date' => $date,
            ':day_of_week' => $dayOfWeek
        ]);
        $blocks = $stmt->fetchAll();
        
        // Busca horário de funcionamento do dia
        $stmt = $this->db->prepare("
            SELECT `open`, `close` 
            FROM horario_funcionamento 
            WHERE clinica_id = :clinica_id AND day = :day_of_week AND active = 1
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':day_of_week' => $dayOfWeek]);
        $workingHours = $stmt->fetch();
        
        if (!$workingHours) {
            $daysName = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
            return [
                'available' => false,
                'message' => "A clínica não funciona na {$daysName[$dayOfWeek]}"
            ];
        }
        
        // Gera slots disponíveis (a cada 30 minutos)
        $availableSlots = [];
        $startTime = strtotime($workingHours['open']);
        $endTime = strtotime($workingHours['close']);
        $now = time();
        $isToday = (date('Y-m-d') === $date);
        
        while ($startTime < $endTime) {
            $timeStr = date('H:i', $startTime);
            $isAvailable = true;
            
            // Se for hoje, não mostra horários passados
            if ($isToday && $startTime <= $now) {
                $isAvailable = false;
            }
            
            // Verifica se conflita com agendamento existente
            if ($isAvailable) {
                foreach ($appointments as $apt) {
                    $aptStart = strtotime($apt['time']);
                    $aptEnd = $aptStart + ($apt['duration'] * 60);
                    if ($startTime >= $aptStart && $startTime < $aptEnd) {
                        $isAvailable = false;
                        break;
                    }
                }
            }
            
            // Verifica se conflita com bloqueio
            if ($isAvailable) {
                foreach ($blocks as $block) {
                    $blockStart = strtotime($block['start_time']);
                    $blockEnd = strtotime($block['end_time']);
                    if ($startTime >= $blockStart && $startTime < $blockEnd) {
                        $isAvailable = false;
                        break;
                    }
                }
            }
            
            if ($isAvailable) {
                $availableSlots[] = $timeStr;
            }
            
            $startTime += 1800; // 30 minutos
        }
        
        if (empty($availableSlots)) {
            return [
                'available' => false,
                'message' => 'Não há horários disponíveis nesta data. Gostaria de tentar outra data?'
            ];
        }
        
        // Formata a data para exibição
        $dateFormatted = date('d/m/Y', strtotime($date));
        
        return [
            'available' => true,
            'date' => $date,
            'date_formatted' => $dateFormatted,
            'slots' => $availableSlots,
            'message' => "Horários disponíveis para {$dateFormatted}: " . implode(', ', array_slice($availableSlots, 0, 6))
        ];
    }
    
    /**
     * Cria um agendamento
     * Cria paciente SOMENTE aqui (quando confirma agendamento)
     */
    private function createAppointment($date, $time, $procedureName, $patientName, $patientPhone, $clinicaId) {
        // ========================================
        // VALIDAÇÕES
        // ========================================
        
        if (!$date) {
            return ['success' => false, 'error' => 'Data inválida. Use o formato correto.'];
        }
        
        if (!$time) {
            return ['success' => false, 'error' => 'Horário inválido. Use o formato HH:MM.'];
        }
        
        if (strlen($patientName) < 3) {
            return [
                'success' => false, 
                'error' => 'Nome do paciente é obrigatório. Por favor, pergunte o nome completo.'
            ];
        }
        
        // ========================================
        // BUSCA PROCEDIMENTO
        // ========================================
        
        $procedureId = null;
        $duration = 30; // default
        $procedureNameFinal = $procedureName ?: 'Consulta';
        
        if ($procedureName) {
            $stmt = $this->db->prepare("
                SELECT id, name, duration FROM procedimentos 
                WHERE clinica_id = :clinica_id AND name LIKE :name AND active = 1
                LIMIT 1
            ");
            $stmt->execute([
                ':clinica_id' => $clinicaId,
                ':name' => '%' . $procedureName . '%'
            ]);
            $procedure = $stmt->fetch();
            
            if ($procedure) {
                $procedureId = $procedure['id'];
                $duration = $procedure['duration'];
                $procedureNameFinal = $procedure['name']; // Usa nome exato do banco
            }
        }
        
        // ========================================
        // VERIFICA DISPONIBILIDADE (DUPLA CHECAGEM)
        // ========================================
        
        $availability = $this->checkAvailability($date, $clinicaId);
        if (!$availability['available']) {
            return [
                'success' => false,
                'error' => $availability['message'] ?? 'Data não disponível'
            ];
        }
        
        if (!in_array($time, $availability['slots'] ?? [])) {
            return [
                'success' => false,
                'error' => "Horário {$time} não está disponível. Horários livres: " . implode(', ', array_slice($availability['slots'], 0, 5))
            ];
        }
        
        // ========================================
        // CRIA PACIENTE (se não existe)
        // ========================================
        
        if (!$this->paciente) {
            // Usa telefone informado ou gera um temporário
            $phone = $patientPhone ?: ('WHATSAPP_' . time());
            
            try {
                $stmt = $this->db->prepare("
                    INSERT INTO pacientes (clinica_id, name, phone, is_lead, lead_source, created_at)
                    VALUES (:clinica_id, :name, :phone, 0, 'whatsapp_ia', NOW())
                ");
                $stmt->execute([
                    ':clinica_id' => $clinicaId,
                    ':name' => $patientName,
                    ':phone' => $phone
                ]);
                
                $pacienteId = $this->db->lastInsertId();
                $this->paciente = [
                    'id' => $pacienteId,
                    'name' => $patientName,
                    'phone' => $phone
                ];
                
                error_log("Paciente criado: ID {$pacienteId}, Nome: {$patientName}");
            } catch (Exception $e) {
                error_log("Erro ao criar paciente: " . $e->getMessage());
                return ['success' => false, 'error' => 'Erro ao registrar paciente'];
            }
        }
        
        // ========================================
        // CRIA AGENDAMENTO
        // ========================================
        
        try {
            // NOTA: Agenda é por clínica, não por profissional (usuario_id = NULL)
            $stmt = $this->db->prepare("
                INSERT INTO agendamentos (clinica_id, paciente_id, date, time, duration, `procedure`, procedimento_id, status, notes, created_at)
                VALUES (:clinica_id, :paciente_id, :date, :time, :duration, :procedure, :procedimento_id, 'confirmed', 'Agendado via WhatsApp IA', NOW())
            ");
            $stmt->execute([
                ':clinica_id' => $clinicaId,
                ':paciente_id' => $this->paciente['id'],
                ':date' => $date,
                ':time' => $time,
                ':duration' => $duration,
                ':procedure' => $procedureNameFinal,
                ':procedimento_id' => $procedureId
            ]);
            
            $appointmentId = $this->db->lastInsertId();
            $dateFormatted = date('d/m/Y', strtotime($date));
            
            error_log("Agendamento criado: ID {$appointmentId}, Data: {$date}, Hora: {$time}");
            
            return [
                'success' => true,
                'appointment_id' => $appointmentId,
                'patient_id' => $this->paciente['id'],
                'patient_name' => $this->paciente['name'],
                'date' => $date,
                'date_formatted' => $dateFormatted,
                'time' => $time,
                'procedure' => $procedureNameFinal,
                'message' => "Agendamento confirmado: {$procedureNameFinal} em {$dateFormatted} às {$time} para {$this->paciente['name']}"
            ];
        } catch (Exception $e) {
            error_log("Erro ao criar agendamento: " . $e->getMessage());
            return ['success' => false, 'error' => 'Erro ao criar agendamento. Tente novamente.'];
        }
    }
    
    /**
     * Transfere para atendente humano
     */
    private function transferToHuman($reason) {
        // Atualiza sessão para transferido
        if ($this->paciente) {
            try {
                $stmt = $this->db->prepare("
                    UPDATE whatsapp_sessions 
                    SET transferred_to_human = 1, status = 'transferred'
                    WHERE clinica_id = :clinica_id AND paciente_id = :paciente_id
                ");
                $stmt->execute([
                    ':clinica_id' => $this->clinica['id'],
                    ':paciente_id' => $this->paciente['id']
                ]);
            } catch (Exception $e) {
                error_log("Erro ao transferir: " . $e->getMessage());
            }
        }
        
        return [
            'success' => true,
            'transferred' => true,
            'reason' => $reason,
            'message' => 'Conversa transferida para atendimento humano. Um atendente entrará em contato em breve.'
        ];
    }
    
    /**
     * Busca procedimentos da clínica
     */
    private function getProcedures() {
        $stmt = $this->db->prepare("
            SELECT name, price, duration 
            FROM procedimentos 
            WHERE clinica_id = :clinica_id AND active = 1
            ORDER BY name
        ");
        $stmt->execute([':clinica_id' => $this->clinica['id']]);
        return $stmt->fetchAll();
    }
    
    /**
     * Busca horários de funcionamento formatados
     */
    private function getWorkingHours() {
        $days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        
        $stmt = $this->db->prepare("
            SELECT day, `open`, `close`, active 
            FROM horario_funcionamento 
            WHERE clinica_id = :clinica_id
            ORDER BY day
        ");
        $stmt->execute([':clinica_id' => $this->clinica['id']]);
        $hours = $stmt->fetchAll();
        
        $formatted = '';
        foreach ($hours as $h) {
            if ($h['active']) {
                $formatted .= $days[$h['day']] . ': ' . 
                    substr($h['open'], 0, 5) . ' às ' . 
                    substr($h['close'], 0, 5) . "\n";
            }
        }
        
        return $formatted ?: 'Horários não configurados. Entre em contato para mais informações.';
    }
    
    /**
     * Retorna label da categoria
     */
    private function getCategoryLabel($category) {
        $labels = [
            'nutricionista' => 'Nutrição',
            'dentista' => 'Odontologia',
            'psicologo' => 'Psicologia',
            'dermatologista' => 'Dermatologia',
            'pediatra' => 'Pediatria',
            'fisioterapeuta' => 'Fisioterapia',
            'oftalmologista' => 'Oftalmologia',
            'cardiologista' => 'Cardiologia',
            'esteticista' => 'Estética',
            'outro' => 'Saúde'
        ];
        return $labels[$category] ?? 'Saúde';
    }
    
    /**
     * Faz chamada para a API da OpenAI
     */
    private function callOpenAI($messages, $tools = null) {
        $url = 'https://api.openai.com/v1/chat/completions';
        
        $data = [
            'model' => $this->model,
            'messages' => $messages,
            'temperature' => 0.2,           // Baixa para consistência máxima
            'max_tokens' => 400,            // Respostas curtas
            'presence_penalty' => 0.1,      // Evita repetição de tópicos
            'frequency_penalty' => 0.1      // Evita repetição de frases
        ];
        
        if ($tools) {
            $data['tools'] = $tools;
            $data['tool_choice'] = 'auto';
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            error_log("OpenAI cURL Error: " . $error);
            return [
                'error' => true,
                'http_code' => 0,
                'message' => 'Erro de conexão: ' . $error
            ];
        }
        
        if ($httpCode !== 200) {
            error_log("OpenAI HTTP Error {$httpCode}: " . $response);
            $decoded = json_decode($response, true);
            return [
                'error' => true,
                'http_code' => $httpCode,
                'message' => $decoded['error']['message'] ?? "HTTP {$httpCode}: " . substr($response, 0, 200)
            ];
        }
        
        return json_decode($response, true);
    }
}
