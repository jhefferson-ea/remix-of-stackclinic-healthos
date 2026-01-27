<?php
/**
 * StackClinic API - Partners Referral Code & Stats
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
$uri = $_SERVER['REQUEST_URI'];

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

try {
    if (strpos($uri, 'referral-code') !== false) {
        $stmt = $db->prepare("SELECT referral_code as code FROM parceiros WHERE clinica_id = :clinica_id");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $result = $stmt->fetch();
        
        if (!$result) {
            // Criar código de referral para esta clínica
            $code = 'STACK' . strtoupper(substr(md5($clinicaId . time()), 0, 6));
            $stmt = $db->prepare("INSERT INTO parceiros (clinica_id, referral_code, current_referrals, target_referrals, total_savings) VALUES (:clinica_id, :code, 0, 5, 0)");
            $stmt->execute([':clinica_id' => $clinicaId, ':code' => $code]);
            $result = ['code' => $code];
        }
        
        Response::success($result);
    } else {
        $stmt = $db->prepare("SELECT current_referrals as total_referrals, current_referrals as active_referrals, total_commission FROM parceiros WHERE clinica_id = :clinica_id");
        $stmt->execute([':clinica_id' => $clinicaId]);
        Response::success($stmt->fetch() ?: ['total_referrals' => 0, 'active_referrals' => 0, 'total_commission' => 0]);
    }
} catch (Exception $e) {
    Response::serverError('Erro');
}