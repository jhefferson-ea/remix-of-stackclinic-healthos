<?php
/**
 * StackClinic API - Generate TISS Document
 * POST /api/finance/generate-tiss
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['receipt_ids']) || empty($data['receipt_ids'])) {
    Response::error('Nenhum recibo selecionado');
}

try {
    $ids = implode(',', array_map('intval', $data['receipt_ids']));
    
    // Buscar recibos selecionados
    $stmt = $db->query("
        SELECT r.*, p.name as patient_name, p.convenio, p.convenio_numero
        FROM recibos r
        JOIN pacientes p ON r.paciente_id = p.id
        WHERE r.id IN ({$ids})
    ");
    $receipts = $stmt->fetchAll();
    
    // TODO: Gerar PDF TISS real
    $filename = 'tiss_' . date('Ymd_His') . '.pdf';
    $pdfUrl = '/documents/tiss/' . $filename;
    
    // Atualizar status dos recibos
    $db->exec("UPDATE recibos SET status = 'processed', tiss_pdf_url = '{$pdfUrl}' WHERE id IN ({$ids})");
    
    Response::success(['pdf_url' => $pdfUrl]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao gerar documento TISS');
}
