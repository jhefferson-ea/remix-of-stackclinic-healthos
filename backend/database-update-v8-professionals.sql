-- StackClinic Database Update v8 - Multi-Professional Support
-- Execute este script no banco de dados da clínica
-- IMPORTANTE: Execute cada seção separadamente se houver erros

-- =====================================================
-- 1. ADICIONAR COLUNAS NAS TABELAS EXISTENTES PRIMEIRO
-- (Fazer isso antes de criar as novas tabelas)
-- =====================================================

-- Adicionar cor na tabela usuarios (para identificação na agenda)
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT NULL COMMENT 'Cor para identificação na agenda (ex: blue, green, purple)';

-- Adicionar usuario_id em agendamentos
ALTER TABLE agendamentos 
ADD COLUMN IF NOT EXISTS usuario_id INT NULL AFTER clinica_id;

-- Adicionar índice para usuario_id em agendamentos (ignorar se já existir)
-- CREATE INDEX idx_agendamentos_usuario ON agendamentos (usuario_id);

-- Adicionar usuario_id em bloqueios_agenda
ALTER TABLE bloqueios_agenda 
ADD COLUMN IF NOT EXISTS usuario_id INT NULL AFTER clinica_id;

-- Adicionar usuario_id em pagamentos_procedimentos
ALTER TABLE pagamentos_procedimentos 
ADD COLUMN IF NOT EXISTS usuario_id INT NULL AFTER clinica_id;

-- =====================================================
-- 2. NOVA TABELA: profissional_procedimentos (N:N)
-- Vincula quais profissionais executam quais procedimentos
-- NOTA: Criamos SEM foreign keys primeiro, depois adicionamos
-- =====================================================
CREATE TABLE IF NOT EXISTS profissional_procedimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    procedimento_id INT NOT NULL,
    clinica_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_user_proc (usuario_id, procedimento_id),
    INDEX idx_proc (procedimento_id),
    INDEX idx_clinica (clinica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. NOVA TABELA: horario_profissional
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
    INDEX idx_clinica (clinica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. ÍNDICES ADICIONAIS PARA PERFORMANCE
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
-- - Foreign Keys foram REMOVIDAS para evitar problemas de compatibilidade
--   A integridade referencial é mantida pela aplicação
-- =====================================================
