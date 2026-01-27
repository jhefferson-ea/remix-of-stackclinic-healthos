<?php
/**
 * StackClinic API - Update Team Member
 * PUT /api/team/update
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$authUser = Auth::requireAuth();

if ($authUser['role'] !== 'admin') {
    Response::forbidden('Acesso negado');
}

// Obter clinica_id do usuário autenticado
$clinicaId = $authUser['clinica_id'];

if (!$clinicaId) {
    Response::unauthorized('Usuário não vinculado a uma clínica');
}

if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

$data = json_decode(file_get_contents('php://input'), true);

$userId = (int)($data['id'] ?? 0);
$action = $data['action'] ?? '';

if (!$userId) {
    Response::badRequest('ID do usuário é obrigatório');
}

$database = new Database();
$db = $database->getConnection();

try {
    // Verificar se o usuário pertence à mesma clínica
    $stmt = $db->prepare("SELECT id FROM usuarios WHERE id = :id AND clinica_id = :clinica_id LIMIT 1");
    $stmt->execute([':id' => $userId, ':clinica_id' => $clinicaId]);
    if (!$stmt->fetch()) {
        Response::notFound('Usuário não encontrado');
    }

    switch ($action) {
        case 'update_role':
            $role = $data['role'] ?? '';
            $roleMap = [
                'owner' => 'admin',
                'doctor' => 'doctor',
                'secretary' => 'assistant'
            ];
            $backendRole = $roleMap[$role] ?? 'doctor';
            
            $stmt = $db->prepare("UPDATE usuarios SET role = :role WHERE id = :id AND clinica_id = :clinica_id");
            $stmt->execute([':role' => $backendRole, ':id' => $userId, ':clinica_id' => $clinicaId]);
            Response::success(['updated' => true], 'Cargo atualizado');
            break;
            
        case 'toggle_active':
            $active = (bool)($data['active'] ?? true);
            $stmt = $db->prepare("UPDATE usuarios SET active = :active WHERE id = :id AND clinica_id = :clinica_id");
            $stmt->execute([':active' => $active ? 1 : 0, ':id' => $userId, ':clinica_id' => $clinicaId]);
            Response::success(['updated' => true], $active ? 'Usuário ativado' : 'Usuário desativado');
            break;
            
        case 'reset_password':
            $tempPassword = bin2hex(random_bytes(4));
            $hashedPassword = password_hash($tempPassword, PASSWORD_DEFAULT);
            
            $stmt = $db->prepare("UPDATE usuarios SET password = :password WHERE id = :id AND clinica_id = :clinica_id");
            $stmt->execute([':password' => $hashedPassword, ':id' => $userId, ':clinica_id' => $clinicaId]);
            
            Response::success([
                'updated' => true,
                'temp_password' => $tempPassword
            ], 'Senha resetada');
            break;
            
        default:
            Response::badRequest('Ação inválida');
    }
} catch (Exception $e) {
    error_log("Team update error: " . $e->getMessage());
    Response::serverError('Erro ao atualizar usuário');
}