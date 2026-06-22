const DATA_FILES = {
  dwell: 'data/dwell_times.json',
  teu: 'data/teu_throughput.json',
  routes: 'data/routes.json',
  freight: 'data/freight_rates.json',
};

const fmtUsd = (n) => {
  if (n === null || n === undefined) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}$${Math.abs(n).toLocaleString()}`;
};

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function latestTimestamp(...isoStrings) {
  const dates = isoStrings.filter(Boolean).map((s) => new Date(s));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

function renderDwellChart(data) {
  const ports = data.ports.filter((p) => p.dwell_days !== null || p.arrival_to_berth_days !== null);
  const labels = data.ports.map((p) => p.port);
  const dwellValues = data.ports.map((p) => p.dwell_days);

  new Chart(document.getElementById('dwell-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: dwellValues,
        backgroundColor: dwellValues.map((v) => (v === null ? '#24404F' : '#E8A33D')),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const port = data.ports[ctx.dataIndex];
              if (port.dwell_days === null) return port.note || 'No public dwell figure';
              return `${port.dwell_days} days dwell`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'days', color: '#8B9BA8' },
          ticks: { color: '#8B9BA8' },
          grid: { color: '#24404F' },
        },
        y: { ticks: { color: '#EDE8DD' }, grid: { display: false } },
      },
    },
  });

  document.getElementById('dwell-source').textContent = `Source: ${data.source}`;
}

function renderTEU(data) {
  document.getElementById('teu-figure').textContent = data.global_teu_millions.toLocaleString();
  document.getElementById('teu-delta').textContent = `+${data.global_yoy_growth_pct}% year over year`;
  document.getElementById('teu-source').textContent = `Source: ${data.source}`;
}

function renderMarginBoard(data) {
  const body = document.getElementById('board-body');
  body.innerHTML = '';

  data.case_studies.forEach((r) => {
    const net = r.sell_price_usd - r.buy_price_usd + r.pickup_charge_usd;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${r.origin_port} → ${r.dest_port}</td>
      <td>${r.container_size}</td>
      <td>${fmtUsd(r.buy_price_usd)}</td>
      <td>${fmtUsd(r.sell_price_usd)}</td>
      <td>${fmtUsd(r.pickup_charge_usd)}</td>
      <td class="${net >= 0 ? 'margin-positive' : 'margin-negative'}">${fmtUsd(net)}</td>
    `;
    row.title = r.note || '';
    body.appendChild(row);
  });

  data.lease_rate_references.forEach((r) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${r.origin_port} → ${r.dest_port}</td>
      <td>${r.container_size}</td>
      <td>—</td>
      <td>—</td>
      <td>${fmtUsd(r.pickup_charge_usd)}</td>
      <td>lease only · ${r.free_days}d free, $${r.per_diem_usd}/day after</td>
    `;
    body.appendChild(row);
  });

  document.getElementById('board-source').textContent = `Source: ${data.source}. ${data.sign_convention}`;
}

function renderFreight(data) {
  const list = document.getElementById('freight-list');
  list.innerHTML = '';
  data.snapshot.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'freight-row';
    row.innerHTML = `
      <span class="freight-lane">${s.lane} <small>(${s.date})</small></span>
      <span>$${s.rate_usd_per_feu.toLocaleString()} / FEU</span>
    `;
    list.appendChild(row);
  });
  document.getElementById('freight-source').textContent = data.note;
}

function setupCalculator() {
  const buy = document.getElementById('calc-buy');
  const sell = document.getElementById('calc-sell');
  const charge = document.getElementById('calc-charge');
  const result = document.getElementById('calc-result');

  function update() {
    const net = (Number(sell.value) || 0) - (Number(buy.value) || 0) + (Number(charge.value) || 0);
    result.textContent = fmtUsd(net);
    result.className = `calc-result-figure ${net >= 0 ? 'margin-positive' : 'margin-negative'}`;
  }
  [buy, sell, charge].forEach((el) => el.addEventListener('input', update));
  update();
}

async function init() {
  try {
    const [dwell, teu, routes, freight] = await Promise.all([
      loadJSON(DATA_FILES.dwell),
      loadJSON(DATA_FILES.teu),
      loadJSON(DATA_FILES.routes),
      loadJSON(DATA_FILES.freight),
    ]);

    renderDwellChart(dwell);
    renderTEU(teu);
    renderMarginBoard(routes);
    renderFreight(freight);
    setupCalculator();

    const latest = latestTimestamp(dwell.updated, teu.updated, routes.updated, freight.updated);
    document.getElementById('last-updated').textContent = latest
      ? `data current as of ${latest.toISOString().slice(0, 16).replace('T', ' ')} UTC`
      : 'timestamp unavailable';
  } catch (err) {
    document.getElementById('last-updated').textContent = 'data load failed';
    document.getElementById('status-dot').style.background = '#D9695A';
    console.error(err);
  }
}

init();
