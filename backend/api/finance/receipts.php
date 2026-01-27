<?php
/**
 * StackClinic API - Receipts
 * GET /api/finance/receipts
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
        SELECT r.id, p.name as patient_name, r.`procedure`, r.value, r.date, r.status
        FROM recibos r
        JOIN pacientes p ON r.paciente_id = p.id
        WHERE r.clinica_id = :clinica_id
        ORDER BY r.date DESC
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $receipts = $stmt->fetchAll();

    foreach ($receipts as &$receipt) {
        $receipt['id'] = (int) $receipt['id'];
        $receipt['value'] = (float) $receipt['value'];
    }

    Response::success($receipts);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar recibos');
}