<?php
/**
 * StackClinic API - Login
 * POST /api/auth/login
 * 
 * Retorna dados do usuário incluindo status de assinatura e info de SaaS admin
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/SaasAdmin.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

$data = json_decode(file_get_contents('php://input'), true);

$email = trim($data['email'] ?? '');
$password = $data['password'] ?? '';

if (empty($email) || empty($password)) {
    Response::badRequest('Email e senha são obrigatórios');
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $stmt = $db->prepare("
        SELECT u.id, u.name, u.email, u.password, u.role, u.avatar, u.phone, u.active, 
               u.clinica_id, u.subscription_status,
               c.name as clinic_name, c.onboarding_completed
        FROM usuarios u
        LEFT JOIN clinica c ON u.clinica_id = c.id
        WHERE u.email = :email LIMIT 1
    ");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        Response::unauthorized('Credenciais inválidas');
    }

    if (!$user['active']) {
        Response::unauthorized('Conta desativada');
    }

    // Verify password
    if (!password_verify($password, $user['password'])) {
        Response::unauthorized('Credenciais inválidas');
    }

    // Atualizar last_login para rastrear primeiro acesso
    $stmtLogin = $db->prepare("UPDATE usuarios SET last_login = NOW() WHERE id = :id");
    $stmtLogin->execute([':id' => $user['id']]);

    // Generate JWT token with clinica_id for multi-tenancy
    $token = Auth::generateToken($user['id'], $user['email'], $user['role'], $user['clinica_id']);

    // Verificar se é admin do SaaS
    $isSaasAdmin = SaasAdmin::isSaasAdmin($user['id']);
    $saasRole = $isSaasAdmin ? SaasAdmin::getSaasRole($user['id']) : null;

    // Buscar status da assinatura
    $subscriptionStatus = $user['subscription_status'] ?? 'pending';
    $onboardingCompleted = (bool)$user['onboarding_completed'];
    
    // Se tem clínica, verificar assinatura real
    if ($user['clinica_id']) {
        $stmtSub = $db->prepare("SELECT status FROM assinaturas WHERE clinica_id = :clinica_id ORDER BY created_at DESC LIMIT 1");
        $stmtSub->execute([':clinica_id' => $user['clinica_id']]);
        $subscription = $stmtSub->fetch();
        if ($subscription) {
            $subscriptionStatus = in_array($subscription['status'], ['active', 'trial']) ? 'active' : $subscription['status'];
        }
    }

    Response::success([
        'token' => $token,
        'user' => [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'avatar' => $user['avatar'],
            'clinic_id' => $user['clinica_id'] ? (int)$user['clinica_id'] : null,
            'clinic_name' => $user['clinic_name'] ?? 'StackClinic',
            'subscription_status' => $subscriptionStatus,
            'onboarding_completed' => $onboardingCompleted,
            'is_saas_admin' => $isSaasAdmin,
            'saas_role' => $saasRole
        ]
    ]);

} catch (Exception $e) {
    error_log("Login error: " . $e->getMessage());
    Response::serverError('Erro ao processar login');
}
