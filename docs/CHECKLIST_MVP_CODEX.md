# Checklist — o que foi construído na sessão longa do Codex

> Reconstruído em 05-06/08/2026 a partir da transcrição completa de duas
> conversas do Codex (chatgpt.com/codex) que trabalharam nesta mesma pasta
> (`E:\Codex-archive\Border Value`) antes de os créditos acabarem sem dar
> tempo de commitar. Todo esse trabalho ficou como alteração não commitada
> em disco; foi resgatado e commitado de uma vez em `8c1cdaa` ("Expand
> analytical dashboard with sovereignty and vulnerability views").
>
> Os 32 arquivos únicos citados na transcrição foram conferidos um a um
> contra o disco em 06/08/2026 — **todos existem**. Este documento existe
> para você não precisar reabrir/reler aquela conversa de novo: use-o como
> checklist de verificação visual no site publicado.

## Como usar

Marque cada item depois de confirmar no site publicado
(https://bordervalue.vercel.app). Se algo aqui aparecer faltando ou
quebrado, é regressão real — pode reportar direto, sem precisar caçar em
qual conversa/arquivo aquilo foi implementado.

---

## 1. Landing e seleção de cadeia

- [ ] Página inicial não carrega gráfico nenhum antes de escolher uma cadeia.
- [ ] Catálogo vem da API (`GET /api/chains`), não hardcoded — 4 cadeias
      publicadas em destaque (silício, fertilizantes, combustíveis de
      transição, aço) + outras em "Expansão do catálogo", recolhidas.
- [ ] Seleção grava na URL (`/?chain=silicio`) — recarregar a página mantém
      a análise.
- [ ] Barra de contexto no topo mostra a cadeia selecionada + macrotema +
      botão "Trocar cadeia".
- [ ] Trocar de cadeia **filtra de verdade** — nenhum insumo de outra
      cadeia aparece no diagnóstico, no gráfico de dependência crítica ou
      na matriz NIB (bug real corrigido: "silício" chegou a vazar 80
      produtos de "minerais críticos" antes do filtro global).

Arquivos: `components/ChainSelectionLanding.tsx`, `lib/chainCatalog.ts`,
`app/api/chains/route.ts`, `app/page.tsx`, `lib/dashboardData.ts`.

## 2. Dois modos de leitura

- [ ] Alternador entre **"Diagnóstico guiado"** (síntese → pergunta
      estratégica → cadeia AIPNET → diagnóstico) e **"Visão analítica"**
      (diagnóstico → fluxo de soberania → matriz NIB → empregos TSB).
- [ ] Hero executivo unificado no topo (`ExecutiveMainHero.tsx`) — sem a
      divisão 50/50 antiga entre apresentação institucional e alerta
      crítico.
- [ ] Gaveta técnica (`TechnicalDrawer`) acessível nos dois modos.
- [ ] Governança/fontes permanecem no rodapé, sem repetir a gaveta técnica.

Arquivos: `components/MainAnalyticalDashboard.tsx`,
`components/ExecutiveMainHero.tsx`.

## 3. Fluxo AIPNET (mapa da cadeia)

- [ ] Etapas da cadeia sempre visíveis como "espinha dorsal" (ex.: Quartzo
      → Si-GM → Polissilício 🇨🇳 → Wafers 🇨🇳 → Módulos 🇧🇷 para silício).
- [ ] Seletor pesquisável entre múltiplas cadeias tecnológicas (solar
      fotovoltaica, eólica onshore, baterias) dentro do próprio componente.
- [ ] Clicar numa etapa abre painel de detalhe (país, estágio, concentração,
      alerta de soberania, insumos relacionados).
- [ ] Etapas com gargalo (ex.: Polissilício, Wafers) aparecem destacadas e
      **também** entram no diagnóstico consolidado como "Gargalo estrutural
      AIPNET" — não ficam isoladas do resto do diagnóstico.
- [ ] Insumos transversais/auxiliares de cada etapa aparecem ao clicar
      (ex.: triclorossilano, cadinhos de quartzo, EVA/POE, fitas de cobre) —
      classificados por cobertura: **Observado** / **Gargalo AIPNET** /
      **Estimado por proxy** / **Fonte complementar** / **Sem classificação
      exclusiva** — sem inventar percentual onde não há dado validado.

Arquivos: `components/AipnetSystemsFlow.tsx`, `schemas/network.py`,
`services/network_service.py`, `routers/api.py`.

## 4. Pipeline de dado real (cadeia solar)

- [ ] Importação/exportação, peso líquido e valor FOB por insumo vêm do
      Comex Stat real (não mock).
- [ ] Produção nacional cruzada com PIA-Produto **só** quando o PRODLIST é
      genuinamente comparável ao insumo conceitual (bug real corrigido:
      polissilício chegou a herdar indevidamente a produção ampla de
      "silício" da PIA, subestimando a dependência externa real).
- [ ] Produção mineral de quartzo/quartzito com fonte ANM (`dadosabertos.anm.gov.br/AMB/`).
- [ ] Concentração global (China ~85% cadeia solar, ~95% wafers) citada com
      fonte institucional (IEA), não como número solto.

Arquivo: `build_solar_sovereignty_metrics.py` (+ equivalente para as
outras 3 cadeias em `build_sector_sovereignty_metrics.py`).

**Nota (06/08/2026):** esse pipeline sempre calculou os números certos,
mas nunca tinha sido conectado ao Postgres de produção nem ao endpoint
`/api/chain/*` usado pelo dashboard principal — só ao endpoint AIPNET
separado. Isso foi fechado nesta sessão (ver `docs/DEPLOY.md`).

## 5. Fluxo de soberania (Sankey)

- [ ] **Com métricas AIPNET carregadas**: mostra todos os insumos da
      cadeia, cada um com seu país fornecedor real (bandeira + cor por
      país — China, Estados Unidos, Alemanha, Espanha, Taiwan, Argentina,
      Brasil, Japão, Coreia, Itália, França, Canadá já mapeados no
      componente), em vários níveis de nó até o produto final.
- [ ] Sem métricas AIPNET, cai num modo simplificado (1 produto → 1 país) —
      **se você está vendo só isso, as métricas AIPNET não carregaram**,
      não é um bug de layout.
- [ ] Nós não "vazam" para fora do gráfico (bug real corrigido: nó final
      era criado antes das camadas anteriores e o algoritmo o posicionava
      como origem visual).
- [ ] Espessura da banda = valor FOB; cor distingue fluxo bruto vs. com
      fator Alpha aplicado.

Arquivo: `components/SovereigntySankeyChart.tsx`.

## 6. Matriz de priorização NIB

- [ ] Pontos próximos na escala logarítmica são detectados como colisão e
      dispersos numa pequena "nuvem" — sem inventar posição para pontos
      isolados.
- [ ] Clicar num grupo de pontos sobrepostos "explode" em leque; clicar de
      novo recolhe.
- [ ] Nomes dos quadrantes ficam numa faixa-guia acima do plano cartesiano
      (não competem com os pontos de dado).
- [ ] **Trava climática**: gás natural, petróleo, nafta, insumos
      petroquímicos e carvão mineral **nunca** recebem recomendação de
      "Atrair investimento" — aparecem sempre como "Substituir /
      Descarbonizar" (roxo), com direcionamento para biometano (gás
      natural em fertilizantes), hidrogênio renovável/amônia verde
      (rotas químicas) ou eletrificação (carvão mineral).
  - Verificação rápida: abra a cadeia de fertilizantes, ache "Gás
    natural" na matriz — tem que estar roxo, não vermelho.

Arquivo: `components/NIBMatrixChart.tsx`.

## 7. Empregos verdes / TSB

- [ ] Rótulo é "cobertura estatística TSB", não uma alegação de "X% dos
      empregos são sustentáveis" (a TSB classifica atividade econômica por
      critério, não certifica automaticamente por CNAE).
- [ ] Distinção clara entre gás fóssil (sem alinhamento automático) e
      biometano/biogás (enquadramento próprio, sujeito a critério).

Arquivo: `components/GreenJobsTSBPanel.tsx`.

## 8. Diagnóstico de dependência crítica

- [ ] Painel "Ver quais" expande em lista com nome, percentual observado,
      tipo de métrica (dependência externa / concentração global /
      participação chinesa) e encaminhamento inicial — não é só um
      contador.

Arquivo: `components/VulnerabilityChart.tsx`.

## 9. Qualidade de exibição (a lacuna real encontrada em 06/08/2026)

Nenhum item abaixo é código faltando — é dado que nunca foi carregado no
Postgres de produção. Ver `docs/DEPLOY.md`, seção 4, para o procedimento
de carga.

- [ ] Nomes de produto aparecem em português (“Eletrodos de carbono”), não
      como `id_cru` (`eletrodos_carbono`).
- [ ] Gaveta de rastreabilidade mostra NCM/CNAE/PRODLIST reais, não
      `00000000`/`0000`.
- [ ] Tabela `aipnet_solar_input_metrics` populada (ativa o Sankey rico —
      ver item 5).

---

## Se algo aqui estiver quebrado de verdade

1. Confirme que não é a lacuna de dado da seção 9 (mais provável).
2. Se for código mesmo, rode `git log --oneline -- <arquivo>` no arquivo
   suspeito — só um commit (`8c1cdaa` ou depois) deveria aparecer. Mais de
   um autor/sessão mexendo no mesmo arquivo é onde regressões acontecem.
3. Não precisa reabrir a conversa do Codex de novo — este documento é o
   resumo definitivo dela.
