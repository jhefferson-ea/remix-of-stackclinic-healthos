<?php
/**
 * StackClinic API - Dashboard Summary
 * GET /api/dashboard/summary
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
    // Faturamento do dia - Transações financeiras
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(value), 0) as total 
        FROM financeiro_transacoes 
        WHERE clinica_id = :clinica_id AND type = 'entrada' AND DATE(date) = CURDATE()
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $transHoje = (float) $stmt->fetch()['total'];

    // Faturamento do dia - Procedimentos pagos
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM pagamentos_procedimentos 
        WHERE clinica_id = :clinica_id AND status = 'pago' AND DATE(payment_date) = CURDATE()
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $procHoje = (float) $stmt->fetch()['total'];
    
    $faturamentoHoje = $transHoje + $procHoje;

    // Faturamento do mês - Transações financeiras
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(value), 0) as total 
        FROM financeiro_transacoes 
        WHERE clinica_id = :clinica_id AND type = 'entrada' AND MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $transMes = (float) $stmt->fetch()['total'];

    // Faturamento do mês - Procedimentos pagos
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM pagamentos_procedimentos 
        WHERE clinica_id = :clinica_id AND status = 'pago' 
        AND MONTH(payment_date) = MONTH(CURDATE()) AND YEAR(payment_date) = YEAR(CURDATE())
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $procMes = (float) $stmt->fetch()['total'];
    
    $faturamentoMes = $transMes + $procMes;

    // Faturamento mês anterior (para variação)
    $stmt = $db->prepare("
        SELECT COALESCE(SUM(value), 0) as total 
        FROM financeiro_transacoes 
        WHERE clinica_id = :clinica_id AND type = 'entrada' AND MONTH(date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
        AND YEAR(date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $faturamentoMesAnterior = $stmt->fetch()['total'];
    $variacao = $faturamentoMesAnterior > 0 ? (($faturamentoMes - $faturamentoMesAnterior) / $faturamentoMesAnterior) * 100 : 0;

    // Agendamentos realizados hoje
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM agendamentos 
        WHERE clinica_id = :clinica_id AND DATE(date) = CURDATE() AND status = 'completed'
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $realizados = $stmt->fetch()['total'];

    // Agendamentos pendentes
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM agendamentos 
        WHERE clinica_id = :clinica_id AND DATE(date) = CURDATE() AND status IN ('pending', 'confirmed')
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $pendentes = $stmt->fetch()['total'];

    // Total agendamentos do dia
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM agendamentos 
        WHERE clinica_id = :clinica_id AND DATE(date) = CURDATE()
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $totalAgendamentos = $stmt->fetch()['total'];

    // Novos pacientes do mês
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM pacientes 
        WHERE clinica_id = :clinica_id AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $novosPacientes = $stmt->fetch()['total'];

    // Novos pacientes mês anterior (para crescimento)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM pacientes 
        WHERE clinica_id = :clinica_id AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
        AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $pacientesMesAnterior = $stmt->fetch()['total'];
    $crescimento = $pacientesMesAnterior > 0 ? (($novosPacientes - $pacientesMesAnterior) / $pacientesMesAnterior) * 100 : 0;

    Response::success([
        'faturamento' => [
            'hoje' => (float) $faturamentoHoje,
            'mes' => (float) $faturamentoMes,
            'variacao' => round($variacao, 1)
        ],
        'agendamentos' => [
            'realizados' => (int) $realizados,
            'pendentes' => (int) $pendentes,
            'total' => (int) $totalAgendamentos
        ],
        'novosPacientes' => [
            'total' => (int) $novosPacientes,
            'crescimento' => round($crescimento, 1)
        ]
    ]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar dados do dashboard');
}