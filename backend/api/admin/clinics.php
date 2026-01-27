<?php
/**
 * StackClinic API - Admin Clinics Management
 * GET /api/admin/clinics - Listar todas as clínicas
 * PUT /api/admin/clinics - Atualizar clínica
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/SaasAdmin.php';

$authUser = Auth::requireAuth();
$userId = $authUser['user_id'];

// Verificar se é admin do SaaS
SaasAdmin::requireSaasAdmin($userId, 'support');

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        // Parâmetros de busca
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;
        
        $where = "WHERE 1=1";
        $params = [];
        
        if (!empty($search)) {
            $where .= " AND (c.name LIKE :search OR c.email LIKE :search OR c.cnpj LIKE :search)";
            $params[':search'] = "%{$search}%";
        }
        
        // Contar total
        $stmtCount = $db->prepare("SELECT COUNT(*) as total FROM clinica c {$where}");
        $stmtCount->execute($params);
        $total = $stmtCount->fetch()['total'];
        
        // Buscar clínicas
        $stmt = $db->prepare("
            SELECT c.*, 
                   a.status as subscription_status, 
                   a.plan,
                   a.trial_ends_at,
                   a.current_period_end,
                   u.name as owner_name,
                   u.email as owner_email,
                   (SELECT COUNT(*) FROM usuarios WHERE clinica_id = c.id) as user_count
            FROM clinica c
            LEFT JOIN assinaturas a ON c.id = a.clinica_id
            LEFT JOIN usuarios u ON c.owner_user_id = u.id
            {$where}
            ORDER BY c.created_at DESC
            LIMIT {$limit} OFFSET {$offset}
        ");
        $stmt->execute($params);
        $clinics = $stmt->fetchAll();
        
        // Mapear dados
        $mappedClinics = array_map(function($clinic) {
            return [
                'id' => (int)$clinic['id'],
                'name' => $clinic['name'],
                'email' => $clinic['email'],
                'phone' => $clinic['phone'],
                'cnpj' => $clinic['cnpj'],
                'address' => $clinic['address'],
                'logo_url' => $clinic['logo_url'],
                'onboarding_completed' => (bool)$clinic['onboarding_completed'],
                'subscription_status' => $clinic['subscription_status'] ?? 'pending',
                'plan' => $clinic['plan'],
                'trial_ends_at' => $clinic['trial_ends_at'],
                'current_period_end' => $clinic['current_period_end'],
                'owner_name' => $clinic['owner_name'],
                'owner_email' => $clinic['owner_email'],
                'user_count' => (int)$clinic['user_count'],
                'created_at' => $clinic['created_at']
            ];
        }, $clinics);
        
        Response::success([
            'clinics' => $mappedClinics,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ]);
        
    } catch (Exception $e) {
        error_log("Admin clinics error: " . $e->getMessage());
        Response::serverError('Erro ao listar clínicas');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'POST') {
    // Apenas admins podem editar
    SaasAdmin::requireSaasAdmin($userId, 'admin');
    
    $data = json_decode(file_get_contents('php://input'), true);
    $clinicId = (int)($data['id'] ?? 0);
    
    if (!$clinicId) {
        Response::badRequest('ID da clínica é obrigatório');
    }
    
    try {
        // Atualizar apenas campos permitidos
        $allowedFields = ['name', 'email', 'phone', 'cnpj', 'address'];
        $updates = [];
        $params = [':id' => $clinicId];
        
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updates[] = "{$field} = :{$field}";
                $params[":{$field}"] = $data[$field];
            }
        }
        
        if (empty($updates)) {
            Response::badRequest('Nenhum campo para atualizar');
        }
        
        $sql = "UPDATE clinica SET " . implode(', ', $updates) . " WHERE id = :id";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        Response::success(['updated' => true], 'Clínica atualizada com sucesso');
        
    } catch (Exception $e) {
        error_log("Admin update clinic error: " . $e->getMessage());
        Response::serverError('Erro ao atualizar clínica');
    }
}

Response::methodNotAllowed();
