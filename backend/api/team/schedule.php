<?php
/**
 * StackClinic API - Professional Schedule
 * GET /api/team/{id}/schedule - Get individual schedule for a professional
 * POST /api/team/{id}/schedule - Update individual schedule for a professional
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$authUser = Auth::requireAuth();

// Only admin can manage team schedules
if ($authUser['role'] !== 'admin') {
    Response::forbidden('Acesso negado');
}

$clinicaId = $authUser['clinica_id'];

if (!$clinicaId) {
    Response::unauthorized('Usuário não vinculado a uma clínica');
}

// Extract user ID from URL: /api/team/{id}/schedule
$uri = $_SERVER['REQUEST_URI'];
preg_match('/\/api\/team\/(\d+)\/schedule/', $uri, $matches);
$userId = isset($matches[1]) ? (int)$matches[1] : null;

if (!$userId) {
    Response::badRequest('ID do profissional é obrigatório');
}

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    // Verify user belongs to this clinic
    $stmt = $db->prepare("SELECT id, name, role FROM usuarios WHERE id = :id AND clinica_id = :clinica_id");
    $stmt->execute([':id' => $userId, ':clinica_id' => $clinicaId]);
    $user = $stmt->fetch();

    if (!$user) {
        Response::notFound('Profissional não encontrado');
    }

    if ($method === 'GET') {
        // Get professional's individual schedule
        $stmt = $db->prepare("
            SELECT id, day, TIME_FORMAT(`open`, '%H:%i') as `open`, TIME_FORMAT(`close`, '%H:%i') as `close`, active
            FROM horario_profissional
            WHERE usuario_id = :usuario_id AND clinica_id = :clinica_id
            ORDER BY day
        ");
        $stmt->execute([':usuario_id' => $userId, ':clinica_id' => $clinicaId]);
        $schedule = $stmt->fetchAll();

        // Also get clinic's default schedule for comparison
        $stmtClinic = $db->prepare("
            SELECT day, TIME_FORMAT(`open`, '%H:%i') as `open`, TIME_FORMAT(`close`, '%H:%i') as `close`, active
            FROM horario_funcionamento
            WHERE clinica_id = :clinica_id
            ORDER BY day
        ");
        $stmtClinic->execute([':clinica_id' => $clinicaId]);
        $clinicSchedule = $stmtClinic->fetchAll();

        // Format response
        $dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        
        $formattedSchedule = [];
        foreach ($schedule as $s) {
            $formattedSchedule[] = [
                'id' => (int)$s['id'],
                'day' => (int)$s['day'],
                'day_name' => $dayNames[(int)$s['day']],
                'open' => $s['open'],
                'close' => $s['close'],
                'active' => (bool)$s['active']
            ];
        }

        $formattedClinicSchedule = [];
        foreach ($clinicSchedule as $s) {
            $formattedClinicSchedule[] = [
                'day' => (int)$s['day'],
                'day_name' => $dayNames[(int)$s['day']],
                'open' => $s['open'],
                'close' => $s['close'],
                'active' => (bool)$s['active']
            ];
        }

        Response::success([
            'professional' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'role' => $user['role']
            ],
            'schedule' => $formattedSchedule,
            'clinic_schedule' => $formattedClinicSchedule,
            'has_custom_schedule' => count($schedule) > 0
        ]);

    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $scheduleData = $data['schedule'] ?? [];
        $useClinicSchedule = $data['use_clinic_schedule'] ?? false;

        // Start transaction
        $db->beginTransaction();

        try {
            // If using clinic schedule, remove individual schedule
            if ($useClinicSchedule) {
                $stmt = $db->prepare("DELETE FROM horario_profissional WHERE usuario_id = :usuario_id AND clinica_id = :clinica_id");
                $stmt->execute([':usuario_id' => $userId, ':clinica_id' => $clinicaId]);
                
                $db->commit();
                Response::success(['use_clinic_schedule' => true], 'Profissional usando horário da clínica');
                exit;
            }

            // Validate schedule data
            if (empty($scheduleData)) {
                Response::badRequest('Dados do horário são obrigatórios');
            }

            // Remove existing schedule
            $stmt = $db->prepare("DELETE FROM horario_profissional WHERE usuario_id = :usuario_id AND clinica_id = :clinica_id");
            $stmt->execute([':usuario_id' => $userId, ':clinica_id' => $clinicaId]);

            // Insert new schedule
            $stmt = $db->prepare("
                INSERT INTO horario_profissional (usuario_id, clinica_id, day, `open`, `close`, active)
                VALUES (:usuario_id, :clinica_id, :day, :open, :close, :active)
            ");

            foreach ($scheduleData as $daySchedule) {
                if (!isset($daySchedule['day'])) continue;
                
                $stmt->execute([
                    ':usuario_id' => $userId,
                    ':clinica_id' => $clinicaId,
                    ':day' => (int)$daySchedule['day'],
                    ':open' => $daySchedule['open'] ?? '08:00',
                    ':close' => $daySchedule['close'] ?? '18:00',
                    ':active' => isset($daySchedule['active']) ? (bool)$daySchedule['active'] : true
                ]);
            }

            $db->commit();

            Response::success([
                'days_configured' => count($scheduleData)
            ], 'Horário do profissional atualizado com sucesso');

        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }

    } else {
        Response::methodNotAllowed();
    }

} catch (Exception $e) {
    error_log("Professional schedule error: " . $e->getMessage());
    Response::serverError('Erro ao processar horário do profissional');
}
