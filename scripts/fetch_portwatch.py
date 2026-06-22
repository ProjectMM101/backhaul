"""
fetch_portwatch.py

Queries the IMF PortWatch ArcGIS REST API (free, no API key required) for
daily container vessel call data for our tracked ports. Saves a compact
weekly summary to data/portwatch.json which feeds the Live Feed tab.

Source: https://portwatch.imf.org/pages/data-and-methodology
API:    https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/
        Daily_Ports_Data/FeatureServer/0
Fields: portname, ISO3, date, portcalls_container, import_container, export_container
Updated: Tuesdays 9 AM ET by IMF

Add to GitHub Actions workflow to run weekly or on every push.
"""
import datetime
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ARCGIS_URL = (
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services"
    "/Daily_Ports_Data/FeatureServer/0/query"
)

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "portwatch.json"

# (portname search pattern, ISO3 country code)
# Using patterns that match PortWatch's portname field (case-sensitive LIKE)
TRACKED_PORTS = [
    ("Los Angeles",       "USA"),
    ("Long Beach",        "USA"),
    ("New York",          "USA"),
    ("Savannah",          "USA"),
    ("Houston",           "USA"),
    ("Seattle",           "USA"),
    ("Tacoma",            "USA"),
    ("Rotterdam",         "NLD"),
    ("Hamburg",           "DEU"),
    ("Antwerp",           "BEL"),
    ("Felixstowe",        "GBR"),
    ("Valencia",          "ESP"),
    ("Algeciras",         "ESP"),
    ("Tanger",            "MAR"),
    ("Jebel Ali",         "ARE"),
    ("Dubai",             "ARE"),
    ("Mumbai",            "IND"),
    ("Nhava Sheva",       "IND"),
    ("Chennai",           "IND"),
    ("Mundra",            "IND"),
    ("Colombo",           "LKA"),
    ("Durban",            "ZAF"),
    ("Mombasa",           "KEN"),
    ("Shanghai",          "CHN"),
    ("Ningbo",            "CHN"),
    ("Shenzhen",          "CHN"),
    ("Yantian",           "CHN"),
    ("Guangzhou",         "CHN"),
    ("Nansha",            "CHN"),
    ("Tianjin",           "CHN"),
    ("Qingdao",           "CHN"),
    ("Xiamen",            "CHN"),
    ("Singapore",         "SGP"),
    ("Port Klang",        "MYS"),
    ("Tanjung Pelepas",   "MYS"),
    ("Busan",             "KOR"),
    ("Incheon",           "KOR"),
    ("Kaohsiung",         "TWN"),
    ("Keelung",           "TWN"),
    ("Tokyo",             "JPN"),
    ("Yokohama",          "JPN"),
    ("Osaka",             "JPN"),
    ("Chittagong",        "BGD"),
    ("Laem Chabang",      "THA"),
    ("Manila",            "PHL"),
    ("Jakarta",           "IDN"),
    ("Tanjung Priok",     "IDN"),
    ("Ho Chi Minh",       "VNM"),
    ("Haiphong",          "VNM"),
    ("Piraeus",           "GRC"),
    ("Genoa",             "ITA"),
    ("Barcelona",         "ESP"),
]


def query_api(where: str, fields: str, max_records: int = 2000) -> list:
    """Query the PortWatch ArcGIS Feature Service. Returns list of attribute dicts."""
    params = {
        "where": where,
        "outFields": fields,
        "orderByFields": "date DESC",
        "resultRecordCount": max_records,
        "f": "json",
    }
    url = ARCGIS_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "backhaul-dashboard/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    if "error" in data:
        raise ValueError(f"API error: {data['error']}")
    return [f["attributes"] for f in data.get("features", [])]


def avg(lst: list) -> float | None:
    clean = [x for x in lst if x is not None]
    return round(sum(clean) / len(clean), 1) if clean else None


def trend_label(current: float | None, prior: float | None) -> str:
    if current is None or prior is None or prior == 0:
        return "stable"
    pct = (current - prior) / prior * 100
    if pct > 15:
        return "rising"
    if pct < -15:
        return "falling"
    return "stable"


def main() -> None:
    today = datetime.date.today()
    period_start = today - datetime.timedelta(days=14)
    prior_start  = today - datetime.timedelta(days=28)

    period_str = period_start.strftime("%Y-%m-%d")
    prior_str  = prior_start.strftime("%Y-%m-%d")

    # Group ports by ISO3 country to reduce API calls
    by_country: dict[str, list[str]] = defaultdict(list)
    for portname, iso3 in TRACKED_PORTS:
        by_country[iso3].append(portname)

    results: dict[str, dict] = {}

    for iso3, portnames in by_country.items():
        like_clauses = " OR ".join(f"portname LIKE '%{p}%'" for p in portnames)
        fields = "portname,date,portcalls_container,import_container,export_container"

        # Recent 14 days
        where_recent = (
            f"ISO3='{iso3}' AND ({like_clauses}) AND date >= DATE '{period_str}'"
        )
        # Prior 14 days for trend comparison
        where_prior = (
            f"ISO3='{iso3}' AND ({like_clauses}) "
            f"AND date >= DATE '{prior_str}' AND date < DATE '{period_str}'"
        )

        try:
            print(f"  {iso3}: querying {len(portnames)} ports...", end=" ", flush=True)
            recent_rows = query_api(where_recent, fields)
            prior_rows  = query_api(where_prior, "portname,portcalls_container")
            print(f"{len(recent_rows)} recent records")

            # Group recent by portname
            recent_by_port: dict[str, list] = defaultdict(list)
            for r in recent_rows:
                if r.get("portname"):
                    recent_by_port[r["portname"]].append(r)

            prior_by_port: dict[str, list] = defaultdict(list)
            for r in prior_rows:
                if r.get("portname"):
                    prior_by_port[r["portname"]].append(r)

            for portname, recs in recent_by_port.items():
                calls   = [r.get("portcalls_container") for r in recs]
                imports = [r.get("import_container")    for r in recs]
                exports = [r.get("export_container")    for r in recs]

                avg_calls   = avg(calls)
                avg_imports = avg(imports)
                avg_exports = avg(exports)

                prior_calls = [r.get("portcalls_container") for r in prior_by_port.get(portname, [])]
                prior_avg   = avg(prior_calls)

                results[portname] = {
                    "portname":                  portname,
                    "ISO3":                      iso3,
                    "avg_container_calls_14d":   avg_calls,
                    "avg_imports_14d":           avg_imports,
                    "avg_exports_14d":           avg_exports,
                    "days_with_data":            len([x for x in calls if x is not None]),
                    "trend_vs_prior_14d":        trend_label(avg_calls, prior_avg),
                }

            time.sleep(0.4)   # polite rate limiting

        except (urllib.error.URLError, ValueError, KeyError) as e:
            print(f"  WARNING: {iso3} query failed — {e}")

    if not results:
        print("No data retrieved. Leaving existing portwatch.json untouched.", file=sys.stderr)
        sys.exit(1)

    output = {
        "updated":  datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source":   "IMF PortWatch (portwatch.imf.org) via ArcGIS REST API — free, no key required",
        "period":   f"{period_str} to {today}",
        "note":     (
            "avg_container_calls_14d = average daily container vessel calls "
            "over the last 14 days. import/export figures are in estimated TEU. "
            "Trend compares current 14-day window to the prior 14-day window. "
            "Data updated by IMF every Tuesday."
        ),
        "ports":    list(results.values()),
    }

    OUTPUT_PATH.write_text(json.dumps(output, indent=2))
    print(f"\nWrote {len(results)} ports to {OUTPUT_PATH}")


if __name__ == "__main__":
    print(f"Fetching IMF PortWatch data ({datetime.date.today()})...")
    main()
