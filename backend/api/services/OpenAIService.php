<?php
/**
 * StackClinic - OpenAI Service
 * Processamento de mensagens com GPT e Function Calling
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
        
        // Define as tools disponíveis
        $tools = $this->getAvailableTools();
        
        // Faz a chamada para a OpenAI
        $response = $this->callOpenAI($messages, $tools);
        
        if (!$response) {
            return [
                'success' => false,
                'error' => 'Falha ao processar com IA'
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
     * Monta o system message dinâmico baseado na clínica
     */
    private function buildSystemMessage() {
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
        foreach ($procedures as $proc) {
            $proceduresList .= "- {$proc['name']}: R$ " . number_format($proc['price'], 2, ',', '.') . " ({$proc['duration']} min)\n";
        }
        
        // Busca horários de funcionamento
        $workingHours = $this->getWorkingHours();
        
        // Tom da conversa
        $toneInstruction = match($aiTone) {
            'formal' => 'Use linguagem formal e profissional. Trate o paciente por "senhor" ou "senhora".',
            'empathetic' => 'Seja acolhedor e empático. Demonstre compreensão e cuidado com o paciente.',
            default => 'Seja amigável e natural. Use uma linguagem acessível e descontraída.',
        };
        
        $currentDate = date('d/m/Y');
        $currentTime = date('H:i');
        
        $systemPrompt = <<<PROMPT
Você é {$aiName}, assistente virtual da {$clinicName}.
Especialidade: {$category}
Data atual: {$currentDate}
Hora atual: {$currentTime}

INFORMAÇÕES DA CLÍNICA:
- Endereço: {$address}
- Telefone: {$phone}

PROCEDIMENTOS DISPONÍVEIS:
{$proceduresList}

HORÁRIOS DE FUNCIONAMENTO:
{$workingHours}

TOM DA CONVERSA:
{$toneInstruction}

INSTRUÇÕES:
1. Você pode verificar horários disponíveis usando a função checkAvailability
2. Você pode criar agendamentos usando a função createAppointment
3. Sempre confirme data, horário e procedimento antes de criar o agendamento
4. Se o paciente quiser falar com um humano, use a função transferToHuman
5. Seja objetivo mas cordial nas respostas
6. Não invente informações sobre procedimentos ou preços
7. Se não souber algo, diga que vai verificar com a equipe

{$customPrompt}
PROMPT;

        return $systemPrompt;
    }
    
    /**
     * Define as tools (functions) disponíveis para a IA
     */
    private function getAvailableTools() {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'checkAvailability',
                    'description' => 'Verifica horários disponíveis na agenda para uma data específica',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'date' => [
                                'type' => 'string',
                                'description' => 'Data no formato YYYY-MM-DD'
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
                    'description' => 'Cria um novo agendamento para o paciente',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'date' => [
                                'type' => 'string',
                                'description' => 'Data no formato YYYY-MM-DD'
                            ],
                            'time' => [
                                'type' => 'string',
                                'description' => 'Horário no formato HH:MM'
                            ],
                            'procedure_name' => [
                                'type' => 'string',
                                'description' => 'Nome do procedimento'
                            ]
                        ],
                        'required' => ['date', 'time']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'transferToHuman',
                    'description' => 'Transfere a conversa para um atendente humano',
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
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'getPatientInfo',
                    'description' => 'Busca informações do paciente atual',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [],
                        'required' => []
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
            
            // Executa a função
            $result = $this->executeFunction($functionName, $arguments);
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
        
        if (!$response) {
            return [
                'success' => false,
                'error' => 'Falha ao processar resultados das funções'
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
                return $this->checkAvailability($arguments['date'], $clinicaId);
                
            case 'createAppointment':
                return $this->createAppointment(
                    $arguments['date'],
                    $arguments['time'],
                    $arguments['procedure_name'] ?? null,
                    $clinicaId
                );
                
            case 'transferToHuman':
                return $this->transferToHuman($arguments['reason'] ?? 'Solicitação do paciente');
                
            case 'getPatientInfo':
                return $this->getPatientInfo();
                
            default:
                return ['error' => 'Função não reconhecida'];
        }
    }
    
    /**
     * Verifica horários disponíveis
     */
    private function checkAvailability($date, $clinicaId) {
        // Busca agendamentos existentes
        $stmt = $this->db->prepare("
            SELECT time, duration 
            FROM agendamentos 
            WHERE clinica_id = :clinica_id 
            AND date = :date 
            AND status != 'cancelled'
            ORDER BY time
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':date' => $date]);
        $appointments = $stmt->fetchAll();
        
        // Busca bloqueios
        $dayOfWeek = date('w', strtotime($date));
        $stmt = $this->db->prepare("
            SELECT start_time, end_time 
            FROM bloqueios_agenda 
            WHERE clinica_id = :clinica_id 
            AND (specific_date = :date OR (recurring = 1 AND day_of_week = :day_of_week))
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
            return [
                'available' => false,
                'message' => 'A clínica não funciona neste dia'
            ];
        }
        
        // Gera slots disponíveis (a cada 30 minutos)
        $availableSlots = [];
        $startTime = strtotime($workingHours['open']);
        $endTime = strtotime($workingHours['close']);
        
        while ($startTime < $endTime) {
            $timeStr = date('H:i', $startTime);
            $isAvailable = true;
            
            // Verifica se conflita com agendamento
            foreach ($appointments as $apt) {
                $aptStart = strtotime($apt['time']);
                $aptEnd = $aptStart + ($apt['duration'] * 60);
                if ($startTime >= $aptStart && $startTime < $aptEnd) {
                    $isAvailable = false;
                    break;
                }
            }
            
            // Verifica se conflita com bloqueio
            foreach ($blocks as $block) {
                $blockStart = strtotime($block['start_time']);
                $blockEnd = strtotime($block['end_time']);
                if ($startTime >= $blockStart && $startTime < $blockEnd) {
                    $isAvailable = false;
                    break;
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
                'message' => 'Não há horários disponíveis nesta data'
            ];
        }
        
        return [
            'available' => true,
            'date' => $date,
            'slots' => $availableSlots
        ];
    }
    
    /**
     * Cria um agendamento
     */
    private function createAppointment($date, $time, $procedureName, $clinicaId) {
        if (!$this->paciente) {
            return ['success' => false, 'error' => 'Paciente não identificado'];
        }
        
        // Busca procedimento se informado
        $procedureId = null;
        $duration = 30; // default
        
        if ($procedureName) {
            $stmt = $this->db->prepare("
                SELECT id, duration FROM procedimentos 
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
            }
        }
        
        // Verifica disponibilidade
        $availability = $this->checkAvailability($date, $clinicaId);
        if (!$availability['available'] || !in_array($time, $availability['slots'] ?? [])) {
            return [
                'success' => false,
                'error' => 'Horário não disponível'
            ];
        }
        
        // Cria o agendamento
        try {
            $stmt = $this->db->prepare("
                INSERT INTO agendamentos (clinica_id, patient_id, date, time, duration, procedure, procedimento_id, status, notes)
                VALUES (:clinica_id, :patient_id, :date, :time, :duration, :procedure, :procedimento_id, 'confirmed', 'Agendado via WhatsApp')
            ");
            $stmt->execute([
                ':clinica_id' => $clinicaId,
                ':patient_id' => $this->paciente['id'],
                ':date' => $date,
                ':time' => $time,
                ':duration' => $duration,
                ':procedure' => $procedureName ?? 'Consulta',
                ':procedimento_id' => $procedureId
            ]);
            
            return [
                'success' => true,
                'appointment_id' => $this->db->lastInsertId(),
                'date' => $date,
                'time' => $time,
                'procedure' => $procedureName ?? 'Consulta'
            ];
        } catch (Exception $e) {
            error_log("Erro ao criar agendamento: " . $e->getMessage());
            return ['success' => false, 'error' => 'Erro ao criar agendamento'];
        }
    }
    
    /**
     * Transfere para atendente humano
     */
    private function transferToHuman($reason) {
        // Atualiza sessão para transferido
        if ($this->paciente) {
            $stmt = $this->db->prepare("
                UPDATE whatsapp_sessions 
                SET transferred_to_human = 1, status = 'transferred'
                WHERE clinica_id = :clinica_id AND paciente_id = :paciente_id
            ");
            $stmt->execute([
                ':clinica_id' => $this->clinica['id'],
                ':paciente_id' => $this->paciente['id']
            ]);
        }
        
        return [
            'success' => true,
            'transferred' => true,
            'reason' => $reason
        ];
    }
    
    /**
     * Retorna informações do paciente
     */
    private function getPatientInfo() {
        if (!$this->paciente) {
            return ['error' => 'Paciente não identificado'];
        }
        
        return [
            'name' => $this->paciente['name'],
            'phone' => $this->paciente['phone'],
            'is_lead' => $this->paciente['is_lead'] ?? false
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
        
        return $formatted ?: 'Horários não configurados';
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
            'temperature' => 0.7,
            'max_tokens' => 1000
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
            error_log("OpenAI Error: " . $error);
            return null;
        }
        
        if ($httpCode !== 200) {
            error_log("OpenAI HTTP Error {$httpCode}: " . $response);
            return null;
        }
        
        return json_decode($response, true);
    }
}
