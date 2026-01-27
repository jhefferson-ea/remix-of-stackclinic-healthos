<?php
/**
 * StackClinic API - Anamnese Config
 * GET/POST /api/config/anamnese
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
$method = $_SERVER['REQUEST_METHOD'];

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

try {
    if ($method === 'GET') {
        // Get anamnese config
        $stmt = $db->prepare("SELECT enabled FROM anamnese_config WHERE clinica_id = :clinica_id LIMIT 1");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $config = $stmt->fetch();
        
        // Get questions
        $stmt = $db->prepare("SELECT id, question, type, options, is_alert, sort_order as `order` FROM anamnese_template WHERE clinica_id = :clinica_id ORDER BY sort_order");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $questions = $stmt->fetchAll();
        
        // Parse options JSON
        $questions = array_map(function($q) {
            return [
                'id' => (int)$q['id'],
                'question' => $q['question'],
                'type' => $q['type'],
                'options' => $q['options'] ? json_decode($q['options'], true) : null,
                'is_alert' => (bool)$q['is_alert'],
                'order' => (int)$q['order']
            ];
        }, $questions);
        
        Response::success([
            'enabled' => $config ? (bool)$config['enabled'] : true,
            'questions' => $questions
        ]);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $enabled = isset($data['enabled']) ? ($data['enabled'] ? 1 : 0) : 1;
        $questions = $data['questions'] ?? [];
        
        // Upsert config
        $stmt = $db->prepare("INSERT INTO anamnese_config (clinica_id, enabled) VALUES (:clinica_id, :enabled) 
            ON DUPLICATE KEY UPDATE enabled = :enabled2");
        $stmt->execute([':clinica_id' => $clinicaId, ':enabled' => $enabled, ':enabled2' => $enabled]);
        
        // Delete existing questions for this clinic
        $stmt = $db->prepare("DELETE FROM anamnese_template WHERE clinica_id = :clinica_id");
        $stmt->execute([':clinica_id' => $clinicaId]);
        
        // Insert new questions
        foreach ($questions as $index => $q) {
            $stmt = $db->prepare("INSERT INTO anamnese_template (clinica_id, question, type, options, is_alert, sort_order) VALUES (:clinica_id, :question, :type, :options, :is_alert, :sort_order)");
            $stmt->execute([
                ':clinica_id' => $clinicaId,
                ':question' => $q['question'],
                ':type' => $q['type'],
                ':options' => isset($q['options']) ? json_encode($q['options']) : null,
                ':is_alert' => $q['is_alert'] ? 1 : 0,
                ':sort_order' => $index + 1
            ]);
        }
        
        Response::success(['saved' => true], 'Anamnese salva com sucesso');
    }
} catch (Exception $e) {
    error_log("Anamnese API error: " . $e->getMessage());
    Response::serverError('Erro ao processar requisição');
}