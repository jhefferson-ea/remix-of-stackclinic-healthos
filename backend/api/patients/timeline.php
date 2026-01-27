<?php
/**
 * StackClinic API - Patient Timeline
 * GET /api/patients/{id}/timeline
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

// Get ID from URL
$uri = $_SERVER['REQUEST_URI'];
preg_match('/\/patients\/(\d+)\/timeline/', $uri, $matches);
$id = $matches[1] ?? null;

if (!$id) {
    Response::error('ID do paciente não informado');
}

try {
    // Verificar se o paciente pertence a esta clínica
    $stmt = $db->prepare("SELECT id FROM pacientes WHERE id = :id AND clinica_id = :clinica_id");
    $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
    if (!$stmt->fetch()) {
        Response::notFound('Paciente não encontrado');
    }

    $stmt = $db->prepare("
        SELECT id, type, title, description, metadata, date
        FROM timeline
        WHERE paciente_id = :id AND clinica_id = :clinica_id
        ORDER BY date DESC
        LIMIT 50
    ");
    $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
    $events = $stmt->fetchAll();
    
    foreach ($events as &$event) {
        $event['id'] = (int) $event['id'];
        $event['metadata'] = json_decode($event['metadata']) ?? null;
    }
    
    Response::success($events);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar timeline');
}