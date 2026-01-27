-- =====================================================
-- StackClinic - Database Update v4.0
-- Multi-Tenancy: Adiciona clinica_id a todas as tabelas
-- =====================================================

-- 1. ADICIONAR COLUNA clinica_id ÀS TABELAS QUE NÃO TÊM
-- =====================================================

-- Tabela pacientes
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela agendamentos
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela bloqueios_agenda
ALTER TABLE bloqueios_agenda ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela financeiro_transacoes
ALTER TABLE financeiro_transacoes ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela recibos
ALTER TABLE recibos ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela timeline
ALTER TABLE timeline ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela galeria / galeria_paciente
ALTER TABLE galeria ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela transcricoes
ALTER TABLE transcricoes ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela live_chats
ALTER TABLE live_chats ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela campanhas_marketing
ALTER TABLE campanhas_marketing ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela smart_feed
ALTER TABLE smart_feed ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela avaliacoes
ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela ia_sugestoes
ALTER TABLE ia_sugestoes ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela procedimentos
ALTER TABLE procedimentos ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela pagamentos_procedimentos
ALTER TABLE pagamentos_procedimentos ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela biblioteca_arquivos
ALTER TABLE biblioteca_arquivos ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela biblioteca_atalhos / library_shortcuts
ALTER TABLE biblioteca_atalhos ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela documentos_paciente
ALTER TABLE documentos_paciente ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela anamnese_respostas
ALTER TABLE anamnese_respostas ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela anamnese_campos
ALTER TABLE anamnese_campos ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela ia_triggers
ALTER TABLE ia_triggers ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- Tabela lista_espera
ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS clinica_id INT UNSIGNED;

-- 2. ATUALIZAR DADOS EXISTENTES PARA CLINICA PADRÃO (ID = 1)
-- ===========================================================

UPDATE pacientes SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE agendamentos SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE bloqueios_agenda SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE financeiro_transacoes SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE recibos SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE timeline SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE galeria SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE transcricoes SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE live_chats SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE campanhas_marketing SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE smart_feed SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE avaliacoes SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE ia_sugestoes SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE procedimentos SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE pagamentos_procedimentos SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE biblioteca_arquivos SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE biblioteca_atalhos SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE documentos_paciente SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE anamnese_respostas SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE anamnese_campos SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE ia_triggers SET clinica_id = 1 WHERE clinica_id IS NULL;
UPDATE lista_espera SET clinica_id = 1 WHERE clinica_id IS NULL;

-- Atualizar usuários existentes para clinica_id = 1 se não tiver
UPDATE usuarios SET clinica_id = 1 WHERE clinica_id IS NULL;

-- 3. CRIAR ÍNDICES PARA PERFORMANCE
-- ==================================

-- Índices compostos para queries frequentes
CREATE INDEX IF NOT EXISTS idx_pacientes_clinica ON pacientes(clinica_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_clinica ON agendamentos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_clinica_date ON agendamentos(clinica_id, date);
CREATE INDEX IF NOT EXISTS idx_bloqueios_clinica ON bloqueios_agenda(clinica_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_clinica ON financeiro_transacoes(clinica_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_clinica_date ON financeiro_transacoes(clinica_id, date);
CREATE INDEX IF NOT EXISTS idx_procedimentos_clinica ON procedimentos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_proc_clinica ON pagamentos_procedimentos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_proc_clinica_date ON pagamentos_procedimentos(clinica_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_timeline_clinica ON timeline(clinica_id);
CREATE INDEX IF NOT EXISTS idx_smart_feed_clinica ON smart_feed(clinica_id);
CREATE INDEX IF NOT EXISTS idx_marketing_clinica ON campanhas_marketing(clinica_id);
CREATE INDEX IF NOT EXISTS idx_biblioteca_clinica ON biblioteca_arquivos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_atalhos_clinica ON biblioteca_atalhos(clinica_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_clinica ON usuarios(clinica_id);

-- 4. ADICIONAR FOREIGN KEYS (opcional - pode falhar se já existir)
-- =================================================================

-- Nota: Ignorar erros de "duplicate key" se as FKs já existirem

-- ALTER TABLE pacientes ADD CONSTRAINT fk_pacientes_clinica FOREIGN KEY (clinica_id) REFERENCES clinica(id);
-- ALTER TABLE agendamentos ADD CONSTRAINT fk_agendamentos_clinica FOREIGN KEY (clinica_id) REFERENCES clinica(id);
-- (continuar para outras tabelas se necessário)

-- 5. VERIFICAR TABELA ia_config TEM clinica_id
-- =============================================

-- ia_config já usa clinica_id, mas verificar se há registro padrão
INSERT IGNORE INTO ia_config (clinica_id, personality, reminder_24h, request_confirmation, auto_cancel, auto_cancel_hours)
VALUES (1, 'dentista', 1, 1, 0, 2);

-- 6. VERIFICAR TABELA horario_funcionamento
-- ==========================================

-- Já usa clinica_id, mas garantir que tem dados padrão
INSERT IGNORE INTO horario_funcionamento (clinica_id, day, open, close, active) VALUES
(1, 1, '08:00', '18:00', 1),
(1, 2, '08:00', '18:00', 1),
(1, 3, '08:00', '18:00', 1),
(1, 4, '08:00', '18:00', 1),
(1, 5, '08:00', '18:00', 1),
(1, 6, '08:00', '12:00', 1),
(1, 0, NULL, NULL, 0);

-- =====================================================
-- FIM DO SCRIPT DE MIGRAÇÃO V4
-- =====================================================
-- Execute este script no phpMyAdmin ou via CLI MySQL
-- Ignorar erros de "Column already exists" ou "Duplicate key"
-- =====================================================
