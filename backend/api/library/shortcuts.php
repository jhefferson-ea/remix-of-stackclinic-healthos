<?php
/**
 * StackClinic API - Library Shortcuts
 * GET/POST /api/library/shortcuts
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
$method = $_SERVER['REQUEST_METHOD'];

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

try {
    if ($method === 'GET') {
        $stmt = $db->prepare("
            SELECT s.id, s.command, s.file_id, f.name as file_name
            FROM biblioteca_atalhos s
            JOIN biblioteca_arquivos f ON s.file_id = f.id
            WHERE s.clinica_id = :clinica_id
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        Response::success($stmt->fetchAll());
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $db->prepare("INSERT INTO biblioteca_atalhos (command, file_id, clinica_id) VALUES (:command, :file_id, :clinica_id)");
        $stmt->execute([':command' => $data['command'], ':file_id' => $data['file_id'], ':clinica_id' => $clinicaId]);
        Response::success(['id' => (int)$db->lastInsertId()], 'Atalho criado');
    }
} catch (Exception $e) {
    Response::serverError('Erro ao processar atalhos');
}