const state = {
  data: null,
  view: null,
  filters: {
    period: "all",
    flow: "all",
    cnae: "all",
    prodlist: "all",
    ncm: "",
    country: "",
    status: "all",
  },
};

const fmtMoney = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtPct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmtDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function byId(id) {
  return document.getElementById(id);
}

function money(v) {
  return `US$ ${fmtMoney.format(v || 0)}`;
}

function optionLabel(code, label) {
  return label ? `${code} - ${label}` : code;
}

async function init() {
  const response = await fetch("data.json");
  state.data = await response.json();
  setupFilters();
  setupTabs();
  await render();
}

function setupFilters() {
  const { summary, options, cnae_labels, prodlist_labels } = state.data;
  fillSelect(byId("periodFilter"), [["all", "Todos"], ...summary.periods.map((p) => [p, p])]);
  fillSelect(byId("flowFilter"), [["all", "Todos"], ...summary.flows.map((f) => [f, f])]);
  fillSelect(byId("statusFilter"), [["all", "Todas"], ...summary.statuses.map((s) => [s, s])]);

  const cnaeMap = new Map(cnae_labels.map((d) => [d.cnae_class, d.cnae_name]));
  const cnaes = options.cnaes;
  fillSelect(byId("cnaeFilter"), [["all", "Todos"], ...cnaes.map((c) => [c, optionLabel(c, cnaeMap.get(c))])]);

  const prodMap = new Map(prodlist_labels.map((d) => [d.prodlist_code, d.prodlist_name]));
  const prodlists = options.prodlists;
  fillSelect(byId("prodlistFilter"), [["all", "Todos"], ...prodlists.map((p) => [p, optionLabel(p, prodMap.get(p))])]);

  fillDatalist("ncmOptions", options.ncms);
  fillDatalist("countryOptions", options.countries);

  ["period", "flow", "cnae", "prodlist", "status"].forEach((key) => {
    byId(`${key}Filter`).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      render();
    });
  });
  byId("ncmFilter").addEventListener("input", (event) => {
    state.filters.ncm = event.target.value.trim();
    render();
  });
  byId("countryFilter").addEventListener("input", (event) => {
    state.filters.country = event.target.value.trim();
    render();
  });
  byId("clearFilters").addEventListener("click", clearFilters);
  byId("prevPeriod").addEventListener("click", () => stepPeriod(-1));
  byId("nextPeriod").addEventListener("click", () => stepPeriod(1));

  byId("sourceInfo").textContent = `Fonte: ${summary.generated_from.indicators} | US$ FOB, kg liquido, PIA 2024`;
}

function fillSelect(select, values) {
  select.innerHTML = values.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
}

function fillDatalist(id, values) {
  byId(id).innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      button.classList.add("active");
      byId(button.dataset.tab).classList.add("active");
    });
  });
}

function clearFilters() {
  state.filters = { period: "all", flow: "all", cnae: "all", prodlist: "all", ncm: "", country: "", status: "all" };
  ["period", "flow", "cnae", "prodlist", "status"].forEach((key) => (byId(`${key}Filter`).value = "all"));
  byId("ncmFilter").value = "";
  byId("countryFilter").value = "";
  render();
}

function stepPeriod(delta) {
  const periods = state.data.summary.periods;
  const current = state.filters.period === "all" ? (delta > 0 ? -1 : periods.length) : periods.indexOf(state.filters.period);
  const next = Math.max(0, Math.min(periods.length - 1, current + delta));
  state.filters.period = periods[next];
  byId("periodFilter").value = periods[next];
  render();
}

function filteredTrade() {
  const f = state.filters;
  return state.data.trade.filter((d) => {
    return (
      (f.period === "all" || d.period === f.period) &&
      (f.flow === "all" || d.flow === f.flow) &&
      (f.cnae === "all" || d.cnae_class === f.cnae) &&
      (f.prodlist === "all" || d.prodlist_code === f.prodlist) &&
      (!f.ncm || d.ncm.includes(f.ncm)) &&
      (!f.country || d.country_code.includes(f.country)) &&
      (f.status === "all" || d.mapping_status === f.status)
    );
  });
}

async function render() {
  const params = new URLSearchParams(state.filters);
  const response = await fetch(`/api/query?${params.toString()}`);
  if (!response.ok) throw new Error("API local indisponivel. Inicie com python dashboard/server.py.");
  state.view = await response.json();
  const { groups } = state.view;
  renderKpis(state.view.kpis);
  barChart("monthlyChart", groups.monthly, { horizontal: false });
  barChart("statusChart", groups.status, { horizontal: true });
  barChart("cnaeChart", groups.cnae, { horizontal: true, limit: 15 });
  barChart("prodChart", groups.prodlist, { horizontal: true, limit: 15 });
  barChart("ncmChart", groups.ncm, { horizontal: true, limit: 20 });
  barChart("countryChart", groups.country, { horizontal: true, limit: 20 });
  sankeyChart("sankeyCnaeChart", groups.sankey_cnae);
  sankeyChart("sankeyProdChart", groups.sankey_prodlist);
  renderTables(state.view);
  renderEtl();
  setupEtlButtons();
}

function renderKpis(kpis) {
  const cards = [
    ["Valor comercial", money(kpis.total)],
    ["Exportacoes", money(kpis.exports)],
    ["Importacoes", money(kpis.imports)],
    ["Saldo", money(kpis.balance)],
    ["Cobertura mapeada", fmtPct.format(kpis.mapped_share || 0)],
    ["Peso liquido (kg)", `${fmtMoney.format(kpis.weight || 0)} kg`],
    ["CNAEs", fmtNum.format(kpis.cnaes || 0)],
    ["PRODLIST", fmtNum.format(kpis.prodlists || 0)],
    ["NCMs", fmtNum.format(kpis.ncms || 0)],
    ["Paises", fmtNum.format(kpis.countries || 0)],
  ];
  byId("kpis").innerHTML = cards.map(([label, value]) => `<article class="kpi"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderTables(view) {
  const cnaeRank = view.groups.cnae;
  const prodRank = view.groups.prodlist;
  const statusRank = view.groups.status;
  renderTable("cnaeTable", ["CNAE", "Valor comercial (US$ FOB)", "Participacao"], cnaeRank, (r, total) => [r.key, money(r.value), fmtPct.format(r.value / total)]);
  renderTable("prodTable", ["PRODLIST", "Valor comercial (US$ FOB)", "Participacao"], prodRank, (r, total) => [r.key, money(r.value), fmtPct.format(r.value / total)]);
  renderTable("statusTable", ["Situacao", "Valor comercial (US$ FOB)", "Peso liquido (kg)"], statusRank, (r) => [r.key, money(r.value), fmtMoney.format(r.weight)]);
  renderRawTable("detailTable", view.detail);
}

function renderEtl() {
  const etl = state.data.etl;
  if (!etl) return;
  const statusCounts = etl.controls.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const summary = [
    ["Versao", etl.version],
    ["Ultima execucao", formatDateTime(etl.last_run_utc)],
    ["Periodo comercio", etl.trade_period],
    ["Periodo producao", etl.production_period],
    ["Metodo", etl.allocation_method],
    ["Controles OK", fmtNum.format(statusCounts.OK || 0)],
    ["Alertas/revisao", fmtNum.format((statusCounts.Revisar || 0) + (statusCounts.Bloqueia || 0))],
  ];
  byId("etlSummary").innerHTML = summary
    .map(([label, value]) => `<div class="etl-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`)
    .join("");

  renderSimpleTable("etlCalendarTable", ["Etapa", "Prazo", "Responsavel"], etl.calendar, (r) => [r.step, r.due, r.owner]);
  renderSimpleTable("etlSourcesTable", ["Fonte", "Tipo", "Periodicidade", "Responsavel", "Status", "Atualizado", "Arquivo", "Acao"], etl.sources, (r) => [
    r.label,
    r.kind,
    r.cadence,
    r.owner,
    r.status,
    formatDateTime(r.last_modified),
    `${r.path} (${formatBytes(r.size_bytes)})`,
    `<button class="small-button etl-run-button" type="button" data-source="${escapeHtml(r.update_key)}">Atualizar</button>`,
  ]);
  renderSimpleTable("etlControlsTable", ["Controle", "Criticidade", "Status", "Evidencia"], etl.controls, (r) => [
    r.control,
    r.severity,
    r.status,
    r.evidence,
  ]);
  refreshEtlStatus();
}

function renderTable(id, headers, rows, mapRow) {
  const total = rows.reduce((acc, r) => acc + r.value, 0) || 1;
  byId(id).innerHTML = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${mapRow(row, total).map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
}

function renderSimpleTable(id, headers, rows, mapRow) {
  byId(id).innerHTML = `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${mapRow(row).map((cell) => `<td>${cellHtml(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
}

function cellHtml(value) {
  const text = String(value || "-");
  return text.startsWith("<button ") ? text : escapeHtml(text);
}

function setupEtlButtons() {
  document.querySelectorAll(".etl-run-button").forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      await runEtlUpdate(button.dataset.source);
    });
  });
}

async function runEtlUpdate(source) {
  setEtlButtonsDisabled(true);
  byId("etlRunStatus").textContent = "Iniciando atualizacao...";
  const response = await fetch(`/api/etl/run?source=${encodeURIComponent(source || "manual")}`, { method: "POST" });
  const payload = await response.json();
  renderEtlStatus(payload);
  pollEtlStatus();
}

async function refreshEtlStatus() {
  try {
    const response = await fetch("/api/etl/status");
    if (response.ok) renderEtlStatus(await response.json());
  } catch {
    byId("etlRunStatus").textContent = "Servidor de atualizacao indisponivel.";
  }
}

async function pollEtlStatus() {
  const response = await fetch("/api/etl/status");
  const payload = await response.json();
  renderEtlStatus(payload);
  if (payload.running) {
    window.setTimeout(pollEtlStatus, 2500);
    return;
  }
  setEtlButtonsDisabled(false);
  if (payload.status === "success") {
    const responseData = await fetch("data.json", { cache: "no-store" });
    state.data = await responseData.json();
    await render();
  }
}

function renderEtlStatus(job) {
  const parts = [job.message || "Status nao informado."];
  if (job.started_at) parts.push(`Inicio: ${formatDateTime(job.started_at)}`);
  if (job.finished_at) parts.push(`Fim: ${formatDateTime(job.finished_at)}`);
  byId("etlRunStatus").textContent = parts.join(" | ");
  setEtlButtonsDisabled(Boolean(job.running));
}

function setEtlButtonsDisabled(disabled) {
  document.querySelectorAll(".etl-run-button").forEach((button) => {
    button.disabled = disabled;
  });
}

function renderRawTable(id, rows) {
  const headers = ["Periodo", "Fluxo", "CNAE", "PRODLIST", "NCM", "Pais", "Situacao", "Valor comercial (US$ FOB)"];
  byId(id).innerHTML = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      (d) =>
        `<tr><td>${d.period}</td><td>${d.flow}</td><td>${d.cnae_class}</td><td>${d.prodlist_code}</td><td>${d.ncm}</td><td>${d.country_code}</td><td>${d.mapping_status}</td><td>${money(d.allocated_value_usd)}</td></tr>`,
    )
    .join("")}</tbody>`;
}

function barChart(id, rows, opts = {}) {
  const el = byId(id);
  const data = rows.slice(0, opts.limit || rows.length);
  if (!data.length) {
    el.innerHTML = `<div class="empty">Sem dados para os filtros atuais.</div>`;
    return;
  }
  const width = 720;
  const height = opts.horizontal ? Math.max(260, data.length * 30 + 30) : 280;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  if (opts.horizontal) {
    el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img">${data
      .map((d, i) => {
        const y = i * 30 + 16;
        const w = (d.value / max) * 500;
        return `<text x="0" y="${y + 14}" font-size="11">${escapeHtml(short(d.key, 24))}</text><rect x="160" y="${y}" width="${w}" height="18" fill="${color(i)}"></rect><text x="${Math.min(670, 168 + w)}" y="${y + 14}" font-size="11">${money(d.value)}</text>`;
      })
      .join("")}</svg>`;
  } else {
    const barW = Math.max(12, Math.floor(620 / data.length) - 6);
    el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img">${data
      .map((d, i) => {
        const h = (d.value / max) * 190;
        const x = 54 + i * (barW + 6);
        return `<rect x="${x}" y="${220 - h}" width="${barW}" height="${h}" fill="${color(i)}"></rect><text transform="translate(${x + 4},238) rotate(45)" font-size="10">${escapeHtml(d.key)}</text>`;
      })
      .join("")}<text x="54" y="20" font-size="11">${money(max)}</text></svg>`;
  }
}

function sankeyChart(id, graph) {
  const el = byId(id);
  if (!graph || !graph.nodes.length || !graph.links.length) {
    el.innerHTML = `<div class="empty">Sem dados para os filtros atuais.</div>`;
    return;
  }

  const width = 900;
  const height = 560;
  const margin = { top: 18, right: 190, bottom: 18, left: 106 };
  const nodeW = 12;
  const minNodeH = 8;
  const gap = 12;
  const nodes = graph.nodes.map((node) => ({ ...node, in: 0, out: 0, linksIn: [], linksOut: [] }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const links = graph.links
    .filter((link) => Number(link.value) > 0 && nodeById.has(link.source) && nodeById.has(link.target))
    .map((link) => ({ ...link, value: Number(link.value) }));

  links.forEach((link) => {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    source.out += link.value;
    target.in += link.value;
    source.linksOut.push(link);
    target.linksIn.push(link);
  });

  nodes.forEach((node) => {
    node.value = Math.max(node.in, node.out);
    node.layer = node.id.startsWith("flow:") ? 0 : node.id.startsWith("status:") ? 1 : 2;
  });

  const layers = [0, 1, 2].map((layer) =>
    nodes
      .filter((node) => node.layer === layer && node.value > 0)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
  );
  const plotH = height - margin.top - margin.bottom;
  const plotW = width - margin.left - margin.right;
  const maxLayerValue = Math.max(...layers.map((layer) => layer.reduce((acc, node) => acc + node.value, 0))) || 1;
  const scale = Math.min(18, (plotH - Math.max(...layers.map((layer) => Math.max(0, layer.length - 1))) * gap) / maxLayerValue);

  layers.forEach((layer, layerIndex) => {
    const totalH = layer.reduce((acc, node) => acc + Math.max(minNodeH, node.value * scale), 0) + Math.max(0, layer.length - 1) * gap;
    let y = margin.top + Math.max(0, (plotH - totalH) / 2);
    layer.forEach((node) => {
      node.x = margin.left + (plotW * layerIndex) / 2;
      node.y = y;
      node.h = Math.max(minNodeH, node.value * scale);
      node.linkOutY = node.y;
      node.linkInY = node.y;
      y += node.h + gap;
    });
  });

  links.sort((a, b) => nodeById.get(a.source).y - nodeById.get(b.source).y || nodeById.get(a.target).y - nodeById.get(b.target).y);
  const linkPaths = links
    .map((link, i) => {
      const source = nodeById.get(link.source);
      const target = nodeById.get(link.target);
      const stroke = Math.max(1.5, link.value * scale);
      const sy = source.linkOutY + stroke / 2;
      const ty = target.linkInY + stroke / 2;
      source.linkOutY += stroke;
      target.linkInY += stroke;
      const x1 = source.x + nodeW;
      const x2 = target.x;
      const c = Math.max(60, (x2 - x1) * 0.52);
      return `<path d="M${x1},${sy} C${x1 + c},${sy} ${x2 - c},${ty} ${x2},${ty}" fill="none" stroke="${color(i)}" stroke-width="${stroke}" stroke-opacity="0.28"><title>${escapeHtml(source.label)} → ${escapeHtml(target.label)}: ${money(link.value)}</title></path>`;
    })
    .join("");

  const nodeEls = nodes
    .filter((node) => node.value > 0)
    .map((node, i) => {
      const labelX = node.layer === 2 ? node.x + nodeW + 8 : node.x - 8;
      const anchor = node.layer === 2 ? "start" : "end";
      const label = `${short(node.label, node.layer === 2 ? 30 : 22)} ${money(node.value)}`;
      return `<rect x="${node.x}" y="${node.y}" width="${nodeW}" height="${node.h}" rx="3" fill="${color(i)}"><title>${escapeHtml(node.label)}: ${money(node.value)}</title></rect><text x="${labelX}" y="${node.y + Math.max(12, node.h / 2 + 4)}" text-anchor="${anchor}" font-size="11">${escapeHtml(label)}</text>`;
    })
    .join("");

  el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafico Sankey de valor comercial em US$ FOB"><title>Sankey de valor comercial</title><desc>As ligacoes mostram valor comercial agregado em US$ FOB entre fluxo, situacao do mapeamento e classificacao final.</desc>${linkPaths}${nodeEls}</svg>`;
}

function color(i) {
  return ["#226b5f", "#3268a8", "#b87918", "#7b5aa6", "#b64b3a", "#4c7c3f"][i % 6];
}

function short(value, max) {
  const s = String(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : fmtDateTime.format(date);
}

function formatBytes(value) {
  if (!value) return "-";
  if (value >= 1024 * 1024) return `${fmtNum.format(value / (1024 * 1024))} MB`;
  if (value >= 1024) return `${fmtNum.format(value / 1024)} KB`;
  return `${fmtNum.format(value)} B`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

init().catch((error) => {
  document.body.innerHTML = `<main><p class="empty">Erro ao carregar dashboard: ${escapeHtml(error.message)}</p></main>`;
});
