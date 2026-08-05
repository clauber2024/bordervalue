from __future__ import annotations

import logging
import os
import re
import unicodedata
from contextlib import suppress
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Final, List, Mapping, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.extensions import connection as PgConnection
from psycopg2.extensions import cursor as PgCursor


LOGGER = logging.getLogger(__name__)

DEFAULT_DATABASE_DSN: Final[str] = (
    "dbname=border_value_db user=border_user password=border_password "
    "host=localhost port=5433"
)
DATA_UNAVAILABLE_MESSAGE: Final[str] = (
    "Serviço de Dados Indisponível - Camada Published"
)
SIGILO_PIA_MARKER: Final[str] = "SIGILO_IBGE_PIA"


class DataAccessUnavailableError(RuntimeError):
    """Raised when the Published data layer cannot be reached."""


QUERY_CONCEPTUAL_PRODUCTS: Final[str] = """
    SELECT * FROM mv_published_indicators ind
    LEFT JOIN mv_published_hhi_risk hhi
        ON ind.conceptual_product_id = hhi.conceptual_product_id
    WHERE (%s IS NULL OR ind.cadeia_prioritaria = %s)
    ORDER BY ind.conceptual_product_id
"""


@dataclass(frozen=True)
class PublishedFilters:
    period: str = "all"
    flow: str = "all"
    chain: str = "all"
    conceptual_product: str = "all"
    ncm: str = ""
    cnae: str = "all"
    prodlist: str = "all"
    partner: str = ""
    mapping_status: str = "all"
    confidence: str = "all"


CHAIN_ALIASES: Final[dict[str, str]] = {
    "fertilizers": "fertilizantes",
    "transition-fuels": "combustiveis_transicao",
    "critical-minerals": "aco,silicio",
    "hydrogen-ammonia": "combustiveis_transicao",
}

CONFIDENCE_ALIASES: Final[dict[str, str]] = {
    "high": "alta",
    "alta": "alta",
    "medium": "media",
    "medio": "media",
    "media": "media",
    "low": "baixa",
    "baixo": "baixa",
    "baixa": "baixa",
}


def get_conceptual_products(
    chain: str | None = None,
    filters: PublishedFilters | None = None,
) -> List[dict]:
    """Return Published-layer products already shaped for the API Pydantic models."""

    conn: Optional[PgConnection] = None
    cur: Optional[PgCursor] = None
    requested_chain = _normalize_chain(filters.chain if filters and filters.chain != "all" else chain)
    query_chain = None if not requested_chain or "," in requested_chain else requested_chain

    try:
        conn = psycopg2.connect(_database_dsn())
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(QUERY_CONCEPTUAL_PRODUCTS, (query_chain, query_chain))
        rows = cur.fetchall()

        products = [_map_published_row(row, requested_chain or _as_str(row.get("cadeia_prioritaria"))) for row in rows]
        products = filter_published_products(products, filters or PublishedFilters(chain=requested_chain or "all"))
        _validate_with_pydantic_models(products)
        return products

    except psycopg2.OperationalError as exc:
        LOGGER.error(
            "%s. Verifique PostgreSQL em localhost:5433 e a camada Published.",
            DATA_UNAVAILABLE_MESSAGE,
        )
        raise DataAccessUnavailableError(DATA_UNAVAILABLE_MESSAGE) from exc

    finally:
        if cur is not None:
            with suppress(Exception):
                cur.close()
        if conn is not None:
            with suppress(Exception):
                conn.close()


def get_sovereignty_graph(chain: str, filters: PublishedFilters | None = None) -> dict:
    """Return an AIPNET topology derived from Published-layer product records."""

    return build_sovereignty_graph(chain, get_conceptual_products(chain, filters))


_AIPNET_CHAINS = {"silicio", "fertilizantes", "combustiveis_transicao", "aco"}


def get_solar_sovereignty_metrics(chain: str) -> dict:
    """Read the published AIPNET per-chain input metrics from PostgreSQL."""

    normalized_chain = _normalize_chain(chain)
    if normalized_chain not in _AIPNET_CHAINS:
        return {}

    conn: Optional[PgConnection] = None
    cur: Optional[PgCursor] = None
    try:
        conn = psycopg2.connect(_database_dsn())
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT metrics FROM aipnet_solar_input_metrics WHERE chain_name = %s ORDER BY "
            "CASE stage WHEN 'extracao' THEN 1 WHEN 'processamento' THEN 2 "
            "WHEN 'refinamento' THEN 3 WHEN 'componentes_avancados' THEN 4 ELSE 5 END, input_id",
            (normalized_chain,),
        )
        inputs = [dict(row["metrics"]) for row in cur.fetchall()]

        green_jobs = None
        try:
            cur.execute(
                "SELECT green_jobs FROM aipnet_solar_green_jobs WHERE chain_name = %s",
                (normalized_chain,),
            )
            green_jobs_row = cur.fetchone()
            if green_jobs_row is not None:
                green_jobs = dict(green_jobs_row["green_jobs"])
        except psycopg2.errors.UndefinedTable:
            # Table not loaded yet in this environment -- degrade to no
            # green_jobs rather than failing the whole solar response.
            conn.rollback()

        result = {
            "chain_name": normalized_chain,
            "reference_period": inputs[0]["reference_period"] if inputs else "2026-H1",
            "methodology_version": "1.1.0-aipnet-solar",
            "inputs": inputs,
        }
        if green_jobs is not None:
            result["green_jobs"] = green_jobs
        return result
    except psycopg2.OperationalError as exc:
        raise DataAccessUnavailableError(DATA_UNAVAILABLE_MESSAGE) from exc
    finally:
        if cur is not None:
            with suppress(Exception):
                cur.close()
        if conn is not None:
            with suppress(Exception):
                conn.close()


def filter_published_products(
    products: List[Mapping[str, Any]],
    filters: PublishedFilters,
) -> List[dict]:
    """Apply BI filters over the Published product contract."""

    return [
        dict(product)
        for product in products
        if _matches_published_filters(product, filters)
    ]


def build_sovereignty_graph(chain: str, products: List[Mapping[str, Any]]) -> dict:
    """Build the graph contract consumed by sovereignty/Sankey visualizations."""

    nodes_by_id: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(node: dict) -> None:
        existing = nodes_by_id.get(node["id"])
        if existing is None:
            nodes_by_id[node["id"]] = node
            return

        existing_metadata = existing.setdefault("metadados_no", {})
        for key, value in node.get("metadados_no", {}).items():
            if key not in existing_metadata or existing_metadata[key] in (None, "", 0):
                existing_metadata[key] = value

    for product in products:
        product_id = _as_str(product.get("conceptual_product_id"), default="produto")
        product_slug = _slug(product_id)
        product_name = _as_str(product.get("produto_nome"), default=product_id)
        comercio = _as_mapping(product.get("comercio"))
        industria = _as_mapping(product.get("industria"))
        auditoria = _as_mapping(product.get("auditoria"))
        fator = _as_mapping(product.get("fator_proporcionalidade"))

        country = _as_str(comercio.get("principal_pais_origem"), default="Nao informado")
        country_id = f"node_pais_{_slug(country)}"
        ncm_code = _digits_only(product.get("ncm_codigo"), length=8)
        ncm_id = f"node_ncm_{ncm_code}"
        cnae_code = _digits_only(industria.get("cnae_codigo"), length=4)
        cnae_id = f"node_cnae_{cnae_code}"
        product_node_id = f"node_prod_{product_slug}"
        reference_year = int(_as_float(auditoria.get("reference_year"), default=2026))
        import_value = _as_float(comercio.get("importacao_valor_fob"))
        import_kg = _as_float(comercio.get("importacao_peso_liquido"))
        export_value = _as_float(comercio.get("exportacao_valor_fob"))
        apparent_consumption = _as_float(industria.get("consumo_aparente"))
        alpha = _bounded_float(fator.get("fator_alpha"), minimum=0.0, maximum=1.0, default=1.0)
        has_sigilo_pia = _as_bool(auditoria.get("has_sigilo_pia"))
        domestic_supply_usd = max(apparent_consumption - import_value + export_value, 0.0)

        add_node(
            {
                "id": country_id,
                "label": country,
                "tipo": "pais_origem",
                "grupo_cadeia": chain,
                "metadados_no": {
                    "participacao": _bounded_float(
                        comercio.get("principal_pais_participacao"),
                        minimum=0.0,
                        maximum=1.0,
                    ),
                    "concentracao_hhi_setorial": _bounded_float(
                        comercio.get("hhi_global"),
                        minimum=0.0,
                        maximum=10000.0,
                    ),
                },
            }
        )
        add_node(
            {
                "id": ncm_id,
                "label": f"NCM {ncm_code} - {product_name}",
                "tipo": "insumo_ncm",
                "grupo_cadeia": chain,
                "metadados_no": {
                    "ncm_codigo": ncm_code,
                    "importacao_bruta_usd": import_value,
                    "is_ncm_generica": _as_bool(auditoria.get("is_ncm_generica")),
                    "reference_year": reference_year,
                },
            }
        )
        add_node(
            {
                "id": cnae_id,
                "label": f"CNAE {cnae_code}",
                "tipo": "elo_industrial_cnae",
                "grupo_cadeia": chain,
                "metadados_no": {
                    "cnae_codigo": cnae_code,
                    "valor_producao_pia_rs": _as_float(industria.get("valor_producao_pia")),
                    "postos_trabalho_rais": int(_as_float(industria.get("qtde_vinculos_rais"))),
                    "massa_salarial_rais": _as_float(industria.get("massa_salarial_rais")),
                    "has_sigilo_pia": has_sigilo_pia,
                },
            }
        )
        add_node(
            {
                "id": product_node_id,
                "label": product_name,
                "tipo": "produto_final",
                "grupo_cadeia": chain,
                "metadados_no": {
                    "conceptual_product_id": product_id,
                    "chain_stage": _as_str(product.get("chain_stage"), default="insumo"),
                    "dependencia_externa_real": _bounded_float(
                        industria.get("dependencia_externa_fracao"),
                        minimum=0.0,
                        maximum=1.0,
                    ),
                    "has_sigilo_pia": has_sigilo_pia,
                },
            }
        )

        edges.extend(
            [
                {
                    "id_aresta": f"edge_import_{_slug(country)}_{ncm_code}_{product_slug}",
                    "source": country_id,
                    "target": ncm_id,
                    "tipo_fluxo": "importacao_fob",
                    "peso_financeiro_usd": import_value,
                    "peso_fisico_kg": import_kg,
                    "fator_corte_aplicado": 1.0,
                    "fonte_auditoria": f"Comex Stat {reference_year}",
                },
                {
                    "id_aresta": f"edge_coeff_{ncm_code}_{cnae_code}_{product_slug}",
                    "source": ncm_id,
                    "target": cnae_id,
                    "tipo_fluxo": "coeficiente_tecnico",
                    "peso_financeiro_usd": import_value * alpha,
                    "peso_fisico_kg": import_kg * alpha,
                    "fator_corte_aplicado": alpha,
                    "fonte_auditoria": _as_str(
                        fator.get("fonte_proxy"),
                        default="Ponte NCM-PRODLIST-CNAE Published",
                    ),
                },
                {
                    "id_aresta": f"edge_domestic_{cnae_code}_{product_slug}",
                    "source": cnae_id,
                    "target": product_node_id,
                    "tipo_fluxo": "producao_nacional",
                    "peso_financeiro_usd": 0.0 if has_sigilo_pia else domestic_supply_usd,
                    "peso_fisico_kg": 0.0,
                    "fator_corte_aplicado": 1.0,
                    "fonte_auditoria": (
                        f"PIA-Produto {reference_year} sob sigilo estatistico"
                        if has_sigilo_pia
                        else f"PIA-Produto {reference_year} harmonizada Published"
                    ),
                },
            ]
        )

    return {
        "chain_id": chain,
        "topology_version": "published-aipnet-1.0.0-rc.1",
        "nodes": list(nodes_by_id.values()),
        "edges": edges,
    }


def _database_dsn() -> str:
    return os.getenv("BORDER_VALUE_DATABASE_DSN", DEFAULT_DATABASE_DSN)


def _map_published_row(row: Mapping[str, Any], requested_chain: str) -> dict:
    has_sigilo_pia = _as_bool(row.get("has_sigilo_pia"))
    total_import_fob = _as_float(row.get("total_import_fob"))
    total_export_fob = _as_float(row.get("total_export_fob"))
    production_weighted = _as_float(row.get("production_weighted"))
    consumo_aparente = _as_float(
        row.get("consumo_aparente"),
        default=production_weighted + total_import_fob - total_export_fob,
    )
    deficit_comercial = _as_float(
        row.get("deficit_comercial"),
        default=total_import_fob - total_export_fob,
    )
    fator_alpha = _as_float(
        _first_present(
            row,
            "fator_alpha",
            "proportion_factor",
            "proportionality_factor",
        ),
        default=1.0,
    )

    product = {
        "conceptual_product_id": _as_str(row.get("conceptual_product_id")),
        "produto_nome": _as_str(
            _first_present(row, "produto_nome", "product_name", "nome_produto"),
            default=_as_str(row.get("conceptual_product_id")),
        ),
        "cadeia_prioritaria": _as_str(
            row.get("cadeia_prioritaria"),
            default=requested_chain,
        ),
        "chain_stage": _as_str(row.get("chain_stage"), default="insumo"),
        "ncm_codigo": _digits_only(row.get("ncm_codigo"), length=8),
        "comercio": {
            "importacao_valor_fob": total_import_fob,
            "importacao_peso_liquido": _as_float(row.get("total_import_kg")),
            "exportacao_valor_fob": total_export_fob,
            "exportacao_peso_liquido": _as_float(row.get("total_export_kg")),
            "deficit_comercial": deficit_comercial,
            "principal_pais_origem": _as_str(
                row.get("principal_pais_origem"),
                default="Nao informado",
            ),
            "principal_pais_participacao": _bounded_float(
                _first_present(
                    row,
                    "principal_pais_participacao",
                    "principal_country_share",
                    "share_principal_pais",
                ),
                minimum=0.0,
                maximum=1.0,
            ),
            "hhi_global": _bounded_float(
                row.get("hhi_global"),
                minimum=0.0,
                maximum=10000.0,
            ),
        },
        "industria": {
            "cnae_codigo": _digits_only(row.get("cnae_codigo"), length=4),
            "prodlist_codigo": _digits_only(row.get("prodlist_codigo"), length=8),
            "valor_producao_pia": _confidential_numeric(
                production_weighted,
                has_sigilo_pia,
            ),
            "consumo_aparente": _confidential_numeric(
                consumo_aparente,
                has_sigilo_pia,
            ),
            "dependencia_externa_fracao": _bounded_float(
                row.get("dependencia_externa_fracao"),
                minimum=0.0,
                maximum=1.0,
                default=_safe_ratio(total_import_fob, consumo_aparente),
            ),
            "qtde_vinculos_rais": int(
                _as_float(row.get("employment_weighted"), default=0.0)
            ),
            "massa_salarial_rais": _as_float(row.get("salary_mass_weighted")),
        },
        "auditoria": {
            "reference_year": int(_as_float(row.get("reference_year"), default=2026)),
            "confidence_level": _as_str(row.get("confidence_level"), default="media"),
            "is_ncm_generica": _as_bool(row.get("is_ncm_generica")),
            "has_sigilo_pia": has_sigilo_pia,
            "metodologia_versao": _as_str(
                row.get("metodologia_versao"),
                default="1.0.0-rc.1",
            ),
        },
        "fator_proporcionalidade": {
            "aplicado": _as_bool(
                row.get("fator_proporcionalidade_aplicado"),
                default=fator_alpha < 1.0,
            ),
            "fator_alpha": _bounded_float(fator_alpha, minimum=0.0, maximum=1.0),
            "fonte_proxy": _as_str(
                row.get("fonte_proxy"),
                default="Matriz Insumo-Produto IBGE",
            ),
        },
    }

    if has_sigilo_pia:
        product["marcadores_sigilo"] = {
            "valor_producao_pia": SIGILO_PIA_MARKER,
            "consumo_aparente": SIGILO_PIA_MARKER,
        }
        product["industria"]["valor_producao_pia_display"] = SIGILO_PIA_MARKER
        product["industria"]["consumo_aparente_display"] = SIGILO_PIA_MARKER

    return product


def _matches_published_filters(product: Mapping[str, Any], filters: PublishedFilters) -> bool:
    comercio = _as_mapping(product.get("comercio"))
    industria = _as_mapping(product.get("industria"))
    auditoria = _as_mapping(product.get("auditoria"))
    chain_filter = _normalize_chain(filters.chain)

    if chain_filter and chain_filter != "all":
        allowed_chains = {item.strip() for item in chain_filter.split(",") if item.strip()}
        if _as_str(product.get("cadeia_prioritaria")) not in allowed_chains:
            return False

    if not _is_all(filters.period):
        reference_year = _as_str(auditoria.get("reference_year"))
        if reference_year and reference_year not in _as_str(filters.period):
            return False

    flow = _as_str(filters.flow).upper()
    if flow == "IMP" and _as_float(comercio.get("importacao_valor_fob")) <= 0:
        return False
    if flow == "EXP" and _as_float(comercio.get("exportacao_valor_fob")) <= 0:
        return False

    conceptual_product = _as_str(filters.conceptual_product)
    if not _is_all(conceptual_product) and _as_str(product.get("conceptual_product_id")) != conceptual_product:
        return False

    if filters.ncm and filters.ncm not in _as_str(product.get("ncm_codigo")):
        return False

    cnae = _digits_or_text(filters.cnae)
    if not _is_all(cnae) and cnae != _digits_or_text(industria.get("cnae_codigo")):
        return False

    prodlist = _digits_or_text(filters.prodlist)
    if not _is_all(prodlist) and prodlist != _digits_or_text(industria.get("prodlist_codigo")):
        return False

    partner = _as_str(filters.partner)
    if partner and not _is_all(partner):
        principal_partner = _as_str(comercio.get("principal_pais_origem")).casefold()
        if partner.casefold() not in principal_partner:
            return False

    mapping_status = _as_str(filters.mapping_status)
    if not _is_all(mapping_status) and _mapping_status(product) != _slug(mapping_status):
        return False

    confidence = _normalize_confidence(filters.confidence)
    if not _is_all(confidence) and _as_str(auditoria.get("confidence_level")) != confidence:
        return False

    return True


def _normalize_chain(value: Any) -> str:
    chain = _as_str(value)
    if not chain:
        return "all"
    return CHAIN_ALIASES.get(chain, chain)


def _normalize_confidence(value: Any) -> str:
    confidence = _as_str(value)
    if not confidence:
        return "all"
    return CONFIDENCE_ALIASES.get(confidence.casefold(), confidence)


def _mapping_status(product: Mapping[str, Any]) -> str:
    auditoria = _as_mapping(product.get("auditoria"))
    if _as_bool(auditoria.get("has_sigilo_pia")):
        return "auditoria_sigilo_pia"
    if _as_bool(auditoria.get("is_ncm_generica")):
        return "ncm_generica"
    return "mapeado"


def _digits_or_text(value: Any) -> str:
    text = _as_str(value)
    digits = "".join(char for char in text if char.isdigit())
    return digits or text


def _is_all(value: Any) -> bool:
    return _as_str(value).casefold() in {"", "all", "todos", "todas"}


def _validate_with_pydantic_models(products: List[dict]) -> None:
    try:
        from api.main import ProdutoConceitual
    except Exception:
        LOGGER.debug("Modelos Pydantic da API indisponiveis para validacao local.")
        return

    for product in products:
        ProdutoConceitual.model_validate(product)


def _first_present(row: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        value = row.get(key)
        if value is not None:
            return value
    return None


def _as_mapping(value: Any) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    return {}


def _as_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def _as_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _bounded_float(
    value: Any,
    *,
    minimum: float,
    maximum: float,
    default: float = 0.0,
) -> float:
    number = _as_float(value, default=default)
    if number < minimum:
        return minimum
    if number > maximum:
        return maximum
    return number


def _as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, Decimal)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "t", "yes", "sim", "s"}


def _digits_only(value: Any, *, length: int) -> str:
    digits = "".join(char for char in _as_str(value) if char.isdigit())
    if not digits:
        return "0" * length
    return digits.zfill(length)[-length:]


def _confidential_numeric(value: float, has_sigilo_pia: bool) -> float:
    if has_sigilo_pia:
        return 0.0
    return max(value, 0.0)


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _slug(value: Any) -> str:
    text = unicodedata.normalize("NFKD", _as_str(value, default="nao_informado"))
    ascii_text = text.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")
    return slug or "nao_informado"
