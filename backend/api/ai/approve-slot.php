<?php
/**
 * StackClinic API - Approve AI Slot
 * POST /api/ai/approve-slot
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

$database = new Database();
$db = $database->getConnection();

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['suggestion_id'])) {
        Response::error('ID da sugestão não informado');
    }
    
    $stmt = $db->prepare("
        UPDATE ia_sugestoes SET status = 'approved' WHERE id = :id
    ");
    $stmt->execute([':id' => $data['suggestion_id']]);
    
    // TODO: Aplicar a ação sugerida (mover agendamento, etc)
    
    Response::success(['success' => true], 'Sugestão aprovada');

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao aprovar sugestão');
}
