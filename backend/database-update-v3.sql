-- StackClinic Database Update v3
-- Adiciona suporte a pagamentos de procedimentos

-- Adicionar coluna de status de pagamento na tabela agendamentos (se não existir)
ALTER TABLE `agendamentos` 
ADD COLUMN IF NOT EXISTS `payment_status` ENUM('a_receber', 'pendente', 'pago') DEFAULT 'a_receber' AFTER `status`;

-- Adicionar coluna procedimento_id (se não existir)
ALTER TABLE `agendamentos` 
ADD COLUMN IF NOT EXISTS `procedimento_id` INT UNSIGNED NULL AFTER `payment_status`;

-- Criar tabela para registrar pagamentos de procedimentos
CREATE TABLE IF NOT EXISTS `pagamentos_procedimentos` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `agendamento_id` INT NOT NULL,
  `procedimento_id` INT UNSIGNED NULL,
  `patient_id` INT NOT NULL,
  `patient_name` VARCHAR(255),
  `procedure_name` VARCHAR(255),
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('a_receber', 'pendente', 'pago') DEFAULT 'a_receber',
  `payment_date` TIMESTAMP NULL,
  `appointment_date` DATE NOT NULL,
  `appointment_time` TIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agendamento` (`agendamento_id`),
  INDEX `idx_patient` (`patient_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_appointment_date` (`appointment_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Criar índice para foreign key (se não existir - ignorar erro se já existe)
-- ALTER TABLE `pagamentos_procedimentos` ADD CONSTRAINT `fk_pagamento_agendamento` FOREIGN KEY (`agendamento_id`) REFERENCES `agendamentos`(`id`) ON DELETE CASCADE;
