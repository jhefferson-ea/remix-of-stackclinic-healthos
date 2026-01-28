-- StackClinic Database Update v8 - Multi-Professional Support
-- Execute no banco u226840309_stackclinic

-- StackClinic Database Update v8 - Multi-Professional Support
-- Execute no banco u226840309_stackclinic

-- 1. Adicionar coluna last_login para rastrear primeiro acesso
ALTER TABLE usuarios ADD COLUMN last_login TIMESTAMP NULL;

-- 2. Tabela de procedimentos por profissional (N:N)
CREATE TABLE IF NOT EXISTS profissional_procedimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    procedimento_id INT NOT NULL,
    clinica_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_user_proc (usuario_id, procedimento_id),
    KEY idx_proc (procedimento_id),
    KEY idx_clinica (clinica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabela de horários individuais por profissional
CREATE TABLE IF NOT EXISTS horario_profissional (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    clinica_id INT NOT NULL,
    day INT NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_user_day (usuario_id, day),
    KEY idx_clinica (clinica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
