<?php
/**
 * StackClinic API - WhatsApp Webhook
 * Recebe mensagens da Evolution API e processa com IA
 * POST /api/webhook/whatsapp
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../services/OpenAIService.php';
require_once __DIR__ . '/../services/EvolutionService.php';

// Apenas POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

// Recebe o payload
$payload = json_decode(file_get_contents('php://input'), true);

// Log do webhook (debug)
error_log("WhatsApp Webhook: " . json_encode($payload));

// Valida evento
$event = $payload['event'] ?? '';
if ($event !== 'messages.upsert') {
    Response::success(['ignored' => true, 'reason' => 'Event not handled']);
}

// Extrai dados da mensagem
$instance = $payload['instance'] ?? '';
$data = $payload['data'] ?? [];
$key = $data['key'] ?? [];
$messageData = $data['message'] ?? [];

// Ignora mensagens enviadas pela própria instância
if ($key['fromMe'] ?? false) {
    Response::success(['ignored' => true, 'reason' => 'Own message']);
}

// Extrai número do remetente
$remoteJid = $key['remoteJid'] ?? '';
$phone = preg_replace('/@.*/', '', $remoteJid);
$phone = preg_replace('/\D/', '', $phone);

// Extrai texto da mensagem
$messageText = $messageData['conversation'] ?? 
               $messageData['extendedTextMessage']['text'] ?? 
               '';

if (empty($messageText)) {
    Response::success(['ignored' => true, 'reason' => 'No text message']);
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // =========================================
    // 1. Identifica a clínica pela instância
    // =========================================
    $stmt = $db->prepare("
        SELECT * FROM clinica 
        WHERE evolution_instance_id = :instance_id 
        AND whatsapp_connected = 1
        LIMIT 1
    ");
    $stmt->execute([':instance_id' => $instance]);
    $clinica = $stmt->fetch();
    
    if (!$clinica) {
        error_log("WhatsApp Webhook: Clínica não encontrada para instância " . $instance);
        Response::success(['ignored' => true, 'reason' => 'Clinic not found']);
    }
    
    $clinicaId = $clinica['id'];
    
    // =========================================
    // 2. Busca ou cria paciente
    // =========================================
    $stmt = $db->prepare("
        SELECT * FROM pacientes 
        WHERE clinica_id = :clinica_id 
        AND REPLACE(REPLACE(REPLACE(phone, '(', ''), ')', ''), '-', '') LIKE :phone
        LIMIT 1
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':phone' => '%' . substr($phone, -9) . '%'
    ]);
    $paciente = $stmt->fetch();
    
    if (!$paciente) {
        // Cria como Lead
        $stmt = $db->prepare("
            INSERT INTO pacientes (clinica_id, name, phone, is_lead, lead_source, created_at)
            VALUES (:clinica_id, :name, :phone, 1, 'whatsapp', NOW())
        ");
        $stmt->execute([
            ':clinica_id' => $clinicaId,
            ':name' => 'WhatsApp ' . substr($phone, -4),
            ':phone' => $phone
        ]);
        
        $pacienteId = $db->lastInsertId();
        $paciente = [
            'id' => $pacienteId,
            'name' => 'WhatsApp ' . substr($phone, -4),
            'phone' => $phone,
            'is_lead' => 1
        ];
        
        error_log("WhatsApp Webhook: Novo lead criado ID " . $pacienteId);
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
        ':phone' => $phone,
        ':message' => $messageText
    ]);
    
    // =========================================
    // 4. Verifica se está transferido para humano
    // =========================================
    $stmt = $db->prepare("
        SELECT * FROM whatsapp_sessions 
        WHERE clinica_id = :clinica_id AND phone = :phone
        LIMIT 1
    ");
    $stmt->execute([':clinica_id' => $clinicaId, ':phone' => $phone]);
    $session = $stmt->fetch();
    
    if ($session && $session['transferred_to_human']) {
        // Não processa com IA, apenas salva
        Response::success(['processed' => false, 'reason' => 'Transferred to human']);
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
    $stmt->execute([':clinica_id' => $clinicaId, ':phone' => $phone]);
    $history = array_reverse($stmt->fetchAll());
    
    // Remove a mensagem atual do histórico (já será adicionada)
    array_pop($history);
    
    // =========================================
    // 6. Processa com OpenAI
    // =========================================
    $openai = new OpenAIService($db, $clinica, $paciente);
    $result = $openai->processMessage($messageText, $history);
    
    if (!$result['success']) {
        error_log("WhatsApp Webhook: Erro ao processar com IA - " . ($result['error'] ?? 'Unknown'));
        Response::success(['processed' => false, 'error' => $result['error']]);
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
        ':phone' => $phone,
        ':message' => $responseText,
        ':function_calls' => $result['function_calls'] ? json_encode($result['function_calls']) : null,
        ':tokens_used' => $result['tokens_used'] ?? 0
    ]);
    
    // =========================================
    // 8. Envia resposta via Evolution API
    // =========================================
    $evolution = new EvolutionService($clinica['evolution_instance_id'], $clinica['evolution_api_key']);
    $sendResult = $evolution->sendTextMessage($phone, $responseText);
    
    if (!$sendResult['success']) {
        error_log("WhatsApp Webhook: Erro ao enviar resposta - " . ($sendResult['error'] ?? 'Unknown'));
    }
    
    // =========================================
    // 9. Atualiza/cria sessão
    // =========================================
    $stmt = $db->prepare("
        INSERT INTO whatsapp_sessions (clinica_id, phone, paciente_id, status, last_activity)
        VALUES (:clinica_id, :phone, :paciente_id, 'active', NOW())
        ON DUPLICATE KEY UPDATE last_activity = NOW(), paciente_id = :paciente_id2
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':phone' => $phone,
        ':paciente_id' => $paciente['id'],
        ':paciente_id2' => $paciente['id']
    ]);
    
    Response::success([
        'processed' => true,
        'patient_id' => $paciente['id'],
        'is_lead' => $paciente['is_lead'] ?? false,
        'response_sent' => $sendResult['success'] ?? false,
        'tokens_used' => $result['tokens_used'] ?? 0
    ]);

} catch (Exception $e) {
    error_log("WhatsApp Webhook Error: " . $e->getMessage());
    Response::serverError('Erro ao processar mensagem');
}
