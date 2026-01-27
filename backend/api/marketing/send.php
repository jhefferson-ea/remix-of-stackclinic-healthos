<?php
/**
 * StackClinic API - Send Marketing Campaign
 * POST /api/marketing/send
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$database = new Database();
$db = $database->getConnection();

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['patient_ids']) || empty($data['patient_ids'])) {
    Response::error('Nenhum paciente selecionado');
}

if (!isset($data['message']) || empty($data['message'])) {
    Response::error('Mensagem não fornecida');
}

try {
    $patientIds = $data['patient_ids'];
    $message = $data['message'];
    
    // Buscar pacientes (somente da clínica do usuário)
    $ids = implode(',', array_map('intval', $patientIds));
    $stmt = $db->prepare("SELECT id, name, phone FROM pacientes WHERE id IN ({$ids}) AND clinica_id = :clinica_id");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $patients = $stmt->fetchAll();
    
    $sent = 0;
    foreach ($patients as $patient) {
        // TODO: Integrar com Evolution API para envio real via WhatsApp
        // Personalizar mensagem
        $personalizedMsg = str_replace('[Nome]', $patient['name'], $message);
        
        // Log para debug
        error_log("WhatsApp campaign sent to: " . $patient['phone'] . " - " . $personalizedMsg);
        
        $sent++;
    }
    
    // Registrar campanha
    $stmt = $db->prepare("
        INSERT INTO campanhas_marketing (title, message, sent_count, clinica_id)
        VALUES (:title, :message, :sent_count, :clinica_id)
    ");
    $stmt->execute([
        ':title' => 'Campanha de Retorno - ' . date('d/m/Y H:i'),
        ':message' => $message,
        ':sent_count' => $sent,
        ':clinica_id' => $clinicaId
    ]);
    
    Response::success(['sent' => $sent], 'Campanha enviada com sucesso');

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao enviar campanha');
}