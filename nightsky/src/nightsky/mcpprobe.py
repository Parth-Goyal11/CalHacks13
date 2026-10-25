"""Speak newline-delimited MCP to the local Bright Data server and call session_stats.

session_stats only counts tool calls inside that process. It does not spend Bright Data credit.
A scrape still needs the account token from the control panel.
"""

from __future__ import annotations

import json
import os
import select
import subprocess
import time

from nightsky.paths import OUTPUT


class McpError(RuntimeError):
    pass


def call_session_stats(timeout: float = 40) -> dict:
    token = os.environ.get("BRIGHTDATA_API_TOKEN", "").strip()
    local_only = not token
    env = os.environ.copy()
    env["API_TOKEN"] = token or "local-probe"
    env["GROUPS"] = "advanced_scraping"
    env["WEB_UNLOCKER_ZONE"] = "mcp_unlocker"
    process = subprocess.Popen(
        ["npx", "-y", "@brightdata/mcp"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    reader = _Reader(process)
    try:
        reader.send({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "nightsky", "version": "0.1.0"},
            },
        })
        init = reader.read_until(1, timeout)
        reader.send({"jsonrpc": "2.0", "method": "notifications/initialized"})
        reader.send({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": "session_stats", "arguments": {}},
        })
        stats = reader.read_until(2, timeout)
        if "error" in stats:
            raise McpError(json.dumps(stats["error"]))
        report = {
            "local_only": local_only,
            "initialize": init.get("result", init),
            "session_stats": stats.get("result", stats),
        }
        OUTPUT.mkdir(parents=True, exist_ok=True)
        (OUTPUT / "session_stats.json").write_text(json.dumps(report, indent=2) + "\n")
        return report
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=5)


class _Reader:
    def __init__(self, process: subprocess.Popen):
        self.process = process
        self.stdout = bytearray()
        self.stderr = bytearray()

    def send(self, message: dict) -> None:
        assert self.process.stdin is not None
        self.process.stdin.write((json.dumps(message) + "\n").encode())
        self.process.stdin.flush()

    def read_until(self, message_id: int, timeout: float) -> dict:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for message in self._drain():
                if message.get("id") == message_id:
                    return message
            if self.process.poll() is not None and not self.stdout:
                raise McpError(self._failure("server exited"))
            remaining = max(0.05, deadline - time.monotonic())
            streams = [item for item in (self.process.stdout, self.process.stderr) if item is not None]
            ready, _, _ = select.select(streams, [], [], min(0.3, remaining))
            if not ready:
                continue
            for stream in ready:
                chunk = os.read(stream.fileno(), 65536)
                if stream is self.process.stdout:
                    self.stdout.extend(chunk)
                else:
                    self.stderr.extend(chunk)
        raise McpError(self._failure("timed out waiting for MCP response"))

    def _drain(self) -> list[dict]:
        messages = []
        while b"\n" in self.stdout:
            line, _, rest = self.stdout.partition(b"\n")
            self.stdout = bytearray(rest)
            text = line.decode("utf-8", errors="replace").strip()
            if not text:
                continue
            try:
                messages.append(json.loads(text))
            except json.JSONDecodeError:
                self.stderr.extend(line + b"\n")
        return messages

    def _failure(self, prefix: str) -> str:
        err = self.stderr.decode("utf-8", errors="replace")[-1500:]
        code = self.process.poll()
        return f"{prefix} (code {code}): {err}"
