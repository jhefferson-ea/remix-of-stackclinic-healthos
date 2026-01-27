<?php
/**
 * StackClinic API - Chat Simulator
 * Simula conversas WhatsApp para testar IA sem Evolution API
 * POST /api/ai/simulate-chat
 * DELETE /api/ai/simulate-chat (limpa sessão)
 * 
 * NOVA ARQUITETURA: Estado Explícito
 * - collected_data: Armazena dados já coletados na conversa
 * - current_step: Indica em qual passo da máquina de estados estamos
 * - A IA recebe estado explícito, não precisa inferir do histórico
 */

// Garante timezone de Brasília para todas as operações de data/hora
date_default_timezone_set('America/Sao_Paulo');

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Tenant.php';
require_once __DIR__ . '/../services/OpenAIService.php';

$method = $_SERVER['REQUEST_METHOD'];

// =========================================
// FUNÇÃO: Normaliza session_phone para <= 20 chars
// =========================================
function normalizeSessionPhone($phone) {
    $phone = trim((string)$phone);
    $phone = str_replace(' ', '', $phone);
    return substr($phone, 0, 20); // Garante que cabe no VARCHAR(20)
}

// =========================================
// FUNÇÃO: Gera session_phone curto para simulador
// =========================================
function generateShortSessionPhone($clinicaId) {
    // Formato: S{cid}_{base36timestamp}{rand}
    // Ex: S12_lk9z3f1a → máx 20 chars
    $base36time = base_convert(time(), 10, 36);
    $rand = substr(bin2hex(random_bytes(2)), 0, 3);
    $phone = "S{$clinicaId}_{$base36time}{$rand}";
    return normalizeSessionPhone($phone);
}

// Debug temporário - verificar método recebido
error_log("simulate-chat.php - Method: " . $method);

// ==================== DELETE: Limpar sessão ====================
if ($method === 'DELETE') {
    $auth = Tenant::getAuthUser();
    $clinicaId = Tenant::getClinicId();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $sessionPhone = $input['session_phone'] ?? null;
    
    if (!$sessionPhone) {
        Response::badRequest('session_phone é obrigatório');
        exit;
    }
    
    // NORMALIZA o phone antes de usar nas queries
    $sessionPhone = normalizeSessionPhone($sessionPhone);
    error_log("DELETE session - Normalized phone: {$sessionPhone} (len=" . strlen($sessionPhone) . ")");
    
    try {
        $database = new Database();
        $db = $database->getConnection();
        
        // Limpa mensagens da simulação
        $stmt = $db->prepare("
            DELETE FROM whatsapp_messages 
            WHERE clinica_id = :clinica_id AND phone = :phone
        ");
        $stmt->execute([
            ':clinica_id' => $clinicaId,
            ':phone' => $sessionPhone
        ]);
        
        // Limpa sessão
        $stmt = $db->prepare("
            DELETE FROM whatsapp_sessions 
            WHERE clinica_id = :clinica_id AND phone = :phone
        ");
        $stmt->execute([
            ':clinica_id' => $clinicaId,
            ':phone' => $sessionPhone
        ]);
        
        error_log("DELETE session - Cleared successfully");
        Response::success(['cleared' => true]);
        exit;
        
    } catch (Exception $e) {
        error_log("Simulate Chat Clear Error: " . $e->getMessage());
        Response::serverError('Erro ao limpar sessão');
        exit;
    }
}

// ==================== POST: Processar mensagem ====================
if ($method !== 'POST') {
    error_log("simulate-chat.php - Rejeitando método: " . $method);
    Response::methodNotAllowed();
    exit;
}

$auth = Tenant::getAuthUser();
$clinicaId = Tenant::getClinicId();

$input = json_decode(file_get_contents('php://input'), true);
$message = trim($input['message'] ?? '');
$sessionPhone = $input['session_phone'] ?? null;

if (empty($message)) {
    Response::badRequest('message é obrigatório');
}

// Gera telefone de sessão curto se não informado
if (!$sessionPhone) {
    $sessionPhone = generateShortSessionPhone($clinicaId);
} else {
    // Normaliza o que veio do frontend
    $sessionPhone = normalizeSessionPhone($sessionPhone);
}

// LOG DEBUG: Verificar session_phone
error_log("===== SIMULATE-CHAT POST =====");
error_log("session_phone: {$sessionPhone} (len=" . strlen($sessionPhone) . ")");

try {
    $database = new Database();
    $db = $database->getConnection();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // =========================================
    // 1. Busca dados da clínica
    // =========================================
    $stmt = $db->prepare("SELECT * FROM clinica WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $clinicaId]);
    $clinica = $stmt->fetch();
    
    if (!$clinica) {
        Response::notFound('Clínica não encontrada');
    }
    
    // =========================================
    // 2. Busca paciente existente (NÃO cria automaticamente)
    // =========================================
    $stmt = $db->prepare("
        SELECT * FROM pacientes 
        WHERE clinica_id = :clinica_id AND phone = :phone
        LIMIT 1
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':phone' => $sessionPhone
    ]);
    $paciente = $stmt->fetch() ?: null;
    
    // =========================================
    // 3. Recupera contexto da sessão
    // =========================================
    $stmt = $db->prepare("
        SELECT * FROM whatsapp_sessions 
        WHERE clinica_id = :clinica_id AND phone = :phone
        LIMIT 1
    ");
    $stmt->execute([':clinica_id' => $clinicaId, ':phone' => $sessionPhone]);
    $session = $stmt->fetch();
    
    // Inicializa contexto da conversa com ESTADO EXPLÍCITO
    $history = [];
    $collectedData = [
        'procedure' => null,
        'date' => null,
        'time' => null,
        'patient_name' => null,
        'patient_phone' => null
    ];
    $currentStep = 'greeting';
    
    if ($session && $session['context']) {
        $conversationContext = json_decode($session['context'], true) ?? [];
        $history = $conversationContext['messages'] ?? [];
        $collectedData = $conversationContext['collected_data'] ?? $collectedData;
        $currentStep = $conversationContext['current_step'] ?? 'greeting';
        error_log("Session FOUND! collected_data: " . json_encode($collectedData));
    } else {
        error_log("Session NOT FOUND - starting fresh");
    }
    
    // Verifica se está transferido para humano
    if ($session && ($session['transferred_to_human'] ?? false)) {
        Response::success([
            'response' => '[Conversa transferida para atendente humano]',
            'transferred' => true,
            'session_phone' => $sessionPhone,
            'patient' => $paciente,
            'collected_data' => $collectedData,
            'current_step' => 'transferred'
        ]);
        exit;
    }
    
    // =========================================
    // 4. Processa com OpenAI (passa estado explícito)
    // =========================================
    try {
        $openai = new OpenAIService($db, $clinica, $paciente);
        
        // Define session_phone para vincular agendamentos às conversas
        $openai->setSessionPhone($sessionPhone);
        
        // Extrai dados automaticamente da mensagem do usuário
        $extractedData = $openai->extractDataFromMessage($message, $collectedData);
        
        // Determina o passo atual baseado nos dados coletados
        $currentStep = $openai->determineCurrentStep($extractedData);
        
        // Processa mensagem com estado explícito
        $result = $openai->processMessageWithState($message, $history, $extractedData, $currentStep);
        
    } catch (Exception $aiError) {
        error_log("Simulate Chat: Exception ao processar IA - " . $aiError->getMessage());
        Response::success([
            'response' => 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
            'error' => $aiError->getMessage(),
            'session_phone' => $sessionPhone,
            'patient' => $paciente,
            'collected_data' => $collectedData,
            'current_step' => $currentStep
        ]);
        exit;
    }
    
    if (!$result['success']) {
        error_log("Simulate Chat: Erro ao processar com IA - " . ($result['error'] ?? 'Unknown'));
        Response::success([
            'response' => 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
            'error' => $result['error'] ?? 'Erro desconhecido',
            'session_phone' => $sessionPhone,
            'patient' => $paciente,
            'collected_data' => $collectedData,
            'current_step' => $currentStep
        ]);
        exit;
    }
    
    $responseText = $result['response'];
    
    // =========================================
    // 5. Atualiza dados coletados com extração da IA
    // =========================================
    $newCollectedData = $result['collected_data'] ?? $extractedData;
    $newStep = $openai->determineCurrentStep($newCollectedData);
    
    // =========================================
    // 6. Atualiza histórico
    // =========================================
    $history[] = ['direction' => 'incoming', 'message' => $message];
    $history[] = ['direction' => 'outgoing', 'message' => $responseText];
    
    // Mantém apenas últimas 20 mensagens no contexto
    if (count($history) > 20) {
        $history = array_slice($history, -20);
    }
    
    // =========================================
    // 7. Verifica se agendamento foi criado
    // =========================================
    $appointmentCreated = null;
    if ($result['function_calls']) {
        foreach ($result['function_calls'] as $call) {
            if ($call['function'] === 'createAppointment' && ($call['result']['success'] ?? false)) {
                $appointmentCreated = $call['result'];
                
                // Busca o paciente criado
                if (isset($call['result']['patient_id'])) {
                    $stmt = $db->prepare("SELECT * FROM pacientes WHERE id = :id LIMIT 1");
                    $stmt->execute([':id' => $call['result']['patient_id']]);
                    $paciente = $stmt->fetch() ?: null;
                }
                
                // Limpa dados coletados após agendamento confirmado
                $newCollectedData = [
                    'procedure' => null,
                    'date' => null,
                    'time' => null,
                    'patient_name' => null,
                    'patient_phone' => null
                ];
                $newStep = 'completed';
            }
        }
    }
    
    // =========================================
    // 8. Monta contexto atualizado
    // =========================================
    $conversationContext = [
        'messages' => $history,
        'collected_data' => $newCollectedData,
        'current_step' => $newStep,
        'last_activity' => date('Y-m-d H:i:s')
    ];
    
    // =========================================
    // 9. Salva sessão com contexto
    // =========================================
    $stmt = $db->prepare("
        INSERT INTO whatsapp_sessions (clinica_id, phone, paciente_id, context, status, last_activity)
        VALUES (:clinica_id, :phone, :paciente_id, :context, 'active', NOW())
        ON DUPLICATE KEY UPDATE 
            context = :context2, 
            last_activity = NOW(), 
            paciente_id = COALESCE(:paciente_id2, paciente_id)
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':phone' => $sessionPhone,
        ':paciente_id' => $paciente ? $paciente['id'] : null,
        ':context' => json_encode($conversationContext),
        ':context2' => json_encode($conversationContext),
        ':paciente_id2' => $paciente ? $paciente['id'] : null
    ]);
    
    // =========================================
    // 10. SALVA MENSAGENS na tabela whatsapp_messages
    // =========================================
    
    // Salva mensagem INCOMING (do usuário)
    $stmt = $db->prepare("
        INSERT INTO whatsapp_messages 
        (clinica_id, paciente_id, phone, direction, message, message_type, ai_processed, created_at)
        VALUES (:clinica_id, :paciente_id, :phone, 'incoming', :message, 'text', 1, NOW())
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':paciente_id' => $paciente ? $paciente['id'] : null,
        ':phone' => $sessionPhone,
        ':message' => $message
    ]);
    
    // Salva mensagem OUTGOING (da IA)
    $stmt = $db->prepare("
        INSERT INTO whatsapp_messages 
        (clinica_id, paciente_id, phone, direction, message, message_type, ai_processed, function_calls, tokens_used, created_at)
        VALUES (:clinica_id, :paciente_id, :phone, 'outgoing', :message, 'text', 1, :function_calls, :tokens_used, NOW())
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':paciente_id' => $paciente ? $paciente['id'] : null,
        ':phone' => $sessionPhone,
        ':message' => $responseText,
        ':function_calls' => json_encode($result['function_calls'] ?? null),
        ':tokens_used' => $result['tokens_used'] ?? 0
    ]);
    
    error_log("SAVED to whatsapp_messages: incoming + outgoing for phone={$sessionPhone}");
    
    Response::success([
        'response' => $responseText,
        'session_phone' => $sessionPhone,
        'patient' => $paciente,
        'tokens_used' => $result['tokens_used'] ?? 0,
        'function_calls' => $result['function_calls'],
        'appointment_created' => $appointmentCreated,
        'collected_data' => $newCollectedData,
        'current_step' => $newStep
    ]);

} catch (Exception $e) {
    error_log("Simulate Chat Error: " . $e->getMessage());
    Response::serverError('Erro ao processar mensagem: ' . $e->getMessage());
}
