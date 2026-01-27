<?php
/**
 * StackClinic API - Professional Procedures
 * GET /api/team/{id}/procedures - List procedures for a professional
 * POST /api/team/{id}/procedures - Update procedures for a professional
 * 
 * Multi-Tenancy: Filtra por clinica_id do usuário autenticado
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';

$authUser = Auth::requireAuth();

// Only admin can manage team procedures
if ($authUser['role'] !== 'admin') {
    Response::forbidden('Acesso negado');
}

$clinicaId = $authUser['clinica_id'];

if (!$clinicaId) {
    Response::unauthorized('Usuário não vinculado a uma clínica');
}

// Extract user ID from URL: /api/team/{id}/procedures
$uri = $_SERVER['REQUEST_URI'];
preg_match('/\/api\/team\/(\d+)\/procedures/', $uri, $matches);
$userId = isset($matches[1]) ? (int)$matches[1] : null;

if (!$userId) {
    Response::badRequest('ID do profissional é obrigatório');
}

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    // Verify user belongs to this clinic and is a doctor
    $stmt = $db->prepare("SELECT id, name, role FROM usuarios WHERE id = :id AND clinica_id = :clinica_id");
    $stmt->execute([':id' => $userId, ':clinica_id' => $clinicaId]);
    $user = $stmt->fetch();

    if (!$user) {
        Response::notFound('Profissional não encontrado');
    }

    if ($method === 'GET') {
        // Get all procedures and mark which ones this professional can do
        $stmt = $db->prepare("
            SELECT p.id, p.name, p.price, p.duration,
                   CASE WHEN pp.id IS NOT NULL THEN 1 ELSE 0 END as assigned
            FROM procedimentos p
            LEFT JOIN profissional_procedimentos pp ON pp.procedimento_id = p.id AND pp.usuario_id = :usuario_id
            WHERE p.clinica_id = :clinica_id AND p.active = 1
            ORDER BY p.name
        ");
        $stmt->execute([':usuario_id' => $userId, ':clinica_id' => $clinicaId]);
        $procedures = $stmt->fetchAll();

        foreach ($procedures as &$proc) {
            $proc['id'] = (int)$proc['id'];
            $proc['price'] = (float)$proc['price'];
            $proc['duration'] = (int)$proc['duration'];
            $proc['assigned'] = (bool)$proc['assigned'];
        }

        Response::success([
            'professional' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'role' => $user['role']
            ],
            'procedures' => $procedures
        ]);

    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $procedureIds = $data['procedure_ids'] ?? [];

        if (!is_array($procedureIds)) {
            Response::badRequest('procedure_ids deve ser um array');
        }

        // Start transaction
        $db->beginTransaction();

        try {
            // Remove all current assignments for this professional
            $stmt = $db->prepare("DELETE FROM profissional_procedimentos WHERE usuario_id = :usuario_id AND clinica_id = :clinica_id");
            $stmt->execute([':usuario_id' => $userId, ':clinica_id' => $clinicaId]);

            // Add new assignments
            if (!empty($procedureIds)) {
                $stmt = $db->prepare("
                    INSERT INTO profissional_procedimentos (usuario_id, procedimento_id, clinica_id)
                    VALUES (:usuario_id, :procedimento_id, :clinica_id)
                ");

                foreach ($procedureIds as $procId) {
                    $stmt->execute([
                        ':usuario_id' => $userId,
                        ':procedimento_id' => (int)$procId,
                        ':clinica_id' => $clinicaId
                    ]);
                }
            }

            $db->commit();

            Response::success([
                'assigned_count' => count($procedureIds)
            ], 'Procedimentos atualizados com sucesso');

        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }

    } else {
        Response::methodNotAllowed();
    }

} catch (Exception $e) {
    error_log("Professional procedures error: " . $e->getMessage());
    Response::serverError('Erro ao processar procedimentos do profissional');
}
