<?php
/**
 * StackClinic API - Patient Gallery
 * GET /api/patients/{id}/gallery
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
preg_match('/\/patients\/(\d+)\/gallery/', $uri, $matches);
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
        SELECT id, url, type, description, date
        FROM galeria
        WHERE paciente_id = :id AND clinica_id = :clinica_id
        ORDER BY date DESC
    ");
    $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
    $images = $stmt->fetchAll();
    
    foreach ($images as &$img) {
        $img['id'] = (int) $img['id'];
    }
    
    Response::success($images);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar galeria');
}