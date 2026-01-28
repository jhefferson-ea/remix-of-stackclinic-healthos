
# Plano: Correção do Script SQL Database Update v8

## Problema Identificado

O script SQL atual tem erro de sintaxe na definição das tabelas `profissional_procedimentos` e `horario_profissional`. O erro ocorre porque:

1. A sintaxe `IF NOT EXISTS` em índices não é suportada pelo MariaDB 11.8
2. A ordem dos elementos dentro do CREATE TABLE está incorreta

## Estado Atual do Banco (Analisado)

| Elemento | Status |
|----------|--------|
| `agendamentos.usuario_id` | Já existe |
| `bloqueios_agenda.usuario_id` | Já existe |
| `pagamentos_procedimentos.usuario_id` | Já existe |
| `usuarios.color` | Já existe |
| Tabela `profissional_procedimentos` | NÃO existe - precisa criar |
| Tabela `horario_profissional` | NÃO existe - precisa criar |

## Solução

Criar um script SQL simplificado que apenas cria as duas tabelas faltantes, sem tentar modificar colunas que já existem.

## Arquivo a Modificar

- `backend/database-update-v8-professionals.sql`

## Script SQL Corrigido

```sql
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
```

## Mudanças Técnicas

1. **Removido `IF NOT EXISTS` dos ALTERs** - As colunas já existem no banco
2. **Trocado `INDEX` por `KEY`** - Sintaxe mais compatível com MariaDB
3. **Removido `IF NOT EXISTS` dos CREATE INDEX** - Não suportado pelo MariaDB
4. **Renomeado colunas de horário** - De `open`/`close` para `open_time`/`close_time` (evita conflito com palavras reservadas)
5. **Usado `TINYINT(1)` em vez de `BOOLEAN`** - Mais compatível

## Backend Ajuste Necessário

Após aplicar o SQL, será necessário um pequeno ajuste no `OpenAIService.php` para usar os nomes corretos das colunas (`open_time` e `close_time`).
