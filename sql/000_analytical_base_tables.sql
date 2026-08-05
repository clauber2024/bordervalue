-- Tabelas-base da camada "Published" (analytical staging).
-- Sao criadas vazias aqui (schema apenas) para que as materialized views
-- deste diretorio (mv_published_*.sql, executadas em ordem alfabetica pelo
-- docker-entrypoint-initdb.d) consigam ser criadas mesmo antes de qualquer
-- carga real de dado. A carga de fato e feita por scripts de build
-- separados (ex.: build_analytical_staging_silicio.py), que fazem
-- DELETE + INSERT escopados por conceptual_product_id.
--
-- Schema espelha exatamente o fixture de teste em
-- tests/test_sql_logic.py::create_base_tables, com a adicao da terceira
-- tabela (analytical_employment_by_municipality) que os testes ainda nao
-- cobrem.

CREATE TABLE IF NOT EXISTS analytical_comex_staging (
    conceptual_product_id text NOT NULL,
    cadeia_prioritaria text,
    principal_pais_origem text,
    importacao_valor_fob numeric NOT NULL DEFAULT 0,
    importacao_peso_liquido numeric NOT NULL DEFAULT 0,
    exportacao_valor_fob numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analytical_industry_and_employment (
    conceptual_product_id text NOT NULL,
    -- produto_nome/ncm_codigo/cnae_codigo/prodlist_codigo: sem isso, a API
    -- (database/data_access.py::_map_published_row) cai no fallback de
    -- exibir o conceptual_product_id cru (ex.: "eletrodos_carbono") como
    -- nome e "00000000"/"0000" como codigo em toda a UI (Sankey, grafico de
    -- dependencia, matriz NIB, gaveta de rastreabilidade).
    produto_nome text,
    ncm_codigo text,
    cnae_codigo text,
    prodlist_codigo text,
    valor_producao_pia numeric NOT NULL DEFAULT 0,
    proportion_factor numeric NOT NULL DEFAULT 1,
    qtde_vinculos_rais numeric NOT NULL DEFAULT 0,
    massa_salarial_rais numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analytical_employment_by_municipality (
    municipio_ibge_code text NOT NULL,
    uf_sigla text NOT NULL,
    conceptual_product_id text NOT NULL,
    qtde_vinculos_rais numeric NOT NULL DEFAULT 0,
    massa_salarial_rais numeric NOT NULL DEFAULT 0,
    is_tsb_sector boolean NOT NULL DEFAULT false
);
