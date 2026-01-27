<?php
/**
 * StackClinic API - Upload Patient Gallery Image
 * POST /api/patients/{id}/gallery/upload
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

try {
    // Extract patient ID from URL
    $uri = $_SERVER['REQUEST_URI'];
    preg_match('/\/patients\/(\d+)\/gallery\/upload/', $uri, $matches);
    $patientId = isset($matches[1]) ? (int)$matches[1] : null;
    
    if (!$patientId) {
        Response::badRequest('ID do paciente é obrigatório');
    }

    if (!isset($_FILES['image'])) {
        Response::badRequest('Nenhuma imagem enviada');
    }

    $file = $_FILES['image'];
    $type = $_POST['type'] ?? 'before'; // before or after
    $description = $_POST['description'] ?? '';
    
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!in_array($file['type'], $allowedTypes)) {
        Response::badRequest('Tipo de arquivo não permitido');
    }

    // Max 10MB
    if ($file['size'] > 10 * 1024 * 1024) {
        Response::badRequest('Arquivo muito grande. Máximo: 10MB');
    }

    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/uploads/gallery/';
    
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'patient_' . $patientId . '_' . time() . '_' . uniqid() . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        Response::serverError('Erro ao salvar arquivo');
    }
    
    $url = '/uploads/gallery/' . $filename;
    
    // Save to database
    $database = new Database();
    $db = $database->getConnection();
    
    $stmt = $db->prepare("
        INSERT INTO galeria_paciente (paciente_id, url, type, description)
        VALUES (:patient_id, :url, :type, :description)
    ");
    $stmt->execute([
        ':patient_id' => $patientId,
        ':url' => $url,
        ':type' => $type,
        ':description' => $description
    ]);
    
    $id = $db->lastInsertId();
    
    Response::success([
        'id' => (int)$id,
        'url' => $url,
        'type' => $type,
        'description' => $description,
        'date' => date('Y-m-d H:i:s')
    ], 'Imagem enviada com sucesso');

} catch (Exception $e) {
    error_log("Gallery upload error: " . $e->getMessage());
    Response::serverError('Erro ao fazer upload');
}
