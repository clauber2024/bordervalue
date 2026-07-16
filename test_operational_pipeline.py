"""Testes dos adaptadores de layouts oficiais."""

import gzip
import tempfile
import unittest
import zipfile
from pathlib import Path

import pandas as pd

from operational_pipeline import (
    _input_path,
    _read_table,
    adapt_gdp,
    adapt_rais_employment,
    adapt_comex_stat,
    adapt_domestic_production,
    adapt_ncm_prodlist,
    build_border_value_indicators,
    build_fact_employment_rais,
    build_fact_gdp,
    load_gdp_input,
    load_rais_employment_input,
)
from build_cadeias_minerais_estrategicas import adapt_anm_amb_table, summarize_anm_by_chain


class OperationalPipelineTests(unittest.TestCase):
    def test_adapts_anm_amb_production_table(self) -> None:
        raw = pd.DataFrame(
            {
                "Ano": ["2024", "2024"],
                "UF": ["PA", "MG"],
                "Município": ["Parauapebas", "Araxá"],
                "Substância Mineral": ["Minério de Ferro", "Nióbio"],
                "Quantidade Produzida": ["1.200,5", "300,0"],
                "Unidade": ["t", "t"],
                "Valor da Produção Comercializada": ["10.000,25", "2.500,75"],
            }
        )

        result = adapt_anm_amb_table(raw, "bruta")

        self.assertEqual(result["mineral_base"].tolist(), ["ferro", "niobio"])
        self.assertAlmostEqual(result.loc[0, "quantity"], 1200.5)
        self.assertAlmostEqual(result.loc[1, "production_value_brl"], 2500.75)

    def test_summarizes_anm_amb_by_mineral_chain(self) -> None:
        raw = pd.DataFrame(
            {
                "Ano": ["2024", "2024", "2024"],
                "UF": ["PA", "PA", "MG"],
                "Substância": ["Minério de Ferro", "Minério de Ferro", "Nióbio"],
                "Quantidade": ["1.000", "800", "20"],
                "Valor": ["10.000", "8.000", "500"],
            }
        )
        gross = adapt_anm_amb_table(raw.iloc[[0, 2]], "bruta")
        beneficiated = adapt_anm_amb_table(raw.iloc[[1]], "beneficiada")

        result = summarize_anm_by_chain(pd.concat([gross, beneficiated], ignore_index=True))
        ferro = result.loc[result["mineral_base"].eq("ferro")].iloc[0]

        self.assertEqual(ferro["anm_latest_year"], 2024)
        self.assertAlmostEqual(ferro["anm_gross_quantity"], 1000.0)
        self.assertAlmostEqual(ferro["anm_beneficiated_quantity"], 800.0)
        self.assertAlmostEqual(ferro["anm_beneficiation_ratio"], 0.8)

    def test_input_path_downloads_url_to_declared_cache_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = base / "source.csv"
            source.write_text("a;b\n1;2\n", encoding="utf-8")
            destination = base / "inputs" / "official" / "copy.csv"

            result = _input_path(
                {"url": source.as_uri(), "path": "inputs/official/copy.csv"},
                base,
                default_name="fallback.csv",
            )

            self.assertEqual(result, destination.resolve())
            self.assertEqual(destination.read_text(encoding="utf-8"), "a;b\n1;2\n")

    def test_reads_table_from_zip_archive(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            archive_path = Path(tmp) / "rais.zip"
            with zipfile.ZipFile(archive_path, mode="w") as archive:
                archive.writestr("dados/rais.csv", "Ano;UF\n2024;MG\n")

            result = _read_table(archive_path, {"archive_member": "rais.csv"})

            self.assertEqual(result.to_dict("records"), [{"Ano": 2024, "UF": "MG"}])

    def test_reads_table_from_gzip_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            gzip_path = Path(tmp) / "rais.csv.gz"
            with gzip.open(gzip_path, mode="wt", encoding="utf-8") as output:
                output.write("Ano;UF\n2024;MG\n")

            result = _read_table(gzip_path)

            self.assertEqual(result.to_dict("records"), [{"Ano": 2024, "UF": "MG"}])

    def test_reads_table_from_7z_archive(self) -> None:
        try:
            import py7zr
        except ModuleNotFoundError as exc:
            raise AssertionError("py7zr deve estar instalado para validar a extracao RAIS em .7z. Instale com: python -m pip install py7zr") from exc

        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = base / "rais.txt"
            source.write_text("Ano;UF\n2024;MG\n", encoding="utf-8")
            archive_path = base / "rais.7z"
            with py7zr.SevenZipFile(archive_path, mode="w") as archive:
                archive.write(source, arcname="microdados/rais.txt")

            result = _read_table(archive_path, {"archive_member": "rais.txt"})

            self.assertEqual(result.to_dict("records"), [{"Ano": 2024, "UF": "MG"}])

    def test_loads_rais_from_archive_in_chunks_and_aggregates(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            archive_path = base / "rais.zip"
            with zipfile.ZipFile(archive_path, mode="w") as archive:
                archive.writestr(
                    "rais.csv",
                    "\n".join(
                        [
                            "Ano;CNAE 2.0 Classe;UF;Município;Vínculo Ativo 31/12;Salário Médio",
                            "2024;0891;MG;3106200;10;2000",
                            "2024;0891;MG;3106200;5;1000",
                            "",
                        ]
                    ),
                )

            result = load_rais_employment_input(
                {
                    "path": "rais.zip",
                    "read_options": {
                        "archive_member": "rais.csv",
                        "chunksize": 1,
                    },
                },
                base,
            )

            self.assertEqual(len(result), 1)
            self.assertEqual(result.loc[0, "formal_jobs"], 15)
            self.assertEqual(result.loc[0, "wage_mass"], 25000)
            self.assertAlmostEqual(result.loc[0, "average_wage"], 25000 / 15)

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
                "Vl Rem Dezembro Nom": ["3.000,00", "500"],
                "Salário Médio": ["2.000,50", "1000"],
            }
        )

        result = adapt_rais_employment(raw)

        self.assertEqual(result["cnae_class"].tolist(), ["0891", "0891"])
        self.assertEqual(result["uf"].tolist(), ["MG", "MG"])
        self.assertEqual(result["municipality_code"].tolist(), ["3106200", "3106200"])
        self.assertAlmostEqual(result.loc[0, "wage_mass"], 3000.0)
        self.assertAlmostEqual(result.loc[0, "december_wage_mass"], 3000.0)
        self.assertAlmostEqual(result.loc[0, "average_monthly_wage"], 2000.5)
        self.assertAlmostEqual(result.loc[0, "average_monthly_wage_mass"], 20005.0)

    def test_adapts_gdp_territorial_layer(self) -> None:
        raw = pd.DataFrame(
            {
                "Ano": [2024, 2024],
                "UF": ["sp", ""],
                "Código do Município": ["3550308", "3304557"],
                "Produto interno bruto a preços correntes": ["1.200.000,50", "800000"],
            }
        )

        adapted = adapt_gdp(raw)
        fact = build_fact_gdp(adapted)

        self.assertEqual(adapted["municipality_code"].tolist(), ["355030", "330455"])
        self.assertEqual(adapted["uf"].tolist(), ["SP", "RJ"])
        self.assertAlmostEqual(adapted.loc[0, "gdp_value_brl"], 1200000.5)
        self.assertEqual(len(fact), 2)
        self.assertEqual(fact.loc[0, "gdp_status"], "published")

    def test_loads_gdp_with_value_multiplier(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = base / "pib.csv"
            source.write_text(
                "Ano;UF;Código do Município;Valor\n2024;SP;3550308;1.200,5\n",
                encoding="utf-8",
            )

            result = load_gdp_input(
                {
                    "path": "pib.csv",
                    "value_multiplier": 1000,
                    "read_options": {"sep": ";", "encoding": "utf-8"},
                },
                base,
            )

            self.assertAlmostEqual(result.loc[0, "gdp_value_brl"], 1200500.0)

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
                "december_wage_mass": [20000.0, 10000.0],
                "average_december_wage": [2000.0, 2000.0],
                "average_monthly_wage": [2500.0, 1000.0],
                "average_monthly_wage_mass": [25000.0, 5000.0],
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
        self.assertEqual(result.loc[0, "rais_december_wage_mass"], 30000.0)
        self.assertEqual(result.loc[0, "rais_average_december_wage"], 2000.0)
        self.assertEqual(result.loc[0, "rais_average_monthly_wage_mass"], 30000.0)
        self.assertEqual(result.loc[0, "rais_average_monthly_wage"], 2000.0)

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
