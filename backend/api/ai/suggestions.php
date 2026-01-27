<?php
/**
 * StackClinic API - AI Suggestions
 * GET /api/ai/suggestions
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
        SELECT id, type, description, affected_appointments, suggested_action
        FROM ia_sugestoes
        WHERE clinica_id = :clinica_id AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 10
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $suggestions = $stmt->fetchAll();
    
    foreach ($suggestions as &$suggestion) {
        $suggestion['id'] = (int) $suggestion['id'];
        $suggestion['affected_appointments'] = json_decode($suggestion['affected_appointments']) ?? [];
    }
    
    Response::success($suggestions);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar sugestões de IA');
}