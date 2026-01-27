<?php
/**
 * StackClinic API - Upload Patient Document
 * POST /api/patients/{id}/documents/upload
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
    preg_match('/\/patients\/(\d+)\/documents\/upload/', $uri, $matches);
    $patientId = isset($matches[1]) ? (int)$matches[1] : null;
    
    if (!$patientId) {
        Response::badRequest('ID do paciente é obrigatório');
    }

    if (!isset($_FILES['document'])) {
        Response::badRequest('Nenhum documento enviado');
    }

    $file = $_FILES['document'];
    $category = $_POST['category'] ?? 'outros';
    
    // Validate file type
    $allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!in_array($file['type'], $allowedTypes)) {
        Response::badRequest('Tipo de arquivo não permitido. Use: PDF, JPG, PNG ou DOC');
    }

    // Max 20MB
    if ($file['size'] > 20 * 1024 * 1024) {
        Response::badRequest('Arquivo muito grande. Máximo: 20MB');
    }

    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/uploads/documents/';
    
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'doc_' . $patientId . '_' . time() . '_' . uniqid() . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        Response::serverError('Erro ao salvar arquivo');
    }
    
    $url = '/uploads/documents/' . $filename;
    
    // Save to database
    $database = new Database();
    $db = $database->getConnection();
    
    $stmt = $db->prepare("
        INSERT INTO documentos_paciente (paciente_id, name, url, type, category)
        VALUES (:patient_id, :name, :url, :type, :category)
    ");
    $stmt->execute([
        ':patient_id' => $patientId,
        ':name' => $file['name'],
        ':url' => $url,
        ':type' => $extension,
        ':category' => $category
    ]);
    
    $id = $db->lastInsertId();
    
    Response::success([
        'id' => (int)$id,
        'name' => $file['name'],
        'url' => $url,
        'type' => $extension,
        'category' => $category,
        'created_at' => date('Y-m-d H:i:s')
    ], 'Documento enviado com sucesso');

} catch (Exception $e) {
    error_log("Document upload error: " . $e->getMessage());
    Response::serverError('Erro ao fazer upload');
}
