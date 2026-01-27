<?php
/**
 * StackClinic API - Patients
 * GET /api/patients - List patients
 * POST /api/patients - Create patient
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
        $search = $_GET['search'] ?? null;
        
        $sql = "
            SELECT p.id, p.name, p.phone, p.email, p.avatar, p.convenio,
                   (SELECT MAX(date) FROM agendamentos WHERE paciente_id = p.id AND clinica_id = :clinica_id2) as last_visit
            FROM pacientes p
            WHERE p.clinica_id = :clinica_id
        ";
        
        $params = [':clinica_id' => $clinicaId, ':clinica_id2' => $clinicaId];
        
        if ($search) {
            $sql .= " AND (p.name LIKE :search OR p.phone LIKE :search OR p.email LIKE :search)";
            $params[':search'] = "%{$search}%";
        }
        
        $sql .= " ORDER BY p.name ASC";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        
        $patients = $stmt->fetchAll();
        
        foreach ($patients as &$patient) {
            $patient['id'] = (int) $patient['id'];
        }
        
        Response::success($patients);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['name'], $data['phone'])) {
            Response::error('Nome e telefone são obrigatórios');
        }
        
        $stmt = $db->prepare("
            INSERT INTO pacientes (name, phone, email, cpf, birth_date, address, convenio, convenio_numero, clinica_id)
            VALUES (:name, :phone, :email, :cpf, :birth_date, :address, :convenio, :convenio_numero, :clinica_id)
        ");
        
        $stmt->execute([
            ':name' => $data['name'],
            ':phone' => $data['phone'],
            ':email' => $data['email'] ?? null,
            ':cpf' => $data['cpf'] ?? null,
            ':birth_date' => $data['birth_date'] ?? null,
            ':address' => $data['address'] ?? null,
            ':convenio' => $data['convenio'] ?? null,
            ':convenio_numero' => $data['convenio_numero'] ?? null,
            ':clinica_id' => $clinicaId
        ]);
        
        $id = $db->lastInsertId();
        
        Response::success(['id' => (int) $id], 'Paciente criado com sucesso');
    }

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao processar pacientes');
}