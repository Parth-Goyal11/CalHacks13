"""Postgres connection and schema setup."""

import os

import psycopg
from psycopg.types.json import Json

from nightsky.paths import SCHEMA

DEFAULT_URL = "postgresql://nightsky:nightsky@127.0.0.1:5432/nightsky"


def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_URL)


def connect() -> psycopg.Connection:
    return psycopg.connect(database_url())


def init_db(conn: psycopg.Connection) -> None:
    sql = SCHEMA.read_text()
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def insert_landing(
    conn: psycopg.Connection,
    source: str,
    checksum: str | None,
    body: dict,
    status: str = "ok",
    error: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into landing (source, checksum, body, status, error)
            values (%s, %s, %s, %s, %s)
            """,
            (source, checksum, Json(body), status, error),
        )
