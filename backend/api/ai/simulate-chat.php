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

// ==================== DELETE: Limpar sessão ====================
if ($method === 'DELETE') {
    $auth = Tenant::getAuthUser();
    $clinicaId = Tenant::getClinicId();
    
    $input = json_decode(file_get_contents('php://input'), true);
    $sessionPhone = $input['session_phone'] ?? null;
    
    if (!$sessionPhone) {
        Response::badRequest('session_phone é obrigatório');
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
        
    } catch (Exception $e) {
        error_log("Simulate Chat Clear Error: " . $e->getMessage());
        Response::serverError('Erro ao limpar sessão');
    }
}

// ==================== POST: Processar mensagem ====================
if ($method !== 'POST') {
    Response::methodNotAllowed();
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
    // 2. Busca ou cria paciente simulado
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
    $paciente = $stmt->fetch();
    
    if (!$paciente) {
        // Cria paciente simulado como Lead
        $stmt = $db->prepare("
            INSERT INTO pacientes (clinica_id, name, phone, is_lead, lead_source, created_at)
            VALUES (:clinica_id, :name, :phone, 1, 'simulator', NOW())
        ");
        $stmt->execute([
            ':clinica_id' => $clinicaId,
            ':name' => 'Simulador ' . date('d/m H:i'),
            ':phone' => $sessionPhone
        ]);
        
        $pacienteId = $db->lastInsertId();
        $paciente = [
            'id' => $pacienteId,
            'name' => 'Simulador ' . date('d/m H:i'),
            'phone' => $sessionPhone,
            'is_lead' => 1
        ];
    }
    
    // =========================================
    // 3. Salva mensagem recebida
    // =========================================
    $stmt = $db->prepare("
        INSERT INTO whatsapp_messages (clinica_id, paciente_id, phone, direction, message, message_type, created_at)
        VALUES (:clinica_id, :paciente_id, :phone, 'incoming', :message, 'text', NOW())
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':paciente_id' => $paciente['id'],
        ':phone' => $sessionPhone,
        ':message' => $message
    ]);
    
    // =========================================
    // 4. Verifica se está transferido para humano
    // =========================================
    $stmt = $db->prepare("
        SELECT * FROM whatsapp_sessions 
        WHERE clinica_id = :clinica_id AND phone = :phone
        LIMIT 1
    ");
    $stmt->execute([':clinica_id' => $clinicaId, ':phone' => $sessionPhone]);
    $session = $stmt->fetch();
    
    if ($session && $session['transferred_to_human']) {
        Response::success([
            'response' => '[Conversa transferida para atendente humano]',
            'transferred' => true,
            'session_phone' => $sessionPhone,
            'patient' => $paciente
        ]);
    }
    
    // =========================================
    // 5. Recupera histórico (últimas 10 mensagens)
    // =========================================
    $stmt = $db->prepare("
        SELECT direction, message 
        FROM whatsapp_messages 
        WHERE clinica_id = :clinica_id AND phone = :phone
        ORDER BY created_at DESC
        LIMIT 10
    ");
    $stmt->execute([':clinica_id' => $clinicaId, ':phone' => $sessionPhone]);
    $history = array_reverse($stmt->fetchAll());
    
    // Remove a mensagem atual do histórico (já será adicionada pelo OpenAIService)
    array_pop($history);
    
    // =========================================
    // 6. Processa com OpenAI
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
    // 7. Salva resposta
    // =========================================
    $stmt = $db->prepare("
        INSERT INTO whatsapp_messages (clinica_id, paciente_id, phone, direction, message, message_type, ai_processed, function_calls, tokens_used, created_at)
        VALUES (:clinica_id, :paciente_id, :phone, 'outgoing', :message, 'text', 1, :function_calls, :tokens_used, NOW())
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':paciente_id' => $paciente['id'],
        ':phone' => $sessionPhone,
        ':message' => $responseText,
        ':function_calls' => $result['function_calls'] ? json_encode($result['function_calls']) : null,
        ':tokens_used' => $result['tokens_used'] ?? 0
    ]);
    
    // =========================================
    // 8. Atualiza/cria sessão
    // =========================================
    $stmt = $db->prepare("
        INSERT INTO whatsapp_sessions (clinica_id, phone, paciente_id, status, last_activity)
        VALUES (:clinica_id, :phone, :paciente_id, 'active', NOW())
        ON DUPLICATE KEY UPDATE last_activity = NOW(), paciente_id = :paciente_id2
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':phone' => $sessionPhone,
        ':paciente_id' => $paciente['id'],
        ':paciente_id2' => $paciente['id']
    ]);
    
    // =========================================
    // 9. Verifica se criou agendamento
    // =========================================
    $appointmentCreated = null;
    if ($result['function_calls']) {
        foreach ($result['function_calls'] as $call) {
            if ($call['function'] === 'createAppointment' && ($call['result']['success'] ?? false)) {
                $appointmentCreated = $call['result'];
            }
        }
    }
    
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
