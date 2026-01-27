<?php
/**
 * StackClinic - Get Appointment Conversation
 * GET /api/appointments/{id}/conversation
 * Retorna o histórico de mensagens da sessão que originou o agendamento
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Tenant.php';

// Debug logging
$debugLog = __DIR__ . '/../debug.log';
file_put_contents($debugLog, "\n=== CONVERSATION DEBUG " . date('Y-m-d H:i:s') . " ===\n", FILE_APPEND);
file_put_contents($debugLog, "URI: " . $_SERVER['REQUEST_URI'] . "\n", FILE_APPEND);
file_put_contents($debugLog, "HTTP_AUTHORIZATION: " . (isset($_SERVER['HTTP_AUTHORIZATION']) ? 'SIM' : 'NAO') . "\n", FILE_APPEND);
file_put_contents($debugLog, "REDIRECT_HTTP_AUTHORIZATION: " . (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? 'SIM' : 'NAO') . "\n", FILE_APPEND);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::methodNotAllowed();
}

$clinicaId = Tenant::getClinicId();

// Extrai ID do agendamento da URL
preg_match('/\/appointments\/(\d+)\/conversation/', $_SERVER['REQUEST_URI'], $matches);
$appointmentId = $matches[1] ?? null;

if (!$appointmentId) {
    Response::badRequest('ID do agendamento não informado');
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Busca session_phone do agendamento
    $stmt = $db->prepare("
        SELECT session_phone FROM agendamentos 
        WHERE id = :id AND clinica_id = :clinica_id
    ");
    $stmt->execute([':id' => $appointmentId, ':clinica_id' => $clinicaId]);
    $appointment = $stmt->fetch();
    
    if (!$appointment) {
        Response::notFound('Agendamento não encontrado');
    }
    
    if (!$appointment['session_phone']) {
        Response::success([
            'messages' => [],
            'has_conversation' => false,
            'message' => 'Este agendamento não possui conversa registrada'
        ]);
        exit;
    }
    
    // Busca mensagens da sessão (ordena por ID para garantir ordem de inserção)
    $stmt = $db->prepare("
        SELECT direction, message, created_at 
        FROM whatsapp_messages 
        WHERE clinica_id = :clinica_id AND phone = :phone
        ORDER BY id ASC
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId, 
        ':phone' => $appointment['session_phone']
    ]);
    $messages = $stmt->fetchAll();
    
    Response::success([
        'messages' => $messages,
        'has_conversation' => count($messages) > 0,
        'session_phone' => $appointment['session_phone']
    ]);
    
} catch (Exception $e) {
    error_log("Erro ao buscar conversa: " . $e->getMessage());
    Response::serverError('Erro ao buscar conversa');
}
