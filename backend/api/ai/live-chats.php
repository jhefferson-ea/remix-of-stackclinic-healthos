<?php
/**
 * StackClinic API - Live Chats
 * GET /api/ai/live-chats
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$database = new Database();
$db = $database->getConnection();

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

try {
    $stmt = $db->prepare("
        SELECT id, patient_name, patient_phone, last_message, status, unread, updated_at
        FROM live_chats
        WHERE clinica_id = :clinica_id
        ORDER BY unread DESC, updated_at DESC
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $chats = $stmt->fetchAll();
    
    foreach ($chats as &$chat) {
        $chat['unread'] = (int) $chat['unread'];
    }
    
    Response::success($chats);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar chats');
}