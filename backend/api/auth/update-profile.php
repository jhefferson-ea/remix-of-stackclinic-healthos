<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

// Require authentication
$authData = Auth::requireAuth();
if (!$authData) {
    exit;
}

// Only accept PUT or POST
if ($_SERVER['REQUEST_METHOD'] !== 'PUT' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input)) {
        Response::badRequest('Dados não fornecidos');
    }
    
    $db = (new Database())->getConnection();
    $userId = $authData['user_id'];
    
    // Build update query dynamically
    $updates = [];
    $params = [];
    
    // Name
    if (isset($input['name']) && !empty(trim($input['name']))) {
        $updates[] = 'name = :name';
        $params[':name'] = trim($input['name']);
    }
    
    // Phone
    if (isset($input['phone'])) {
        $updates[] = 'phone = :phone';
        $params[':phone'] = trim($input['phone']);
    }
    
    // Password (optional, only if provided)
    if (isset($input['password']) && !empty($input['password'])) {
        if (strlen($input['password']) < 6) {
            Response::badRequest('A senha deve ter pelo menos 6 caracteres');
        }
        $updates[] = 'password = :password';
        $params[':password'] = password_hash($input['password'], PASSWORD_DEFAULT);
    }
    
    if (empty($updates)) {
        Response::badRequest('Nenhum campo para atualizar');
    }
    
    // Add user ID to params
    $params[':user_id'] = $userId;
    
    // Execute update
    $sql = "UPDATE usuarios SET " . implode(', ', $updates) . ", updated_at = NOW() WHERE id = :user_id";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    // Fetch updated user data
    $stmt = $db->prepare("SELECT id, name, email, role, phone, avatar FROM usuarios WHERE id = :id");
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    Response::success([
        'user' => [
            'id' => (int)$user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'phone' => $user['phone'],
            'avatar' => $user['avatar']
        ]
    ], 'Perfil atualizado com sucesso');
    
} catch (Exception $e) {
    Response::serverError('Erro ao atualizar perfil: ' . $e->getMessage());
}
