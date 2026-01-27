<?php
/**
 * StackClinic API - Admin Subscriptions Management
 * GET /api/admin/subscriptions - Listar todas as assinaturas
 * PUT /api/admin/subscriptions - Atualizar status de assinatura manualmente
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/SaasAdmin.php';
require_once __DIR__ . '/../helpers/Subscription.php';

$authUser = Auth::requireAuth();
$userId = $authUser['user_id'];

// Verificar se é admin do SaaS
SaasAdmin::requireSaasAdmin($userId, 'support');

$database = new Database();
$db = $database->getConnection();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $status = isset($_GET['status']) ? $_GET['status'] : '';
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;
        
        $where = "WHERE 1=1";
        $params = [];
        
        if (!empty($status) && in_array($status, ['trial', 'active', 'suspended', 'cancelled'])) {
            $where .= " AND a.status = :status";
            $params[':status'] = $status;
        }
        
        $stmtCount = $db->prepare("SELECT COUNT(*) as total FROM assinaturas a {$where}");
        $stmtCount->execute($params);
        $total = $stmtCount->fetch()['total'];
        
        $stmt = $db->prepare("
            SELECT a.*, 
                   c.name as clinic_name,
                   c.email as clinic_email,
                   u.name as owner_name,
                   u.email as owner_email
            FROM assinaturas a
            JOIN clinica c ON a.clinica_id = c.id
            LEFT JOIN usuarios u ON c.owner_user_id = u.id
            {$where}
            ORDER BY a.created_at DESC
            LIMIT {$limit} OFFSET {$offset}
        ");
        $stmt->execute($params);
        $subscriptions = $stmt->fetchAll();
        
        Response::success([
            'subscriptions' => $subscriptions,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ]);
        
    } catch (Exception $e) {
        error_log("Admin subscriptions error: " . $e->getMessage());
        Response::serverError('Erro ao listar assinaturas');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'POST') {
    // Apenas admins podem editar
    SaasAdmin::requireSaasAdmin($userId, 'admin');
    
    $data = json_decode(file_get_contents('php://input'), true);
    $clinicId = (int)($data['clinic_id'] ?? 0);
    $action = $data['action'] ?? '';
    
    if (!$clinicId) {
        Response::badRequest('ID da clínica é obrigatório');
    }
    
    try {
        switch ($action) {
            case 'activate':
                $plan = $data['plan'] ?? 'professional';
                Subscription::activate($clinicId, $plan);
                Response::success(['activated' => true], 'Assinatura ativada');
                break;
                
            case 'suspend':
                Subscription::suspend($clinicId);
                Response::success(['suspended' => true], 'Assinatura suspensa');
                break;
                
            case 'cancel':
                $stmt = $db->prepare("UPDATE assinaturas SET status = 'cancelled' WHERE clinica_id = :id");
                $stmt->execute([':id' => $clinicId]);
                $stmt2 = $db->prepare("UPDATE usuarios SET subscription_status = 'suspended' WHERE clinica_id = :id");
                $stmt2->execute([':id' => $clinicId]);
                Response::success(['cancelled' => true], 'Assinatura cancelada');
                break;
                
            case 'change_plan':
                $newPlan = $data['plan'] ?? 'professional';
                if (!in_array($newPlan, ['basic', 'professional', 'enterprise'])) {
                    Response::badRequest('Plano inválido');
                }
                $stmt = $db->prepare("UPDATE assinaturas SET plan = :plan WHERE clinica_id = :id");
                $stmt->execute([':plan' => $newPlan, ':id' => $clinicId]);
                Response::success(['updated' => true], 'Plano alterado');
                break;
                
            default:
                Response::badRequest('Ação inválida');
        }
    } catch (Exception $e) {
        error_log("Admin subscription action error: " . $e->getMessage());
        Response::serverError('Erro ao processar ação');
    }
}

Response::methodNotAllowed();
