-- =====================================================
-- StackClinic Database Schema
-- MariaDB / MySQL
-- Banco: u226840309_stackclinic
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- TABELA: clinica (Configurações da Clínica)
-- =====================================================
CREATE TABLE IF NOT EXISTS `clinica` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `cnpj` VARCHAR(20) NULL,
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `logo_url` VARCHAR(500) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: horario_funcionamento
-- =====================================================
CREATE TABLE IF NOT EXISTS `horario_funcionamento` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinica_id` INT UNSIGNED NOT NULL,
  `day` TINYINT NOT NULL COMMENT '0=Domingo, 1=Segunda...',
  `open` TIME NULL,
  `close` TIME NULL,
  `active` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_horario_clinica` (`clinica_id`),
  CONSTRAINT `fk_horario_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinica` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: usuarios (Profissionais/Admins)
-- =====================================================
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'doctor', 'assistant') DEFAULT 'doctor',
  `avatar` VARCHAR(500) NULL,
  `phone` VARCHAR(20) NULL,
  `active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: pacientes
-- =====================================================
CREATE TABLE IF NOT EXISTS `pacientes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(20) NOT NULL,
  `cpf` VARCHAR(14) NULL,
  `birth_date` DATE NULL,
  `address` TEXT NULL,
  `avatar` VARCHAR(500) NULL,
  `convenio` VARCHAR(100) NULL,
  `convenio_numero` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_paciente_phone` (`phone`),
  KEY `idx_paciente_cpf` (`cpf`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: anamnese
-- =====================================================
CREATE TABLE IF NOT EXISTS `anamnese` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_anamnese_paciente` (`paciente_id`),
  CONSTRAINT `fk_anamnese_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: anamnese_perguntas
-- =====================================================
CREATE TABLE IF NOT EXISTS `anamnese_perguntas` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `anamnese_id` INT UNSIGNED NOT NULL,
  `question` TEXT NOT NULL,
  `answer` TEXT NULL,
  `category` VARCHAR(100) NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pergunta_anamnese` (`anamnese_id`),
  CONSTRAINT `fk_pergunta_anamnese` FOREIGN KEY (`anamnese_id`) REFERENCES `anamnese` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: anamnese_alertas
-- =====================================================
CREATE TABLE IF NOT EXISTS `anamnese_alertas` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `anamnese_id` INT UNSIGNED NOT NULL,
  `type` ENUM('allergy', 'condition', 'medication') NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `severity` ENUM('low', 'medium', 'high') DEFAULT 'medium',
  PRIMARY KEY (`id`),
  KEY `fk_alerta_anamnese` (`anamnese_id`),
  CONSTRAINT `fk_alerta_anamnese` FOREIGN KEY (`anamnese_id`) REFERENCES `anamnese` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: agendamentos
-- =====================================================
CREATE TABLE IF NOT EXISTS `agendamentos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `usuario_id` INT UNSIGNED NULL COMMENT 'Profissional responsável',
  `date` DATE NOT NULL,
  `time` TIME NOT NULL,
  `duration` INT DEFAULT 30 COMMENT 'Duração em minutos',
  `procedure` VARCHAR(255) NULL,
  `status` ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_agendamento_date` (`date`),
  KEY `fk_agendamento_paciente` (`paciente_id`),
  KEY `fk_agendamento_usuario` (`usuario_id`),
  CONSTRAINT `fk_agendamento_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_agendamento_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: lista_espera
-- =====================================================
CREATE TABLE IF NOT EXISTS `lista_espera` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `preferred_time` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `added_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_espera_paciente` (`paciente_id`),
  CONSTRAINT `fk_espera_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: ia_sugestoes (Sugestões de IA para agenda)
-- =====================================================
CREATE TABLE IF NOT EXISTS `ia_sugestoes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` ENUM('reschedule', 'optimize', 'emergency') NOT NULL,
  `description` TEXT NOT NULL,
  `affected_appointments` JSON NULL,
  `suggested_action` TEXT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: timeline (Eventos do paciente)
-- =====================================================
CREATE TABLE IF NOT EXISTS `timeline` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `type` ENUM('appointment', 'payment', 'file', 'note') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `metadata` JSON NULL,
  `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_timeline_paciente` (`paciente_id`),
  CONSTRAINT `fk_timeline_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: galeria (Fotos antes/depois)
-- =====================================================
CREATE TABLE IF NOT EXISTS `galeria` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `type` ENUM('before', 'after') NOT NULL,
  `description` TEXT NULL,
  `date` DATE NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_galeria_paciente` (`paciente_id`),
  CONSTRAINT `fk_galeria_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: transcricoes (IA Scribe)
-- =====================================================
CREATE TABLE IF NOT EXISTS `transcricoes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `session_id` VARCHAR(100) NOT NULL,
  `audio_url` VARCHAR(500) NULL,
  `transcription` TEXT NULL,
  `summary` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_transcricao_paciente` (`paciente_id`),
  CONSTRAINT `fk_transcricao_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: ia_config (Configuração do Bot)
-- =====================================================
CREATE TABLE IF NOT EXISTS `ia_config` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinica_id` INT UNSIGNED NOT NULL,
  `personality` ENUM('nutri', 'dentista', 'psico') DEFAULT 'dentista',
  `reminder_24h` TINYINT(1) DEFAULT 1,
  `request_confirmation` TINYINT(1) DEFAULT 1,
  `auto_cancel` TINYINT(1) DEFAULT 0,
  `auto_cancel_hours` INT DEFAULT 2,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_ia_config_clinica` (`clinica_id`),
  CONSTRAINT `fk_ia_config_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinica` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: live_chats (Chats ativos WhatsApp)
-- =====================================================
CREATE TABLE IF NOT EXISTS `live_chats` (
  `id` VARCHAR(100) NOT NULL,
  `paciente_id` INT UNSIGNED NULL,
  `patient_name` VARCHAR(255) NOT NULL,
  `patient_phone` VARCHAR(20) NOT NULL,
  `last_message` TEXT NULL,
  `status` ENUM('bot', 'human') DEFAULT 'bot',
  `unread` INT DEFAULT 0,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_chat_paciente` (`paciente_id`),
  CONSTRAINT `fk_chat_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: financeiro_transacoes
-- =====================================================
CREATE TABLE IF NOT EXISTS `financeiro_transacoes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` ENUM('entrada', 'saida') NOT NULL,
  `category` VARCHAR(100) NULL,
  `description` TEXT NULL,
  `value` DECIMAL(10,2) NOT NULL,
  `date` DATE NOT NULL,
  `paciente_id` INT UNSIGNED NULL,
  `agendamento_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_transacao_date` (`date`),
  KEY `fk_transacao_paciente` (`paciente_id`),
  KEY `fk_transacao_agendamento` (`agendamento_id`),
  CONSTRAINT `fk_transacao_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_transacao_agendamento` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: recibos (Para TISS/Convênios)
-- =====================================================
CREATE TABLE IF NOT EXISTS `recibos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `procedure` VARCHAR(255) NOT NULL,
  `value` DECIMAL(10,2) NOT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('pending', 'processed', 'submitted') DEFAULT 'pending',
  `tiss_pdf_url` VARCHAR(500) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_recibo_paciente` (`paciente_id`),
  CONSTRAINT `fk_recibo_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: marketing_config
-- =====================================================
CREATE TABLE IF NOT EXISTS `marketing_config` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinica_id` INT UNSIGNED NOT NULL,
  `auto_request_review` TINYINT(1) DEFAULT 1,
  `min_rating` INT DEFAULT 4,
  `delay_hours` INT DEFAULT 2,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_marketing_clinica` (`clinica_id`),
  CONSTRAINT `fk_marketing_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinica` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: campanhas_marketing
-- =====================================================
CREATE TABLE IF NOT EXISTS `campanhas_marketing` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `sent_count` INT DEFAULT 0,
  `response_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: biblioteca_arquivos
-- =====================================================
CREATE TABLE IF NOT EXISTS `biblioteca_arquivos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `type` VARCHAR(50) NULL COMMENT 'pdf, doc, image',
  `category` VARCHAR(100) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: biblioteca_atalhos
-- =====================================================
CREATE TABLE IF NOT EXISTS `biblioteca_atalhos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `command` VARCHAR(50) NOT NULL UNIQUE,
  `file_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_atalho_arquivo` (`file_id`),
  CONSTRAINT `fk_atalho_arquivo` FOREIGN KEY (`file_id`) REFERENCES `biblioteca_arquivos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: parceiros (Programa de indicação)
-- =====================================================
CREATE TABLE IF NOT EXISTS `parceiros` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `clinica_id` INT UNSIGNED NOT NULL,
  `referral_code` VARCHAR(50) NOT NULL UNIQUE,
  `current_referrals` INT DEFAULT 0,
  `target_referrals` INT DEFAULT 5,
  `total_savings` DECIMAL(10,2) DEFAULT 0,
  `total_commission` DECIMAL(10,2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_parceiro_clinica` (`clinica_id`),
  CONSTRAINT `fk_parceiro_clinica` FOREIGN KEY (`clinica_id`) REFERENCES `clinica` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: indicacoes (Referrals)
-- =====================================================
CREATE TABLE IF NOT EXISTS `indicacoes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parceiro_id` INT UNSIGNED NOT NULL,
  `referral_name` VARCHAR(255) NULL,
  `referral_email` VARCHAR(255) NULL,
  `status` ENUM('pending', 'active', 'cancelled') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_indicacao_parceiro` (`parceiro_id`),
  CONSTRAINT `fk_indicacao_parceiro` FOREIGN KEY (`parceiro_id`) REFERENCES `parceiros` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: smart_feed (Notificações IA)
-- =====================================================
CREATE TABLE IF NOT EXISTS `smart_feed` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `type` ENUM('alert', 'birthday', 'reminder', 'opportunity', 'success') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `action` VARCHAR(255) NULL,
  `priority` ENUM('low', 'medium', 'high') DEFAULT 'medium',
  `read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: avaliacoes (Reviews internos)
-- =====================================================
CREATE TABLE IF NOT EXISTS `avaliacoes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `paciente_id` INT UNSIGNED NOT NULL,
  `agendamento_id` INT UNSIGNED NULL,
  `rating` TINYINT NOT NULL COMMENT '1-5 estrelas',
  `comment` TEXT NULL,
  `source` ENUM('internal', 'google') DEFAULT 'internal',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_avaliacao_paciente` (`paciente_id`),
  KEY `fk_avaliacao_agendamento` (`agendamento_id`),
  CONSTRAINT `fk_avaliacao_paciente` FOREIGN KEY (`paciente_id`) REFERENCES `pacientes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_avaliacao_agendamento` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir clínica padrão
INSERT INTO `clinica` (`name`, `email`, `phone`) VALUES 
('StackClinic', 'contato@stackclinic.com.br', '(11) 99999-9999');

-- Inserir configuração de IA
INSERT INTO `ia_config` (`clinica_id`, `personality`, `reminder_24h`, `request_confirmation`) VALUES 
(1, 'dentista', 1, 1);

-- Inserir configuração de Marketing
INSERT INTO `marketing_config` (`clinica_id`, `auto_request_review`, `min_rating`) VALUES 
(1, 1, 4);

-- Inserir parceiro inicial
INSERT INTO `parceiros` (`clinica_id`, `referral_code`, `target_referrals`) VALUES 
(1, 'STACKCLINIC10', 5);

-- Inserir horários de funcionamento padrão (Seg a Sex 8h-18h)
INSERT INTO `horario_funcionamento` (`clinica_id`, `day`, `open`, `close`, `active`) VALUES 
(1, 0, '08:00', '12:00', 0),
(1, 1, '08:00', '18:00', 1),
(1, 2, '08:00', '18:00', 1),
(1, 3, '08:00', '18:00', 1),
(1, 4, '08:00', '18:00', 1),
(1, 5, '08:00', '18:00', 1),
(1, 6, '08:00', '12:00', 0);

-- Inserir usuário admin
INSERT INTO `usuarios` (`name`, `email`, `password`, `role`) VALUES 
('Administrador', 'admin@stackclinic.com.br', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

SET FOREIGN_KEY_CHECKS = 1;
