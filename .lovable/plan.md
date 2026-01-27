

# Plano: Suporte a Múltiplos Profissionais (Médicos)

## Contexto Atual

Analisando o código, identifiquei que:

1. **Tabela `usuarios`** já tem campos para médicos (`role`, `specialty`, `crm`)
2. **Tabela `agendamentos`** NÃO tem coluna `usuario_id` (profissional responsável)
3. **Tabela `bloqueios_agenda`** NÃO tem coluna `usuario_id` (bloqueio por médico)
4. **Tabela `horario_funcionamento`** é por clínica, não por profissional
5. **Tabela `procedimentos`** NÃO tem vínculo com profissionais que podem executá-los
6. **A IA** não pergunta qual médico o paciente prefere
7. **O Financeiro** não filtra por profissional

---

## Visão Geral da Solução

A solução envolve criar relacionamentos entre:
- **Profissionais** (tabela `usuarios` onde `role = 'doctor'`)
- **Procedimentos** (quais profissionais fazem quais procedimentos)
- **Agendamentos** (qual profissional atenderá)
- **Horários** (cada profissional pode ter horários diferentes)
- **Bloqueios** (férias/folgas individuais)

---

## Mudanças no Banco de Dados

### 1. Nova tabela: `profissional_procedimentos` (N:N)
Vincula quais profissionais executam quais procedimentos:

```sql
CREATE TABLE profissional_procedimentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    procedimento_id INT NOT NULL,
    clinica_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (usuario_id, procedimento_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (procedimento_id) REFERENCES procedimentos(id) ON DELETE CASCADE,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id)
);
```

### 2. Nova tabela: `horario_profissional` (horário individual)
Cada profissional pode ter seu próprio horário:

```sql
CREATE TABLE horario_profissional (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    clinica_id INT NOT NULL,
    day INT NOT NULL,  -- 0=Domingo, 1=Segunda, ...
    open TIME NOT NULL,
    close TIME NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY (usuario_id, day),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (clinica_id) REFERENCES clinica(id)
);
```

### 3. Adicionar `usuario_id` em tabelas existentes

```sql
-- Agendamentos: qual profissional atenderá
ALTER TABLE agendamentos ADD COLUMN usuario_id INT NULL;
ALTER TABLE agendamentos ADD FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

-- Bloqueios: bloqueio individual ou geral
ALTER TABLE bloqueios_agenda ADD COLUMN usuario_id INT NULL;
ALTER TABLE bloqueios_agenda ADD FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

-- Pagamentos: qual profissional realizou
ALTER TABLE pagamentos_procedimentos ADD COLUMN usuario_id INT NULL;
ALTER TABLE pagamentos_procedimentos ADD FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
```

---

## Lógica de Seleção de Profissional

### Fluxo via WhatsApp/IA:

1. **Paciente escolhe procedimento** → IA consulta `profissional_procedimentos` para ver quais profissionais fazem esse procedimento

2. **Se apenas 1 profissional** → Usa automaticamente

3. **Se múltiplos profissionais**:
   - Pergunta: "Você tem preferência por algum profissional? Temos: Dr. João, Dra. Maria"
   - Se paciente escolhe → Usa o escolhido
   - Se paciente diz "qualquer um" / "tanto faz" → Usa algoritmo de balanceamento

4. **Algoritmo de balanceamento** (quando paciente não escolhe):
   - Busca profissional com MENOS agendamentos naquela data
   - Em caso de empate, usa o primeiro disponível no horário solicitado

---

## Mudanças na Agenda (Frontend)

### 1. Filtro por Profissional
Adicionar dropdown no header da agenda:

```text
[▼ Todos os Profissionais] [▼ Dr. João] [▼ Dra. Maria]
```

### 2. Cores por Profissional
Cada profissional terá uma cor associada para identificação visual rápida:

```typescript
// Exemplo de mapeamento
const professionalColors = {
  1: 'bg-blue-500/20 border-blue-500',   // Dr. João
  2: 'bg-green-500/20 border-green-500', // Dra. Maria
  3: 'bg-purple-500/20 border-purple-500', // Dr. Carlos
};
```

### 3. Visualização em Colunas (opcional futuro)
Modo "lado a lado" mostrando cada profissional em uma coluna separada.

---

## Mudanças no Financeiro

### 1. Filtro por Profissional
Adicionar dropdown similar ao da agenda para filtrar:
- Receita por profissional
- Procedimentos por profissional
- Pagamentos pendentes por profissional

### 2. KPIs por Profissional
- "Receita do Dr. João este mês: R$ X"
- "Procedimentos realizados pela Dra. Maria: Y"

---

## Mudanças na Configuração

### 1. Gestão de Equipe (TeamManagement)
Adicionar na tela de configuração de cada membro:
- **Procedimentos que executa** (checkboxes)
- **Horário individual** (se diferente do horário da clínica)
- **Cor na agenda** (para identificação visual)

### 2. Configuração de Procedimentos
Ao criar/editar procedimento, adicionar:
- **Profissionais habilitados** (multi-select)

---

## Mudanças no Backend (API)

### Endpoints novos:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/team/{id}/procedures` | GET/POST | Procedimentos do profissional |
| `/api/team/{id}/schedule` | GET/POST | Horário individual |
| `/api/procedures/{id}/professionals` | GET/POST | Profissionais habilitados |

### Endpoints modificados:

| Endpoint | Modificação |
|----------|-------------|
| `/api/appointments` | Aceita/retorna `usuario_id`, filtro por profissional |
| `/api/appointments/block` | Aceita `usuario_id` para bloqueio individual |
| `/api/finance/procedure-payments` | Filtro por `usuario_id` |
| `/api/finance/summary` | Filtro por profissional |

---

## Mudanças no OpenAIService (IA)

### 1. Novo passo no fluxo de agendamento:

```text
ATUAL:
1. Procedimento → 2. Data → 3. Horário → 4. Nome → 5. Telefone → 6. Confirmação

NOVO:
1. Procedimento → 2. Profissional (se múltiplos) → 3. Data → 4. Horário → 5. Nome → 6. Telefone → 7. Confirmação
```

### 2. Nova função: `findAvailableProfessionals()`

```php
private function findAvailableProfessionals($procedureId, $clinicaId) {
    $stmt = $this->db->prepare("
        SELECT u.id, u.name, u.specialty 
        FROM usuarios u
        JOIN profissional_procedimentos pp ON pp.usuario_id = u.id
        WHERE pp.procedimento_id = :proc_id 
        AND pp.clinica_id = :clinica_id
        AND u.active = 1
        AND u.role = 'doctor'
    ");
    $stmt->execute([':proc_id' => $procedureId, ':clinica_id' => $clinicaId]);
    return $stmt->fetchAll();
}
```

### 3. Modificar `checkAvailability()` para considerar profissional

```php
private function checkAvailability($date, $clinicaId, $usuarioId = null) {
    // Se usuarioId especificado, busca horário individual
    if ($usuarioId) {
        $stmt = $this->db->prepare("
            SELECT `open`, `close` FROM horario_profissional 
            WHERE usuario_id = :usuario_id AND day = :day AND active = 1
        ");
        // ... continua verificando bloqueios específicos do profissional
    }
    // ... lógica existente como fallback
}
```

### 4. Modificar `createAppointment()` para incluir profissional

```php
$stmt = $this->db->prepare("
    INSERT INTO agendamentos (clinica_id, paciente_id, usuario_id, date, time, ...)
    VALUES (:clinica_id, :paciente_id, :usuario_id, :date, :time, ...)
");
```

---

## Arquivos a Criar/Modificar

### Banco de Dados (SQL Migration):
- `backend/database-update-v8-professionals.sql`

### Backend (PHP):
| Arquivo | Ação |
|---------|------|
| `backend/api/team/procedures.php` | Criar |
| `backend/api/team/schedule.php` | Criar |
| `backend/api/appointments/index.php` | Modificar |
| `backend/api/appointments/block.php` | Modificar |
| `backend/api/services/OpenAIService.php` | Modificar |
| `backend/api/finance/procedure-payments.php` | Modificar |
| `backend/api/finance/summary.php` | Modificar |

### Frontend (React/TypeScript):
| Arquivo | Ação |
|---------|------|
| `src/pages/app/Agenda.tsx` | Modificar (filtro por profissional) |
| `src/pages/app/Financial.tsx` | Modificar (filtro por profissional) |
| `src/components/config/TeamManagement.tsx` | Modificar (procedimentos/horário) |
| `src/components/config/ProfessionalProcedures.tsx` | Criar |
| `src/components/config/ProfessionalSchedule.tsx` | Criar |
| `src/pages/app/Procedures.tsx` | Modificar (profissionais habilitados) |
| `src/services/api.ts` | Modificar (novos endpoints) |

---

## Cronograma Sugerido de Implementação

### Fase 1: Banco de Dados + Backend Base
1. Criar migration SQL com novas tabelas e colunas
2. Criar endpoints de vínculo profissional-procedimento
3. Modificar endpoints de agendamento

### Fase 2: Frontend - Configuração
1. Tela de procedimentos do profissional
2. Tela de horário individual
3. Integração com gestão de equipe

### Fase 3: Frontend - Agenda
1. Filtro por profissional
2. Cores por profissional
3. Modal de agendamento com seleção de profissional

### Fase 4: IA
1. Novo passo de seleção de profissional
2. Algoritmo de balanceamento
3. Verificação de disponibilidade por profissional

### Fase 5: Financeiro
1. Filtro por profissional
2. Relatórios por profissional

---

## Compatibilidade com Dados Existentes

- Agendamentos antigos terão `usuario_id = NULL` (considerados "agenda geral")
- Profissionais sem horário individual usarão horário da clínica como fallback
- Procedimentos sem vínculo serão considerados "executáveis por todos os médicos"

---

## Diagrama Resumido

```text
┌─────────────────────────────────────────────────────────────────┐
│                         CLÍNICA                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  MÉDICO A   │  │  MÉDICO B   │  │       MÉDICO C          │ │
│  │ ───────────│  │ ─────────── │  │ ─────────────────────── │ │
│  │ Limpeza    │  │ Limpeza     │  │ Extração                │ │
│  │ Clareamento│  │ Canal       │  │ Implante                │ │
│  │            │  │ Extração    │  │ Canal                   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  AGENDA:  [Todos] [Dr. A] [Dr. B] [Dr. C]                      │
│  ┌──────┬──────┬──────┬──────┐                                 │
│  │ 08:00│ Apto │ Apto │ Apto │                                 │
│  │ 09:00│ João │ Apto │Maria │  ← Cores por profissional       │
│  │ 10:00│ Apto │Carlos│ Apto │                                 │
│  └──────┴──────┴──────┴──────┘                                 │
│                                                                 │
│  IA (WhatsApp):                                                │
│  "Qual procedimento?" → "Extração"                             │
│  "Preferência de profissional? Temos Dr. B e Dr. C"            │
│  "Qualquer um" → Sistema escolhe com menos agenda              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Próximos Passos

Após aprovação deste plano, começaremos pela **Fase 1** (Banco de Dados + Backend Base), pois é a fundação para todo o resto.

Quer que eu priorize alguma fase específica ou ajuste algum aspecto do plano?

