<?php
/**
 * StackClinic API - Patient Anamnesis
 * GET /api/patients/{id}/anamnesis
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
preg_match('/\/patients\/(\d+)\/anamnesis/', $uri, $matches);
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

    // Buscar anamnese
    $stmt = $db->prepare("
        SELECT id, updated_at FROM anamnese WHERE paciente_id = :id LIMIT 1
    ");
    $stmt->execute([':id' => $id]);
    $anamnese = $stmt->fetch();
    
    if (!$anamnese) {
        Response::success([
            'patient_id' => (int) $id,
            'questions' => [],
            'alerts' => [],
            'updated_at' => null
        ]);
    }
    
    // Buscar perguntas
    $stmt = $db->prepare("
        SELECT id, question, answer, category
        FROM anamnese_perguntas
        WHERE anamnese_id = :id
    ");
    $stmt->execute([':id' => $anamnese['id']]);
    $questions = $stmt->fetchAll();
    
    foreach ($questions as &$q) {
        $q['id'] = (int) $q['id'];
    }
    
    // Buscar alertas
    $stmt = $db->prepare("
        SELECT id, type, description, severity
        FROM anamnese_alertas
        WHERE anamnese_id = :id
    ");
    $stmt->execute([':id' => $anamnese['id']]);
    $alerts = $stmt->fetchAll();
    
    foreach ($alerts as &$a) {
        $a['id'] = (int) $a['id'];
    }
    
    Response::success([
        'patient_id' => (int) $id,
        'questions' => $questions,
        'alerts' => $alerts,
        'updated_at' => $anamnese['updated_at']
    ]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar anamnese');
}