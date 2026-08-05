"""Strict contracts for AIPNET productive-network graphs."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class NetworkEvidence(BaseModel):
    """Measurement coverage attached to an AIPNET productive stage."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    external_dependency: Optional[float] = Field(default=None, ge=0, le=1)
    supplier_hhi: Optional[float] = Field(default=None, ge=0, le=10000)
    china_share: Optional[float] = Field(default=None, ge=0, le=1)
    domestic_production_status: Literal["confirmed", "absent", "unknown"]
    measurement_method: Literal["validated", "estimated", "structural"]
    confidence_level: Literal["alta", "media", "baixa"]
    data_gap_reason: Optional[str] = Field(default=None, min_length=1)


class Node(BaseModel):
    """A productive stage represented in the global value-chain graph."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    stage: str = Field(..., min_length=1)
    country: str = Field(..., min_length=1)
    is_critical: bool
    related_inputs: List[str] = Field(default_factory=list)
    evidence: Optional[NetworkEvidence] = None


class Edge(BaseModel):
    """A directed financial or physical flow between productive stages."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    source: str = Field(..., min_length=1)
    target: str = Field(..., min_length=1)
    value: float = Field(..., gt=0)
    alert_message: Optional[str] = Field(default=None, min_length=1)


class GraphResponse(BaseModel):
    """Validated AIPNET graph returned to analytical clients."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    chain_name: str = Field(..., min_length=1)
    nodes: List[Node]
    edges: List[Edge]

    @model_validator(mode="after")
    def validate_topology(self) -> "GraphResponse":
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Node IDs must be unique.")

        known_node_ids = set(node_ids)
        for edge in self.edges:
            if edge.source == edge.target:
                raise ValueError("An edge cannot connect a node to itself.")
            if edge.source not in known_node_ids or edge.target not in known_node_ids:
                raise ValueError("Every edge must reference existing nodes.")

        return self


class SupplierMetric(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    country_code: str
    country_name: str
    country_iso3: str
    value_usd: float = Field(ge=0)
    share: float = Field(ge=0, le=1)


class MonthlyTradeMetric(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    period: str
    flow: Literal["IMP", "EXP"]
    value_usd: float = Field(ge=0)
    net_weight_kg: float = Field(ge=0)


class SolarInputMetric(BaseModel):
    """Auditable trade, production and concentration evidence for one input."""

    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    input_id: str
    label: str
    stage: str
    ncm_codes: List[str]
    reference_period: str
    imports_value_usd: float = Field(ge=0)
    exports_value_usd: float = Field(ge=0)
    imports_net_weight_kg: float = Field(ge=0)
    exports_net_weight_kg: float = Field(ge=0)
    trade_balance_usd: float
    china_share_brazilian_imports: float = Field(ge=0, le=1)
    supplier_hhi_brazil: float = Field(ge=0, le=10000)
    top_supplier: Optional[SupplierMetric] = None
    suppliers: List[SupplierMetric]
    monthly_trade: List[MonthlyTradeMetric]
    domestic_production_value_usd_comparable: Optional[float] = Field(default=None, ge=0)
    external_dependency: Optional[float] = Field(default=None, ge=0)
    global_china_share: Optional[float] = Field(default=None, ge=0, le=1)
    global_hhi_floor: Optional[float] = Field(default=None, ge=0, le=10000)
    measurement_method: Literal["validated", "estimated", "structural"]
    confidence_level: Literal["alta", "media", "baixa"]
    data_gap_reason: Optional[str] = None


class SolarSovereigntyResponse(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)

    chain_name: Literal["silicio", "fertilizantes", "combustiveis_transicao", "aco"]
    reference_period: str
    methodology_version: str
    inputs: List[SolarInputMetric]
