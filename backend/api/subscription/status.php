<?php
/**
 * StackClinic API - Subscription Status
 * GET /api/subscription/status
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::methodNotAllowed();
}

$authUser = Auth::requireAuth();
$userId = $authUser['user_id'];

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Buscar usuário com dados da clínica
    $stmt = $db->prepare("
        SELECT u.clinica_id, u.subscription_status, c.name as clinic_name, c.onboarding_completed
        FROM usuarios u
        LEFT JOIN clinica c ON u.clinica_id = c.id
        WHERE u.id = :user_id
    ");
    $stmt->execute([':user_id' => $userId]);
    $user = $stmt->fetch();
    
    if (!$user || !$user['clinica_id']) {
        Response::success([
            'has_subscription' => false,
            'status' => 'pending',
            'plan' => null,
            'onboarding_completed' => false
        ]);
    }
    
    // Buscar assinatura
    $stmtSub = $db->prepare("
        SELECT * FROM assinaturas 
        WHERE clinica_id = :clinica_id 
        ORDER BY created_at DESC LIMIT 1
    ");
    $stmtSub->execute([':clinica_id' => $user['clinica_id']]);
    $subscription = $stmtSub->fetch();
    
    $isActive = $subscription && in_array($subscription['status'], ['active', 'trial']);
    
    Response::success([
        'has_subscription' => $isActive,
        'status' => $subscription ? $subscription['status'] : 'pending',
        'plan' => $subscription ? $subscription['plan'] : null,
        'trial_ends_at' => $subscription ? $subscription['trial_ends_at'] : null,
        'current_period_end' => $subscription ? $subscription['current_period_end'] : null,
        'onboarding_completed' => (bool)$user['onboarding_completed'],
        'clinic_name' => $user['clinic_name']
    ]);

} catch (Exception $e) {
    error_log("Subscription status error: " . $e->getMessage());
    Response::serverError('Erro ao verificar status da assinatura');
}
