<?php
/**
 * StackClinic - Tenant Helper
 * Multi-Tenancy: Isola dados por clínica
 */

require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/Response.php';

class Tenant {
    /**
     * Obtém o clinica_id do usuário autenticado
     * Retorna o ID da clínica ou termina a requisição com erro
     */
    public static function getClinicId() {
        $auth = Auth::requireAuth();
        
        if (!isset($auth['clinica_id']) || !$auth['clinica_id']) {
            Response::unauthorized('Usuário não vinculado a uma clínica');
            exit;
        }
        
        return (int) $auth['clinica_id'];
    }

    /**
     * Obtém o clinica_id sem exigir autenticação (para endpoints públicos)
     * Retorna null se não autenticado
     */
    public static function getClinicIdOptional() {
        $token = Auth::getTokenFromHeader();
        
        if (!$token) {
            return null;
        }

        $payload = Auth::validateToken($token);
        
        if (!$payload || !isset($payload['clinica_id'])) {
            return null;
        }
        
        return (int) $payload['clinica_id'];
    }

    /**
     * Obtém os dados completos do usuário autenticado
     */
    public static function getAuthUser() {
        return Auth::requireAuth();
    }

    /**
     * Verifica se o usuário tem permissão para acessar dados de uma clínica específica
     */
    public static function canAccessClinic($targetClinicId) {
        $clinicId = self::getClinicId();
        return $clinicId === (int) $targetClinicId;
    }

    /**
     * Adiciona filtro de clínica a uma query SQL
     * Uso: $sql = Tenant::addClinicFilter($sql, 'p');
     * Transforma "SELECT * FROM pacientes p" em "SELECT * FROM pacientes p WHERE p.clinica_id = :clinica_id"
     */
    public static function addClinicFilter($sql, $tableAlias = '') {
        $prefix = $tableAlias ? "{$tableAlias}." : '';
        $clinicaFilter = "{$prefix}clinica_id = :clinica_id";
        
        // Verifica se já tem WHERE na query
        if (stripos($sql, 'WHERE') !== false) {
            // Adiciona com AND
            return preg_replace('/WHERE/i', "WHERE {$clinicaFilter} AND", $sql, 1);
        } else {
            // Adiciona WHERE antes de ORDER BY, LIMIT, GROUP BY, ou no final
            if (preg_match('/\b(ORDER BY|LIMIT|GROUP BY)\b/i', $sql, $matches, PREG_OFFSET_MATCH)) {
                $position = $matches[0][1];
                return substr($sql, 0, $position) . " WHERE {$clinicaFilter} " . substr($sql, $position);
            } else {
                return $sql . " WHERE {$clinicaFilter}";
            }
        }
    }

    /**
     * Retorna array de parâmetros com clinica_id incluído
     */
    public static function withClinicId($params = []) {
        $params[':clinica_id'] = self::getClinicId();
        return $params;
    }
}
