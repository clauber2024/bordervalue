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
)
SELECT
    conceptual_product_id,
    -- HHI = soma dos quadrados dos shares * 10000, na escala 0-10000.
    SUM(POWER(share, 2)) * 10000 AS hhi_global
FROM country_shares
GROUP BY conceptual_product_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_published_hhi_risk_product_id
    ON mv_published_hhi_risk(conceptual_product_id);
