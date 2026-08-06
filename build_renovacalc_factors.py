"""Load ANP/RenovaBio production-certificate factors into the Published
layer, to replace the hardcoded `fator_alpha = 0.284` mock in
`components/ProportionalityToggle.tsx` (documented as a prototype in
MAPEAMENTO_EXISTENTE.md, section "RenovaCalc / proporcionalidade") with a
real, sourced proportionality factor for the combustiveis_transicao chain.

Investigated and confirmed (2026-08-06): the ANP RenovaBio Painel Dinamico
(Power BI embed) has no data-export option, but the same underlying data is
published as a downloadable spreadsheet, updated near-daily:
  https://www.gov.br/anp/pt-br/assuntos/renovabio/arq/certificacoes/certificados-aprovados-producao.xlsx
linked from
  gov.br/anp/pt-br/assuntos/renovabio/certificados-producao-importacao-eficiente-biocombustiveis
A direct `curl` gets a 403 -- that is the gov.br CDN's anti-bot check on the
request, not a content restriction; a browser-like User-Agent/Referer is
enough (see how this script's input file was obtained). Snapshot used here:
inputs/official/ANP_RenovaBio_CertificadosProducaoAprovados_2026-08-06.xlsx
("Atualizado em 05/08/2026" per the sheet's own title cell). Because the
source updates near-daily, this snapshot will drift -- re-download and
re-run periodically; there is no stable "latest" URL to poll automatically.

Sheet choice: the workbook has 4 tabs (Macro1, Validos, Cancelados ou
Suspensos, Anulados). Only "Validos" (active certificates) feeds fator_alpha
-- a cancelled/suspended/annulled certificate should not lower today's
proportionality factor.

Columns confirmed in "Validos" (52 cols, but only ~14 populated) -- this is
strictly more than the Painel Dinamico table showed (it only surfaces Razao
Social, no. processo, Unidade Produtora, fator por biocombustivel):
  Razao Social - Cidade - UF | CNPJ | Processo de Certificacao |
  Biocombustivel | Rota | Nota de Eficiencia Energetico-Ambiental (gCO2eq/MJ)
  | Volume elegivel (%) | Fator para emissao de CBIO (tCO2eq/L) |
  Litros/CBIO | Data de Aprovacao pela ANP | Validade | Firma Inspetora |
  Endereco Emissor Primario
"Volume elegivel (%)" is the field that plays the role of `fator_alpha`: the
share of a certified plant's output that is eligible for CBIO issuance under
its certified route -- structurally the same "proxy" role RenovaCalc-E1GM
played in the mock. It must not be confused with "Fator para emissao de
CBIO", which is a carbon-credit conversion factor (tCO2eq per liter), a
different concept entirely.

Row layout: each certified plant is one Excel "row group". The first physical
row carries an integer in column A and all identity columns (Razao Social,
CNPJ, Processo, Data de Aprovacao, Validade, Firma Inspetora, Endereco).
When a plant is certified for more than one product form of the same route
(overwhelmingly: Etanol hidratado + Etanol anidro from the same cana-de-acucar
route), the second form is a continuation row -- column A is blank, identity
columns are blank, and only Biocombustivel/Nota/Volume elegivel/Fator
CBIO/Litros-per-CBIO repeat. "Rota" is also blank on these continuation rows
about half the time (it repeats the group's route only when the source
bothered to re-type it) -- this script forward-fills Rota within a group.

NCM -> RenovaBio route crosswalk (built from
`build_sector_sovereignty_metrics.py`'s CHAINS["combustiveis_transicao"]
definitions, which is the real Published-layer conceptual_product_id
catalog -- NOT `lib/conceptualCatalog.ts`, which MAPEAMENTO_EXISTENTE.md
documents as the disconnected Next.js prototype layer):
  - "etanol" (NCM 22071010/22071090/22072010/22072019) <- every "Validos" row
    where Biocombustivel is Etanol hidratado/anidro, regardless of route
    (cana-de-acucar, milho, milho internacional, 1G2G integrada, flex
    integrada) -- the NCM does not separate by route either, so the product
    granularity here has to match the NCM's, not RenovaBio's.
  - "biodiesel" (NCM 38260000) <- Biocombustivel == "Biodiesel".
  - Biometano is EXCLUDED on purpose: `build_sector_sovereignty_metrics.py`
    only has "gas_natural_biometano", explicitly documented there as a
    fossil-dominant PROXY ("NCM nao separa gas natural fossil de
    biometano") whose trade totals are overwhelmingly fossil LNG/piped gas.
    Applying a certified-plant "volume elegivel" (a national biomethane
    output share) to that basket would misrepresent a bulk fossil-gas NCM as
    partially renewable -- the opposite of what the proportionality lens is
    for. This mirrors the same discipline as the BEN loader
    (build_energy_context_ben.py) refusing to merge national/sectoral
    references into municipal/firm-level tables.

Route text -> route code crosswalk (ROTA_CODIGO_MAP below): the xlsx does not
carry ANP's internal route abbreviations (E1GC/E1GM/E1GMI/E1G2G/E1GFlex),
only the descriptive Portuguese text. The mapping was confirmed by
cross-checking this file's own aggregate against the Painel Dinamico's
published per-route "Volume Elegivel" figure: this script's unweighted mean
of "Etanol hidratado"+"...milho" volume-elegivel values is 70.45% versus the
Painel's published E1GM = 70.15% -- close enough (the Painel's figure is
almost certainly volume-weighted, which this snapshot has no data to
replicate) to confirm both the route mapping AND the aggregation method
(simple, unweighted mean across active certificates -- not weighted by
plant capacity, which this file does not expose).

Entity name parsing: the source has ONE free-text column
("Razao Social - Cidade - UF") for what the Painel Dinamico shows as two
separate fields (Razao Social, Unidade Produtora), and formatting is
inconsistent (missing separators, "-" vs "–", embedded newlines, comma
vs dash before the UF, zero-width spaces). This script best-effort splits it
into razao_social / unidade_produtora / cidade / uf using a plant-name-marker
heuristic (Usina/Unidade/Filial/Destilaria/Planta/Fazenda/Engenho). When no
marker is found, unidade_produtora falls back to the same value as
razao_social (no fabricated plant name) and cidade/uf stay NULL rather than
guessing. In this snapshot, cidade/uf parse for roughly half the rows; that
residual gap is a source-data quality issue, not a bug, and matches this
project's convention of documenting rather than papering over such gaps (see
the RAIS "equal-weight approximation" caveat in
build_analytical_staging_sectors.py).

Usage:
    python build_renovacalc_factors.py

Output:
    outputs/analytical_renovacalc_certification/load_analytical_renovacalc_certification.sql
    (CREATE TABLE IF NOT EXISTS safety net + full TRUNCATE/INSERT of this
    table's only owner, ready to run with `psql -f`)
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
INPUTS_DIR = ROOT / "inputs" / "official"
OUTPUT_DIR = ROOT / "outputs" / "analytical_renovacalc_certification"

SOURCE_PATH = INPUTS_DIR / "ANP_RenovaBio_CertificadosProducaoAprovados_2026-08-06.xlsx"
SHEET_NAME = "Válidos"
FONTE_ANP = (
    "ANP/RenovaBio - Certificados da Producao ou Importacao Eficiente de "
    "Biocombustiveis, planilha 'Validos', snapshot 2026-08-06"
)

UF_SET = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
    "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
    "SP", "SE", "TO",
}

PLANT_MARKERS = re.compile(
    r"^(usina|unidade|filial|destilaria|planta|fazenda|engenho)\b", re.IGNORECASE
)

# Biocombustivel (normalized, casefolded) -> Published-layer conceptual_product_id.
# See module docstring for why Biometano has no entry here.
BIOCOMBUSTIVEL_TO_PRODUCT: dict[str, str] = {
    "etanol hidratado": "etanol",
    "etanol anidro": "etanol",
    "biodiesel": "biodiesel",
}

# RenovaBio "Rota" free text -> ANP's internal route code. Both the
# unaccented-typo variant ("cana- de acucar") and the standard spelling are
# mapped, since the source file contains both.
ROTA_CODIGO_MAP: dict[str, str] = {
    "etanol combustivel de primeira geracao - cana-de-acucar": "E1GC",
    "etanol combustivel de primeira geracao - cana- de acucar": "E1GC",
    "etanol combustivel de primeira geracao - milho": "E1GM",
    "etanol combustivel de primeira geracao - milho internacional": "E1GMI",
    "etanol combustivel de primeira e segunda geracao produzido em usina integrada": "E1G2G",
    "etanol combustivel de primeira geracao - cana-de-acucar e milho em usina integrada": "E1GFlex",
    "biodiesel": "Biodiesel",
    "biometano": "Biometano",
}


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = parse_certificates(SOURCE_PATH, SHEET_NAME)

    output_sql = OUTPUT_DIR / "load_analytical_renovacalc_certification.sql"
    write_sql(rows, output_sql)

    with_product = [r for r in rows if r["conceptual_product_id"]]
    with_location = [r for r in rows if r["uf"]]
    print(
        json.dumps(
            {
                "total_rows": len(rows),
                "rows_with_conceptual_product_id": len(with_product),
                "rows_with_cidade_uf_parsed": len(with_location),
                "distinct_conceptual_product_id": sorted(
                    {r["conceptual_product_id"] for r in with_product}
                ),
                "output": str(output_sql),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def parse_certificates(source_path: Path, sheet_name: str) -> list[dict[str, object]]:
    wb = openpyxl.load_workbook(source_path, read_only=True, data_only=True)
    sheet_rows = list(wb[sheet_name].iter_rows(min_row=3, values_only=True))

    rows: list[dict[str, object]] = []
    group: dict[str, object] = {}

    for raw in sheet_rows:
        if raw[0] is not None:
            group = {
                "processo_anp": _clean_text(raw[3]),
                "razao_bruto": _clean_text(raw[1]) or "",
                "cnpj": _clean_text(raw[2]),
                "data_aprovacao": raw[10],
                "validade": raw[11],
                "last_rota": _clean_text(raw[5]),
            }
        elif raw[5] is not None:
            group["last_rota"] = _clean_text(raw[5])

        biocombustivel = _clean_text(raw[4])
        if biocombustivel is None:
            continue

        rota_descricao = _clean_text(raw[5]) or group.get("last_rota")
        razao_social, unidade_produtora, cidade, uf = parse_entity(str(group.get("razao_bruto", "")))
        volume_fracao = _clean_percent(raw[7])
        ano_base = group["data_aprovacao"].year if hasattr(group.get("data_aprovacao"), "year") else None

        rows.append(
            {
                "processo_anp": group.get("processo_anp"),
                "razao_social": razao_social,
                "unidade_produtora": unidade_produtora,
                "cidade": cidade,
                "uf": uf,
                "cnpj": group.get("cnpj"),
                "biocombustivel": biocombustivel,
                "rota_descricao": rota_descricao,
                "rota_codigo": _rota_codigo(biocombustivel, rota_descricao),
                "conceptual_product_id": BIOCOMBUSTIVEL_TO_PRODUCT.get(biocombustivel.casefold()),
                "volume_elegivel_fracao": volume_fracao,
                "ano_base_certificacao": ano_base,
                "validade_certificado": group.get("validade"),
                "fonte": FONTE_ANP,
            }
        )

    return rows


def parse_entity(razao_raw: str) -> tuple[str, str, str | None, str | None]:
    """Best-effort split of the free-text 'Razao Social - Cidade - UF'
    column. See module docstring "Entity name parsing" for the heuristic and
    its known coverage gap."""

    s = razao_raw.replace("​", "").replace("–", "-").replace("\n", " ")
    s = re.sub(r"\s+", " ", s).strip().rstrip(",").strip()

    cidade: str | None = None
    uf: str | None = None

    m = re.match(r"^(.*?)[\s,/-]+([A-Za-z]{2})$", s)
    if m and m.group(2).upper() in UF_SET:
        uf = m.group(2).upper()
        rest = m.group(1).strip(" -,/")
        m2 = re.match(r"^(.*?)[\s,/-]+([A-Za-zÀ-ÿ0-9()' ]+)$", rest)
        if m2 and 1 < len(m2.group(2)) <= 40 and not PLANT_MARKERS.match(m2.group(2)):
            cidade = m2.group(2).strip()
            rest = m2.group(1).strip(" -,/")
        s_no_loc = rest
    else:
        s_no_loc = s

    parts = re.split(r"\s-\s", s_no_loc)
    razao_social = s_no_loc
    unidade_produtora = s_no_loc
    for i, part in enumerate(parts):
        if i > 0 and PLANT_MARKERS.match(part.strip()):
            razao_social = " - ".join(parts[:i]).strip()
            unidade_produtora = " - ".join(parts[i:]).strip()
            break

    return razao_social, unidade_produtora, cidade, uf


def _rota_codigo(biocombustivel: str, rota_descricao: str | None) -> str | None:
    if rota_descricao is None:
        return None
    key = _normalize_ascii(rota_descricao)
    if key in ROTA_CODIGO_MAP:
        return ROTA_CODIGO_MAP[key]
    return ROTA_CODIGO_MAP.get(_normalize_ascii(biocombustivel))


def _normalize_ascii(value: str) -> str:
    import unicodedata

    value = value.replace("–", "-").replace("—", "-")
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", ascii_only).casefold().strip()


def _clean_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).replace("​", "").strip()
    return text or None


def _clean_percent(value: object) -> float | None:
    """Volume elegivel (%) -> fraction in [0, 1]. Some cells in the source
    are numeric already; others are strings with stray tabs/newlines and a
    comma decimal separator (e.g. '\\t\\n91,05')."""

    if value is None:
        return None
    if isinstance(value, (int, float)):
        pct = float(value)
    else:
        text = str(value).replace("\t", "").replace("\n", "").strip().replace(",", ".")
        if not text:
            return None
        try:
            pct = float(text)
        except ValueError:
            return None
    return max(0.0, min(1.0, pct / 100.0))


def write_sql(rows: list[dict[str, object]], output_path: Path) -> None:
    statements = [
        "-- Gerado por build_renovacalc_factors.py -- nao editar a mao.",
        "CREATE TABLE IF NOT EXISTS analytical_renovacalc_certification (",
        "  processo_anp text,",
        "  razao_social text NOT NULL,",
        "  unidade_produtora text NOT NULL,",
        "  cidade text,",
        "  uf text,",
        "  cnpj text,",
        "  biocombustivel text NOT NULL,",
        "  rota_descricao text,",
        "  rota_codigo text,",
        "  conceptual_product_id text,",
        "  volume_elegivel_fracao numeric,",
        "  ano_base_certificacao integer,",
        "  validade_certificado date,",
        "  fonte text NOT NULL",
        ");",
        "BEGIN;",
        # This script owns the whole table (single source, no other loader
        # writes to it), so a full truncate+reload is safe to rerun.
        "TRUNCATE analytical_renovacalc_certification;",
    ]

    for row in rows:
        statements.append(
            "INSERT INTO analytical_renovacalc_certification "
            "(processo_anp, razao_social, unidade_produtora, cidade, uf, cnpj, "
            "biocombustivel, rota_descricao, rota_codigo, conceptual_product_id, "
            "volume_elegivel_fracao, ano_base_certificacao, validade_certificado, fonte) VALUES ("
            f"{sql_text_nullable(row['processo_anp'])}, "
            f"'{sql_text(row['razao_social'])}', "
            f"'{sql_text(row['unidade_produtora'])}', "
            f"{sql_text_nullable(row['cidade'])}, "
            f"{sql_text_nullable(row['uf'])}, "
            f"{sql_text_nullable(row['cnpj'])}, "
            f"'{sql_text(row['biocombustivel'])}', "
            f"{sql_text_nullable(row['rota_descricao'])}, "
            f"{sql_text_nullable(row['rota_codigo'])}, "
            f"{sql_text_nullable(row['conceptual_product_id'])}, "
            f"{sql_number_nullable(row['volume_elegivel_fracao'])}, "
            f"{sql_int_nullable(row['ano_base_certificacao'])}, "
            f"{sql_date_nullable(row['validade_certificado'])}, "
            f"'{sql_text(row['fonte'])}');"
        )

    statements.append("COMMIT;")
    output_path.write_text("\n".join(statements) + "\n", encoding="utf-8")


def sql_text(value: object) -> str:
    return str(value).replace("'", "''")


def sql_text_nullable(value: object) -> str:
    if value is None:
        return "NULL"
    return f"'{sql_text(value)}'"


def sql_number_nullable(value: object) -> str:
    if value is None:
        return "NULL"
    return repr(float(value))


def sql_int_nullable(value: object) -> str:
    if value is None:
        return "NULL"
    return str(int(value))


def sql_date_nullable(value: object) -> str:
    if value is None or not hasattr(value, "isoformat"):
        return "NULL"
    return f"'{value.date().isoformat() if hasattr(value, 'date') else value.isoformat()}'"


if __name__ == "__main__":
    main()
