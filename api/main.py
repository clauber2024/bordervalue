from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator


APP_VERSION = "1.0.0-rc.1"

app = FastAPI(
    title="Border Value Analytics API",
    description=(
        "Infraestrutura analitica integrada para o mapeamento empirico da "
        "transicao energetica e industrializacao verde."
    ),
    version=APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CadeiaPrioritariaEnum(str, Enum):
    FERTILIZANTES = "fertilizantes"
    COMBUSTIVEIS_TRANSICAO = "combustiveis_transicao"
    ACO = "aco"
    SILICIO = "silicio"


class ChainStageEnum(str, Enum):
    INSUMO = "insumo"
    PROCESSAMENTO = "processamento"
    PRODUTO_FINAL = "produto_final"
    EQUIPAMENTO = "equipamento"


class ConfidenceLevelEnum(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAIXA = "baixa"


class MetadadosAuditoria(BaseModel):
    reference_year: int = Field(..., description="Ano-base dos dados.")
    confidence_level: ConfidenceLevelEnum = Field(
        ...,
        description="Nivel de confianca estatistica inferido pelo motor.",
    )
    is_ncm_generica: bool = Field(
        ...,
        description="Sinaliza se a NCM termina em 9, 90 ou 99.",
    )
    has_sigilo_pia: bool = Field(
        ...,
        description="Informa se o IBGE aplicou sigilo estatistico na celula.",
    )
    metodologia_versao: str = Field(
        ...,
        description="Versao da esteira metodologica de de-para.",
    )


class FluxoComercial(BaseModel):
    importacao_valor_fob: float = Field(
        ...,
        ge=0,
        description="Valor total das importacoes em USD FOB.",
    )
    importacao_peso_liquido: float = Field(
        ...,
        ge=0,
        description="Peso liquido das importacoes em kg.",
    )
    exportacao_valor_fob: float = Field(
        ...,
        ge=0,
        description="Valor total das exportacoes em USD FOB.",
    )
    exportacao_peso_liquido: float = Field(
        ...,
        ge=0,
        description="Peso liquido das exportacoes em kg.",
    )
    deficit_comercial: float = Field(
        ...,
        description="Diferenca calculada: importacao - exportacao.",
    )
    principal_pais_origem: str = Field(
        ...,
        description="Pais lider em fornecimento externo.",
    )
    principal_pais_participacao: float = Field(
        ...,
        ge=0,
        le=1,
        description="Fracao de participacao do pais lider.",
    )
    hhi_global: float = Field(
        ...,
        ge=0,
        le=10000,
        description="Indice HHI de concentracao de fornecedores.",
    )

    @model_validator(mode="after")
    def validar_deficit(self) -> "FluxoComercial":
        esperado = self.importacao_valor_fob - self.exportacao_valor_fob
        if abs(self.deficit_comercial - esperado) > 0.01:
            raise ValueError(
                "O deficit comercial divergiu da equacao fundamental (Imp - Exp)."
            )
        return self


class EstruturaDomestica(BaseModel):
    cnae_codigo: str = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Codigo da classe CNAE a 4 digitos.",
    )
    prodlist_codigo: str = Field(
        ...,
        min_length=8,
        max_length=8,
        description="Codigo PRODLIST-Industria oficial.",
    )
    valor_producao_pia: float = Field(
        ...,
        ge=0,
        description="Valor da producao industrial do elo domestico em R$.",
    )
    consumo_aparente: float = Field(
        ...,
        ge=0,
        description="Consumo aparente estimado em USD equivalentes.",
    )
    dependencia_externa_fracao: float = Field(
        ...,
        ge=0,
        le=1,
        description="Razao de dependencia externa real.",
    )
    qtde_vinculos_rais: int = Field(
        ...,
        ge=0,
        description="Volume de postos de trabalho formais no elo territorial.",
    )
    massa_salarial_rais: float = Field(
        ...,
        ge=0,
        description="Massa salarial total gerada no territorio em R$.",
    )


class FatorProporcionalidade(BaseModel):
    aplicado: bool = Field(
        ...,
        description="Define se o corte proporcional por uso final esta ativo.",
    )
    fator_alpha: float = Field(
        ...,
        ge=0,
        le=1,
        description="Coeficiente multiplicador de corte.",
    )
    fonte_proxy: str = Field(
        ...,
        description="Fonte regulatoria ou proxy de insumo-produto utilizada.",
    )


class ProdutoConceitual(BaseModel):
    conceptual_product_id: str = Field(
        ...,
        description="Identificador unico do no do produto conceitual.",
    )
    produto_nome: str = Field(
        ...,
        description="Nomenclatura refinada para formuladores de politicas.",
    )
    cadeia_prioritaria: CadeiaPrioritariaEnum = Field(
        ...,
        description="Cadeia prioritaria associada na plataforma.",
    )
    chain_stage: ChainStageEnum = Field(
        ...,
        description="Elo de posicionamento na cadeia industrial de valor.",
    )
    ncm_codigo: str = Field(
        ...,
        min_length=8,
        max_length=8,
        description="NCM de 8 digitos sob auditoria.",
    )
    comercio: FluxoComercial
    industria: EstruturaDomestica
    auditoria: MetadadosAuditoria
    fator_proporcionalidade: FatorProporcionalidade


class ApiResponseQuery(BaseModel):
    total_records: int
    timestamp: datetime
    data: List[ProdutoConceitual]


DATABASE_MOCK: list[dict] = [
    {
        "conceptual_product_id": "prod_cloreto_potassio",
        "produto_nome": "Cloreto de Potassio",
        "cadeia_prioritaria": "fertilizantes",
        "chain_stage": "insumo",
        "ncm_codigo": "31042090",
        "comercio": {
            "importacao_valor_fob": 4140000000.0,
            "importacao_peso_liquido": 9200000000.0,
            "exportacao_valor_fob": 0.0,
            "exportacao_peso_liquido": 0.0,
            "deficit_comercial": 4140000000.0,
            "principal_pais_origem": "Canada",
            "principal_pais_participacao": 0.365,
            "hhi_global": 2450.0,
        },
        "industria": {
            "cnae_codigo": "2012",
            "prodlist_codigo": "20122060",
            "valor_producao_pia": 450000000.0,
            "consumo_aparente": 4590000000.0,
            "dependencia_externa_fracao": 0.9019,
            "qtde_vinculos_rais": 1420,
            "massa_salarial_rais": 8900000.0,
        },
        "auditoria": {
            "reference_year": 2026,
            "confidence_level": "alta",
            "is_ncm_generica": False,
            "has_sigilo_pia": False,
            "metodologia_versao": APP_VERSION,
        },
        "fator_proporcionalidade": {
            "aplicado": False,
            "fator_alpha": 1.0,
            "fonte_proxy": "Matriz Insumo-Produto IBGE",
        },
    },
    {
        "conceptual_product_id": "prod_sulfato_amonio",
        "produto_nome": "Sulfato de Amonio",
        "cadeia_prioritaria": "fertilizantes",
        "chain_stage": "insumo",
        "ncm_codigo": "31022100",
        "comercio": {
            "importacao_valor_fob": 850000000.0,
            "importacao_peso_liquido": 3100000000.0,
            "exportacao_valor_fob": 12000000.0,
            "exportacao_peso_liquido": 45000000.0,
            "deficit_comercial": 838000000.0,
            "principal_pais_origem": "China",
            "principal_pais_participacao": 0.9982,
            "hhi_global": 9964.0,
        },
        "industria": {
            "cnae_codigo": "2012",
            "prodlist_codigo": "20122110",
            "valor_producao_pia": 610000000.0,
            "consumo_aparente": 1448000000.0,
            "dependencia_externa_fracao": 0.587,
            "qtde_vinculos_rais": 890,
            "massa_salarial_rais": 5200000.0,
        },
        "auditoria": {
            "reference_year": 2026,
            "confidence_level": "alta",
            "is_ncm_generica": False,
            "has_sigilo_pia": False,
            "metodologia_versao": APP_VERSION,
        },
        "fator_proporcionalidade": {
            "aplicado": True,
            "fator_alpha": 0.154,
            "fonte_proxy": "RenovaCalc-V7 / ANP",
        },
    },
]


@app.get(
    "/api/query",
    response_model=ApiResponseQuery,
    status_code=status.HTTP_200_OK,
    summary="Consulta analitica unificada de produtos conceituais das cadeias verdes",
    tags=["Analytical Camada Published"],
)
def get_analytical_data(
    chain: Optional[CadeiaPrioritariaEnum] = Query(
        None,
        description="Filtro de cadeia prioritaria para planejamento industrial.",
    )
) -> dict:
    try:
        filtered_data = DATABASE_MOCK
        if chain:
            filtered_data = [
                product
                for product in DATABASE_MOCK
                if product["cadeia_prioritaria"] == chain.value
            ]

        return {
            "total_records": len(filtered_data),
            "timestamp": datetime.now(timezone.utc),
            "data": filtered_data,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Falha critica no processamento do motor analitico do back-end: "
                f"{exc}"
            ),
        ) from exc


@app.get(
    "/api/health",
    status_code=status.HTTP_200_OK,
    tags=["System Infrastructure"],
)
def health_check() -> dict:
    return {
        "status": "operational",
        "engine_version": APP_VERSION,
        "layer": "analytical_published",
    }
