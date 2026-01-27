<?php
/**
 * StackClinic API - Procedures CRUD
 * GET /api/procedures - List all procedures
 * POST /api/procedures - Create new procedure
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

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

// GET - List procedures
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $db->prepare("
            SELECT id, name, price, duration, active, created_at, updated_at 
            FROM procedimentos 
            WHERE clinica_id = :clinica_id AND active = 1 
            ORDER BY name ASC
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $procedures = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $procedures = array_map(function($proc) {
            return [
                'id' => (int) $proc['id'],
                'name' => $proc['name'],
                'price' => (float) $proc['price'],
                'duration' => (int) $proc['duration'],
                'active' => (bool) $proc['active'],
                'created_at' => $proc['created_at'],
                'updated_at' => $proc['updated_at'],
            ];
        }, $procedures);
        
        Response::success($procedures);
    } catch (Exception $e) {
        error_log("List procedures error: " . $e->getMessage());
        Response::serverError('Erro ao listar procedimentos');
    }
}

// POST - Create procedure
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $name = trim($data['name'] ?? '');
    $price = floatval($data['price'] ?? 0);
    $duration = (int)($data['duration'] ?? 30);
    
    if (empty($name)) {
        Response::badRequest('Nome do procedimento é obrigatório');
    }
    
    if ($price < 0) {
        Response::badRequest('Preço não pode ser negativo');
    }
    
    if ($duration < 5) {
        Response::badRequest('Duração mínima é de 5 minutos');
    }
    
    try {
        // Check for duplicate name within same clinic
        $stmt = $db->prepare("SELECT id FROM procedimentos WHERE name = :name AND clinica_id = :clinica_id AND active = 1 LIMIT 1");
        $stmt->execute([':name' => $name, ':clinica_id' => $clinicaId]);
        if ($stmt->fetch()) {
            Response::badRequest('Já existe um procedimento com este nome');
        }
        
        $stmt = $db->prepare("
            INSERT INTO procedimentos (name, price, duration, clinica_id) 
            VALUES (:name, :price, :duration, :clinica_id)
        ");
        $stmt->execute([
            ':name' => $name,
            ':price' => $price,
            ':duration' => $duration,
            ':clinica_id' => $clinicaId,
        ]);
        
        $id = $db->lastInsertId();
        
        Response::success([
            'id' => (int) $id,
            'name' => $name,
            'price' => $price,
            'duration' => $duration,
            'active' => true,
        ], 'Procedimento criado com sucesso');
    } catch (Exception $e) {
        error_log("Create procedure error: " . $e->getMessage());
        Response::serverError('Erro ao criar procedimento');
    }
}

Response::methodNotAllowed();