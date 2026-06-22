#!/usr/bin/env python3
"""
Fetch current Freightos Baltic Index (FBX) freight rates
and update data/freight_rates.json

Source: Far Point Global (FBX data from Baltic Exchange / Freightos)
Runs hourly via GitHub Actions.
"""

import json
import re
import os
import sys
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

SOURCE_URL = "https://farpointglobal.com/tools/freight-index"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "freight_rates.json")

# Static metadata per FBX lane — rates get updated, these don't change
ROUTE_META = {
    "FBX01": {
        "label": "China/East Asia → US West Coast",
        "from": "China / East Asia",
        "to": "US West Coast",
        "transit_days_est": 16,
        "origin_thc_usd": 220,
        "dest_thc_usd": 250,
        "documentation_usd": 75,
        "other_fees_usd": 150,
    },
    "FBX02": {
        "label": "US West Coast → China/East Asia",
        "from": "US West Coast",
        "to": "China / East Asia",
        "transit_days_est": 16,
        "origin_thc_usd": 250,
        "dest_thc_usd": 220,
        "documentation_usd": 75,
        "other_fees_usd": 100,
    },
    "FBX03": {
        "label": "China/East Asia → US East Coast",
        "from": "China / East Asia",
        "to": "US East Coast",
        "transit_days_est": 28,
        "origin_thc_usd": 220,
        "dest_thc_usd": 300,
        "documentation_usd": 75,
        "other_fees_usd": 150,
    },
    "FBX04": {
        "label": "US East Coast → China/East Asia",
        "from": "US East Coast",
        "to": "China / East Asia",
        "transit_days_est": 28,
        "origin_thc_usd": 300,
        "dest_thc_usd": 220,
        "documentation_usd": 75,
        "other_fees_usd": 100,
    },
    "FBX11": {
        "label": "China/East Asia → North Europe",
        "from": "China / East Asia",
        "to": "North Europe",
        "transit_days_est": 30,
        "origin_thc_usd": 220,
        "dest_thc_usd": 200,
        "documentation_usd": 75,
        "other_fees_usd": 120,
    },
    "FBX12": {
        "label": "North Europe → China/East Asia",
        "from": "North Europe",
        "to": "China / East Asia",
        "transit_days_est": 30,
        "origin_thc_usd": 200,
        "dest_thc_usd": 220,
        "documentation_usd": 75,
        "other_fees_usd": 100,
    },
    "FBX13": {
        "label": "China/East Asia → Mediterranean",
        "from": "China / East Asia",
        "to": "Mediterranean",
        "transit_days_est": 26,
        "origin_thc_usd": 220,
        "dest_thc_usd": 180,
        "documentation_usd": 75,
        "other_fees_usd": 120,
    },
    "FBX14": {
        "label": "Mediterranean → China/East Asia",
        "from": "Mediterranean",
        "to": "China / East Asia",
        "transit_days_est": 26,
        "origin_thc_usd": 180,
        "dest_thc_usd": 220,
        "documentation_usd": 75,
        "other_fees_usd": 100,
    },
    "FBX21": {
        "label": "US East Coast → North Europe",
        "from": "US East Coast",
        "to": "North Europe",
        "transit_days_est": 12,
        "origin_thc_usd": 300,
        "dest_thc_usd": 200,
        "documentation_usd": 75,
        "other_fees_usd": 100,
    },
    "FBX22": {
        "label": "North Europe → US East Coast",
        "from": "North Europe",
        "to": "US East Coast",
        "transit_days_est": 12,
        "origin_thc_usd": 200,
        "dest_thc_usd": 300,
        "documentation_usd": 75,
        "other_fees_usd": 100,
    },
    "FBX24": {
        "label": "Europe → South America East Coast",
        "from": "Europe",
        "to": "South America East Coast",
        "transit_days_est": 14,
        "origin_thc_usd": 200,
        "dest_thc_usd": 160,
        "documentation_usd": 75,
        "other_fees_usd": 100,
    },
    "FBX26": {
        "label": "Europe → South America West Coast",
        "from": "Europe",
        "to": "South America West Coast",
        "transit_days_est": 22,
        "origin_thc_usd": 200,
        "dest_thc_usd": 140,
        "documentation_usd": 75,
        "other_fees_usd": 100,
    },
}

# Fallback rates (last manually verified 2026-06-22) — used if fetch fails
FALLBACK_RATES = {
    "FBX01": 2418, "FBX02": 300,  "FBX03": 3859, "FBX04": 423,
    "FBX11": 2779, "FBX12": 454,  "FBX13": 4179, "FBX14": 530,
    "FBX21": 446,  "FBX22": 1416, "FBX24": 785,  "FBX26": 2311,
}


def fetch_html(url: str) -> str | None:
    """Fetch a URL and return HTML as a string, or None on failure."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; backhaul-bot/1.0; "
            "+https://github.com/ProjectMM101/backhaul)"
        )
    }
    try:
        req = Request(url, headers=headers)
        with urlopen(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (URLError, HTTPError) as e:
        print(f"[fetch_fbx] HTTP error: {e}", file=sys.stderr)
        return None


def parse_rates(html: str) -> dict[str, int]:
    """
    Extract FBX lane rates from the Far Point Global HTML.
    Looks for patterns like:  FBX01 ... $2,418
    Returns {code: rate_usd} dict.
    """
    rates: dict[str, int] = {}

    # Each lane block looks like:
    #   FBX01\nChina/East Asia - North America West Coast\n$2,418 -10%
    # We scan for an FBX code then grab the first $ amount that follows.
    fbx_pattern = re.compile(r"(FBX\d{2})")
    dollar_pattern = re.compile(r"\$([0-9,]+)")

    segments = fbx_pattern.split(html)
    # segments = [pre, "FBX01", text_after_FBX01, "FBX02", text_after_FBX02, ...]
    i = 1
    while i < len(segments) - 1:
        code = segments[i]          # e.g. "FBX01"
        rest = segments[i + 1]      # text until next FBX code
        if code in ROUTE_META:
            m = dollar_pattern.search(rest[:200])  # only look in next 200 chars
            if m:
                rate_str = m.group(1).replace(",", "")
                try:
                    rates[code] = int(rate_str)
                except ValueError:
                    pass
        i += 2

    return rates


def load_existing() -> dict:
    """Load the existing freight_rates.json if it exists."""
    try:
        with open(OUTPUT_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def build_output(rates: dict[str, int], source_label: str) -> dict:
    routes = []
    for code, meta in ROUTE_META.items():
        rate = rates.get(code)
        if rate is None:
            print(f"[fetch_fbx] Warning: no rate for {code}, skipping", file=sys.stderr)
            continue
        routes.append({
            "fbx_code": code,
            "label": meta["label"],
            "from": meta["from"],
            "to": meta["to"],
            "rate_usd_feu": rate,
            "transit_days_est": meta["transit_days_est"],
            "origin_thc_usd": meta["origin_thc_usd"],
            "dest_thc_usd": meta["dest_thc_usd"],
            "documentation_usd": meta["documentation_usd"],
            "other_fees_usd": meta["other_fees_usd"],
        })
    return {
        "source": source_label,
        "as_of": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": (
            "Rates per FEU (40ft container). "
            "20ft (TEU) estimated at 55% of FEU rate. "
            "THC and fees are estimates — get a real quote before committing."
        ),
        "routes": routes,
    }


def main():
    print("[fetch_fbx] Fetching FBX rates…")

    html = fetch_html(SOURCE_URL)
    if html:
        rates = parse_rates(html)
        found = len(rates)
        missing = [c for c in ROUTE_META if c not in rates]
        print(f"[fetch_fbx] Parsed {found}/12 rates. Missing: {missing or 'none'}")
    else:
        rates = {}
        print("[fetch_fbx] Fetch failed.", file=sys.stderr)

    # Fill any gaps from fallback
    for code, fallback in FALLBACK_RATES.items():
        if code not in rates:
            rates[code] = fallback
            print(f"[fetch_fbx] Using fallback for {code}: ${fallback}")

    used_live = len([c for c in rates if c not in (
        set(FALLBACK_RATES) - set(parse_rates(html) if html else {})
    )])
    source_label = (
        "Freightos Baltic Index (FBX) via Far Point Global"
        if html else
        "Freightos Baltic Index (FBX) — fallback values (fetch failed)"
    )

    output = build_output(rates, source_label)

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"[fetch_fbx] Wrote {len(output['routes'])} routes to {OUTPUT_FILE}")
    for r in output["routes"]:
        print(f"  {r['fbx_code']}: ${r['rate_usd_feu']:,}/FEU  ({r['label']})")


if __name__ == "__main__":
    main()
