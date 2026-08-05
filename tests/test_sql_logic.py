from __future__ import annotations

import os
import uuid
from decimal import Decimal
from pathlib import Path

import psycopg2
import pytest
from psycopg2 import sql
from psycopg2.extensions import connection as PgConnection


ROOT_DIR = Path(__file__).resolve().parents[1]
SQL_DIR = ROOT_DIR / "sql"

DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "port": 5433,
    "dbname": os.getenv("PGDATABASE", "border_value_db"),
    "user": os.getenv("PGUSER", "border_user"),
    "password": os.getenv("PGPASSWORD", "border_password"),
}


@pytest.fixture
def db() -> PgConnection:
    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError as exc:
        pytest.fail(
            "Nao foi possivel conectar ao PostgreSQL de testes. "
            "Confirme que o Docker Compose esta ativo e que PGHOST/PGPORT/"
            "PGDATABASE/PGUSER/PGPASSWORD apontam para o banco correto. "
            f"Erro original: {exc}"
        )

    conn.autocommit = True
    schema_name = f"test_sql_logic_{uuid.uuid4().hex}"

    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema_name))
        )
        cur.execute(
            sql.SQL("SET search_path TO {}, public").format(
                sql.Identifier(schema_name)
            )
        )
        create_base_tables(cur)

    try:
        yield conn
    finally:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(
                    sql.Identifier(schema_name)
                )
            )
        conn.close()


def create_base_tables(cur) -> None:
    cur.execute(
        """
        CREATE TABLE analytical_comex_staging (
            conceptual_product_id text NOT NULL,
            cadeia_prioritaria text,
            principal_pais_origem text,
            importacao_valor_fob numeric NOT NULL DEFAULT 0,
            importacao_peso_liquido numeric NOT NULL DEFAULT 0,
            exportacao_valor_fob numeric NOT NULL DEFAULT 0
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE analytical_industry_and_employment (
            conceptual_product_id text NOT NULL,
            produto_nome text,
            ncm_codigo text,
            cnae_codigo text,
            prodlist_codigo text,
            valor_producao_pia numeric NOT NULL DEFAULT 0,
            proportion_factor numeric NOT NULL DEFAULT 1,
            qtde_vinculos_rais numeric NOT NULL DEFAULT 0,
            massa_salarial_rais numeric NOT NULL DEFAULT 0
        )
        """
    )


def execute_sql_file(conn: PgConnection, filename: str) -> None:
    with conn.cursor() as cur:
        cur.execute((SQL_DIR / filename).read_text(encoding="utf-8"))


def test_hhi_calculation(db: PgConnection) -> None:
    product_id = "qa_hhi_dinamarca_724"
    total_import = Decimal("275800000") / Decimal("0.724")

    country_shares = {
        "Dinamarca": Decimal("0.724"),
        "Alemanha": Decimal("0.142882961206433"),
        "Canada": Decimal("0.083117038793567"),
        "Chile": Decimal("0.050"),
    }
    expected_hhi = sum(share * share for share in country_shares.values()) * 10000

    with db.cursor() as cur:
        for country, share in country_shares.items():
            cur.execute(
                """
                INSERT INTO analytical_comex_staging (
                    conceptual_product_id,
                    principal_pais_origem,
                    importacao_valor_fob,
                    importacao_peso_liquido,
                    exportacao_valor_fob
                )
                VALUES (%s, %s, %s, 0, 0)
                """,
                (product_id, country, total_import * share),
            )

    execute_sql_file(db, "mv_published_hhi_risk.sql")

    with db.cursor() as cur:
        cur.execute(
            """
            SELECT hhi_global
            FROM mv_published_hhi_risk
            WHERE conceptual_product_id = %s
            """,
            (product_id,),
        )
        row = cur.fetchone()

    assert row is not None
    assert country_shares["Dinamarca"] == Decimal("0.724")
    assert total_import * country_shares["Dinamarca"] == Decimal("275800000")
    assert float(row[0]) == pytest.approx(float(expected_hhi), abs=0.01)
    assert float(row[0]) == pytest.approx(5540, abs=0.5)


def test_consumo_aparente_logic(db: PgConnection) -> None:
    product_id = "qa_consumo_aparente_producao_zero"

    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO analytical_comex_staging (
                conceptual_product_id,
                principal_pais_origem,
                importacao_valor_fob,
                importacao_peso_liquido,
                exportacao_valor_fob
            )
            VALUES (%s, 'Origem QA', 195000000, 0, 0)
            """,
            (product_id,),
        )
        cur.execute(
            """
            INSERT INTO analytical_industry_and_employment (
                conceptual_product_id,
                valor_producao_pia,
                proportion_factor,
                qtde_vinculos_rais,
                massa_salarial_rais
            )
            VALUES (%s, 0, 1, 0, 0)
            """,
            (product_id,),
        )

    execute_sql_file(db, "mv_published_indicators.sql")

    with db.cursor() as cur:
        cur.execute(
            """
            SELECT
                total_import_fob,
                total_export_fob,
                production_weighted,
                consumo_aparente
            FROM mv_published_indicators
            WHERE conceptual_product_id = %s
            """,
            (product_id,),
        )
        row = cur.fetchone()

    assert row is not None
    total_import_fob, total_export_fob, production_weighted, consumo_aparente = row

    assert total_import_fob == Decimal("195000000")
    assert total_export_fob == Decimal("0")
    assert production_weighted == Decimal("0")
    assert consumo_aparente == Decimal("195000000")
