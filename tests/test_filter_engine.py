from __future__ import annotations

import unittest

import pandas as pd

from dashboard.filter_engine import filter_trade
from database.data_access import PublishedFilters, filter_published_products


class FilterEngineTest(unittest.TestCase):
    def test_trade_engine_applies_bi_filters_and_aliases(self) -> None:
        frame = pd.DataFrame(
            [
                {
                    "period": "2026-01",
                    "flow": "IMP",
                    "cadeia_prioritaria": "fertilizantes",
                    "conceptual_product_id": "prod_cloreto_potassio",
                    "ncm": "31042090",
                    "cnae_class": "2012",
                    "prodlist_code": "2012.2060",
                    "country_code": "149",
                    "mapping_status": "Mapeado",
                    "confidence_level": "alta",
                },
                {
                    "period": "2026-02",
                    "flow": "EXP",
                    "cadeia_prioritaria": "aco",
                    "conceptual_product_id": "prod_aco",
                    "ncm": "72011000",
                    "cnae_class": "2411",
                    "prodlist_code": "2411.2010",
                    "country_code": "160",
                    "mapping_status": "NCM generico",
                    "confidence_level": "baixa",
                },
            ]
        )

        result = filter_trade(
            frame,
            {
                "period": "2026-01",
                "flow": "IMP",
                "chain": "fertilizantes",
                "product": "prod_cloreto_potassio",
                "ncm": "310420",
                "cnae": "2012",
                "prodlist": "2012.2060",
                "country": "Canada",
                "status": "Mapeado",
                "confidence": "high",
            },
            country_labels={"149": "Canada"},
        )

        self.assertEqual(result["conceptual_product_id"].tolist(), ["prod_cloreto_potassio"])

    def test_published_filters_match_product_contract(self) -> None:
        product = {
            "conceptual_product_id": "prod_cloreto_potassio",
            "cadeia_prioritaria": "fertilizantes",
            "ncm_codigo": "31042090",
            "comercio": {
                "importacao_valor_fob": 100.0,
                "exportacao_valor_fob": 0.0,
                "principal_pais_origem": "Canada",
            },
            "industria": {
                "cnae_codigo": "2012",
                "prodlist_codigo": "20122060",
            },
            "auditoria": {
                "reference_year": 2026,
                "confidence_level": "alta",
                "is_ncm_generica": False,
                "has_sigilo_pia": False,
            },
        }

        result = filter_published_products(
            [product],
            PublishedFilters(
                period="2026-H1",
                flow="IMP",
                chain="fertilizers",
                conceptual_product="prod_cloreto_potassio",
                ncm="310420",
                cnae="2012",
                prodlist="20122060",
                partner="Canada",
                mapping_status="mapeado",
                confidence="high",
            ),
        )

        self.assertEqual(len(result), 1)


if __name__ == "__main__":
    unittest.main()
