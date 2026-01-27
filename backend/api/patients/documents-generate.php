<?php
/**
 * StackClinic API - Generate Document (Atestado/Receita)
 * POST /api/patients/{id}/documents/generate
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';

$database = new Database();
$db = $database->getConnection();

// Get ID from URL
$uri = $_SERVER['REQUEST_URI'];
preg_match('/\/patients\/(\d+)\/documents\/generate/', $uri, $matches);
$patientId = $matches[1] ?? null;

if (!$patientId) {
    Response::error('ID do paciente não informado');
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['type'])) {
    Response::error('Tipo de documento não informado');
}

try {
    // Buscar dados do paciente
    $stmt = $db->prepare("SELECT name, cpf FROM pacientes WHERE id = :id");
    $stmt->execute([':id' => $patientId]);
    $patient = $stmt->fetch();
    
    if (!$patient) {
        Response::notFound('Paciente não encontrado');
    }
    
    // Buscar dados da clínica
    $stmt = $db->prepare("SELECT name, cnpj, address FROM clinica WHERE id = 1");
    $stmt->execute();
    $clinic = $stmt->fetch();
    
    // TODO: Gerar PDF real com biblioteca como TCPDF ou Dompdf
    // Por enquanto, retorna URL simulada
    
    $docType = $data['type'] === 'atestado' ? 'atestado' : 'receita';
    $filename = $docType . '_' . $patientId . '_' . date('Ymd_His') . '.pdf';
    $pdfUrl = '/documents/' . $filename;
    
    // Registrar na timeline
    $stmt = $db->prepare("
        INSERT INTO timeline (paciente_id, type, title, description, metadata)
        VALUES (:patient_id, 'file', :title, :description, :metadata)
    ");
    $stmt->execute([
        ':patient_id' => $patientId,
        ':title' => ucfirst($docType) . ' gerado',
        ':description' => 'Documento gerado pelo sistema',
        ':metadata' => json_encode(['url' => $pdfUrl, 'type' => $docType])
    ]);
    
    Response::success(['pdf_url' => $pdfUrl]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao gerar documento');
}
