<?php
/**
 * StackClinic API - Appointments
 * GET /api/appointments - List appointments
 * POST /api/appointments - Create appointment
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
    if ($method === 'GET') {
        $date = $_GET['date'] ?? null;
        
        $bt = chr(96); // Backtick seguro
        $procedureSelect = $hasProcedureName
            ? "COALESCE(a.procedure_name, a.{$bt}procedure{$bt})"
            : "a.{$bt}procedure{$bt}";

        $sql = "
            SELECT a.id, a.paciente_id as patient_id, p.name as patient_name, p.phone as patient_phone,
                   a.date, TIME_FORMAT(a.time, '%H:%i') as time, a.duration, a.status,
                   {$procedureSelect} as {$bt}procedure{$bt}, a.notes, 'appointment' as slot_type
            FROM agendamentos a
            JOIN pacientes p ON a.paciente_id = p.id
            WHERE a.clinica_id = :clinica_id
        ";
        
        $params = [':clinica_id' => $clinicaId];
        
        if ($date) {
            $sql .= " AND a.date = :date";
            $params[':date'] = $date;
        } else {
            $sql .= " AND a.date >= CURDATE() - INTERVAL 30 DAY";
        }
        
        $sql .= " ORDER BY a.date, a.time";
        
        // Also get blocks filtered by clinic
        $blocksSql = "
            SELECT id, title, day_of_week, TIME_FORMAT(start_time, '%H:%i') as start_time, 
                   TIME_FORMAT(end_time, '%H:%i') as end_time, recurring, specific_date
            FROM bloqueios_agenda 
            WHERE clinica_id = :clinica_id AND (recurring = 1 OR specific_date >= CURDATE())
        ";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        $appointments = $stmt->fetchAll();
        
        // Fetch blocks
        $blocksStmt = $db->prepare($blocksSql);
        $blocksStmt->execute([':clinica_id' => $clinicaId]);
        $blocks = $blocksStmt->fetchAll();
        
        // Convert types
        foreach ($appointments as &$apt) {
            $apt['id'] = (int) $apt['id'];
            $apt['patient_id'] = (int) $apt['patient_id'];
            $apt['duration'] = (int) $apt['duration'];
            $apt['slot_type'] = 'appointment';
        }
        
        // Convert blocks
        foreach ($blocks as &$block) {
            $block['id'] = (int) $block['id'];
            $block['day_of_week'] = $block['day_of_week'] !== null ? (int) $block['day_of_week'] : null;
            $block['recurring'] = (bool) $block['recurring'];
        }
        
        Response::success([
            'appointments' => $appointments,
            'blocks' => $blocks
        ]);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['patient_id'], $data['date'], $data['time'])) {
            Response::error('Dados incompletos');
        }
        
        $bt = chr(96);
        $procedureColumn = $hasProcedureName ? 'procedure_name' : "{$bt}procedure{$bt}";

        $stmt = $db->prepare("
            INSERT INTO agendamentos (paciente_id, date, time, duration, {$procedureColumn}, procedimento_id, notes, status, payment_status, clinica_id)
            VALUES (:patient_id, :date, :time, :duration, :procedure, :procedimento_id, :notes, 'pending', 'a_receber', :clinica_id)
        ");
        
        $procedimentoId = $data['procedimento_id'] ?? null;
        
        $stmt->execute([
            ':patient_id' => $data['patient_id'],
            ':date' => $data['date'],
            ':time' => $data['time'],
            ':duration' => $data['duration'] ?? 30,
            ':procedure' => $data['procedure'] ?? null,
            ':procedimento_id' => $procedimentoId,
            ':notes' => $data['notes'] ?? null,
            ':clinica_id' => $clinicaId
        ]);
        
        $id = $db->lastInsertId();
        
        // Se tiver procedimento, criar registro de pagamento
        if ($procedimentoId) {
            $procStmt = $db->prepare("SELECT price FROM procedimentos WHERE id = :id AND clinica_id = :clinica_id");
            $procStmt->execute([':id' => $procedimentoId, ':clinica_id' => $clinicaId]);
            $proc = $procStmt->fetch();
            $amount = $proc ? $proc['price'] : 0;
            
            $patientStmt = $db->prepare("SELECT name FROM pacientes WHERE id = :id AND clinica_id = :clinica_id");
            $patientStmt->execute([':id' => $data['patient_id'], ':clinica_id' => $clinicaId]);
            $patient = $patientStmt->fetch();
            
            $paymentStmt = $db->prepare("
                INSERT INTO pagamentos_procedimentos 
                (agendamento_id, procedimento_id, patient_id, patient_name, procedure_name, amount, status, appointment_date, appointment_time, clinica_id)
                VALUES (:agendamento_id, :procedimento_id, :patient_id, :patient_name, :procedure_name, :amount, 'a_receber', :date, :time, :clinica_id)
            ");
            $paymentStmt->execute([
                ':agendamento_id' => $id,
                ':procedimento_id' => $procedimentoId,
                ':patient_id' => $data['patient_id'],
                ':patient_name' => $patient ? $patient['name'] : '',
                ':procedure_name' => $data['procedure'] ?? '',
                ':amount' => $amount,
                ':date' => $data['date'],
                ':time' => $data['time'],
                ':clinica_id' => $clinicaId
            ]);
        }
        
        // Buscar o agendamento criado
        $bt = chr(96);
        $procedureSelect = $hasProcedureName
            ? "COALESCE(a.procedure_name, a.{$bt}procedure{$bt})"
            : "a.{$bt}procedure{$bt}";

        $stmt = $db->prepare("
            SELECT a.id, a.paciente_id as patient_id, p.name as patient_name, p.phone as patient_phone,
                   a.date, TIME_FORMAT(a.time, '%H:%i') as time, a.duration, a.status,
                   {$procedureSelect} as {$bt}procedure{$bt}, a.notes
            FROM agendamentos a
            JOIN pacientes p ON a.paciente_id = p.id
            WHERE a.id = :id AND a.clinica_id = :clinica_id
        ");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        $appointment = $stmt->fetch();
        
        Response::success($appointment, 'Agendamento criado com sucesso');
    }
    
} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao processar agendamentos: ' . $e->getMessage());
}