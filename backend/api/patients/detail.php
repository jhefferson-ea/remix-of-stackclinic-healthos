<?php
/**
 * StackClinic API - Patient Detail
 * GET /api/patients/{id}
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
preg_match('/\/patients\/(\d+)/', $uri, $matches);
$id = $matches[1] ?? null;

if (!$id) {
    Response::error('ID do paciente não informado');
}

try {
    // Dados básicos do paciente (verificando clínica)
    $stmt = $db->prepare("
        SELECT id, name, phone, email, avatar, convenio, birth_date, address, cpf, created_at
        FROM pacientes
        WHERE id = :id AND clinica_id = :clinica_id
    ");
    $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
    $patient = $stmt->fetch();
    
    if (!$patient) {
        Response::notFound('Paciente não encontrado');
    }
    
    // Total de consultas (da mesma clínica)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total FROM agendamentos WHERE paciente_id = :id AND clinica_id = :clinica_id
    ");
    $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
    $patient['total_appointments'] = (int) $stmt->fetch()['total'];
    
    // Total gasto (da mesma clínica)
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(value), 0) as total 
        FROM financeiro_transacoes 
        WHERE paciente_id = :id AND clinica_id = :clinica_id AND type = 'entrada'
    ");
    $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
    $patient['total_spent'] = (float) $stmt->fetch()['total'];
    
    $patient['id'] = (int) $patient['id'];
    
    Response::success($patient);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar paciente');
}