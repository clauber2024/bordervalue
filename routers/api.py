from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from api.main import APP_VERSION, ProdutoConceitual, SovereigntyGraphResponse
from database.data_access import (
    DataAccessUnavailableError,
    PublishedFilters,
    get_conceptual_products,
    get_aipnet_metrics,
    get_sovereignty_graph,
)
from schemas.network import GraphResponse, SolarSovereigntyResponse
from services.network_service import build_sovereignty_network


router = APIRouter(prefix="/api", tags=["Analytical Camada Published"])


@router.get(
    "/networks/sovereignty",
    response_model=GraphResponse,
    status_code=status.HTTP_200_OK,
    tags=["AIPNET"],
)
async def read_sovereignty_network(
    chain: str = Query(..., min_length=1),
) -> GraphResponse:
    try:
        return build_sovereignty_network(chain)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cadeia AIPNET não suportada: {chain}",
        ) from exc


@router.get(
    "/networks/sovereignty/inputs",
    response_model=SolarSovereigntyResponse,
    status_code=status.HTTP_200_OK,
    tags=["AIPNET"],
)
async def read_solar_sovereignty_inputs(
    chain: str = Query(..., min_length=1),
) -> SolarSovereigntyResponse:
    try:
        payload = await run_in_threadpool(get_aipnet_metrics, chain)
    except DataAccessUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Métricas AIPNET indisponíveis no banco Published.",
        ) from exc
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cadeia AIPNET não suportada: {chain}",
        )
    return SolarSovereigntyResponse.model_validate(payload)


class MetadataApi(BaseModel):
    timestamp_requisicao: datetime = Field(
        ...,
        description="Timestamp UTC em que a requisicao foi processada pela API.",
    )
    engine_version: str = Field(
        APP_VERSION,
        description="Versao do motor analitico responsavel pela resposta.",
    )


class ProdutoConceitualComMetadata(ProdutoConceitual):
    metadata_api: MetadataApi


@router.get(
    "/chain/{chain_name}",
    response_model=List[ProdutoConceitualComMetadata],
    status_code=status.HTTP_200_OK,
)
async def read_chain_data(
    chain_name: str,
    period: str = Query("all"),
    flow: str = Query("all"),
    conceptual_product: str = Query("all"),
    product: str = Query("all"),
    ncm: str = Query(""),
    cnae: str = Query("all"),
    prodlist: str = Query("all"),
    country: str = Query(""),
    partner: str = Query(""),
    mapping_status: str = Query("all"),
    status_filter: str = Query("all", alias="status"),
    confidence: str = Query("all"),
    audit_confidence: str = Query("all"),
) -> List[ProdutoConceitualComMetadata]:
    metadata_api = MetadataApi(
        timestamp_requisicao=datetime.now(timezone.utc),
        engine_version=APP_VERSION,
    )
    filters = _published_filters(
        chain=chain_name,
        period=period,
        flow=flow,
        conceptual_product=conceptual_product if conceptual_product != "all" else product,
        ncm=ncm,
        cnae=cnae,
        prodlist=prodlist,
        partner=partner or country,
        mapping_status=mapping_status if mapping_status != "all" else status_filter,
        confidence=confidence if confidence != "all" else audit_confidence,
    )

    try:
        products = await run_in_threadpool(get_conceptual_products, chain_name, filters)
    except DataAccessUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro de conexao com o banco de dados Published.",
        ) from exc

    if not products:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cadeia inexistente ou sem dados publicados: {chain_name}",
        )

    return [
        ProdutoConceitualComMetadata.model_validate(
            {**product, "metadata_api": metadata_api}
        )
        for product in products
    ]


@router.get(
    "/graph/{chain_name}",
    response_model=SovereigntyGraphResponse,
    status_code=status.HTTP_200_OK,
)
async def read_chain_graph(
    chain_name: str,
    period: str = Query("all"),
    flow: str = Query("all"),
    conceptual_product: str = Query("all"),
    product: str = Query("all"),
    ncm: str = Query(""),
    cnae: str = Query("all"),
    prodlist: str = Query("all"),
    country: str = Query(""),
    partner: str = Query(""),
    mapping_status: str = Query("all"),
    status_filter: str = Query("all", alias="status"),
    confidence: str = Query("all"),
    audit_confidence: str = Query("all"),
) -> SovereigntyGraphResponse:
    filters = _published_filters(
        chain=chain_name,
        period=period,
        flow=flow,
        conceptual_product=conceptual_product if conceptual_product != "all" else product,
        ncm=ncm,
        cnae=cnae,
        prodlist=prodlist,
        partner=partner or country,
        mapping_status=mapping_status if mapping_status != "all" else status_filter,
        confidence=confidence if confidence != "all" else audit_confidence,
    )

    try:
        graph = await run_in_threadpool(get_sovereignty_graph, chain_name, filters)
    except DataAccessUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro de conexao com o banco de dados Published.",
        ) from exc

    if not graph["nodes"] or not graph["edges"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cadeia inexistente ou sem grafo publicado: {chain_name}",
        )

    return SovereigntyGraphResponse.model_validate(graph)


def _published_filters(
    *,
    chain: str,
    period: str,
    flow: str,
    conceptual_product: str,
    ncm: str,
    cnae: str,
    prodlist: str,
    partner: str,
    mapping_status: str,
    confidence: str,
) -> PublishedFilters:
    return PublishedFilters(
        chain=chain,
        period=period,
        flow=flow,
        conceptual_product=conceptual_product,
        ncm=ncm,
        cnae=cnae,
        prodlist=prodlist,
        partner=partner,
        mapping_status=mapping_status,
        confidence=confidence,
    )
