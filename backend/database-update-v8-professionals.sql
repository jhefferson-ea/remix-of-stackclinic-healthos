-- StackClinic Database Update v8 - Multi-Professional Support
-- Execute este script no banco de dados da clínica

-- =====================================================
-- 1. NOVA TABELA: profissional_procedimentos (N:N)
-- Vincula quais profissionais executam quais procedimentos
-- =====================================================
CREATE TABLE IF NOT EXISTS profissional_procedimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    procedimento_id INT NOT NULL,
    clinica_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_user_proc (usuario_id, procedimento_id),
    INDEX idx_proc (procedimento_id),
    INDEX idx_clinica (clinica_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (procedimento_id) REFERENCES procedimentos(id) ON DELETE CASCADE,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. NOVA TABELA: horario_profissional
-- Cada profissional pode ter seu próprio horário de atendimento
-- =====================================================
CREATE TABLE IF NOT EXISTS horario_profissional (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    clinica_id INT NOT NULL,
    day INT NOT NULL COMMENT '0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado',
    `open` TIME NOT NULL,
    `close` TIME NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_user_day (usuario_id, day),
    INDEX idx_clinica (clinica_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. ADICIONAR usuario_id EM AGENDAMENTOS
-- Indica qual profissional atenderá o paciente
-- NULL = agenda geral (compatibilidade com dados antigos)
-- =====================================================
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS usuario_id INT NULL AFTER clinica_id,
ADD INDEX IF NOT EXISTS idx_usuario (usuario_id);

-- Adicionar FK apenas se não existir (verificar antes para evitar erro)
-- ALTER TABLE agendamentos ADD FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- =====================================================
-- 4. ADICIONAR usuario_id EM BLOQUEIOS_AGENDA
-- Permite bloqueios individuais (férias, folgas) por profissional
-- NULL = bloqueio geral da clínica
-- =====================================================
ALTER TABLE bloqueios_agenda 
ADD COLUMN IF NOT EXISTS usuario_id INT NULL AFTER clinica_id,
ADD INDEX IF NOT EXISTS idx_usuario (usuario_id);

-- =====================================================
-- 5. ADICIONAR usuario_id EM PAGAMENTOS_PROCEDIMENTOS
-- Indica qual profissional realizou o procedimento
-- =====================================================
ALTER TABLE pagamentos_procedimentos 
ADD COLUMN IF NOT EXISTS usuario_id INT NULL AFTER clinica_id,
ADD INDEX IF NOT EXISTS idx_usuario (usuario_id);

-- =====================================================
-- 6. ADICIONAR cor NA TABELA USUARIOS (para identificação na agenda)
-- =====================================================
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT NULL COMMENT 'Cor para identificação na agenda (ex: blue, green, purple)';

-- =====================================================
-- 7. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =====================================================
-- Índice para buscar profissionais de um procedimento
CREATE INDEX IF NOT EXISTS idx_pp_proc_clinica ON profissional_procedimentos (procedimento_id, clinica_id);

-- Índice para buscar horários de um profissional
CREATE INDEX IF NOT EXISTS idx_hp_usuario_day ON horario_profissional (usuario_id, day, active);

-- =====================================================
-- NOTAS DE COMPATIBILIDADE:
-- 
-- - Agendamentos antigos terão usuario_id = NULL (agenda geral)
-- - Profissionais sem horário individual usarão horario_funcionamento da clínica
-- - Procedimentos sem vínculo são executáveis por todos os médicos
-- - Bloqueios com usuario_id = NULL afetam toda a clínica
-- =====================================================
