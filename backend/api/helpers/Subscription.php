<?php
/**
 * StackClinic - Subscription Helper
 * Verificação de status de assinatura
 */

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/Response.php';

class Subscription {
    
    /**
     * Verificar se clínica tem assinatura ativa
     */
    public static function checkActive($clinicId) {
        if (!$clinicId) return false;
        
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $stmt = $db->prepare("
                SELECT status FROM assinaturas 
                WHERE clinica_id = :clinica_id 
                ORDER BY created_at DESC 
                LIMIT 1
            ");
            $stmt->execute([':clinica_id' => $clinicId]);
            $subscription = $stmt->fetch();
            
            if (!$subscription) return false;
            
            return in_array($subscription['status'], ['active', 'trial']);
        } catch (Exception $e) {
            error_log("Subscription check error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Exigir assinatura ativa ou bloquear
     */
    public static function requireActive($clinicId) {
        if (!self::checkActive($clinicId)) {
            Response::forbidden('Assinatura ativa necessária para acessar este recurso');
        }
    }
    
    /**
     * Obter status completo da assinatura
     */
    public static function getStatus($clinicId) {
        if (!$clinicId) return null;
        
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $stmt = $db->prepare("
                SELECT * FROM assinaturas 
                WHERE clinica_id = :clinica_id 
                ORDER BY created_at DESC 
                LIMIT 1
            ");
            $stmt->execute([':clinica_id' => $clinicId]);
            return $stmt->fetch();
        } catch (Exception $e) {
            error_log("Subscription status error: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Criar assinatura trial para nova clínica
     */
    public static function createTrial($clinicId, $db = null) {
        try {
            if (!$db) {
                $database = new Database();
                $db = $database->getConnection();
            }
            
            $trialEnds = date('Y-m-d H:i:s', strtotime('+14 days'));
            
            $stmt = $db->prepare("
            INSERT INTO assinaturas (clinica_id, status, plan, trial_ends_at, current_period_start, current_period_end)
            VALUES (:clinica_id, 'trial', 'basic', :trial_ends, NOW(), :period_end)
            ");
            $stmt->execute([
                ':clinica_id' => $clinicId,
                ':trial_ends' => $trialEnds,
                ':period_end' => $trialEnds
            ]);
            
            return $db->lastInsertId();
        } catch (Exception $e) {
            error_log("Create trial error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Ativar assinatura (simular pagamento aprovado)
     */
    public static function activate($clinicId, $plan = 'professional') {
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $periodEnd = date('Y-m-d H:i:s', strtotime('+30 days'));
            
            // Atualizar ou criar assinatura
            $stmt = $db->prepare("
                UPDATE assinaturas 
                SET status = 'active', 
                    plan = :plan,
                    current_period_start = NOW(),
                    current_period_end = :period_end,
                    updated_at = NOW()
                WHERE clinica_id = :clinica_id
            ");
            $stmt->execute([
                ':clinica_id' => $clinicId,
                ':plan' => $plan,
                ':period_end' => $periodEnd
            ]);
            
            // Atualizar status do usuário
            $stmt2 = $db->prepare("
                UPDATE usuarios SET subscription_status = 'active' 
                WHERE clinica_id = :clinica_id
            ");
            $stmt2->execute([':clinica_id' => $clinicId]);
            
            return true;
        } catch (Exception $e) {
            error_log("Activate subscription error: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Suspender assinatura
     */
    public static function suspend($clinicId) {
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $stmt = $db->prepare("
                UPDATE assinaturas SET status = 'suspended', updated_at = NOW()
                WHERE clinica_id = :clinica_id
            ");
            $stmt->execute([':clinica_id' => $clinicId]);
            
            $stmt2 = $db->prepare("
                UPDATE usuarios SET subscription_status = 'suspended' 
                WHERE clinica_id = :clinica_id
            ");
            $stmt2->execute([':clinica_id' => $clinicId]);
            
            return true;
        } catch (Exception $e) {
            error_log("Suspend subscription error: " . $e->getMessage());
            return false;
        }
    }
}
