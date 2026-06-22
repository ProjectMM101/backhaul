"""
fetch_worldbank_teu.py

Pulls global container port traffic (TEU) from the World Bank's free,
no-key-required API and updates ../data/teu_throughput.json.

API docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
Indicator: IS.SHP.GOOD.TU (Container port traffic, TEU)
Country code 'WLD' = world aggregate. Swap for an ISO3 code (e.g. 'CHN',
'USA', 'IND') to pull a single country instead.

Written against the documented World Bank API response shape. Not executed
live during the build of this kit (no network access in that sandbox) —
test it yourself before trusting it in the scheduled workflow:
    python scripts/fetch_worldbank_teu.py
"""
import datetime
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

API_URL = (
    "https://api.worldbank.org/v2/country/WLD/indicator/IS.SHP.GOOD.TU"
    "?format=json&per_page=20&mrnev=5"
)
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "teu_throughput.json"


def fetch_world_bank_data():
    req = urllib.request.Request(API_URL, headers={"User-Agent": "backhaul-dashboard/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.load(resp)
    # World Bank wraps results as [metadata, records]
    if not isinstance(payload, list) or len(payload) < 2 or payload[1] is None:
        raise ValueError(f"Unexpected response shape: {payload}")
    return payload[1]


def build_dataset(records):
    valid = [r for r in records if r.get("value") is not None]
    valid.sort(key=lambda r: r["date"], reverse=True)
    if not valid:
        raise ValueError("No non-null TEU records returned — check indicator code / date range")

    latest = valid[0]
    prior = valid[1] if len(valid) > 1 else None

    teu_millions = round(latest["value"] / 1_000_000, 1)
    yoy = None
    if prior and prior.get("value"):
        yoy = round((latest["value"] - prior["value"]) / prior["value"] * 100, 1)

    return {
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": f"World Bank API, indicator IS.SHP.GOOD.TU, latest year {latest['date']}",
        "global_teu_millions": teu_millions,
        "global_yoy_growth_pct": yoy,
        "note": "Auto-fetched by scripts/fetch_worldbank_teu.py. For a per-country panel, swap WLD in API_URL for an ISO3 code, or loop over several.",
    }


def main():
    try:
        records = fetch_world_bank_data()
        dataset = build_dataset(records)
    except (urllib.error.URLError, ValueError, KeyError) as e:
        print(f"Fetch failed, leaving existing data/teu_throughput.json untouched: {e}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_PATH.write_text(json.dumps(dataset, indent=2))
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
