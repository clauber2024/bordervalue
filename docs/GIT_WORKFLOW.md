# Fluxo de branches — só existe `main`

> Registrado em 19/08/2026, depois de investigar por que o deploy de produção na
> Vercel ficava desatualizado de vez em quando.

## O que estava acontecendo

O repositório tinha dois branches de longa duração, `main` e `master`, e as duas
recebiam commits diretos de sessões diferentes sem nenhuma regra combinada sobre
qual usar. O histórico mostra vários merges cruzados manuais (`Merge origin/main
(...) into master`, `Merge origin/master (...) with gauge commit`) — sinal de que
quem estava commitando ia reconciliando os dois branches na mão, sessão após
sessão, sem um processo fixo.

Isso não era uma separação intencional tipo staging/produção: não havia GitHub
Action de sincronização, nem branch protection, nem nada documentado dizendo que
`master` era ambiente de teste. `master` só aparecia como "Preview" no painel da
Vercel porque **qualquer branch com push vira deploy de Preview automaticamente**
— não é uma configuração especial, é o comportamento padrão da Vercel pra
qualquer branch.

O sintoma concreto: em 19/08/2026, os commits até `d6dbbcc` estavam sincronizados
nos dois branches, mas o commit seguinte (`00b05d8`) foi feito só em `master` e
ficou fora do ar até alguém notar e rodar `git push origin master:main` na mão.

## Decisão: consolidar em um único branch (`main`)

Confirmado no painel da Vercel (Settings → Git) que o **Production Branch é
`main`** — é também o branch padrão do GitHub (`origin/HEAD`). Não havia motivo
pra manter `master` vivo, então:

- `master` foi deletado (local e remoto) em 19/08/2026, depois de confirmar que
  os dois branches estavam com o mesmo commit de ponta (`00b05d8`) — ou seja,
  nada exclusivo se perdeu.
- **A partir de agora, todo trabalho — de qualquer sessão, humana ou de
  agente — vai direto em `main`.** Não crie `master` de novo, nem outro branch
  de longa duração, pra não reintroduzir o mesmo problema.
- Branches de vida curta pra uma feature específica são ok, desde que sejam
  mergeados e deletados no mesmo fluxo de trabalho — o problema nunca foi "ter
  um branch temporário", foi ter dois branches permanentes competindo pelo papel
  de branch principal.

## Por que não a alternativa (dois branches sincronizados via automação)

Daria pra manter `master` como staging de verdade, com uma GitHub Action abrindo
PR/merge automático pra `main` a cada push. Não foi essa a escolha porque não
havia evidência de que alguém *usava* `master` como staging deliberado — era
sobra de sessões não combinadas, não um ambiente com propósito. Automação
resolveria o sintoma (propagação manual esquecida) mas manteria a causa raiz
(duas fontes de verdade). Consolidar em um branch elimina a causa.

Se no futuro surgir uma necessidade real de staging (ex.: testar migração de
banco antes de ir pra produção), a Vercel já cobre isso sem precisar de um
branch permanente: qualquer branch de feature gera automaticamente uma Preview
deployment própria, com URL isolada, antes do merge em `main`.

## Configuração local

`git config push.default` está `simple` (padrão do Git ≥ 2.0, não sobrescrito
neste repo) — `git push` sem argumentos sempre manda o branch atual pro seu
próprio upstream, nunca pra outro branch por engano. Com `master` fora do jogo,
não existe mais pra onde errar: `main` é o único branch local configurado, e
segue com tracking normal pra `origin/main`.
