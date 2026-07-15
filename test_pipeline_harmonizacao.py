"""Testes de regressão do pipeline de harmonização Border Value Brasil.

Execução local, sem dependências adicionais::

    python -m unittest -v
"""

import unittest

import pandas as pd

from pipeline_harmonizacao import (
    LOGGER,
    PipelineValidationError,
    allocate_trade_to_cnae,
    aggregate_trade_by_ncm,
    build_ncm_prodlist_cnae_crosswalk,
    build_relational_model,
    flag_generic_ncm,
    normalize_ncm,
    tables_as_mapping,
)


class HarmonizationPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.trade = pd.DataFrame(
            {
                "ncm": ["01234569", "01234569", "01234590", "87654321"],
                "flow": ["EXP", "EXP", "IMP", "EXP"],
                "year": [2025, 2025, 2025, 2025],
                "value_usd": [10.0, 5.0, 20.0, 30.0],
                "net_weight_kg": [1.0, 0.5, 2.0, 3.0],
            }
        )
        # Relação 1:N intencional para testar proteção contra dupla contagem.
        self.ncm_prodlist = pd.DataFrame(
            {
                "ncm": ["01234569", "01234569", "01234590"],
                "prodlist_code": ["1234.10.00", "1234.20.00", "5678.90.00"],
            }
        )
        self.production = pd.DataFrame(
            {
                "cnae_class": ["1234", "5678", "9999"],
                "production_value": [100.0, 200.0, 300.0],
            }
        )

    def test_normalize_ncm_preserves_eight_digit_granularity(self) -> None:
        cases = [
            ([1234567], ["01234567"]),
            ([1234567.0], ["01234567"]),
            (["0123.45.67"], ["01234567"]),
            (["2701.19.00"], ["27011900"]),
            (["12345678"], ["12345678"]),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                result = normalize_ncm(pd.Series(raw))
                self.assertEqual(result.tolist(), expected)
                self.assertTrue(result.str.len().eq(8).all())

    def test_normalize_ncm_rejects_invalid_codes(self) -> None:
        for invalid in ([None], ["123456789"], ["NCM-ABC"]):
            with self.subTest(invalid=invalid):
                with self.assertRaises(PipelineValidationError):
                    normalize_ncm(pd.Series(invalid))

    def test_trade_is_aggregated_by_ncm8_and_declared_grain(self) -> None:
        result = aggregate_trade_by_ncm(
            self.trade,
            grain_cols=["year", "flow"],
        )
        row = result.loc[
            (result["ncm"] == "01234569") & (result["flow"] == "EXP")
        ].squeeze()

        self.assertAlmostEqual(row["value_usd"], 15.0)
        self.assertAlmostEqual(row["net_weight_kg"], 1.5)
        self.assertNotIn("hs6", result.columns)

    def test_hs6_is_explicitly_forbidden_as_trade_group_key(self) -> None:
        frame = self.trade.assign(hs6=self.trade["ncm"].str[:6])

        with self.assertRaisesRegex(PipelineValidationError, "HS6"):
            aggregate_trade_by_ncm(frame, grain_cols=["year", "hs6"])

    def test_generic_flag_covers_business_rule_suffixes(self) -> None:
        cases = [
            ("12345679", True),
            ("12345690", True),
            ("12345699", True),
            ("12345678", False),
        ]
        for ncm, expected in cases:
            with self.subTest(ncm=ncm):
                result = flag_generic_ncm(pd.DataFrame({"ncm": [ncm]}))
                self.assertIs(bool(result.loc[0, "is_generic_code"]), expected)

    def test_generic_code_emits_manual_concla_audit_warning(self) -> None:
        with self.assertLogs(LOGGER, level="WARNING") as captured:
            flag_generic_ncm(pd.DataFrame({"ncm": ["12345690"]}))

        log = "\n".join(captured.output)
        self.assertIn("auditoria qualitativa manual", log)
        self.assertIn("CONCLA", log)
        self.assertIn("Não utilizar IA generativa", log)

    def test_crosswalk_uses_first_four_prodlist_digits_as_exact_cnae(self) -> None:
        result = build_ncm_prodlist_cnae_crosswalk(
            self.trade[["ncm"]].drop_duplicates(),
            self.ncm_prodlist,
            self.production,
        )
        links = set(
            result.loc[
                result["has_prodlist_match"], ["prodlist_code", "cnae_class"]
            ].itertuples(index=False, name=None)
        )

        self.assertEqual(
            links,
            {
                ("1234.10.00", "1234"),
                ("1234.20.00", "1234"),
                ("5678.90.00", "5678"),
            },
        )
        unmatched = result.loc[result["ncm"] == "87654321", "has_prodlist_match"]
        self.assertTrue(unmatched.eq(False).all())

    def test_crosswalk_rejects_short_prodlist_code(self) -> None:
        invalid_mapping = pd.DataFrame(
            {"ncm": ["01234569"], "prodlist_code": ["12.3"]}
        )

        with self.assertRaisesRegex(PipelineValidationError, "quatro dígitos"):
            build_ncm_prodlist_cnae_crosswalk(
                self.trade[["ncm"]].drop_duplicates(),
                invalid_mapping,
                self.production,
            )

    def test_model_does_not_duplicate_trade_on_one_to_many_mapping(self) -> None:
        model = build_relational_model(
            self.trade,
            self.ncm_prodlist,
            self.production,
            trade_grain_cols=["year", "flow"],
            production_measure_cols=["production_value"],
        )

        self.assertAlmostEqual(
            model.fact_trade["value_usd"].sum(), self.trade["value_usd"].sum()
        )
        self.assertAlmostEqual(
            model.fact_trade["net_weight_kg"].sum(),
            self.trade["net_weight_kg"].sum(),
        )
        links = model.bridge_ncm_prodlist_cnae.query("ncm == '01234569'")
        self.assertEqual(len(links), 2)
        self.assertAlmostEqual(links["allocation_weight"].sum(), 1.0)

    def test_trade_is_weighted_by_cnae_production_value_when_available(self) -> None:
        mapping = pd.DataFrame(
            {
                "ncm": ["01234569", "01234569", "01234569", "01234590"],
                "prodlist_code": [
                    "1234.10.00",
                    "1234.20.00",
                    "5678.10.00",
                    "5678.90.00",
                ],
            }
        )
        model = build_relational_model(
            self.trade,
            mapping,
            self.production,
            trade_grain_cols=["year", "flow"],
        )

        result = allocate_trade_to_cnae(
            model.fact_trade,
            model.bridge_ncm_prodlist_cnae,
            grain_cols=["year", "flow"],
        )
        exp = result.query("flow == 'EXP'").set_index("cnae_class")

        self.assertAlmostEqual(exp.loc["1234", "value_usd"], 5.0)
        self.assertAlmostEqual(exp.loc["5678", "value_usd"], 10.0)
        weights = model.bridge_ncm_prodlist_cnae.query("ncm == '01234569'")
        by_cnae = weights.groupby("cnae_class")["allocation_weight"].sum()
        self.assertAlmostEqual(by_cnae.loc["1234"], 1 / 3)
        self.assertAlmostEqual(by_cnae.loc["5678"], 2 / 3)
        self.assertEqual(
            set(weights["allocation_rule"]), {"production_value_weighted_cnae"}
        )

    def test_trade_falls_back_to_equal_allocation_without_economic_basis(self) -> None:
        mapping = pd.DataFrame(
            {
                "ncm": ["01234569", "01234569", "01234569"],
                "prodlist_code": ["1234.10.00", "1234.20.00", "5678.10.00"],
            }
        )
        production = self.production.drop(columns="production_value")
        model = build_relational_model(
            self.trade,
            mapping,
            production,
            trade_grain_cols=["year", "flow"],
        )

        result = allocate_trade_to_cnae(
            model.fact_trade,
            model.bridge_ncm_prodlist_cnae,
            grain_cols=["year", "flow"],
        )
        exp = result.query("flow == 'EXP'").set_index("cnae_class")

        self.assertAlmostEqual(exp.loc["1234", "value_usd"], 7.5)
        self.assertAlmostEqual(exp.loc["5678", "value_usd"], 7.5)
        weights = model.bridge_ncm_prodlist_cnae.query("ncm == '01234569'")
        by_cnae = weights.groupby("cnae_class")["allocation_weight"].sum()
        self.assertAlmostEqual(by_cnae.loc["1234"], 0.5)
        self.assertAlmostEqual(by_cnae.loc["5678"], 0.5)
        self.assertEqual(
            set(weights["allocation_rule"]), {"equal_share_distinct_cnae"}
        )

    def test_dimensions_include_unmatched_ncm_and_domestic_cnae(self) -> None:
        model = build_relational_model(
            self.trade,
            self.ncm_prodlist,
            self.production,
            production_measure_cols=["production_value"],
        )

        self.assertIn("87654321", set(model.dim_ncm["ncm"]))
        self.assertIn("9999", set(model.dim_cnae["cnae_class"]))
        self.assertTrue(model.fact_production["cnae_key"].notna().all())

    def test_dimensions_and_bridge_are_ordered_before_facts(self) -> None:
        model = build_relational_model(
            self.trade,
            self.ncm_prodlist,
            self.production,
            production_measure_cols=["production_value"],
        )

        self.assertEqual(
            list(tables_as_mapping(model)),
            [
                "dim_ncm",
                "dim_prodlist",
                "dim_cnae",
                "bridge_ncm_prodlist_cnae",
                "fact_trade",
                "fact_production",
            ],
        )

    def test_non_numeric_trade_measure_is_rejected(self) -> None:
        invalid = self.trade.copy()
        invalid["value_usd"] = invalid["value_usd"].astype("object")
        invalid.loc[0, "value_usd"] = "valor inválido"

        with self.assertRaisesRegex(PipelineValidationError, "não numéricos"):
            aggregate_trade_by_ncm(invalid)

    def test_real_2022_mapping_sample_preserves_ncm8_prodlist_and_cnae(self) -> None:
        """Amostra transcrita da correspondência oficial CONCLA 2022."""

        ncm_reference = pd.DataFrame(
            {"ncm": ["2701.19.00", "2711.11.00", "2601.12.10"]}
        )
        official_sample = pd.DataFrame(
            {
                "ncm": ["2701.19.00", "2701.19.00", "2711.11.00", "2601.12.10"],
                "prodlist_code": [
                    "0500.2010",
                    "0500.2030",
                    "0600.2010",
                    "0710.2015",
                ],
            }
        )
        production = pd.DataFrame({"cnae_class": ["0500", "0600", "0710"]})

        result = build_ncm_prodlist_cnae_crosswalk(
            ncm_reference, official_sample, production
        )

        self.assertEqual(
            set(result[["ncm", "prodlist_code", "cnae_class"]].itertuples(index=False, name=None)),
            {
                ("27011900", "0500.2010", "0500"),
                ("27011900", "0500.2030", "0500"),
                ("27111100", "0600.2010", "0600"),
                ("26011210", "0710.2015", "0710"),
            },
        )

    def test_annual_ncm_prodlist_cnae_change_does_not_leak_between_years(self) -> None:
        trade = pd.DataFrame(
            {
                "year": [2023, 2024],
                "flow": ["EXP", "EXP"],
                "ncm": ["27011900", "27011900"],
                "value_usd": [100.0, 200.0],
                "net_weight_kg": [10.0, 20.0],
            }
        )
        annual_mapping = pd.DataFrame(
            {
                "year": [2023, 2024],
                "ncm": ["27011900", "27011900"],
                "prodlist_code": ["0500.2030", "0600.2010"],
            }
        )
        annual_production = pd.DataFrame(
            {
                "year": [2023, 2024],
                "prodlist_code": ["0500.2030", "0600.2010"],
                "cnae_class": ["0500", "0600"],
                "production_value": [300.0, 400.0],
            }
        )

        model = build_relational_model(
            trade,
            annual_mapping,
            annual_production,
            trade_grain_cols=["year", "flow"],
            production_grain_cols=["year", "prodlist_code"],
            production_measure_cols=["production_value"],
        )
        allocated = allocate_trade_to_cnae(
            model.fact_trade,
            model.bridge_ncm_prodlist_cnae,
            grain_cols=["year", "flow"],
        )

        self.assertEqual(
            set(model.bridge_ncm_prodlist_cnae[["year", "ncm", "prodlist_code", "cnae_class"]].itertuples(index=False, name=None)),
            {
                (2023, "27011900", "0500.2030", "0500"),
                (2024, "27011900", "0600.2010", "0600"),
            },
        )
        self.assertEqual(
            set(allocated[["year", "cnae_class", "value_usd"]].itertuples(index=False, name=None)),
            {(2023, "0500", 100.0), (2024, "0600", 200.0)},
        )

    def test_ncm_created_in_new_year_is_unmapped_in_previous_year(self) -> None:
        reference = pd.DataFrame(
            {"year": [2023, 2024], "ncm": ["29398010", "29398010"]}
        )
        mapping = pd.DataFrame(
            {"year": [2024], "ncm": ["29398010"], "prodlist_code": ["2099.1010"]}
        )
        production = pd.DataFrame(
            {"year": [2023, 2024], "cnae_class": ["2099", "2099"]}
        )

        result = build_ncm_prodlist_cnae_crosswalk(reference, mapping, production)

        by_year = result.set_index("year")
        self.assertFalse(bool(by_year.loc[2023, "has_prodlist_match"]))
        self.assertTrue(bool(by_year.loc[2024, "has_prodlist_match"]))

    def test_confidential_pia_status_is_preserved_in_bridge_and_fact(self) -> None:
        trade = pd.DataFrame(
            {
                "year": [2024, 2024],
                "flow": ["IMP", "IMP"],
                "ncm": ["27011900", "27011900"],
                "value_usd": [100.0, 100.0],
                "net_weight_kg": [10.0, 10.0],
            }
        )
        mapping = pd.DataFrame(
            {
                "ncm": ["27011900", "27011900"],
                "prodlist_code": ["0500.2010", "0600.2010"],
            }
        )
        production = pd.DataFrame(
            {
                "year": [2024, 2024],
                "cnae_class": ["0500", "0600"],
                "production_value": [pd.NA, 400.0],
                "production_status": ["confidential", "published"],
            }
        )

        model = build_relational_model(
            trade,
            mapping,
            production,
            trade_grain_cols=["year", "flow"],
            production_grain_cols=["year"],
            production_measure_cols=["production_value"],
        )

        bridge_status = dict(
            model.bridge_ncm_prodlist_cnae[
                ["cnae_class", "allocation_basis_status"]
            ].itertuples(index=False, name=None)
        )
        fact_status = dict(
            model.fact_production[["cnae_class", "production_status"]].itertuples(
                index=False, name=None
            )
        )

        self.assertEqual(bridge_status["0500"], "confidential")
        self.assertEqual(bridge_status["0600"], "published")
        self.assertEqual(fact_status["0500"], "confidential")
        self.assertEqual(fact_status["0600"], "published")
        self.assertEqual(
            set(model.bridge_ncm_prodlist_cnae["allocation_rule"]),
            {"equal_share_distinct_cnae"},
        )


if __name__ == "__main__":
    unittest.main()
