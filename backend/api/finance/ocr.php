<?php
/**
 * StackClinic API - OCR (Expense Reader)
 * POST /api/finance/ocr
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['image'])) {
    Response::error('Imagem não fornecida');
}

try {
    // TODO: Integrar com OpenAI Vision ou Tesseract para OCR real
    // Por enquanto, simula resultado de OCR
    
    $result = [
        'valor' => 89.90,
        'categoria' => 'Material de Escritório',
        'descricao' => 'Compra de materiais diversos',
        'data' => date('Y-m-d'),
        'confidence' => 0.92
    ];
    
    // Registrar a despesa automaticamente
    $stmt = $db->prepare("
        INSERT INTO financeiro_transacoes (type, category, description, value, date)
        VALUES ('saida', :category, :description, :value, :date)
    ");
    $stmt->execute([
        ':category' => $result['categoria'],
        ':description' => $result['descricao'],
        ':value' => $result['valor'],
        ':date' => $result['data']
    ]);
    
    Response::success($result);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao processar OCR');
}
