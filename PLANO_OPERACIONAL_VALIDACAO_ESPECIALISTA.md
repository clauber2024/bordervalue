# Plano operacional para validacao especialista

Projeto: Border Value  
Versao de referencia: `1.0.0-rc.1`  
Data de referencia da candidata: 2026-07-16  
Objetivo: orientar a revisao executiva das atividades que ainda dependem de validacao especialista, sem exigir acesso previo a plataforma ou conhecimento de programacao.

## 1. Contexto para o especialista

O Border Value ja possui uma candidata tecnica gerada com bases oficiais, dashboard, workbook executivo e pacote de publicacao. A validacao solicitada ao especialista nao e uma revisao de codigo. O foco e confirmar se as interpretacoes setoriais, recortes estrategicos e classificacoes preliminares fazem sentido do ponto de vista tecnico, economico e de transicao energetica.

A base combina:

- Comercio exterior Comex Stat: janeiro a junho de 2026.
- Producao domestica PIA-Produto: 2024.
- Emprego formal RAIS: 2024, quando considerada a execucao completa.
- Ponte NCM x PRODLIST-Industria 2025 e CNAE derivada do codigo Prodlist.
- Metodo de rateio: valor da producao PIA por CNAE, com fallback igualitario quando a base economica esta ausente, incompleta ou nao positiva.

Ponto importante: NCM, PRODLIST e CNAE sao classificacoes oficiais, mas a interpretacao setorial e estrategica ainda precisa de julgamento humano. A plataforma nao deve ser promovida como versao institucional definitiva antes dessa revisao.

## 2. Resultado esperado da revisao

Ao final da revisao, o especialista deve devolver uma matriz simples com quatro tipos de decisao:

| Decisao | Quando usar | Acao esperada |
|---|---|---|
| Aprovado | O criterio, recorte ou classificacao esta defensavel | Manter como esta |
| Aprovado com ressalva | O resultado e util, mas exige nota metodologica | Registrar ressalva no relatorio/dashboard |
| Revisar | Ha erro, ambiguidade ou classificacao fraca | Ajustar recorte, descricao, fonte ou regra |
| Excluir da versao publica | O item nao tem base suficiente para publicacao | Retirar do pacote publico ou manter apenas como exploratorio |

Cada decisao deve trazer: arquivo analisado, linha/codigo quando aplicavel, justificativa curta, fonte complementar sugerida e grau de prioridade.

## 3. Materiais que devem ser entregues ao especialista

Entregar preferencialmente os arquivos abaixo, sem exigir que ele navegue no codigo:

- `outputs/publicacao_border_value_2026/`: pacote tecnico consolidado para homologacao.
- `outputs/publicacao_border_value_2026/metadados/inventario_arquivos.csv`: lista de arquivos do pacote.
- `outputs/publicacao_border_value_2026/metadados/checksums_sha256.csv`: rastreabilidade dos arquivos.
- `outputs/final_border_value_2026/border_value_indicadores_finais_2026.xlsx`: planilha executiva principal.
- `outputs/final_border_value_2026/questoes_especialistas_priorizadas.md`: roteiro de perguntas priorizadas.
- `outputs/official_2026/priorizacao_especialistas_cnae.md`: pauta inicial por CNAE.
- `outputs/final_border_value_2026/relatorio_recortes_combustiveis_transicao.md`: recortes de hidrogenio, amonia e produtos relacionados a transicao.
- `outputs/final_border_value_2026/drivers_combustiveis_transicao_ncm.csv`: NCMs e drivers dos produtos relacionados a transicao.
- `outputs/final_border_value_2026/estrutura_analitica_hidrogenio_amonia.csv`: estrutura analitica de hidrogenio e amonia.
- `outputs/final_border_value_2026/relatorio_cadeias_minerais_estrategicas.md`: recorte de cadeias minerais.
- `outputs/final_border_value_2026/priorizacao_cadeias_minerais_estrategicas.csv`: priorizacao das cadeias minerais.
- `outputs/final_border_value_2026/ncm_sem_ponte_priorizacao.csv`: NCMs sem ponte oficial priorizadas para avaliacao.
- `outputs/final_border_value_2026/ncm_validacao_manual_concla.csv`: itens que exigem validacao manual da correspondencia.
- `outputs/final_border_value_2026/resumo_metodologico.md`: resumo das regras usadas.
- `outputs/nib_territorializacao_2026/metodologia_territorializacao_nib.md`: nota metodologica da camada NIB/DIEESE.
- `outputs/nib_territorializacao_2026/resumo_cadeias_nib_territorio.csv`: resumo por cadeia prioritaria NIB.
- `outputs/nib_territorializacao_2026/rais_nib_employment_territory.csv`: emprego RAIS por municipio e cadeia NIB.
- `outputs/nib_territorializacao_2026/bridge_nib_cnae_class.csv`: ponte editavel entre CNAE e cadeias NIB.
- `DOCUMENTACAO_EXECUCAO.md`: documentacao de fontes, parametros e limitacoes.
- `HOMOLOGACAO_TECNICA.md`: criterios tecnicos da candidata.
- `VERSION_CANDIDATE.md`: escopo formal da candidata `1.0.0-rc.1`.

## 4. Ordem recomendada de revisao

### Etapa 1: alinhamento de escopo

Objetivo: confirmar que o especialista esta avaliando a candidata correta.

Checklist:

- [x] Confirmar que a versao analisada e `1.0.0-rc.1`.
- [x] Confirmar que o comercio analisado e janeiro a junho de 2026.
- [x] Confirmar que a producao domestica usada e PIA-Produto 2024.
- [x] Confirmar que a RAIS, quando usada, e RAIS 2024.
- [x] Confirmar que a ponte NCM-PRODLIST e a versao 2025.
- [x] Confirmar que o especialista entendeu a defasagem entre comercio 2026 e producao/emprego 2024.
- [x] Registrar se essa defasagem exige ressalva adicional para publicacao.

Ressalva metodologica final: esta versao cruza comercio Comex Stat de janeiro a junho de 2026 com producao domestica PIA-Produto 2024 e emprego formal RAIS 2024. A diferenca temporal decorre do calendario oficial de publicacao das fontes. Portanto, indicadores de consumo aparente, dependencia externa, orientacao exportadora e leitura territorial devem ser interpretados como aproximacoes analiticas para triagem e priorizacao, nao como fotografia contemporanea perfeita de 2026. Conclusoes setoriais finas exigem validacao especialista e, quando disponivel, atualizacao das bases de producao e emprego.

Evidencia a consultar:

- `VERSION_CANDIDATE.md`
- `DOCUMENTACAO_EXECUCAO.md`
- `outputs/final_border_value_2026/resumo_metodologico.md`

### Etapa 2: validacao da priorizacao setorial por CNAE

Objetivo: validar se os setores marcados como prioritarios representam uma pauta setorial defensavel.

Itens de maior prioridade inicial:

- `0600` - Extracao de petroleo e gas natural.
- `1921` - Fabricacao de produtos do refino de petroleo.
- `2910` - Fabricacao de automoveis, camionetas e utilitarios.
- `2442` - Metalurgia dos metais preciosos.
- `3042` - Fabricacao de turbinas, motores e componentes para aeronaves.
- `2012` - Fabricacao de intermediarios para fertilizantes.
- `2029` - Fabricacao de produtos quimicos organicos nao especificados.
- `2610` - Fabricacao de componentes eletronicos.

Checklist:

- [ ] Confirmar se a descricao setorial de cada CNAE esta adequada para leitura executiva.
- [ ] Confirmar se o setor deve permanecer como prioridade 1, cair para prioridade 2 ou sair da lista prioritaria.
- [ ] Validar se o motivo da prioridade esta coerente: valor comercial, exposicao importadora, peso exportador, dependencia externa ou relevancia para transicao energetica.
- [ ] Identificar setores relevantes que ficaram fora da prioridade inicial.
- [ ] Sinalizar setores que aparecem como relevantes apenas por efeito de rateio ou classificacao ampla.
- [ ] Marcar quais setores exigem nota metodologica antes da publicacao.
- [ ] Informar fonte setorial complementar recomendada, quando houver.

Evidencia a consultar:

- `outputs/official_2026/priorizacao_especialistas_cnae.md`
- `outputs/official_2026/priorizacao_especialistas_cnae.csv`
- `outputs/final_border_value_2026/border_value_indicadores_finais_2026.xlsx`
- `outputs/final_border_value_2026/rankings_cnae.csv`
- `outputs/final_border_value_2026/rankings_e_recortes_setoriais_2026.md`

### Etapa 3: validacao de dependencias externas e indicadores economicos

Objetivo: confirmar se os indicadores derivados de comercio, producao e consumo aparente podem ser usados em comunicacao publica.

Checklist:

- [ ] Verificar se a dependencia externa esta sendo lida como aproximacao analitica, nao como medida contemporanea perfeita.
- [ ] Confirmar se o uso de cambio medio de 2024 para converter PIA em US$ esta aceitavel para a narrativa.
- [ ] Identificar CNAEs com PIA sigilosa ou ausente que nao devem receber conclusoes fortes.
- [ ] Revisar setores com dependencia externa muito alta para separar dependencia real de possivel efeito classificatorio.
- [ ] Validar se importacoes e exportacoes alocadas por CNAE estao coerentes com o conhecimento setorial.
- [ ] Registrar onde a defasagem PIA 2024 versus comercio 2026 precisa aparecer como ressalva.

Evidencia a consultar:

- `outputs/final_border_value_2026/border_value_indicadores_finais_cnae.csv`
- `outputs/final_border_value_2026/border_value_indicadores_finais_cnae_prodlist.csv`
- `outputs/official_2026/quality_summary.csv`
- `outputs/official_2026/manifest.json`
- `outputs/final_border_value_2026/padronizacao_conceitos_unidades.md`

### Etapa 4: validacao de NCM sem ponte e correspondencias manuais

Objetivo: decidir o tratamento dos codigos NCM que nao foram automaticamente ligados a PRODLIST/CNAE ou que exigem auditoria qualitativa.

Checklist:

- [ ] Revisar os NCMs sem ponte com maior valor comercial.
- [ ] Confirmar se algum NCM sem ponte deve receber correspondencia manual excepcional.
- [ ] Para cada correspondencia manual sugerida, exigir fonte oficial ou justificativa tecnicamente defensavel.
- [ ] Separar NCM generica de NCM especifica.
- [ ] Marcar NCMs terminadas em `9`, `90` ou `99` que misturam produtos heterogeneos.
- [ ] Indicar se a melhor acao e mapear, manter nao mapeado, agrupar como residual ou excluir de leitura setorial.
- [ ] Registrar decisao em formato rastreavel: NCM, descricao, decisao, justificativa, fonte e responsavel.

Evidencia a consultar:

- `outputs/final_border_value_2026/ncm_sem_ponte_priorizacao.csv`
- `outputs/final_border_value_2026/ncm_validacao_manual_concla.csv`
- `outputs/final_border_value_2026/nao_mapeado_triagem_prioritaria.csv`
- `outputs/final_border_value_2026/relatorio_triagem_nao_mapeado.md`
- `outputs/final_border_value_2026/ncm_prodlist_overrides_template.csv`

### Etapa 5: validacao de hidrogenio, amonia e produtos relacionados a transicao

Objetivo: confirmar o que pode ser classificado como recorte de transicao energetica sem inferir atributo ambiental apenas pela NCM.

Checklist:

- [ ] Validar se cada NCM do recorte pertence de fato ao universo de hidrogenio, amonia, metanol, etanol, combustiveis de aviacao ou combustiveis maritimos.
- [ ] Separar produto, insumo, equipamento, uso final e rota tecnologica.
- [ ] Confirmar que NCM nao certifica se o produto e verde, renovavel, azul ou de baixa emissao.
- [ ] Indicar quais fluxos podem permanecer como "produto relacionado a transicao".
- [ ] Indicar quais fluxos exigem fonte complementar de projeto, planta, certificacao, origem do insumo ou intensidade de emissoes.
- [ ] Remover ou reclassificar itens com risco de sobreinterpretacao ambiental.
- [ ] Definir texto de ressalva para dashboard, relatorio e apresentacao.

Evidencia a consultar:

- `outputs/final_border_value_2026/relatorio_recortes_combustiveis_transicao.md`
- `outputs/final_border_value_2026/drivers_combustiveis_transicao_ncm.csv`
- `outputs/final_border_value_2026/indicadores_combustiveis_transicao_camada.csv`
- `outputs/final_border_value_2026/estrutura_analitica_hidrogenio_amonia.csv`
- `outputs/final_border_value_2026/fontes_complementares_combustiveis_transicao.csv`

### Etapa 6: validacao de cadeias minerais estrategicas

Objetivo: revisar o recorte de minerais estrategicos, sua priorizacao e a ausencia operacional da camada ANM/AMB.

Limitacao pre-registrada: a camada de dados de mineracao ANM/AMB ainda nao esta incorporada ao banco de dados desta candidata. Portanto, os paineis e tabelas de cadeias minerais devem ser tratados como recorte analitico preliminar e classificados como **apenas exploratorios** na versao publica ate a incorporacao e validacao das fontes oficiais ANM/AMB.

Checklist:

- [ ] Validar se as cadeias minerais selecionadas sao coerentes com a agenda de transicao energetica.
- [ ] Confirmar se os NCMs associados representam adequadamente cada cadeia.
- [ ] Identificar produtos que pertencem a mais de uma cadeia e precisam de nota de ambiguidade.
- [ ] Validar a hierarquia de criticidade e o score estrategico.
- [ ] Confirmar que a camada ANM/AMB nao deve ser tratada como incorporada enquanto os arquivos oficiais nao estiverem disponiveis ou carregados localmente.
- [ ] Confirmar que os paineis de cadeias minerais fiquem marcados como apenas exploratorios na versao publica enquanto a camada ANM/AMB estiver pendente.
- [ ] Indicar fontes complementares aceitas para producao mineral, reservas, beneficiamento ou capacidade industrial.
- [ ] Marcar itens que devem permanecer apenas como exploratorios.

Evidencia a consultar:

- `outputs/final_border_value_2026/relatorio_cadeias_minerais_estrategicas.md`
- `outputs/final_border_value_2026/priorizacao_cadeias_minerais_estrategicas.csv`
- `outputs/final_border_value_2026/drivers_cadeias_minerais_ncm.csv`
- `outputs/final_border_value_2026/indicadores_cadeias_minerais_etapa.csv`
- `outputs/final_border_value_2026/fontes_anm_amb_status.csv`
- `outputs/final_border_value_2026/fact_anm_mineral_production.csv`

### Etapa 7: validacao territorial RAIS e leitura de emprego

Objetivo: confirmar que a leitura de emprego formal e territorio e adequada ao escopo Border Value.

Nota de escopo: a candidata nao classifica ocupacoes verdes individuais. A leitura de emprego vem de CNAE/RAIS/SCN67/MIP, portanto mede emprego associado a setores expostos a TSB, nao ocupacao verde individual.

Checklist:

- [ ] Confirmar que RAIS 2024 e uma camada de emprego formal, nao medida de producao.
- [ ] Confirmar que a leitura de emprego TSB deriva de CNAE/RAIS/SCN67/MIP e nao de classificacao ocupacional individual.
- [ ] Verificar se dashboard, relatorio e workbook evitam afirmar que ha classificacao de ocupacoes verdes individuais.
- [ ] Validar se a classificacao `platform_priority`, `platform_scope` e `out_of_platform_scope` e compreensivel.
- [ ] Conferir se setores fora do escopo Border Value nao estao sendo usados como evidencia setorial da plataforma.
- [ ] Validar se municipio, UF, CNAE, vinculos e massa salarial estao sendo lidos de forma adequada.
- [ ] Sinalizar territorios/setores em que o resultado parece contraintuitivo e exige checagem adicional.
- [ ] Definir se os mapas territoriais podem ser publicados ou devem ficar em homologacao.

Evidencia a consultar:

- `outputs/official_2026_rais/employment_territory_cnae.csv`
- `outputs/official_2026_rais/employment_platform_cnae.csv`
- `outputs/official_2026_rais/employment_scope_summary.csv`
- Dashboard local, se disponivel em `http://localhost:8765`.

Expansao posterior recomendada: criar uma etapa ocupacional propria, fora do escopo entregue nesta candidata. Essa etapa deve carregar RAIS em granularidade ocupacional, criar dimensao metodologica especifica, classificar ocupacoes como diretamente verdes, habilitadoras, industriais em setores TSB ou convencionais em setores de transicao, e cruzar CNAE, ocupacao e municipio. Assim, ficam separadas duas perguntas: "emprego em setor verde/TSB", coberto pela leitura setorial atual, e "ocupacao verde individual", que exige metodologia adicional.

### Etapa 8: validacao da territorializacao das cadeias NIB

Objetivo: validar a camada inspirada no mapeamento DIEESE das cadeias
prioritarias da Nova Industria Brasil nos territorios.

Checklist:

- [ ] Confirmar se a ponte CNAE-cadeia NIB esta adequada para cada missao e cadeia.
- [ ] Marcar CNAEs amplas demais que devem ficar apenas como referencia exploratoria.
- [ ] Validar a classificacao dos municipios como `regiao_industrial_madura`, `polo_relevante_da_cadeia` ou `territorio_emergente_ou_disperso`.
- [ ] Verificar se os principais polos industriais esperados aparecem nas cadeias correspondentes.
- [ ] Identificar cadeias NIB com elos de servicos, tecnologia ou rotas produtivas que nao sao capturados por NCM/PRODLIST.
- [ ] Definir quais tabelas NIB podem entrar no pacote publico e quais devem permanecer como homologacao.

Evidencia a consultar:

- `outputs/nib_territorializacao_2026/metodologia_territorializacao_nib.md`
- `outputs/nib_territorializacao_2026/bridge_nib_cnae_class.csv`
- `outputs/nib_territorializacao_2026/resumo_cadeias_nib_territorio.csv`
- `outputs/nib_territorializacao_2026/rais_nib_employment_territory.csv`
- `outputs/nib_territorializacao_2026/top100_municipios_industria_transformacao_rais.csv`

### Etapa 9: validacao da comparacao 2024 H1 versus 2026 H1

Objetivo: revisar se as variacoes setoriais e por produto podem ser comunicadas como tendencia ou apenas como sinal de triagem.

Checklist:

- [ ] Confirmar se a comparacao usa janelas equivalentes: janeiro a junho de 2024 contra janeiro a junho de 2026.
- [ ] Validar se mudancas por NCM refletem variacao economica real ou mudanca classificatoria.
- [ ] Identificar setores com crescimento ou queda que exigem explicacao conjuntural.
- [ ] Separar variacoes relevantes de outliers pequenos em valor absoluto.
- [ ] Confirmar se os rankings de variacao devem entrar em apresentacao executiva.

Evidencia a consultar:

- `outputs/final_border_value_2026/comparacao_periodos_2024_2026.md`
- `outputs/final_border_value_2026/comparacao_periodos_cnae_2024h1_2026h1.csv`
- `outputs/final_border_value_2026/drivers_variacao_periodos_ncm.csv`
- `outputs/final_border_value_2026/rankings_variacao_periodos_cnae.csv`
- `outputs/final_border_value_2026/relatorio_auditoria_variacao_ncm.md`

### Etapa 10: validacao do dashboard e comunicacao executiva

Objetivo: aprovar a leitura publica da interface, planilha, relatorio e apresentacao.

Checklist:

- [ ] Abrir o dashboard local, se disponivel, e confirmar que os filtros, mapas e tabelas sao compreensiveis para usuario executivo.
- [ ] Verificar se os titulos nao prometem mais do que os dados sustentam.
- [ ] Confirmar que os recortes exploratorios estao identificados como exploratorios.
- [ ] Revisar se todas as ressalvas metodologicas criticas aparecem no relatorio ou na propria interface.
- [ ] Validar se a apresentacao executiva esta coerente com as bases.
- [ ] Validar se a planilha executiva tem abas e colunas suficientes para rastrear os resultados.
- [ ] Listar pontos que bloqueiam publicacao institucional.

Evidencia a consultar:

- `outputs/final_border_value_2026/apresentacao_executiva_border_value_2026_preliminar.pptx`
- `outputs/final_border_value_2026/relatorio_tecnico_border_value_2026_preliminar.docx`
- `outputs/final_border_value_2026/border_value_indicadores_finais_2026.xlsx`
- `outputs/publicacao_border_value_2026/`
- Dashboard local, se disponivel em `http://localhost:8765`.

## 5. Matriz de registro para o especialista preencher

| ID | Tema | Arquivo | Codigo/linha | Achado | Decisao | Justificativa | Fonte complementar | Prioridade | Responsavel |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Prioridade CNAE |  |  |  | Aprovado / Ressalva / Revisar / Excluir |  |  | Alta / Media / Baixa |  |
| 2 | NCM sem ponte |  |  |  | Aprovado / Ressalva / Revisar / Excluir |  |  | Alta / Media / Baixa |  |
| 3 | Produtos relacionados a transicao |  |  |  | Aprovado / Ressalva / Revisar / Excluir |  |  | Alta / Media / Baixa |  |
| 4 | Cadeias minerais | `outputs/final_border_value_2026/priorizacao_cadeias_minerais_estrategicas.csv`; `outputs/final_border_value_2026/relatorio_cadeias_minerais_estrategicas.md` | Etapa 6 | Camada ANM/AMB ainda nao incorporada ao banco de dados; cadeias minerais carecem de dados oficiais de mineracao para materialidade produtiva, reservas, beneficiamento e capacidade industrial. | Ressalva: manter apenas exploratorio na versao publica | Nao publicar como painel conclusivo ate incorporar e validar ANM/AMB; usar somente como triagem analitica baseada em NCM/Comex e criticidade. | ANM/AMB; fontes oficiais complementares de mineracao | Alta | Especialista setorial |
| 5 | RAIS/territorio |  |  |  | Aprovado / Ressalva / Revisar / Excluir |  |  | Alta / Media / Baixa |  |
| 6 | Territorializacao NIB/DIEESE | `outputs/nib_territorializacao_2026/resumo_cadeias_nib_territorio.csv`; `outputs/nib_territorializacao_2026/bridge_nib_cnae_class.csv` | Etapa 8 | Ponte CNAE-cadeia NIB e tipologia territorial ainda dependem de validacao especialista. Comercio municipal aparece apenas como referencia setorial da cadeia. | Aprovado / Ressalva / Revisar / Excluir | Validar CNAEs amplas, polos territoriais e status publico ou exploratorio da camada. | DIEESE; MDIC/CNDI; fontes setoriais das cadeias | Alta | Especialista setorial |
| 7 | Expansao ocupacional futura |  |  |  | Aprovado / Ressalva / Revisar / Excluir |  |  | Alta / Media / Baixa |  |
| 8 | Comunicacao executiva |  |  |  | Aprovado / Ressalva / Revisar / Excluir |  |  | Alta / Media / Baixa |  |

## 6. Criterios de aceite para promover a candidata

A candidata pode avancar para publicacao institucional somente se:

- [ ] Todos os itens de prioridade alta tiverem decisao registrada.
- [ ] Nao houver classificacao ambiental baseada somente em NCM.
- [ ] NCMs sem ponte de maior valor tiverem sido revisadas ou explicitamente mantidas como nao mapeadas.
- [ ] Setores prioritarios tiverem aprovacao ou ressalva documentada.
- [ ] Limites de PIA sigilosa, defasagem temporal e rateio 1:N estiverem descritos.
- [ ] A leitura de emprego estiver descrita como setorial, baseada em CNAE/RAIS/SCN67/MIP, sem classificacao ocupacional camada ocupacional futura.
- [ ] A camada ANM/AMB estiver corretamente marcada como pendente, se as fontes oficiais ainda nao estiverem incorporadas, e os paineis de cadeias minerais estiverem classificados como apenas exploratorios na versao publica.
- [ ] A camada NIB/DIEESE estiver descrita como triagem territorial por CNAE/RAIS, com comercio usado apenas como referencia setorial da cadeia.
- [ ] Dashboard, relatorio, apresentacao e workbook usarem a mesma narrativa metodologica.
- [ ] O pacote de publicacao preservar inventario e checksums.
- [ ] O especialista tiver indicado bloqueios, ressalvas e itens pos-publicacao.

## 7. Perguntas executivas para abrir a reuniao

1. A lista de setores prioritarios faz sentido para uma agenda de transicao energetica e politica industrial?
2. Algum setor importante ficou fora ou entrou indevidamente?
3. Quais resultados podem ser comunicados como conclusao e quais devem ficar como triagem?
4. Quais NCMs ou grupos de produtos exigem validacao manual antes de publicacao?
5. Quais fontes complementares sao indispensaveis para classificar hidrogenio, amonia, metanol, etanol, combustiveis de aviacao e combustiveis maritimos como renovaveis, verdes, azuis ou de baixa emissao?
6. O recorte de minerais estrategicos esta tecnicamente defensavel sem a camada ANM/AMB incorporada?
7. A leitura territorial da RAIS deve entrar na versao publica ou permanecer em homologacao?
8. A territorializacao das cadeias NIB por CNAE/RAIS esta madura para publicacao ou deve ficar como anexo de homologacao?
9. A expansao ocupacional deve ser tratada como frente metodologica posterior para ocupacoes verdes, separada da leitura atual de emprego setorial?
10. Que ressalvas precisam aparecer obrigatoriamente no dashboard e nos materiais executivos?

## 8. Saida minima esperada

O especialista deve devolver, no minimo:

- Matriz de decisoes preenchida.
- Lista de bloqueios para publicacao institucional.
- Lista de ressalvas obrigatorias.
- Lista de ajustes desejaveis, mas nao bloqueantes.
- Fontes complementares recomendadas.
- Parecer final: `aprovar`, `aprovar com ressalvas`, `revisar antes de publicar` ou `nao publicar`.


