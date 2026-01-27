<?php
/**
 * StackClinic API - Takeover Chat
 * POST /api/ai/live-chats/{id}/takeover
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

$database = new Database();
$db = $database->getConnection();

// Get ID from URL
$uri = $_SERVER['REQUEST_URI'];
preg_match('/\/live-chats\/([^\/]+)\/takeover/', $uri, $matches);
$chatId = $matches[1] ?? null;

if (!$chatId) {
    Response::error('ID do chat não informado');
}

try {
    $stmt = $db->prepare("
        UPDATE live_chats SET status = 'human' WHERE id = :id
    ");
    $stmt->execute([':id' => $chatId]);
    
    // TODO: Integrar com Evolution API para pausar bot
    
    Response::success(['success' => true], 'Chat assumido com sucesso');

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao assumir chat');
}
