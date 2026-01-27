
Contexto rápido (o que está acontecendo de verdade)
- A conversa (mensagens) está gravada no banco, mas o profissional não consegue ver porque o endpoint /appointments/{id}/conversation está retornando {"success": false, "error": "Token não fornecido"}.
- Isso indica que o backend não está recebendo o header Authorization (muito comum em alguns hosts/Apache/LiteSpeed), mesmo o frontend enviando.
- Separadamente, o “modal bugado” e o warning de acessibilidade continuam porque existem outros DialogContent no projeto (ex.: NewAppointmentModal e Procedures) com aria-describedby={undefined} / sem Description, então o warning persiste e pode afetar layout/percepção.

Onde a conversa fica gravada (resposta objetiva)
- Tabela principal das mensagens: whatsapp_messages
  - Campos relevantes: clinica_id, phone (identificador da sessão/telefone), direction (incoming/outgoing), message, created_at
- Tabela de sessão/contexto (estado da conversa): whatsapp_sessions
  - Campos relevantes: clinica_id, phone, context (JSON), last_activity
- Vínculo do agendamento com a conversa: agendamentos.session_phone
  - Esse session_phone é usado para buscar as mensagens em whatsapp_messages.phone

Diagnóstico dos 2 problemas reportados

1) “Ver Conversa” não mostra nada e diz que não existe conversa
- Hoje o erro real é anterior: o backend responde success:false “Token não fornecido” (mesmo com status 200, porque o Response::unauthorized do projeto devolve JSON).
- Ou seja: o frontend até faz a requisição, mas a API não autentica, então nunca chega a consultar session_phone/mensagens.

2) “Modal bugado com coisas pra fora” + warning “Missing Description…”
- O AppointmentDetailModal já ganhou DialogDescription, mas existem outros DialogContent no app (ex.: NewAppointmentModal.tsx e pages/app/Procedures.tsx) que ainda possuem aria-describedby={undefined} e/ou sem DialogDescription.
- Além disso, o layout do AppointmentDetailModal ainda pode estourar em telas menores/nomes longos porque:
  - DialogContent está com sm:max-w-md fixo e sem max-height/overflow-y.
  - Alguns blocos não têm min-w-0 / break-words / truncate para strings grandes (nome/telefone/procedimento/observações).
  - Footer com 3 botões flex-1 pode ficar espremido em largura pequena.

Implementação (o que eu vou mudar no código)

A) Corrigir autenticação do endpoint de conversa (resolver “Token não fornecido”)
Objetivo: não depender somente do header Authorization, que pode ser removido pelo servidor. Vamos enviar e aceitar um header alternativo.

1) Frontend: enviar o token em um header extra além do Authorization
Arquivo: src/services/api.ts
- No método request(), além de:
  Authorization: Bearer <token>
- Também enviar:
  X-Auth-Token: <token>

2) Backend: aceitar X-Auth-Token quando Authorization não existir
Arquivo: backend/api/helpers/Auth.php
- Em getTokenFromHeader(), depois de tentar HTTP_AUTHORIZATION/REDIRECT_HTTP_AUTHORIZATION/getallheaders(), adicionar fallback:
  - Se existir $_SERVER['HTTP_X_AUTH_TOKEN'] (ou via getallheaders “x-auth-token”), usar esse valor como token direto.
- Ajustar o log para registrar a presença desse header também (para confirmar).

3) CORS: permitir o header X-Auth-Token
Arquivo: backend/api/config/cors.php
- Atualizar Access-Control-Allow-Headers para incluir X-Auth-Token.

Resultado esperado:
- Mesmo que o servidor remova Authorization, o token chega por X-Auth-Token e o endpoint /appointments/{id}/conversation passa a autenticar e retornar as mensagens.

B) Ajustar o “modal bugado” (layout e overflow)
Arquivo: src/components/agenda/AppointmentDetailModal.tsx
- Ajustar o DialogContent para ser mais resistente a telas pequenas e textos longos:
  - Usar width responsivo (ex.: w-[95vw] sm:w-full) e max width maior (sm:max-w-lg ou sm:max-w-xl).
  - Definir max-h e overflow-y-auto no conteúdo do modal (para não “vazar” para fora da viewport).
- Garantir que áreas com textos longos não quebrem layout:
  - Adicionar min-w-0 nos containers em linha.
  - Usar break-words / truncate onde faz sentido (nome do paciente, procedimento, observações).

C) Eliminar de vez o warning “Missing Description…”
Além do AppointmentDetailModal, precisamos corrigir os outros Dialogs que ainda disparam isso.

1) src/components/agenda/NewAppointmentModal.tsx
- Remover aria-describedby={undefined} (isso costuma forçar o warning no Radix)
- Adicionar <DialogDescription className="sr-only">…</DialogDescription> dentro do DialogHeader

2) src/pages/app/Procedures.tsx
- Remover aria-describedby={undefined}
- Adicionar DialogDescription sr-only

Observação: isso não só limpa o console; também evita comportamentos estranhos de acessibilidade/foco que podem parecer “modal bugado”.

D) Garantir que “Ver Conversa” mostre algo útil mesmo quando não há mensagens
Arquivo: src/components/agenda/ConversationDrawer.tsx
- Já existe tratamento de erro e empty state.
- Vou ajustar a mensagem exibida quando:
  - success=false (erro de token / etc) -> mostrar o erro real que veio da API (ex.: “Sessão expirada, faça login novamente” se for o caso).
  - success=true mas has_conversation=false -> manter “sem conversa registrada”.

Sequência de validação (como vamos testar)
1) Login no app (Agenda).
2) Abrir um agendamento e clicar “Ver Conversa”.
   - Conferir no Network (Request Headers) que X-Auth-Token está indo.
   - Confirmar que a resposta agora é success:true e traz data.messages (ou ao menos has_conversation + session_phone).
3) Confirmar que o Drawer lista mensagens (incoming/outgoing).
4) Verificar console:
   - Warning “Missing Description…” deve desaparecer (ou reduzir a zero).
5) Confirmar modal:
   - Não estoura mais para fora em resoluções menores.
   - Textos longos não quebram layout.

Risco/observação importante
- Se o agendamento realmente não tiver session_phone preenchido (ex.: agendamentos criados manualmente pela agenda), o endpoint vai retornar “não possui conversa registrada” corretamente. Mas no seu caso, como foi agendado pela IA, a ideia é que session_phone exista e as mensagens estejam em whatsapp_messages.

Arquivos que serão alterados
- Frontend:
  - src/services/api.ts (enviar X-Auth-Token)
  - src/components/agenda/AppointmentDetailModal.tsx (layout/overflow)
  - src/components/agenda/NewAppointmentModal.tsx (remover aria-describedby undefined + adicionar DialogDescription)
  - src/pages/app/Procedures.tsx (remover aria-describedby undefined + adicionar DialogDescription)
  - src/components/agenda/ConversationDrawer.tsx (mensagem de erro mais fiel ao retorno da API)
- Backend:
  - backend/api/helpers/Auth.php (aceitar X-Auth-Token)
  - backend/api/config/cors.php (permitir X-Auth-Token)

O que você vai ganhar após isso
- “Ver Conversa” passa a funcionar mesmo em servidores que não repassam Authorization.
- Modal de detalhes fica estável em telas pequenas e com textos longos.
- Console deixa de mostrar o warning de DialogDescription (o que reduz ruído e possíveis efeitos colaterais).
