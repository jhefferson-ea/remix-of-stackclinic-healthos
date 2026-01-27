<?php
/**
 * StackClinic API - Upload Clinic Logo
 * POST /api/config/upload-logo
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

try {
    if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = 'Nenhum arquivo enviado';
        if (isset($_FILES['logo']['error'])) {
            $uploadErrors = [
                UPLOAD_ERR_INI_SIZE => 'Arquivo muito grande (limite do servidor)',
                UPLOAD_ERR_FORM_SIZE => 'Arquivo muito grande (limite do formulário)',
                UPLOAD_ERR_PARTIAL => 'Upload incompleto',
                UPLOAD_ERR_NO_FILE => 'Nenhum arquivo selecionado',
                UPLOAD_ERR_NO_TMP_DIR => 'Pasta temporária não encontrada',
                UPLOAD_ERR_CANT_WRITE => 'Erro ao gravar arquivo',
            ];
            $errorMsg = $uploadErrors[$_FILES['logo']['error']] ?? 'Erro desconhecido no upload';
        }
        Response::badRequest($errorMsg);
    }

    $file = $_FILES['logo'];
    
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!in_array($file['type'], $allowedTypes)) {
        Response::badRequest('Tipo de arquivo não permitido. Use: JPG, PNG, GIF ou WEBP');
    }

    // Max 5MB
    if ($file['size'] > 5 * 1024 * 1024) {
        Response::badRequest('Arquivo muito grande. Máximo: 5MB');
    }

    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/uploads/logos/';
    
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            Response::serverError('Erro ao criar diretório de uploads');
        }
    }
    
    // Generate unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'logo_' . time() . '_' . uniqid() . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        Response::serverError('Erro ao salvar arquivo');
    }
    
    $url = '/uploads/logos/' . $filename;
    
    // Update clinic config in database
    $database = new Database();
    $db = $database->getConnection();

    // Compatibility with current schema: column is `logo_url`
    $stmt = $db->prepare("UPDATE clinica SET logo_url = :logo_url WHERE id = 1");
    $stmt->execute([':logo_url' => $url]);
    
    Response::success([
        'logo_url' => $url,
        'filename' => $filename
    ], 'Logo enviado com sucesso');

} catch (Exception $e) {
    error_log("Upload logo error: " . $e->getMessage());
    Response::serverError('Erro ao fazer upload: ' . $e->getMessage());
}
