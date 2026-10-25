"""Local page for the Orion solve and one uploaded photo."""

from __future__ import annotations

import json
import tempfile
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from nightsky.backdrop import panorama_jpeg, survey_jpeg
from nightsky.db import connect
from nightsky.horizon import Aim
from nightsky.paths import OUTPUT
from nightsky.photos import catalog_counts, demo_view, identify_photo, read_exif
from nightsky.skyview import sky_chart

HOST = "0.0.0.0"
PORT = 8741
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
PAGE = Path(__file__).with_name("viewer.html")


def serve(host: str = HOST, port: int = PORT) -> None:
    threading.Thread(target=_warm_panorama, daemon=True).start()
    server = ThreadingHTTPServer((host, port), ViewerHandler)
    print(f"Night sky viewer at http://127.0.0.1:{port}")
    server.serve_forever()


def _warm_panorama() -> None:
    try:
        panorama_jpeg()
    except Exception:
        return


class ViewerHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/":
            self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            return
        if path == "/api/demo":
            self._send_json(self._demo())
            return
        if path == "/api/backdrop":
            self._backdrop()
            return
        if path == "/api/panorama":
            self._panorama()
            return
        if path.startswith("/files/"):
            self._send_file(unquote(path[len("/files/") :]))
            return
        self._send(404, b"Not found", "text/plain; charset=utf-8")

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/sky":
            self._sky()
            return
        if path not in {"/api/uploads", "/api/hints"}:
            self._send(404, b"Not found", "text/plain; charset=utf-8")
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            self._send_json({"ok": False, "error": "Choose a photo under 15 MB."}, status=400)
            return
        body = self.rfile.read(length)
        try:
            fields = parse_multipart(body, self.headers.get("Content-Type", ""))
        except ValueError as exc:
            self._send_json({"ok": False, "error": str(exc)}, status=400)
            return
        if path == "/api/hints":
            self._hints(fields.get("photo"))
            return
        upload = fields.get("photo")
        if not upload or not upload.get("filename") or not upload.get("data"):
            self._send_json({"ok": False, "error": "Choose a JPEG or PNG first."}, status=400)
            return
        suffix = Path(upload["filename"]).suffix.lower() or ".jpg"
        if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}:
            self._send_json({"ok": False, "error": "Use a JPEG, PNG, WebP, or TIFF."}, status=400)
            return
        try:
            taken_at = _optional_time(fields.get("taken_at", {}).get("text", ""))
            latitude = _optional_float(fields.get("latitude", {}).get("text", ""))
            longitude = _optional_float(fields.get("longitude", {}).get("text", ""))
            azimuth = _optional_float(fields.get("azimuth", {}).get("text", ""))
            altitude = _optional_float(fields.get("altitude", {}).get("text", ""))
            roll = _optional_float(fields.get("roll", {}).get("text", ""))
            fov = _optional_float(fields.get("fov", {}).get("text", ""))
        except ValueError as exc:
            self._send_json({"ok": False, "error": str(exc)}, status=400)
            return
        with tempfile.NamedTemporaryFile(suffix=suffix) as handle:
            handle.write(upload["data"])
            handle.flush()
            with connect() as conn:
                result = identify_photo(
                    conn,
                    Path(handle.name),
                    taken_at=taken_at,
                    latitude=latitude,
                    longitude=longitude,
                    azimuth_deg=azimuth,
                    altitude_deg=altitude,
                    roll_deg=roll,
                    fov_deg=fov,
                )
        self._send_json(_public(result))

    def _backdrop(self) -> None:
        query = parse_qs(urlparse(self.path).query)
        try:
            latitude = float(_query_one(query, "latitude"))
            longitude = float(_query_one(query, "longitude"))
            azimuth = float(_query_one(query, "azimuth"))
            altitude = float(_query_one(query, "altitude"))
            roll = float(_query_one(query, "roll") or 0)
            fov = float(_query_one(query, "fov") or 68)
            width = int(float(_query_one(query, "width") or 800))
            height = int(float(_query_one(query, "height") or 1000))
            taken_at = _optional_time(_query_one(query, "taken_at") or "") or datetime.now(timezone.utc)
        except (TypeError, ValueError) as exc:
            self._send_json({"ok": False, "error": "The sky photograph needs a place, a time, and an aim."}, status=400)
            return
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            self._send_json({"ok": False, "error": "Latitude runs from −90 to 90 and longitude from −180 to 180."}, status=400)
            return
        width = max(64, min(900, width))
        height = max(64, min(900, height))
        if not 5 <= fov <= 120 or not -90 <= altitude <= 90:
            self._send_json({"ok": False, "error": "The aim is outside the sky the photograph can show."}, status=400)
            return
        try:
            jpeg = survey_jpeg(
                latitude,
                longitude,
                taken_at,
                Aim(azimuth % 360.0, altitude, roll, fov, width, height),
            )
        except Exception:
            self._send(502, b"The telescope photograph is unavailable.", "text/plain; charset=utf-8")
            return
        self._send(200, jpeg, "image/jpeg")

    def _panorama(self) -> None:
        try:
            jpeg = panorama_jpeg()
        except Exception:
            self._send(502, b"The telescope photograph is unavailable.", "text/plain; charset=utf-8")
            return
        self._send(200, jpeg, "image/jpeg")

    def _sky(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length > 100_000:
            self._send_json({"ok": False, "error": "The sky request was too large."}, status=400)
            return
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._send_json({"ok": False, "error": "The sky request was not valid JSON."}, status=400)
            return
        if not isinstance(payload, dict):
            self._send_json({"ok": False, "error": "The sky request was not valid JSON."}, status=400)
            return
        try:
            latitude = float(payload["latitude"])
            longitude = float(payload["longitude"])
        except (KeyError, TypeError, ValueError):
            self._send_json({"ok": False, "error": "The sky map needs a latitude and a longitude."}, status=400)
            return
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            self._send_json(
                {"ok": False, "error": "Latitude runs from −90 to 90 and longitude from −180 to 180."},
                status=400,
            )
            return
        try:
            taken_at = _optional_time(str(payload.get("taken_at") or ""))
        except ValueError as exc:
            self._send_json({"ok": False, "error": str(exc)}, status=400)
            return
        if taken_at is None:
            taken_at = datetime.now(timezone.utc)
        with connect() as conn:
            chart = sky_chart(conn, latitude, longitude, taken_at)
        self._send_json(chart)

    def _hints(self, upload: dict | None) -> None:
        if not upload or not upload.get("data"):
            self._send_json({"taken_at": None, "latitude": None, "longitude": None})
            return
        suffix = Path((upload.get("filename") or "photo.jpg")).suffix.lower() or ".jpg"
        with tempfile.NamedTemporaryFile(suffix=suffix) as handle:
            handle.write(upload["data"])
            handle.flush()
            found = read_exif(Path(handle.name))
        taken = found["taken_at"]
        self._send_json(
            {
                "taken_at": taken.strftime("%Y-%m-%dT%H:%M") if taken else None,
                "latitude": found["latitude"],
                "longitude": found["longitude"],
                "time_assumed_utc": found["time_assumed_utc"],
            }
        )

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} {fmt % args}")

    def _demo(self) -> dict:
        with connect() as conn:
            counts = catalog_counts(conn)
            demo = demo_view(conn)
        if demo is None:
            return {
                "ok": False,
                "error": "The Orion demo has not been solved yet. Run python -m nightsky solve-demo.",
                "catalog": counts,
            }
        payload = _public(demo)
        payload["catalog"] = counts
        return payload

    def _send_file(self, name: str) -> None:
        path = (OUTPUT / name).resolve()
        root = OUTPUT.resolve()
        if not path.is_relative_to(root) or path.suffix.lower() != ".png" or not path.is_file():
            self._send(404, b"Not found", "text/plain; charset=utf-8")
            return
        self._send(200, path.read_bytes(), "image/png")

    def _send_json(self, payload: dict, status: int = 200) -> None:
        raw = json.dumps(payload, default=_json_default).encode()
        self._send(status, raw, "application/json")

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def parse_multipart(body: bytes, content_type: str) -> dict[str, dict]:
    marker = "boundary="
    if marker not in content_type:
        raise ValueError("Upload was not a form.")
    boundary = content_type.split(marker, 1)[1].split(";", 1)[0].strip().strip('"')
    if not boundary:
        raise ValueError("Upload was not a form.")
    parts = body.split(f"--{boundary}".encode())
    fields: dict[str, dict] = {}
    for part in parts:
        if not part or part in {b"--", b"--\r\n"} or part.startswith(b"--"):
            continue
        chunk = part[2:] if part.startswith(b"\r\n") else part
        if chunk.endswith(b"\r\n"):
            chunk = chunk[:-2]
        header_blob, separator, data = chunk.partition(b"\r\n\r\n")
        if not separator:
            continue
        headers = header_blob.decode("utf-8", errors="replace")
        name = _disposition(headers, "name")
        if not name:
            continue
        fields[name] = {
            "filename": _disposition(headers, "filename"),
            "data": data,
            "text": data.decode("utf-8", errors="replace").strip(),
        }
    return fields


def _disposition(headers: str, key: str) -> str | None:
    token = f'{key}="'
    for line in headers.split("\r\n"):
        if token in line:
            return line.split(token, 1)[1].split('"', 1)[0]
    return None


def _query_one(query: dict, name: str) -> str:
    values = query.get(name) or []
    return values[0].strip() if values else ""


def _optional_float(raw: str) -> float | None:
    text = raw.strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError as exc:
        raise ValueError(f"Could not read the number {raw!r}.") from exc


def _optional_time(raw: str) -> datetime | None:
    text = raw.strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValueError("Use a time like 2026-10-24T06:00.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _public(result: dict) -> dict:
    payload = dict(result)
    image_key = payload.pop("image_key", "")
    labeled_key = payload.pop("labeled_key", "")
    payload["image_url"] = f"/files/{image_key}" if image_key else ""
    payload["labeled_url"] = f"/files/{labeled_key}" if labeled_key else ""
    return payload


def _json_default(value):
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    raise TypeError(type(value))
