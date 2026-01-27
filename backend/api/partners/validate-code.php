<?php
/**
 * StackClinic API - Validate Referral Code
 * GET /api/partners/validate-code?code=XXXXX
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';

$database = new Database();
$db = $database->getConnection();

$code = trim($_GET['code'] ?? '');

if (empty($code)) {
    Response::success(['valid' => false]);
}

try {
    // Find referral code in parceiros table
    $stmt = $db->prepare("
        SELECT p.clinica_id, c.name as clinic_name, u.name as referrer_name
        FROM parceiros p
        JOIN clinica c ON p.clinica_id = c.id
        LEFT JOIN usuarios u ON c.owner_user_id = u.id
        WHERE p.referral_code = :code
        LIMIT 1
    ");
    $stmt->execute([':code' => strtoupper($code)]);
    $partner = $stmt->fetch();
    
    if ($partner) {
        Response::success([
            'valid' => true,
            'referrer_name' => $partner['referrer_name'] ?? $partner['clinic_name']
        ]);
    } else {
        Response::success(['valid' => false]);
    }
} catch (Exception $e) {
    error_log("Validate referral code error: " . $e->getMessage());
    Response::success(['valid' => false]);
}
