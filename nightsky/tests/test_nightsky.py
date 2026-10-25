"""Catalog, plate solve, unlocker client, and MCP config."""

import json
import math
import threading
from datetime import datetime, timezone
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import pytest
from PIL import Image

from nightsky.brightdata import ZONE, credit_allowance, ensure_monthly_cap, prepaid_credits, prove_unlock
from nightsky.db import connect, init_db, insert_landing
from nightsky.mcpprobe import call_session_stats
from nightsky.imageutil import detect_stars, display_gray, load_gray_png, render_starfield, save_gray_png
from nightsky.mcpconf import SERVER, write_config
from nightsky.paths import OUTPUT
from nightsky.match import display_name
from nightsky.photos import identify_photo, read_exif
from nightsky.pipeline import BELT, DEMO_WHEN, ORION_TRUTH, orion_belt_rows, prepare_catalog, run_orion_demo
from nightsky.planets import ensure_kernel
from nightsky.satellites import load_satellites, propagate
from nightsky.solve import Star, solve_image
from nightsky.stars import _read_hipparcos, _read_names, stars_for_render
from nightsky.web import ViewerHandler, parse_multipart
from nightsky.wcs import WCS, angular_separation_deg, pixel_to_sky, ra_interval, sky_to_pixel


@pytest.fixture(scope="module")
def db():
    with connect() as conn:
        summary = prepare_catalog(conn)
        yield conn, summary


def test_projection_roundtrip():
    wcs = WCS(84.0, -1.2, 72.0, 15.0, 900, 900)
    for x, y in ((100, 120), (450, 450), (800, 700), (20, 880)):
        ra, dec = pixel_to_sky(x, y, wcs)
        px, py = sky_to_pixel(ra, dec, wcs)
        assert abs(px - x) < 1e-4
        assert abs(py - y) < 1e-4


def test_ra_interval_wraps_across_zero():
    start, end, wraps = ra_interval([350.0, 10.0, 20.0])
    assert wraps
    assert start == pytest.approx(350.0)
    assert end == pytest.approx(20.0)
    start, end, wraps = ra_interval([78.0, 84.0, 88.0])
    assert not wraps
    assert start == pytest.approx(78.0)
    assert end == pytest.approx(88.0)


def test_schema_and_orion_query(db):
    conn, summary = db
    init_db(conn)
    assert summary["stars"] > 40000
    assert summary["satellites"] >= 100
    assert Path(summary["kernel"]).exists()
    rows = orion_belt_rows(conn)
    names = {name for _id, name, _mag, _ra, _dec in rows}
    assert set(BELT) <= names


def test_epoch_does_not_move_backwards(db):
    conn, _summary = db
    with conn.cursor() as cur:
        cur.execute("select norad_id, epoch from satellites order by norad_id limit 1")
        norad_id, original = cur.fetchone()
        cur.execute(
            "update satellites set epoch = %s where norad_id = %s",
            (datetime(2099, 1, 1, tzinfo=timezone.utc), norad_id),
        )
    conn.commit()
    try:
        load_satellites(conn)
        with conn.cursor() as cur:
            cur.execute("select epoch from satellites where norad_id = %s", (norad_id,))
            kept = cur.fetchone()[0]
        assert kept.year == 2099
    finally:
        with conn.cursor() as cur:
            cur.execute(
                "update satellites set epoch = %s where norad_id = %s",
                (datetime(2000, 1, 1, tzinfo=timezone.utc), norad_id),
            )
        conn.commit()
        load_satellites(conn)


def test_kernel_and_satellite_propagation(db):
    conn, _summary = db
    assert ensure_kernel().name == "de421.bsp"
    with conn.cursor() as cur:
        cur.execute("select norad_id, elements from satellites where norad_id = 25544")
        row = cur.fetchone()
    assert row is not None
    norad_id, elements = row
    ra_deg, dec_deg, alt_deg = propagate(
        norad_id,
        elements,
        datetime.now(timezone.utc),
        31.95,
        -110.8,
    )
    assert math.isfinite(ra_deg)
    assert math.isfinite(dec_deg)
    assert -90 <= alt_deg <= 90


def test_blind_solve_recovers_orion():
    frame, _checksum, _name = _read_hipparcos()
    names = _read_names()
    catalog = []
    render_stars = []
    for hip, row in frame.iterrows():
        mag = row["magnitude"]
        if mag != mag:
            continue
        star = Star(str(int(hip)), names.get(str(int(hip))), float(row["ra_degrees"]), float(row["dec_degrees"]), float(mag))
        if mag <= 3.5:
            catalog.append(star)
        if mag <= 6.5 and 68 <= star.ra_deg <= 102 and -22 <= star.dec_deg <= 18:
            render_stars.append(star)
    image = render_starfield(render_stars, ORION_TRUTH)
    photo = Path("/tmp/orion-solve.png")
    save_gray_png(image, photo)
    solved = solve_image(load_gray_png(photo), catalog)
    assert angular_separation_deg(solved.ra0, solved.dec0, ORION_TRUTH.ra0, ORION_TRUTH.dec0) < 0.08
    assert abs(solved.scale_arcsec - ORION_TRUTH.scale_arcsec) / ORION_TRUTH.scale_arcsec < 0.03
    rotation_error = (solved.rotation_deg - ORION_TRUTH.rotation_deg + 180) % 360 - 180
    assert abs(rotation_error) < 0.8


def test_tight_field_of_fainter_stars_still_solves(db):
    """A zoomed Pleiades field has no triangle of magnitude-3.5 stars."""
    conn, _summary = db
    from nightsky.stars import bright_stars

    catalog = bright_stars(conn, mag_limit=5.6)
    truth = WCS(ra0=56.9, dec0=24.1, scale_arcsec=55.0, rotation_deg=-20.0, width=900, height=1100)
    render = [
        star
        for star in catalog
        if angular_separation_deg(star.ra_deg, star.dec_deg, truth.ra0, truth.dec0) < 16
    ]
    image = render_starfield(render, truth)
    with pytest.raises(RuntimeError, match="named"):
        solve_image(image, [star for star in catalog if star.mag <= 3.5])
    solved = solve_image(image, catalog)
    assert angular_separation_deg(solved.ra0, solved.dec0, truth.ra0, truth.dec0) < 0.15
    assert abs(solved.scale_arcsec - truth.scale_arcsec) / truth.scale_arcsec < 0.05


def test_speckles_are_not_named(db):
    conn, _summary = db
    from nightsky.stars import bright_stars

    rng = np.random.default_rng(1)
    image = rng.normal(8, 3, (700, 900)).astype(np.float32)
    for y, x in ((40, 80), (200, 400), (350, 120), (500, 600), (150, 700), (420, 250), (80, 500), (600, 300)):
        image[y, x] = 220
    with pytest.raises(RuntimeError, match="named"):
        solve_image(image, bright_stars(conn, mag_limit=5.6))


def test_ambiguous_night_frame_is_not_named(db):
    photo = OUTPUT / "uploads" / "da872a27df444fc4b8197e3a3d993cb7.png"
    if not photo.exists():
        pytest.skip("local ambiguous photo")
    from nightsky.stars import bright_stars

    conn, _summary = db
    with pytest.raises(RuntimeError, match="No single patch"):
        solve_image(load_gray_png(photo), bright_stars(conn, mag_limit=5.6))


def test_saturated_hazy_orion_stays_on_the_true_sky(db):
    """Burned-out stars must be centered, or a hazy frame locks onto the wrong sky."""
    conn, _summary = db
    from nightsky.stars import bright_stars

    catalog = bright_stars(conn, mag_limit=6.5)
    truth = WCS(ra0=84.0, dec0=-5.0, scale_arcsec=160.0, rotation_deg=25.0, width=1050, height=1400)
    render = [
        star
        for star in catalog
        if angular_separation_deg(star.ra_deg, star.dec_deg, truth.ra0, truth.dec0) < 40
    ]
    clean = render_starfield(render, truth)
    rng = np.random.default_rng(3)
    hazy = np.clip(clean * 4 + np.linspace(30, 120, clean.shape[0], dtype=np.float32)[:, None], 0, 255)
    hazy = np.clip(hazy + rng.normal(0, 4, hazy.shape).astype(np.float32), 0, 255)
    solved = solve_image(hazy, [star for star in catalog if star.mag <= 5.6])
    assert angular_separation_deg(solved.ra0, solved.dec0, truth.ra0, truth.dec0) < 0.2
    assert abs(solved.scale_arcsec - truth.scale_arcsec) / truth.scale_arcsec < 0.05


def test_demo_labels_belt_stars(db):
    conn, _summary = db
    demo = run_orion_demo(conn)
    assert demo["center_error_deg"] < 0.08
    by_name = {row["name"]: row for row in demo["identifications"] if row["name"]}
    with conn.cursor() as cur:
        cur.execute("select name, ra_deg, dec_deg from stars where name = any(%s)", (list(BELT),))
        catalog = {name: (ra, dec) for name, ra, dec in cur.fetchall()}
    for name in BELT:
        ra, dec = catalog[name]
        truth_x, truth_y = sky_to_pixel(ra, dec, ORION_TRUTH)
        row = by_name[name]
        assert math.hypot(row["pixel_x"] - truth_x, row["pixel_y"] - truth_y) < 2.5
        assert row["separation_arcsec"] < 3 * ORION_TRUTH.scale_arcsec
        assert row["object_type"] == "star"
    assert demo["labeled"].exists()
    with conn.cursor() as cur:
        cur.execute("select solve_status from captures where id = %s", (demo["capture_id"],))
        assert cur.fetchone()[0] == "solved"


def test_unlocker_stand_in_lands_in_landing(db):
    conn, _summary = db
    seen = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode())
            seen["zone"] = payload.get("zone")
            seen["auth"] = self.headers.get("Authorization")
            seen["url"] = payload.get("url")
            raw = b"<html>nightsky unlocker proof</html>"
            self.send_response(200)
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def log_message(self, fmt, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    host, port = server.server_address
    import threading
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        body = prove_unlock(
            conn,
            "https://example.com/sky",
            token="test-token",
            zone=ZONE,
            api_url=f"http://{host}:{port}/request",
        )
    finally:
        server.shutdown()
    assert seen["zone"] == "mcp_unlocker"
    assert seen["auth"] == "Bearer test-token"
    assert "nightsky unlocker proof" in body
    with conn.cursor() as cur:
        cur.execute(
            """
            select body->>'zone', status
            from landing
            where source = 'brightdata:mcp_unlocker'
            order by id desc
            limit 1
            """
        )
        zone, status = cur.fetchone()
    assert zone == "mcp_unlocker"
    assert status == "ok"


def test_prepaid_dollars_convert_to_unlocker_credits(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_PREPAID_USD", "300")
    monkeypatch.setenv("BRIGHTDATA_USD_PER_1000_CREDITS", "1.50")
    assert prepaid_credits() == 200_000


def test_allowance_keeps_prepaid_balance_until_it_is_spent(monkeypatch):
    monkeypatch.setenv("BRIGHTDATA_FREE_MONTHLY_CREDITS", "5000")
    monkeypatch.setenv("BRIGHTDATA_PREPAID_USD", "300")
    monkeypatch.setenv("BRIGHTDATA_USD_PER_1000_CREDITS", "1.50")
    fresh = credit_allowance({}, "2026-10")
    assert fresh["cap"] == 205_000
    assert fresh["remaining_prepaid"] == 200_000
    after_free_tier = credit_allowance({"2026-10": 5000}, "2026-10")
    assert after_free_tier["remaining_prepaid"] == 200_000
    assert after_free_tier["used"] < after_free_tier["cap"]
    later = credit_allowance({"2026-09": 205_000}, "2026-10")
    assert later["remaining_prepaid"] == 0
    assert later["cap"] == 5000


def test_monthly_cap_stops_live_requests(db, monkeypatch):
    conn, _summary = db
    monkeypatch.setenv("BRIGHTDATA_FREE_MONTHLY_CREDITS", "1")
    monkeypatch.setenv("BRIGHTDATA_PREPAID_USD", "0")
    insert_landing(
        conn,
        source="brightdata:mcp_unlocker",
        checksum=None,
        body={"url": "https://example.com", "live": True, "credits": 1},
        status="ok",
    )
    conn.commit()
    with pytest.raises(RuntimeError, match="cap of 1 credits"):
        ensure_monthly_cap(conn)


def test_session_stats_answers(monkeypatch):
    monkeypatch.delenv("BRIGHTDATA_API_TOKEN", raising=False)
    report = call_session_stats()
    text = json.dumps(report["session_stats"])
    assert "session" in text.lower()
    assert report["local_only"] is True


def test_mcp_config_keeps_the_token_out_of_the_file(tmp_path):
    path = tmp_path / "mcp.json"
    path.write_text(json.dumps({"mcpServers": {"other": {"command": "echo"}}}))
    write_config(path)
    saved = json.loads(path.read_text())
    assert saved["mcpServers"]["other"]["command"] == "echo"
    assert saved["mcpServers"]["brightdata"] == SERVER
    text = path.read_text()
    assert "API_TOKEN" in text
    assert "${env:BRIGHTDATA_API_TOKEN}" in text
    assert "mcp_unlocker" in text
    assert "sk-" not in text
    assert "Bearer" not in text


def test_exif_time_and_gps_are_read(tmp_path):
    path = tmp_path / "camera.jpg"
    image = Image.new("RGB", (8, 8))
    exif = Image.Exif()
    exif[36867] = "2026:10:24 06:00:00"
    gps = exif.get_ifd(0x8825)
    gps[1] = "N"
    gps[2] = (31.0, 57.0, 0.0)
    gps[3] = "W"
    gps[4] = (110.0, 48.0, 0.0)
    image.save(path, exif=exif)
    found = read_exif(path)
    assert found["taken_at"] == datetime(2026, 10, 24, 6, 0, tzinfo=timezone.utc)
    assert found["latitude"] == pytest.approx(31.95)
    assert found["longitude"] == pytest.approx(-110.8)


def test_multipart_keeps_the_photo_bytes():
    boundary = "nightskyboundary"
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="photo"; filename="orion.png"\r\n'
        "Content-Type: image/png\r\n\r\n"
    ).encode() + b"\x89PNG-bytes" + f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"latitude\"\r\n\r\n31.95\r\n--{boundary}--\r\n".encode()
    fields = parse_multipart(body, f"multipart/form-data; boundary={boundary}")
    assert fields["photo"]["filename"] == "orion.png"
    assert fields["photo"]["data"] == b"\x89PNG-bytes"
    assert fields["latitude"]["text"] == "31.95"


def test_camera_center_is_the_center_pixel_and_east_is_right():
    from nightsky.horizon import Aim, project_altaz

    aim = Aim(azimuth_deg=0, altitude_deg=40, roll_deg=0, fov_deg=60, width=601, height=801)
    center = project_altaz(40, 0, aim)
    assert center is not None
    assert abs(center[0] - 300) < 0.01
    assert abs(center[1] - 400) < 0.01
    higher = project_altaz(50, 0, aim)
    east = project_altaz(40, 10, aim)
    assert higher is not None and higher[1] < center[1]
    assert east is not None and east[0] > center[0]
    assert project_altaz(40, 180, aim) is None


def test_declination_matches_a_wmm2025_sample():
    from nightsky.magnetic import declination_deg

    when = datetime(2025, 7, 1, tzinfo=timezone.utc)
    assert abs(declination_deg(43, 93, when, altitude_km=65) - 0.50) < 0.05
    bay = declination_deg(37.77, -122.42, datetime(2026, 10, 25, tzinfo=timezone.utc))
    assert 12 < bay < 14


def test_polaris_altitude_matches_latitude_and_centers_the_lens(db):
    from nightsky.horizon import Aim, project_altaz
    from nightsky.skyview import sky_chart

    conn, _summary = db
    when = datetime(2026, 10, 25, 5, 0, tzinfo=timezone.utc)
    chart = sky_chart(conn, 37.77, -122.42, when)
    polaris = chart["polaris"]
    assert polaris["name"] == "Polaris"
    assert abs(polaris["alt_deg"] - 37.77) < 1.2
    assert min(polaris["az_deg"], 360 - polaris["az_deg"]) < 3
    aim = Aim(polaris["az_deg"], polaris["alt_deg"], 0, 60, 800, 1000)
    pixel = project_altaz(polaris["alt_deg"], polaris["az_deg"], aim)
    assert pixel is not None
    assert abs(pixel[0] - 399.5) < 1
    assert abs(pixel[1] - 499.5) < 1
    assert any(row["name"] == "Moon" for row in chart["objects"])


def test_an_aim_labels_a_blank_photo_without_inventing_a_solve(db, tmp_path):
    from nightsky.skyview import sky_chart

    conn, _summary = db
    when = datetime(2026, 10, 25, 5, 0, tzinfo=timezone.utc)
    chart = sky_chart(conn, 37.77, -122.42, when)
    polaris = chart["polaris"]
    photo = tmp_path / "haze.png"
    save_gray_png(np.full((220, 180), 40, dtype=np.float32), photo)
    result = identify_photo(
        conn,
        photo,
        taken_at=when,
        latitude=37.77,
        longitude=-122.42,
        azimuth_deg=polaris["az_deg"],
        altitude_deg=polaris["alt_deg"],
        roll_deg=0,
        fov_deg=60,
    )
    assert result["ok"] is True
    assert result["grade"] == "predicted"
    names = {row["name"] for row in result["identifications"]}
    assert "Polaris" in names
    assert result["solve"]["center_dec_deg"] > 80


def test_viewer_page_and_file_guard():
    server = ThreadingHTTPServer(("127.0.0.1", 0), ViewerHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    try:
        with urlopen(f"http://{host}:{port}/") as response:
            page = response.read().decode()
        assert "Night sky" in page
        assert "Sky map" in page
        assert "Turn with the phone" in page
        assert "Show the sky behind the names" in page
        assert "Upload a photo" not in page
        assert "north of the equator" in page
        assert "east of Greenwich" in page
        assert 'step="1"' not in page
        assert "Elevation" not in page
        assert "Exposure" not in page
        client = HTTPConnection(host, port, timeout=5)
        client.request("GET", "/files/../.env")
        blocked = client.getresponse()
        blocked.read()
        assert blocked.status == 404
    finally:
        server.shutdown()


def test_uploaded_orion_photo_names_the_belt(db, tmp_path):
    conn, _summary = db
    photo = tmp_path / "orion.png"
    save_gray_png(render_starfield(stars_for_render(conn), ORION_TRUTH), photo)
    result = identify_photo(
        conn,
        photo,
        taken_at=DEMO_WHEN,
        latitude=31.95,
        longitude=-110.8,
        elevation_m=700,
        exposure_seconds=5,
    )
    assert result["ok"] is True
    names = {row["name"] for row in result["identifications"]}
    assert {"Mintaka", "Alnilam", "Alnitak"} <= names


def test_blank_upload_shows_the_failure(db, tmp_path):
    conn, _summary = db
    photo = tmp_path / "blank.png"
    save_gray_png(np.zeros((80, 80), dtype=np.float32), photo)
    result = identify_photo(conn, photo)
    assert result["ok"] is False
    assert "named" in result["error"]
    assert (OUTPUT / result["labeled_key"]).exists()


def test_display_darkens_a_bright_sky_and_keeps_the_star():
    sky = np.linspace(30, 140, 240, dtype=np.float32)[:, None] * np.ones((240, 240), dtype=np.float32)
    sky[80:83, 120:123] = 230
    shown = display_gray(sky)
    assert shown[10, 10] < 20
    assert shown[81, 121] > 180


def test_display_name_uses_hipparcos_when_there_is_no_proper_name():
    assert display_name("star", "26727", "Alnitak") == "Alnitak"
    assert display_name("star", "21029", None) == "HIP 21029"
    assert display_name("planet", "venus", None) is None


def test_horizon_lights_do_not_replace_the_belt(db, tmp_path):
    conn, _summary = db
    pixels = render_starfield(stars_for_render(conn), ORION_TRUTH).copy()
    height, width = pixels.shape
    pixels += np.linspace(0, 70, height, dtype=np.float32)[:, None]
    pixels[height - 70 :, 80:220] = 255
    pixels[height - 50 : height - 10, 480:640] = 255
    photo = tmp_path / "glow.png"
    save_gray_png(np.clip(pixels, 0, 255), photo)
    assert len(detect_stars(np.clip(pixels, 0, 255))) >= 4
    result = identify_photo(
        conn,
        photo,
        taken_at=DEMO_WHEN,
        latitude=31.95,
        longitude=-110.8,
        elevation_m=700,
        exposure_seconds=5,
    )
    assert result["ok"] is True
    named = {row["name"] for row in result["identifications"] if (row["confidence"] or 0) >= 0.9}
    assert {"Mintaka", "Alnilam", "Alnitak"} <= named
    assert any(name.startswith("HIP ") for name in named)


def test_real_night_photo_names_the_bright_stars():
    photo = OUTPUT / "uploads" / "4429c390f68e4670b5cb06084fe96b84.png"
    if not photo.exists():
        pytest.skip("local night photo")
    from nightsky.db import connect
    from nightsky.localenv import load_local_env

    load_local_env()
    with connect() as conn:
        result = identify_photo(conn, photo)
    assert result["ok"] is True, result.get("error")
    matched = {
        row["name"]: row["separation_arcsec"]
        for row in result["identifications"]
        if (row["confidence"] or 0) >= 0.9
    }
    for name in ("Betelgeuse", "Bellatrix", "Mintaka", "Alnilam", "Alnitak", "Rigel", "Saiph", "Sirius", "Aldebaran"):
        assert name in matched, name
        assert matched[name] < 1600
    hip = [name for name in matched if name.startswith("HIP ")]
    assert len(hip) >= 5
