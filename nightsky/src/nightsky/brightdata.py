"""Bright Data Web Unlocker client.

The zone name mcp_unlocker matches the MCP server default. A successful
Unlocker request spends one credit. Each UTC month includes
BRIGHTDATA_FREE_MONTHLY_CREDITS free-trial credits (default 5,000), which
do not roll over. BRIGHTDATA_PREPAID_USD is extra balance that remains until
spent. At BRIGHTDATA_USD_PER_1000_CREDITS (default $1.50), $300 buys 200,000
credits.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN

import psycopg

from nightsky.db import insert_landing

API_URL = "https://api.brightdata.com/request"
ZONE = "mcp_unlocker"
DEFAULT_FREE_MONTHLY_CREDITS = 5000
DEFAULT_USD_PER_1000_CREDITS = Decimal("1.50")
UNLOCKER_CREDITS_PER_REQUEST = 1


def unlock_url(url: str, token: str, zone: str = ZONE, api_url: str = API_URL, timeout: float = 90) -> str:
    if not token:
        raise RuntimeError("Bright Data API token is empty")
    payload = json.dumps({"zone": zone, "url": url, "format": "raw"}).encode()
    request = urllib.request.Request(
        api_url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "nightsky/0.1",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Bright Data unlock failed ({exc.code}): {detail}") from exc


def prove_unlock(conn: psycopg.Connection, url: str, token: str, zone: str = ZONE, api_url: str = API_URL) -> str:
    """Fetch one public page and keep the body in landing, not in the catalog."""
    live = _is_live_api(api_url)
    if live:
        ensure_monthly_cap(conn)
    try:
        body = unlock_url(url, token=token, zone=zone, api_url=api_url)
    except Exception as exc:
        insert_landing(
            conn,
            source=f"brightdata:{zone}",
            checksum=None,
            body={"url": url, "zone": zone, "live": live},
            status="error",
            error=str(exc),
        )
        conn.commit()
        raise
    insert_landing(
        conn,
        source=f"brightdata:{zone}",
        checksum=None,
        body={
            "url": url,
            "zone": zone,
            "format": "raw",
            "live": live,
            "credits": UNLOCKER_CREDITS_PER_REQUEST if live else 0,
            "body": body[:200_000],
        },
        status="ok",
    )
    conn.commit()
    return body


def free_monthly_credits() -> int:
    return _nonnegative_int("BRIGHTDATA_FREE_MONTHLY_CREDITS", DEFAULT_FREE_MONTHLY_CREDITS)


def prepaid_credits() -> int:
    """Credits purchased by BRIGHTDATA_PREPAID_USD. These do not renew."""
    raw = os.environ.get("BRIGHTDATA_PREPAID_USD", "0").strip() or "0"
    rate_raw = os.environ.get("BRIGHTDATA_USD_PER_1000_CREDITS", str(DEFAULT_USD_PER_1000_CREDITS)).strip()
    try:
        usd = Decimal(raw)
        rate = Decimal(rate_raw)
    except Exception as exc:
        raise RuntimeError("BRIGHTDATA_PREPAID_USD and BRIGHTDATA_USD_PER_1000_CREDITS must be numbers") from exc
    if usd < 0 or rate <= 0:
        raise RuntimeError("prepaid balance must be zero or more, and the credit price must be positive")
    return int((usd / rate * Decimal(1000)).to_integral_value(ROUND_DOWN))


def credit_allowance(used_by_month: dict[str, int], current_month: str) -> dict[str, int]:
    """Return this month's cap: renewing free credits plus unspent prepaid credits."""
    free = free_monthly_credits()
    prepaid = prepaid_credits()
    previous_paid = sum(
        max(0, credits - free)
        for month, credits in used_by_month.items()
        if month != current_month
    )
    remaining_prepaid = max(0, prepaid - previous_paid)
    used = used_by_month.get(current_month, 0)
    return {
        "free_monthly": free,
        "prepaid": prepaid,
        "remaining_prepaid": remaining_prepaid,
        "used": used,
        "cap": free + remaining_prepaid,
    }


def credits_used_by_month(conn: psycopg.Connection) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select to_char(fetched_at at time zone 'utc', 'YYYY-MM') as month,
                   coalesce(sum(coalesce((body->>'credits')::int, 1)), 0)::int
            from landing
            where source like 'brightdata:%'
              and status = 'ok'
              and body->>'live' = 'true'
            group by 1
            """
        )
        return {month: int(credits) for month, credits in cur.fetchall()}


def credits_used_this_month(conn: psycopg.Connection) -> int:
    """Successful live Unlocker calls this UTC month, one credit each."""
    current = datetime.now(timezone.utc).strftime("%Y-%m")
    return credits_used_by_month(conn).get(current, 0)


def ensure_monthly_cap(conn: psycopg.Connection) -> None:
    current = datetime.now(timezone.utc).strftime("%Y-%m")
    budget = credit_allowance(credits_used_by_month(conn), current)
    if budget["used"] >= budget["cap"]:
        raise RuntimeError(
            f"Bright Data cap of {budget['cap']} credits is reached "
            f"({budget['used']} used this month, {budget['free_monthly']} free per month, "
            f"{budget['remaining_prepaid']} prepaid credits left of {budget['prepaid']})."
        )


def describe_credit_budget(conn: psycopg.Connection) -> str:
    current = datetime.now(timezone.utc).strftime("%Y-%m")
    budget = credit_allowance(credits_used_by_month(conn), current)
    return (
        f"credits this month: {budget['used']}/{budget['cap']} "
        f"({budget['free_monthly']} free renew monthly, "
        f"{budget['remaining_prepaid']} of {budget['prepaid']} prepaid credits left)"
    )


def _nonnegative_int(name: str, default: int) -> int:
    raw = os.environ.get(name, str(default)).strip() or str(default)
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a whole number") from exc
    if value < 0:
        raise RuntimeError(f"{name} cannot be negative")
    return value


def live_token() -> str:
    return os.environ.get("BRIGHTDATA_API_TOKEN", "").strip()


def spend_cap_is_set() -> bool:
    flagged = os.environ.get("BRIGHTDATA_SPEND_CAP_SET", "").strip() in {"1", "true", "yes"}
    named = any(
        key in os.environ
        for key in (
            "BRIGHTDATA_MONTHLY_CREDIT_CAP",
            "BRIGHTDATA_MONTHLY_REQUEST_CAP",
            "BRIGHTDATA_FREE_MONTHLY_CREDITS",
            "BRIGHTDATA_PREPAID_USD",
        )
    )
    return flagged or named


def _is_live_api(api_url: str) -> bool:
    return api_url.startswith("https://api.brightdata.com")
