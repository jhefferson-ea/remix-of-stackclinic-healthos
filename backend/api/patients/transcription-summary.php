<?php
/**
 * StackClinic API - Transcription Summary (AI)
 * POST /api/patients/{id}/transcription/summary
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$database = new Database();
$db = $database->getConnection();

// Obter clinica_id do usuário autenticado
$clinicaId = Tenant::getClinicId();

// Get ID from URL
$uri = $_SERVER['REQUEST_URI'];
preg_match('/\/patients\/(\d+)\/transcription\/summary/', $uri, $matches);
$patientId = $matches[1] ?? null;

if (!$patientId) {
    Response::error('ID do paciente não informado');
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['session_id'])) {
    Response::error('Session ID não informado');
}

try {
    // Buscar transcrição (verificando clínica)
    $stmt = $db->prepare("
        SELECT id, transcription FROM transcricoes 
        WHERE paciente_id = :patient_id AND session_id = :session_id AND clinica_id = :clinica_id
    ");
    $stmt->execute([
        ':patient_id' => $patientId,
        ':session_id' => $data['session_id'],
        ':clinica_id' => $clinicaId
    ]);
    $transcription = $stmt->fetch();
    
    if (!$transcription) {
        Response::notFound('Sessão não encontrada');
    }
    
    // TODO: Integrar com OpenAI/Gemini para gerar resumo real
    $summary = "**Resumo da Consulta**\n\n";
    $summary .= "Paciente relatou queixa principal de dor localizada.\n\n";
    $summary .= "**Anamnese:**\n";
    $summary .= "- Início dos sintomas: há 3 dias\n";
    $summary .= "- Intensidade: moderada\n";
    $summary .= "- Fatores de melhora: repouso\n\n";
    $summary .= "**Conduta:**\n";
    $summary .= "- Orientações fornecidas\n";
    $summary .= "- Retorno agendado em 7 dias";
    
    // Salvar resumo
    $stmt = $db->prepare("
        UPDATE transcricoes SET summary = :summary WHERE id = :id AND clinica_id = :clinica_id
    ");
    $stmt->execute([
        ':summary' => $summary,
        ':id' => $transcription['id'],
        ':clinica_id' => $clinicaId
    ]);
    
    Response::success(['summary' => $summary]);

} catch (Exception $e) {
    error_log($e->getMessage());
    Response::serverError('Erro ao gerar resumo');
}