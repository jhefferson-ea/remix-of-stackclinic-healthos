<?php
/**
 * StackClinic API - Humor Chart (Reviews)
 * GET /api/dashboard/humor
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
    // Média de reviews internos
    $stmt = $db->prepare("
        SELECT AVG(rating) as avg_rating, COUNT(*) as total 
        FROM avaliacoes 
        WHERE clinica_id = :clinica_id AND source = 'internal'
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $internal = $stmt->fetch();

    // Média de reviews Google
    $stmt = $db->prepare("
        SELECT AVG(rating) as avg_rating, COUNT(*) as total 
        FROM avaliacoes 
        WHERE clinica_id = :clinica_id AND source = 'google'
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $google = $stmt->fetch();

    $internalRating = $internal['avg_rating'] ? round($internal['avg_rating'], 1) : 0;
    $googleRating = $google['avg_rating'] ? round($google['avg_rating'], 1) : 0;
    $totalReviews = $internal['total'] + $google['total'];
    
    // Média geral
    $average = ($internalRating + $googleRating) / 2;
    if ($internalRating == 0) $average = $googleRating;
    if ($googleRating == 0) $average = $internalRating;

    Response::success([
        'google_reviews' => (float) $googleRating,
        'internal_rating' => (float) $internalRating,
        'average' => round($average, 1),
        'total_reviews' => (int) $totalReviews
    ]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar dados de humor');
}