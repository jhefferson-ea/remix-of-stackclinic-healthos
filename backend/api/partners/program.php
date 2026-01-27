<?php
/**
 * StackClinic API - Partners Program
 * GET /api/partners/program
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
    $stmt = $db->prepare("SELECT current_referrals, target_referrals, total_savings FROM parceiros WHERE clinica_id = :clinica_id");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $partner = $stmt->fetch();
    
    if (!$partner) {
        // Criar registro de parceiro para esta clínica
        $stmt = $db->prepare("INSERT INTO parceiros (clinica_id, current_referrals, target_referrals, total_savings, referral_code) VALUES (:clinica_id, 0, 5, 0, :code)");
        $code = 'STACK' . strtoupper(substr(md5($clinicaId . time()), 0, 6));
        $stmt->execute([':clinica_id' => $clinicaId, ':code' => $code]);
        
        $partner = [
            'current_referrals' => 0,
            'target_referrals' => 5,
            'total_savings' => 0
        ];
    }
    
    $partner['next_milestone'] = 'Isenção de mensalidade';
    Response::success($partner);
} catch (Exception $e) {
    Response::serverError('Erro ao buscar programa');
}