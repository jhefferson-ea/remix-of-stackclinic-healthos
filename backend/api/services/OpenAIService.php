<?php
/**
 * StackClinic - OpenAI Service
 * Processamento de mensagens com GPT e Function Calling
 * 
 * ARQUITETURA: Estado Explícito + Prompt Enxuto
 * - collected_data: O que já foi coletado na conversa
 * - current_step: Em qual passo da máquina de estados estamos
 * - A IA recebe estado explícito, não precisa deduzir do histórico
 * 
 * REGRAS DE NEGÓCIO:
 * - Agenda é POR CLÍNICA (não por profissional)
 * - Paciente só é criado ao CONFIRMAR agendamento
 * - Dados obrigatórios: procedimento + data + hora + nome completo
 */

class OpenAIService {
    private $apiKey;
    private $model = 'gpt-4o-mini';
    private $db;
    private $clinica;
    private $paciente;
    
    public function __construct($db, $clinica, $paciente = null) {
        $this->apiKey = getenv('OPENAI_API_KEY') ?: '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';
        $this->db = $db;
        $this->clinica = $clinica;
        $this->paciente = $paciente;
    }
    
    // ========================================
    // EXTRAÇÃO AUTOMÁTICA DE DADOS
    // ========================================
    
    /**
     * Extrai dados automaticamente da mensagem do usuário
     * Detecta nomes, telefones, datas, horários, procedimentos
     */
    public function extractDataFromMessage($message, $currentData = []) {
        $extracted = $currentData;
        $messageLower = mb_strtolower(trim($message), 'UTF-8');
        $messageOriginal = trim($message);
        
        // LOG: Debug de extração
        error_log("===== EXTRAÇÃO DE DADOS =====");
        error_log("Mensagem: {$message}");
        error_log("Dados atuais: " . json_encode($currentData));
        
        // ========================================
        // 1. DETECTA PROCEDIMENTO (com aliases e sintomas)
        // ========================================
        if (empty($extracted['procedure'])) {
            $procedures = $this->getProcedures();
            
            // 1a. Tenta match por ALIAS (ex: "canal" → "Tratamento de Canal")
            $proc = $this->findProcedureByAlias($messageLower, $this->clinica['id']);
            if ($proc) {
                $extracted['procedure'] = $proc['name'];
                $extracted['procedure_id'] = $proc['id'] ?? null;
                $extracted['procedure_duration'] = $proc['duration'] ?? 30;
                error_log("Procedimento detectado por alias: {$proc['name']}");
            }
            
            // 1b. Match exato ou parcial pelo nome
            if (empty($extracted['procedure'])) {
                foreach ($procedures as $proc) {
                    $procNameLower = mb_strtolower($proc['name'], 'UTF-8');
                    if (stripos($messageLower, $procNameLower) !== false) {
                        $extracted['procedure'] = $proc['name'];
                        $extracted['procedure_id'] = $proc['id'] ?? null;
                        $extracted['procedure_duration'] = $proc['duration'] ?? 30;
                        error_log("Procedimento detectado por nome: {$proc['name']}");
                        break;
                    }
                }
            }
            
            // 1c. SINTOMAS → Consulta (REGRA DE NEGÓCIO)
            // Quando cliente descreve problema, tratamos como Consulta
            if (empty($extracted['procedure'])) {
                $symptomKeywords = ['dor', 'doendo', 'doi', 'inchado', 'inchaço', 'sangr', 'quebr', 'caiu', 
                                    'mole', 'sensib', 'latejando', 'inflamad', 'abscess', 'problema'];
                $hasSymptom = false;
                foreach ($symptomKeywords as $kw) {
                    if (stripos($messageLower, $kw) !== false) {
                        $hasSymptom = true;
                        break;
                    }
                }
                
                if ($hasSymptom) {
                    // Busca procedimento de consulta na clínica
                    $consultaProc = $this->findProcedureByAlias('consulta', $this->clinica['id']);
                    if ($consultaProc) {
                        $extracted['procedure'] = $consultaProc['name'];
                        $extracted['procedure_id'] = $consultaProc['id'];
                        $extracted['procedure_duration'] = $consultaProc['duration'] ?? 30;
                    } else {
                        $extracted['procedure'] = 'Consulta';
                        $extracted['procedure_id'] = null;
                        $extracted['procedure_duration'] = 30;
                    }
                    error_log("Procedimento = Consulta (detectado sintoma)");
                }
            }
            
            // 1d. FALLBACK: Palavras que indicam consulta diretamente
            if (empty($extracted['procedure'])) {
                // Se menciona "consulta" explicitamente, trata como Consulta
                if (stripos($messageLower, 'consulta') !== false || 
                    stripos($messageLower, 'avalia') !== false ||
                    stripos($messageLower, 'checkup') !== false ||
                    stripos($messageLower, 'check-up') !== false) {
                    $consultaProc = $this->findProcedureByAlias('consulta', $this->clinica['id']);
                    if ($consultaProc) {
                        $extracted['procedure'] = $consultaProc['name'];
                        $extracted['procedure_id'] = $consultaProc['id'];
                        $extracted['procedure_duration'] = $consultaProc['duration'] ?? 30;
                    } else {
                        $extracted['procedure'] = 'Consulta';
                        $extracted['procedure_id'] = null;
                        $extracted['procedure_duration'] = 30;
                    }
                    error_log("Procedimento = Consulta (fallback por palavra 'consulta')");
                }
            }
            
            // 1e. Palavras genéricas que indicam agendamento (sem procedimento específico)
            if (empty($extracted['procedure']) && (
                stripos($messageLower, 'marcar') !== false ||
                stripos($messageLower, 'agendar') !== false ||
                stripos($messageLower, 'quero') !== false
            )) {
                // Não definimos procedimento - a IA deve perguntar
                error_log("Intenção de agendamento detectada, mas procedimento não especificado");
            }
        }
        
        // ========================================
        // 2. DETECTA DATA
        // ========================================
        if (empty($extracted['date'])) {
            $today = new DateTime();
            
            // "amanhã"
            if (preg_match('/amanh[aã]/iu', $messageLower)) {
                $extracted['date'] = (clone $today)->modify('+1 day')->format('Y-m-d');
            }
            // "depois de amanhã"
            elseif (preg_match('/depois\s+de\s+amanh[aã]/iu', $messageLower)) {
                $extracted['date'] = (clone $today)->modify('+2 days')->format('Y-m-d');
            }
            // "hoje"
            elseif (preg_match('/\bhoje\b/iu', $messageLower)) {
                $extracted['date'] = $today->format('Y-m-d');
            }
            // Dias da semana
            elseif (preg_match('/(segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado|domingo)/iu', $messageLower, $m)) {
                $daysMap = [
                    'segunda' => 'Monday', 'terça' => 'Tuesday', 'terca' => 'Tuesday',
                    'quarta' => 'Wednesday', 'quinta' => 'Thursday', 'sexta' => 'Friday',
                    'sábado' => 'Saturday', 'sabado' => 'Saturday', 'domingo' => 'Sunday'
                ];
                $dayName = $daysMap[mb_strtolower($m[1], 'UTF-8')] ?? null;
                if ($dayName) {
                    $nextDay = new DateTime("next {$dayName}");
                    $extracted['date'] = $nextDay->format('Y-m-d');
                }
            }
            // "dia X" ou "X/Y" ou "X de mês"
            elseif (preg_match('/dia\s+(\d{1,2})/iu', $messageLower, $m) ||
                    preg_match('/(\d{1,2})\s*\/\s*(\d{1,2})/u', $messageLower, $m) ||
                    preg_match('/(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/iu', $messageLower, $m)) {
                
                $day = (int)$m[1];
                $month = isset($m[2]) ? (int)$m[2] : (int)$today->format('m');
                $year = (int)$today->format('Y');
                
                // Se é nome do mês
                if (isset($m[2]) && !is_numeric($m[2])) {
                    $monthsMap = [
                        'janeiro' => 1, 'fevereiro' => 2, 'março' => 3, 'marco' => 3,
                        'abril' => 4, 'maio' => 5, 'junho' => 6, 'julho' => 7,
                        'agosto' => 8, 'setembro' => 9, 'outubro' => 10,
                        'novembro' => 11, 'dezembro' => 12
                    ];
                    $month = $monthsMap[mb_strtolower($m[2], 'UTF-8')] ?? (int)$today->format('m');
                }
                
                // Se a data já passou neste ano, vai para o próximo
                $dateCandidate = sprintf('%04d-%02d-%02d', $year, $month, $day);
                if (strtotime($dateCandidate) < strtotime($today->format('Y-m-d'))) {
                    $dateCandidate = sprintf('%04d-%02d-%02d', $year + 1, $month, $day);
                }
                
                if (checkdate($month, $day, (int)substr($dateCandidate, 0, 4))) {
                    $extracted['date'] = $dateCandidate;
                }
            }
        }
        
        // ========================================
        // 3. DETECTA HORÁRIO
        // ========================================
        if (empty($extracted['time'])) {
            // "14h", "14:00", "14 horas", "às 14"
            if (preg_match('/(\d{1,2})\s*[h:]\s*(\d{2})?/iu', $messageLower, $m) ||
                preg_match('/[àa]s\s+(\d{1,2})/iu', $messageLower, $m)) {
                $hour = (int)$m[1];
                $min = isset($m[2]) ? (int)$m[2] : 0;
                if ($hour >= 0 && $hour <= 23 && $min >= 0 && $min <= 59) {
                    $extracted['time'] = sprintf('%02d:%02d', $hour, $min);
                }
            }
        }
        
        // ========================================
        // 4. DETECTA NOME (2+ palavras com maiúsculas)
        // ========================================
        if (empty($extracted['patient_name'])) {
            // Padrão: Nome Sobrenome (2+ palavras começando com maiúscula)
            if (preg_match('/^([A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+[A-ZÀ-ÚÇa-zà-úç]+)+)$/u', $messageOriginal, $m)) {
                $extracted['patient_name'] = trim($m[1]);
            }
            // Padrão: "meu nome é X" ou "me chamo X" ou "sou o/a X"
            elseif (preg_match('/(?:meu\s+nome\s+[ée]|me\s+chamo|sou\s+o|sou\s+a|sou)\s+([A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+[A-ZÀ-ÚÇa-zà-úç]+)*)/iu', $messageOriginal, $m)) {
                $extracted['patient_name'] = trim($m[1]);
            }
        }
        
        // ========================================
        // 5. DETECTA TELEFONE
        // ========================================
        if (empty($extracted['patient_phone'])) {
            // Formatos: (11) 99999-9999, 11999999999, etc
            if (preg_match('/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/', $messageOriginal, $m)) {
                $extracted['patient_phone'] = preg_replace('/\D/', '', $m[0]);
            }
        }
        
        return $extracted;
    }
    
    /**
     * Determina o passo atual baseado nos dados coletados
     */
    public function determineCurrentStep($collectedData) {
        if (!empty($collectedData['patient_name']) && 
            !empty($collectedData['date']) && 
            !empty($collectedData['time']) && 
            !empty($collectedData['procedure'])) {
            return 'confirm';
        }
        if (!empty($collectedData['time'])) {
            return 'name';
        }
        if (!empty($collectedData['date'])) {
            return 'time';
        }
        if (!empty($collectedData['procedure'])) {
            return 'date';
        }
        return 'greeting';
    }
    
    /**
     * Retorna instrução do próximo passo
     */
    private function getNextStepInstruction($collectedData) {
        if (empty($collectedData['procedure'])) {
            return "O cliente ainda não escolheu o procedimento. Pergunte qual procedimento deseja agendar.";
        }
        if (empty($collectedData['date'])) {
            return "O cliente já escolheu o procedimento '{$collectedData['procedure']}'. Pergunte para qual data prefere.";
        }
        if (empty($collectedData['time'])) {
            return "O cliente quer agendar para {$collectedData['date']}. Use checkAvailability para ver horários disponíveis e mostre as opções.";
        }
        if (empty($collectedData['patient_name'])) {
            return "O cliente escolheu horário {$collectedData['time']}. Pergunte o nome completo para finalizar.";
        }
        return "TODOS OS DADOS COLETADOS! Use createAppointment para confirmar: {$collectedData['procedure']} em {$collectedData['date']} às {$collectedData['time']} para {$collectedData['patient_name']}.";
    }
    
    // ========================================
    // PROCESSAMENTO COM ESTADO
    // ========================================
    
    /**
     * Processa mensagem com estado explícito
     */
    public function processMessageWithState($message, $history, $collectedData, $currentStep) {
        $systemMessage = $this->buildSystemMessageWithState($collectedData, $currentStep);
        
        // LOG: Debug
        error_log("===== ESTADO ATUAL =====");
        error_log("Step: {$currentStep}");
        error_log("Dados: " . json_encode($collectedData));
        
        $messages = [
            ['role' => 'system', 'content' => $systemMessage]
        ];
        
        // Adiciona apenas últimas 6 mensagens do histórico (3 trocas)
        $recentHistory = array_slice($history, -6);
        foreach ($recentHistory as $msg) {
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
        
        if (!$response || isset($response['error'])) {
            $errorMsg = $response['message'] ?? 'Falha ao conectar com a IA';
            error_log("OpenAI Error: " . json_encode($response));
            return [
                'success' => false,
                'error' => $errorMsg,
                'collected_data' => $collectedData
            ];
        }
        
        // Verifica se há function calls
        $assistantMessage = $response['choices'][0]['message'] ?? null;
        
        if (isset($assistantMessage['tool_calls'])) {
            // Passa collectedData para handleToolCalls para atualização
            $result = $this->handleToolCalls($assistantMessage, $messages, $tools, $collectedData);
            return $result; // collected_data já é atualizado dentro de handleToolCalls
        }
        
        return [
            'success' => true,
            'response' => $assistantMessage['content'] ?? 'Desculpe, não consegui processar sua mensagem.',
            'tokens_used' => $response['usage']['total_tokens'] ?? 0,
            'function_calls' => null,
            'collected_data' => $collectedData
        ];
    }
    
    /**
     * Monta system message COM ESTADO EXPLÍCITO (prompt anti-alucinação)
     */
    private function buildSystemMessageWithState($collectedData, $currentStep) {
        $clinicName = $this->clinica['name'] ?? 'Clínica';
        $aiName = $this->clinica['ai_name'] ?? 'Atendente';
        $aiTone = $this->clinica['ai_tone'] ?? 'casual';
        
        // Data/hora atual
        $currentDate = date('d/m/Y');
        $currentTime = date('H:i');
        $currentDateISO = date('Y-m-d');
        $daysOfWeek = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
        $currentDayName = $daysOfWeek[date('w')];
        
        // Busca procedimentos
        $procedures = $this->getProcedures();
        $proceduresList = empty($procedures) ? "- Consulta Geral\n" : '';
        foreach ($procedures as $proc) {
            $proceduresList .= "- {$proc['name']}\n";
        }
        
        // Estado explícito com formatação clara
        $procStatus = $collectedData['procedure'] ? "✅ {$collectedData['procedure']}" : '❌ NÃO INFORMADO';
        $dateStatus = $collectedData['date'] ? "✅ " . date('d/m/Y', strtotime($collectedData['date'])) : '❌ NÃO INFORMADO';
        $timeStatus = $collectedData['time'] ? "✅ {$collectedData['time']}" : '❌ NÃO INFORMADO';
        $nameStatus = $collectedData['patient_name'] ? "✅ {$collectedData['patient_name']}" : '❌ NÃO INFORMADO';
        
        $nextStep = $this->getNextStepInstruction($collectedData);

        // Tom
        $toneInstruction = match($aiTone) {
            'formal' => 'Use "senhor/senhora".',
            'empathetic' => 'Seja acolhedor.',
            default => 'Seja amigável.',
        };

        $systemPrompt = <<<PROMPT
Você é {$aiName}, atendente da {$clinicName}. HOJE: {$currentDate} ({$currentDayName}) às {$currentTime}

PROCEDIMENTOS: {$proceduresList}

═══════════════════════════════════════
ESTADO ATUAL DA CONVERSA (LEIA COM ATENÇÃO)
═══════════════════════════════════════
Procedimento: {$procStatus}
Data: {$dateStatus}
Horário: {$timeStatus}
Nome: {$nameStatus}

PRÓXIMO PASSO: {$nextStep}
═══════════════════════════════════════

REGRAS ABSOLUTAS (SIGA OU A CONVERSA FALHARÁ):

1. NUNCA SUGIRA procedimentos. O sistema já detectou automaticamente acima.
2. Se Procedimento = "NÃO INFORMADO", pergunte: "Qual procedimento deseja?"
3. Se Procedimento = ✅, NÃO pergunte de novo. Vá para o próximo campo ❌.
4. MÁXIMO 2 frases curtas. UMA pergunta por vez.
5. Use checkAvailability ANTES de oferecer horários.
6. Só use createAppointment quando TODOS estiverem ✅.
7. NUNCA invente dados. Use EXATAMENTE o que está acima.

EXEMPLOS:
- Se Procedimento=✅ e Data=❌ → "Para qual data prefere?"
- Se Data=✅ e Horário=❌ → chame checkAvailability, depois mostre opções
- Se Horário=✅ e Nome=❌ → "Qual seu nome completo?"
- Se TODOS=✅ → chame createAppointment

TOM: {$toneInstruction}
PROMPT;

        return $systemPrompt;
    }
    
    /**
     * Busca procedimento por alias/variação comum
     */
    private function findProcedureByAlias($term, $clinicaId) {
        // Mapeamento de aliases para categorias de procedimento
        $aliases = [
            'canal' => ['canal', 'endodontia', 'tratamento de canal', 'tratar canal'],
            'siso' => ['siso', 'terceiro molar', 'dente do juízo', 'juizo'],
            'extração' => ['extração', 'extrair', 'arrancar'],
            'limpeza' => ['limpeza', 'profilaxia', 'tartaro', 'tártaro'],
            'clareamento' => ['clareamento', 'branqueamento', 'clarear'],
            'implante' => ['implante', 'implant'],
            'ortodontia' => ['aparelho', 'ortodont', 'alinhar', 'alinhador'],
            'consulta' => ['consulta', 'avaliação', 'avaliaç', 'checkup', 'check-up', 'avaliar']
        ];
        
        $termLower = mb_strtolower(trim($term), 'UTF-8');
        
        foreach ($aliases as $category => $terms) {
            foreach ($terms as $alias) {
                if (stripos($termLower, $alias) !== false) {
                    // Busca procedimento que contenha a categoria ou o alias
                    $stmt = $this->db->prepare("
                        SELECT id, name, duration FROM procedimentos 
                        WHERE clinica_id = :cid AND active = 1 
                        AND (LOWER(name) LIKE :term1 OR LOWER(name) LIKE :term2)
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
    
    // ========================================
    // MÉTODO LEGADO (compatibilidade)
    // ========================================
    
    public function processMessage($message, $conversationHistory = []) {
        // Extrai dados da conversa atual
        $collectedData = [
            'procedure' => null,
            'date' => null,
            'time' => null,
            'patient_name' => null,
            'patient_phone' => null
        ];
        
        // Tenta extrair dados de todo o histórico
        foreach ($conversationHistory as $msg) {
            if ($msg['direction'] === 'incoming') {
                $collectedData = $this->extractDataFromMessage($msg['message'], $collectedData);
            }
        }
        
        // Extrai da mensagem atual
        $collectedData = $this->extractDataFromMessage($message, $collectedData);
        $currentStep = $this->determineCurrentStep($collectedData);
        
        return $this->processMessageWithState($message, $conversationHistory, $collectedData, $currentStep);
    }
    
    // ========================================
    // TOOLS (FUNCTION CALLING)
    // ========================================
    
    private function getAvailableTools() {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'checkAvailability',
                    'description' => 'Verifica horários disponíveis para uma data. Use SEMPRE antes de oferecer horários.',
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
                    'description' => 'Cria agendamento. Só chame quando tiver TODOS: data, horário, procedimento e nome completo.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'date' => ['type' => 'string', 'description' => 'Data YYYY-MM-DD'],
                            'time' => ['type' => 'string', 'description' => 'Horário HH:MM'],
                            'procedure_name' => ['type' => 'string', 'description' => 'Nome do procedimento'],
                            'patient_name' => ['type' => 'string', 'description' => 'Nome completo do paciente (OBRIGATÓRIO)'],
                            'patient_phone' => ['type' => 'string', 'description' => 'Telefone (opcional)']
                        ],
                        'required' => ['date', 'time', 'procedure_name', 'patient_name']
                    ]
                ]
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'transferToHuman',
                    'description' => 'Transfere para atendente humano quando solicitado.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'reason' => ['type' => 'string', 'description' => 'Motivo']
                        ],
                        'required' => ['reason']
                    ]
                ]
            ]
        ];
    }
    
    private function handleToolCalls($assistantMessage, $messages, $tools, $collectedData = []) {
        $toolCalls = $assistantMessage['tool_calls'];
        $functionResults = [];
        $updatedCollectedData = $collectedData;
        
        $messages[] = $assistantMessage;
        
        foreach ($toolCalls as $toolCall) {
            $functionName = $toolCall['function']['name'];
            $arguments = json_decode($toolCall['function']['arguments'], true) ?? [];
            
            error_log("===== TOOL CALL: {$functionName} =====");
            error_log("Args: " . json_encode($arguments));
            
            $result = $this->executeFunction($functionName, $arguments);
            
            error_log("Result: " . json_encode($result));
            
            // ATUALIZA ESTADO BASEADO NOS TOOL CALLS
            if ($functionName === 'checkAvailability' && !empty($arguments['date'])) {
                $updatedCollectedData['date'] = $arguments['date'];
            }
            if ($functionName === 'createAppointment' && ($result['success'] ?? false)) {
                // Limpa estado após agendamento confirmado
                $updatedCollectedData = [
                    'procedure' => null,
                    'date' => null,
                    'time' => null,
                    'patient_name' => null,
                    'patient_phone' => null
                ];
            }
            
            $functionResults[] = [
                'function' => $functionName,
                'arguments' => $arguments,
                'result' => $result
            ];
            
            $messages[] = [
                'role' => 'tool',
                'tool_call_id' => $toolCall['id'],
                'content' => json_encode($result)
            ];
        }
        
        // Nova chamada para processar resultados
        $response = $this->callOpenAI($messages, $tools);
        
        if (!$response || isset($response['error'])) {
            return [
                'success' => false,
                'error' => $response['message'] ?? 'Falha ao processar resultados',
                'function_calls' => $functionResults,
                'collected_data' => $updatedCollectedData
            ];
        }
        
        $finalMessage = $response['choices'][0]['message']['content'] ?? 'Pronto! Como posso ajudar mais?';
        
        return [
            'success' => true,
            'response' => $finalMessage,
            'tokens_used' => $response['usage']['total_tokens'] ?? 0,
            'function_calls' => $functionResults,
            'collected_data' => $updatedCollectedData
        ];
    }
    
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
    // SANITIZAÇÃO
    // ========================================
    
    private function sanitizeString($value) {
        if (!$value) return '';
        return trim(strip_tags($value));
    }
    
    private function sanitizeDate($value) {
        if (!$value) return null;
        $clean = preg_replace('/[^0-9\-]/', '', $value);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $clean)) return null;
        $parts = explode('-', $clean);
        if (!checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) return null;
        return $clean;
    }
    
    private function sanitizeTime($value) {
        if (!$value) return null;
        $clean = preg_replace('/[^0-9:]/', '', $value);
        if (!preg_match('/^\d{2}:\d{2}$/', $clean)) {
            if (preg_match('/^(\d{1,2}):(\d{2})$/', $clean, $matches)) {
                $clean = str_pad($matches[1], 2, '0', STR_PAD_LEFT) . ':' . $matches[2];
            } else {
                return null;
            }
        }
        $parts = explode(':', $clean);
        if ((int)$parts[0] > 23 || (int)$parts[1] > 59) return null;
        return $clean;
    }
    
    private function sanitizePhone($value) {
        if (!$value) return '';
        return preg_replace('/[^0-9]/', '', $value);
    }
    
    // ========================================
    // FUNÇÕES DE NEGÓCIO
    // ========================================
    
    private function checkAvailability($date, $clinicaId) {
        if (strtotime($date) < strtotime(date('Y-m-d'))) {
            return ['available' => false, 'message' => 'Não é possível agendar para datas passadas'];
        }
        
        // Agendamentos existentes
        $stmt = $this->db->prepare("
            SELECT time, duration FROM agendamentos 
            WHERE clinica_id = :clinica_id AND date = :date AND status NOT IN ('cancelled', 'no_show')
            ORDER BY time
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':date' => $date]);
        $appointments = $stmt->fetchAll();
        
        // Bloqueios
        $dayOfWeek = date('w', strtotime($date));
        $stmt = $this->db->prepare("
            SELECT start_time, end_time FROM bloqueios_agenda 
            WHERE clinica_id = :clinica_id AND (specific_date = :date OR (recurring = 1 AND day_of_week = :day_of_week))
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':date' => $date, ':day_of_week' => $dayOfWeek]);
        $blocks = $stmt->fetchAll();
        
        // Horário de funcionamento
        $stmt = $this->db->prepare("
            SELECT `open`, `close` FROM horario_funcionamento 
            WHERE clinica_id = :clinica_id AND day = :day_of_week AND active = 1
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':day_of_week' => $dayOfWeek]);
        $workingHours = $stmt->fetch();
        
        if (!$workingHours) {
            $daysName = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
            return ['available' => false, 'message' => "A clínica não funciona na {$daysName[$dayOfWeek]}"];
        }
        
        // Gera slots
        $availableSlots = [];
        $startTime = strtotime($workingHours['open']);
        $endTime = strtotime($workingHours['close']);
        $now = time();
        $isToday = (date('Y-m-d') === $date);
        
        while ($startTime < $endTime) {
            $timeStr = date('H:i', $startTime);
            $isAvailable = true;
            
            if ($isToday && $startTime <= $now) $isAvailable = false;
            
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
            
            if ($isAvailable) $availableSlots[] = $timeStr;
            $startTime += 1800;
        }
        
        if (empty($availableSlots)) {
            return ['available' => false, 'message' => 'Não há horários disponíveis nesta data. Gostaria de tentar outra data?'];
        }
        
        $dateFormatted = date('d/m/Y', strtotime($date));
        return [
            'available' => true,
            'date' => $date,
            'date_formatted' => $dateFormatted,
            'slots' => $availableSlots,
            'message' => "Horários disponíveis para {$dateFormatted}: " . implode(', ', array_slice($availableSlots, 0, 6))
        ];
    }
    
    private function createAppointment($date, $time, $procedureName, $patientName, $patientPhone, $clinicaId) {
        if (!$date) return ['success' => false, 'error' => 'Data inválida.'];
        if (!$time) return ['success' => false, 'error' => 'Horário inválido.'];
        if (strlen($patientName) < 3) return ['success' => false, 'error' => 'Nome do paciente é obrigatório.'];
        
        // Busca procedimento
        $procedureId = null;
        $duration = 30;
        $procedureNameFinal = $procedureName ?: 'Consulta';
        
        if ($procedureName) {
            $stmt = $this->db->prepare("
                SELECT id, name, duration FROM procedimentos 
                WHERE clinica_id = :clinica_id AND name LIKE :name AND active = 1 LIMIT 1
            ");
            $stmt->execute([':clinica_id' => $clinicaId, ':name' => '%' . $procedureName . '%']);
            $procedure = $stmt->fetch();
            if ($procedure) {
                $procedureId = $procedure['id'];
                $duration = $procedure['duration'];
                $procedureNameFinal = $procedure['name'];
            }
        }
        
        // Verifica disponibilidade
        $availability = $this->checkAvailability($date, $clinicaId);
        if (!$availability['available']) {
            return ['success' => false, 'error' => $availability['message'] ?? 'Data não disponível'];
        }
        if (!in_array($time, $availability['slots'] ?? [])) {
            return ['success' => false, 'error' => "Horário {$time} não disponível. Horários livres: " . implode(', ', array_slice($availability['slots'], 0, 5))];
        }
        
        // Cria paciente
        if (!$this->paciente) {
            $phone = $patientPhone ?: ('WHATSAPP_' . time());
            try {
                $stmt = $this->db->prepare("
                    INSERT INTO pacientes (clinica_id, name, phone, is_lead, lead_source, created_at)
                    VALUES (:clinica_id, :name, :phone, 0, 'whatsapp_ia', NOW())
                ");
                $stmt->execute([':clinica_id' => $clinicaId, ':name' => $patientName, ':phone' => $phone]);
                $pacienteId = $this->db->lastInsertId();
                $this->paciente = ['id' => $pacienteId, 'name' => $patientName, 'phone' => $phone];
                error_log("Paciente criado: ID {$pacienteId}");
            } catch (Exception $e) {
                error_log("Erro paciente: " . $e->getMessage());
                return ['success' => false, 'error' => 'Erro ao registrar paciente'];
            }
        }
        
        // Cria agendamento
        try {
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
            
            error_log("Agendamento criado: ID {$appointmentId}");
            
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
            error_log("Erro agendamento: " . $e->getMessage());
            return ['success' => false, 'error' => 'Erro ao criar agendamento.'];
        }
    }
    
    private function transferToHuman($reason) {
        if ($this->paciente) {
            try {
                $stmt = $this->db->prepare("
                    UPDATE whatsapp_sessions SET transferred_to_human = 1, status = 'transferred'
                    WHERE clinica_id = :clinica_id AND paciente_id = :paciente_id
                ");
                $stmt->execute([':clinica_id' => $this->clinica['id'], ':paciente_id' => $this->paciente['id']]);
            } catch (Exception $e) {
                error_log("Erro transferir: " . $e->getMessage());
            }
        }
        return [
            'success' => true,
            'transferred' => true,
            'reason' => $reason,
            'message' => 'Conversa transferida para atendimento humano.'
        ];
    }
    
    public function getProcedures() {
        $stmt = $this->db->prepare("
            SELECT id, name, price, duration FROM procedimentos 
            WHERE clinica_id = :clinica_id AND active = 1 ORDER BY name
        ");
        $stmt->execute([':clinica_id' => $this->clinica['id']]);
        return $stmt->fetchAll();
    }
    
    private function getWorkingHours() {
        $days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        $stmt = $this->db->prepare("
            SELECT day, `open`, `close`, active FROM horario_funcionamento 
            WHERE clinica_id = :clinica_id ORDER BY day
        ");
        $stmt->execute([':clinica_id' => $this->clinica['id']]);
        $hours = $stmt->fetchAll();
        
        $formatted = '';
        foreach ($hours as $h) {
            if ($h['active']) {
                $formatted .= $days[$h['day']] . ': ' . substr($h['open'], 0, 5) . ' às ' . substr($h['close'], 0, 5) . "\n";
            }
        }
        return $formatted ?: 'Horários não configurados.';
    }
    
    private function getCategoryLabel($category) {
        $labels = [
            'nutricionista' => 'Nutrição', 'dentista' => 'Odontologia', 'psicologo' => 'Psicologia',
            'dermatologista' => 'Dermatologia', 'pediatra' => 'Pediatria', 'fisioterapeuta' => 'Fisioterapia',
            'oftalmologista' => 'Oftalmologia', 'cardiologista' => 'Cardiologia', 'esteticista' => 'Estética',
            'outro' => 'Saúde'
        ];
        return $labels[$category] ?? 'Saúde';
    }
    
    private function callOpenAI($messages, $tools = null) {
        $url = 'https://api.openai.com/v1/chat/completions';
        
        $data = [
            'model' => $this->model,
            'messages' => $messages,
            'temperature' => 0.2,
            'max_tokens' => 300,
            'presence_penalty' => 0.1,
            'frequency_penalty' => 0.1
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
            return ['error' => true, 'http_code' => 0, 'message' => 'Erro de conexão: ' . $error];
        }
        
        if ($httpCode !== 200) {
            error_log("OpenAI HTTP Error {$httpCode}: " . $response);
            $decoded = json_decode($response, true);
            return ['error' => true, 'http_code' => $httpCode, 'message' => $decoded['error']['message'] ?? "HTTP {$httpCode}"];
        }
        
        return json_decode($response, true);
    }
}
