
## O que está acontecendo (causa raiz)

O seu “estado explícito” até foi implementado, mas ele **não está sendo recuperado** entre mensagens na prática por um motivo bem específico:

- A coluna `phone` nas tabelas `whatsapp_sessions` e `whatsapp_messages` é `VARCHAR(20)`.
- No simulador, o backend gera `session_phone` assim: `SIMULATOR_{clinicaId}_{time()}`.
- Isso **passa de 20 caracteres**, então o MySQL salva **truncado**.
- Na próxima mensagem, o frontend manda o `session_phone` completo (não truncado), e o SELECT:
  ```sql
  WHERE phone = :phone
  ```
  **não encontra a sessão** (porque no banco está truncado).
- Resultado: a cada mensagem, o backend “acha” que é uma conversa nova → `collected_data` volta tudo para `null` → a IA volta a perguntar “Qual procedimento deseja?” mesmo após já ter entendido “consulta”.

Isso casa exatamente com o seu exemplo:
- Ela entendeu “dor na mandíbula” e perguntou data (naquele turno).
- No turno seguinte, perdeu o estado (sessão não carregada) e voltou a pedir procedimento.

## Objetivo do ajuste

Fazer o simulador usar um identificador de sessão que:
1) **caiba em `VARCHAR(20)`**, e
2) seja **usado consistentemente** em todos os SELECT/INSERT/DELETE, e
3) seja o mesmo que devolvemos para o frontend (para o frontend sempre mandar o “phone real” do banco).

Sem isso, qualquer melhoria de prompt/extraction vai continuar parecendo “não mudou nada”.

---

## Mudanças planejadas (implementação)

### 1) Corrigir o `session_phone` do simulador (<= 20 chars)
**Arquivo:** `backend/api/ai/simulate-chat.php`

- Trocar a geração atual:
  ```php
  $sessionPhone = 'SIMULATOR_' . $clinicaId . '_' . time();
  ```
  por um formato curto e estável, por exemplo:
  - Prefixo fixo curto + clínica + timestamp em base36 + 1-2 chars rand.
  - Exemplo final com no máximo 20:
    - `S{cid}_{base36time}{r}`
    - Ex: `S12_k9z3f1aQ`

**Ponto importante:** além de gerar curto, vamos criar uma normalização:
- `normalizeSessionPhone($sessionPhone)` que garante:
  - `trim()`
  - remove espaços
  - `substr(..., 0, 20)` como última defesa
- E usar essa versão normalizada em **todas** as queries (select/insert/delete) e também no `Response::success` para o frontend.

Assim, mesmo se por algum motivo o frontend mandar algo maior, o backend passa a “falar a mesma língua” do banco.

### 2) Garantir consistência no DELETE (limpar sessão)
**Arquivo:** `backend/api/ai/simulate-chat.php`

- O endpoint DELETE também depende do `session_phone`.
- Ele precisa usar a mesma função de normalização, senão “Limpar” pode não apagar a sessão certa.

### 3) Verificação rápida: o estado realmente está persistindo
**Arquivo:** `backend/api/ai/simulate-chat.php` e (opcional) `backend/api/services/OpenAIService.php`

Adicionar logs estratégicos (temporários) para confirmar:
- session_phone recebido
- session_phone normalizado
- se encontrou sessão no banco
- tamanho do `phone` e do JSON de context
- `collected_data` antes/depois

Isso vai permitir validar em 1 minuto se o problema era 100% sessão.

### 4) Ajuste pequeno (recomendado) no fluxo “consulta”
**Arquivo:** `backend/api/services/OpenAIService.php`

Depois que a sessão estiver persistindo, o comportamento esperado é:
- “quero marcar uma consulta” já deveria setar procedure por alias `consulta`.
- “estou com dor na mandíbula” também deve setar `Consulta` via sintomas.

Mas para ficar ainda mais robusto, vamos reforçar uma regra:
- Se a mensagem contém “consulta” (ou intenção clara de consulta) mesmo sem DB match, setar `procedure = 'Consulta'` (fallback), mantendo a regra do negócio: sintomas sempre viram consulta.

Isso evita depender 100% de existir um procedimento “Consulta” cadastrado na lista.

---

## Sequência de validação (testes manuais)

1) Clique em **Limpar** no simulador (para garantir sessão zerada).
2) Envie:
   - “boa tarde”
   - “quero marcar uma consulta”
   - “não sei, mas estou com dor na mandíbula”
   - “30/01, 10h”
   - “João da Silva”
3) Resultado esperado após o fix:
   - Ela não volta para “Qual procedimento deseja?” depois de já estar em consulta.
   - Após “30/01, 10h”, ela deve pedir **nome completo** (pois já tem procedimento+data+hora).
   - Não deve sugerir “canal”/“siso” se você não pediu procedimento específico.

---

## Riscos/observações

- Esse bug é específico do simulador porque ele usa `session_phone` artificial; no WhatsApp real o telefone cabe em 20 caracteres.
- Se futuramente você quiser IDs mais longos, aí sim vale uma migration para aumentar `phone` (ex: `VARCHAR(50)`), mas **o fix curto** resolve imediatamente sem depender de schema.

---

## Entregáveis (o que vai mudar)
- `backend/api/ai/simulate-chat.php`
  - session_phone curto
  - normalização consistente em todas as queries
  - logs para confirmar persistência
- `backend/api/services/OpenAIService.php` (pequeno ajuste/fallback)
  - reforço para “consulta” quando o usuário pede consulta ou relata sintomas, sem depender do nome exato do procedimento

---

## Critério de sucesso
Em conversa multi-turn, a IA:
- mantém `procedure=Consulta` após “dor …”
- mantém `date/time` após “30/01, 10h”
- não repete “Qual procedimento deseja?” quando `procedure` já está ✅
