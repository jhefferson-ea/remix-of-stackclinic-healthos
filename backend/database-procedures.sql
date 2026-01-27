-- ============================================
-- StackClinic - Script de Procedimentos
-- Versão: 1.0
-- Data: 2024
-- ============================================

-- ============================================
-- TABELA: procedimentos
-- Cadastro de serviços/procedimentos da clínica
-- ============================================

CREATE TABLE IF NOT EXISTS `procedimentos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL COMMENT 'Nome do procedimento (ex: Consulta, Retorno)',
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Preço em reais',
  `duration` INT NOT NULL DEFAULT 30 COMMENT 'Duração padrão em minutos',
  `active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Se o procedimento está ativo',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_procedimentos_active` (`active`),
  INDEX `idx_procedimentos_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ALTERAÇÃO: agendamentos
-- Adicionar coluna procedimento_id para referenciar procedimentos
-- ============================================

-- Verificar se a coluna já existe antes de adicionar
-- (Em MySQL/MariaDB, precisamos usar um procedimento ou ignorar erro)

-- Adicionar coluna procedimento_id se não existir
ALTER TABLE `agendamentos` 
ADD COLUMN IF NOT EXISTS `procedimento_id` INT UNSIGNED NULL 
AFTER `duration`;

-- Adicionar chave estrangeira (pode falhar se já existir)
-- Em caso de erro, pode ignorar
ALTER TABLE `agendamentos` 
ADD CONSTRAINT `fk_agendamento_procedimento` 
FOREIGN KEY (`procedimento_id`) REFERENCES `procedimentos` (`id`) 
ON DELETE SET NULL;

-- ============================================
-- DADOS INICIAIS (opcionais)
-- ============================================

INSERT IGNORE INTO `procedimentos` (`name`, `price`, `duration`) VALUES
('Consulta', 300.00, 30),
('Retorno', 150.00, 20),
('Avaliação', 0.00, 30),
('Limpeza', 200.00, 45),
('Procedimento Simples', 250.00, 30),
('Procedimento Complexo', 500.00, 60);
