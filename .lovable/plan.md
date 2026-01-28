
# Plano: Correção de 3 Problemas - Profissionais, Status e Confirmação

## Problemas Identificados

### 1. Dropdown de Profissionais Vazio no Calendário
**Causa**: O endpoint `GET /api/team/professionals` filtra por `active = 1`, mas usuários convidados podem estar com `active = 0` ou a query não está retornando os profissionais corretamente.

**Análise do código atual:**
```php
WHERE clinica_id = :clinica_id 
  AND role IN ('admin', 'doctor') 
  AND active = 1
```

O problema pode ser:
- Usuários não foram criados com `active = 1`
- O filtro `role IN ('admin', 'doctor')` não inclui o role correto

### 2. Status do Membro Fica "Pendente" Após Login
**Causa**: O `backend/api/team/index.php` usa uma lógica baseada em tempo de criação para determinar se é "pending":

```php
$daysSinceCreation = (time() - $createdAt) / 86400;
$isPending = $daysSinceCreation < 7 && $user['role'] !== 'admin';
```

Esta lógica está incorreta - deveria verificar se o usuário já fez login, não apenas o tempo desde a criação.

**Solução**:
1. Adicionar coluna `last_login` na tabela `usuarios`
2. Atualizar `last_login` quando o usuário fizer login
3. Usar `last_login IS NULL` para determinar status "pending"

### 3. Smart Feed Mostra "Agendamentos Pendentes" Sem Funcionalidade
**Causa**: O `backend/api/dashboard/smart-feed.php` adiciona dinamicamente um alerta sobre agendamentos pendentes, mas não existe UI para confirmar agendamentos.

**Solução**: Implementar a funcionalidade de confirmação de agendamentos:
1. Adicionar endpoint para confirmar/cancelar agendamentos do smart feed
2. Atualizar a UI do Smart Feed para executar ações
3. Redirecionar para a Agenda com filtro de agendamentos pendentes

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `backend/database-update-v8-professionals.sql` | Adicionar coluna `last_login` |
| `backend/api/auth/login.php` | Atualizar `last_login` no login |
| `backend/api/team/index.php` | Corrigir lógica de status "pending" |
| `backend/api/team/professionals.php` | Ajustar query para incluir proprietários |
| `src/components/dashboard/SmartFeed.tsx` | Adicionar ações funcionais |
| `src/pages/app/Agenda.tsx` | Adicionar filtro de status |

---

## Detalhes Técnicos

### Alteração 1: Adicionar `last_login` no SQL

```sql
-- Adicionar ao database-update-v8-professionals.sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL;
```

### Alteração 2: Atualizar `last_login` no Login

```php
// Em login.php, após verificar senha:
$db->prepare("UPDATE usuarios SET last_login = NOW() WHERE id = :id")
   ->execute([':id' => $user['id']]);
```

### Alteração 3: Corrigir Lógica de Status

```php
// Em team/index.php:
// Antes (incorreto):
$daysSinceCreation = (time() - $createdAt) / 86400;
$isPending = $daysSinceCreation < 7 && $user['role'] !== 'admin';

// Depois (correto):
$hasLoggedIn = !empty($user['last_login']);
$status = $hasLoggedIn ? ((bool)$user['active'] ? 'active' : 'inactive') : 'pending';
```

### Alteração 4: Ajustar Query de Profissionais

O problema está na query que não considera que o owner também é um profissional. Ajustar:

```php
// Antes: role IN ('admin', 'doctor')
// Depois: (role IN ('admin', 'doctor')) - já está correto
// Verificar se active está sendo setado corretamente na criação
```

### Alteração 5: Smart Feed com Ações

Adicionar navegação para Agenda com filtro:

```typescript
// Em SmartFeed.tsx - ao clicar na ação "confirm_appointments":
if (item.action === 'confirm_appointments') {
  navigate('/app/agenda?status=pending&date=tomorrow');
}
```

### Alteração 6: Filtro de Status na Agenda

Adicionar parâmetro de URL para filtrar por status pendente e permitir confirmação rápida.

---

## Ordem de Implementação

1. Atualizar script SQL com `last_login`
2. Modificar `login.php` para registrar último acesso
3. Corrigir lógica de status em `team/index.php`
4. Ajustar `professionals.php` se necessário
5. Atualizar SmartFeed com navegação
6. Adicionar filtro de status na Agenda (opcional, para melhor UX)

---

## Resultado Esperado

- Dropdown de profissionais mostrará todos os médicos ativos da clínica
- Membros convidados terão status "Ativo" após primeiro login
- Smart Feed redirecionará para Agenda ao clicar em "Confirmar agendamentos"
