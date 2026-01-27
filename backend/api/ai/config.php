<?php
/**
 * StackClinic API - AI Config
 * GET /api/ai/config - Get config
 * POST /api/ai/config - Update config
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

try {
    if ($method === 'GET') {
        $stmt = $db->prepare("
            SELECT personality, reminder_24h, request_confirmation, auto_cancel, auto_cancel_hours
            FROM ia_config
            WHERE clinica_id = :clinica_id
            LIMIT 1
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $config = $stmt->fetch();
        
        if (!$config) {
            // Criar configuração padrão para esta clínica
            $stmt = $db->prepare("
                INSERT INTO ia_config (clinica_id, personality, reminder_24h, request_confirmation, auto_cancel, auto_cancel_hours)
                VALUES (:clinica_id, 'dentista', 1, 1, 0, 2)
            ");
            $stmt->execute([':clinica_id' => $clinicaId]);
            
            $config = [
                'personality' => 'dentista',
                'reminder_24h' => true,
                'request_confirmation' => true,
                'auto_cancel' => false,
                'auto_cancel_hours' => 2
            ];
        } else {
            $config['reminder_24h'] = (bool) $config['reminder_24h'];
            $config['request_confirmation'] = (bool) $config['request_confirmation'];
            $config['auto_cancel'] = (bool) $config['auto_cancel'];
            $config['auto_cancel_hours'] = (int) $config['auto_cancel_hours'];
        }
        
        Response::success($config);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $updates = [];
        $params = [':clinica_id' => $clinicaId];
        
        if (isset($data['personality'])) {
            $updates[] = "personality = :personality";
            $params[':personality'] = $data['personality'];
        }
        if (isset($data['reminder_24h'])) {
            $updates[] = "reminder_24h = :reminder_24h";
            $params[':reminder_24h'] = $data['reminder_24h'] ? 1 : 0;
        }
        if (isset($data['request_confirmation'])) {
            $updates[] = "request_confirmation = :request_confirmation";
            $params[':request_confirmation'] = $data['request_confirmation'] ? 1 : 0;
        }
        if (isset($data['auto_cancel'])) {
            $updates[] = "auto_cancel = :auto_cancel";
            $params[':auto_cancel'] = $data['auto_cancel'] ? 1 : 0;
        }
        if (isset($data['auto_cancel_hours'])) {
            $updates[] = "auto_cancel_hours = :auto_cancel_hours";
            $params[':auto_cancel_hours'] = $data['auto_cancel_hours'];
        }
        
        if (!empty($updates)) {
            $sql = "UPDATE ia_config SET " . implode(', ', $updates) . " WHERE clinica_id = :clinica_id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }
        
        // Retornar config atualizada
        $stmt = $db->prepare("
            SELECT personality, reminder_24h, request_confirmation, auto_cancel, auto_cancel_hours
            FROM ia_config
            WHERE clinica_id = :clinica_id
            LIMIT 1
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $config = $stmt->fetch();
        
        $config['reminder_24h'] = (bool) $config['reminder_24h'];
        $config['request_confirmation'] = (bool) $config['request_confirmation'];
        $config['auto_cancel'] = (bool) $config['auto_cancel'];
        $config['auto_cancel_hours'] = (int) $config['auto_cancel_hours'];
        
        Response::success($config, 'Configuração atualizada');
    }

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao processar configuração de IA');
}