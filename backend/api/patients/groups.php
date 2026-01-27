<?php
/**
 * StackClinic API - Patient Groups Management
 * GET /api/patients/groups - List all groups
 * POST /api/patients/groups - Create new group
 * PUT /api/patients/groups - Update group
 * DELETE /api/patients/groups?id=X - Delete group
 * 
 * POST /api/patients/groups/members - Add/remove members
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$authUser = Auth::requireAuth();
$clinicaId = Tenant::getClinicId($authUser);

if (!$clinicaId) {
    Response::unauthorized('Usuário não vinculado a uma clínica');
}

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];

try {
    // Check if this is a members operation
    $isMembersOperation = strpos($uri, '/members') !== false;
    
    if ($method === 'GET') {
        // Check if requesting specific group with members
        $groupId = $_GET['id'] ?? null;
        
        if ($groupId) {
            // Get single group with members
            $stmt = $db->prepare("
                SELECT g.*, 
                       (SELECT COUNT(*) FROM grupos_pacientes_membros m WHERE m.grupo_id = g.id) as member_count
                FROM grupos_pacientes g
                WHERE g.id = :id AND g.clinica_id = :clinica_id
            ");
            $stmt->execute([':id' => $groupId, ':clinica_id' => $clinicaId]);
            $group = $stmt->fetch();
            
            if (!$group) {
                Response::notFound('Grupo não encontrado');
            }
            
            // Get members
            $stmt = $db->prepare("
                SELECT p.id, p.name, p.phone, p.email
                FROM pacientes p
                JOIN grupos_pacientes_membros m ON p.id = m.paciente_id
                WHERE m.grupo_id = :grupo_id
                ORDER BY p.name
            ");
            $stmt->execute([':grupo_id' => $groupId]);
            $members = $stmt->fetchAll();
            
            $group['members'] = $members;
            Response::success($group);
        } else {
            // List all groups with member count
            $stmt = $db->prepare("
                SELECT g.id, g.name, g.description, g.created_at,
                       (SELECT COUNT(*) FROM grupos_pacientes_membros m WHERE m.grupo_id = g.id) as member_count
                FROM grupos_pacientes g
                WHERE g.clinica_id = :clinica_id
                ORDER BY g.name
            ");
            $stmt->execute([':clinica_id' => $clinicaId]);
            $groups = $stmt->fetchAll();
            
            Response::success($groups);
        }
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if ($isMembersOperation) {
            // Add members to group
            $groupId = $data['group_id'] ?? null;
            $patientIds = $data['patient_ids'] ?? [];
            
            if (!$groupId || empty($patientIds)) {
                Response::badRequest('group_id e patient_ids são obrigatórios');
            }
            
            // Verify group belongs to clinic
            $stmt = $db->prepare("SELECT id FROM grupos_pacientes WHERE id = :id AND clinica_id = :clinica_id");
            $stmt->execute([':id' => $groupId, ':clinica_id' => $clinicaId]);
            if (!$stmt->fetch()) {
                Response::forbidden('Grupo não pertence à clínica');
            }
            
            // Add members (ignore duplicates)
            $added = 0;
            foreach ($patientIds as $patientId) {
                try {
                    $stmt = $db->prepare("
                        INSERT IGNORE INTO grupos_pacientes_membros (grupo_id, paciente_id) 
                        VALUES (:grupo_id, :paciente_id)
                    ");
                    $stmt->execute([':grupo_id' => $groupId, ':paciente_id' => $patientId]);
                    $added += $stmt->rowCount();
                } catch (Exception $e) {
                    // Skip invalid patient IDs
                }
            }
            
            Response::success(['added' => $added], "$added membros adicionados");
            
        } else {
            // Create new group
            $name = trim($data['name'] ?? '');
            $description = trim($data['description'] ?? '');
            
            if (empty($name)) {
                Response::badRequest('Nome do grupo é obrigatório');
            }
            
            $stmt = $db->prepare("
                INSERT INTO grupos_pacientes (clinica_id, name, description)
                VALUES (:clinica_id, :name, :description)
            ");
            $stmt->execute([
                ':clinica_id' => $clinicaId,
                ':name' => $name,
                ':description' => $description
            ]);
            
            $groupId = $db->lastInsertId();
            
            Response::success([
                'id' => (int)$groupId,
                'name' => $name,
                'description' => $description,
                'member_count' => 0
            ], 'Grupo criado com sucesso');
        }
        
    } elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        $groupId = $data['id'] ?? null;
        
        if (!$groupId) {
            Response::badRequest('ID do grupo é obrigatório');
        }
        
        // Verify ownership
        $stmt = $db->prepare("SELECT id FROM grupos_pacientes WHERE id = :id AND clinica_id = :clinica_id");
        $stmt->execute([':id' => $groupId, ':clinica_id' => $clinicaId]);
        if (!$stmt->fetch()) {
            Response::forbidden('Grupo não pertence à clínica');
        }
        
        $name = trim($data['name'] ?? '');
        $description = trim($data['description'] ?? '');
        
        if (empty($name)) {
            Response::badRequest('Nome do grupo é obrigatório');
        }
        
        $stmt = $db->prepare("
            UPDATE grupos_pacientes 
            SET name = :name, description = :description
            WHERE id = :id AND clinica_id = :clinica_id
        ");
        $stmt->execute([
            ':id' => $groupId,
            ':name' => $name,
            ':description' => $description,
            ':clinica_id' => $clinicaId
        ]);
        
        Response::success(['id' => (int)$groupId, 'name' => $name, 'description' => $description], 'Grupo atualizado');
        
    } elseif ($method === 'DELETE') {
        if ($isMembersOperation) {
            // Remove members from group
            $data = json_decode(file_get_contents('php://input'), true);
            $groupId = $data['group_id'] ?? null;
            $patientIds = $data['patient_ids'] ?? [];
            
            if (!$groupId || empty($patientIds)) {
                Response::badRequest('group_id e patient_ids são obrigatórios');
            }
            
            // Verify group belongs to clinic
            $stmt = $db->prepare("SELECT id FROM grupos_pacientes WHERE id = :id AND clinica_id = :clinica_id");
            $stmt->execute([':id' => $groupId, ':clinica_id' => $clinicaId]);
            if (!$stmt->fetch()) {
                Response::forbidden('Grupo não pertence à clínica');
            }
            
            $placeholders = implode(',', array_fill(0, count($patientIds), '?'));
            $stmt = $db->prepare("
                DELETE FROM grupos_pacientes_membros 
                WHERE grupo_id = ? AND paciente_id IN ($placeholders)
            ");
            $stmt->execute(array_merge([$groupId], $patientIds));
            
            Response::success(['removed' => $stmt->rowCount()], 'Membros removidos');
            
        } else {
            // Delete group
            $groupId = $_GET['id'] ?? null;
            
            if (!$groupId) {
                Response::badRequest('ID do grupo é obrigatório');
            }
            
            // Verify ownership
            $stmt = $db->prepare("SELECT id FROM grupos_pacientes WHERE id = :id AND clinica_id = :clinica_id");
            $stmt->execute([':id' => $groupId, ':clinica_id' => $clinicaId]);
            if (!$stmt->fetch()) {
                Response::forbidden('Grupo não pertence à clínica');
            }
            
            // Delete (cascade will remove members)
            $stmt = $db->prepare("DELETE FROM grupos_pacientes WHERE id = :id AND clinica_id = :clinica_id");
            $stmt->execute([':id' => $groupId, ':clinica_id' => $clinicaId]);
            
            Response::success(['deleted' => true], 'Grupo excluído');
        }
    } else {
        Response::methodNotAllowed('Método não permitido');
    }
    
} catch (PDOException $e) {
    if ($e->getCode() == 23000) {
        Response::badRequest('Já existe um grupo com este nome');
    }
    error_log("Patient Groups API error: " . $e->getMessage());
    Response::serverError('Erro ao processar requisição');
} catch (Exception $e) {
    error_log("Patient Groups API error: " . $e->getMessage());
    Response::serverError('Erro ao processar requisição');
}
