<?php
/**
 * StackClinic API - Admin Users Management
 * GET /api/admin/users - Listar todos os usuários
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/SaasAdmin.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::methodNotAllowed();
}

$authUser = Auth::requireAuth();
$userId = $authUser['user_id'];

// Verificar se é admin do SaaS
SaasAdmin::requireSaasAdmin($userId, 'support');

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Parâmetros de busca
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $status = isset($_GET['status']) ? $_GET['status'] : '';
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;
    
    // Query base
    $where = "WHERE 1=1";
    $params = [];
    
    if (!empty($search)) {
        $where .= " AND (u.name LIKE :search OR u.email LIKE :search)";
        $params[':search'] = "%{$search}%";
    }
    
    if (!empty($status) && in_array($status, ['pending', 'active', 'suspended'])) {
        $where .= " AND u.subscription_status = :status";
        $params[':status'] = $status;
    }
    
    // Contar total
    $stmtCount = $db->prepare("SELECT COUNT(*) as total FROM usuarios u {$where}");
    $stmtCount->execute($params);
    $total = $stmtCount->fetch()['total'];
    
    // Buscar usuários
    $stmt = $db->prepare("
        SELECT u.id, u.name, u.email, u.role, u.phone, u.active, u.subscription_status,
               u.clinica_id, u.created_at,
               c.name as clinic_name,
               sa.saas_role
        FROM usuarios u
        LEFT JOIN clinica c ON u.clinica_id = c.id
        LEFT JOIN saas_admins sa ON u.id = sa.user_id
        {$where}
        ORDER BY u.created_at DESC
        LIMIT {$limit} OFFSET {$offset}
    ");
    $stmt->execute($params);
    $users = $stmt->fetchAll();
    
    // Mapear dados
    $mappedUsers = array_map(function($user) {
        return [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'phone' => $user['phone'],
            'active' => (bool)$user['active'],
            'subscription_status' => $user['subscription_status'],
            'clinic_id' => $user['clinica_id'] ? (int)$user['clinica_id'] : null,
            'clinic_name' => $user['clinic_name'],
            'is_saas_admin' => !empty($user['saas_role']),
            'saas_role' => $user['saas_role'],
            'created_at' => $user['created_at']
        ];
    }, $users);
    
    Response::success([
        'users' => $mappedUsers,
        'pagination' => [
            'total' => (int)$total,
            'page' => $page,
            'limit' => $limit,
            'pages' => ceil($total / $limit)
        ]
    ]);

} catch (Exception $e) {
    error_log("Admin users error: " . $e->getMessage());
    Response::serverError('Erro ao listar usuários');
}
