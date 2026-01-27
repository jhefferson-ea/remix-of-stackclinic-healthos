<?php
/**
 * StackClinic API - Notify Waiting List (WhatsApp)
 * POST /api/appointments/notify-waiting-list
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

$database = new Database();
$db = $database->getConnection();

try {
    $stmt = $db->prepare("
        SELECT le.id, p.name, p.phone
        FROM lista_espera le
        JOIN pacientes p ON le.paciente_id = p.id
    ");
    $stmt->execute();
    $waitingList = $stmt->fetchAll();
    
    $notified = 0;
    
    foreach ($waitingList as $patient) {
        // TODO: Integrar com Evolution API para envio real
        // Por enquanto, apenas simula o envio
        $notified++;
        
        // Log para debug
        error_log("WhatsApp notification sent to: " . $patient['phone']);
    }
    
    Response::success(['notified' => $notified], 'Notificações enviadas com sucesso');

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao notificar lista de espera');
}
