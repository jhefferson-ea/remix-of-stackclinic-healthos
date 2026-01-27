<?php
/**
 * StackClinic API - Cash Flow
 * GET /api/finance/cash-flow
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

$period = $_GET['period'] ?? 'month';

try {
    switch ($period) {
        case 'week':
            $startDate = date('Y-m-d', strtotime('-7 days'));
            $groupBy = 'DATE(date)';
            break;
        case 'year':
            $startDate = date('Y-01-01');
            $groupBy = 'DATE_FORMAT(date, "%Y-%m")';
            break;
        default: // month
            $startDate = date('Y-m-01');
            $groupBy = 'DATE(date)';
    }

    $stmt = $db->prepare("
        SELECT 
            {$groupBy} as date,
            SUM(CASE WHEN type = 'entrada' THEN value ELSE 0 END) as entradas,
            SUM(CASE WHEN type = 'saida' THEN value ELSE 0 END) as saidas
        FROM financeiro_transacoes
        WHERE clinica_id = :clinica_id AND date >= :start_date
        GROUP BY {$groupBy}
        ORDER BY date ASC
    ");
    $stmt->execute([':clinica_id' => $clinicaId, ':start_date' => $startDate]);
    $cashFlow = $stmt->fetchAll();

    foreach ($cashFlow as &$item) {
        $item['entradas'] = (float) $item['entradas'];
        $item['saidas'] = (float) $item['saidas'];
    }

    Response::success($cashFlow);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar fluxo de caixa');
}