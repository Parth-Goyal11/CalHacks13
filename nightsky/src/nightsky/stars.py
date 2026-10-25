"""Load Hipparcos stars brighter than a magnitude limit."""

from __future__ import annotations

import csv
import hashlib
import io

import psycopg
from skyfield.api import Loader
from skyfield.data import hipparcos

from nightsky.db import insert_landing
from nightsky.paths import SKYFIELD, STAR_NAMES
from nightsky.solve import Star

MAG_LIMIT = 8.0


def load_stars(conn: psycopg.Connection, mag_limit: float = MAG_LIMIT) -> int:
    frame, checksum, cache_name = _read_hipparcos()
    names = _read_names()
    rows = []
    for hip, row in frame.iterrows():
        mag = row["magnitude"]
        if mag != mag or float(mag) > mag_limit:
            continue
        catalog_id = str(int(hip))
        rows.append(
            (
                catalog_id,
                names.get(catalog_id),
                float(row["ra_degrees"]),
                float(row["dec_degrees"]),
                float(mag),
                _optional_float(row["ra_mas_per_year"]),
                _optional_float(row["dec_mas_per_year"]),
                _optional_float(row["parallax_mas"]),
            )
        )
    with conn.cursor() as cur:
        cur.execute("truncate stars")
        with cur.copy(
            """
            copy stars (catalog_id, name, ra_deg, dec_deg, mag, pm_ra, pm_dec, parallax)
            from stdin
            """
        ) as copy:
            for row in rows:
                copy.write_row(row)
    insert_landing(
        conn,
        source="hipparcos",
        checksum=checksum,
        body={
            "cache_file": cache_name,
            "mag_limit": mag_limit,
            "row_count": len(rows),
        },
    )
    conn.commit()
    return len(rows)


def bright_stars(conn: psycopg.Connection, mag_limit: float = 3.5) -> list[Star]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select catalog_id, name, ra_deg, dec_deg, mag
            from stars
            where mag <= %s
            """,
            (mag_limit,),
        )
        found = cur.fetchall()
    return [
        Star(catalog_id, name, ra_deg, dec_deg, mag)
        for catalog_id, name, ra_deg, dec_deg, mag in found
    ]


def stars_for_render(conn: psycopg.Connection, mag_limit: float = 6.5) -> list[Star]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select catalog_id, name, ra_deg, dec_deg, mag
            from stars
            where mag <= %s
              and ra_deg between 68 and 102
              and dec_deg between -22 and 18
            """,
            (mag_limit,),
        )
        found = cur.fetchall()
    return [
        Star(catalog_id, name, ra_deg, dec_deg, mag)
        for catalog_id, name, ra_deg, dec_deg, mag in found
    ]


def _read_hipparcos():
    loader = Loader(str(SKYFIELD))
    with loader.open(hipparcos.URL) as handle:
        raw = handle.read()
    checksum = hashlib.sha256(raw).hexdigest()
    frame = hipparcos.load_dataframe(io.BytesIO(raw))
    cache = next(SKYFIELD.glob("hip_main.dat*"), SKYFIELD / "hip_main.dat")
    return frame, checksum, cache.name


def _read_names() -> dict[str, str]:
    with STAR_NAMES.open(newline="") as handle:
        return {row["catalog_id"]: row["name"] for row in csv.DictReader(handle)}


def _optional_float(value):
    if value != value:
        return None
    return float(value)
