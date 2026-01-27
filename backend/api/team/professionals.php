<?php
/**
 * StackClinic API - List Professionals (Doctors)
 * GET /api/team/professionals - List all doctors/professionals for the clinic
 * 
 * Used for dropdowns in Agenda, Financial, etc.
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$clinicaId = Tenant::getClinicId();

$database = new Database();
$db = $database->getConnection();

try {
    // Get all active doctors/professionals for this clinic
    $stmt = $db->prepare("
        SELECT id, name, email, specialty, color, role
        FROM usuarios 
        WHERE clinica_id = :clinica_id 
          AND role IN ('admin', 'doctor') 
          AND active = 1
        ORDER BY name
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $professionals = $stmt->fetchAll();

    // Default colors for professionals without custom color
    $defaultColors = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'amber', 'rose'];
    $colorIndex = 0;

    foreach ($professionals as &$prof) {
        $prof['id'] = (int)$prof['id'];
        
        // Assign default color if none set
        if (empty($prof['color'])) {
            $prof['color'] = $defaultColors[$colorIndex % count($defaultColors)];
            $colorIndex++;
        }
    }

    Response::success($professionals);

} catch (Exception $e) {
    error_log("List professionals error: " . $e->getMessage());
    Response::serverError('Erro ao listar profissionais');
}
