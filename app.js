// ═══ CONSTANTS ═══════════════════════════════════════════════════════════════

const STATUS_COLOR = { surplus:'#E8A33D', deficit:'#4FB6AC', balanced:'#8B9BA8', tightening:'#A855F7', disrupted:'#D9695A' };
const STATUS_LABEL = { surplus:'Surplus', deficit:'Deficit', balanced:'Balanced', tightening:'Tightening', disrupted:'Disrupted' };

const GLOSSARY = [
  { section: 'Trading Strategy', terms: [
    { term:'Buy-Reposition-Sell', def:'The core strategy: buy a container cheaply in a surplus port, lease it one-way to a shipper headed toward a deficit port (they cover the ocean voyage), then sell it on arrival at a higher price. You pocket the spread.' },
    { term:'Surplus Port', def:'A port with more containers sitting idle than the market needs — typically where a country imports far more than it exports, leaving empty boxes behind. Prices are low here. This is your buying opportunity.' },
    { term:'Deficit Port', def:'A port short on available containers — where export demand far outstrips container supply. Prices are elevated. This is your selling opportunity. China ports are the clearest global example.' },
    { term:'Repositioning', def:'Moving a container from where it\'s oversupplied to where it\'s needed. The profitable way: lease it one-way to a shipper already heading that direction, so they cover the ocean freight and you don\'t.' },
    { term:'Credit (repositioning)', def:'When moving a container from surplus toward deficit, the shipper pays you a credit — because you\'re solving their equipment shortage, not creating one. Money comes to you. Move the wrong way and you pay a fee instead.' },
    { term:'One-Way Lease', def:'Leasing your container to a shipper for a single voyage from Port A to Port B. Unlike traditional leasing, a one-way lease ends at the destination — where you then sell the box. The pickup charge is the one-time price for this arrangement.' },
  ]},
  { section: 'Pricing & Fees', terms: [
    { term:'Pickup Charge', def:'The one-time price negotiated at the start of a one-way lease. Positive = money you receive (good direction for the market). Negative = money you pay (moving against the supply gradient). Always check the live listing — direction is not guaranteed.' },
    { term:'Per Diem', def:'A daily charge that starts after the free days expire. As container owner, this is money coming to you if a shipper keeps your box longer than agreed. Think of it as a late return fee protecting your asset.' },
    { term:'Free Days', def:'The grace period built into a lease before per diem kicks in. It covers the full expected journey — loading, ocean transit, customs, unloading — with a buffer for routine delays. Longer routes get more free days.' },
    { term:'Depot Out-Gate Fee', def:'The handling fee charged at the depot when your container leaves for loading. Typically $50–$150. A fixed cost regardless of the ocean voyage cost.' },
    { term:'Depot In-Gate Fee', def:'The handling fee at the destination depot when your container arrives. Typically $75–$200. Usually slightly higher than the out-gate because more inspection and processing occurs on arrival.' },
    { term:'DPP (Damage Protection Plan)', def:'An insurance-style coverage against minor container damage during transit. Typically $75–$150 per trip. Without it, you pay the full cost of any damage the shipper causes. Worth including in your cost model.' },
    { term:'Demurrage', def:'A carrier-imposed fee (not your private lease arrangement) when a container isn\'t collected from the port terminal within the carrier\'s own free days. Separate from per diem.' },
    { term:'Detention', def:'A carrier fee for keeping their container beyond the allowed free time once it\'s left the terminal. Again separate from per diem — this applies to carrier-owned containers, not your SOC equipment.' },
  ]},
  { section: 'Container Types', terms: [
    { term:'SOC (Shipper-Owned Container)', def:'A container you own outright. You can lease it privately on one-way terms to any shipper, set your own pickup charge and per diem terms, and sell it at the destination. SOC ownership is what makes the buy-reposition-sell strategy possible.' },
    { term:'TEU (Twenty-foot Equivalent Unit)', def:'The standard unit for measuring container volume. One 20ft container = 1 TEU. One 40ft container = 2 TEU. Port throughput is measured in TEU — "1 million TEU/month" means the equivalent of 1M twenty-foot boxes.' },
    { term:'FEU (Forty-foot Equivalent Unit)', def:'A 40ft container — the most common size in global ocean trade. One FEU = 2 TEU. Freight rates are often quoted per FEU, so divide by 2 to compare with per-TEU figures.' },
    { term:'One-Trip / New Container', def:'Built in China, carried one load of cargo to its first destination, still near-new. More expensive to buy but easier to sell into premium buyer pools: food storage, high-end conversions, branded retail builds.' },
    { term:'WWT (Wind & Water Tight)', def:'A used container graded as structurally sound and weatherproof but may have cosmetic damage. The most common and liquid grade on spot markets. Best for volume trading at tight margins.' },
    { term:'CW (Cargo-Worthy)', def:'A used container certified for international cargo carriage after inspection. Worth more than WWT. Useful if your repositioning strategy involves actually leasing the container out for cargo — shippers need CW certification.' },
  ]},
  { section: 'Port & Market Data', terms: [
    { term:'Dwell Time', def:'Days a container sits in the terminal after unloading before pickup. Rising dwell = containers piling up = prices likely falling. It\'s the earliest publicly available signal of a market turning surplus.' },
    { term:'Port Throughput', def:'Total container volume handled by a port (in TEU). High throughput + low dwell = efficient port (Singapore, Busan). High throughput + high dwell = congested (Shanghai peak periods, Durban).' },
    { term:'POL / POD', def:'Port of Loading (where cargo goes on the ship) and Port of Discharge (where it comes off). Your buy-side port is the POL and your sell-side is the POD in a one-way reposition trade.' },
    { term:'AIS (Automatic Identification System)', def:'GPS-like transponder broadcast by every commercial vessel. AIS aggregators (MarineTraffic, VesselFinder) show real-time ship positions and port call data — a leading indicator of trade activity before throughput stats are published.' },
    { term:'IMF PortWatch', def:'A free, open-access platform from the International Monetary Fund tracking daily vessel calls at 2,065 ports worldwide using satellite data. Updated every Tuesday. The Live Feed tab pulls from their free ArcGIS API — no key required.' },
    { term:'Trade Lane', def:'A directional route between two ports or regions (e.g. "Shanghai to Rotterdam"). Each lane has its own freight rates, pickup charge structure, free-day norms, and supply dynamics. Professional traders think in lanes, not just individual ports.' },
  ]},
];

// ═══ UTILITIES ════════════════════════════════════════════════════════════════

const fmtUsd = (n, sign = false) => {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const prefix = n < 0 ? '−' : (sign && n > 0 ? '+' : '');
  return prefix + '$' + abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtPct  = (n) => n !== null ? (n >= 0 ? '+' : '') + n.toFixed(1) + '%' : '—';
const badge   = (s) => `<span class="badge badge-${s}">${STATUS_LABEL[s] || s}</span>`;
const trendHtml = (t) => {
  if (!t || t === 'stable') return '<span class="trend-stable">→ stable</span>';
  if (t === 'rising')  return '<span class="trend-rising">↑ rising</span>';
  if (t === 'falling') return '<span class="trend-falling">↓ falling</span>';
  return '<span class="trend-stable">—</span>';
};

// ═══ DATA LOADING ════════════════════════════════════════════════════════════

const loadJSON = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

// ═══ OVERVIEW ════════════════════════════════════════════════════════════════

let allPorts = [];

function buildPortTable(ports) {
  if (!ports.length) return '<p style="padding:12px;font-size:12px;color:var(--muted)">No ports in this category.</p>';
  return `<table class="port-table">
    <thead><tr><th>Port</th><th>Dwell</th><th>TEU/mo</th><th>Trend</th></tr></thead>
    <tbody>${ports.map(p => `<tr data-port="${p.port.toLowerCase()}">
      <td><div class="port-name">${p.port}</div><div class="port-country">${p.country}</div></td>
      <td class="port-dwell">${p.dwell_days !== null ? p.dwell_days + 'd' : '—'}</td>
      <td class="port-teu">${p.monthly_teu_thousands ? '~' + p.monthly_teu_thousands.toLocaleString() + 'k' : '—'}</td>
      <td>${trendHtml(p.trend)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function renderOverview(ports, teu) {
  allPorts = ports.ports;
  const surplus = allPorts.filter(p => p.status === 'surplus').length;
  const deficit = allPorts.filter(p => p.status === 'deficit').length;

  document.getElementById('overview-stats').innerHTML = `
    <div class="stat-card"><div class="stat-card-label">Global TEU handled</div><div class="stat-card-value">${teu.global_teu_millions}M</div><div class="stat-card-sub">+${teu.global_yoy_growth_pct}% YoY · ${teu.source.split(',')[0]}</div></div>
    <div class="stat-card"><div class="stat-card-label">Ports tracked</div><div class="stat-card-value">${allPorts.length}</div><div class="stat-card-sub">${surplus} surplus · ${deficit} deficit</div></div>
    <div class="stat-card"><div class="stat-card-label">Primary strategy</div><div class="stat-card-value" style="font-size:18px;color:var(--teal)">Buy ↓ Sell ↑</div><div class="stat-card-sub">surplus → deficit lane</div></div>
    <div class="stat-card"><div class="stat-card-label">Live vessel data</div><div class="stat-card-value" style="font-size:18px">IMF</div><div class="stat-card-sub">PortWatch · 2,065 ports</div></div>`;

  document.getElementById('buy-ports').innerHTML   = buildPortTable(allPorts.filter(p => p.status === 'surplus'));
  document.getElementById('sell-ports').innerHTML  = buildPortTable(allPorts.filter(p => p.status === 'deficit'));
  document.getElementById('watch-ports').innerHTML = buildPortTable(allPorts.filter(p => p.status === 'tightening' || p.status === 'disrupted'));
  document.getElementById('overview-source').textContent = `Ports: ${ports.notes.data_quality} · TEU: ${teu.source}`;

  setupOverviewSearch();
}

function setupOverviewSearch() {
  const input = document.getElementById('port-search-overview');
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('.port-table tr[data-port]').forEach(row => {
      row.classList.toggle('hidden', q.length > 0 && !row.dataset.port.includes(q));
    });
  });
}

// ═══ MAP ══════════════════════════════════════════════════════════════════════

let mapInstance = null;
let mapMarkers  = [];
let mapReady    = false;
let isFullscreen = false;
let portWatchData = {};

function buildPortWatchLookup(pw) {
  portWatchData = {};
  if (!pw || !pw.ports || !pw.ports.length) return;
  pw.ports.forEach(p => {
    portWatchData[p.portname.toLowerCase()] = p;
  });
}

function findPortWatchEntry(portName) {
  if (!portName) return null;
  const q = portName.toLowerCase();
  if (portWatchData[q]) return portWatchData[q];
  // partial match — handles "Nhava Sheva" vs "Mumbai", "Shenzhen" vs "Yantian" etc.
  for (const [key, val] of Object.entries(portWatchData)) {
    if (q.includes(key) || key.includes(q)) return val;
  }
  return null;
}

function buildPopup(p) {
  const live = findPortWatchEntry(p.port);
  const hasLive = live && live.avg_container_calls_14d !== null;

  const liveSection = hasLive ? `
    <div class="popup-live">
      <div class="popup-live-label">📡 Live — IMF PortWatch (14-day avg)</div>
      <div class="popup-stat"><b>Container calls/day:</b> ${live.avg_container_calls_14d.toFixed(1)}</div>
      ${live.avg_imports_14d  ? `<div class="popup-stat"><b>Imports TEU/day:</b> ${live.avg_imports_14d.toLocaleString()}</div>`  : ''}
      ${live.avg_exports_14d  ? `<div class="popup-stat"><b>Exports TEU/day:</b> ${live.avg_exports_14d.toLocaleString()}</div>`  : ''}
      <div class="popup-stat"><b>Activity trend:</b> ${live.trend_vs_prior_14d || '—'}</div>
    </div>` : '';

  return `<div class="popup-port">${p.port}${hasLive ? ' <span class="popup-live-dot" title="Live data available">●</span>' : ''}</div>
    <div class="popup-country">${p.country}</div>
    ${badge(p.status)}
    <div style="margin-top:8px">
      <div class="popup-stat"><b>Dwell time:</b> ${p.dwell_days !== null ? p.dwell_days + ' days' : 'Not publicly reported'}</div>
      <div class="popup-stat"><b>Monthly volume:</b> ${p.monthly_teu_thousands ? '~' + p.monthly_teu_thousands.toLocaleString() + 'k TEU' : '—'}</div>
      <div class="popup-stat"><b>Market trend:</b> ${p.trend ? p.trend.charAt(0).toUpperCase() + p.trend.slice(1) : '—'}</div>
      <div class="popup-stat"><b>Data quality:</b> ${p.data_quality || 'estimated'}</div>
    </div>
    ${liveSection}
    ${p.note ? `<div class="popup-note">${p.note}</div>` : ''}
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
      <a href="https://www.marinetraffic.com/en/ais/index/ports/all/?name=${encodeURIComponent(p.port)}" target="_blank" rel="noopener" class="popup-mt-link">View on MarineTraffic →</a>
    </div>`;

function initMap(ports) {
  mapInstance = L.map('port-map', {
    zoomControl: true,
    minZoom: 1.5,
    maxZoom: 18,
    worldCopyJump: true,           // markers jump to closest copy when wrapping
    maxBounds: [[-85, -1800], [85, 1800]], // wide lon range = globe spin, lat capped
    maxBoundsViscosity: 0.4,       // soft polar boundary, not hard stop
  }).setView([20, 10], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd', maxZoom: 18,  // no noWrap — tiles repeat = globe feel
  }).addTo(mapInstance);

  ports.forEach(p => {
    if (p.lat == null || p.lng == null) return;
    const color  = STATUS_COLOR[p.status] || '#8B9BA8';
    const radius = p.monthly_teu_thousands
      ? Math.max(6, Math.min(20, 4 + Math.log(p.monthly_teu_thousands) * 2))
      : 7;
    const m = L.circleMarker([p.lat, p.lng], { radius, fillColor: color, color: '#0D1B24', weight: 2, opacity: 1, fillOpacity: 0.85 });
    m.bindPopup(buildPopup(p), { maxWidth: 300 });
    m.portName = p.port.toLowerCase();
    m.portData = p;
    m.lat = p.lat;
    m.lng = p.lng;
    m.statusKey = p.status;
    m.addTo(mapInstance);
    mapMarkers.push(m);
  });

  createMapSidePanel(ports);
  setupMapSearch();
  setupFullscreen();
}

function setupMapSearch() {
  const input   = document.getElementById('port-search-map');
  const results = document.getElementById('map-search-results');

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    results.innerHTML = '';
    if (!q) { results.hidden = true; return; }

    const matches = mapMarkers.filter(m => m.portName.includes(q)).slice(0, 8);
    if (!matches.length) { results.hidden = true; return; }

    matches.forEach(m => {
      const li = document.createElement('li');
      const origPort = allPorts.find(p => p.port.toLowerCase() === m.portName);
      li.innerHTML = m.portName.charAt(0).toUpperCase() + m.portName.slice(1) +
        (origPort ? ` <span>${origPort.country}</span>` : '');
      li.addEventListener('click', () => {
        mapInstance.flyTo([m.lat, m.lng], 7, { animate: true, duration: 1 });
        setTimeout(() => m.openPopup(), 1000);
        input.value = '';
        results.hidden = true;
      });
      results.appendChild(li);
    });
    results.hidden = false;
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.map-search-wrap')) results.hidden = true;
  });
}

function setupFullscreen() {
  const btn = document.getElementById('fullscreen-btn');
  const sec = document.getElementById('tab-map');
  btn.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    sec.classList.toggle('map-fullscreen', isFullscreen);
    btn.title = isFullscreen ? 'Exit fullscreen' : 'Toggle fullscreen map';
    btn.textContent = isFullscreen ? '⤡' : '⤢';
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 120);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreen) btn.click();
  });
}

// ═══ ROUTES + ENHANCED CALCULATOR ════════════════════════════════════════════

let currentRoutes = null;

function renderRoutes(data) {
  currentRoutes = data;
  const body = document.getElementById('board-body');
  body.innerHTML = data.case_studies.map(r => {
    const net = r.sell_price_usd - r.buy_price_usd + r.pickup_charge_usd;
    return `<tr title="${r.note || ''}">
      <td>${r.origin_port} → ${r.dest_port}</td>
      <td>${r.container_size}</td>
      <td>${fmtUsd(r.buy_price_usd)}</td>
      <td>${fmtUsd(r.sell_price_usd)}</td>
      <td class="${r.pickup_charge_usd >= 0 ? 'margin-positive' : 'margin-negative'}">${fmtUsd(r.pickup_charge_usd, true)}</td>
      <td class="${net >= 0 ? 'margin-positive' : 'margin-negative'}">${fmtUsd(net)}</td>
    </tr>`;
  }).join('');
  document.getElementById('board-source').textContent = `Source: ${data.source}. ${data.sign_convention} Hover rows for notes.`;

  const lbody = document.getElementById('lease-body');
  lbody.innerHTML = data.lease_rate_references.map(r => `<tr>
    <td>${r.origin_port} → ${r.dest_port}</td>
    <td>${r.container_size}</td>
    <td class="${r.pickup_charge_usd >= 0 ? 'margin-positive' : 'margin-negative'}">${fmtUsd(r.pickup_charge_usd, true)}</td>
    <td>${r.free_days} days</td>
    <td>$${r.per_diem_usd}/day</td>
  </tr>`).join('');

  initEnhancedCalculator(data);
}

function initEnhancedCalculator(routeData) {
  const ids = ['ci-buy','ci-pickup','ci-freedays','ci-daysused','ci-perdiem','ci-depot-out','ci-depot-in','ci-insurance','ci-sell'];
  const val = (id) => parseFloat(document.getElementById(id).value) || 0;

  // Size buttons — update per diem defaults when toggling
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const is40 = btn.dataset.size === '40';
      document.getElementById('ci-perdiem').value = is40 ? '4.50' : '3.50';
      recalc();
    });
  });

  ids.forEach(id => document.getElementById(id).addEventListener('input', recalc));

  function recalc() {
    const buy       = val('ci-buy');
    const pickup    = val('ci-pickup');
    const freeDays  = val('ci-freedays');
    const daysUsed  = val('ci-daysused');
    const perDiem   = val('ci-perdiem');
    const depotOut  = val('ci-depot-out');
    const depotIn   = val('ci-depot-in');
    const insurance = val('ci-insurance');
    const sell      = val('ci-sell');

    const overstayDays = Math.max(0, daysUsed - freeDays);
    const overstayCost = overstayDays * perDiem;
    const pickupRecv   = Math.max(0, pickup);
    const pickupPaid   = Math.abs(Math.min(0, pickup));

    const totalRev   = sell + pickupRecv;
    const totalCosts = buy + pickupPaid + depotOut + depotIn + insurance + overstayCost;
    const net        = totalRev - totalCosts;
    const roi        = buy > 0 ? (net / buy * 100) : null;

    // Revenue breakdown
    document.getElementById('rev-rows').innerHTML = `
      <div class="breakdown-row"><span class="br-label">Sell price</span><span class="br-val">${fmtUsd(sell)}</span></div>
      <div class="breakdown-row ${pickupRecv === 0 ? 'dimmed' : ''}"><span class="br-label">Pickup charge received</span><span class="br-val margin-positive">${pickupRecv > 0 ? '+' + fmtUsd(pickupRecv) : '—'}</span></div>`;
    document.getElementById('rev-total').innerHTML = `<span>Total revenue</span><span class="br-val">${fmtUsd(totalRev)}</span>`;

    // Cost breakdown
    document.getElementById('cost-rows').innerHTML = `
      <div class="breakdown-row"><span class="br-label">Purchase price</span><span class="br-val">${fmtUsd(buy)}</span></div>
      <div class="breakdown-row"><span class="br-label">Depot out-gate</span><span class="br-val">${fmtUsd(depotOut)}</span></div>
      <div class="breakdown-row"><span class="br-label">Depot in-gate</span><span class="br-val">${fmtUsd(depotIn)}</span></div>
      <div class="breakdown-row"><span class="br-label">Insurance / DPP</span><span class="br-val">${fmtUsd(insurance)}</span></div>
      <div class="breakdown-row ${pickupPaid === 0 ? 'dimmed' : ''}"><span class="br-label">Pickup charge paid</span><span class="br-val margin-negative">${pickupPaid > 0 ? fmtUsd(pickupPaid) : '—'}</span></div>
      <div class="breakdown-row ${overstayCost === 0 ? 'dimmed' : ''}"><span class="br-label">Overstay (${overstayDays}d × $${perDiem})</span><span class="br-val ${overstayCost > 0 ? 'margin-negative' : ''}">${overstayCost > 0 ? fmtUsd(overstayCost) : '—'}</span></div>`;
    document.getElementById('cost-total').innerHTML = `<span>Total costs</span><span class="br-val">${fmtUsd(totalCosts)}</span>`;

    // Net result cards
    document.getElementById('calc-net').innerHTML = `
      <div class="net-card"><div class="net-card-label">Net margin</div><div class="net-card-value ${net >= 0 ? 'positive' : 'negative'}">${fmtUsd(net)}</div></div>
      <div class="net-card"><div class="net-card-label">ROI on capital</div><div class="net-card-value ${roi !== null && roi >= 0 ? 'positive' : 'negative'}">${roi !== null ? fmtPct(roi) : '—'}</div></div>
      <div class="net-card"><div class="net-card-label">Capital deployed</div><div class="net-card-value neutral">${fmtUsd(buy)}</div></div>`;
  }

  recalc();
}

// ═══ LIVE FEED ═══════════════════════════════════════════════════════════════

let liveChart = null;

function renderLiveFeed(data) {
  const badge = document.getElementById('live-badge');
  badge.textContent = data.updated ? 'Updated ' + data.updated.slice(0, 10) : 'Not yet fetched';

  document.getElementById('live-source').textContent =
    `Source: ${data.source} · Period: ${data.period}`;

  const ports = data.ports || [];
  if (!ports.length) {
    document.getElementById('live-empty').hidden = false;
    return;
  }

  document.getElementById('live-empty').hidden = true;

  // Sort by avg calls descending
  const sorted = [...ports].filter(p => p.avg_container_calls_14d !== null)
    .sort((a, b) => b.avg_container_calls_14d - a.avg_container_calls_14d)
    .slice(0, 25);

  // Bar chart
  const chartWrap = document.getElementById('live-chart-wrap');
  chartWrap.hidden = false;
  if (liveChart) liveChart.destroy();
  liveChart = new Chart(document.getElementById('live-chart'), {
    type: 'bar',
    data: {
      labels: sorted.map(p => p.portname),
      datasets: [{
        data: sorted.map(p => p.avg_container_calls_14d),
        backgroundColor: '#E8A33D',
        borderRadius: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.parsed.y.toFixed(1) + ' vessel calls/day' } } },
      scales: {
        x: { ticks: { color: '#8B9BA8', maxRotation: 45 }, grid: { display: false } },
        y: { title: { display: true, text: 'avg daily container calls', color: '#8B9BA8' }, ticks: { color: '#8B9BA8' }, grid: { color: '#24404F' } }
      }
    }
  });

  // Detail table
  const tableWrap = document.getElementById('live-table-wrap');
  tableWrap.hidden = false;
  document.getElementById('live-body').innerHTML = sorted.map(p => `<tr>
    <td>${p.portname}</td>
    <td>${p.ISO3}</td>
    <td style="font-family:var(--mono)">${p.avg_container_calls_14d !== null ? p.avg_container_calls_14d.toFixed(1) : '—'}</td>
    <td style="font-family:var(--mono)">${p.avg_imports_14d !== null ? p.avg_imports_14d.toLocaleString() : '—'}</td>
    <td style="font-family:var(--mono)">${p.avg_exports_14d !== null ? p.avg_exports_14d.toLocaleString() : '—'}</td>
    <td>${trendHtml(p.trend_vs_prior_14d)}</td>
  </tr>`).join('');
}

// ═══ GLOSSARY ════════════════════════════════════════════════════════════════

function renderGlossary() {
  document.getElementById('glossary-grid').innerHTML = GLOSSARY.map(s => `
    <div class="glossary-section">
      <div class="glossary-section-title">${s.section}</div>
      <div class="glossary-cards">
        ${s.terms.map((t, i) => `<div class="glossary-card" style="animation-delay:${i * .04}s">
          <div class="glossary-term">${t.term}</div>
          <div class="glossary-def">${t.def}</div>
        </div>`).join('')}
      </div>
    </div>`).join('');
}

// ═══ TABS ═════════════════════════════════════════════════════════════════════

function initTabs(allData) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      tab.classList.add('active'); tab.setAttribute('aria-selected','true');
      document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'map' && !mapReady) {
        mapReady = true;
        setTimeout(() => initMap(allData.ports.ports), 80);
      }
    });
  });
}

// ═══ AI ASSISTANT ════════════════════════════════════════════════════════════

let conversationHistory = [];

function aiSystemPrompt() {
  const portLines = allPorts.map(p =>
    `• ${p.port}, ${p.country}: ${p.status.toUpperCase()}` +
    (p.dwell_days ? ` | dwell ${p.dwell_days}d` : '') +
    (p.monthly_teu_thousands ? ` | ~${p.monthly_teu_thousands}k TEU/mo` : '') +
    (p.trend ? ` | trend: ${p.trend}` : '')
  ).join('\n');

  const routeLines = currentRoutes
    ? currentRoutes.case_studies.map(r => {
        const net = r.sell_price_usd - r.buy_price_usd + r.pickup_charge_usd;
        return `• ${r.origin_port}→${r.dest_port} (${r.container_size}): buy $${r.buy_price_usd} sell $${r.sell_price_usd} pickup ${r.pickup_charge_usd >= 0 ? '+' : ''}$${r.pickup_charge_usd} → net ~$${net}`;
      }).join('\n')
    : 'No route data loaded yet.';

  return `You are a container trading analyst embedded in the Backhaul dashboard. You specialise in the buy-reposition-sell strategy for shipping containers.

LIVE PORT STATUS (${allPorts.length} ports tracked):
${portLines}

KNOWN TRADE ROUTES:
${routeLines}

PRICING FRAMEWORK (use when estimating any route):
Surplus port buy prices: 20ft $700–1,000 | 40ft HC $1,200–1,700
Balanced port buy prices: 20ft $1,000–1,400 | 40ft HC $1,700–2,200
Deficit port sell prices: 20ft $1,200–1,700 | 40ft HC $2,000–2,800
Pickup charge: surplus→deficit lane = +$100 to +$400 (credit to you)
Pickup charge: deficit→surplus lane = −$100 to −$300 (you pay)
Fixed overhead per trip: depot out-gate ~$75 + depot in-gate ~$100 + DPP insurance ~$100 = ~$275 minimum

WHEN ASKED FOR BEST ROUTES: rank all surplus→deficit port pairs by estimated net margin after the $275 fixed overhead. Show top 5 with full cost breakdown.
WHEN ASKED FOR PREDICTIONS: reason from dwell-time trends, tightening markets (India ports rising fast), disruption signals (Middle East), and nearshoring shifts.
WHEN ASKED ABOUT A SPECIFIC ROUTE: always give a full itemised cost breakdown and net margin estimate.

Be specific — cite port names and current status. Keep responses concise, structured, and actionable. Use bullet points and bold for key numbers.`;
}

async function callClaude(userMessage) {
  const apiKey = localStorage.getItem('bh_api_key');
  if (!apiKey) { showAISetup(); return null; }

  conversationHistory.push({ role: 'user', content: userMessage });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: aiSystemPrompt(),
      messages: conversationHistory,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const reply = data.content[0].text;
  conversationHistory.push({ role: 'assistant', content: reply });
  return reply;
}

function mdToHtml(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function addMessage(role, content) {
  const msgs = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-message ai-${role}`;
  div.innerHTML = `<div class="ai-bubble">${mdToHtml(content)}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showAISetup() {
  document.getElementById('ai-setup').hidden = false;
  document.getElementById('ai-chat').hidden = true;
}

function showAIChat() {
  document.getElementById('ai-setup').hidden = true;
  document.getElementById('ai-chat').hidden = false;
}

async function sendAIMessage(text) {
  if (!text.trim()) return;
  const input   = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send');
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  addMessage('user', text);

  const msgs = document.getElementById('ai-messages');
  const loading = document.createElement('div');
  loading.className = 'ai-message ai-assistant';
  loading.innerHTML = '<div class="ai-bubble ai-loading"><span>.</span><span>.</span><span>.</span></div>';
  msgs.appendChild(loading);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const reply = await callClaude(text);
    loading.remove();
    if (reply) addMessage('assistant', reply);
  } catch (err) {
    loading.remove();
    addMessage('assistant', `⚠️ Error: ${err.message}\n\nIf your API key is wrong, click **Change key** above.`);
  }

  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
}

function initAI() {
  // Update header counts
  const pc = document.getElementById('ai-port-count');
  const rc = document.getElementById('ai-route-count');
  if (pc) pc.textContent = allPorts.length + ' ports';
  if (rc && currentRoutes) rc.textContent = currentRoutes.case_studies.length + ' routes';

  const saved = localStorage.getItem('bh_api_key');
  if (saved) {
    showAIChat();
  } else {
    showAISetup();
  }

  document.getElementById('save-api-key').addEventListener('click', () => {
    const key = document.getElementById('api-key-input').value.trim();
    const err = document.getElementById('api-key-error');
    if (!key) { err.textContent = 'Please enter a key.'; return; }
    if (!key.startsWith('sk-ant-')) { err.textContent = 'Key should start with sk-ant-'; return; }
    err.textContent = '';
    localStorage.setItem('bh_api_key', key);
    showAIChat();
    addMessage('assistant', "Ready. I have live data on all tracked ports and routes. Try one of the quick actions, or ask me anything about routes, margins, or market predictions.");
  });

  document.getElementById('api-key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('save-api-key').click();
  });

  document.getElementById('change-api-key').addEventListener('click', () => {
    localStorage.removeItem('bh_api_key');
    conversationHistory = [];
    document.getElementById('ai-messages').innerHTML = '';
    showAISetup();
  });

  document.getElementById('clear-chat').addEventListener('click', () => {
    conversationHistory = [];
    document.getElementById('ai-messages').innerHTML = '';
    addMessage('assistant', "Conversation cleared. What would you like to analyse?");
  });

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => sendAIMessage(btn.dataset.prompt));
  });

  document.getElementById('ai-send').addEventListener('click', () => {
    sendAIMessage(document.getElementById('ai-input').value);
  });

  document.getElementById('ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAIMessage(e.target.value); }
  });
}

// ═══ MAP SIDE PANEL + LAYERS ════════════════════════════════════════════════

let layerVisible = { surplus:true, deficit:true, balanced:true, tightening:true, disrupted:true, ships:false, worldports:false };
let aisSocket = null;
let shipMarkers = {};
let worldPortLayer = null;
let allTimestamps = {};

function ageBadge(isoStr) {
  if (!isoStr) return '<span class="fresh-badge fresh-unknown">unknown</span>';
  const days = (Date.now() - new Date(isoStr).getTime()) / 86400000;
  const cls   = days < 1 ? 'fresh-new' : days < 7 ? 'fresh-ok' : days < 60 ? 'fresh-old' : 'fresh-stale';
  const label = days < 1 ? 'today' : days < 2 ? 'yesterday' : Math.floor(days) + ' days ago';
  return `<span class="fresh-badge ${cls}">${label}</span>`;
}

function createMapSidePanel() {
  // Panel element
  const panel = document.createElement('div');
  panel.id = 'map-panel';
  panel.className = 'map-panel';
  panel.innerHTML = `
    <div class="mp-header">
      <span>Map Layers</span>
      <button id="mp-close" class="mp-close" title="Close panel">×</button>
    </div>

    <div class="mp-section">
      <div class="mp-section-title">Ports by status</div>
      ${Object.entries(STATUS_LABEL).map(([key, label]) => `
        <label class="mp-toggle">
          <input type="checkbox" class="layer-chk" data-status="${key}" checked>
          <span class="mp-dot" style="background:${STATUS_COLOR[key]}"></span>
          ${label}
        </label>`).join('')}
    </div>

    <div class="mp-section">
      <div class="mp-section-title">Live ships (AIS)</div>
      <label class="mp-toggle">
        <input type="checkbox" id="ships-chk"> Show ships in view
      </label>
      <div class="ais-setup-wrap" id="ais-setup-wrap">
        <input type="password" id="ais-key" class="mp-input"
               placeholder="AISStream.io API key"
               value="${localStorage.getItem('bh_ais_key') || ''}">
        <button id="ais-save" class="mp-btn">Save key</button>
        <p class="mp-hint">Free key: <a href="https://aisstream.io" target="_blank" rel="noopener">aisstream.io</a>
          &nbsp;·&nbsp; Shows vessels in current map view</p>
        <p class="mp-hint" style="color:var(--muted);margin-top:4px">MarineTraffic API: $500+/mo — use the link in each port popup instead</p>
      </div>
      <div id="ais-status" class="ais-status"></div>
    </div>

    <div class="mp-section">
      <div class="mp-section-title">World ports</div>
      <label class="mp-toggle">
        <input type="checkbox" id="worldports-chk"> All 3,700+ ports (WPI)
      </label>
      <p class="mp-hint" id="wpi-status">World Port Index — free public dataset</p>
    </div>

    <div class="mp-section">
      <div class="mp-section-title">Data freshness</div>
      <div id="freshness-list"></div>
    </div>
  `;

  // Toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'panel-toggle-btn';
  toggleBtn.className = 'panel-toggle-btn';
  toggleBtn.innerHTML = '☰ Layers';
  toggleBtn.title = 'Toggle map layers panel';

  const mapSection = document.getElementById('tab-map');
  mapSection.appendChild(panel);
  mapSection.appendChild(toggleBtn);

  // Open/close
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('mp-open');
    toggleBtn.classList.toggle('mp-panel-open');
  });
  document.getElementById('mp-close').addEventListener('click', () => {
    panel.classList.remove('mp-open');
    toggleBtn.classList.remove('mp-panel-open');
  });

  // Port status layer toggles
  panel.querySelectorAll('.layer-chk').forEach(chk => {
    chk.addEventListener('change', () => {
      const status = chk.dataset.status;
      layerVisible[status] = chk.checked;
      mapMarkers.forEach(m => {
        if (m.statusKey === status) {
          chk.checked ? m.addTo(mapInstance) : m.remove();
        }
      });
    });
  });

  // Ships toggle
  document.getElementById('ships-chk').addEventListener('change', e => {
    layerVisible.ships = e.target.checked;
    if (e.target.checked) {
      const key = localStorage.getItem('bh_ais_key');
      if (key) connectAIS(key);
      else document.getElementById('ais-status').textContent = 'Enter an API key above first.';
    } else {
      disconnectAIS();
    }
  });

  // AIS key save
  document.getElementById('ais-save').addEventListener('click', () => {
    const key = document.getElementById('ais-key').value.trim();
    if (!key) return;
    localStorage.setItem('bh_ais_key', key);
    document.getElementById('ais-status').textContent = 'Key saved. Toggle ships on to connect.';
  });

  // World ports toggle
  document.getElementById('worldports-chk').addEventListener('change', e => {
    if (e.target.checked) loadWorldPorts();
    else if (worldPortLayer) { worldPortLayer.clearLayers(); }
  });

  // Freshness
  renderFreshness();
}

function renderFreshness() {
  const list = document.getElementById('freshness-list');
  if (!list) return;
  const sources = [
    { label: 'Port status & dwell',   ts: allTimestamps.ports },
    { label: 'IMF PortWatch (ships)', ts: allTimestamps.portwatch },
    { label: 'World Bank TEU',         ts: allTimestamps.teu },
    { label: 'Routes & margins',       ts: allTimestamps.routes },
  ];
  list.innerHTML = sources.map(s =>
    `<div class="fresh-row"><span class="fresh-label">${s.label}</span>${ageBadge(s.ts)}</div>`
  ).join('');
}

// ═══ AIS SHIPS (AISStream.io) ════════════════════════════════════════════════

function connectAIS(apiKey) {
  disconnectAIS();
  const statusEl = document.getElementById('ais-status');
  statusEl.textContent = 'Connecting…';

  aisSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');

  aisSocket.onopen = () => {
    const bounds = mapInstance.getBounds();
    aisSocket.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [[[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]]],
      FilterMessageTypes: ['PositionReport'],
    }));
    statusEl.textContent = '● Connected — showing vessels in view';
    statusEl.style.color = 'var(--teal)';

    // Update subscription when map moves
    mapInstance.on('moveend', () => {
      if (aisSocket && aisSocket.readyState === WebSocket.OPEN) {
        const b = mapInstance.getBounds();
        aisSocket.send(JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [[[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]]],
          FilterMessageTypes: ['PositionReport'],
        }));
      }
    });
  };

  aisSocket.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      const pos  = data?.Message?.PositionReport;
      if (!pos) return;
      const { UserID: mmsi, Latitude: lat, Longitude: lng, Sog: speed, Cog: course } = pos;
      if (!lat || !lng) return;

      if (shipMarkers[mmsi]) {
        shipMarkers[mmsi].setLatLng([lat, lng]);
      } else {
        const m = L.circleMarker([lat, lng], {
          radius: 3, fillColor: '#4FB6AC', color: '#0D1B24',
          weight: 1, opacity: 1, fillOpacity: 0.9,
        });
        m.bindPopup(`<b>MMSI:</b> ${mmsi}<br><b>Speed:</b> ${speed ? speed.toFixed(1) + ' kn' : '—'}<br><b>Course:</b> ${course ? Math.round(course) + '°' : '—'}<br><a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}" target="_blank" rel="noopener" style="color:var(--teal)">View on MarineTraffic →</a>`);
        m.addTo(mapInstance);
        shipMarkers[mmsi] = m;
      }
    } catch {/* ignore parse errors */}
  };

  aisSocket.onerror = () => { statusEl.textContent = 'Connection error — check API key.'; statusEl.style.color = 'var(--red)'; };
  aisSocket.onclose = () => { if (layerVisible.ships) statusEl.textContent = 'Disconnected.'; };
}

function disconnectAIS() {
  if (aisSocket) { aisSocket.close(); aisSocket = null; }
  Object.values(shipMarkers).forEach(m => m.remove());
  shipMarkers = {};
  const s = document.getElementById('ais-status');
  if (s) { s.textContent = ''; s.style.color = ''; }
}

// ═══ WORLD PORT INDEX (ALL PORTS) ════════════════════════════════════════════

async function loadWorldPorts() {
  const statusEl = document.getElementById('wpi-status');
  statusEl.textContent = 'Loading 3,700+ ports…';

  try {
    const url = 'https://services9.arcgis.com/j1CY4yzWfwptbTWN/arcgis/rest/services/WorldPortIndex_WFL1/FeatureServer/0/query'
      + '?where=1%3D1&outFields=PORT_NAME%2CCOUNTRY%2CHARBORSIZE&geometryPrecision=4&outSR=4326&f=geojson&resultRecordCount=5000';

    const res  = await fetch(url);
    const geoj = await res.json();

    if (!worldPortLayer) {
      worldPortLayer = L.layerGroup().addTo(mapInstance);
    } else {
      worldPortLayer.clearLayers();
    }

    let count = 0;
    geoj.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      const p = f.properties;
      const r = p.HARBORSIZE === 'L' ? 4 : p.HARBORSIZE === 'M' ? 3 : 2;
      const m = L.circleMarker([lat, lng], {
        radius: r, fillColor: '#8B9BA8', color: '#0D1B24',
        weight: 1, opacity: 0.7, fillOpacity: 0.5,
      });
      m.bindPopup(`<b>${p.PORT_NAME}</b><br>${p.COUNTRY || '—'}<br>
        <a href="https://www.marinetraffic.com/en/ais/index/ports/all/?name=${encodeURIComponent(p.PORT_NAME)}" target="_blank" rel="noopener" style="color:var(--teal)">View on MarineTraffic →</a>`);
      worldPortLayer.addLayer(m);
      count++;
    });

    statusEl.textContent = `Loaded ${count.toLocaleString()} ports. Gray dots = WPI. Coloured = tracked.`;
  } catch (err) {
    statusEl.textContent = `Failed to load: ${err.message}`;
  }
}

// ═══ STATUS BAR ═══════════════════════════════════════════════════════════════

function setStatus(timestamps) {
  const dates  = timestamps.filter(Boolean).map(s => new Date(s));
  const latest = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
  document.getElementById('last-updated').textContent = latest
    ? 'data as of ' + latest.toISOString().slice(0,16).replace('T',' ') + ' UTC'
    : 'timestamp unavailable';
}

// ═══ INIT ══════════════════════════════════════════════════════════════════════

async function init() {
  try {
    const [ports, teu, routes, portwatch] = await Promise.all([
      loadJSON('data/ports.json'),
      loadJSON('data/teu_throughput.json'),
      loadJSON('data/routes.json'),
      loadJSON('data/portwatch.json'),
    ]);

    allTimestamps = { ports: ports.updated, teu: teu.updated, routes: routes.updated, portwatch: portwatch.updated };

    renderOverview(ports, teu);
    renderRoutes(routes);
    renderLiveFeed(portwatch);
    renderGlossary();
    buildPortWatchLookup(portwatch);
    initTabs({ ports, teu, routes });
    initAI();
    setStatus([ports.updated, teu.updated, routes.updated, portwatch.updated]);

  } catch (err) {
    console.error('Dashboard init error:', err);
    document.getElementById('last-updated').textContent = 'data load failed — see console';
    document.getElementById('status-dot').style.background = '#D9695A';
  }
}

init();
