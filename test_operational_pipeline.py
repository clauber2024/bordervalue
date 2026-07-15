"""Testes dos adaptadores de layouts oficiais."""

import unittest

import pandas as pd

from operational_pipeline import (
    adapt_rais_employment,
    adapt_comex_stat,
    adapt_domestic_production,
    adapt_ncm_prodlist,
    build_border_value_indicators,
    build_fact_employment_rais,
)


class OperationalPipelineTests(unittest.TestCase):
    def test_adapts_official_comex_layout(self) -> None:
        raw = pd.DataFrame(
            {
                "CO_ANO": [2026],
                "CO_MES": [1],
                "CO_NCM": ["27011100"],
                "VL_FOB": [100],
                "KG_LIQUIDO": [20],
            }
        )
        result = adapt_comex_stat(raw, flow="exp")
        self.assertEqual(result.loc[0, "flow"], "EXP")
        self.assertEqual(result.loc[0, "ncm"], "27011100")

    def test_adapts_current_concla_typo_in_header(self) -> None:
        raw = pd.DataFrame(
            {"PRODLSIT 2025": ["0500.2010"], "NCM 2025": ["2701.11.00"]}
        )
        result = adapt_ncm_prodlist(raw)
        self.assertEqual(result.loc[0, "prodlist_code"], "0500.2010")

    def test_adapts_historical_concla_2022_headers(self) -> None:
        raw = pd.DataFrame(
            {"PRODLIST-Ind 2022": ["0500.2010"], "NCM 2022 (SET/2022)": ["2701.19.00"]}
        )
        result = adapt_ncm_prodlist(raw)
        self.assertEqual(result.loc[0, "prodlist_code"], "0500.2010")
        self.assertEqual(result.loc[0, "ncm"], "2701.19.00")

    def test_sidra_adapter_keeps_classes_and_not_product_rows(self) -> None:
        raw = pd.DataFrame(
            {
                "D4N": [
                    "0000",
                    "0500 Extração de carvão mineral",
                    "0500.2010 Carvão mineral",
                    "0600 Extração de petróleo e gás natural",
                ],
                "V": ["7579336882", "2241383", "2113992", "X"],
                "D3N": ["2024", "2024", "2024", "2024"],
            }
        )
        result = adapt_domestic_production(raw)
        self.assertEqual(result["cnae_class"].tolist(), ["0500", "0600"])
        self.assertTrue(pd.isna(result.iloc[1]["production_value"]))
        self.assertEqual(result["production_status"].tolist(), ["published", "confidential"])

    def test_builds_border_value_indicators_by_cnae(self) -> None:
        trade = pd.DataFrame(
            {
                "year": [2026, 2026, 2026],
                "month": [1, 1, 2],
                "flow": ["EXP", "IMP", "IMP"],
                "cnae_key": [1, 1, 1],
                "cnae_class": ["1234", "1234", "1234"],
                "value_usd": [40.0, 25.0, 15.0],
                "net_weight_kg": [4.0, 2.5, 1.5],
                "allocation_status": ["allocated_cnae"] * 3,
            }
        )
        production = pd.DataFrame(
            {"cnae_key": [1], "cnae_class": ["1234"], "production_value": [100.0]}
        )

        result = build_border_value_indicators(
            trade,
            production,
            production_value_to_trade_value_factor=10.0,
        )
        row = result.iloc[0]

        self.assertAlmostEqual(row["import_value_usd"], 40.0)
        self.assertAlmostEqual(row["export_value_usd"], 40.0)
        self.assertAlmostEqual(row["trade_balance_usd"], 0.0)
        self.assertAlmostEqual(row["domestic_production_value_usd_comparable"], 1000.0)
        self.assertAlmostEqual(row["apparent_consumption_value_usd"], 1000.0)
        self.assertAlmostEqual(row["external_dependency_ratio"], 0.04)
        self.assertEqual(row["external_dependency_status"], "calculated")
        self.assertTrue(pd.isna(row["rais_formal_jobs"]))

    def test_adapts_rais_employment_layer(self) -> None:
        raw = pd.DataFrame(
            {
                "Ano": [2024, 2024],
                "CNAE 2.0 Classe": ["0891 Extração de minerais", "0891"],
                "UF": ["mg", "MG"],
                "Município": ["3106200", "3106200"],
                "Vínculo Ativo 31/12": ["10", "5"],
                "Salário Médio": ["2.000,50", "1000"],
            }
        )

        result = adapt_rais_employment(raw)

        self.assertEqual(result["cnae_class"].tolist(), ["0891", "0891"])
        self.assertEqual(result["uf"].tolist(), ["MG", "MG"])
        self.assertEqual(result["municipality_code"].tolist(), ["3106200", "3106200"])
        self.assertAlmostEqual(result.loc[0, "wage_mass"], 20005.0)

    def test_builds_rais_fact_and_enriches_cnae_indicators(self) -> None:
        rais = pd.DataFrame(
            {
                "year": [2024, 2024],
                "uf": ["MG", "MG"],
                "municipality_code": ["3106200", "3106200"],
                "cnae_class": ["0891", "0891"],
                "formal_jobs": [10.0, 5.0],
                "wage_mass": [20000.0, 10000.0],
                "average_wage": [2000.0, 2000.0],
            }
        )
        dim_cnae = pd.DataFrame({"cnae_key": [1], "cnae_class": ["0891"]})
        fact_rais = build_fact_employment_rais(rais, dim_cnae)
        trade = pd.DataFrame(
            {
                "flow": ["IMP"],
                "cnae_key": [1],
                "cnae_class": ["0891"],
                "value_usd": [25.0],
                "net_weight_kg": [2.5],
            }
        )
        production = pd.DataFrame(
            {"cnae_key": [1], "cnae_class": ["0891"], "production_value": [100.0]}
        )

        result = build_border_value_indicators(
            trade,
            production,
            fact_employment_rais=fact_rais,
        )

        self.assertEqual(len(fact_rais), 1)
        self.assertEqual(fact_rais.loc[0, "formal_jobs"], 15.0)
        self.assertEqual(result.loc[0, "rais_formal_jobs"], 15.0)
        self.assertEqual(result.loc[0, "rais_wage_mass"], 30000.0)
        self.assertEqual(result.loc[0, "rais_average_wage"], 2000.0)

    def test_dependency_is_not_calculated_without_comparable_value_units(self) -> None:
        trade = pd.DataFrame(
            {
                "flow": ["IMP"],
                "cnae_key": [1],
                "cnae_class": ["1234"],
                "value_usd": [25.0],
                "net_weight_kg": [2.5],
            }
        )
        production = pd.DataFrame(
            {"cnae_key": [1], "cnae_class": ["1234"], "production_value": [100.0]}
        )

        result = build_border_value_indicators(trade, production)

        self.assertTrue(pd.isna(result.loc[0, "external_dependency_ratio"]))
        self.assertEqual(
            result.loc[0, "external_dependency_status"],
            "not_comparable_value_units",
        )

    def test_confidential_pia_is_signaled_and_not_imputed_in_indicators(self) -> None:
        trade = pd.DataFrame(
            {
                "flow": ["IMP"],
                "cnae_key": [1],
                "cnae_class": ["1234"],
                "value_usd": [25.0],
                "net_weight_kg": [2.5],
            }
        )
        production = pd.DataFrame(
            {
                "cnae_key": [1],
                "cnae_class": ["1234"],
                "production_value": [pd.NA],
                "production_status": ["confidential"],
            }
        )

        result = build_border_value_indicators(
            trade,
            production,
            production_value_to_trade_value_factor=10.0,
        )

        self.assertTrue(pd.isna(result.loc[0, "domestic_production_value_brl_thousand"]))
        self.assertEqual(result.loc[0, "domestic_production_status"], "confidential")
        self.assertTrue(result.loc[0, "domestic_production_is_confidential"])
        self.assertTrue(pd.isna(result.loc[0, "apparent_consumption_value_usd"]))
        self.assertTrue(pd.isna(result.loc[0, "external_dependency_ratio"]))
        self.assertEqual(
            result.loc[0, "external_dependency_status"],
            "not_calculated_confidential_pia",
        )


if __name__ == "__main__":
    unittest.main()
