<?php
/**
 * StackClinic API - Upload Library File
 * POST /api/library/upload
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::methodNotAllowed();
}

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

try {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = 'Nenhum arquivo enviado';
        if (isset($_FILES['file']['error'])) {
            $uploadErrors = [
                UPLOAD_ERR_INI_SIZE => 'Arquivo muito grande (limite do servidor)',
                UPLOAD_ERR_FORM_SIZE => 'Arquivo muito grande (limite do formulário)',
                UPLOAD_ERR_PARTIAL => 'Upload incompleto',
                UPLOAD_ERR_NO_FILE => 'Nenhum arquivo selecionado',
                UPLOAD_ERR_NO_TMP_DIR => 'Pasta temporária não encontrada',
                UPLOAD_ERR_CANT_WRITE => 'Erro ao gravar arquivo',
            ];
            $errorMsg = $uploadErrors[$_FILES['file']['error']] ?? 'Erro desconhecido no upload';
        }
        Response::badRequest($errorMsg);
    }

    $file = $_FILES['file'];
    $category = $_POST['category'] ?? 'Geral';
    
    // Max 20MB
    if ($file['size'] > 20 * 1024 * 1024) {
        Response::badRequest('Arquivo muito grande. Máximo: 20MB');
    }

    $uploadDir = $_SERVER['DOCUMENT_ROOT'] . '/uploads/library/';
    
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            Response::serverError('Erro ao criar diretório de uploads');
        }
    }
    
    // Sanitize filename
    $originalName = $file['name'];
    $filename = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '', $originalName);
    $filepath = $uploadDir . $filename;
    
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        Response::serverError('Erro ao salvar arquivo. Verifique as permissões do diretório.');
    }
    
    $url = '/uploads/library/' . $filename;
    $type = pathinfo($filename, PATHINFO_EXTENSION);
    
    $database = new Database();
    $db = $database->getConnection();
    
    $stmt = $db->prepare("
        INSERT INTO biblioteca_arquivos (name, url, type, category, clinica_id)
        VALUES (:name, :url, :type, :category, :clinica_id)
    ");
    $stmt->execute([
        ':name' => $originalName,
        ':url' => $url,
        ':type' => $type,
        ':category' => $category,
        ':clinica_id' => $clinicaId
    ]);
    
    $id = $db->lastInsertId();
    
    Response::success([
        'id' => (int)$id,
        'name' => $originalName,
        'url' => $url,
        'type' => $type,
        'category' => $category,
        'created_at' => date('Y-m-d H:i:s')
    ], 'Arquivo enviado com sucesso');

} catch (Exception $e) {
    error_log("Library upload error: " . $e->getMessage());
    Response::serverError('Erro ao fazer upload: ' . $e->getMessage());
}