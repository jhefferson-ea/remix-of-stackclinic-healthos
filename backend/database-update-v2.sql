-- =====================================================
-- StackClinic Database Updates - v2.0
-- Novas tabelas para Auth, Team, Anamnese Builder, Bloqueios
-- Execute este SQL no phpMyAdmin da Hostinger
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- TABELA: bloqueios_agenda (Bloqueios de Horário)
-- =====================================================
CREATE TABLE IF NOT EXISTS `bloqueios_agenda` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `day_of_week` TINYINT NULL COMMENT '0=Domingo, 1=Segunda... (para recorrentes)',
  `specific_date` DATE NULL COMMENT 'Data específica (para não recorrentes)',
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `recurring` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bloqueio_date` (`specific_date`),
  KEY `idx_bloqueio_day` (`day_of_week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: anamnese_config (Configuração de Anamnese)
-- =====================================================
CREATE TABLE IF NOT EXISTS `anamnese_config` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinica_id` INT UNSIGNED NOT NULL,
  `enabled` TINYINT(1) DEFAULT 1,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_anamnese_clinica` (`clinica_id`),
  CONSTRAINT `fk_anamnese_config_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinica` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: anamnese_template (Perguntas de Anamnese)
-- =====================================================
CREATE TABLE IF NOT EXISTS `anamnese_template` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinica_id` INT UNSIGNED NOT NULL,
  `question` TEXT NOT NULL,
  `type` ENUM('text', 'yes_no', 'options', 'photo') DEFAULT 'text',
  `options` JSON NULL COMMENT 'Array de opções para type=options',
  `is_alert` TINYINT(1) DEFAULT 0 COMMENT 'Destacar resposta positiva em vermelho',
  `sort_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_template_clinica` (`clinica_id`),
  CONSTRAINT `fk_template_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinica` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Atualizar tabela agendamentos (adicionar campo procedure)
-- =====================================================
-- Verifica se a coluna existe antes de adicionar
SET @columnExists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'agendamentos' 
    AND COLUMN_NAME = 'procedure_name'
);

SET @addColumn = IF(@columnExists = 0, 
    'ALTER TABLE agendamentos ADD COLUMN procedure_name VARCHAR(255) NULL AFTER duration',
    'SELECT 1');

PREPARE stmt FROM @addColumn;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir configuração de anamnese padrão
INSERT IGNORE INTO `anamnese_config` (`clinica_id`, `enabled`) VALUES (1, 1);

-- Inserir perguntas de exemplo
INSERT INTO `anamnese_template` (`clinica_id`, `question`, `type`, `is_alert`, `sort_order`) VALUES 
(1, 'Qual o motivo da sua consulta?', 'text', 0, 1),
(1, 'Está tomando algum medicamento atualmente?', 'yes_no', 1, 2),
(1, 'Possui alguma alergia conhecida?', 'yes_no', 1, 3),
(1, 'Você fuma?', 'yes_no', 0, 4)
ON DUPLICATE KEY UPDATE question = VALUES(question);

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- FIM DAS ATUALIZAÇÕES
-- =====================================================
