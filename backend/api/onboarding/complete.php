<?php
/**
 * StackClinic API - Complete Onboarding
 * POST /api/onboarding/complete
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

$authUser = Auth::requireAuth();
$userId = $authUser['user_id'];

$data = json_decode(file_get_contents('php://input'), true);

// Validar campos obrigatórios
$clinicName = trim($data['clinic_name'] ?? $data['name'] ?? '');
$email = trim($data['email'] ?? '');
$phone = trim($data['phone'] ?? '');
$address = trim($data['address'] ?? '');
$cnpj = trim($data['cnpj'] ?? '');
$category = trim($data['category'] ?? 'outro');

if (empty($clinicName)) {
    Response::badRequest('Nome da clínica é obrigatório');
}

if (empty($email)) {
    Response::badRequest('Email comercial é obrigatório');
}

if (empty($phone)) {
    Response::badRequest('Telefone é obrigatório');
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
    
    // Atualizar clínica
    $stmtUpdate = $db->prepare("
        UPDATE clinica 
        SET name = :name, 
            email = :email, 
            phone = :phone, 
            address = :address,
            cnpj = :cnpj,
            category = :category,
            onboarding_completed = TRUE
        WHERE id = :id
    ");
    
    $stmtUpdate->execute([
        ':name' => $clinicName,
        ':email' => $email,
        ':phone' => $phone,
        ':address' => $address,
        ':cnpj' => $cnpj,
        ':category' => $category,
        ':id' => $clinicId
    ]);
    
    Response::success([
        'completed' => true,
        'clinic_id' => $clinicId,
        'clinic_name' => $clinicName
    ], 'Configuração da clínica concluída!');

} catch (Exception $e) {
    error_log("Onboarding error: " . $e->getMessage());
    Response::serverError('Erro ao salvar configurações');
}
