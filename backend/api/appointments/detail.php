<?php
/**
 * StackClinic API - Appointment Detail
 * GET /api/appointments/{id}
 * PUT /api/appointments/{id}
 * DELETE /api/appointments/{id}
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

// Get ID from URL
$uri = $_SERVER['REQUEST_URI'];
preg_match('/\/appointments\/(\d+)/', $uri, $matches);
$id = $matches[1] ?? null;

if (!$id) {
    Response::error('ID do agendamento não informado');
}

try {
    if ($method === 'GET') {
        $stmt = $db->prepare("
            SELECT a.id, a.paciente_id as patient_id, p.name as patient_name, p.phone as patient_phone,
                   a.date, TIME_FORMAT(a.time, '%H:%i') as time, a.duration, a.status, a.`procedure`, a.notes
            FROM agendamentos a
            JOIN pacientes p ON a.paciente_id = p.id
            WHERE a.id = :id AND a.clinica_id = :clinica_id
        ");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        $appointment = $stmt->fetch();
        
        if (!$appointment) {
            Response::notFound('Agendamento não encontrado');
        }
        
        Response::success($appointment);
        
    } elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $updates = [];
        $params = [':id' => $id, ':clinica_id' => $clinicaId];
        
        if (isset($data['date'])) {
            $updates[] = "date = :date";
            $params[':date'] = $data['date'];
        }
        if (isset($data['time'])) {
            $updates[] = "time = :time";
            $params[':time'] = $data['time'];
        }
        if (isset($data['status'])) {
            $updates[] = "status = :status";
            $params[':status'] = $data['status'];
        }
        if (isset($data['procedure'])) {
            $updates[] = "`procedure` = :procedure";
            $params[':procedure'] = $data['procedure'];
        }
        if (isset($data['notes'])) {
            $updates[] = "notes = :notes";
            $params[':notes'] = $data['notes'];
        }
        if (isset($data['duration'])) {
            $updates[] = "duration = :duration";
            $params[':duration'] = $data['duration'];
        }
        
        if (empty($updates)) {
            Response::error('Nenhum dado para atualizar');
        }
        
        $sql = "UPDATE agendamentos SET " . implode(', ', $updates) . " WHERE id = :id AND clinica_id = :clinica_id";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        // Buscar agendamento atualizado
        $stmt = $db->prepare("
            SELECT a.id, a.paciente_id as patient_id, p.name as patient_name, p.phone as patient_phone,
                   a.date, TIME_FORMAT(a.time, '%H:%i') as time, a.duration, a.status, a.`procedure`, a.notes
            FROM agendamentos a
            JOIN pacientes p ON a.paciente_id = p.id
            WHERE a.id = :id AND a.clinica_id = :clinica_id
        ");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        $appointment = $stmt->fetch();
        
        Response::success($appointment, 'Agendamento atualizado');
        
    } elseif ($method === 'DELETE') {
        $stmt = $db->prepare("DELETE FROM agendamentos WHERE id = :id AND clinica_id = :clinica_id");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        
        if ($stmt->rowCount() > 0) {
            Response::success(['deleted' => true], 'Agendamento removido');
        } else {
            Response::notFound('Agendamento não encontrado');
        }
    }
    
} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao processar agendamento');
}