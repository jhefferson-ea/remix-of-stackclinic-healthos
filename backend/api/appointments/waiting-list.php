<?php
/**
 * StackClinic API - Waiting List
 * GET /api/appointments/waiting-list
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
        SELECT le.id, p.name, p.phone, le.preferred_time, le.added_at
        FROM lista_espera le
        JOIN pacientes p ON le.paciente_id = p.id
        WHERE le.clinica_id = :clinica_id
        ORDER BY le.added_at ASC
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $waitingList = $stmt->fetchAll();
    
    foreach ($waitingList as &$item) {
        $item['id'] = (int) $item['id'];
    }
    
    Response::success($waitingList);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar lista de espera');
}