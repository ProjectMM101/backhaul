// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  surplus:    '#E8A33D',
  deficit:    '#4FB6AC',
  balanced:   '#8B9BA8',
  tightening: '#A855F7',
  disrupted:  '#D9695A',
};

const STATUS_LABEL = {
  surplus:    'Surplus',
  deficit:    'Deficit',
  balanced:   'Balanced',
  tightening: 'Tightening',
  disrupted:  'Disrupted',
};

const GLOSSARY = [
  {
    section: 'Trading Strategy',
    terms: [
      {
        term: 'Buy-Reposition-Sell',
        def: 'The core strategy: buy a container cheaply in a surplus port (where they\'re plentiful and prices are low), lease it one-way to a shipper who needs to move cargo toward a deficit port (where containers are scarce), then sell it on arrival at a higher price. You pocket the spread, and the shipper covers the ocean voyage.'
      },
      {
        term: 'Surplus Port',
        def: 'A port where more containers are sitting idle than the market needs — typically where a country imports much more than it exports, leaving empty boxes behind after cargo is unloaded. Prices are low here. This is your buying opportunity. Examples: Los Angeles, Rotterdam, Hamburg.'
      },
      {
        term: 'Deficit Port',
        def: 'A port short on available containers — typically where a country exports far more than it imports, creating a chronic shortage of empty boxes to load. Prices are elevated here. This is your selling opportunity. Examples: Shanghai, Ningbo, Shenzhen.'
      },
      {
        term: 'Repositioning',
        def: 'Moving a container from where it\'s oversupplied to where it\'s needed. The smart way to do this is to lease your container to a shipper who\'s already moving cargo in that direction — they handle the ocean leg and you don\'t pay for it. Sometimes they even pay you a credit for solving their equipment shortage.'
      },
      {
        term: 'Credit (in repositioning)',
        def: 'When you move a container from a surplus port toward a deficit port, the shipper or freight forwarder may pay you a credit — because you\'re solving their equipment problem, not creating one. This is cash coming to you, not from you. The reverse (moving from deficit toward surplus) means you pay a fee.'
      },
      {
        term: 'One-Way Lease',
        def: 'Leasing your container to a shipper for a single voyage from Port A to Port B. Unlike traditional leasing (where the container comes back to you), a one-way lease ends at the destination — where you then sell it. The pickup charge is the one-time fee negotiated at the start, and it can go either direction depending on which way the market needs the box to move.'
      },
    ]
  },
  {
    section: 'Pricing & Fees',
    terms: [
      {
        term: 'Pickup Charge',
        def: 'The one-time price negotiated at the start of a one-way SOC lease. It represents the price difference between what a container is worth at the pickup port and what it\'s worth at the destination. Positive = money coming to you (you\'re moving it the right direction). Negative = money you pay (you\'re moving it the wrong direction for the market).'
      },
      {
        term: 'Per Diem',
        def: 'A daily rental charge that kicks in after the free days run out. As the container owner, this is money coming to you if a shipper keeps your box longer than agreed. Think of it as a late fee — it compensates you for every day your asset is tied up beyond the expected transit time.'
      },
      {
        term: 'Free Days',
        def: 'The grace period built into a lease deal before per diem charges begin. It\'s sized to cover the entire normal journey: loading, ocean voyage, customs clearance, unloading, and delivery — with some buffer for routine delays. The number varies by route because longer or more congestion-prone routes need a bigger buffer.'
      },
      {
        term: 'Demurrage',
        def: 'A fee charged by the shipping carrier (not you, as a private container owner) when a container isn\'t collected from the port terminal within the agreed free time. This is a carrier-imposed cost that falls on whoever hired the carrier — not the same as per diem in a private SOC lease arrangement.'
      },
      {
        term: 'Detention',
        def: 'A carrier fee charged when a container is kept beyond the free days once it has left the terminal. Like demurrage, this is a carrier-to-customer charge — distinct from the per diem arrangement between you and whoever you\'ve leased your SOC container to.'
      },
    ]
  },
  {
    section: 'Container Types',
    terms: [
      {
        term: 'SOC Container (Shipper-Owned Container)',
        def: 'A container you own outright — as opposed to one leased from a carrier. Because you own it, you can lease it privately on a one-way basis to any shipper going the direction you want, choose your own pickup charge terms, and sell it at the destination. This ownership structure is what makes the buy-reposition-sell strategy possible.'
      },
      {
        term: 'TEU (Twenty-foot Equivalent Unit)',
        def: 'The standard unit for measuring container volume and port throughput. One standard 20ft container equals 1 TEU. A 40ft container equals 2 TEU. When you see a port handling "1 million TEU per month," that\'s the total count of equivalent 20ft boxes moving through it.'
      },
      {
        term: 'FEU (Forty-foot Equivalent Unit)',
        def: 'A 40ft container — the most common size in global ocean trade. One FEU equals 2 TEU. Freight rates for a specific lane are often quoted per FEU, so when comparing to per-TEU data you need to halve the FEU figure.'
      },
      {
        term: 'One-Trip / New Container',
        def: 'A container built in China that has made exactly one voyage (with real cargo) to its destination — still in near-new condition. More expensive than used containers but easier to sell into specific buyer pools (food-grade storage, high-end conversions, branded retail builds). Not necessarily better for the repositioning strategy, because the higher capital cost means fewer units per dollar deployed.'
      },
      {
        term: 'WWT (Wind and Water Tight)',
        def: 'A used container graded as structurally sound and weatherproof — it keeps rain and wind out — but may have cosmetic dents, surface rust, or minor damage. The most common grade traded on spot markets. Suitable for most storage and shipping uses, at a significant discount to cargo-worthy or new.'
      },
      {
        term: 'CW (Cargo-Worthy)',
        def: 'A used container that has been inspected and certified to legally carry international cargo. Worth more than WWT because it can be actively used for shipping without re-inspection. Useful if you\'re leasing your container out to a shipper — they need CW to put actual cargo inside it.'
      },
    ]
  },
  {
    section: 'Port & Market Data',
    terms: [
      {
        term: 'Dwell Time',
        def: 'The number of days a container sits in the terminal after being unloaded, before it\'s collected and moved on. Rising dwell time is the clearest early-warning signal that containers are piling up at a port — a leading indicator that prices are likely to fall there. Falling dwell time suggests the market is tightening.'
      },
      {
        term: 'Port Throughput',
        def: 'The total volume of containers handled by a port, measured in TEU over a given period (usually monthly or annually). It\'s not the same as dwell time — a port can have high throughput and low dwell (very efficient, like Singapore) or high throughput and high dwell (congested, like Durban). Both pieces of data together tell a more complete story.'
      },
      {
        term: 'POL / POD (Port of Loading / Port of Discharge)',
        def: 'The port where cargo goes onto a ship (POL) and where it comes off (POD). In the buy-reposition-sell strategy, your POL is your buy-side port (where you pick up the container and it gets loaded) and your POD is your sell-side port (where the container arrives and you sell it).'
      },
      {
        term: 'AIS (Automatic Identification System)',
        def: 'The GPS-like transponder system that every commercial vessel broadcasts. AIS data tells you a ship\'s position, speed, destination, and arrival time. Services like MarineTraffic and VesselFinder aggregate AIS signals into live vessel-tracking maps. For container market analysis, AIS lets you track how many ships are calling at a specific port — a proxy for trade activity.'
      },
      {
        term: 'Trade Lane',
        def: 'A specific directional route between two ports or regions — e.g. "Shanghai to Rotterdam" or "Europe to US East Coast." Each lane has its own freight rates, free-day norms, pickup charge structure, and container supply dynamics. Thinking in lanes (not just individual ports) is how professional traders structure their analysis.'
      },
    ]
  },
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────

const fmtUsd = (n) => {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  return (n < 0 ? '−' : '') + '$' + abs.toLocaleString();
};

function badge(status) {
  return `<span class="badge badge-${status}">${STATUS_LABEL[status] || status}</span>`;
}

function trendHtml(trend) {
  if (!trend) return '<span class="trend-stable">—</span>';
  if (trend === 'rising')  return '<span class="trend-rising" title="Rising dwell / prices">↑ rising</span>';
  if (trend === 'falling') return '<span class="trend-falling" title="Falling dwell / tightening">↓ falling</span>';
  return '<span class="trend-stable">→ stable</span>';
}

function buildPortTable(ports) {
  if (!ports.length) return '<p style="padding:12px;font-size:12px;color:var(--muted)">No ports in this category.</p>';
  const rows = ports.map(p => `
    <tr>
      <td><div class="port-name">${p.port}</div><div class="port-country">${p.country}</div></td>
      <td class="port-dwell">${p.dwell_days !== null ? p.dwell_days + 'd' : '—'}</td>
      <td class="port-teu">${p.monthly_teu_thousands ? '~' + p.monthly_teu_thousands + 'k' : '—'}</td>
      <td>${trendHtml(p.trend)}</td>
    </tr>`).join('');
  return `
    <table class="port-table">
      <thead><tr><th>Port</th><th>Dwell</th><th>TEU/mo</th><th>Trend</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── DATA LOADING ─────────────────────────────────────────────────────────────

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ─── TAB NAVIGATION ───────────────────────────────────────────────────────────

let mapReady = false;

function initTabs(allData) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.tab-content').forEach(panel => panel.classList.remove('active'));
      document.getElementById('tab-' + target).classList.add('active');

      if (target === 'map' && !mapReady) {
        mapReady = true;
        setTimeout(() => initMap(allData.ports.ports), 60);
      }
    });
  });
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

function renderOverview(ports, teu) {
  const all = ports.ports;

  // Stat cards
  const surplus   = all.filter(p => p.status === 'surplus').length;
  const deficit   = all.filter(p => p.status === 'deficit').length;
  const teuVal    = teu.global_teu_millions;
  const teuDelta  = teu.global_yoy_growth_pct;

  document.getElementById('overview-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">Global TEU handled</div>
      <div class="stat-card-value">${teuVal}M</div>
      <div class="stat-card-sub">+${teuDelta}% year on year</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Ports tracked</div>
      <div class="stat-card-value">${all.length}</div>
      <div class="stat-card-sub">${surplus} surplus · ${deficit} deficit</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Data source</div>
      <div class="stat-card-value" style="font-size:18px">UNCTAD</div>
      <div class="stat-card-sub">${teu.source.split(',')[0]}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Strategy</div>
      <div class="stat-card-value" style="font-size:16px;color:var(--teal)">Buy↓ Sell↑</div>
      <div class="stat-card-sub">surplus → deficit lane</div>
    </div>
  `;

  // Buy side (surplus)
  document.getElementById('buy-ports').innerHTML =
    buildPortTable(all.filter(p => p.status === 'surplus'));

  // Sell side (deficit)
  document.getElementById('sell-ports').innerHTML =
    buildPortTable(all.filter(p => p.status === 'deficit'));

  // Watch (tightening + disrupted)
  document.getElementById('watch-ports').innerHTML =
    buildPortTable(all.filter(p => p.status === 'tightening' || p.status === 'disrupted'));

  document.getElementById('overview-source').textContent =
    `Port data: ${ports.notes.data_quality} · TEU: ${teu.source}`;
}

// ─── PORT MAP ─────────────────────────────────────────────────────────────────

function buildPopup(p) {
  const dwellStr = p.dwell_days !== null ? `${p.dwell_days} days` : 'Not publicly reported';
  const teuStr   = p.monthly_teu_thousands ? `~${p.monthly_teu_thousands.toLocaleString()}k TEU` : '—';
  const trendStr = p.trend ? p.trend.charAt(0).toUpperCase() + p.trend.slice(1) : '—';
  return `
    <div class="popup-port">${p.port}</div>
    <div class="popup-country">${p.country}</div>
    ${badge(p.status)}
    <div style="margin-top:8px">
      <div class="popup-stat"><b>Dwell time:</b> ${dwellStr}</div>
      <div class="popup-stat"><b>Monthly volume:</b> ${teuStr}</div>
      <div class="popup-stat"><b>Trend:</b> ${trendStr}</div>
    </div>
    ${p.note ? `<div class="popup-note">${p.note}</div>` : ''}
  `;
}

function initMap(ports) {
  const map = L.map('port-map', { zoomControl: true }).setView([20, 10], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(map);

  ports.forEach(p => {
    if (p.lat == null || p.lng == null) return;
    const color  = STATUS_COLOR[p.status] || '#8B9BA8';
    const radius = p.monthly_teu_thousands
      ? Math.max(6, Math.min(18, 5 + Math.log(p.monthly_teu_thousands) * 1.8))
      : 7;

    const marker = L.circleMarker([p.lat, p.lng], {
      radius,
      fillColor: color,
      color: '#0D1B24',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85,
    });

    marker.bindPopup(buildPopup(p), { maxWidth: 280 });
    marker.addTo(map);
  });
}

// ─── ROUTES TAB ───────────────────────────────────────────────────────────────

function renderRoutes(data) {
  const body = document.getElementById('board-body');
  body.innerHTML = '';

  data.case_studies.forEach(r => {
    const net = r.sell_price_usd - r.buy_price_usd + r.pickup_charge_usd;
    const row = document.createElement('tr');
    row.title = r.note || '';
    row.innerHTML = `
      <td>${r.origin_port} → ${r.dest_port}</td>
      <td>${r.container_size}</td>
      <td>${fmtUsd(r.buy_price_usd)}</td>
      <td>${fmtUsd(r.sell_price_usd)}</td>
      <td>${fmtUsd(r.pickup_charge_usd)}</td>
      <td class="${net >= 0 ? 'margin-positive' : 'margin-negative'}">${fmtUsd(net)}</td>
    `;
    body.appendChild(row);
  });

  document.getElementById('board-source').textContent =
    `Source: ${data.source}. ${data.sign_convention}`;

  // Lease rate table
  const lBody = document.getElementById('lease-body');
  lBody.innerHTML = '';
  data.lease_rate_references.forEach(r => {
    const row = document.createElement('tr');
    const sign = r.pickup_charge_usd >= 0 ? '+' : '';
    row.innerHTML = `
      <td>${r.origin_port} → ${r.dest_port}</td>
      <td>${r.container_size}</td>
      <td class="${r.pickup_charge_usd >= 0 ? 'margin-positive' : 'margin-negative'}">${sign}${fmtUsd(r.pickup_charge_usd)}</td>
      <td>${r.free_days} days</td>
      <td>$${r.per_diem_usd}/day</td>
    `;
    lBody.appendChild(row);
  });
}

function initCalculator() {
  const buy    = document.getElementById('calc-buy');
  const sell   = document.getElementById('calc-sell');
  const charge = document.getElementById('calc-charge');
  const result = document.getElementById('calc-result');

  function recalc() {
    const net = (Number(sell.value) || 0) - (Number(buy.value) || 0) + (Number(charge.value) || 0);
    result.textContent = fmtUsd(net);
    result.className = `calc-result-figure ${net >= 0 ? 'margin-positive' : 'margin-negative'}`;
  }
  [buy, sell, charge].forEach(el => el.addEventListener('input', recalc));
  recalc();
}

// ─── GLOSSARY ─────────────────────────────────────────────────────────────────

function renderGlossary() {
  const grid = document.getElementById('glossary-grid');
  grid.innerHTML = GLOSSARY.map(section => `
    <div class="glossary-section">
      <div class="glossary-section-title">${section.section}</div>
      <div class="glossary-cards">
        ${section.terms.map((t, i) => `
          <div class="glossary-card" style="animation-delay:${i * 0.04}s">
            <div class="glossary-term">${t.term}</div>
            <div class="glossary-def">${t.def}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ─── STATUS BAR ───────────────────────────────────────────────────────────────

function setStatus(timestamps) {
  const dates  = timestamps.filter(Boolean).map(s => new Date(s));
  const latest = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
  document.getElementById('last-updated').textContent = latest
    ? 'data as of ' + latest.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
    : 'timestamp unavailable';
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const [ports, teu, routes] = await Promise.all([
      loadJSON('data/ports.json'),
      loadJSON('data/teu_throughput.json'),
      loadJSON('data/routes.json'),
    ]);

    const allData = { ports, teu, routes };

    renderOverview(ports, teu);
    renderRoutes(routes);
    renderGlossary();
    initCalculator();
    initTabs(allData);
    setStatus([ports.updated, teu.updated, routes.updated]);

  } catch (err) {
    console.error('Dashboard init error:', err);
    document.getElementById('last-updated').textContent = 'data load failed';
    document.getElementById('status-dot').style.background = '#D9695A';
  }
}

init();
