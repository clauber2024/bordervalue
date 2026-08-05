-- Camada published para consumo rapido pelo front-end.
-- Banco-alvo: PostgreSQL.

CREATE MATERIALIZED VIEW mv_published_indicators AS
WITH aggregated_trade AS (
    -- Consolidacao dos dados comerciais por produto conceitual.
    SELECT
        conceptual_product_id,
        -- cadeia_prioritaria e constante por produto (mesma cadeia em todas
        -- as linhas de pais); MAX so para poder participar do GROUP BY.
        MAX(cadeia_prioritaria) AS cadeia_prioritaria,
        SUM(importacao_valor_fob) AS total_import_fob,
        SUM(importacao_peso_liquido) AS total_import_kg,
        SUM(exportacao_valor_fob) AS total_export_fob,
        SUM(importacao_valor_fob) - SUM(exportacao_valor_fob) AS deficit_comercial
    FROM analytical_comex_staging
    GROUP BY conceptual_product_id
),
aggregated_industry AS (
    -- Consolidacao da PIA e RAIS com o fator de rateio 1:N aplicado.
    SELECT
        conceptual_product_id,
        SUM(valor_producao_pia * proportion_factor) AS production_weighted,
        SUM(qtde_vinculos_rais * proportion_factor) AS employment_weighted,
        SUM(massa_salarial_rais * proportion_factor) AS salary_mass_weighted
    FROM analytical_industry_and_employment
    GROUP BY conceptual_product_id
)
SELECT
    t.conceptual_product_id,
    t.cadeia_prioritaria,
    t.total_import_fob,
    t.total_import_kg,
    t.total_export_fob,
    t.deficit_comercial,
    i.production_weighted,
    -- Calculo do consumo aparente: producao + importacao - exportacao.
    i.production_weighted + t.total_import_fob - t.total_export_fob AS consumo_aparente,
    -- Dependencia externa real com trava contra divisao por zero.
    t.total_import_fob::numeric
        / NULLIF(
            (i.production_weighted + t.total_import_fob - t.total_export_fob)::numeric,
            0
        ) AS dependencia_externa_fracao,
    i.employment_weighted,
    i.salary_mass_weighted
FROM aggregated_trade AS t
LEFT JOIN aggregated_industry AS i
    ON t.conceptual_product_id = i.conceptual_product_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_published_product_id
    ON mv_published_indicators(conceptual_product_id);
