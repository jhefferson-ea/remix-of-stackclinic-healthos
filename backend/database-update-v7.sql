-- =====================================================
-- StackClinic Database Update v7
-- Vincula agendamentos às conversas do WhatsApp
-- =====================================================

-- Adiciona coluna para vincular agendamento à sessão de conversa
ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS session_phone VARCHAR(20) NULL 
    COMMENT 'Telefone/ID da sessão WhatsApp que originou o agendamento'
    AFTER notes;

-- Índice para buscar agendamentos por sessão de conversa
CREATE INDEX IF NOT EXISTS idx_agendamento_session 
ON agendamentos(session_phone);

-- Índice para buscar pacientes por telefone (para validação de existente)
CREATE INDEX IF NOT EXISTS idx_paciente_phone 
ON pacientes(clinica_id, phone);
