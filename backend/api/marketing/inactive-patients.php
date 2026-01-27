<?php
/**
 * StackClinic API - Inactive Patients
 * GET /api/marketing/inactive-patients
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
        SELECT 
            p.id, 
            p.name, 
            p.phone,
            (SELECT MAX(date) FROM agendamentos WHERE paciente_id = p.id AND clinica_id = :clinica_id2) as last_visit,
            (SELECT COALESCE(SUM(value), 0) FROM financeiro_transacoes WHERE paciente_id = p.id AND clinica_id = :clinica_id3 AND type = 'entrada') as total_spent
        FROM pacientes p
        WHERE p.clinica_id = :clinica_id AND NOT EXISTS (
            SELECT 1 FROM agendamentos a 
            WHERE a.paciente_id = p.id 
            AND a.clinica_id = :clinica_id4
            AND a.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        )
        ORDER BY last_visit DESC
        LIMIT 100
    ");
    $stmt->execute([
        ':clinica_id' => $clinicaId,
        ':clinica_id2' => $clinicaId,
        ':clinica_id3' => $clinicaId,
        ':clinica_id4' => $clinicaId
    ]);
    $patients = $stmt->fetchAll();

    foreach ($patients as &$patient) {
        $patient['id'] = (int) $patient['id'];
        $patient['total_spent'] = (float) $patient['total_spent'];
    }

    Response::success($patients);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar pacientes inativos');
}