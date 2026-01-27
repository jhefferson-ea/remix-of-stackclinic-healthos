<?php
/**
 * StackClinic API - Library Files
 * GET /api/library/files
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
        SELECT id, name, url, type, category, created_at
        FROM biblioteca_arquivos
        WHERE clinica_id = :clinica_id
        ORDER BY category, name
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $files = $stmt->fetchAll();

    foreach ($files as &$file) {
        $file['id'] = (int) $file['id'];
    }

    Response::success($files);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar arquivos');
}