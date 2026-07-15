"""Testes dos adaptadores das fontes oficiais, sem acesso à rede."""

import unittest

import pandas as pd

from fontes_reais import (
    adapt_comex_frame,
    adapt_ncm_prodlist_frame,
    adapt_pia_response,
    comex_url,
    pia_api_url,
    build_quality_report,
    RealSourceResult,
)
from pipeline_harmonizacao import build_relational_model


class RealSourcesTests(unittest.TestCase):
    def test_comex_official_layout_is_adapted(self) -> None:
        official = pd.DataFrame(
            {
                "CO_ANO": [2024], "CO_MES": [1], "CO_NCM": ["01012100"],
                "CO_UNID": [11], "CO_PAIS": [249], "SG_UF_NCM": ["SP"],
                "CO_VIA": [1], "CO_URF": [817600], "QT_ESTAT": [2],
                "KG_LIQUIDO": [900], "VL_FOB": [1000],
            }
        )
        result = adapt_comex_frame(official, "EXP")
        self.assertEqual(result.loc[0, "ncm"], "01012100")
        self.assertEqual(result.loc[0, "flow"], "EXP")
        self.assertEqual(result.loc[0, "value_usd"], 1000)

    def test_mapping_official_headers_are_detected(self) -> None:
        official = pd.DataFrame(
            {
                "PRODLIST-Ind 2022": ["0500.2010", "2121.2400"],
                "NCM 2022 (SET/2022)": ["2701.19.00", "Vazio"],
            }
        )
        result = adapt_ncm_prodlist_frame(official)
        self.assertEqual(result.to_dict("records"), [
            {"ncm": "2701.19.00", "prodlist_code": "0500.2010"}
        ])

    def test_pia_products_and_confidentiality_are_preserved(self) -> None:
        payload = [{"resultados": [
            {"classificacoes": [{"categoria": {"1": "0500 Extração"}}],
             "series": [{"serie": {"2024": "100"}}]},
            {"classificacoes": [{"categoria": {"2": "0500.2010 Carvão mineral"}}],
             "series": [{"serie": {"2024": "123"}}]},
            {"classificacoes": [{"categoria": {"3": "0500.2030 Hulhas"}}],
             "series": [{"serie": {"2024": "X"}}]},
        ]}]
        result = adapt_pia_response(payload, 2024)
        self.assertEqual(result["prodlist_code"].tolist(), ["0500.2010", "0500.2030"])
        self.assertEqual(result["production_status"].tolist(), ["published", "confidential"])
        self.assertTrue(pd.isna(result.loc[1, "production_value_thousand_brl"]))

    def test_official_urls_are_stable_and_year_aware(self) -> None:
        self.assertTrue(comex_url(2024, "IMP").endswith("/IMP_2024.csv"))
        self.assertIn("/10476/periodos/2024/", pia_api_url(2024))
        self.assertIn("classificacao=1264%5Ball%5D", pia_api_url(2024))

    def test_quality_report_covers_unmapped_duplicates_and_controls(self) -> None:
        trade = pd.DataFrame({
            "year": [2024, 2024, 2024], "month": [1, 1, 1],
            "flow": ["EXP", "EXP", "EXP"],
            "ncm": ["01012100", "01012100", "99999999"],
            "value_usd": [100.0, 100.0, 50.0],
            "net_weight_kg": [10.0, 10.0, 5.0],
        })
        mapping = pd.DataFrame({
            "ncm": ["01012100", "01012100"],
            "prodlist_code": ["0500.2010", "0500.2010"],
        })
        production = pd.DataFrame({
            "year": [2024, 2024],
            "prodlist_code": ["0500.2010", "9999.1010"],
            "production_status": ["published", "published"],
            "cnae_class": ["0500", "9999"],
            "production_value_thousand_brl": [300.0, 200.0],
        })
        model = build_relational_model(
            trade, mapping, production,
            trade_grain_cols=["year", "month", "flow"],
            production_measure_cols=["production_value_thousand_brl"],
            production_grain_cols=["year", "prodlist_code", "production_status"],
        )

        report = build_quality_report(
            RealSourceResult(trade, mapping, production, model)
        )

        self.assertEqual(report["coverage"]["ncm"]["rate"], 0.5)
        self.assertEqual(report["unmapped"]["trade_value_usd"], 50.0)
        self.assertEqual(report["duplicates"]["trade_exact_rows"], 1)
        self.assertEqual(report["duplicates"]["ncm_prodlist_pairs"], 1)
        self.assertEqual(
            report["control_totals"]["trade_value_usd"]["difference"], 0.0
        )


if __name__ == "__main__":
    unittest.main()
