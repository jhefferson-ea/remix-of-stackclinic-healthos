<?php
/**
 * StackClinic API - Marketing Stats
 * GET /api/marketing/stats
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

try {
    // Pacientes inativos (sem consulta há 6 meses)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM pacientes p
        WHERE p.clinica_id = :clinica_id AND NOT EXISTS (
            SELECT 1 FROM agendamentos a 
            WHERE a.paciente_id = p.id 
            AND a.clinica_id = :clinica_id2
            AND a.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        )
    ");
    $stmt->execute([':clinica_id' => $clinicaId, ':clinica_id2' => $clinicaId]);
    $inactive6months = $stmt->fetch()['total'];

    // Reviews pendentes
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM agendamentos a
        WHERE a.clinica_id = :clinica_id AND a.status = 'completed'
        AND a.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND NOT EXISTS (
            SELECT 1 FROM avaliacoes av WHERE av.agendamento_id = a.id
        )
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $pendingReviews = $stmt->fetch()['total'];

    // Campanhas enviadas (últimos 30 dias)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total, SUM(sent_count) as sent, SUM(response_count) as responses
        FROM campanhas_marketing
        WHERE clinica_id = :clinica_id AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $campaigns = $stmt->fetch();
    
    $responseRate = $campaigns['sent'] > 0 
        ? ($campaigns['responses'] / $campaigns['sent']) * 100 
        : 0;

    Response::success([
        'inactive_6months' => (int) $inactive6months,
        'pending_reviews' => (int) $pendingReviews,
        'campaigns_sent' => (int) ($campaigns['total'] ?? 0),
        'response_rate' => round($responseRate, 1)
    ]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar estatísticas de marketing');
}