<?php
/**
 * StackClinic - Auth Helper
 * JWT Authentication with Multi-Tenancy Support
 */

class Auth {
    private static $secret = 'stackclinic_jwt_secret_2025';

    /**
     * Gera token JWT com clinica_id para multi-tenancy
     */
    public static function generateToken($userId, $email, $role, $clinicaId = null) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'user_id' => $userId,
            'email' => $email,
            'role' => $role,
            'clinica_id' => $clinicaId, // Multi-tenancy
            'exp' => time() + (60 * 60 * 24) // 24 hours
        ]);

        $base64Header = self::base64UrlEncode($header);
        $base64Payload = self::base64UrlEncode($payload);

        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, self::$secret, true);
        $base64Signature = self::base64UrlEncode($signature);

        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }

    public static function validateToken($token) {
        $debugLogFile = __DIR__ . '/../debug.log';
        
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            file_put_contents($debugLogFile, "VALIDATE: Token nao tem 3 partes (tem " . count($parts) . ")\n", FILE_APPEND);
            return false;
        }

        list($header, $payload, $signature) = $parts;

        $validSignature = hash_hmac('sha256', $header . "." . $payload, self::$secret, true);
        $base64ValidSignature = self::base64UrlEncode($validSignature);

        if ($base64ValidSignature !== $signature) {
            file_put_contents($debugLogFile, "VALIDATE: Assinatura INVALIDA\n", FILE_APPEND);
            file_put_contents($debugLogFile, "VALIDATE: Esperado: " . $base64ValidSignature . "\n", FILE_APPEND);
            file_put_contents($debugLogFile, "VALIDATE: Recebido: " . $signature . "\n", FILE_APPEND);
            return false;
        }

        $payloadData = json_decode(self::base64UrlDecode($payload), true);

        if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
            file_put_contents($debugLogFile, "VALIDATE: Token EXPIRADO (exp=" . $payloadData['exp'] . ", now=" . time() . ")\n", FILE_APPEND);
            return false;
        }

        file_put_contents($debugLogFile, "VALIDATE: Token OK! user_id=" . ($payloadData['user_id'] ?? 'N/A') . ", clinica_id=" . ($payloadData['clinica_id'] ?? 'N/A') . "\n", FILE_APPEND);
        return $payloadData;
    }

    public static function getTokenFromHeader() {
        $authHeader = '';
        $debugLog = [];
        $logFile = __DIR__ . '/../debug.log';
        
        $debugLog[] = "=== AUTH DEBUG START ===";
        $debugLog[] = "Timestamp: " . date('Y-m-d H:i:s');
        $debugLog[] = "Request URI: " . ($_SERVER['REQUEST_URI'] ?? 'N/A');
        $debugLog[] = "Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'N/A');
        
        // Log todas as variaveis $_SERVER relacionadas a Authorization
        $debugLog[] = "--- \$_SERVER vars ---";
        $debugLog[] = "HTTP_AUTHORIZATION: " . ($_SERVER['HTTP_AUTHORIZATION'] ?? 'NOT SET');
        $debugLog[] = "REDIRECT_HTTP_AUTHORIZATION: " . ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? 'NOT SET');
        $debugLog[] = "HTTP_X_AUTH_TOKEN: " . ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? 'NOT SET');
        
        // 1. Tentar $_SERVER['HTTP_AUTHORIZATION'] (LiteSpeed/FastCGI com pass-through)
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
            $debugLog[] = "FOUND in HTTP_AUTHORIZATION";
        }
        // 2. Tentar $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] (após rewrite)
        elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
            $debugLog[] = "FOUND in REDIRECT_HTTP_AUTHORIZATION";
        }
        // 3. Tentar getallheaders() (Apache mod_php)
        elseif (function_exists('getallheaders')) {
            $headers = getallheaders();
            $debugLog[] = "--- getallheaders() ---";
            $debugLog[] = json_encode($headers);
            // Normalizar para case-insensitive
            foreach ($headers as $key => $value) {
                if (strtolower($key) === 'authorization') {
                    $authHeader = $value;
                    $debugLog[] = "FOUND in getallheaders()";
                    break;
                }
            }
        }
        // 4. Tentar apache_request_headers() como fallback
        elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $debugLog[] = "--- apache_request_headers() ---";
            $debugLog[] = json_encode($headers);
            foreach ($headers as $key => $value) {
                if (strtolower($key) === 'authorization') {
                    $authHeader = $value;
                    $debugLog[] = "FOUND in apache_request_headers()";
                    break;
                }
            }
        }
        
        // Logar resultado final
        $debugLog[] = "--- RESULTADO ---";
        $debugLog[] = "authHeader encontrado: " . ($authHeader ? 'SIM (len=' . strlen($authHeader) . ')' : 'NAO');
        if ($authHeader) {
            // Logar apenas primeiros caracteres por seguranca
            $debugLog[] = "Primeiros 20 chars: " . substr($authHeader, 0, 20) . "...";
        }
        $debugLog[] = "=== AUTH DEBUG END ===";
        
        // Escrever log em arquivo debug.log na pasta /api/
        file_put_contents($logFile, implode("\n", $debugLog) . "\n\n", FILE_APPEND);

        // Extrair token do formato "Bearer <token>"
        if (preg_match('/Bearer\s+(.*)$/i', trim($authHeader), $matches)) {
            $token = $matches[1];
            file_put_contents($logFile, "TOKEN EXTRAIDO: SIM (len=" . strlen($token) . ")\n", FILE_APPEND);
            file_put_contents($logFile, "TOKEN (primeiros 50 chars): " . substr($token, 0, 50) . "...\n\n", FILE_APPEND);
            return $token;
        }
        
        // 5. FALLBACK: Tentar X-Auth-Token (header alternativo que nao e removido pelo servidor)
        file_put_contents($logFile, "=== TENTANDO X-Auth-Token FALLBACK ===\n", FILE_APPEND);
        
        $xAuthToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? null;
        file_put_contents($logFile, "HTTP_X_AUTH_TOKEN via \$_SERVER: " . ($xAuthToken ? "SIM (len=" . strlen($xAuthToken) . ")" : "NAO") . "\n", FILE_APPEND);
        
        // Tenta tambem via getallheaders (case-insensitive)
        if (!$xAuthToken && function_exists('getallheaders')) {
            $headers = getallheaders();
            file_put_contents($logFile, "Buscando x-auth-token em getallheaders()...\n", FILE_APPEND);
            foreach ($headers as $key => $value) {
                $keyLower = strtolower($key);
                if ($keyLower === 'x-auth-token') {
                    $xAuthToken = $value;
                    file_put_contents($logFile, "ENCONTRADO X-Auth-Token via getallheaders! (key={$key})\n", FILE_APPEND);
                    break;
                }
            }
        }
        
        // Tenta via REDIRECT_HTTP_X_AUTH_TOKEN (caso Apache redirecione)
        if (!$xAuthToken && isset($_SERVER['REDIRECT_HTTP_X_AUTH_TOKEN'])) {
            $xAuthToken = $_SERVER['REDIRECT_HTTP_X_AUTH_TOKEN'];
            file_put_contents($logFile, "ENCONTRADO via REDIRECT_HTTP_X_AUTH_TOKEN!\n", FILE_APPEND);
        }
        
        if ($xAuthToken) {
            file_put_contents($logFile, "TOKEN EXTRAIDO VIA X-Auth-Token: SIM (len=" . strlen($xAuthToken) . ")\n\n", FILE_APPEND);
            return $xAuthToken;
        }

        file_put_contents($logFile, "TOKEN EXTRAIDO: NAO (regex falhou e X-Auth-Token nao presente)\n", FILE_APPEND);
        file_put_contents($logFile, "authHeader para regex: '" . $authHeader . "'\n\n", FILE_APPEND);
        return null;
    }

    public static function requireAuth() {
        $debugLogFile = __DIR__ . '/../debug.log';
        
        $token = self::getTokenFromHeader();
        
        if (!$token) {
            file_put_contents($debugLogFile, "REQUIRE_AUTH: Token e NULL - retornando 401\n\n", FILE_APPEND);
            Response::unauthorized('Token não fornecido');
        }

        file_put_contents($debugLogFile, "REQUIRE_AUTH: Token presente, validando...\n", FILE_APPEND);
        
        $payload = self::validateToken($token);
        
        if (!$payload) {
            file_put_contents($debugLogFile, "REQUIRE_AUTH: Validacao FALHOU - retornando 401\n\n", FILE_APPEND);
            Response::unauthorized('Token inválido ou expirado');
        }

        file_put_contents($debugLogFile, "REQUIRE_AUTH: Token VALIDO! clinica_id=" . ($payload['clinica_id'] ?? 'N/A') . "\n\n", FILE_APPEND);
        
        return $payload;
    }

    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }
}
