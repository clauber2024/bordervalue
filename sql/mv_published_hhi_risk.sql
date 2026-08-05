-- Camada published para indicadores de risco por concentracao de origem.
-- Banco-alvo: PostgreSQL.

CREATE MATERIALIZED VIEW mv_published_hhi_risk AS
WITH country_shares AS (
    SELECT
        conceptual_product_id,
        principal_pais_origem,
        -- Share individual por pais de origem no valor importado do produto.
        SUM(importacao_valor_fob)::numeric
            / NULLIF(
                (SUM(SUM(importacao_valor_fob)) OVER (
                    PARTITION BY conceptual_product_id
                ))::numeric,
                0
            ) AS share
    FROM analytical_comex_staging
    GROUP BY conceptual_product_id, principal_pais_origem
),
-- Ranking do pais com maior share por produto, para expor
-- principal_pais_origem/principal_pais_participacao (colunas que
-- database/data_access.py::_map_published_row ja espera, mas que esta
-- view nunca calculou ate agora).
ranked_country_shares AS (
    SELECT
        conceptual_product_id,
        principal_pais_origem,
        share,
        ROW_NUMBER() OVER (
            PARTITION BY conceptual_product_id ORDER BY share DESC NULLS LAST
        ) AS rank_share
    FROM country_shares
)
SELECT
    cs.conceptual_product_id,
    -- HHI = soma dos quadrados dos shares * 10000, na escala 0-10000.
    SUM(POWER(cs.share, 2)) * 10000 AS hhi_global,
    top.principal_pais_origem,
    top.share AS principal_pais_participacao
FROM country_shares AS cs
LEFT JOIN ranked_country_shares AS top
    ON top.conceptual_product_id = cs.conceptual_product_id
    AND top.rank_share = 1
GROUP BY cs.conceptual_product_id, top.principal_pais_origem, top.share;

CREATE UNIQUE INDEX IF NOT EXISTS idx_published_hhi_risk_product_id
    ON mv_published_hhi_risk(conceptual_product_id);
