<?php
/**
 * StackClinic API - Subscribe (Simulated)
 * POST /api/subscription/subscribe
 * 
 * Por enquanto, apenas simula a ativação sem gateway de pagamento
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Subscription.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

$authUser = Auth::requireAuth();
$userId = $authUser['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
$plan = $data['plan'] ?? 'professional';

// Validar plano
$validPlans = ['basic', 'professional', 'enterprise'];
if (!in_array($plan, $validPlans)) {
    Response::badRequest('Plano inválido');
}

try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Buscar clínica do usuário
    $stmt = $db->prepare("SELECT clinica_id FROM usuarios WHERE id = :user_id");
    $stmt->execute([':user_id' => $userId]);
    $user = $stmt->fetch();
    
    if (!$user || !$user['clinica_id']) {
        Response::badRequest('Usuário não possui clínica vinculada');
    }
    
    $clinicId = $user['clinica_id'];
    
    // Simular aprovação de pagamento e ativar assinatura
    $activated = Subscription::activate($clinicId, $plan);
    
    if (!$activated) {
        Response::serverError('Erro ao ativar assinatura');
    }
    
    // Buscar dados atualizados
    $subscription = Subscription::getStatus($clinicId);
    
    Response::success([
        'activated' => true,
        'plan' => $plan,
        'status' => 'active',
        'current_period_end' => $subscription['current_period_end'],
        'message' => 'Assinatura ativada com sucesso! (Simulado - sem cobrança real)'
    ], 'Assinatura ativada com sucesso!');

} catch (Exception $e) {
    error_log("Subscribe error: " . $e->getMessage());
    Response::serverError('Erro ao processar assinatura');
}
