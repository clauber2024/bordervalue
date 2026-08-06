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
        -- constantes por produto (mesmo padrao de MAX(cadeia_prioritaria)
        -- acima) -- ver comentario em 000_analytical_base_tables.sql.
        MAX(produto_nome) AS produto_nome,
        MAX(ncm_codigo) AS ncm_codigo,
        MAX(cnae_codigo) AS cnae_codigo,
        MAX(prodlist_codigo) AS prodlist_codigo,
        SUM(valor_producao_pia * proportion_factor) AS production_weighted,
        SUM(qtde_vinculos_rais * proportion_factor) AS employment_weighted,
        SUM(massa_salarial_rais * proportion_factor) AS salary_mass_weighted
    FROM analytical_industry_and_employment
    GROUP BY conceptual_product_id
),
aggregated_renovacalc AS (
    -- Fator de proporcionalidade real para a cadeia combustiveis_transicao
    -- (etanol, biodiesel), a partir dos certificados ANP/RenovaBio ativos
    -- ("Validos") carregados por build_renovacalc_factors.py. Media simples
    -- (nao ponderada) do volume elegivel entre certificados ativos -- mesmo
    -- metodo usado pelo Painel Dinamico RenovaBio da ANP para a metrica
    -- equivalente por rota (ver docstring do loader). Produtos sem
    -- correspondencia aqui (ex: hidrogenio, gas_natural_biometano) ficam
    -- sem fator_alpha nesta view -- data_access.py aplica o default 1.0/
    -- aplicado=False de forma generica.
    SELECT
        conceptual_product_id,
        AVG(volume_elegivel_fracao) AS fator_alpha,
        COUNT(*) AS certificacoes_count
    FROM analytical_renovacalc_certification
    WHERE conceptual_product_id IS NOT NULL
      AND volume_elegivel_fracao IS NOT NULL
    GROUP BY conceptual_product_id
)
SELECT
    t.conceptual_product_id,
    t.cadeia_prioritaria,
    i.produto_nome,
    i.ncm_codigo,
    i.cnae_codigo,
    i.prodlist_codigo,
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
    i.salary_mass_weighted,
    r.fator_alpha,
    (r.fator_alpha IS NOT NULL AND r.fator_alpha < 1.0) AS fator_proporcionalidade_aplicado,
    CASE WHEN r.fator_alpha IS NOT NULL THEN
        'ANP/RenovaBio - Certificados de Producao Eficiente (Validos, media nao ponderada de '
            || r.certificacoes_count || ' certificados ativos)'
    END AS fonte_proxy
FROM aggregated_trade AS t
LEFT JOIN aggregated_industry AS i
    ON t.conceptual_product_id = i.conceptual_product_id
LEFT JOIN aggregated_renovacalc AS r
    ON t.conceptual_product_id = r.conceptual_product_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_published_product_id
    ON mv_published_indicators(conceptual_product_id);
