import unittest

import pandas as pd

from build_tsb_bridge import add_tsb_platform_alignment_score, build_cnae_bridge, build_ncm_bridge, build_rais_outputs


class TsbBridgeTest(unittest.TestCase):
    def test_cnae5_class_bridge_preserves_class_granularity(self):
        cnae5 = pd.DataFrame(
            {
                "cnae5": pd.Series(["07103", "07219"], dtype="string"),
                "descricao_cnae5": pd.Series(["Minerio de ferro", "Minerio de aluminio"], dtype="string"),
                "scn67": pd.Series(["0791", "0792"], dtype="string"),
                "setor_scn67": pd.Series(["Ferro", "Nao ferrosos"], dtype="string"),
                "criterio_classificacao": pd.Series(["TSB=Sim", "TSB=Sim"], dtype="string"),
            }
        )
        scn67 = pd.DataFrame(
            {
                "scn67": pd.Series(["0791", "0792"], dtype="string"),
                "exposicao_tsb_ratio": [1.0, 0.4672],
                "grupo_exposicao": pd.Series(["Alta exposicao TSB", "Exposicao intermediaria TSB"], dtype="string"),
                "leitura_tecnica": pd.Series(["Integral", "Parcial"], dtype="string"),
                "exposure_rank": [2, 1],
            }
        )
        dim_cnae = pd.DataFrame({"cnae_key": [1, 2, 3], "cnae_class": pd.Series(["0710", "0721", "1011"], dtype="string")})

        result = build_cnae_bridge(cnae5, scn67, dim_cnae)

        by_cnae = result.set_index("cnae_class")
        self.assertTrue(bool(by_cnae.loc["0710", "tsb_associated"]))
        self.assertEqual(by_cnae.loc["0710", "tsb_cnae5_list"], "07103")
        self.assertEqual(by_cnae.loc["0721", "tsb_grupo_exposicao"], "Exposicao intermediaria TSB")
        self.assertFalse(bool(by_cnae.loc["1011", "tsb_associated"]))

    def test_ncm_and_rais_outputs_inherit_cnae_class_tsb_flags(self):
        cnae_bridge = pd.DataFrame(
            {
                "cnae_class": pd.Series(["0710", "1011"], dtype="string"),
                "tsb_associated": [True, False],
                "tsb_cnae5_count": [1, 0],
                "tsb_cnae5_list": pd.Series(["07103", ""], dtype="string"),
                "tsb_scn67_list": pd.Series(["0791", ""], dtype="string"),
                "tsb_setor_scn67_list": pd.Series(["Ferro", ""], dtype="string"),
                "tsb_exposicao_scn67_max": [1.0, 0.0],
                "tsb_grupo_exposicao": pd.Series(["Alta exposicao TSB", "Sem exposicao TSB direta"], dtype="string"),
                "tsb_leitura_tecnica": pd.Series(["Integral", ""], dtype="string"),
            }
        )
        bridge = pd.DataFrame(
            {
                "ncm": pd.Series(["26011100", "02011000"], dtype="string"),
                "prodlist_code": pd.Series(["0710.2015", "1011.2030"], dtype="string"),
                "cnae_class": pd.Series(["0710", "1011"], dtype="string"),
            }
        )
        employment = pd.DataFrame(
            {
                "year": [2024, 2024],
                "uf": pd.Series(["MG", "SP"], dtype="string"),
                "municipality_code": pd.Series(["310620", "355030"], dtype="string"),
                "cnae_class": pd.Series(["0710", "1011"], dtype="string"),
                "formal_jobs": [100, 900],
                "wage_mass": [1000.0, 9000.0],
                "december_wage_mass": [1000.0, 9000.0],
            }
        )

        ncm = build_ncm_bridge(bridge, cnae_bridge).set_index("ncm")
        rais_cnae, rais_territory, rais_summary = build_rais_outputs(employment, cnae_bridge)

        self.assertTrue(bool(ncm.loc["26011100", "tsb_associated"]))
        self.assertFalse(bool(ncm.loc["02011000", "tsb_associated"]))
        self.assertEqual(int(rais_summary.loc[rais_summary["tsb_associated"], "formal_jobs"].iloc[0]), 100)
        self.assertEqual(int(rais_cnae.loc[rais_cnae["tsb_associated"], "formal_jobs"].iloc[0]), 100)
        self.assertEqual(rais_territory.loc[rais_territory["tsb_associated"], "uf"].iloc[0], "MG")

    def test_tsb_platform_alignment_score_is_complementary_to_priority(self):
        indicators = pd.DataFrame(
            {
                "cnae_class": pd.Series(["0710", "1011"], dtype="string"),
                "priority_score": [0.80, 0.90],
                "tsb_exposicao_scn67_max": [1.00, 0.20],
                "external_dependency_ratio": [0.40, 0.80],
                "trade_value_usd": [1000.0, 9000.0],
            }
        )
        rais_cnae = pd.DataFrame(
            {
                "cnae_class": pd.Series(["0710", "1011"], dtype="string"),
                "formal_jobs": [100, 1000],
                "wage_mass": [500.0, 5000.0],
            }
        )

        scored = add_tsb_platform_alignment_score(indicators, rais_cnae).set_index("cnae_class")

        self.assertIn("tsb_platform_alignment_score", scored.columns)
        self.assertEqual(scored.loc["0710", "priority_score"], 0.80)
        self.assertGreater(scored.loc["0710", "tsb_platform_alignment_score"], scored.loc["1011", "tsb_platform_alignment_score"])
        self.assertEqual(scored.loc["0710", "tsb_platform_alignment_label"], "1 - maior aderencia TSB")


if __name__ == "__main__":
    unittest.main()
