<?php
/**
 * StackClinic API - Custom AI Triggers
 * GET /api/ai/custom-triggers - List custom triggers
 * POST /api/ai/custom-triggers - Create/Update custom trigger
 * DELETE /api/ai/custom-triggers - Delete custom trigger
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
            SELECT id, name, message, trigger_type, interval_hours, target_type, 
                   target_value, enabled, created_at, updated_at
            FROM gatilhos_customizados
            WHERE clinica_id = :clinica_id
            ORDER BY created_at DESC
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        
        $triggers = $stmt->fetchAll();
        
        foreach ($triggers as &$trigger) {
            $trigger['id'] = (int)$trigger['id'];
            $trigger['interval_hours'] = (int)$trigger['interval_hours'];
            $trigger['enabled'] = (bool)$trigger['enabled'];
        }
        
        Response::success($triggers);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $name = trim($data['name'] ?? '');
        $message = trim($data['message'] ?? '');
        $triggerType = $data['trigger_type'] ?? 'recurring';
        $intervalHours = (int)($data['interval_hours'] ?? 24);
        $targetType = $data['target_type'] ?? 'all';
        $targetValue = $data['target_value'] ?? null;
        $enabled = (bool)($data['enabled'] ?? true);
        $id = isset($data['id']) ? (int)$data['id'] : null;
        
        if (empty($name) || empty($message)) {
            Response::badRequest('Nome e mensagem são obrigatórios');
        }
        
        if ($id) {
            // Update existing (verify ownership)
            $stmt = $db->prepare("
                UPDATE gatilhos_customizados 
                SET name = :name, message = :message, trigger_type = :trigger_type,
                    interval_hours = :interval_hours, target_type = :target_type,
                    target_value = :target_value, enabled = :enabled,
                    updated_at = NOW()
                WHERE id = :id AND clinica_id = :clinica_id
            ");
            $stmt->execute([
                ':id' => $id,
                ':clinica_id' => $clinicaId,
                ':name' => $name,
                ':message' => $message,
                ':trigger_type' => $triggerType,
                ':interval_hours' => $intervalHours,
                ':target_type' => $targetType,
                ':target_value' => $targetValue,
                ':enabled' => $enabled ? 1 : 0
            ]);
            
            if ($stmt->rowCount() === 0) {
                Response::notFound('Gatilho não encontrado');
            }
            
            Response::success(['id' => $id], 'Gatilho atualizado com sucesso');
        } else {
            // Create new
            $stmt = $db->prepare("
                INSERT INTO gatilhos_customizados 
                (name, message, trigger_type, interval_hours, target_type, target_value, enabled, clinica_id)
                VALUES (:name, :message, :trigger_type, :interval_hours, :target_type, :target_value, :enabled, :clinica_id)
            ");
            $stmt->execute([
                ':name' => $name,
                ':message' => $message,
                ':trigger_type' => $triggerType,
                ':interval_hours' => $intervalHours,
                ':target_type' => $targetType,
                ':target_value' => $targetValue,
                ':enabled' => $enabled ? 1 : 0,
                ':clinica_id' => $clinicaId
            ]);
            
            $id = (int)$db->lastInsertId();
            Response::success(['id' => $id], 'Gatilho criado com sucesso');
        }
        
    } elseif ($method === 'DELETE') {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = isset($data['id']) ? (int)$data['id'] : null;
        
        if (!$id) {
            Response::badRequest('ID do gatilho é obrigatório');
        }
        
        $stmt = $db->prepare("DELETE FROM gatilhos_customizados WHERE id = :id AND clinica_id = :clinica_id");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        
        if ($stmt->rowCount() === 0) {
            Response::notFound('Gatilho não encontrado');
        }
        
        Response::success(['deleted' => true], 'Gatilho excluído com sucesso');
        
    } else {
        Response::methodNotAllowed();
    }
    
} catch (Exception $e) {
    error_log("Custom triggers error: " . $e->getMessage());
    Response::serverError('Erro ao processar gatilhos');
}