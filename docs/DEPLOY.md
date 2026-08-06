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
   ADMIN_TRIGGER_SECRET=<gere um valor forte>
   ```
   (digitar `${{` abre o seletor de variáveis de outro serviço do mesmo projeto —
   escolher o serviço Postgres criado no passo 1). `psycopg2.connect()` aceita URI
   e DSN keyword=value, então a `DATABASE_URL` da Railway funciona direto.
   `ADMIN_TRIGGER_SECRET` é o segredo de serviço-para-serviço do Painel Admin (ver
   Seção 4) — **o mesmo valor precisa estar configurado também na Vercel** (Seção
   3). Gere com:
   ```bash
   openssl rand -hex 32
   ```
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
   ADMIN_PASSWORD=<senha do Painel Admin>
   ADMIN_TRIGGER_SECRET=<o MESMO valor configurado no backend na Railway, Seção 2>
   ```
   As 3 variáveis são só server-side — usadas pelos Route Handlers do Next em
   `lib/publishedApi.ts` e `app/api/admin/*/route.ts`, nunca chegam no browser (ver
   Seção 4, "Autenticação do Painel Admin").
5. Deploy.

Hobby da Vercel é só para uso não-comercial — se o projeto virar comercial, precisa
migrar pra Pro (mesma ressalva já vale para o plano Hobby usado no Atlas Solar Justo).

## 4. Carga de dado real na camada "Published"

> Registrado em 06/08/2026. Substitui o procedimento manual original desta seção
> (rodar script → `psql -f` local → reabrir Public Access na Railway → `psql -f`
> remoto → fechar Public Access) por um botão em `/admin`, inspirado no Painel
> Admin do projeto irmão Atlas Solar Justo. O procedimento manual antigo ainda é
> descrito abaixo, mas só para a RAIS (Seção 4.3), que ficou de fora do botão.

### 4.1 Autenticação do Painel Admin

Duas camadas, nenhuma delas com tabela de usuários/JWT (proporcional a um painel
de uso único, decisão registrada quando essa área foi desenhada):

- **`ADMIN_PASSWORD`** (só na Vercel) — a senha que você digita em
  `/admin/login`. Nunca chega ao FastAPI nem ao browser além do form de login.
- **`ADMIN_TRIGGER_SECRET`** (na Vercel **e** na Railway, **mesmo valor** nos
  dois) — segredo de serviço-para-serviço. Sem ele, `POST /api/admin/refresh` no
  backend da Railway (que é uma URL pública) ficaria acessível por qualquer um
  via `curl` direto. As Route Handlers do Next (`app/api/admin/refresh/route.ts`,
  `app/api/admin/status/route.ts`) anexam esse segredo como header
  `X-Admin-Secret` ao chamar o backend — o browser nunca vê esse valor.

Ver Seções 2 e 3 acima para onde cadastrar cada variável.

### 4.2 Botão "Atualizar agora" (Comex, PRODLIST, PIA, ANM, 4 cadeias)

Login em `https://<sua-url-vercel>/admin/login` com `ADMIN_PASSWORD`, depois
clicar em "Atualizar agora" no card "Atualização de dados publicados". O botão
dispara, dentro do próprio container do backend na Railway (via
`services/admin_pipeline.py`, `POST /api/admin/refresh`), a cadeia inteira:

1. Limpa o cache local de downloads (`inputs/official/EXP_2026.csv` etc.) — sem
   isso, o segundo clique reaproveitaria silenciosamente o CSV baixado no
   primeiro clique em vez de buscar dado novo.
2. `operational_pipeline.py config.official.2026.json` — baixa Comex EXP/IMP
   (mês mais recente publicado), PRODLIST e PIA-Produto direto das URLs oficiais
   (já configuradas em `config.official.2026.json`, bloco `inputs.*.url`).
3. `build_final_border_value_outputs.py` e `build_cadeias_minerais_estrategicas.py`
   (este último baixa ANM Produção Bruta/Beneficiada sozinho, via HTTPS).
4. `build_solar_sovereignty_metrics.py`, `build_sector_sovereignty_metrics.py`,
   `build_analytical_staging_silicio.py`, `build_analytical_staging_sectors.py`,
   `build_aipnet_sectors.py` — as 4 cadeias prioritárias.
   `build_energy_context_ben.py` também roda aqui — lê os workbooks do BEN/EPE
   commitados como exceção em `inputs/official/` (sem lógica de download, ao
   contrário dos outros passos) e carrega `analytical_energy_context_national`.
   Se o BEN 2027 (ano-base 2026) sair, os 2 arquivos precisam ser
   re-baixados manualmente e re-commitados — não há atualização automática.
5. Aplica todo `.sql` gerado direto no Postgres da Railway, usando a mesma
   `BORDER_VALUE_DATABASE_DSN` que o backend já usa em produção — **não precisa
   mais reabrir Public Access no Postgres**.
6. `REFRESH MATERIALIZED VIEW` nas 3 views (`mv_published_indicators`,
   `mv_published_hhi_risk`, `mv_published_territorial_tsb`).

A tela mostra o progresso passo a passo (atualiza sozinha, faz polling do status)
e o erro completo se algum passo falhar — falha em qualquer passo interrompe os
seguintes (marcados "Pulado"), sem deixar o site fora do ar (o job roda numa
thread separada da API).

Esses passos dependem de arquivos derivados da RAIS que **não** são regenerados
pelo botão (`outputs/official_2026_rais/fact_employment_rais.csv`,
`outputs/tsb_bridge_2026/*`, `dados/cache/ncm_vigente.json` e outros dois
arquivos de dimensão) — esses ficam commitados no repositório como o snapshot
atual (exceções pontuais no `.gitignore`), então chegam ao deploy da Railway sem
precisar de upload. Ver Seção 4.3 para quando/como atualizá-los.

### 4.3 RAIS — continua manual (fora do botão, de propósito)

RAIS não entra no botão automático: são ~3,5 GB via FTP
(`ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/...`), protocolo que pode estar
bloqueado de saída na Railway, e processar esse volume dentro do mesmo container
que serve a API ao vivo arrisca estourar memória/disco do plano Hobby — para um
dado que muda uma vez por ano, o risco não compensa. Continua sendo atualizado
do jeito antigo, na sua máquina:

```bash
docker compose up -d
python3 operational_pipeline.py config.official.2026.rais.json
python3 build_tsb_bridge.py
```

Depois de confirmar que os `.csv` novos em `outputs/official_2026_rais/` e
`outputs/tsb_bridge_2026/` fazem sentido (contagens, `manifest.json`), **commitar
os arquivos derivados que o `.gitignore` já abre exceção** (ver `.gitignore`,
seção "Exceções: snapshot derivado de RAIS/território") e dar push — o próximo
deploy da Railway já sobe com o snapshot atualizado, pronto para o botão da Seção
4.2 usar. Não é preciso rodar nada manualmente contra o Postgres da Railway.

## 5. Decisão de escopo em aberto (não é bug)

`fertilizantes`, `combustiveis_transicao` e `aco` (via `build_analytical_staging_sectors.py`)
e `silicio` já têm catálogo de produto conceitual com cestas de NCM reais — as 4
cadeias do `CadeiaPrioritariaEnum` estão cobertas. Se uma 5ª cadeia for adicionada
no futuro, ela precisa do mesmo tratamento (catálogo de `input_id`/NCM +
`proportion_factor`, ver docstring de `build_analytical_staging_silicio.py` para as
duas decisões de modelagem já tomadas: fator de rateio sempre 1.0, e RAIS dividido
igualmente entre os `input_id`s de uma mesma CNAE).

## O que este caminho não cobre

- Atualização de dado sem intervenção humana (o botão da Seção 4.2 precisa ser
  clicado por um administrador logado — não há scheduler/cron disparando
  sozinho). RAIS (Seção 4.3) segue exigindo terminal, sem botão nenhum.
- Backup automático do Postgres da Railway — configurar via plano pago da Railway
  antes de tratar esse ambiente como definitivo.
- Domínio próprio — configurável depois via CNAME em ambas as plataformas, sem
  mudar nada de código.
