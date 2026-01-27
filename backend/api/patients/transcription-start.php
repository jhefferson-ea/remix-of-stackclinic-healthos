<?php
/**
 * StackClinic API - Transcription Start
 * POST /api/patients/{id}/transcription/start
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
preg_match('/\/patients\/(\d+)\/transcription\/start/', $uri, $matches);
$patientId = $matches[1] ?? null;

if (!$patientId) {
    Response::error('ID do paciente não informado');
}

try {
    // Verificar se o paciente pertence a esta clínica
    $stmt = $db->prepare("SELECT id FROM pacientes WHERE id = :id AND clinica_id = :clinica_id");
    $stmt->execute([':id' => $patientId, ':clinica_id' => $clinicaId]);
    if (!$stmt->fetch()) {
        Response::notFound('Paciente não encontrado');
    }

    $sessionId = 'session_' . uniqid() . '_' . time();
    
    $stmt = $db->prepare("
        INSERT INTO transcricoes (paciente_id, session_id, clinica_id)
        VALUES (:patient_id, :session_id, :clinica_id)
    ");
    $stmt->execute([
        ':patient_id' => $patientId,
        ':session_id' => $sessionId,
        ':clinica_id' => $clinicaId
    ]);
    
    Response::success(['session_id' => $sessionId]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao iniciar transcrição');
}