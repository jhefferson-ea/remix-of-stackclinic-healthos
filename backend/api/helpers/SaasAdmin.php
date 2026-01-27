<?php
/**
 * StackClinic - SaaS Admin Helper
 * Verificação de permissões de administradores do SaaS
 */

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/Response.php';

class SaasAdmin {
    
    /**
     * Verificar se usuário é admin do SaaS
     */
    public static function isSaasAdmin($userId) {
        if (!$userId) return false;
        
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $stmt = $db->prepare("SELECT saas_role FROM saas_admins WHERE user_id = :user_id LIMIT 1");
            $stmt->execute([':user_id' => $userId]);
            return $stmt->fetch() !== false;
        } catch (Exception $e) {
            error_log("SaaS admin check error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Obter role do admin SaaS
     */
    public static function getSaasRole($userId) {
        if (!$userId) return null;
        
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $stmt = $db->prepare("SELECT saas_role FROM saas_admins WHERE user_id = :user_id LIMIT 1");
            $stmt->execute([':user_id' => $userId]);
            $result = $stmt->fetch();
            
            return $result ? $result['saas_role'] : null;
        } catch (Exception $e) {
            error_log("Get SaaS role error: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Verificar se tem permissão específica
     */
    public static function hasPermission($userId, $requiredRole) {
        $userRole = self::getSaasRole($userId);
        if (!$userRole) return false;
        
        $roleHierarchy = [
            'super_admin' => 4,
            'admin' => 3,
            'support' => 2,
            'viewer' => 1
        ];
        
        $userLevel = $roleHierarchy[$userRole] ?? 0;
        $requiredLevel = $roleHierarchy[$requiredRole] ?? 0;
        
        return $userLevel >= $requiredLevel;
    }
    
    /**
     * Exigir que seja admin do SaaS
     */
    public static function requireSaasAdmin($userId, $minRole = 'viewer') {
        if (!self::hasPermission($userId, $minRole)) {
            Response::forbidden('Acesso restrito a administradores do SaaS');
        }
    }
    
    /**
     * Adicionar admin ao SaaS
     */
    public static function addAdmin($userId, $role = 'support') {
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $stmt = $db->prepare("
                INSERT INTO saas_admins (user_id, saas_role) 
                VALUES (:user_id, :role)
                ON DUPLICATE KEY UPDATE saas_role = :role
            ");
            $stmt->execute([':user_id' => $userId, ':role' => $role]);
            
            return true;
        } catch (Exception $e) {
            error_log("Add SaaS admin error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Remover admin do SaaS
     */
    public static function removeAdmin($userId) {
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $stmt = $db->prepare("DELETE FROM saas_admins WHERE user_id = :user_id");
            $stmt->execute([':user_id' => $userId]);
            
            return true;
        } catch (Exception $e) {
            error_log("Remove SaaS admin error: " . $e->getMessage());
            return false;
        }
    }
}
