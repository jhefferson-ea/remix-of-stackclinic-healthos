-- StackClinic - Database Update v6
-- WhatsApp + IA Integration (Evolution API + OpenAI)
-- Execute este script após o v5

-- =========================================
-- 1. Adicionar campos na tabela clinica
-- =========================================

-- Categoria da clínica (tipo de especialidade)
ALTER TABLE clinica
ADD COLUMN IF NOT EXISTS category ENUM('nutricionista', 'dentista', 'psicologo', 'dermatologista', 'pediatra', 'fisioterapeuta', 'oftalmologista', 'cardiologista', 'esteticista', 'outro') DEFAULT 'outro' AFTER cnpj;

-- Configurações do Bot IA
ALTER TABLE clinica
ADD COLUMN IF NOT EXISTS ai_name VARCHAR(100) DEFAULT 'Atendente Virtual' AFTER category,
ADD COLUMN IF NOT EXISTS ai_tone ENUM('formal', 'casual', 'empathetic') DEFAULT 'casual' AFTER ai_name,
ADD COLUMN IF NOT EXISTS system_prompt_custom TEXT NULL AFTER ai_tone;

-- Campos para Evolution API (WhatsApp)
ALTER TABLE clinica
ADD COLUMN IF NOT EXISTS evolution_instance_id VARCHAR(100) NULL AFTER system_prompt_custom,
ADD COLUMN IF NOT EXISTS evolution_api_key VARCHAR(255) NULL AFTER evolution_instance_id,
ADD COLUMN IF NOT EXISTS whatsapp_connected TINYINT(1) DEFAULT 0 AFTER evolution_api_key,
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20) NULL AFTER whatsapp_connected;

-- =========================================
-- 2. Criar tabela de mensagens WhatsApp
-- =========================================

CREATE TABLE IF NOT EXISTS `whatsapp_messages` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinica_id` INT UNSIGNED NOT NULL,
  `paciente_id` INT UNSIGNED NULL,
  `phone` VARCHAR(20) NOT NULL,
  `direction` ENUM('incoming', 'outgoing') NOT NULL,
  `message` TEXT NOT NULL,
  `message_type` ENUM('text', 'image', 'audio', 'document') DEFAULT 'text',
  `ai_processed` TINYINT(1) DEFAULT 0,
  `function_calls` JSON NULL COMMENT 'Tool calls realizadas pela IA',
  `tokens_used` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wpp_clinica` (`clinica_id`),
  KEY `idx_wpp_paciente` (`paciente_id`),
  KEY `idx_wpp_phone` (`phone`),
  KEY `idx_wpp_created` (`created_at`),
  FOREIGN KEY (`clinica_id`) REFERENCES `clinica` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================
-- 3. Adicionar campos de Lead na tabela pacientes
-- =========================================

ALTER TABLE pacientes
ADD COLUMN IF NOT EXISTS is_lead TINYINT(1) DEFAULT 0 AFTER notes,
ADD COLUMN IF NOT EXISTS lead_source VARCHAR(50) DEFAULT NULL AFTER is_lead;

-- =========================================
-- 4. Tabela de sessões de conversa (para contexto)
-- =========================================

CREATE TABLE IF NOT EXISTS `whatsapp_sessions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinica_id` INT UNSIGNED NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `paciente_id` INT UNSIGNED NULL,
  `context` JSON NULL COMMENT 'Contexto da conversa (procedimento selecionado, etc)',
  `status` ENUM('active', 'completed', 'transferred') DEFAULT 'active',
  `transferred_to_human` TINYINT(1) DEFAULT 0,
  `last_activity` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_session` (`clinica_id`, `phone`),
  KEY `idx_session_phone` (`phone`),
  KEY `idx_session_status` (`status`),
  FOREIGN KEY (`clinica_id`) REFERENCES `clinica` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================
-- 5. Índices para performance
-- =========================================

-- Índice para buscar mensagens recentes por telefone
CREATE INDEX IF NOT EXISTS idx_wpp_msg_phone_date ON whatsapp_messages(phone, created_at DESC);

-- Índice para buscar sessões ativas
CREATE INDEX IF NOT EXISTS idx_session_active ON whatsapp_sessions(clinica_id, status, last_activity);
