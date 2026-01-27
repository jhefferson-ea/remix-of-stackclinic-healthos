<?php
/**
 * StackClinic API - Admin Dashboard
 * GET /api/admin/dashboard
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
SaasAdmin::requireSaasAdmin($userId, 'viewer');

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Total de clínicas
    $stmtClinics = $db->query("SELECT COUNT(*) as total FROM clinica");
    $totalClinics = $stmtClinics->fetch()['total'];
    
    // Clínicas com onboarding completo
    $stmtOnboarded = $db->query("SELECT COUNT(*) as total FROM clinica WHERE onboarding_completed = TRUE");
    $onboardedClinics = $stmtOnboarded->fetch()['total'];
    
    // Total de usuários
    $stmtUsers = $db->query("SELECT COUNT(*) as total FROM usuarios");
    $totalUsers = $stmtUsers->fetch()['total'];
    
    // Usuários ativos (com assinatura ativa)
    $stmtActiveUsers = $db->query("SELECT COUNT(*) as total FROM usuarios WHERE subscription_status = 'active'");
    $activeUsers = $stmtActiveUsers->fetch()['total'];
    
    // Assinaturas por status
    $stmtSubs = $db->query("
        SELECT status, COUNT(*) as total 
        FROM assinaturas 
        GROUP BY status
    ");
    $subscriptionsByStatus = [];
    while ($row = $stmtSubs->fetch()) {
        $subscriptionsByStatus[$row['status']] = (int)$row['total'];
    }
    
    // Assinaturas ativas por plano
    $stmtPlans = $db->query("
        SELECT plan, COUNT(*) as total 
        FROM assinaturas 
        WHERE status IN ('active', 'trial')
        GROUP BY plan
    ");
    $subscriptionsByPlan = [];
    while ($row = $stmtPlans->fetch()) {
        $subscriptionsByPlan[$row['plan']] = (int)$row['total'];
    }
    
    // MRR estimado (simulado com preços fixos)
    $planPrices = ['basic' => 149.90, 'professional' => 299.90, 'enterprise' => 599.90];
    $mrr = 0;
    foreach ($subscriptionsByPlan as $plan => $count) {
        $mrr += ($planPrices[$plan] ?? 0) * $count;
    }
    
    // Novos registros últimos 30 dias
    $stmtNew = $db->query("
        SELECT COUNT(*) as total 
        FROM usuarios 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ");
    $newUsersLast30 = $stmtNew->fetch()['total'];
    
    // Clínicas recentes (últimas 5)
    $stmtRecent = $db->query("
        SELECT c.id, c.name, c.onboarding_completed, c.created_at,
               a.status as subscription_status, a.plan
        FROM clinica c
        LEFT JOIN assinaturas a ON c.id = a.clinica_id
        ORDER BY c.created_at DESC
        LIMIT 5
    ");
    $recentClinics = $stmtRecent->fetchAll();
    
    Response::success([
        'total_clinics' => (int)$totalClinics,
        'onboarded_clinics' => (int)$onboardedClinics,
        'total_users' => (int)$totalUsers,
        'active_users' => (int)$activeUsers,
        'new_users_last_30_days' => (int)$newUsersLast30,
        'mrr' => round($mrr, 2),
        'subscriptions_by_status' => $subscriptionsByStatus,
        'subscriptions_by_plan' => $subscriptionsByPlan,
        'recent_clinics' => $recentClinics
    ]);

} catch (Exception $e) {
    error_log("Admin dashboard error: " . $e->getMessage());
    Response::serverError('Erro ao carregar dashboard');
}
