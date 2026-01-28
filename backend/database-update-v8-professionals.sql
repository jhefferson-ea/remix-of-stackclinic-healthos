-- StackClinic Database Update v8 - Multi-Professional Support
-- VERSÃO SIMPLIFICADA - Apenas tabelas novas
-- Execute no banco u226840309_stackclinic

-- =====================================================
-- TABELA 1: profissional_procedimentos (N:N)
-- Vincula quais profissionais executam quais procedimentos
-- =====================================================
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

-- =====================================================
-- TABELA 2: horario_profissional
-- Horário de atendimento individual de cada profissional
-- =====================================================
CREATE TABLE IF NOT EXISTS horario_profissional (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    clinica_id INT NOT NULL,
    day INT NOT NULL COMMENT '0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado',
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_user_day (usuario_id, day),
    KEY idx_clinica (clinica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
