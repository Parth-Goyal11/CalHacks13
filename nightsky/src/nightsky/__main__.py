"""Command line for the night-sky catalog and one Orion identification."""

from __future__ import annotations

import argparse
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from nightsky.brightdata import (
    ZONE,
    describe_credit_budget,
    live_token,
    prove_unlock,
    spend_cap_is_set,
)
from nightsky.db import connect
from nightsky.localenv import load_local_env
from nightsky.mcpconf import install_configs
from nightsky.mcpprobe import McpError, call_session_stats
from nightsky.pipeline import orion_belt_rows, prepare_catalog, run_orion_demo
from nightsky.planets import ensure_kernel
from nightsky.satellites import load_satellites
from nightsky.stars import load_stars


def main(argv: list[str] | None = None) -> int:
    load_local_env()
    parser = argparse.ArgumentParser(description="Load a sky catalog and identify a known Orion photo.")
    parser.add_argument(
        "command",
        choices=(
            "init-db",
            "load-stars",
            "load-satellites",
            "load-planets",
            "solve-demo",
            "prove-unlocker",
            "prove-mcp",
            "serve",
            "all",
        ),
    )
    parser.add_argument("--url", default="https://example.com", help="Page used to prove the unlocker")
    parser.add_argument("--port", type=int, default=8741, help="Port for the viewer")
    args = parser.parse_args(argv)
    if args.command == "serve":
        from nightsky.web import serve

        serve(port=args.port)
        return 0
    if args.command == "prove-mcp":
        return _prove_mcp()
    if args.command == "prove-unlocker":
        with connect() as conn:
            return _prove_unlocker(conn, args.url)
    with connect() as conn:
        if args.command == "init-db":
            from nightsky.db import init_db
            init_db(conn)
            print("schema ready")
        elif args.command == "load-stars":
            print(f"stars {load_stars(conn)}")
        elif args.command == "load-satellites":
            print(f"satellites {load_satellites(conn)}")
        elif args.command == "load-planets":
            print(f"kernel {ensure_kernel()}")
        elif args.command == "solve-demo":
            _print_demo(conn)
        elif args.command == "all":
            summary = prepare_catalog(conn)
            print(
                f"stars {summary['stars']}, satellites {summary['satellites']}, kernel {summary['kernel']}"
            )
            _print_belt(conn)
            _print_demo(conn)
            _prove_unlocker(conn, args.url)
            return _prove_mcp()
    return 0


def _print_belt(conn) -> None:
    rows = orion_belt_rows(conn)
    print("Orion belt box:")
    for catalog_id, name, mag, ra_deg, dec_deg in rows:
        label = name or ""
        print(f"  {catalog_id:>6} {label:<12} mag {mag:4.2f}  ra {ra_deg:7.3f}  dec {dec_deg:7.3f}")


def _print_demo(conn) -> None:
    demo = run_orion_demo(conn)
    solved = demo["solved"]
    print(
        f"solved center RA {solved.ra0:.4f} Dec {solved.dec0:.4f} "
        f"scale {solved.scale_arcsec:.2f}\"/px rotation {solved.rotation_deg:.2f} deg"
    )
    print(f"center error {demo['center_error_deg']:.4f} deg")
    print(f"labeled photo {demo['labeled']}")
    named = [row for row in demo["identifications"] if row["name"]]
    for row in named:
        if row["name"] in {"Mintaka", "Alnilam", "Alnitak", "Betelgeuse", "Rigel", "Bellatrix", "Saiph"}:
            print(
                f"  {row['name']:<12} pixel ({row['pixel_x']:.1f}, {row['pixel_y']:.1f}) "
                f"sep {row['separation_arcsec']:.1f}\""
            )


def _prove_unlocker(conn, url: str) -> int:
    token = live_token()
    if token and spend_cap_is_set():
        body = prove_unlock(conn, url, token=token, zone=ZONE)
        print(f"live unlocker returned {len(body)} bytes from {url}")
        print(describe_credit_budget(conn))
        return 0
    if token and not spend_cap_is_set():
        print("BRIGHTDATA_API_TOKEN is set, but BRIGHTDATA_SPEND_CAP_SET is not. Skipping the live call.")
    else:
        print("BRIGHTDATA_API_TOKEN is unset. Proving the unlocker client against a local stand-in.")
    _prove_against_stand_in(conn)
    print("unlocker client stored one mcp_unlocker response in landing")
    print("Create the real zone and token at https://brightdata.com/cp/setting/users")
    print("Name the Web Unlocker zone mcp_unlocker and set a spend cap before any scheduled job.")
    return 0


def _prove_against_stand_in(conn) -> None:
    proof = {"zone": None, "auth": None}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode())
            proof["zone"] = payload.get("zone")
            proof["auth"] = self.headers.get("Authorization")
            raw = b"<html><title>Example Domain</title><body>nightsky unlocker proof</body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def log_message(self, fmt, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        body = prove_unlock(
            conn,
            "https://example.com",
            token="test-token",
            zone=ZONE,
            api_url=f"http://{host}:{port}/request",
        )
    finally:
        server.shutdown()
    if proof["zone"] != ZONE or proof["auth"] != "Bearer test-token":
        raise RuntimeError(f"stand-in saw zone={proof['zone']!r} auth={proof['auth']!r}")
    if "nightsky unlocker proof" not in body:
        raise RuntimeError("stand-in body was not stored")


def _prove_mcp() -> int:
    paths = install_configs()
    for path in paths:
        print(f"mcp config {path}")
    try:
        report = call_session_stats()
    except McpError as exc:
        print(f"session_stats failed: {exc}", file=sys.stderr)
        return 1
    print("session_stats ok")
    print(json.dumps(report["session_stats"], indent=2)[:2000])
    if report["local_only"]:
        print("No account token was set. session_stats does not call Bright Data.")
        print("Export BRIGHTDATA_API_TOKEN before search_engine or scrape_as_markdown.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
