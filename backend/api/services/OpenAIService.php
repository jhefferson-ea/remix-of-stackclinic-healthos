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
 * REGRAS DE NEGÓCIO (v2 - MULTI-PROFISSIONAL):
 * - Cada profissional pode ter procedimentos específicos
 * - Se múltiplos profissionais fazem o procedimento, pergunta preferência
 * - Algoritmo de balanceamento quando paciente não escolhe
 * - Profissional sem horário individual usa horário da clínica como fallback
 * - Dados obrigatórios: procedimento + [profissional se múltiplos] + data + hora + nome completo
 */

// Garante timezone de Brasília para todas as operações de data/hora
date_default_timezone_set('America/Sao_Paulo');

class OpenAIService {
    private $apiKey;
    private $model = 'gpt-4o-mini';
    private $db;
    private $clinica;
    private $paciente;
    private $sessionPhone;
    
    public function __construct($db, $clinica, $paciente = null) {
        $this->apiKey = getenv('OPENAI_API_KEY') ?: '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';
        $this->db = $db;
        $this->clinica = $clinica;
        $this->paciente = $paciente;
        $this->sessionPhone = null;
    }
    
    /**
     * Define o session_phone para vincular conversas a agendamentos
     */
    public function setSessionPhone($sessionPhone) {
        $this->sessionPhone = $sessionPhone;
    }
    
    // ========================================
    // MULTI-PROFISSIONAL: FUNÇÕES AUXILIARES
    // ========================================
    
    /**
     * Busca profissionais que executam um procedimento específico
     * Retorna lista de profissionais habilitados OU todos os médicos se não há vínculo
     */
    private function findProfessionalsForProcedure($procedureId, $clinicaId) {
        if (!$procedureId) {
            // Sem procedimento específico, retorna todos os médicos ativos
            return $this->getAllDoctors($clinicaId);
        }
        
        // Busca profissionais vinculados ao procedimento
        $stmt = $this->db->prepare("
            SELECT u.id, u.name, u.specialty, u.color
            FROM usuarios u
            INNER JOIN profissional_procedimentos pp ON pp.usuario_id = u.id
            WHERE pp.procedimento_id = :proc_id 
            AND pp.clinica_id = :clinica_id
            AND u.active = 1 
            AND u.role = 'doctor'
            ORDER BY u.name
        ");
        $stmt->execute([':proc_id' => $procedureId, ':clinica_id' => $clinicaId]);
        $professionals = $stmt->fetchAll();
        
        // Se não há vínculos, retorna todos os médicos (fallback)
        if (empty($professionals)) {
            return $this->getAllDoctors($clinicaId);
        }
        
        return $professionals;
    }
    
    /**
     * Retorna todos os médicos ativos da clínica
     */
    private function getAllDoctors($clinicaId) {
        $stmt = $this->db->prepare("
            SELECT id, name, specialty, color 
            FROM usuarios 
            WHERE clinica_id = :clinica_id AND active = 1 AND role = 'doctor'
            ORDER BY name
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        return $stmt->fetchAll();
    }

    /**
     * Garante que um usuario_id recebido (ex.: via tool calling) é um MÉDICO válido da clínica.
     */
    private function isValidDoctorId($usuarioId, $clinicaId) {
        if (!$usuarioId) return false;
        $stmt = $this->db->prepare("SELECT id FROM usuarios WHERE id = :id AND clinica_id = :clinica_id AND active = 1 AND role = 'doctor' LIMIT 1");
        $stmt->execute([':id' => (int)$usuarioId, ':clinica_id' => (int)$clinicaId]);
        return (bool)($stmt->fetch());
    }
    
    /**
     * Algoritmo de balanceamento: seleciona profissional com menos agendamentos na data
     */
    private function selectProfessionalByBalance($professionals, $date, $clinicaId) {
        if (empty($professionals)) return null;
        if (count($professionals) === 1) return $professionals[0];
        
        $minAppointments = PHP_INT_MAX;
        $selectedProfessional = $professionals[0];
        
        foreach ($professionals as $prof) {
            // Conta agendamentos do profissional na data
            $stmt = $this->db->prepare("
                SELECT COUNT(*) as total 
                FROM agendamentos 
                WHERE clinica_id = :clinica_id 
                AND usuario_id = :usuario_id 
                AND date = :date 
                AND status NOT IN ('cancelled', 'no_show')
            ");
            $stmt->execute([
                ':clinica_id' => $clinicaId,
                ':usuario_id' => $prof['id'],
                ':date' => $date
            ]);
            $result = $stmt->fetch();
            $count = $result['total'] ?? 0;
            
            if ($count < $minAppointments) {
                $minAppointments = $count;
                $selectedProfessional = $prof;
            }
        }
        
        error_log("Balanceamento: Selecionado {$selectedProfessional['name']} (menor carga na data {$date})");
        return $selectedProfessional;
    }
    
    /**
     * Busca profissional por nome parcial
     */
    private function findProfessionalByName($name, $clinicaId) {
        if (!$name) return null;
        
        $nameLower = mb_strtolower(trim($name), 'UTF-8');
        
        $stmt = $this->db->prepare("
            SELECT id, name, specialty, color 
            FROM usuarios 
            WHERE clinica_id = :clinica_id 
            AND active = 1 
            AND role = 'doctor'
            AND LOWER(name) LIKE :name
            LIMIT 1
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':name' => '%' . $nameLower . '%']);
        return $stmt->fetch() ?: null;
    }
    
    /**
     * Busca horário de funcionamento do profissional (ou fallback para clínica)
     */
    private function getProfessionalWorkingHours($usuarioId, $clinicaId, $dayOfWeek) {
        // Primeiro tenta horário individual do profissional
        if ($usuarioId) {
            $stmt = $this->db->prepare("
                SELECT `open`, `close` FROM horario_profissional 
                WHERE usuario_id = :usuario_id AND day = :day AND active = 1
            ");
            $stmt->execute([':usuario_id' => $usuarioId, ':day' => $dayOfWeek]);
            $hours = $stmt->fetch();
            if ($hours) {
                error_log("Usando horário INDIVIDUAL do profissional {$usuarioId} para dia {$dayOfWeek}");
                return $hours;
            }
        }
        
        // Fallback: horário da clínica
        $stmt = $this->db->prepare("
            SELECT `open`, `close` FROM horario_funcionamento 
            WHERE clinica_id = :clinica_id AND day = :day AND active = 1
        ");
        $stmt->execute([':clinica_id' => $clinicaId, ':day' => $dayOfWeek]);
        return $stmt->fetch() ?: null;
    }
    
    /**
     * Verifica bloqueios do profissional (ou bloqueios gerais se usuario_id = NULL)
     */
    private function getProfessionalBlocks($usuarioId, $clinicaId, $date, $dayOfWeek) {
        // Bloqueios específicos do profissional + bloqueios gerais da clínica
        $stmt = $this->db->prepare("
            SELECT start_time, end_time FROM bloqueios_agenda 
            WHERE clinica_id = :clinica_id 
            AND (usuario_id IS NULL OR usuario_id = :usuario_id)
            AND (specific_date = :date OR (recurring = 1 AND day_of_week = :day_of_week))
        ");
        $stmt->execute([
            ':clinica_id' => $clinicaId, 
            ':usuario_id' => $usuarioId,
            ':date' => $date, 
            ':day_of_week' => $dayOfWeek
        ]);
        return $stmt->fetchAll();
    }
    
    // ========================================
    // EXTRAÇÃO AUTOMÁTICA DE DADOS
    // ========================================
    
    /**
     * Extrai dados automaticamente da mensagem do usuário
     * Detecta nomes, telefones, datas, horários, procedimentos, preferência de profissional
     */
    public function extractDataFromMessage($message, $currentData = []) {
        $extracted = $currentData;
        $messageLower = mb_strtolower(trim($message), 'UTF-8');
        $messageOriginal = trim($message);
        
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
                error_log("Intenção de agendamento detectada, mas procedimento não especificado");
            }
        }
        
        // ========================================
        // 2. DETECTA PREFERÊNCIA DE PROFISSIONAL
        // ========================================
        if (empty($extracted['professional_id']) && !empty($extracted['procedure_id'])) {
            // Verifica se usuário mencionou preferência de profissional
            $professionals = $this->findProfessionalsForProcedure($extracted['procedure_id'], $this->clinica['id']);
            
            // Detecta se disse "qualquer um", "tanto faz", "sem preferência"
            $noPreference = preg_match('/qualquer\s*(um|profissional|m[eé]dico)?|tanto\s+faz|sem\s+prefer[eê]ncia|n[aã]o\s+(tenho|tem)\s+prefer/iu', $messageLower);
            
            if ($noPreference && count($professionals) > 1) {
                // Marca para usar balanceamento automático
                $extracted['professional_preference'] = 'auto';
                error_log("Profissional: cliente sem preferência, usará balanceamento automático");
            } else {
                // Tenta encontrar nome de profissional na mensagem
                foreach ($professionals as $prof) {
                    $profNameLower = mb_strtolower($prof['name'], 'UTF-8');
                    // Extrai primeiro nome e sobrenome para match flexível
                    $nameParts = explode(' ', $profNameLower);
                    foreach ($nameParts as $part) {
                        if (strlen($part) > 2 && stripos($messageLower, $part) !== false) {
                            $extracted['professional_id'] = $prof['id'];
                            $extracted['professional_name'] = $prof['name'];
                            error_log("Profissional detectado: {$prof['name']}");
                            break 2;
                        }
                    }
                }

                // Se mencionou um médico explicitamente e NÃO encontramos na lista, marcamos como inválido
                // para que a IA responda corretamente (sem inventar nomes).
                if (empty($extracted['professional_id'])) {
                    $requestedName = null;

                    // Ex.: "Dr. João Silva", "Doutora Maria"
                    if (preg_match('/\b(dr\.?|dra\.?|doutor(a)?)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3})/iu', $messageOriginal, $m)) {
                        $requestedName = trim($m[3]);
                    }

                    // Ex.: "com o João", "com a Maria"
                    if (!$requestedName && preg_match('/\bcom\s+(?:o|a)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3})/iu', $messageOriginal, $m2)) {
                        $requestedName = trim($m2[1]);
                    }

                    if ($requestedName) {
                        $found = $this->findProfessionalByName($requestedName, $this->clinica['id']);
                        if ($found) {
                            $extracted['professional_id'] = $found['id'];
                            $extracted['professional_name'] = $found['name'];
                            error_log("Profissional detectado por regex: {$found['name']}");
                        } else {
                            $extracted['professional_invalid_name'] = $requestedName;
                            error_log("Profissional solicitado não existe na clínica: {$requestedName}");
                        }
                    }
                }
            }
        }
        
        // ========================================
        // 3. DETECTA DATA
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
                
                if (isset($m[2]) && !is_numeric($m[2])) {
                    $monthsMap = [
                        'janeiro' => 1, 'fevereiro' => 2, 'março' => 3, 'marco' => 3,
                        'abril' => 4, 'maio' => 5, 'junho' => 6, 'julho' => 7,
                        'agosto' => 8, 'setembro' => 9, 'outubro' => 10,
                        'novembro' => 11, 'dezembro' => 12
                    ];
                    $month = $monthsMap[mb_strtolower($m[2], 'UTF-8')] ?? (int)$today->format('m');
                }
                
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
        // 4. DETECTA HORÁRIO
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
        // 5. DETECTA NOME (2+ palavras com maiúsculas)
        // ========================================
        if (empty($extracted['patient_name'])) {
            if (preg_match('/^([A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+[A-ZÀ-ÚÇa-zà-úç]+)+)$/u', $messageOriginal, $m)) {
                $extracted['patient_name'] = trim($m[1]);
            }
            elseif (preg_match('/(?:meu\s+nome\s+[ée]|me\s+chamo|sou\s+o|sou\s+a|sou)\s+([A-ZÀ-ÚÇ][a-zà-úç]+(?:\s+[A-ZÀ-ÚÇa-zà-úç]+)*)/iu', $messageOriginal, $m)) {
                $extracted['patient_name'] = trim($m[1]);
            }
        }
        
        // ========================================
        // 6. DETECTA TELEFONE
        // ========================================
        if (empty($extracted['patient_phone'])) {
            if (preg_match('/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/', $messageOriginal, $m)) {
                $extracted['patient_phone'] = preg_replace('/\D/', '', $m[0]);
            }
        }
        
        return $extracted;
    }
    
    /**
     * Determina o passo atual baseado nos dados coletados
     * Fluxo v2: procedimento -> [profissional se múltiplos] -> data -> horário -> nome -> telefone -> confirmação
     */
    public function determineCurrentStep($collectedData) {
        // Verifica se precisa perguntar profissional
        $needsProfessional = $this->needsProfessionalSelection($collectedData);
        
        if (!empty($collectedData['patient_name']) && 
            !empty($collectedData['patient_phone']) &&
            !empty($collectedData['date']) && 
            !empty($collectedData['time']) && 
            !empty($collectedData['procedure']) &&
            (!$needsProfessional || !empty($collectedData['professional_id']) || $collectedData['professional_preference'] === 'auto')) {
            return 'confirm';
        }
        if (!empty($collectedData['patient_name'])) {
            return 'phone';
        }
        if (!empty($collectedData['time'])) {
            return 'name';
        }
        if (!empty($collectedData['date'])) {
            return 'time';
        }
        // NOVO: Se tem procedimento mas precisa escolher profissional
        if (!empty($collectedData['procedure']) && $needsProfessional && 
            empty($collectedData['professional_id']) && ($collectedData['professional_preference'] ?? '') !== 'auto') {
            return 'professional';
        }
        if (!empty($collectedData['procedure'])) {
            return 'date';
        }
        return 'greeting';
    }
    
    /**
     * Verifica se precisa perguntar preferência de profissional
     */
    private function needsProfessionalSelection($collectedData) {
        if (empty($collectedData['procedure_id'])) return false;
        
        $professionals = $this->findProfessionalsForProcedure(
            $collectedData['procedure_id'], 
            $this->clinica['id']
        );
        
        // Se mais de 1 profissional faz o procedimento, precisa perguntar
        return count($professionals) > 1;
    }
    
    /**
     * Retorna instrução do próximo passo (atualizado para multi-profissional)
     */
    private function getNextStepInstruction($collectedData) {
        if (empty($collectedData['procedure'])) {
            return "O cliente ainda não escolheu o procedimento. Pergunte qual procedimento deseja agendar.";
        }
        
        // NOVO: Verifica se precisa perguntar profissional
        if ($this->needsProfessionalSelection($collectedData)) {
            if (empty($collectedData['professional_id']) && ($collectedData['professional_preference'] ?? '') !== 'auto') {
                $professionals = $this->findProfessionalsForProcedure($collectedData['procedure_id'], $this->clinica['id']);
                $names = array_map(fn($p) => $p['name'], $professionals);
                return "O cliente escolheu {$collectedData['procedure']}. Pergunte se tem preferência por algum profissional: " . implode(', ', $names) . ". Ou pode dizer 'qualquer um'.";
            }
        }
        
        if (empty($collectedData['date'])) {
            $profInfo = !empty($collectedData['professional_name']) ? " com {$collectedData['professional_name']}" : "";
            return "O cliente já escolheu {$collectedData['procedure']}{$profInfo}. Pergunte para qual data prefere.";
        }
        if (empty($collectedData['time'])) {
            return "O cliente quer agendar para {$collectedData['date']}. Use checkAvailability para ver horários disponíveis e mostre as opções.";
        }
        if (empty($collectedData['patient_name'])) {
            return "O cliente escolheu horário {$collectedData['time']}. Pergunte o nome completo para finalizar.";
        }
        if (empty($collectedData['patient_phone'])) {
            return "O cliente informou nome '{$collectedData['patient_name']}'. Pergunte o telefone para contato (com DDD).";
        }
        
        $profInfo = !empty($collectedData['professional_name']) ? " com {$collectedData['professional_name']}" : "";
        return "TODOS OS DADOS COLETADOS! Use createAppointment para confirmar: {$collectedData['procedure']}{$profInfo} em {$collectedData['date']} às {$collectedData['time']} para {$collectedData['patient_name']} (tel: {$collectedData['patient_phone']}).";
    }
    
    // ========================================
    // PROCESSAMENTO COM ESTADO
    // ========================================
    
    /**
     * Processa mensagem com estado explícito
     */
    public function processMessageWithState($message, $history, $collectedData, $currentStep) {
        $systemMessage = $this->buildSystemMessageWithState($collectedData, $currentStep);
        
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
        
        $messages[] = ['role' => 'user', 'content' => $message];
        
        $tools = $this->getAvailableTools();
        
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
        
        $assistantMessage = $response['choices'][0]['message'] ?? null;
        
        if (isset($assistantMessage['tool_calls'])) {
            $result = $this->handleToolCalls($assistantMessage, $messages, $tools, $collectedData);
            return $result;
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
     * Monta system message COM ESTADO EXPLÍCITO (atualizado para multi-profissional)
     */
    private function buildSystemMessageWithState($collectedData, $currentStep) {
        $clinicName = $this->clinica['name'] ?? 'Clínica';
        $aiName = $this->clinica['ai_name'] ?? 'Atendente';
        $aiTone = $this->clinica['ai_tone'] ?? 'casual';
        
        $currentDate = date('d/m/Y');
        $currentTime = date('H:i');
        $currentDateISO = date('Y-m-d');
        $daysOfWeek = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
        $currentDayName = $daysOfWeek[date('w')];
        
        $procedures = $this->getProcedures();
        $proceduresList = empty($procedures) ? "- Consulta Geral\n" : '';
        foreach ($procedures as $proc) {
            $proceduresList .= "- {$proc['name']}\n";
        }
        
        // Estado explícito
        $procStatus = $collectedData['procedure'] ? "✅ {$collectedData['procedure']}" : '❌ NÃO INFORMADO';
        
        // NOVO: Status do profissional
        $profStatus = '—';
        $needsProf = $this->needsProfessionalSelection($collectedData);
        if ($needsProf) {
            if (!empty($collectedData['professional_name'])) {
                $profStatus = "✅ {$collectedData['professional_name']}";
            } elseif (($collectedData['professional_preference'] ?? '') === 'auto') {
                $profStatus = "✅ Automático (balanceamento)";
            } else {
                // Lista opções disponíveis
                $professionals = $this->findProfessionalsForProcedure($collectedData['procedure_id'] ?? null, $this->clinica['id']);
                $names = array_values(array_filter(array_map(fn($p) => $p['name'] ?? null, $professionals)));
                $hasNames = !empty($names);

                // Se o paciente pediu um médico que não existe, precisamos negar explicitamente.
                if (!empty($collectedData['professional_invalid_name'])) {
                    $requested = $this->sanitizeString($collectedData['professional_invalid_name']);
                    if ($hasNames) {
                        $profStatus = "❌ SOLICITADO_NAO_EXISTE (solicitado: {$requested} | opções: " . implode(', ', $names) . ")";
                    } else {
                        $profStatus = "❌ SOLICITADO_NAO_EXISTE (solicitado: {$requested} | opções indisponíveis no momento)";
                    }
                } else {
                    if (!$hasNames) {
                        // Se não conseguimos carregar a lista, NÃO deixe a IA inventar.
                        $profStatus = "❌ PERGUNTAR (opções indisponíveis no momento)";
                    } else {
                        $profStatus = "❌ PERGUNTAR (opções: " . implode(', ', $names) . ")";
                    }
                }
            }
        }
        
        $dateStatus = $collectedData['date'] ? "✅ " . date('d/m/Y', strtotime($collectedData['date'])) : '❌ NÃO INFORMADO';
        $timeStatus = $collectedData['time'] ? "✅ {$collectedData['time']}" : '❌ NÃO INFORMADO';
        $nameStatus = $collectedData['patient_name'] ? "✅ {$collectedData['patient_name']}" : '❌ NÃO INFORMADO';
        $phoneStatus = $collectedData['patient_phone'] ? "✅ {$collectedData['patient_phone']}" : '❌ NÃO INFORMADO';
        
        $nextStep = $this->getNextStepInstruction($collectedData);

        $toneInstruction = match($aiTone) {
            'formal' => 'Use "senhor/senhora".',
            'empathetic' => 'Seja acolhedor.',
            default => 'Seja amigável.',
        };
        
        // Condicional: mostra linha de profissional só se necessário
        $profLine = $needsProf ? "Profissional: {$profStatus}\n" : "";
        
        // NOVO: Carrega regras customizadas da clínica
        $customRulesSection = $this->getCustomRulesSection();

        $systemPrompt = <<<PROMPT
Você é {$aiName}, atendente da {$clinicName}. HOJE: {$currentDate} ({$currentDayName}) às {$currentTime}

PROCEDIMENTOS: {$proceduresList}

═══════════════════════════════════════
ESTADO ATUAL DA CONVERSA (LEIA COM ATENÇÃO)
═══════════════════════════════════════
Procedimento: {$procStatus}
{$profLine}Data: {$dateStatus}
Horário: {$timeStatus}
Nome: {$nameStatus}
Telefone: {$phoneStatus}

PRÓXIMO PASSO: {$nextStep}
═══════════════════════════════════════

REGRAS ABSOLUTAS (SIGA OU A CONVERSA FALHARÁ):

1. NUNCA SUGIRA procedimentos. O sistema já detectou automaticamente acima.
2. Se Procedimento = "NÃO INFORMADO", pergunte: "Qual procedimento deseja?"
3. Se Profissional = "PERGUNTAR":
   - Se a linha "Profissional:" contém "opções:", pergunte a preferência citando SOMENTE essas opções.
   - Se a linha "Profissional:" contém "opções indisponíveis", NÃO cite nomes e peça para o cliente dizer o nome desejado (ou responda que não é possível listar os profissionais agora).
   - Se a linha "Profissional:" contém "SOLICITADO_NAO_EXISTE", diga que esse médico não atende nessa clínica e peça para escolher UMA das opções listadas (se houver opções listadas).
4. Se cliente disser "qualquer um/tanto faz", aceite e siga para a data.
5. Se Procedimento = ✅, NÃO pergunte de novo. Vá para o próximo campo ❌.
6. MÁXIMO 2 frases curtas. UMA pergunta por vez.
7. Use checkAvailability ANTES de oferecer horários.
8. Só use createAppointment quando TODOS (incluindo telefone) estiverem ✅.
9. NUNCA invente dados. Use EXATAMENTE o que está acima.
10. NUNCA invente nomes de profissionais. Se precisar citar profissionais, use SOMENTE os nomes listados em "Profissional: ...".

EXEMPLOS:
- Se Procedimento=✅ e Profissional=❌ PERGUNTAR → "Você tem preferência por algum profissional? (opções listadas acima)"
- Se Profissional=✅ e Data=❌ → "Para qual data prefere?"
- Se Data=✅ e Horário=❌ → chame checkAvailability, depois mostre opções
- Se Horário=✅ e Nome=❌ → "Qual seu nome completo?"
- Se Nome=✅ e Telefone=❌ → "Qual seu telefone para contato (com DDD)?"
- Se TODOS=✅ → chame createAppointment

TOM: {$toneInstruction}
{$customRulesSection}
PROMPT;

        return $systemPrompt;
    }
    
    /**
     * Carrega regras customizadas da clínica e formata para o prompt
     */
    private function getCustomRulesSection() {
        try {
            $stmt = $this->db->prepare("
                SELECT name, message FROM gatilhos_customizados 
                WHERE clinica_id = :clinica_id AND enabled = 1
                ORDER BY name
            ");
            $stmt->execute([':clinica_id' => $this->clinica['id']]);
            $rules = $stmt->fetchAll();
            
            if (empty($rules)) {
                return '';
            }
            
            $rulesText = "\n═══════════════════════════════════════\n";
            $rulesText .= "REGRAS PERSONALIZADAS DA CLÍNICA (SIGA OBRIGATORIAMENTE)\n";
            $rulesText .= "═══════════════════════════════════════\n";
            
            foreach ($rules as $rule) {
                $rulesText .= "- {$rule['name']}: {$rule['message']}\n";
            }
            
            return $rulesText;
        } catch (Exception $e) {
            error_log("Erro ao carregar regras customizadas: " . $e->getMessage());
            return '';
        }
    }
    
    /**
     * Busca procedimento por alias/variação comum
     */
    private function findProcedureByAlias($term, $clinicaId) {
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
        $collectedData = [
            'procedure' => null,
            'procedure_id' => null,
            'procedure_duration' => 30,
            'professional_id' => null,
            'professional_name' => null,
            'professional_preference' => null,
            'date' => null,
            'time' => null,
            'patient_name' => null,
            'patient_phone' => null
        ];
        
        foreach ($conversationHistory as $msg) {
            if ($msg['direction'] === 'incoming') {
                $collectedData = $this->extractDataFromMessage($msg['message'], $collectedData);
            }
        }
        
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
                    'description' => 'Verifica horários disponíveis para uma data e profissional. Use SEMPRE antes de oferecer horários.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'date' => [
                                'type' => 'string',
                                'description' => 'Data no formato YYYY-MM-DD'
                            ],
                            'professional_id' => [
                                'type' => 'integer',
                                'description' => 'ID do profissional (opcional, se não informado busca agenda geral)'
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
                    'description' => 'Cria agendamento. Só chame quando tiver TODOS: data, horário, procedimento, nome E telefone.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'date' => ['type' => 'string', 'description' => 'Data YYYY-MM-DD'],
                            'time' => ['type' => 'string', 'description' => 'Horário HH:MM'],
                            'procedure_name' => ['type' => 'string', 'description' => 'Nome do procedimento'],
                            'patient_name' => ['type' => 'string', 'description' => 'Nome completo do paciente (OBRIGATÓRIO)'],
                            'patient_phone' => ['type' => 'string', 'description' => 'Telefone com DDD (OBRIGATÓRIO)'],
                            'professional_id' => ['type' => 'integer', 'description' => 'ID do profissional (opcional)']
                        ],
                        'required' => ['date', 'time', 'procedure_name', 'patient_name', 'patient_phone']
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
            
            $result = $this->executeFunction($functionName, $arguments, $updatedCollectedData);
            
            error_log("Result: " . json_encode($result));
            
            // ATUALIZA ESTADO BASEADO NOS TOOL CALLS
            if ($functionName === 'checkAvailability' && !empty($arguments['date'])) {
                $updatedCollectedData['date'] = $arguments['date'];
            }
            if ($functionName === 'createAppointment' && ($result['success'] ?? false)) {
                // Limpa estado após agendamento confirmado
                $updatedCollectedData = [
                    'procedure' => null,
                    'procedure_id' => null,
                    'procedure_duration' => 30,
                    'professional_id' => null,
                    'professional_name' => null,
                    'professional_preference' => null,
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
    
    private function executeFunction($functionName, $arguments, $collectedData = []) {
        $clinicaId = $this->clinica['id'];
        
        switch ($functionName) {
            case 'checkAvailability':
                $date = $this->sanitizeDate($arguments['date'] ?? '');
                $professionalId = isset($arguments['professional_id']) ? (int)$arguments['professional_id'] : null;

                // Nunca aceitar IDs fora da lista de médicos da clínica
                if ($professionalId && !$this->isValidDoctorId($professionalId, $clinicaId)) {
                    error_log("checkAvailability: professional_id inválido para a clínica ({$professionalId}) — ignorando");
                    $professionalId = null;
                }
                
                // Se não tem profissional específico mas tem preferência "auto", usa balanceamento
                if (!$professionalId && ($collectedData['professional_preference'] ?? '') === 'auto' && !empty($collectedData['procedure_id'])) {
                    $professionals = $this->findProfessionalsForProcedure($collectedData['procedure_id'], $clinicaId);
                    $selected = $this->selectProfessionalByBalance($professionals, $date, $clinicaId);
                    if ($selected) {
                        $professionalId = $selected['id'];
                        error_log("Balanceamento aplicado: usando profissional {$selected['name']} (ID: {$professionalId})");
                    }
                }
                
                if (!$date) {
                    return ['available' => false, 'error' => 'Data inválida'];
                }
                return $this->checkAvailability($date, $clinicaId, $professionalId);
                
            case 'createAppointment':
                $professionalId = isset($arguments['professional_id']) ? (int)$arguments['professional_id'] : null;

                // Nunca aceitar IDs fora da lista de médicos da clínica
                if ($professionalId && !$this->isValidDoctorId($professionalId, $clinicaId)) {
                    error_log("createAppointment: professional_id inválido para a clínica ({$professionalId}) — ignorando");
                    $professionalId = null;
                }
                
                // Se não tem profissional específico mas tem preferência "auto", usa balanceamento
                if (!$professionalId && ($collectedData['professional_preference'] ?? '') === 'auto' && !empty($collectedData['procedure_id'])) {
                    $date = $this->sanitizeDate($arguments['date'] ?? '');
                    $professionals = $this->findProfessionalsForProcedure($collectedData['procedure_id'], $clinicaId);
                    $selected = $this->selectProfessionalByBalance($professionals, $date, $clinicaId);
                    if ($selected) {
                        $professionalId = $selected['id'];
                    }
                }
                
                return $this->createAppointment(
                    $this->sanitizeDate($arguments['date'] ?? ''),
                    $this->sanitizeTime($arguments['time'] ?? ''),
                    $this->sanitizeString($arguments['procedure_name'] ?? ''),
                    $this->sanitizeString($arguments['patient_name'] ?? ''),
                    $this->sanitizePhone($arguments['patient_phone'] ?? ''),
                    $clinicaId,
                    $this->sessionPhone,
                    $professionalId
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
    // FUNÇÕES DE NEGÓCIO (ATUALIZADAS PARA MULTI-PROFISSIONAL)
    // ========================================
    
    /**
     * Verifica disponibilidade - ATUALIZADO para suportar profissional específico
     */
    private function checkAvailability($date, $clinicaId, $professionalId = null) {
        if (strtotime($date) < strtotime(date('Y-m-d'))) {
            return ['available' => false, 'message' => 'Não é possível agendar para datas passadas'];
        }
        
        $dayOfWeek = date('w', strtotime($date));
        
        // Busca horário de funcionamento (individual ou clínica)
        $workingHours = $this->getProfessionalWorkingHours($professionalId, $clinicaId, $dayOfWeek);
        
        if (!$workingHours) {
            $daysName = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
            $msg = $professionalId ? "O profissional não atende na {$daysName[$dayOfWeek]}" : "A clínica não funciona na {$daysName[$dayOfWeek]}";
            return ['available' => false, 'message' => $msg];
        }
        
        // Agendamentos existentes (filtrado por profissional se especificado)
        if ($professionalId) {
            $stmt = $this->db->prepare("
                SELECT time, duration FROM agendamentos 
                WHERE clinica_id = :clinica_id AND date = :date 
                AND usuario_id = :usuario_id
                AND status NOT IN ('cancelled', 'no_show')
                ORDER BY time
            ");
            $stmt->execute([':clinica_id' => $clinicaId, ':date' => $date, ':usuario_id' => $professionalId]);
        } else {
            $stmt = $this->db->prepare("
                SELECT time, duration FROM agendamentos 
                WHERE clinica_id = :clinica_id AND date = :date 
                AND status NOT IN ('cancelled', 'no_show')
                ORDER BY time
            ");
            $stmt->execute([':clinica_id' => $clinicaId, ':date' => $date]);
        }
        $appointments = $stmt->fetchAll();
        
        // Bloqueios (individual + gerais)
        $blocks = $this->getProfessionalBlocks($professionalId, $clinicaId, $date, $dayOfWeek);
        
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
            'professional_id' => $professionalId,
            'slots' => $availableSlots,
            'message' => "Horários disponíveis para {$dateFormatted}: " . implode(', ', array_slice($availableSlots, 0, 6))
        ];
    }
    
    /**
     * Cria agendamento - ATUALIZADO para incluir usuario_id (profissional)
     */
    private function createAppointment($date, $time, $procedureName, $patientName, $patientPhone, $clinicaId, $sessionPhone = null, $professionalId = null) {
        if (!$date) return ['success' => false, 'error' => 'Data inválida.'];
        if (!$time) return ['success' => false, 'error' => 'Horário inválido.'];
        if (strlen($patientName) < 3) return ['success' => false, 'error' => 'Nome do paciente é obrigatório.'];
        if (strlen($patientPhone) < 10) return ['success' => false, 'error' => 'Telefone é obrigatório (mínimo 10 dígitos).'];
        
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
        $availability = $this->checkAvailability($date, $clinicaId, $professionalId);
        if (!$availability['available']) {
            return ['success' => false, 'error' => $availability['message'] ?? 'Data não disponível'];
        }
        if (!in_array($time, $availability['slots'] ?? [])) {
            return ['success' => false, 'error' => "Horário {$time} não disponível. Horários livres: " . implode(', ', array_slice($availability['slots'], 0, 5))];
        }
        
        // Valida se paciente já existe pelo telefone
        $existingPatient = null;
        if ($patientPhone) {
            $stmt = $this->db->prepare("
                SELECT id, name, phone FROM pacientes 
                WHERE clinica_id = :clinica_id AND phone = :phone
                LIMIT 1
            ");
            $stmt->execute([':clinica_id' => $clinicaId, ':phone' => $patientPhone]);
            $existingPatient = $stmt->fetch();
            
            if ($existingPatient) {
                $this->paciente = $existingPatient;
                error_log("Paciente EXISTENTE encontrado: ID {$existingPatient['id']} - {$existingPatient['name']}");
            }
        }
        
        // Cria paciente SE não existe
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
                error_log("Paciente NOVO criado: ID {$pacienteId}");
            } catch (Exception $e) {
                error_log("Erro paciente: " . $e->getMessage());
                return ['success' => false, 'error' => 'Erro ao registrar paciente'];
            }
        }
        
        // Cria agendamento COM usuario_id (profissional)
        try {
            $stmt = $this->db->prepare("
                INSERT INTO agendamentos (clinica_id, paciente_id, usuario_id, date, time, duration, `procedure`, procedimento_id, status, notes, session_phone, created_at)
                VALUES (:clinica_id, :paciente_id, :usuario_id, :date, :time, :duration, :procedure, :procedimento_id, 'confirmed', 'Agendado via WhatsApp IA', :session_phone, NOW())
            ");
            $stmt->execute([
                ':clinica_id' => $clinicaId,
                ':paciente_id' => $this->paciente['id'],
                ':usuario_id' => $professionalId, // NOVO: inclui profissional
                ':date' => $date,
                ':time' => $time,
                ':duration' => $duration,
                ':procedure' => $procedureNameFinal,
                ':procedimento_id' => $procedureId,
                ':session_phone' => $sessionPhone
            ]);
            
            $appointmentId = $this->db->lastInsertId();
            $dateFormatted = date('d/m/Y', strtotime($date));
            
            // Busca nome do profissional para a mensagem
            $profName = '';
            if ($professionalId) {
                $stmt = $this->db->prepare("SELECT name FROM usuarios WHERE id = :id");
                $stmt->execute([':id' => $professionalId]);
                $prof = $stmt->fetch();
                if ($prof) $profName = " com {$prof['name']}";
            }
            
            error_log("Agendamento criado: ID {$appointmentId} (profissional: {$professionalId}, session_phone: {$sessionPhone})");
            
            return [
                'success' => true,
                'appointment_id' => $appointmentId,
                'patient_id' => $this->paciente['id'],
                'patient_name' => $this->paciente['name'],
                'professional_id' => $professionalId,
                'date' => $date,
                'date_formatted' => $dateFormatted,
                'time' => $time,
                'procedure' => $procedureNameFinal,
                'message' => "Agendamento confirmado: {$procedureNameFinal}{$profName} em {$dateFormatted} às {$time} para {$this->paciente['name']}"
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
