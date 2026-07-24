from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any
from unittest import mock

import pytest
from fastapi.testclient import TestClient

from api.main import app
from database.data_access import PublishedFilters


PRODUCT_CONTRACT_KEYS = {
    "conceptual_product_id",
    "produto_nome",
    "cadeia_prioritaria",
    "chain_stage",
    "ncm_codigo",
    "comercio",
    "industria",
    "auditoria",
    "fator_proporcionalidade",
}

PRODUCT_RESPONSE_KEYS = PRODUCT_CONTRACT_KEYS | {"metadata_api"}

CONTRACT_SCHEMA = {
    "conceptual_product_id": str,
    "produto_nome": str,
    "cadeia_prioritaria": {"fertilizantes", "combustiveis_transicao", "aco", "silicio"},
    "chain_stage": {"insumo", "processamento", "produto_final", "equipamento"},
    "ncm_codigo": str,
    "comercio": {
        "importacao_valor_fob": "number",
        "importacao_peso_liquido": "number",
        "exportacao_valor_fob": "number",
        "exportacao_peso_liquido": "number",
        "deficit_comercial": "number",
        "principal_pais_origem": str,
        "principal_pais_participacao": "number",
        "hhi_global": "number",
    },
    "industria": {
        "cnae_codigo": str,
        "prodlist_codigo": str,
        "valor_producao_pia": "number",
        "consumo_aparente": "number",
        "dependencia_externa_fracao": "number",
        "qtde_vinculos_rais": int,
        "massa_salarial_rais": "number",
    },
    "auditoria": {
        "reference_year": int,
        "confidence_level": {"alta", "media", "baixa"},
        "is_ncm_generica": bool,
        "has_sigilo_pia": bool,
        "metodologia_versao": str,
    },
    "fator_proporcionalidade": {
        "aplicado": bool,
        "fator_alpha": "number",
        "fonte_proxy": str,
    },
}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_frontend_chain_request_respects_border_value_types_contract(
    client: TestClient,
) -> None:
    transition_fuel_products = [
        {
            "conceptual_product_id": "prod_biodiesel_b100",
            "produto_nome": "Biodiesel B100",
            "cadeia_prioritaria": "combustiveis_transicao",
            "chain_stage": "produto_final",
            "ncm_codigo": "38260000",
            "comercio": {
                "importacao_valor_fob": 1250000.0,
                "importacao_peso_liquido": 1850000.0,
                "exportacao_valor_fob": 250000.0,
                "exportacao_peso_liquido": 370000.0,
                "deficit_comercial": 1000000.0,
                "principal_pais_origem": "Estados Unidos",
                "principal_pais_participacao": 0.64,
                "hhi_global": 4750.0,
            },
            "industria": {
                "cnae_codigo": "1932",
                "prodlist_codigo": "19322010",
                "valor_producao_pia": 7800000000.0,
                "consumo_aparente": 7801000000.0,
                "dependencia_externa_fracao": 0.00016,
                "qtde_vinculos_rais": 12850,
                "massa_salarial_rais": 612000000.0,
            },
            "auditoria": {
                "reference_year": 2026,
                "confidence_level": "alta",
                "is_ncm_generica": False,
                "has_sigilo_pia": False,
                "metodologia_versao": "1.0.0-rc.1",
            },
            "fator_proporcionalidade": {
                "aplicado": True,
                "fator_alpha": 0.284,
                "fonte_proxy": "RenovaCalc-E1GM / ANP",
            },
        },
        {
            "conceptual_product_id": "prod_etanol_anidro",
            "produto_nome": "Etanol anidro combustivel",
            "cadeia_prioritaria": "combustiveis_transicao",
            "chain_stage": "processamento",
            "ncm_codigo": "22071010",
            "comercio": {
                "importacao_valor_fob": 900000.0,
                "importacao_peso_liquido": 1400000.0,
                "exportacao_valor_fob": 3900000.0,
                "exportacao_peso_liquido": 5900000.0,
                "deficit_comercial": -3000000.0,
                "principal_pais_origem": "Paraguai",
                "principal_pais_participacao": 0.71,
                "hhi_global": 6100.0,
            },
            "industria": {
                "cnae_codigo": "1931",
                "prodlist_codigo": "19312010",
                "valor_producao_pia": 11400000000.0,
                "consumo_aparente": 8400000000.0,
                "dependencia_externa_fracao": 0.00011,
                "qtde_vinculos_rais": 21100,
                "massa_salarial_rais": 1240000000.0,
            },
            "auditoria": {
                "reference_year": 2026,
                "confidence_level": "media",
                "is_ncm_generica": False,
                "has_sigilo_pia": False,
                "metodologia_versao": "1.0.0-rc.1",
            },
            "fator_proporcionalidade": {
                "aplicado": False,
                "fator_alpha": 1.0,
                "fonte_proxy": "Matriz Insumo-Produto IBGE",
            },
        },
    ]

    with mock.patch(
        "routers.api.get_conceptual_products",
        return_value=transition_fuel_products,
    ) as get_products:
        response = client.get(
            "/api/chain/combustiveis_transicao",
            params={
                "period": "2026",
                "flow": "IMP",
                "product": "all",
                "ncm": "",
                "cnae": "all",
                "prodlist": "all",
                "country": "",
                "status": "all",
                "confidence": "all",
            },
            headers={"Accept": "application/json"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == len(transition_fuel_products)

    get_products.assert_called_once()
    chain_name, filters = get_products.call_args.args
    assert chain_name == "combustiveis_transicao"
    assert isinstance(filters, PublishedFilters)
    assert filters.chain == "combustiveis_transicao"
    assert filters.period == "2026"
    assert filters.flow == "IMP"

    assert_no_nulls(payload)

    for product in payload:
        assert set(product) == PRODUCT_RESPONSE_KEYS
        validate_product_contract(product)
        validate_api_metadata(product["metadata_api"])


def validate_product_contract(product: Mapping[str, Any]) -> None:
    contract_payload = {
        key: value for key, value in product.items() if key in PRODUCT_CONTRACT_KEYS
    }
    validate_schema(contract_payload, CONTRACT_SCHEMA, path="ProdutoConceitual")
    assert product["cadeia_prioritaria"] == "combustiveis_transicao"
    assert product["ncm_codigo"].isdigit()
    assert len(product["ncm_codigo"]) == 8
    assert len(product["industria"]["cnae_codigo"]) == 4
    assert len(product["industria"]["prodlist_codigo"]) == 8
    assert 0 <= product["comercio"]["principal_pais_participacao"] <= 1
    assert 0 <= product["comercio"]["hhi_global"] <= 10000
    assert 0 <= product["industria"]["dependencia_externa_fracao"] <= 1
    assert 0 <= product["fator_proporcionalidade"]["fator_alpha"] <= 1
    assert product["comercio"]["deficit_comercial"] == pytest.approx(
        product["comercio"]["importacao_valor_fob"]
        - product["comercio"]["exportacao_valor_fob"]
    )


def validate_api_metadata(metadata: Mapping[str, Any]) -> None:
    assert set(metadata) == {"timestamp_requisicao", "engine_version"}
    assert isinstance(metadata["timestamp_requisicao"], str)
    assert isinstance(metadata["engine_version"], str)
    assert metadata["engine_version"]


def validate_schema(
    value: Mapping[str, Any],
    schema: Mapping[str, Any],
    *,
    path: str,
) -> None:
    assert set(value) == set(schema), (
        f"{path} keys diverged. Missing: {set(schema) - set(value)}; "
        f"extra: {set(value) - set(schema)}"
    )

    for field, expected_type in schema.items():
        field_path = f"{path}.{field}"
        field_value = value[field]

        if isinstance(expected_type, Mapping):
            assert isinstance(field_value, Mapping), f"{field_path} must be an object"
            validate_schema(field_value, expected_type, path=field_path)
            continue

        if isinstance(expected_type, set):
            assert isinstance(field_value, str), f"{field_path} must be a string enum"
            assert field_value in expected_type, f"{field_path} has invalid enum value"
            continue

        if expected_type == "number":
            assert isinstance(field_value, (int, float)), f"{field_path} must be numeric"
            assert not isinstance(field_value, bool), f"{field_path} cannot be boolean"
            continue

        if expected_type is int:
            assert type(field_value) is int, f"{field_path} must be an integer"
            continue

        if expected_type is bool:
            assert type(field_value) is bool, f"{field_path} must be a boolean"
            continue

        assert isinstance(field_value, expected_type), f"{field_path} has wrong type"


def assert_no_nulls(value: Any, *, path: str = "$") -> None:
    assert value is not None, f"{path} must not be null"

    if isinstance(value, Mapping):
        for key, nested_value in value.items():
            assert key not in (None, "", "null"), f"{path} contains a null-like key"
            assert_no_nulls(nested_value, path=f"{path}.{key}")
        return

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        for index, nested_value in enumerate(value):
            assert_no_nulls(nested_value, path=f"{path}[{index}]")
