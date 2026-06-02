# CRM — Login & Dashboard Design Spec

**Data:** 2026-06-02
**Status:** Aprovado (revisado após code review)

---

## Visão Geral

Sistema de autenticação por email/senha que dá acesso a um dashboard de CRM com dois níveis de acesso (admin e usuário). Funcionalidades principais: gestão de contatos/clientes, histórico de interações e funil de vendas (kanban).

Escopo: pequeno time interno (1–10 usuários), projeto do zero, hospedado integralmente no EasyPanel.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend + API | Next.js 14 (App Router) |
| Autenticação | NextAuth.js v5 (Credentials provider) |
| ORM | Prisma |
| Banco de dados | PostgreSQL |
| Formulários | react-hook-form + zod |
| UI | Tailwind CSS + shadcn/ui |
| Deploy | EasyPanel (Docker Compose) |

---

## Arquitetura

**Infraestrutura EasyPanel:**
Dois containers Docker gerenciados pelo EasyPanel em um VPS:
1. **`app`** — Next.js (porta 3000)
2. **`db`** — PostgreSQL (porta 5432, acesso interno apenas)

Comunicação entre containers via rede interna do Docker. O EasyPanel expõe apenas o container `app` publicamente via HTTPS com proxy reverso automático.

**Fluxo de autenticação:**
1. Usuário entra com email + senha na tela `/login`
2. NextAuth.js valida as credenciais contra o banco via Prisma (bcrypt). Se a conta estiver inativa (`active = false`), a autenticação é recusada com a mesma mensagem genérica de credenciais inválidas (sem distinguir o motivo — ver Tratamento de Erros)
3. Sessão armazenada como JWT em cookie seguro (httpOnly, **Secure**, sameSite=lax). **Expiração: 8 horas.** O flag `Secure` garante que o cookie só trafega via HTTPS — `NEXTAUTH_URL` deve obrigatoriamente começar com `https://` em produção.
4. O callback `jwt` do NextAuth re-valida `active` e `role` do usuário no banco a cada renovação de token. `updateAge` configurado explicitamente para **3600 segundos (1 hora)** — o default do NextAuth v5 é 24h e deve ser sobrescrito. Garante que desativações e mudanças de role sejam propagadas em no máximo 1h sem esperar o JWT expirar completamente
5. Middleware Next.js lê a sessão e protege as rotas do dashboard
6. Role do usuário (`admin` | `user`) incluída no JWT como claim customizado

**Middleware Next.js:**
- `/login` redireciona para `/dashboard` se sessão ativa
- `/reset-password` redireciona para `/dashboard` se sessão ativa *(usuário autenticado não deve consumir tokens de reset)*
- `/dashboard`, `/dashboard/*`, `/contacts`, `/contacts/*`, `/deals`, `/deals/*`, `/profile` e `/profile/*` redirecionam para `/login` se sem sessão
- `/api/health` é rota **pública** — não requer sessão (usada pelo Docker HEALTHCHECK)
- `/admin` e `/admin/*` bloqueiam e redirecionam para `/dashboard` se role != `admin`

**Autorização server-side (API routes / Server Actions):**
Toda operação de escrita ou leitura sensível verifica a sessão e o role **no servidor**, independentemente do middleware de rota. O middleware é apenas a primeira linha de defesa (UX); as Server Actions são a linha de defesa real para os dados.

**Proteção CSRF:**
Next.js App Router verifica automaticamente o header `Origin` em todas as Server Actions — requisições cross-origin sem Origin válido são rejeitadas pelo framework antes de chegar ao código da aplicação. Nenhuma implementação adicional de CSRF token é necessária, desde que as Server Actions sejam invocadas pelo mecanismo nativo do Next.js (não como API endpoints arbitrários).

**Rate limiting:**
- `/login`: máximo **5 tentativas por IP a cada 15 minutos**. Após atingir o limite, retornar HTTP 429 com mensagem "Muitas tentativas. Tente novamente em alguns minutos." Implementado via middleware usando `upstash/ratelimit` com Redis, ou alternativa in-memory com `lru-cache`.
- `/reset-password` (solicitação de token): máximo **3 solicitações por IP a cada hora**. Retornar HTTP 429 silenciosamente (sem revelar se o email existe). Implementado no mesmo middleware ou na Server Action.
- **Limitação do lru-cache:** contadores em memória são perdidos a cada restart do container e não são compartilhados entre workers. Para este projeto (single-process, single-replica no EasyPanel), é aceitável. Se o EasyPanel configurar múltiplos workers ou réplicas, migrar para `upstash/ratelimit` com Redis externo.

---

## Modelo de Dados

### `users`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Chave primária |
| `full_name` | text | Nome completo |
| `email` | text NOT NULL UNIQUE | Email de login |
| `password_hash` | text | Hash bcrypt da senha (cost factor 12) — **nullable**: null enquanto o usuário não concluiu o setup inicial |
| `role` | enum (`admin`, `user`) NOT NULL | Nível de acesso |
| `active` | boolean NOT NULL DEFAULT true | Conta ativa ou desativada |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Última atualização (atualizado automaticamente via Prisma) |

### `contacts`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Chave primária |
| `name` | text NOT NULL | Nome do contato |
| `email` | text | Email |
| `phone` | text | Telefone |
| `company` | text | Empresa |
| `owner_id` | uuid NOT NULL (FK users) | Usuário responsável — obrigatório |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Última atualização |

### `interactions`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Chave primária |
| `contact_id` | uuid NOT NULL (FK contacts) | Contato relacionado |
| `owner_id` | uuid NOT NULL (FK users) | Usuário que registrou *(renomeado de `user_id` para consistência)* |
| `type` | enum (`call`, `email`, `meeting`, `note`) NOT NULL | Tipo de interação |
| `notes` | text | Observações |
| `date` | timestamptz NOT NULL | Data da interação |
| `created_at` | timestamptz | Data de inserção do registro |
| `updated_at` | timestamptz | Última atualização |

### `deals`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Chave primária |
| `contact_id` | uuid NOT NULL (FK contacts) | Contato relacionado |
| `owner_id` | uuid NOT NULL (FK users) | Usuário responsável |
| `title` | text NOT NULL | Título do negócio |
| `value` | numeric CHECK (value >= 0) | Valor estimado — não pode ser negativo |
| `stage` | enum NOT NULL | Etapa do funil (ver abaixo) |
| `created_at` | timestamptz | Data de criação |
| `updated_at` | timestamptz | Última atualização (usado para detecção de conflito no kanban) |

**Resolução de conflito no kanban:** estratégia **last-write-wins**. Ao mover um deal, a Server Action recebe o `updated_at` atual do cliente. Se o valor do banco for mais recente (conflito detectado), a ação ainda persiste a mudança (last-write-wins) e retorna o estado atualizado com um toast de aviso: *"Este deal foi modificado por outro usuário. Sua alteração foi salva."* Abordagem justificada pelo escopo de 1–10 usuários; implementar optimistic locking completo seria over-engineering para este tamanho.

Estágios do funil: `lead` → `qualified` → `proposal` → `negotiation` → `closed_won` | `closed_lost`

"Deals abertos" = qualquer stage exceto `closed_won` e `closed_lost`.

> **Nota de design:** os estágios são implementados como enum do PostgreSQL. Adicionar, renomear ou reordenar stages exige uma migration `ALTER TYPE` — operação não reversível sem downtime. Os estágios acima são considerados fixos para o escopo inicial; qualquer necessidade de customização futura requer planejamento de migration.

### `password_reset_tokens`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | Chave primária |
| `user_id` | uuid NOT NULL (FK users **ON DELETE CASCADE**) | Usuário solicitante — deletado junto com o usuário |
| `token_hash` | text NOT NULL UNIQUE | Hash SHA-256 do token enviado por email |
| `type` | enum (`reset`, `invite`) NOT NULL | Distingue tokens de reset de senha de tokens de convite |
| `expires_at` | timestamptz NOT NULL | Reset: 1h após criação; Invite: 24h após criação |
| `used_at` | timestamptz | Preenchido quando o token é consumido (uso único) |

**Esta tabela serve tanto para reset de senha quanto para convites de novos usuários**, distinguidos pelo campo `type`. O fluxo de `/reset-password` verifica o `type` para saber qual mensagem exibir após o setup (reset: "senha alterada"; invite: "conta criada"). **Limpeza:** tokens com `expires_at < now()` são deletados no início de cada fluxo. `ON DELETE CASCADE` garante remoção automática ao deletar o usuário.

### Índices do Banco de Dados

Prisma não cria índices em FKs automaticamente. Os índices abaixo devem ser declarados explicitamente no schema Prisma para evitar full table scans nas queries de escopo e nas cascatas de delete:

| Tabela | Coluna(s) | Motivo |
|---|---|---|
| `contacts` | `owner_id` | Filtro por usuário em `/contacts` e `/dashboard` |
| `interactions` | `contact_id` | Join e cascade delete por contato |
| `interactions` | `owner_id` | Filtro por usuário |
| `deals` | `contact_id` | Join e cascade delete por contato |
| `deals` | `owner_id` | Filtro por usuário em `/deals` e `/dashboard` |
| `deals` | `stage` | Filtro de "deals abertos" no dashboard |
| `password_reset_tokens` | `user_id` | Lookup e delete de tokens por usuário |

---

## Controle de Acesso

Controle em duas camadas — middleware para UX, server-side para segurança real:

| Camada | Mecanismo |
|---|---|
| Rotas (UX) | Middleware Next.js verifica role no JWT |
| Dados (segurança) | Cada Server Action verifica sessão + role no servidor antes de executar |

| Recurso | admin | user |
|---|---|---|
| `users` | Cria/lê/edita (sem delete — ver abaixo) | Lê/edita apenas o próprio perfil; sem delete |
| `contacts` | CRUD completo (todos) | Lê/cria/edita/deleta onde `owner_id = session.user.id` |
| `interactions` | CRUD completo (todas) | Lê/cria/edita/deleta onde `owner_id = session.user.id` **e** `contact_id` pertence a um contato do próprio usuário |
| `deals` | CRUD completo (todos) | Lê/cria/edita/deleta onde `owner_id = session.user.id` |

**Regra adicional para interactions:** ao criar ou editar uma interaction, o servidor valida que o `contact_id` informado pertence a um contato cujo `owner_id = session.user.id`. Isso impede que um usuário registre interações em contatos de outros.

**Regra de ownership de deals e interactions em relação ao contato:** ao criar um deal ou interaction vinculado a um contato, o `owner_id` do deal/interaction **deve ser igual ao `owner_id` do contato**. Admin que criar um deal num contato de user A deve atribuir `owner_id = user_A.id` — não pode atribuir `owner_id = admin.id`. Isso garante consistência: todos os recursos vinculados a um contato pertencem ao mesmo owner, evitando que um deal apareça em `/contacts/[id]` mas não em `/deals` para o dono do contato.

**`contacts.owner_id` é imutável após criação.** Admin não pode reatribuir o owner de um contato existente via edição. Justificativa: a reatribuição exigiria atualizar atomicamente todos os `deals` e `interactions` filhos — operação complexa fora do escopo do MVP. Para "transferir" um contato, o fluxo correto é criar novo contato com o owner desejado. A Server Action de edição de contato deve **explicitamente ignorar/rejeitar qualquer `owner_id` presente no payload** — nunca atualizar esse campo, mesmo que seja enviado via POST direto.

**Enforcement de owner_id:** a regra de que `deal.owner_id` e `interaction.owner_id` devem ser iguais ao `contact.owner_id` é validada na camada de aplicação (Server Actions). Não existe DB-level constraint ou trigger para isso — imports diretos via SQL podem violar a invariante silenciosamente. Mitigação: documentar no CLAUDE.md do projeto que inserts diretos em `deals` e `interactions` devem respeitar esta regra.

**Visibilidade de interactions em `/contacts/[id]`:** exibe **todas** as interactions vinculadas ao `contact_id` independente do `owner_id` da interaction. Justificativa: o histórico completo do contato é o recurso principal da tela de detalhe. Como user só acessa `/contacts/[id]` de contatos seus (404 para outros), todas as interactions listadas ali são necessariamente do seu próprio contato — a regra de ownership de deals/interactions acima garante que todas foram criadas pelo mesmo owner.

**Delete de usuários não é suportado.** Admin pode apenas desativar (soft-delete via `active = false`). Deletar um usuário exigiria reatribuir ou remover todos os `contacts`, `deals` e `interactions` com `owner_id` desse usuário — operação com impacto de dados não trivial fora do escopo do MVP. Contas inativas ficam no banco mas não conseguem logar.

**Regra de integridade admin:** um admin não pode alterar o próprio `role` nem **desativar a própria conta** via `/admin/users`. A Server Action de alteração de role e a de desativação rejeitam a operação com erro se `target_user_id = session.user.id`. Isso previne que o último admin se auto-rebaixe ou se auto-desative, tornando o painel inacessível.

**Comportamento de delete em cascata:**
- Deletar um `contact` apaga em cascata todas as suas `interactions` e `deals` vinculados
- Deletar um `deal` ou `interaction` não afeta o contato pai

---

## Páginas & Componentes

### Rotas públicas
- **`/login`** — Formulário email + senha, link "esqueci minha senha"

### Rotas protegidas (todos os usuários autenticados)
- **`/dashboard`** — Cards com totais escopados por role:
  - **admin**: totais globais (todos os contatos, todos os deals abertos, valor total do pipeline de todos)
  - **user**: totais próprios (apenas seus contatos, seus deals abertos, seu valor em pipeline)
- **`/contacts`** — Lista paginada (**25 por página**, paginação por offset) com busca e filtro; botão criar novo contato. Escopo por role: **admin** vê todos; **user** vê apenas `owner_id = session.user.id`. Campos pesquisáveis: `name`, `email`, `phone`, `company` (busca textual case-insensitive). Filtros disponíveis: **admin** tem filtro por owner (lista de usuários ativos). Não há filtro por stage em /contacts — stage pertence a deals e é filtrado em /deals. Ao criar: **admin** seleciona owner obrigatório; **user** recebe `session.user.id` automaticamente
- **`/contacts/[id]`** — Detalhe: dados do contato, histórico de interações, deals vinculados. Escopo server-side: **user** que acessar contato com `owner_id != session.user.id` recebe 404; **admin** acessa qualquer contato. Seção de deals: exibe **todos os deals vinculados ao `contact_id`** independente de `owner_id` — tanto para admin quanto para user (user só vê se o contato é seu, portanto os deals também são seus)
- **`/deals`** — Kanban com colunas por estágio (drag-and-drop). Escopo por role: **admin** vê todos os deals; **user** vê apenas `owner_id = session.user.id`. Limite: **máximo 50 deals por coluna** exibidos. Colunas com mais de 50 deals mostram contador e botão "Ver todos" que abre lista paginada filtrada por aquele stage. Justificativa: para 1–10 usuários este limite raramente será atingido; se atingido, lista paginada é suficiente
- **`/profile`** — Página de perfil próprio: editar nome e trocar senha. **Troca de senha requer a senha atual** (campo obrigatório, validado server-side via bcrypt antes de atualizar) — diferente do fluxo de reset que não exige senha atual

### Rotas exclusivas de admin
- **`/admin/users`** — Lista paginada (**25 por página**) de usuários com **busca por `full_name` e `email`** (case-insensitive) e filtro por `role` e `active`; criar conta, **desativar e reativar** conta, alterar role, **reenviar convite**. **Criação de usuário:** admin informa `full_name`, `email` e `role`. O sistema armazena token de convite em `password_reset_tokens` com `type = 'invite'` e `expires_at = now() + 24h`, e envia email com link de setup. O novo usuário clica no link em `/reset-password`, define sua senha e obtém acesso. `password_hash` fica `null` até o setup; login bloqueado com mensagem genérica. **Reenvio de convite:** botão disponível para usuários com `password_hash = null` — invalida tokens anteriores (transação atômica igual ao reset), emite novo token `type = 'invite'` com 24h de expiração. Se o usuário tiver sessões ativas (raro — implica setup parcial), elas não são invalidadas; o comportamento é aceitável pois `active = true` ainda é verificado no step 5

### Layout do dashboard
- Sidebar fixa com links: Dashboard, Contatos, Funil, Perfil, (admin) Usuários
- Header com nome do usuário logado e botão de logout

---

## Tratamento de Erros

**Autenticação:**
- Credenciais inválidas **ou** conta desativada → mesma mensagem genérica: **"Email ou senha incorretos"** *(mensagem unificada previne enumeração de contas — o sistema não confirma se o email existe)*
- Sessão expirada → redirecionamento automático para `/login`
- Acesso não autorizado a rota admin → redirect para `/dashboard` com toast de aviso

**Formulários:**
- Validação no cliente via `zod` (campos obrigatórios, formato de email)
- Validação server-side nas Server Actions com o mesmo schema `zod` (nunca confiar apenas no cliente)
- **Política de senha:** mínimo **8 caracteres**, pelo menos **1 letra e 1 número** — aplicada via zod em todos os campos de senha (criação de usuário, /profile, /reset-password)
- **Validação de `full_name`:** obrigatório, mínimo **1 caractere**, máximo **100 caracteres** — aplicado via zod em /profile e na criação de usuário pelo admin
- **Validação de `contacts.name`:** obrigatório, mínimo 1 char, máximo **150 caracteres**
- **Validação de `deals.title`:** obrigatório, mínimo 1 char, máximo **200 caracteres**
- **Validação de `deals.value`:** opcional, quando informado deve ser número **≥ 0** — validado via zod (`.nonnegative()`) no cliente e na Server Action, além do CHECK no banco
- Erros da API exibidos inline

**Feedback visual:**
- Loading state em botões durante operações assíncronas
- Toasts de sucesso/erro para ações (criar, editar, mover deal)

---

## Reset de Senha

Fluxo completo:
1. Usuário clica "esqueci minha senha" em `/login` → informa email
2. Server Action: busca o usuário pelo email. **Verifica `active = true` — conta desativada não recebe token de reset.** Em uma **transação única**: invalida tokens anteriores não usados (`DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL`) e insere o novo token — operação atômica previne race condition de dois tokens simultâneos. Gera token aleatório (32 bytes), armazena `SHA-256(token)` com `type = 'reset'` e `expires_at = now() + 1h`
3. Email enviado com link `https://<NEXTAUTH_URL>/reset-password?token=<token_plaintext>`
4. Usuário clica no link → página `/reset-password` valida token: busca por hash, verifica `expires_at > now()`, `used_at IS NULL` **e `type` corresponde ao contexto** (`type = 'reset'` para reset de senha; `type = 'invite'` para setup de nova conta). Token inválido/expirado/usado/tipo errado → mensagem genérica: *"Este link é inválido ou já foi utilizado."* com botão para `/login`. Não distingue os casos (previne enumeração)
5. Usuário define nova senha → Server Action **verifica `active = true`** (aplica-se a ambos os flows — previne que usuário desativado após receber convite complete o setup). Atualiza `password_hash`, preenche `used_at = now()`, deleta tokens restantes do usuário. **Redirecionamento pós-sucesso:** `type = 'reset'` → signOut no dispositivo atual + redireciona para `/login`; `type = 'invite'` → **não** chama signOut (não há sessão prévia) + faz auto-login via NextAuth + redireciona para `/dashboard`. JWTs em outros dispositivos válidos até próximo `updateAge` (~1h) — limitação JWT stateless aceitável para este escopo
6. Se o email não existir no banco (ou conta desativada), nenhum erro diferenciado é retornado ao cliente (previne enumeração)
7. **Falha no envio de email (SMTP):** se o envio falhar após o token ser armazenado, o token **não é revertido**. O usuário recebe mensagem genérica: *"Se este email estiver cadastrado, você receberá as instruções em breve."* O erro SMTP é **logado no servidor** (console.error). O usuário pode tentar novamente após o rate limit (3/hora)

**O mesmo comportamento de falha SMTP se aplica ao fluxo de convite:** se o email de convite falhar, o token é mantido, o admin vê mensagem de erro: *"Erro ao enviar email de convite. Use o botão 'Reenviar convite' para tentar novamente."*, e o erro é logado server-side.

---

## Bootstrap — Admin Inicial

A conta admin inicial é criada via script Prisma seed (`prisma/seed.ts`), executado uma única vez após o deploy:

```
npx prisma db seed
```

O seed lê as credenciais de variáveis de ambiente (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) — **nunca hardcoded no código**. O script **valida `SEED_ADMIN_PASSWORD` contra a política de senha** (mínimo 8 chars, 1 letra + 1 número) antes de prosseguir — encerra com erro claro se inválida. O script é **idempotente**: verifica se já existe usuário com o email; se existir, encerra sem alterações. Após o primeiro login, o admin deve alterar a senha em /profile. Remover as variáveis de seed do EasyPanel após o bootstrap.

---

## Deploy — EasyPanel

**docker-compose.yml** (gerenciado pelo EasyPanel):
- Serviço `db`: imagem `postgres:16`, volume persistente para dados. **HEALTHCHECK:** `pg_isready -U postgres` a cada 10s, timeout 5s, 5 retries. **`restart: unless-stopped`**
- Serviço `app`: build do Next.js, depende de `db` (condition: `service_healthy`), variáveis via EasyPanel. **HEALTHCHECK:** `curl -f http://localhost:3000/api/health` a cada 30s — endpoint `/api/health` verifica conectividade com o banco (query simples `SELECT 1`) e retorna `{ status: "ok" }` com HTTP 200, ou HTTP 503 se o banco não responder. **`restart: unless-stopped`**

**Backup do PostgreSQL:**
- Executar `pg_dump` diariamente via cron no VPS (ou script agendado no EasyPanel): `pg_dump $DATABASE_URL | gzip > /backups/crm-$(date +%Y%m%d).sql.gz`
- Retenção: manter os **últimos 7 backups diários**
- Armazenar backups fora do volume Docker (diretório separado no VPS ou upload para S3/object storage)
- Testar restore ao menos uma vez antes de ir para produção: `psql $DATABASE_URL < backup.sql`
- **Verificação de sucesso do backup:** o script de cron deve verificar o exit code do `pg_dump` e o tamanho do arquivo gerado (> 0 bytes). Em caso de falha, logar erro e — se EasyPanel suportar webhooks de notificação — disparar alerta. Alternativa simples: redirecionar stderr para um arquivo de log e checar diariamente

**Variáveis de ambiente necessárias:**

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `NEXTAUTH_SECRET` | Segredo para assinar JWTs (mínimo 32 chars aleatórios) |
| `NEXTAUTH_URL` | URL pública da aplicação (ex: https://crm.empresa.com) |
| `SMTP_HOST` | Servidor SMTP para envio de emails |
| `SMTP_PORT` | Porta SMTP (ex: 587) |
| `SMTP_USER` | Usuário SMTP |
| `SMTP_PASSWORD` | Senha SMTP |
| `SMTP_FROM` | Endereço remetente (ex: no-reply@empresa.com) |
| `SEED_ADMIN_EMAIL` | Email do admin inicial (remover após bootstrap) |
| `SEED_ADMIN_PASSWORD` | Senha do admin inicial (remover após bootstrap) |

---

## Testes

Testes manuais do fluxo principal:

- [ ] Login com credenciais válidas → acesso ao dashboard
- [ ] Login com credenciais inválidas → mensagem genérica "Email ou senha incorretos"
- [ ] Login com conta desativada → mesma mensagem genérica (não revela que a conta existe)
- [ ] Acesso direto a `/dashboard` sem login → redirect para `/login`
- [ ] Acesso direto a `/dashboard/qualquer-rota` sem login → redirect para `/login`
- [ ] Usuário `user` tenta acessar `/admin/users` → redirect para `/dashboard`
- [ ] Usuário `user` chama Server Action admin diretamente → erro 403 (não apenas redirect)
- [ ] Criar contato, registrar interação, vincular deal
- [ ] Tentar criar interação com `contact_id` de outro usuário → erro de validação
- [ ] Mover deal entre colunas no kanban
- [ ] Admin cria novo usuário e altera role → mudança refletida em até 1h na sessão ativa
- [ ] Admin rebaixa role de admin → admin rebaixado perde acesso a /admin em até 1h
- [ ] Admin desativa usuário → usuário perde acesso em até 1h
- [ ] Admin reativa usuário → usuário recupera acesso no próximo login
- [ ] Usuário `user` não enxerga contatos/deals/interactions de outro usuário
- [ ] Usuário `user` na lista /contacts vê apenas seus próprios; admin vê todos
- [ ] Usuário `user` no dashboard vê apenas seus próprios totais; admin vê totais globais
- [ ] Usuário `user` pode deletar seus próprios contatos (com cascade em interactions e deals)
- [ ] Usuário `user` não consegue deletar contatos de outro usuário → erro 403
- [ ] Fluxo completo de reset de senha: link expira após 1h, uso único, cookie do dispositivo atual limpo após reset
- [ ] Conta desativada solicita reset → nenhum token emitido, nenhum email enviado
- [ ] Usuário autenticado acessa `/reset-password` → redirect para `/dashboard`
- [ ] Solicitar novo reset invalida token anterior antes de emitir novo
- [ ] 6+ tentativas de login no mesmo IP em 15min → HTTP 429
- [ ] 4+ solicitações de reset no mesmo IP em 1h → HTTP 429
- [ ] Admin tenta alterar o próprio role → erro (operação bloqueada)
- [ ] Admin tenta desativar a própria conta → erro (operação bloqueada)
- [ ] user acessa `/contacts/[id]` de outro usuário diretamente → 404
- [ ] user no `/deals` vê apenas seus próprios deals no kanban; admin vê todos
- [ ] Acesso direto a `/contacts`, `/deals`, `/profile` sem login → redirect para `/login`
- [ ] Admin cria contato: campo owner obrigatório e selecionável; user cria contato: owner_id = session.user.id automático
- [ ] Trocar senha em /profile sem informar senha atual → erro de validação
- [ ] Trocar senha em /profile com senha atual correta → sucesso
- [ ] Senha com menos de 8 chars → erro de validação (login, /profile, reset, criação de usuário)
- [ ] Admin cria usuário → email de convite enviado; novo usuário clica no link, define senha e é redirecionado para /dashboard (auto-login)
- [ ] Novo usuário tenta logar antes de concluir setup (password_hash null) → recusado com mensagem genérica
- [ ] Link de convite expirado (>24h) → mensagem de link inválido; admin vê botão "Reenviar convite" em /admin/users
- [ ] Admin reenvía convite → token anterior invalidado, novo token com 24h emitido
- [ ] Token de reset usado no formulário de invite (type mismatch) → rejeitado com mensagem genérica
- [ ] Após reset de senha bem-sucedido → redirecionado para /login (não /dashboard)
- [ ] Após setup de convite bem-sucedido → auto-login e redirecionado para /dashboard
- [ ] SMTP falha ao criar convite → admin vê mensagem de erro, token mantido, botão reenviar disponível
- [ ] Deal criado em contato de user A tem owner_id = user A → aparece em /deals e em /contacts/[id] consistentemente
- [ ] Tentativa de criar deal com owner_id diferente do owner do contato → erro de validação
- [ ] Admin tenta editar owner_id de contato existente → campo não disponível (imutável)
- [ ] Admin tenta deletar usuário → operação não disponível (apenas desativar)
- [ ] /contacts/[id] exibe todas as interactions do contato independente de quem registrou
- [ ] Dois usuários movem o mesmo deal simultaneamente → último salvo vence com toast de aviso
- [ ] Coluna do kanban com 51+ deals → mostra 50 + botão "Ver todos"
- [ ] Nome em branco em /profile → erro de validação
- [ ] Nome com mais de 100 chars em /profile → erro de validação
- [ ] Contato com nome > 150 chars → erro de validação
- [ ] Deal com title vazio → erro de validação
- [ ] deals.value negativo → erro de validação (zod + banco)
- [ ] Busca em /admin/users por nome ou email retorna resultados corretos
- [ ] Filtro por role e active em /admin/users funciona
- [ ] /reset-password com token expirado → mensagem "link inválido ou expirado" + botão para /login
- [ ] /reset-password com token já usado → mesma mensagem genérica
- [ ] Busca em /contacts por nome, email, empresa e telefone retorna resultados corretos
- [ ] Paginação em /contacts: 25 por página, navegação entre páginas funciona
- [ ] Admin filtra /contacts por owner → vê apenas contatos do owner selecionado
- [ ] /contacts/[id] mostra todos os deals do contato (admin e user, desde que o contato seja acessível)
- [ ] deals.value negativo → erro de validação
- [ ] /api/health retorna 200 sem autenticação (rota pública); retorna 503 se banco indisponível
- [ ] Admin desativa usuário que tem convite pendente → usuário clica no link → step 5 verifica active=false → setup bloqueado
- [ ] Admin edita contato e tenta alterar owner_id via POST direto → Server Action ignora/rejeita o campo
- [ ] Token de reset tipo=invite submetido no formulário de reset senha → rejeitado por type mismatch
- [ ] Dois resets simultâneos para o mesmo usuário → apenas um token válido criado (operação atômica)
- [ ] Bootstrap: seed cria admin inicial com credenciais das env vars
- [ ] Bootstrap: seed com SEED_ADMIN_PASSWORD fraco (< 8 chars) → erro antes de inserir
- [ ] Re-executar seed com admin já existente → no-op, senha não sobrescrita

Testes automatizados podem ser adicionados em iteração futura conforme o projeto crescer.
