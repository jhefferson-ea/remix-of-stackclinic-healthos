<?php
/**
 * StackClinic - Evolution API Service
 * Integração com WhatsApp via Evolution API
 */

class EvolutionService {
    private $apiUrl;
    private $apiKey;
    private $instanceId;

    /**
     * Extrai o QR code de respostas variadas da Evolution (v1/v2 e formatos aninhados).
     */
    private function extractQrFromResponse($resp) {
        if (!$resp || !is_array($resp)) return null;

        // v2 (algumas builds retornam direto)
        if (!empty($resp['code'])) return $resp['code'];

        // v1/legado
        if (!empty($resp['base64'])) return $resp['base64'];

        // v2 pode aninhar em qrcode
        if (isset($resp['qrcode']) && is_array($resp['qrcode'])) {
            if (!empty($resp['qrcode']['code'])) return $resp['qrcode']['code'];
            if (!empty($resp['qrcode']['base64'])) return $resp['qrcode']['base64'];
        }

        // algumas versões embrulham em response
        if (isset($resp['response']) && is_array($resp['response'])) {
            if (!empty($resp['response']['code'])) return $resp['response']['code'];
            if (!empty($resp['response']['base64'])) return $resp['response']['base64'];
            if (isset($resp['response']['qrcode']) && is_array($resp['response']['qrcode'])) {
                if (!empty($resp['response']['qrcode']['code'])) return $resp['response']['qrcode']['code'];
                if (!empty($resp['response']['qrcode']['base64'])) return $resp['response']['qrcode']['base64'];
            }
        }

        return null;
    }
    
    public function __construct($instanceId = null, $apiKey = null) {
        // URL base da Evolution API (configurável por ambiente)
        $this->apiUrl = getenv('EVOLUTION_API_URL') ?: 'https://evolution.stacklabz.io';
        $this->instanceId = $instanceId;
        // Chave global - ignora apiKey por instância, usa variável de ambiente
        $this->apiKey = getenv('EVOLUTION_API_KEY') ?: 'stackclinic123';
    }
    
    /**
     * Define a instância e API key para uma clínica específica
     */
    public function setInstance($instanceId, $apiKey) {
        $this->instanceId = $instanceId;
        $this->apiKey = $apiKey;
    }
    
    /**
     * Cria uma nova instância para a clínica
     */
    public function createInstance($clinicId, $clinicName, $instanceName = null) {
        // Mantém compatibilidade: se não vier nome, usa padrão antigo.
        // Para fluxos de “recriar instância”, podemos passar um nome único.
        $instanceName = $instanceName ?: ('stackclinic_' . $clinicId);
        
        $response = $this->makeRequest('/instance/create', 'POST', [
            'instanceName' => $instanceName,
            'qrcode' => true,
            'integration' => 'WHATSAPP-BAILEYS'
        ]);
        
        if ($response && isset($response['instance'])) {
            return [
                'success' => true,
                'instance_id' => $response['instance']['instanceName'],
                'api_key' => $this->apiKey, // Usa chave global
                'qrcode' => $this->extractQrFromResponse($response)
            ];
        }
        
        return ['success' => false, 'error' => 'Falha ao criar instância'];
    }

    /**
     * Deleta a instância (fallback extremo quando fica presa em connecting)
     */
    public function deleteInstance() {
        $debugLogFile = __DIR__ . '/../debug.log';
        file_put_contents($debugLogFile, "DELETE_INSTANCE: instanceId=" . ($this->instanceId ?: 'NULL') . "\n", FILE_APPEND);

        if (!$this->instanceId) {
            return ['success' => false, 'error' => 'Instância não configurada'];
        }

        // DELETE /instance/delete/{instanceName}
        $response = $this->makeRequest("/instance/delete/{$this->instanceId}", 'DELETE');
        file_put_contents($debugLogFile, "DELETE_INSTANCE: Response = " . json_encode($response) . "\n", FILE_APPEND);

        // Mesmo se a API não retornar JSON (algumas versões retornam vazio), tratamos como sucesso
        // quando não houve erro de cURL e HTTP é 2xx (makeRequest já retornaria null fora de 2xx).
        return ['success' => $response !== null];
    }
    
    /**
     * Faz logout da instância para resetar sessão presa
     */
    public function logoutInstance() {
        $debugLogFile = __DIR__ . '/../debug.log';
        file_put_contents($debugLogFile, "LOGOUT_INSTANCE: instanceId=" . ($this->instanceId ?: 'NULL') . "\n", FILE_APPEND);
        
        if (!$this->instanceId) {
            return ['success' => false, 'error' => 'Instância não configurada'];
        }
        
        // DELETE /instance/logout/{instanceName} - desconecta sessao do WhatsApp
        $response = $this->makeRequest("/instance/logout/{$this->instanceId}", 'DELETE');
        file_put_contents($debugLogFile, "LOGOUT_INSTANCE: Response = " . json_encode($response) . "\n", FILE_APPEND);
        
        return ['success' => true];
    }
    
    /**
     * Gera QR Code para conexão
     */
    public function generateQRCode() {
        $debugLogFile = __DIR__ . '/../debug.log';
        file_put_contents($debugLogFile, "\nGENERATE_QRCODE: instanceId=" . ($this->instanceId ?: 'NULL') . "\n", FILE_APPEND);
        
        if (!$this->instanceId) {
            file_put_contents($debugLogFile, "GENERATE_QRCODE: ERRO - Instancia nao configurada\n", FILE_APPEND);
            return ['success' => false, 'error' => 'Instância não configurada'];
        }
        
        // A Evolution pode levar vários segundos para disponibilizar o QR após criar/logar.
        // Se fizermos logout/deleção cedo demais, ela nunca chega a gerar o QR.
        $extractQr = function ($resp) {
            return $this->extractQrFromResponse($resp);
        };

        $pollConnect = function ($label, $maxSeconds, $sleepSeconds) use ($debugLogFile, $extractQr) {
            $started = time();
            $attempt = 0;
            $last = null;
            while ((time() - $started) < $maxSeconds) {
                $attempt++;
                $resp = $this->makeRequest("/instance/connect/{$this->instanceId}", 'GET');
                $last = $resp;
                file_put_contents(
                    $debugLogFile,
                    "GENERATE_QRCODE: {$label} tentativa #{$attempt}: " . json_encode($resp) . "\n",
                    FILE_APPEND
                );

                $qr = $extractQr($resp);
                if ($qr) {
                    return [
                        'success' => true,
                        'qrcode' => $qr,
                        'pairingCode' => $resp['pairingCode'] ?? null,
                        'count' => $resp['count'] ?? null
                    ];
                }

                // Se ainda não tem QR, aguarda e tenta novamente
                sleep($sleepSeconds);
            }

            return [
                'success' => false,
                'error' => 'QR ainda não disponível',
                'last' => $last
            ];
        };

        // 1) Primeiro polling (mantém abaixo de timeouts comuns de PHP)
        $result = $pollConnect('poll', 14, 2);
        if ($result['success']) {
            return $result;
        }

        // 2) Se ainda não apareceu, tenta logout e mais uma rodada curta de polling
        file_put_contents($debugLogFile, "GENERATE_QRCODE: polling expirou; tentando logout e novo polling...\n", FILE_APPEND);
        $this->logoutInstance();
        sleep(4);

        $result2 = $pollConnect('pos-logout', 10, 2);
        if ($result2['success']) {
            return $result2;
        }

        return ['success' => false, 'error' => 'Falha ao gerar QR Code'];
    }

    /**
     * Faz uma tentativa única de obter QR/pairingCode.
     * Útil para endpoints que vão fazer polling no frontend (evita timeouts no PHP).
     * Se a instância estiver presa (count=0), faz logout e tenta novamente.
     */
    public function connectOnce($phone = null) {
        $debugLogFile = __DIR__ . '/../debug.log';
        file_put_contents($debugLogFile, "CONNECT_ONCE: instanceId=" . ($this->instanceId ?: 'NULL') . " | phone=" . ($phone ?: 'NULL') . "\n", FILE_APPEND);

        if (!$this->instanceId) {
            return ['success' => false, 'error' => 'Instância não configurada'];
        }

        $endpoint = "/instance/connect/{$this->instanceId}";

        // Evolution v2: para retornar pairingCode, pode exigir ?number=55...
        if ($phone) {
            $formattedPhone = $this->formatPhone($phone);
            $endpoint .= '?number=' . urlencode($formattedPhone);
        }

        // 1) Tentativa padrão (GET)
        $resp = $this->makeRequest($endpoint, 'GET');
        file_put_contents($debugLogFile, "CONNECT_ONCE: GET Response = " . json_encode($resp) . "\n", FILE_APPEND);

        if (!$resp) {
            return ['success' => false, 'error' => 'Falha ao consultar conexão'];
        }

        $qrcode = $this->extractQrFromResponse($resp);
        $pairing = $resp['pairingCode'] ?? null;

        // 2) Se vier count=0 (instância presa), faz logout para resetar e tenta novamente
        if (empty($qrcode) && empty($pairing) && isset($resp['count']) && (int)$resp['count'] === 0) {
            file_put_contents($debugLogFile, "CONNECT_ONCE: count=0 detectado, fazendo logout para resetar...\n", FILE_APPEND);
            
            // Faz logout para resetar a sessão presa
            $this->logoutInstance();
            
            // Aguarda 3 segundos para o logout processar
            sleep(3);
            
            // Tenta novamente gerar QR após logout
            $resp = $this->makeRequest($endpoint, 'GET');
            file_put_contents($debugLogFile, "CONNECT_ONCE: Response após logout = " . json_encode($resp) . "\n", FILE_APPEND);
            
            if ($resp) {
                $qrcode = $this->extractQrFromResponse($resp);
                $pairing = $resp['pairingCode'] ?? null;
            }
            
            // Se ainda não tiver QR, tenta POST como fallback
            if (empty($qrcode) && empty($pairing)) {
                $postResp = $this->makeRequest($endpoint, 'POST', []);
                file_put_contents($debugLogFile, "CONNECT_ONCE: POST Response após logout = " . json_encode($postResp) . "\n", FILE_APPEND);

                if ($postResp) {
                    $qrcode = $qrcode ?: $this->extractQrFromResponse($postResp);
                    $pairing = $pairing ?: ($postResp['pairingCode'] ?? null);
                    $resp = $postResp;
                }
            }
        }

        return [
            'success' => true,
            'qrcode' => $qrcode,
            'pairingCode' => $pairing,
            'count' => $resp['count'] ?? null,
        ];
    }
    
    /**
     * Verifica se a instância existe na Evolution API
     * Retorna false se a API retornar 404 (instância não existe)
     */
    public function instanceExists() {
        if (!$this->instanceId) {
            return false;
        }
        
        $response = $this->makeRequest("/instance/connectionState/{$this->instanceId}", 'GET');
        
        // Se retornou null, a instância não existe (404 ou erro)
        return $response !== null;
    }
    
    /**
     * Verifica status da conexão
     */
    public function getConnectionStatus() {
        if (!$this->instanceId) {
            return ['success' => false, 'connected' => false, 'error' => 'Instância não configurada'];
        }
        
        $response = $this->makeRequest("/instance/connectionState/{$this->instanceId}", 'GET');
        
        if ($response) {
            $connected = ($response['instance']['state'] ?? '') === 'open';
            return [
                'success' => true,
                'connected' => $connected,
                'state' => $response['instance']['state'] ?? 'unknown',
                'phone' => $response['instance']['phoneNumber'] ?? null
            ];
        }
        
        return ['success' => false, 'connected' => false];
    }
    
    /**
     * Envia mensagem de texto
     */
    public function sendTextMessage($phone, $text) {
        if (!$this->instanceId) {
            return ['success' => false, 'error' => 'Instância não configurada'];
        }
        
        // Formatar número para WhatsApp
        $formattedPhone = $this->formatPhone($phone);
        
        $response = $this->makeRequest("/message/sendText/{$this->instanceId}", 'POST', [
            'number' => $formattedPhone,
            'text' => $text
        ]);
        
        if ($response && isset($response['key'])) {
            return [
                'success' => true,
                'message_id' => $response['key']['id'] ?? null
            ];
        }
        
        return ['success' => false, 'error' => 'Falha ao enviar mensagem'];
    }
    
    /**
     * Desconecta a instância
     */
    public function disconnect() {
        if (!$this->instanceId) {
            return ['success' => false, 'error' => 'Instância não configurada'];
        }
        
        $response = $this->makeRequest("/instance/logout/{$this->instanceId}", 'DELETE');
        
        return ['success' => true];
    }
    
    /**
     * Configura webhook para receber mensagens
     */
    public function setWebhook($webhookUrl) {
        if (!$this->instanceId) {
            return ['success' => false, 'error' => 'Instância não configurada'];
        }
        
        $response = $this->makeRequest("/webhook/set/{$this->instanceId}", 'POST', [
            'webhook' => [
                'enabled' => true,
                'url' => $webhookUrl,
                'webhookByEvents' => false,
                'events' => ['MESSAGES_UPSERT']
            ]
        ]);
        
        return ['success' => true];
    }
    
    /**
     * Formata número de telefone para padrão WhatsApp
     */
    private function formatPhone($phone) {
        // Remove caracteres não numéricos
        $phone = preg_replace('/\D/', '', $phone);
        
        // Adiciona código do país se não tiver
        if (strlen($phone) === 11) {
            $phone = '55' . $phone;
        } elseif (strlen($phone) === 10) {
            $phone = '55' . $phone;
        }
        
        return $phone;
    }
    
    /**
     * Faz requisição para a Evolution API
     */
    private function makeRequest($endpoint, $method = 'GET', $data = null) {
        $debugLogFile = __DIR__ . '/../debug.log';
        $url = $this->apiUrl . $endpoint;
        
        // LOG: Inicio da requisicao
        file_put_contents($debugLogFile, "\n=== EVOLUTION API REQUEST ===\n", FILE_APPEND);
        file_put_contents($debugLogFile, "Timestamp: " . date('Y-m-d H:i:s') . "\n", FILE_APPEND);
        file_put_contents($debugLogFile, "URL: " . $url . "\n", FILE_APPEND);
        file_put_contents($debugLogFile, "Method: " . $method . "\n", FILE_APPEND);
        file_put_contents($debugLogFile, "API Key: " . substr($this->apiKey ?: '', 0, 10) . "...\n", FILE_APPEND);
        file_put_contents($debugLogFile, "API URL Base: " . $this->apiUrl . "\n", FILE_APPEND);
        if ($data !== null) {
            file_put_contents($debugLogFile, "Request Data: " . json_encode($data) . "\n", FILE_APPEND);
        }
        
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json'
        ];
        
        if ($this->apiKey) {
            $headers[] = 'apikey: ' . $this->apiKey;
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        // LOG: Resultado
        file_put_contents($debugLogFile, "HTTP Code: " . $httpCode . "\n", FILE_APPEND);
        file_put_contents($debugLogFile, "cURL Error: " . ($error ?: 'nenhum') . "\n", FILE_APPEND);
        file_put_contents($debugLogFile, "Response (primeiros 500 chars): " . substr($response ?: '', 0, 500) . "\n", FILE_APPEND);
        file_put_contents($debugLogFile, "=== END EVOLUTION REQUEST ===\n\n", FILE_APPEND);
        
        if ($error) {
            error_log("Evolution API Error: " . $error);
            return null;
        }
        
        if ($httpCode >= 200 && $httpCode < 300) {
            return json_decode($response, true);
        }
        
        error_log("Evolution API HTTP Error {$httpCode}: " . $response);
        return null;
    }
}
