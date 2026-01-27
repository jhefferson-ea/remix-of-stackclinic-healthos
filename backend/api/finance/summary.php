<?php
/**
 * StackClinic API - Financial Summary
 * GET /api/finance/summary
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
    $professionalId = isset($_GET['professional_id']) ? (int)$_GET['professional_id'] : null;
    
    // Build professional filter
    $profFilter = '';
    $profFilterPayments = '';
    if ($professionalId) {
        $profFilter = ' AND usuario_id = ' . $professionalId;
        $profFilterPayments = ' AND pp.usuario_id = ' . $professionalId;
    }
    
    // Total de receitas (mês atual) from financeiro_transacoes
    $sql = "
        SELECT COALESCE(SUM(value), 0) as total 
        FROM financeiro_transacoes 
        WHERE clinica_id = :clinica_id AND type = 'entrada' 
        AND MONTH(date) = MONTH(CURDATE()) 
        AND YEAR(date) = YEAR(CURDATE())
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([':clinica_id' => $clinicaId]);
    $transactionRevenue = (float) $stmt->fetch()['total'];

    // Total de procedimentos pagos (mês atual) from pagamentos_procedimentos
    $sql = "
        SELECT COALESCE(SUM(pp.amount), 0) as total 
        FROM pagamentos_procedimentos pp
        WHERE pp.clinica_id = :clinica_id AND pp.status = 'pago' 
        AND MONTH(pp.payment_date) = MONTH(CURDATE()) 
        AND YEAR(pp.payment_date) = YEAR(CURDATE())
        {$profFilterPayments}
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([':clinica_id' => $clinicaId]);
    $procedureRevenue = (float) $stmt->fetch()['total'];

    $totalRevenue = $transactionRevenue + $procedureRevenue;

    // Total de despesas (mês atual)
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(value), 0) as total 
        FROM financeiro_transacoes 
        WHERE clinica_id = :clinica_id AND type = 'saida' 
        AND MONTH(date) = MONTH(CURDATE()) 
        AND YEAR(date) = YEAR(CURDATE())
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $totalExpenses = (float) $stmt->fetch()['total'];

    // Pagamentos pendentes de procedimentos
    $sql = "
        SELECT COALESCE(SUM(pp.amount), 0) as total 
        FROM pagamentos_procedimentos pp
        WHERE pp.clinica_id = :clinica_id AND pp.status IN ('a_receber', 'pendente')
        {$profFilterPayments}
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute([':clinica_id' => $clinicaId]);
    $pendingPayments = (float) $stmt->fetch()['total'];

    Response::success([
        'total_revenue' => $totalRevenue,
        'total_expenses' => $totalExpenses,
        'balance' => ($totalRevenue - $totalExpenses),
        'pending_payments' => $pendingPayments
    ]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar resumo financeiro');
}