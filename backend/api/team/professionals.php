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
    // Alguns ambientes antigos usam schema diferente (ex: role/status em vez de active,
    // sem colunas specialty/color, e às vezes sem clinica_id). Para evitar 500,
    // detectamos as colunas disponíveis e montamos a query dinamicamente.
    // IMPORTANTE: Em alguns hosts, INFORMATION_SCHEMA pode falhar por permissão.
    // Usamos SHOW COLUMNS (mais compatível) para evitar erro 500.
    $colsStmt = $db->prepare("SHOW COLUMNS FROM usuarios");
    $colsStmt->execute();
    $cols = array_map(fn($r) => $r['Field'], $colsStmt->fetchAll());
    $has = fn($c) => in_array($c, $cols, true);

    $selectCols = ['id', 'name', 'email'];
    if ($has('role')) $selectCols[] = 'role';
    if ($has('specialty')) $selectCols[] = 'specialty';
    if ($has('color')) $selectCols[] = 'color';
    if ($has('clinica_id')) $selectCols[] = 'clinica_id';

    $where = [];
    $params = [];

    // Multi-tenant: este endpoint deve SEMPRE retornar apenas médicos da clínica logada.
    // Se não existir clinica_id na tabela, é inseguro listar usuários sem filtro.
    if (!$has('clinica_id')) {
        error_log("List professionals: tabela usuarios sem coluna clinica_id (bloqueado por segurança)");
        Response::success([]);
    }
    $where[] = 'clinica_id = :clinica_id';
    $params[':clinica_id'] = $clinicaId;

    // Somente médicos (excluir owner/admin/secretaria)
    if ($has('role')) {
        $where[] = "role = 'doctor'";
    }

    // Status/active compatível
    if ($has('active')) {
        $where[] = 'active = 1';
    } elseif ($has('status')) {
        // status (active/pending/inactive)
        $where[] = "status = 'active'";
    }

    $sql = "SELECT " . implode(', ', array_unique($selectCols)) . " FROM usuarios";
    if (!empty($where)) {
        $sql .= " WHERE " . implode(' AND ', $where);
    }
    $sql .= " ORDER BY name";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $professionals = $stmt->fetchAll();

    // Default colors for professionals without custom color
    $defaultColors = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan', 'amber', 'rose'];
    $colorIndex = 0;

    foreach ($professionals as &$prof) {
        $prof['id'] = (int)$prof['id'];
        
        // Assign default color if none set
        // Assign default color if none set or if schema doesn't have it
        if (!array_key_exists('color', $prof) || empty($prof['color'])) {
            $prof['color'] = $defaultColors[$colorIndex % count($defaultColors)];
            $colorIndex++;
        }
    }

    Response::success($professionals);

} catch (Exception $e) {
    error_log("List professionals error: " . $e->getMessage());
    Response::serverError('Erro ao listar profissionais');
}
