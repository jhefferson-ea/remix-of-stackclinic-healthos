<?php
/**
 * StackClinic API - Create Appointment
 * POST /api/appointments/create
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$authUser = Auth::requireAuth();

// Obter clinica_id do usuário autenticado
$clinicaId = $authUser['clinica_id'];

if (!$clinicaId) {
    Response::unauthorized('Usuário não vinculado a uma clínica');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

$data = json_decode(file_get_contents('php://input'), true);

$patientId = (int)($data['patient_id'] ?? 0);
$date = $data['date'] ?? '';
$time = $data['time'] ?? '';
$procedure = trim($data['procedure'] ?? '');
$procedimentoId = isset($data['procedimento_id']) ? (int)$data['procedimento_id'] : null;
$duration = (int)($data['duration'] ?? 30);
$notes = trim($data['notes'] ?? '');

if (!$patientId) {
    Response::badRequest('Paciente é obrigatório');
}

if (empty($date)) {
    Response::badRequest('Data é obrigatória');
}

if (empty($time)) {
    Response::badRequest('Horário é obrigatório');
}

$database = new Database();
$db = $database->getConnection();

// Compatibility: some installs may not have agendamentos.procedure_name
$hasProcedureName = false;
try {
    $hasProcedureNameStmt = $db->prepare("SHOW COLUMNS FROM agendamentos LIKE 'procedure_name'");
    $hasProcedureNameStmt->execute();
    $hasProcedureName = (bool) $hasProcedureNameStmt->fetch();
} catch (Exception $e) {
    $hasProcedureName = false;
}

try {
    // Check if patient exists and belongs to this clinic
    $stmt = $db->prepare("SELECT id, name FROM pacientes WHERE id = :id AND clinica_id = :clinica_id LIMIT 1");
    $stmt->execute([':id' => $patientId, ':clinica_id' => $clinicaId]);
    $patient = $stmt->fetch();
    
    if (!$patient) {
        Response::badRequest('Paciente não encontrado');
    }

    // Check for conflicting appointments (within same clinic)
    $stmt = $db->prepare("SELECT id FROM agendamentos WHERE clinica_id = :clinica_id AND date = :date AND time = :time AND status != 'cancelled' LIMIT 1");
    $stmt->execute([':clinica_id' => $clinicaId, ':date' => $date, ':time' => $time]);
    if ($stmt->fetch()) {
        Response::badRequest('Já existe um agendamento para este horário');
    }

    // Check if procedimento_id column exists
    $hasProcedimentoId = false;
    try {
        $checkStmt = $db->prepare("SHOW COLUMNS FROM agendamentos LIKE 'procedimento_id'");
        $checkStmt->execute();
        $hasProcedimentoId = (bool) $checkStmt->fetch();
    } catch (Exception $e) {
        $hasProcedimentoId = false;
    }

    $procedureColumn = $hasProcedureName ? 'procedure_name' : '`procedure`';
    
    if ($hasProcedimentoId) {
        $stmt = $db->prepare("INSERT INTO agendamentos (paciente_id, date, time, duration, procedimento_id, {$procedureColumn}, notes, status, clinica_id) VALUES (:paciente_id, :date, :time, :duration, :procedimento_id, :procedure, :notes, 'pending', :clinica_id)");
        $stmt->execute([
            ':paciente_id' => $patientId,
            ':date' => $date,
            ':time' => $time,
            ':duration' => $duration,
            ':procedimento_id' => $procedimentoId,
            ':procedure' => $procedure,
            ':notes' => $notes,
            ':clinica_id' => $clinicaId
        ]);
    } else {
        $stmt = $db->prepare("INSERT INTO agendamentos (paciente_id, date, time, duration, {$procedureColumn}, notes, status, clinica_id) VALUES (:paciente_id, :date, :time, :duration, :procedure, :notes, 'pending', :clinica_id)");
        $stmt->execute([
            ':paciente_id' => $patientId,
            ':date' => $date,
            ':time' => $time,
            ':duration' => $duration,
            ':procedure' => $procedure,
            ':notes' => $notes,
            ':clinica_id' => $clinicaId
        ]);
    }

    $appointmentId = $db->lastInsertId();

    Response::success([
        'id' => (int)$appointmentId,
        'patient_id' => $patientId,
        'patient_name' => $patient['name'],
        'date' => $date,
        'time' => $time,
        'duration' => $duration,
        'procedure' => $procedure,
        'procedimento_id' => $procedimentoId,
        'status' => 'pending'
    ], 'Agendamento criado com sucesso');

} catch (Exception $e) {
    error_log("Create appointment error: " . $e->getMessage());
    Response::serverError('Erro ao criar agendamento: ' . $e->getMessage());
}