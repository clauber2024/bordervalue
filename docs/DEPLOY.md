# Deploy público — Railway + Vercel

> Registrado em 05/08/2026, na sessão em que o site foi publicado pela primeira vez.
> Cobre só o caminho que foi de fato seguido e validado — não é a arquitetura de
> produção definitiva, é o caminho mais direto pra publicar sem servidor próprio.

**URLs no ar:**
- Frontend: https://bordervalue.vercel.app
- Backend: https://bordervalue-production.up.railway.app

**Arquitetura:** diferente de projetos com `backend/`/`frontend/` em pastas separadas —
aqui o Next.js (App Router) e o FastAPI (`api/`, `routers/`, `database/`, `schemas/`,
`services/`) convivem na **raiz do mesmo repositório**. Isso muda como a Railway e a
Vercel precisam ser configuradas (ver Seção 2).

---

## 0. Pré-requisitos corrigidos nesta sessão (não repetir)

Dois bugs que quebravam qualquer tentativa de deploy, já corrigidos e commitados:

- `package.json` tinha uma dependência `@oai/artifact-tool` apontando pra um path
  local de outra máquina (resquício de sessão anterior do Codex) — quebrava
  `npm install` em qualquer lugar. Removida (commit `2c2eb3e`).
- `requirements.txt` tinha `httpx2` (typo de `httpx`, pacote que não existe no
  PyPI) — quebrava `pip install`. Corrigido no mesmo commit.

Se algum dia esses erros voltarem a aparecer (`npm install`/`pip install` falhando
do nada), é sinal de que alguém reintroduziu o problema — não é preciso investigar
do zero, é um desses dois.

---

## 1. Railway — Postgres

1. Criar projeto vazio ("New Project" → "Empty Project").
2. Dentro do projeto, "+ New" → **"Database"** → **"PostgreSQL"** (usar o template
   gerenciado da própria Railway, não a rota manual de "Docker Image" — o template
   já vem com volume persistente configurado e variáveis `PGUSER`/`PGPASSWORD`/
   `PGHOST`/`PGPORT`/`PGDATABASE`/`DATABASE_URL` prontas).
3. O banco criado pelo template chama-se `railway` (não `border_value_db` como no
   `docker-compose.yml` local) — isso é só o nome, não afeta nada, o backend não
   depende de um nome fixo de banco.

## 2. Railway — backend FastAPI

1. No mesmo projeto, "+ New" → **"GitHub Repository"** → `clauber2024/bordervalue`.
2. **Settings → Source**: Root Directory em branco/`/` (raiz — não existe pasta
   `backend/` separada).
3. **Settings → Build**: o builder padrão é **Railpack** (sucessor da Nixpacks na
   Railway). Como a raiz do repo tem `package.json` E `requirements.txt` juntos,
   a detecção automática é ambígua — sempre configurar manualmente:
   - **Custom Build Command**: `pip install -r requirements.txt`
4. **Settings → Deploy**:
   - **Custom Start Command**: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
5. **Variables**: adicionar
   ```
   BORDER_VALUE_DATABASE_DSN=${{Postgres.DATABASE_URL}}
   ```
   (digitar `${{` abre o seletor de variáveis de outro serviço do mesmo projeto —
   escolher o serviço Postgres criado no passo 1). `psycopg2.connect()` aceita URI
   e DSN keyword=value, então a `DATABASE_URL` da Railway funciona direto.
6. Não é preciso configurar CORS/`FRONTEND_URL` como no padrão de outros projetos —
   `api/main.py` já tem `allow_origins=["*"]`.
7. **Settings → Networking**: "Generate Domain", porta `8080` (é a que o Uvicorn
   reporta no log de deploy — Railway seta `$PORT` sozinha, não precisa fixar).
8. Teste: `curl https://<url-gerada>/api/health` deve devolver
   `{"status":"operational",...}`.

## 3. Vercel — frontend Next.js

1. "Add New" → "Project" → mesmo repositório.
2. **Vercel Team**: escolher o escopo pessoal existente (`Polis`, plano **Hobby**,
   gratuito) — **não** clicar em "Create a Team", que força plano Pro pago.
3. Root Directory `/`, Application Preset "Next.js" (auto-detectado).
4. **Environment Variables**:
   ```
   BORDER_VALUE_API_BASE_URL=https://<url-do-backend-na-railway>
   ```
   (variável só server-side — usada pelos Route Handlers do Next em
   `lib/publishedApi.ts`, nunca chega no browser).
5. Deploy.

Hobby da Vercel é só para uso não-comercial — se o projeto virar comercial, precisa
migrar pra Pro (mesma ressalva já vale para o plano Hobby usado no Atlas Solar Justo).

## 4. Carga de dado real na camada "Published"

Diferente de só copiar um dump — aqui a carga é por **cadeia**, via os scripts
`build_analytical_staging_silicio.py` (cadeia silício, 16 produtos) e
`build_analytical_staging_sectors.py` (fertilizantes, combustíveis de transição,
aço — reaproveita os helpers do script do silício). Cada um gera um `.sql` próprio
em `outputs/analytical_staging_*/` com `DELETE` + `INSERT` escopados pelos
`conceptual_product_id` daquela cadeia — seguro de rodar de novo sem duplicar nem
afetar as outras cadeias.

**Toda vez que os dados de origem forem atualizados** (novos CSVs de comex, PIA,
RAIS etc.) ou uma cadeia nova for adicionada:

1. Rodar os scripts localmente contra o Postgres do `docker-compose.yml`:
   ```bash
   docker compose up -d
   python build_analytical_staging_silicio.py
   python build_analytical_staging_sectors.py
   ```
2. Aplicar os `.sql` gerados localmente pra validar:
   ```bash
   docker exec -i border-value-postgres psql -U border_user -d border_value_db \
     < outputs/analytical_staging_silicio/load_analytical_staging_silicio.sql
   # repetir para os 3 arquivos em outputs/analytical_staging_sectors/
   ```
3. **Refresh das materialized views** (elas não atualizam sozinhas):
   ```sql
   REFRESH MATERIALIZED VIEW mv_published_indicators;
   REFRESH MATERIALIZED VIEW mv_published_hhi_risk;
   REFRESH MATERIALIZED VIEW mv_published_territorial_tsb;
   ```
4. Só depois de validar localmente, repetir os passos 2-3 contra o Postgres da
   Railway:
   - **Settings → Networking** do serviço Postgres → **"Add Public Access"**
     (temporário).
   - Pegar `DATABASE_PUBLIC_URL` na aba Variables.
   - Rodar os mesmos `.sql` via `psql "<DATABASE_PUBLIC_URL>"` (usando a imagem
     `postgres:15` local pra não precisar instalar `psql`, mesmo padrão do Atlas):
     ```bash
     docker run --rm -v "$PWD/outputs/analytical_staging_silicio":/dump postgres:15 \
       psql "<DATABASE_PUBLIC_URL>" -f /dump/load_analytical_staging_silicio.sql
     ```
   - Rodar o `REFRESH MATERIALIZED VIEW` (passo 3) também contra a Railway.
   - **"Remove Public Access"** de novo assim que confirmar que os dados chegaram
     (`curl https://<backend>/api/chain/<cadeia>` deve devolver produtos reais).

**Nota de conexão:** o proxy público da Railway já derrubou a conexão no meio de um
`INSERT` uma vez nesta sessão (erro `SSL error: unexpected eof`) — a transação foi
revertida sozinha (os scripts geram `BEGIN`/`COMMIT`), então é seguro só rodar o
arquivo de novo se isso acontecer.

## 5. Decisão de escopo em aberto (não é bug)

`fertilizantes`, `combustiveis_transicao` e `aco` (via `build_analytical_staging_sectors.py`)
e `silicio` já têm catálogo de produto conceitual com cestas de NCM reais — as 4
cadeias do `CadeiaPrioritariaEnum` estão cobertas. Se uma 5ª cadeia for adicionada
no futuro, ela precisa do mesmo tratamento (catálogo de `input_id`/NCM +
`proportion_factor`, ver docstring de `build_analytical_staging_silicio.py` para as
duas decisões de modelagem já tomadas: fator de rateio sempre 1.0, e RAIS dividido
igualmente entre os `input_id`s de uma mesma CNAE).

## O que este caminho não cobre

- Atualização automática de dado (a carga da Seção 4 é manual, sem scheduler).
- Backup automático do Postgres da Railway — configurar via plano pago da Railway
  antes de tratar esse ambiente como definitivo.
- Domínio próprio — configurável depois via CNAME em ambas as plataformas, sem
  mudar nada de código.
