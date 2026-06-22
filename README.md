# Backhaul — container market watch

A small dashboard for the buy-reposition-sell container strategy: port dwell
times, global throughput, a margin board of real case-study routes, a live
margin calculator, and a freight rate snapshot.

## What's real right now vs. what needs you to wire it up

Be clear-eyed about this before you trust any number on the page:

- **`data/teu_throughput.json`** — has a working, testable fetcher
  (`scripts/fetch_worldbank_teu.py`) hitting the World Bank's free public API.
  This is the one source that should "just work" once you run it with real
  internet access.
- **`data/dwell_times.json`**, **`data/freight_rates.json`**,
  **`data/routes.json`** — seeded with real figures pulled from research, each
  with a `source` field and a date. They are **not** live feeds. There's no
  free public API for port-by-port dwell time or for one-way leasing rates —
  the platforms that have this data (Vizion TradeView, Container xChange,
  BOXXPORT) sell it as their core product. Scraping their listings would
  violate their terms of service, so this kit doesn't do that. Update these
  files by hand as you do your own research, or budget for a paid API if you
  want them live.

## Running it locally

Browsers block `fetch()` of local JSON files opened directly from disk
(`file://`), so you need a tiny local server — don't just double-click
`index.html`.

```bash
cd backhaul
python -m http.server 8000
# visit http://localhost:8000
```

## Turning this into an actual website (the part you asked about)

1. **Create a GitHub repo** and push this folder to it.
   ```bash
   cd backhaul
   git init
   git add .
   git commit -m "Initial dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. **Turn on GitHub Pages**: in the repo, go to *Settings → Pages*, set
   "Source" to the `main` branch, root folder. GitHub will give you a URL
   like `https://<your-username>.github.io/<repo-name>/` within a minute or
   two.
3. **That's it for hosting** — no server to manage, no cost. Every time you
   push a change to `main`, the live site updates automatically.
4. **The hourly refresh** is already wired up in
   `.github/workflows/update-data.yml`: it runs on its own schedule once
   the repo is on GitHub (Actions are enabled by default), refetches
   `teu_throughput.json`, and commits the change back to `main` — which
   immediately updates the live Pages site, since Pages just serves
   whatever's in the branch.
5. You can trigger the workflow manually anytime from the repo's **Actions**
   tab, instead of waiting for the next hour, to check it's working.

## Extending the data layer

- `scripts/fetch_worldbank_teu.py` currently pulls the world aggregate. Swap
  `WLD` in `API_URL` for an ISO3 country code (`CHN`, `USA`, `IND`, `DEU`...)
  or loop over several to build a per-country comparison panel.
- For AIS vessel tracking, sign up for a free-tier key with AISHub,
  MarineTraffic, or Spire, then write `scripts/fetch_ais_vessels.py`
  following the same pattern as the World Bank fetcher: fetch → parse →
  write JSON to `data/`. Add the script's filename to the workflow's
  "Run fetchers" step so it runs hourly alongside the rest.
- For dwell time and freight rates to go live, you're looking at a paid
  data subscription (Vizion TradeView, Drewry, Xeneta). Worth doing once
  you've validated the concept is useful to you with the free layer first.

## Sign convention in routes.json

`pickup_charge_usd` is from **your** perspective as the container owner:
positive means you receive it as lease revenue, negative means you pay it to
get your container repositioned. Real listings can go either direction even
within what looks like the same lane — always check the live quote rather
than assuming a pattern holds.
