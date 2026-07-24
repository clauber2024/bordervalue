-- Camada published para territorializacao de empregos e massa salarial TSB.
-- Banco-alvo: PostgreSQL.

CREATE MATERIALIZED VIEW mv_published_territorial_tsb AS
SELECT
    municipio_ibge_code,
    uf_sigla,
    conceptual_product_id,
    SUM(qtde_vinculos_rais) AS total_empregos_tsb,
    SUM(massa_salarial_rais) AS total_massa_salarial
FROM analytical_employment_by_municipality
WHERE is_tsb_sector = TRUE
GROUP BY municipio_ibge_code, uf_sigla, conceptual_product_id;

CREATE INDEX IF NOT EXISTS idx_territorial_municipio
    ON mv_published_territorial_tsb(municipio_ibge_code);
