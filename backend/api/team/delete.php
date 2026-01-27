<?php
/**
 * StackClinic API - Delete Team Member
 * DELETE /api/team/delete
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

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

$data = json_decode(file_get_contents('php://input'), true);

$userId = (int)($data['id'] ?? 0);

if (!$userId) {
    Response::badRequest('ID do usuário é obrigatório');
}

// Não pode excluir a si mesmo
if ($userId === (int)$authUser['user_id']) {
    Response::badRequest('Você não pode remover a si mesmo');
}

$database = new Database();
$db = $database->getConnection();

try {
    // Verificar se o usuário pertence à mesma clínica
    $stmt = $db->prepare("SELECT id, role FROM usuarios WHERE id = :id AND clinica_id = :clinica_id LIMIT 1");
    $stmt->execute([':id' => $userId, ':clinica_id' => $clinicaId]);
    $targetUser = $stmt->fetch();
    
    if (!$targetUser) {
        Response::notFound('Usuário não encontrado');
    }
    
    // Não pode excluir o owner/admin
    if ($targetUser['role'] === 'admin') {
        Response::forbidden('Não é possível remover o proprietário da clínica');
    }
    
    // Deletar usuário
    $stmt = $db->prepare("DELETE FROM usuarios WHERE id = :id AND clinica_id = :clinica_id");
    $stmt->execute([':id' => $userId, ':clinica_id' => $clinicaId]);
    
    Response::success(['deleted' => true], 'Membro removido com sucesso');

} catch (Exception $e) {
    error_log("Team delete error: " . $e->getMessage());
    Response::serverError('Erro ao remover usuário');
}
