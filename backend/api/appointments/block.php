<?php
/**
 * StackClinic API - Block Time Slot
 * POST /api/appointments/block
 * DELETE /api/appointments/block?id=X
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$method = $_SERVER['REQUEST_METHOD'];

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

$database = new Database();
$db = $database->getConnection();

// Handle DELETE request
if ($method === 'DELETE') {
    try {
        $id = $_GET['id'] ?? null;
        
        if (!$id) {
            Response::badRequest('ID do bloqueio é obrigatório');
        }
        
        // Verificar se pertence à clínica
        $stmt = $db->prepare("DELETE FROM bloqueios_agenda WHERE id = :id AND clinica_id = :clinica_id");
        $stmt->execute([':id' => (int)$id, ':clinica_id' => $clinicaId]);
        
        if ($stmt->rowCount() > 0) {
            Response::success(['deleted' => true], 'Bloqueio excluído com sucesso');
        } else {
            Response::notFound('Bloqueio não encontrado');
        }
    } catch (Exception $e) {
        error_log("Delete block error: " . $e->getMessage());
        Response::serverError('Erro ao excluir bloqueio: ' . $e->getMessage());
    }
    exit;
}

if ($method !== 'POST') {
    Response::methodNotAllowed();
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data) {
        Response::badRequest('JSON inválido');
    }

    $title = trim($data['title'] ?? '');
    $days = $data['days'] ?? [];
    $startTime = $data['start_time'] ?? '';
    $endTime = $data['end_time'] ?? '';
    $recurring = (bool)($data['recurring'] ?? false);
    $specificDate = $data['specific_date'] ?? null;

    if (empty($title)) {
        Response::badRequest('Título é obrigatório');
    }

    if (empty($startTime) || empty($endTime)) {
        Response::badRequest('Horários são obrigatórios');
    }
    
    $createdBlocks = [];

    if ($recurring && !empty($days)) {
        // Create recurring blocks for each selected day
        foreach ($days as $day) {
            $stmt = $db->prepare("
                INSERT INTO bloqueios_agenda (title, day_of_week, start_time, end_time, recurring, clinica_id) 
                VALUES (:title, :day, :start, :end, 1, :clinica_id)
            ");
            $stmt->execute([
                ':title' => $title,
                ':day' => (int)$day,
                ':start' => $startTime,
                ':end' => $endTime,
                ':clinica_id' => $clinicaId
            ]);
            $createdBlocks[] = [
                'id' => (int)$db->lastInsertId(),
                'title' => $title,
                'day_of_week' => (int)$day,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'recurring' => true
            ];
        }
    } elseif (!empty($specificDate)) {
        // Create single day block
        $stmt = $db->prepare("
            INSERT INTO bloqueios_agenda (title, specific_date, start_time, end_time, recurring, clinica_id) 
            VALUES (:title, :date, :start, :end, 0, :clinica_id)
        ");
        $stmt->execute([
            ':title' => $title,
            ':date' => $specificDate,
            ':start' => $startTime,
            ':end' => $endTime,
            ':clinica_id' => $clinicaId
        ]);
        $createdBlocks[] = [
            'id' => (int)$db->lastInsertId(),
            'title' => $title,
            'specific_date' => $specificDate,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'recurring' => false
        ];
    } else {
        Response::badRequest('Selecione dias da semana para bloqueio recorrente ou uma data específica');
    }

    Response::success($createdBlocks, 'Bloqueio criado com sucesso');

} catch (Exception $e) {
    error_log("Block time error: " . $e->getMessage());
    Response::serverError('Erro ao criar bloqueio: ' . $e->getMessage());
}