<?php
/**
 * StackClinic API - Create Patient
 * POST /api/patients/create
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$authUser = Auth::requireAuth();

// Obter clinica_id do usuário autenticado
$clinicaId = $authUser['clinica_id'];

if (!$clinicaId) {
    Response::unauthorized('Usuário não vinculado a uma clínica');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

$data = json_decode(file_get_contents('php://input'), true);

$name = trim($data['name'] ?? '');
$phone = trim($data['phone'] ?? '');
$cpf = trim($data['cpf'] ?? '');
$email = trim($data['email'] ?? '');

if (empty($name)) {
    Response::badRequest('Nome é obrigatório');
}

if (empty($phone)) {
    Response::badRequest('Telefone é obrigatório');
}

// Clean phone number
$phone = preg_replace('/[^0-9]/', '', $phone);

$database = new Database();
$db = $database->getConnection();

try {
    // Check if phone already exists within same clinic
    $stmt = $db->prepare("SELECT id FROM pacientes WHERE phone = :phone AND clinica_id = :clinica_id LIMIT 1");
    $stmt->execute([':phone' => $phone, ':clinica_id' => $clinicaId]);
    if ($stmt->fetch()) {
        Response::badRequest('Já existe um paciente com este telefone');
    }

    $stmt = $db->prepare("INSERT INTO pacientes (name, phone, cpf, email, clinica_id) VALUES (:name, :phone, :cpf, :email, :clinica_id)");
    $stmt->execute([
        ':name' => $name,
        ':phone' => $phone,
        ':cpf' => $cpf ?: null,
        ':email' => $email ?: null,
        ':clinica_id' => $clinicaId
    ]);

    $patientId = $db->lastInsertId();

    Response::success([
        'id' => (int)$patientId,
        'name' => $name,
        'phone' => $phone,
        'cpf' => $cpf,
        'email' => $email
    ], 'Paciente criado com sucesso');

} catch (Exception $e) {
    error_log("Create patient error: " . $e->getMessage());
    Response::serverError('Erro ao criar paciente');
}