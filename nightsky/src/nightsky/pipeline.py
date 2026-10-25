"""End-to-end catalog load, Orion plate solve, and identification."""

from __future__ import annotations

import math
from datetime import datetime, timezone

import psycopg
from psycopg.types.json import Json

from nightsky.db import init_db
from nightsky.imageutil import draw_labels, load_gray_png, render_starfield, save_gray_png
from nightsky.match import identify_capture, label_marks
from nightsky.paths import OUTPUT
from nightsky.planets import ensure_kernel
from nightsky.satellites import load_satellites
from nightsky.solve import solve_image
from nightsky.stars import bright_stars, load_stars, stars_for_render
from nightsky.wcs import WCS, angular_separation_deg, sky_to_pixel

ORION_TRUTH = WCS(
    ra0=84.0,
    dec0=-1.2,
    scale_arcsec=72.0,
    rotation_deg=15.0,
    width=900,
    height=900,
)
DEMO_KEY = "output/orion.png"
DEMO_WHEN = datetime(2026, 10, 24, 6, 0, tzinfo=timezone.utc)
DEMO_LAT = 31.95
DEMO_LON = -110.8
BELT = ("Mintaka", "Alnilam", "Alnitak")


def orion_belt_rows(conn: psycopg.Connection):
    with conn.cursor() as cur:
        cur.execute(
            """
            select catalog_id, name, mag, ra_deg, dec_deg
            from stars
            where mag <= 6
              and ra_deg between 80 and 88
              and dec_deg between -5 and 2
            order by mag
            limit 20
            """
        )
        return cur.fetchall()


def run_orion_demo(conn: psycopg.Connection) -> dict:
    """Render a known Orion field, solve it from the pixels, and label the catalog."""
    rendered = render_starfield(stars_for_render(conn), ORION_TRUTH)
    photo = OUTPUT / "orion.png"
    save_gray_png(rendered, photo)
    pixels = load_gray_png(photo)
    solved = solve_image(pixels, bright_stars(conn, mag_limit=3.5))
    capture_id = _store_solution(conn, solved)
    identifications = identify_capture(
        conn,
        capture_id,
        pixels,
        solved,
        DEMO_WHEN,
        DEMO_LAT,
        DEMO_LON,
        elevation_m=700,
        exposure_seconds=5,
    )
    labeled = OUTPUT / "orion_labeled.png"
    draw_labels(pixels, label_marks(identifications), labeled)
    return {
        "capture_id": capture_id,
        "solved": solved,
        "truth": ORION_TRUTH,
        "identifications": identifications,
        "photo": photo,
        "labeled": labeled,
        "center_error_deg": angular_separation_deg(
            solved.ra0, solved.dec0, ORION_TRUTH.ra0, ORION_TRUTH.dec0
        ),
    }


def belt_pixel_errors(conn: psycopg.Connection, solved: WCS, identifications: list[dict]) -> dict[str, float]:
    errors = {}
    by_name = {row["name"]: row for row in identifications if row["name"]}
    with conn.cursor() as cur:
        cur.execute(
            "select name, ra_deg, dec_deg from stars where name = any(%s)",
            (list(BELT),),
        )
        catalog = {name: (ra, dec) for name, ra, dec in cur.fetchall()}
    for name in BELT:
        ra, dec = catalog[name]
        truth_x, truth_y = sky_to_pixel(ra, dec, ORION_TRUTH)
        solved_x, solved_y = sky_to_pixel(ra, dec, solved)
        row = by_name[name]
        errors[name] = math.hypot(row["pixel_x"] - truth_x, row["pixel_y"] - truth_y)
        errors[name + "_solved"] = math.hypot(solved_x - truth_x, solved_y - truth_y)
    return errors


def store_solved_capture(
    conn: psycopg.Connection,
    solved: WCS,
    image_key: str,
    taken_at: datetime | None,
    latitude: float | None,
    longitude: float | None,
    elevation_m: float | None,
    exposure_seconds: float | None,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            delete from identifications
            where capture_id in (select id from captures where image_key = %s)
            """,
            (image_key,),
        )
        cur.execute(
            """
            delete from plate_solutions
            where capture_id in (select id from captures where image_key = %s)
            """,
            (image_key,),
        )
        cur.execute("delete from captures where image_key = %s", (image_key,))
        cur.execute(
            """
            insert into captures
                (taken_at, latitude, longitude, elevation_m, exposure_seconds, image_key, solve_status)
            values (%s, %s, %s, %s, %s, %s, 'solved')
            returning id
            """,
            (taken_at, latitude, longitude, elevation_m, exposure_seconds, image_key),
        )
        capture_id = int(cur.fetchone()[0])
        cur.execute(
            """
            insert into plate_solutions
                (capture_id, center_ra_deg, center_dec_deg, pixel_scale_arcsec, rotation_deg, wcs)
            values (%s, %s, %s, %s, %s, %s)
            """,
            (
                capture_id,
                solved.ra0,
                solved.dec0,
                solved.scale_arcsec,
                solved.rotation_deg,
                Json(solved.as_dict()),
            ),
        )
    conn.commit()
    return capture_id


def _store_solution(conn: psycopg.Connection, solved: WCS) -> int:
    return store_solved_capture(
        conn,
        solved,
        DEMO_KEY,
        DEMO_WHEN,
        DEMO_LAT,
        DEMO_LON,
        700,
        5,
    )


def prepare_catalog(conn: psycopg.Connection) -> dict:
    init_db(conn)
    star_count = load_stars(conn)
    satellite_count = load_satellites(conn)
    kernel = ensure_kernel()
    return {
        "stars": star_count,
        "satellites": satellite_count,
        "kernel": str(kernel),
    }
