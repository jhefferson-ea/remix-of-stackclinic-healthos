<?php
/**
 * StackClinic API - Procedure Payments
 * GET /api/finance/procedure-payments - List procedure payments
 * PUT /api/finance/procedure-payments - Update payment status
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
$method = $_SERVER['REQUEST_METHOD'];

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

try {
    if ($method === 'GET') {
        $date = $_GET['date'] ?? null;
        $status = $_GET['status'] ?? null;
        $period = $_GET['period'] ?? null;
        
        $where = ["pp.clinica_id = :clinica_id"];
        $params = [':clinica_id' => $clinicaId];
        
        if ($date === 'today') {
            $where[] = "pp.appointment_date = CURDATE()";
        } elseif ($date === 'yesterday') {
            $where[] = "pp.appointment_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
        } elseif ($date) {
            $where[] = "pp.appointment_date = :date";
            $params[':date'] = $date;
        }
        
        if ($status === 'pending') {
            $where[] = "(pp.status = 'a_receber' OR pp.status = 'pendente')";
        } elseif ($status) {
            $where[] = "pp.status = :status";
            $params[':status'] = $status;
        }
        
        if ($period === 'week') {
            $where[] = "pp.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
        } elseif ($period === 'month') {
            $where[] = "pp.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
        }
        
        $whereClause = 'WHERE ' . implode(' AND ', $where);
        
        $sql = "
            SELECT pp.id, pp.agendamento_id, pp.patient_id, pp.patient_name, 
                   pp.procedure_name, pp.amount, pp.status, 
                   pp.appointment_date as date, TIME_FORMAT(pp.appointment_time, '%H:%i') as time,
                   pp.payment_date, pp.created_at
            FROM pagamentos_procedimentos pp
            {$whereClause}
            ORDER BY pp.appointment_date DESC, pp.appointment_time DESC
        ";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($payments as &$payment) {
            $payment['id'] = (int) $payment['id'];
            $payment['agendamento_id'] = (int) $payment['agendamento_id'];
            $payment['patient_id'] = (int) $payment['patient_id'];
            $payment['amount'] = (float) $payment['amount'];
        }
        
        Response::success($payments);
        
    } elseif ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['id']) || !isset($data['status'])) {
            Response::badRequest('ID e status são obrigatórios');
        }
        
        $validStatuses = ['a_receber', 'pendente', 'pago'];
        if (!in_array($data['status'], $validStatuses)) {
            Response::badRequest('Status inválido. Use: a_receber, pendente ou pago');
        }
        
        $paymentDate = $data['status'] === 'pago' ? 'NOW()' : 'NULL';
        
        // Ensure payment belongs to this clinic
        $stmt = $db->prepare("
            UPDATE pagamentos_procedimentos 
            SET status = :status, payment_date = {$paymentDate}, updated_at = NOW()
            WHERE id = :id AND clinica_id = :clinica_id
        ");
        $stmt->execute([
            ':id' => $data['id'],
            ':status' => $data['status'],
            ':clinica_id' => $clinicaId
        ]);
        
        if ($stmt->rowCount() === 0) {
            Response::notFound('Pagamento não encontrado');
        }
        
        // Also update the appointment payment_status
        $stmt2 = $db->prepare("
            UPDATE agendamentos a
            JOIN pagamentos_procedimentos pp ON pp.agendamento_id = a.id
            SET a.payment_status = :status
            WHERE pp.id = :id AND a.clinica_id = :clinica_id
        ");
        $stmt2->execute([
            ':id' => $data['id'],
            ':status' => $data['status'],
            ':clinica_id' => $clinicaId
        ]);
        
        // Fetch updated payment
        $stmt = $db->prepare("
            SELECT pp.id, pp.agendamento_id, pp.patient_id, pp.patient_name, 
                   pp.procedure_name, pp.amount, pp.status,
                   pp.appointment_date as date, TIME_FORMAT(pp.appointment_time, '%H:%i') as time,
                   pp.payment_date
            FROM pagamentos_procedimentos pp
            WHERE pp.id = :id AND pp.clinica_id = :clinica_id
        ");
        $stmt->execute([':id' => $data['id'], ':clinica_id' => $clinicaId]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($payment) {
            $payment['id'] = (int) $payment['id'];
            $payment['agendamento_id'] = (int) $payment['agendamento_id'];
            $payment['patient_id'] = (int) $payment['patient_id'];
            $payment['amount'] = (float) $payment['amount'];
        }
        
        Response::success($payment, 'Status de pagamento atualizado');
        
    } else {
        Response::methodNotAllowed('Método não permitido');
    }
    
} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao processar pagamentos: ' . $e->getMessage());
}