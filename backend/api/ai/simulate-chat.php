<?php
/**
 * StackClinic API - Chat Simulator
 * Simula conversas WhatsApp para testar IA sem Evolution API
 * POST /api/ai/simulate-chat
 * DELETE /api/ai/simulate-chat (limpa sessão)
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Tenant.php';
require_once __DIR__ . '/../services/OpenAIService.php';

$method = $_SERVER['REQUEST_METHOD'];

// Debug temporário - verificar método recebido
error_log("simulate-chat.php - Method: " . $method);
error_log("simulate-chat.php - URI: " . $_SERVER['REQUEST_URI']);

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

// Gera telefone de sessão se não informado
if (!$sessionPhone) {
    $sessionPhone = 'SIMULATOR_' . $clinicaId . '_' . time();
}

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
    // Paciente só será criado quando houver agendamento confirmado
    // Por enquanto, apenas busca se já existe
    $stmt = $db->prepare("
        SELECT * FROM pacientes 
        WHERE clinica_id = :clinica_id AND phone = :phone
        LIMIT 1
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':phone' => $sessionPhone
    ]);
    $paciente = $stmt->fetch() ?: null; // null se não existir
    
    // =========================================
    // 3. Recupera histórico da sessão (usando tabela de sessão, não whatsapp_messages)
    // =========================================
    // Para simulador, usamos uma tabela temporária ou o contexto da sessão
    $stmt = $db->prepare("
        SELECT context FROM whatsapp_sessions 
        WHERE clinica_id = :clinica_id AND phone = :phone
        LIMIT 1
    ");
    $stmt->execute([':clinica_id' => $clinicaId, ':phone' => $sessionPhone]);
    $session = $stmt->fetch();
    
    $history = [];
    $conversationContext = [];
    
    if ($session && $session['context']) {
        $conversationContext = json_decode($session['context'], true) ?? [];
        $history = $conversationContext['messages'] ?? [];
    }
    
    // Verifica se está transferido para humano
    if ($session && ($session['transferred_to_human'] ?? false)) {
        Response::success([
            'response' => '[Conversa transferida para atendente humano]',
            'transferred' => true,
            'session_phone' => $sessionPhone,
            'patient' => $paciente
        ]);
        exit;
    }
    
    // =========================================
    // 4. Processa com OpenAI
    // =========================================
    try {
        $openai = new OpenAIService($db, $clinica, $paciente);
        $result = $openai->processMessage($message, $history);
    } catch (Exception $aiError) {
        error_log("Simulate Chat: Exception ao processar IA - " . $aiError->getMessage());
        Response::success([
            'response' => 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
            'error' => $aiError->getMessage(),
            'session_phone' => $sessionPhone,
            'patient' => $paciente
        ]);
        exit;
    }
    
    if (!$result['success']) {
        error_log("Simulate Chat: Erro ao processar com IA - " . ($result['error'] ?? 'Unknown'));
        Response::success([
            'response' => 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
            'error' => $result['error'] ?? 'Erro desconhecido',
            'session_phone' => $sessionPhone,
            'patient' => $paciente
        ]);
        exit;
    }
    
    $responseText = $result['response'];
    
    // =========================================
    // 5. Atualiza histórico na sessão (não cria registros em pacientes)
    // =========================================
    $history[] = ['direction' => 'incoming', 'message' => $message];
    $history[] = ['direction' => 'outgoing', 'message' => $responseText];
    
    // Mantém apenas últimas 20 mensagens no contexto
    if (count($history) > 20) {
        $history = array_slice($history, -20);
    }
    
    $conversationContext['messages'] = $history;
    $conversationContext['last_activity'] = date('Y-m-d H:i:s');
    
    // =========================================
    // 6. Verifica se agendamento foi criado - só então cria paciente
    // =========================================
    $appointmentCreated = null;
    if ($result['function_calls']) {
        foreach ($result['function_calls'] as $call) {
            if ($call['function'] === 'createAppointment' && ($call['result']['success'] ?? false)) {
                $appointmentCreated = $call['result'];
                
                // Agora sim, busca o paciente criado pelo OpenAIService
                if (isset($call['result']['patient_id'])) {
                    $stmt = $db->prepare("SELECT * FROM pacientes WHERE id = :id LIMIT 1");
                    $stmt->execute([':id' => $call['result']['patient_id']]);
                    $paciente = $stmt->fetch() ?: null;
                }
            }
        }
    }
    
    // =========================================
    // 7. Atualiza/cria sessão com contexto
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
    
    Response::success([
        'response' => $responseText,
        'session_phone' => $sessionPhone,
        'patient' => $paciente,
        'tokens_used' => $result['tokens_used'] ?? 0,
        'function_calls' => $result['function_calls'],
        'appointment_created' => $appointmentCreated
    ]);

} catch (Exception $e) {
    error_log("Simulate Chat Error: " . $e->getMessage());
    Response::serverError('Erro ao processar mensagem: ' . $e->getMessage());
}
