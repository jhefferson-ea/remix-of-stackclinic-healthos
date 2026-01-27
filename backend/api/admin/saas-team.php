<?php
/**
 * StackClinic API - Admin SaaS Team Management
 * GET /api/admin/saas-team - Listar administradores do SaaS
 * POST /api/admin/saas-team - Adicionar admin
 * DELETE /api/admin/saas-team - Remover admin
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/SaasAdmin.php';

$authUser = Auth::requireAuth();
$userId = $authUser['user_id'];

// Apenas super_admin pode gerenciar equipe SaaS
SaasAdmin::requireSaasAdmin($userId, 'super_admin');

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $db->query("
            SELECT sa.id, sa.user_id, sa.saas_role, sa.created_at,
                   u.name, u.email, u.avatar
            FROM saas_admins sa
            JOIN usuarios u ON sa.user_id = u.id
            ORDER BY 
                CASE sa.saas_role 
                    WHEN 'super_admin' THEN 1 
                    WHEN 'admin' THEN 2 
                    WHEN 'support' THEN 3 
                    ELSE 4 
                END,
                sa.created_at
        ");
        $admins = $stmt->fetchAll();
        
        Response::success($admins);
        
    } catch (Exception $e) {
        error_log("SaaS team list error: " . $e->getMessage());
        Response::serverError('Erro ao listar equipe');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $targetUserId = (int)($data['user_id'] ?? 0);
    $role = $data['role'] ?? 'support';
    
    if (!$targetUserId) {
        Response::badRequest('ID do usuário é obrigatório');
    }
    
    $validRoles = ['admin', 'support', 'viewer'];
    if (!in_array($role, $validRoles)) {
        Response::badRequest('Role inválida. Use: admin, support ou viewer');
    }
    
    try {
        // Verificar se usuário existe
        $stmt = $db->prepare("SELECT id, name, email FROM usuarios WHERE id = :id");
        $stmt->execute([':id' => $targetUserId]);
        $user = $stmt->fetch();
        
        if (!$user) {
            Response::notFound('Usuário não encontrado');
        }
        
        // Adicionar como admin
        SaasAdmin::addAdmin($targetUserId, $role);
        
        Response::success([
            'added' => true,
            'user_id' => $targetUserId,
            'role' => $role,
            'name' => $user['name'],
            'email' => $user['email']
        ], 'Administrador adicionado com sucesso');
        
    } catch (Exception $e) {
        error_log("Add SaaS admin error: " . $e->getMessage());
        Response::serverError('Erro ao adicionar administrador');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $targetUserId = (int)($_GET['user_id'] ?? 0);
    
    if (!$targetUserId) {
        Response::badRequest('ID do usuário é obrigatório');
    }
    
    // Não pode remover a si mesmo se for o único super_admin
    if ($targetUserId === (int)$userId) {
        $stmt = $db->query("SELECT COUNT(*) as total FROM saas_admins WHERE saas_role = 'super_admin'");
        if ($stmt->fetch()['total'] <= 1) {
            Response::badRequest('Não é possível remover o único super admin');
        }
    }
    
    try {
        SaasAdmin::removeAdmin($targetUserId);
        Response::success(['removed' => true], 'Administrador removido');
    } catch (Exception $e) {
        error_log("Remove SaaS admin error: " . $e->getMessage());
        Response::serverError('Erro ao remover administrador');
    }
}

Response::methodNotAllowed();
