<?php
/**
 * StackClinic API - Team Management
 * GET /api/team - List all team members
 * POST /api/team - Invite new team member
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$authUser = Auth::requireAuth();

// Only admin (owner) can manage team
if ($authUser['role'] !== 'admin') {
    Response::forbidden('Acesso negado');
}

// Obter clinica_id do usuário autenticado
$clinicaId = $authUser['clinica_id'];

if (!$clinicaId) {
    Response::unauthorized('Usuário não vinculado a uma clínica');
}

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $stmt = $db->prepare("
            SELECT id, name, email, role, avatar, phone, active, created_at, last_login 
            FROM usuarios 
            WHERE clinica_id = :clinica_id
            ORDER BY created_at DESC
        ");
        $stmt->execute([':clinica_id' => $clinicaId]);
        $users = $stmt->fetchAll();
        
        $mappedUsers = array_map(function($user) {
            $roleMap = [
                'admin' => 'owner',
                'doctor' => 'doctor',
                'assistant' => 'secretary'
            ];
            
            // Determine status: pending if never logged in (last_login is NULL)
            $hasLoggedIn = !empty($user['last_login']);
            $isActive = (bool)$user['active'];
            
            // Admin (owner) is always active, others depend on last_login
            if ($user['role'] === 'admin') {
                $status = $isActive ? 'active' : 'inactive';
            } else {
                $status = $hasLoggedIn ? ($isActive ? 'active' : 'inactive') : 'pending';
            }
            
            return [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $roleMap[$user['role']] ?? $user['role'],
                'avatar' => $user['avatar'],
                'phone' => $user['phone'],
                'active' => $isActive,
                'status' => $status,
                'created_at' => $user['created_at']
            ];
        }, $users);
        
        Response::success($mappedUsers);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $name = trim($data['name'] ?? '');
        $email = trim($data['email'] ?? '');
        $role = $data['role'] ?? 'doctor';
        
        if (empty($name) || empty($email)) {
            Response::badRequest('Nome e email são obrigatórios');
        }
        
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::badRequest('Email inválido');
        }
        
        $roleMap = [
            'owner' => 'admin',
            'doctor' => 'doctor',
            'secretary' => 'assistant'
        ];
        $backendRole = $roleMap[$role] ?? 'doctor';
        
        // Check if email exists
        $stmt = $db->prepare("SELECT id FROM usuarios WHERE email = :email LIMIT 1");
        $stmt->execute([':email' => $email]);
        if ($stmt->fetch()) {
            Response::badRequest('Este email já está cadastrado');
        }
        
        // Generate temporary password
        $tempPassword = bin2hex(random_bytes(4));
        $hashedPassword = password_hash($tempPassword, PASSWORD_DEFAULT);
        
        // Team members inherit clinic subscription - set status to 'active' (not 'pending')
        $stmt = $db->prepare("
            INSERT INTO usuarios (name, email, password, role, active, clinica_id, subscription_status) 
            VALUES (:name, :email, :password, :role, 1, :clinica_id, 'active')
        ");
        $stmt->execute([
            ':name' => $name,
            ':email' => $email,
            ':password' => $hashedPassword,
            ':role' => $backendRole,
            ':clinica_id' => $clinicaId
        ]);
        
        $userId = $db->lastInsertId();
        
        Response::success([
            'id' => (int)$userId,
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'temp_password' => $tempPassword,
            'active' => true
        ], 'Membro convidado com sucesso');
    }
} catch (Exception $e) {
    error_log("Team API error: " . $e->getMessage());
    Response::serverError('Erro ao processar requisição');
}