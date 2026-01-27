<?php
/**
 * StackClinic API - WhatsApp Config
 * GET /api/config/whatsapp - Status da conexão
 * POST /api/config/whatsapp - Inicia conexão (gera QR)
 * DELETE /api/config/whatsapp - Desconecta
 */

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../helpers/Response.php';
require_once __DIR__ . '/../helpers/Auth.php';
require_once __DIR__ . '/../helpers/Tenant.php';
require_once __DIR__ . '/../services/EvolutionService.php';

// Log de entrada para debug - salva em arquivo acessível
$debugLogFile = __DIR__ . '/../debug.log';
file_put_contents($debugLogFile, "=== WHATSAPP.PHP LOADED === " . date('Y-m-d H:i:s') . " | Method: " . $_SERVER['REQUEST_METHOD'] . " | URI: " . $_SERVER['REQUEST_URI'] . "\n", FILE_APPEND);

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

$clinicaId = Tenant::getClinicId();

try {
    // Busca dados da clínica
    $stmt = $db->prepare("
        SELECT id, name, evolution_instance_id, evolution_api_key, whatsapp_connected, whatsapp_phone,
               ai_name, ai_tone, system_prompt_custom
        FROM clinica WHERE id = :id
    ");
    $stmt->execute([':id' => $clinicaId]);
    $clinica = $stmt->fetch();
    
    if (!$clinica) {
        Response::notFound('Clínica não encontrada');
    }
    
    $evolution = new EvolutionService(
        $clinica['evolution_instance_id'], 
        $clinica['evolution_api_key']
    );
    
    if ($method === 'GET') {
        // Retorna status atual
        $status = [
            'connected' => (bool) $clinica['whatsapp_connected'],
            'phone' => $clinica['whatsapp_phone'],
            'instance_id' => $clinica['evolution_instance_id'],
            'ai_name' => $clinica['ai_name'],
            'ai_tone' => $clinica['ai_tone'],
            'system_prompt_custom' => $clinica['system_prompt_custom']
        ];
        
        // Se tem instância, verifica status real
        if ($clinica['evolution_instance_id']) {
            $connectionStatus = $evolution->getConnectionStatus();
            if ($connectionStatus['success']) {
                $status['connected'] = $connectionStatus['connected'];
                $status['state'] = $connectionStatus['state'];
                
                // Atualiza no banco se mudou
                if ($connectionStatus['connected'] !== (bool) $clinica['whatsapp_connected']) {
                    $stmt = $db->prepare("
                        UPDATE clinica 
                        SET whatsapp_connected = :connected, whatsapp_phone = :phone
                        WHERE id = :id
                    ");
                    $stmt->execute([
                        ':connected' => $connectionStatus['connected'] ? 1 : 0,
                        ':phone' => $connectionStatus['phone'],
                        ':id' => $clinicaId
                    ]);
                }
            }
        }

        // Opcional: incluir QR/pairingCode (para polling no frontend)
        if (!$status['connected'] && isset($_GET['include_qr']) && $_GET['include_qr'] == '1' && $clinica['evolution_instance_id']) {
            $qrSnap = $evolution->connectOnce();
            if (($qrSnap['success'] ?? false) && (!empty($qrSnap['qrcode']) || !empty($qrSnap['pairingCode']))) {
                $status['qrcode'] = $qrSnap['qrcode'] ?? null;
                $status['pairingCode'] = $qrSnap['pairingCode'] ?? null;
            }
        }
        
        Response::success($status);
        
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Verifica se é para atualizar configurações de IA
        if (isset($data['ai_name']) || isset($data['ai_tone']) || isset($data['system_prompt_custom'])) {
            $updates = [];
            $params = [':id' => $clinicaId];
            
            if (isset($data['ai_name'])) {
                $updates[] = 'ai_name = :ai_name';
                $params[':ai_name'] = $data['ai_name'];
            }
            if (isset($data['ai_tone'])) {
                $updates[] = 'ai_tone = :ai_tone';
                $params[':ai_tone'] = $data['ai_tone'];
            }
            if (isset($data['system_prompt_custom'])) {
                $updates[] = 'system_prompt_custom = :system_prompt_custom';
                $params[':system_prompt_custom'] = $data['system_prompt_custom'];
            }
            
            if (!empty($updates)) {
                $sql = "UPDATE clinica SET " . implode(', ', $updates) . " WHERE id = :id";
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
            }
            
            Response::success(['updated' => true], 'Configurações atualizadas');
        }
        
        // Se tem instância salva, verificar se ainda existe na Evolution API
        if ($clinica['evolution_instance_id']) {
            $exists = $evolution->instanceExists();
            
            if (!$exists) {
                // Instância não existe mais (404), limpar do banco
                file_put_contents($debugLogFile, "WHATSAPP.PHP: Instância {$clinica['evolution_instance_id']} não existe mais, limpando banco...\n", FILE_APPEND);
                
                $stmt = $db->prepare("
                    UPDATE clinica 
                    SET evolution_instance_id = NULL, 
                        whatsapp_connected = 0, 
                        whatsapp_phone = NULL
                    WHERE id = :id
                ");
                $stmt->execute([':id' => $clinicaId]);
                
                // Atualizar variável local para seguir fluxo de criar nova instância
                $clinica['evolution_instance_id'] = null;
            }
        }
        
        // Se não tem instância, cria uma nova
        if (!$clinica['evolution_instance_id']) {
            $createResult = $evolution->createInstance($clinicaId, $clinica['name']);
            
            if (!$createResult['success']) {
                Response::serverError('Falha ao criar instância: ' . ($createResult['error'] ?? 'Erro desconhecido'));
            }
            
            // Salva apenas instance_id (api_key é global via .htaccess)
            $stmt = $db->prepare("
                UPDATE clinica 
                SET evolution_instance_id = :instance_id
                WHERE id = :id
            ");
            $stmt->execute([
                ':instance_id' => $createResult['instance_id'],
                ':id' => $clinicaId
            ]);
            
            // Atualiza para usar nova instância
            $evolution->setInstance($createResult['instance_id'], $createResult['api_key']);
            
            // Configura webhook
            $webhookUrl = 'https://stackclinic.stacklabz.io/api/webhook/whatsapp';
            $evolution->setWebhook($webhookUrl);
            
            // Snapshot rápido (sem polling) — o frontend faz polling via GET include_qr=1
            $phone = is_array($data) ? ($data['phone'] ?? null) : null;
            $qrSnap = $evolution->connectOnce($phone);

            Response::success([
                'instance_id' => $createResult['instance_id'],
                'qrcode' => $qrSnap['qrcode'] ?? null,
                'pairingCode' => $qrSnap['pairingCode'] ?? null,
                'pending' => empty($qrSnap['qrcode']) && empty($qrSnap['pairingCode']),
                'message' => empty($qrSnap['qrcode']) && empty($qrSnap['pairingCode'])
                    ? 'Instância iniciando. Aguarde alguns segundos e tente novamente.'
                    : 'Escaneie o QR Code (ou use o código de pareamento) para conectar'
            ]);
        }
        
        // Se já tem instância: tentativa rápida (sem polling).
        $phone = is_array($data) ? ($data['phone'] ?? null) : null;
        $qrSnap = $evolution->connectOnce($phone);

        // Se já está conectado, devolve isso ao invés de QR
        $status = $evolution->getConnectionStatus();
        if (($status['connected'] ?? false) === true) {
            Response::success([
                'connected' => true,
                'phone' => $status['phone'],
                'message' => 'WhatsApp já está conectado'
            ]);
        }

        Response::success([
            'qrcode' => $qrSnap['qrcode'] ?? null,
            'pairingCode' => $qrSnap['pairingCode'] ?? null,
            'pending' => empty($qrSnap['qrcode']) && empty($qrSnap['pairingCode']),
            'message' => empty($qrSnap['qrcode']) && empty($qrSnap['pairingCode'])
                ? 'Instância iniciando. Aguarde alguns segundos e clique em Atualizar.'
                : 'Escaneie o QR Code (ou use o código de pareamento) para conectar'
        ]);
        
    } elseif ($method === 'DELETE') {
        // Desconecta
        if ($clinica['evolution_instance_id']) {
            $evolution->disconnect();
        }
        
        // Atualiza banco
        $stmt = $db->prepare("
            UPDATE clinica 
            SET whatsapp_connected = 0, whatsapp_phone = NULL
            WHERE id = :id
        ");
        $stmt->execute([':id' => $clinicaId]);
        
        Response::success(['disconnected' => true], 'WhatsApp desconectado');
        
    } else {
        Response::methodNotAllowed();
    }

} catch (Exception $e) {
    error_log("WhatsApp Config Error: " . $e->getMessage());
    Response::serverError('Erro ao processar configuração do WhatsApp');
}
