-- =====================================================
-- StackClinic Database Updates - v2.1
-- Novas tabelas para gatilhos customizados e ajustes
-- Execute este SQL no phpMyAdmin da Hostinger
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- TABELA: gatilhos_customizados (Gatilhos de IA personalizados)
-- =====================================================
CREATE TABLE IF NOT EXISTS `gatilhos_customizados` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT 'Nome do gatilho',
  `message` TEXT NOT NULL COMMENT 'Mensagem a ser enviada',
  `trigger_type` ENUM('recurring', 'one_time', 'event_based') DEFAULT 'recurring',
  `interval_hours` INT DEFAULT 24 COMMENT 'Intervalo em horas para gatilhos recorrentes',
  `target_type` ENUM('all', 'specific_patient', 'patient_group') DEFAULT 'all',
  `target_value` VARCHAR(255) NULL COMMENT 'ID do paciente ou nome do grupo',
  `enabled` TINYINT(1) DEFAULT 1,
  `last_executed` TIMESTAMP NULL COMMENT 'Última execução',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trigger_enabled` (`enabled`),
  KEY `idx_trigger_type` (`trigger_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: galeria_paciente (Galeria de imagens do paciente)
-- =====================================================
CREATE TABLE IF NOT EXISTS `galeria_paciente` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `type` ENUM('before', 'after', 'other') DEFAULT 'before',
  `description` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_galeria_paciente` (`paciente_id`),
  CONSTRAINT `fk_galeria_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: documentos_paciente (Documentos do paciente)
-- =====================================================
CREATE TABLE IF NOT EXISTS `documentos_paciente` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `category` VARCHAR(100) DEFAULT 'outros',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_documentos_paciente` (`paciente_id`),
  CONSTRAINT `fk_documentos_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: biblioteca_arquivos (Arquivos da biblioteca)
-- =====================================================
CREATE TABLE IF NOT EXISTS `biblioteca_arquivos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `category` VARCHAR(100) DEFAULT 'Geral',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Adicionar coluna 'procedure' na tabela agendamentos se não existir
-- =====================================================
SET @columnExists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'agendamentos' 
    AND COLUMN_NAME = 'procedure'
);

SET @addColumn = IF(@columnExists = 0, 
    'ALTER TABLE agendamentos ADD COLUMN `procedure` VARCHAR(255) NULL AFTER duration',
    'SELECT 1');

PREPARE stmt FROM @addColumn;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- Adicionar coluna 'status' na tabela usuarios (para convites pendentes)
-- =====================================================
SET @columnExists2 = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'usuarios' 
    AND COLUMN_NAME = 'status'
);

SET @addColumn2 = IF(@columnExists2 = 0, 
    'ALTER TABLE usuarios ADD COLUMN `status` ENUM(''active'', ''pending'', ''inactive'') DEFAULT ''active'' AFTER active',
    'SELECT 1');

PREPARE stmt2 FROM @addColumn2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- FIM DAS ATUALIZAÇÕES v2.1
-- =====================================================