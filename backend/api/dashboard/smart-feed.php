<?php
/**
 * StackClinic API - Smart Feed
 * GET /api/dashboard/smart-feed
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
    // Buscar itens do smart feed (últimos 20)
    $stmt = $db->prepare("
        SELECT id, type, title, description, action, priority, created_at 
        FROM smart_feed 
        WHERE clinica_id = :clinica_id AND `read` = 0 
        ORDER BY 
            FIELD(priority, 'high', 'medium', 'low'),
            created_at DESC 
        LIMIT 20
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $feedItems = $stmt->fetchAll();

    // Adicionar alertas dinâmicos

    // Aniversariantes do dia
    $stmt = $db->prepare("
        SELECT id, name 
        FROM pacientes 
        WHERE clinica_id = :clinica_id AND DAY(birth_date) = DAY(CURDATE()) AND MONTH(birth_date) = MONTH(CURDATE())
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $birthdays = $stmt->fetchAll();

    foreach ($birthdays as $patient) {
        $feedItems[] = [
            'id' => 'birthday_' . $patient['id'],
            'type' => 'birthday',
            'title' => 'Aniversário de ' . $patient['name'],
            'description' => 'Envie uma mensagem de parabéns!',
            'action' => 'send_birthday_msg',
            'priority' => 'medium',
            'created_at' => date('Y-m-d H:i:s')
        ];
    }

    // Pacientes inadimplentes
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM financeiro_transacoes ft
        JOIN pacientes p ON ft.paciente_id = p.id
        WHERE ft.clinica_id = :clinica_id AND ft.type = 'entrada' AND ft.value < 0
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $inadimplentes = $stmt->fetch()['total'];

    if ($inadimplentes > 0) {
        array_unshift($feedItems, [
            'id' => 'inadimplentes_' . date('Ymd'),
            'type' => 'alert',
            'title' => $inadimplentes . ' Inadimplentes detectados',
            'description' => 'Verificar pagamentos pendentes',
            'action' => 'view_inadimplentes',
            'priority' => 'high',
            'created_at' => date('Y-m-d H:i:s')
        ]);
    }

    // Agendamentos sem confirmação
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM agendamentos 
        WHERE clinica_id = :clinica_id AND DATE(date) = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND status = 'pending'
    ");
    $stmt->execute([':clinica_id' => $clinicaId]);
    $pendingTomorrow = $stmt->fetch()['total'];

    if ($pendingTomorrow > 0) {
        $feedItems[] = [
            'id' => 'pending_tomorrow_' . date('Ymd'),
            'type' => 'reminder',
            'title' => $pendingTomorrow . ' agendamentos sem confirmação',
            'description' => 'Agendamentos de amanhã aguardando confirmação',
            'action' => 'confirm_appointments',
            'priority' => 'high',
            'created_at' => date('Y-m-d H:i:s')
        ];
    }

    Response::success($feedItems);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao buscar smart feed');
}