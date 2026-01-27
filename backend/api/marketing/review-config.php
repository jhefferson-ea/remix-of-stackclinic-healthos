<?php
/**
 * StackClinic API - Review Config
 * GET/POST /api/marketing/review-config
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
            SELECT auto_request_review as auto_request, min_rating, delay_hours
            FROM marketing_config
            WHERE clinica_id = :clinica_id
            LIMIT 1
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $config = $stmt->fetch();
        
        if (!$config) {
            // Criar configuração padrão
            $stmt = $db->prepare("
                INSERT INTO marketing_config (clinica_id, auto_request_review, min_rating, delay_hours)
                VALUES (:clinica_id, 1, 4, 2)
            ");
            $stmt->execute([':clinica_id' => $clinicaId]);
            
            $config = [
                'auto_request' => true,
                'min_rating' => 4,
                'delay_hours' => 2
            ];
        } else {
            $config['auto_request'] = (bool) $config['auto_request'];
            $config['min_rating'] = (int) $config['min_rating'];
            $config['delay_hours'] = (int) $config['delay_hours'];
        }
        
        Response::success($config);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $updates = [];
        $params = [':clinica_id' => $clinicaId];
        
        if (isset($data['auto_request'])) {
            $updates[] = "auto_request_review = :auto_request";
            $params[':auto_request'] = $data['auto_request'] ? 1 : 0;
        }
        if (isset($data['min_rating'])) {
            $updates[] = "min_rating = :min_rating";
            $params[':min_rating'] = $data['min_rating'];
        }
        if (isset($data['delay_hours'])) {
            $updates[] = "delay_hours = :delay_hours";
            $params[':delay_hours'] = $data['delay_hours'];
        }
        
        if (!empty($updates)) {
            $sql = "UPDATE marketing_config SET " . implode(', ', $updates) . " WHERE clinica_id = :clinica_id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }
        
        // Retornar config atualizada
        $stmt = $db->prepare("
            SELECT auto_request_review as auto_request, min_rating, delay_hours
            FROM marketing_config
            WHERE clinica_id = :clinica_id
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $config = $stmt->fetch();
        
        $config['auto_request'] = (bool) $config['auto_request'];
        $config['min_rating'] = (int) $config['min_rating'];
        $config['delay_hours'] = (int) $config['delay_hours'];
        
        Response::success($config, 'Configuração atualizada');
    }

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao processar configuração de reviews');
}