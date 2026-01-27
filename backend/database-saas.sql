-- ============================================
-- StackClinic SaaS Multi-Tenant Migration
-- Version: 1.1.0 - Fixed Foreign Key Types
-- ============================================

-- IMPORTANTE: Converter tabelas existentes para InnoDB
-- (Foreign Keys só funcionam com InnoDB)
ALTER TABLE clinica ENGINE = InnoDB;
ALTER TABLE usuarios ENGINE = InnoDB;
ALTER TABLE pacientes ENGINE = InnoDB;
ALTER TABLE agendamentos ENGINE = InnoDB;

-- 1. Alterar tabela clinica para suportar multi-tenancy
ALTER TABLE clinica 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20),
ADD COLUMN IF NOT EXISTS owner_user_id INT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. Alterar tabela usuarios para suportar status de assinatura e vinculo com clinica
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED,
ADD COLUMN IF NOT EXISTS subscription_status ENUM('pending', 'active', 'suspended') DEFAULT 'pending';

-- 3. Criar tabela de assinaturas (INT UNSIGNED para match com clinica.id)
CREATE TABLE IF NOT EXISTS assinaturas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clinica_id INT UNSIGNED NOT NULL,
    status ENUM('trial', 'active', 'suspended', 'cancelled') DEFAULT 'trial',
    plan ENUM('basic', 'professional', 'enterprise') DEFAULT 'basic',
    trial_ends_at TIMESTAMP NULL,
    current_period_start TIMESTAMP NULL,
    current_period_end TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Criar tabela de administradores do SaaS (INT UNSIGNED para match com usuarios.id)
CREATE TABLE IF NOT EXISTS saas_admins (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    saas_role ENUM('super_admin', 'admin', 'support', 'viewer') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unique_saas_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Inserir Vinicius Castello Branco (ID 3) como Super Admin do SaaS
INSERT IGNORE INTO saas_admins (user_id, saas_role) VALUES (3, 'super_admin');

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_usuarios_clinica ON usuarios(clinica_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_subscription ON usuarios(subscription_status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_clinica ON assinaturas(clinica_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);
