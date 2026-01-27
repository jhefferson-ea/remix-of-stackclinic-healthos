<?php
/**
 * StackClinic API - Clinic Config
 * GET/PUT /api/config/clinic
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
        $stmt = $db->prepare("SELECT name, cnpj, phone, email, address, logo_url FROM clinica WHERE id = :clinica_id");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $clinic = $stmt->fetch();
        
        $stmt = $db->prepare("SELECT day, open, close, active FROM horario_funcionamento WHERE clinica_id = :clinica_id ORDER BY day");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $clinic['working_hours'] = $stmt->fetchAll();
        
        Response::success($clinic);
    } elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        $fields = ['name', 'cnpj', 'phone', 'email', 'address'];
        $updates = [];
        $params = [':clinica_id' => $clinicaId];
        foreach ($fields as $f) {
            if (isset($data[$f])) { 
                $updates[] = "$f = :$f"; 
                $params[":$f"] = $data[$f]; 
            }
        }
        if ($updates) {
            $db->prepare("UPDATE clinica SET " . implode(', ', $updates) . " WHERE id = :clinica_id")->execute($params);
        }
        
        // Process working_hours if provided
        if (isset($data['working_hours']) && is_array($data['working_hours'])) {
            foreach ($data['working_hours'] as $wh) {
                $day = (int)($wh['day'] ?? 0);
                $open = $wh['open'] ?? '08:00';
                $close = $wh['close'] ?? '18:00';
                $active = isset($wh['active']) ? ($wh['active'] ? 1 : 0) : 0;
                
                // Upsert - insert or update
                $stmt = $db->prepare("
                    INSERT INTO horario_funcionamento (clinica_id, day, open, close, active)
                    VALUES (:clinica_id, :day, :open, :close, :active)
                    ON DUPLICATE KEY UPDATE open = VALUES(open), close = VALUES(close), active = VALUES(active)
                ");
                $stmt->execute([
                    ':clinica_id' => $clinicaId,
                    ':day' => $day,
                    ':open' => $open,
                    ':close' => $close,
                    ':active' => $active
                ]);
            }
        }
        
        Response::success(['updated' => true]);
    }
} catch (Exception $e) {
    Response::serverError('Erro');
}