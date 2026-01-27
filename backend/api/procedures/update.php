<?php
/**
 * StackClinic API - Update/Delete Procedure
 * PUT /api/procedures/update - Update procedure
 * DELETE /api/procedures/update?id=X - Delete (soft) procedure
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

$database = new Database();
$db = $database->getConnection();

// PUT - Update procedure
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $id = (int)($data['id'] ?? 0);
    
    if (!$id) {
        Response::badRequest('ID do procedimento é obrigatório');
    }
    
    try {
        // Check if exists and belongs to this clinic
        $stmt = $db->prepare("SELECT id FROM procedimentos WHERE id = :id AND clinica_id = :clinica_id AND active = 1 LIMIT 1");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        if (!$stmt->fetch()) {
            Response::notFound('Procedimento não encontrado');
        }
        
        $updates = [];
        $params = [':id' => $id, ':clinica_id' => $clinicaId];
        
        if (isset($data['name'])) {
            $name = trim($data['name']);
            if (empty($name)) {
                Response::badRequest('Nome do procedimento não pode estar vazio');
            }
            // Check for duplicate name (excluding current, within same clinic)
            $stmt = $db->prepare("SELECT id FROM procedimentos WHERE name = :name AND id != :id AND clinica_id = :clinica_id AND active = 1 LIMIT 1");
            $stmt->execute([':name' => $name, ':id' => $id, ':clinica_id' => $clinicaId]);
            if ($stmt->fetch()) {
                Response::badRequest('Já existe outro procedimento com este nome');
            }
            $updates[] = "name = :name";
            $params[':name'] = $name;
        }
        
        if (isset($data['price'])) {
            $price = floatval($data['price']);
            if ($price < 0) {
                Response::badRequest('Preço não pode ser negativo');
            }
            $updates[] = "price = :price";
            $params[':price'] = $price;
        }
        
        if (isset($data['duration'])) {
            $duration = (int)$data['duration'];
            if ($duration < 5) {
                Response::badRequest('Duração mínima é de 5 minutos');
            }
            $updates[] = "duration = :duration";
            $params[':duration'] = $duration;
        }
        
        if (empty($updates)) {
            Response::badRequest('Nenhum campo para atualizar');
        }
        
        $sql = "UPDATE procedimentos SET " . implode(', ', $updates) . " WHERE id = :id AND clinica_id = :clinica_id";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        // Fetch updated record
        $stmt = $db->prepare("SELECT id, name, price, duration, active FROM procedimentos WHERE id = :id AND clinica_id = :clinica_id");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        $proc = $stmt->fetch(PDO::FETCH_ASSOC);
        
        Response::success([
            'id' => (int) $proc['id'],
            'name' => $proc['name'],
            'price' => (float) $proc['price'],
            'duration' => (int) $proc['duration'],
            'active' => (bool) $proc['active'],
        ], 'Procedimento atualizado com sucesso');
        
    } catch (Exception $e) {
        error_log("Update procedure error: " . $e->getMessage());
        Response::serverError('Erro ao atualizar procedimento');
    }
}

// DELETE - Soft delete procedure
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    
    if (!$id) {
        Response::badRequest('ID do procedimento é obrigatório');
    }
    
    try {
        // Check if exists and belongs to this clinic
        $stmt = $db->prepare("SELECT id FROM procedimentos WHERE id = :id AND clinica_id = :clinica_id AND active = 1 LIMIT 1");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        if (!$stmt->fetch()) {
            Response::notFound('Procedimento não encontrado');
        }
        
        // Soft delete (set active = 0)
        $stmt = $db->prepare("UPDATE procedimentos SET active = 0 WHERE id = :id AND clinica_id = :clinica_id");
        $stmt->execute([':id' => $id, ':clinica_id' => $clinicaId]);
        
        Response::success(['deleted' => true], 'Procedimento excluído com sucesso');
        
    } catch (Exception $e) {
        error_log("Delete procedure error: " . $e->getMessage());
        Response::serverError('Erro ao excluir procedimento');
    }
}

Response::methodNotAllowed();