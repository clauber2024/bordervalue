import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import { createRequire } from "node:module";

const ROOT = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const require = createRequire(import.meta.url);
const WebSocketClient = loadWebSocketClient();
const PYTHON_CANDIDATES = [
  process.env.PYTHON,
  process.env.USERPROFILE ? `${process.env.USERPROFILE}/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe` : "",
  "python",
  "py",
].filter(Boolean);
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function waitFor(url, timeoutMs = 30000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw lastError || new Error(`Timeout aguardando ${url}`);
}

async function withDashboard(t) {
  const port = await freePort();
  const python = await findPython();
  const args = python === "py" ? ["-3", "dashboard/server.py", String(port)] : ["dashboard/server.py", String(port)];
  const server = spawn(python, args, {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => server.kill());
  await waitFor(`http://127.0.0.1:${port}/api/etl/status`);
  return `http://127.0.0.1:${port}`;
}

async function findPython() {
  const { access } = await import("node:fs/promises");
  for (const candidate of PYTHON_CANDIDATES) {
    if (candidate === "python" || candidate === "py") return candidate;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continua procurando
    }
  }
  return "python";
}

test("APIs, exportacoes e dados filtrados respondem de ponta a ponta", async (t) => {
  const baseUrl = await withDashboard(t);
  const query = await fetch(`${baseUrl}/api/query?flow=EXP&status=all`);
  assert.equal(query.status, 200);
  const queryPayload = await query.json();
  assert.ok(queryPayload.kpis.total > 0);
  assert.ok(queryPayload.groups.world_map.length > 0);

  const employment = await fetch(`${baseUrl}/api/employment?uf=SP`);
  assert.equal(employment.status, 200);
  const employmentPayload = await employment.json();
  assert.ok("formal_jobs" in employmentPayload.kpis);

  const fuels = await fetch(`${baseUrl}/api/fuels?fuel=hidrogenio`);
  assert.equal(fuels.status, 200);
  const fuelsPayload = await fuels.json();
  assert.ok("total" in fuelsPayload.kpis);

  const tsb = await fetch(`${baseUrl}/api/tsb?uf=MG`);
  assert.equal(tsb.status, 200);
  const tsbPayload = await tsb.json();
  assert.ok("wage_mass" in tsbPayload.kpis);
  assert.ok(Array.isArray(tsbPayload.comparison));

  const exportResponse = await fetch(`${baseUrl}/api/export?dataset=trade&flow=IMP`);
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-type") || "", /text\/csv/);
  const csv = await exportResponse.text();
  assert.match(csv.split(/\r?\n/, 1)[0], /allocated_value_usd/);
});

test("HTML/CSS/JS mantem controles essenciais da interface", async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL("../dashboard/index.html", import.meta.url), "utf-8"),
    readFile(new URL("../dashboard/styles.css", import.meta.url), "utf-8"),
    readFile(new URL("../dashboard/app.js", import.meta.url), "utf-8"),
  ]);
  assert.match(html, /id="periodFilter"/);
  assert.match(html, /id="worldTradeMap"/);
  assert.match(html, /id="employmentMunicipalityMap"/);
  assert.match(html, /id="tsb-low-carbon"/);
  assert.match(html, /id="impactAmount"/);
  assert.match(html, /id="impactSector"/);
  assert.match(html, /id="impactResults"/);
  assert.match(html, /id="exportTsb"/);
  assert.match(js, /renderTsbOperational/);
  assert.match(js, /renderImpactSimulation/);
  assert.match(html, /id="exportTrade"/);
  assert.doesNotMatch(html + js, /esm\.sh/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.exports/);
});

test("dashboard renderiza em Chrome headless com filtros, mapas e tamanhos de tela", { timeout: 90000 }, async (t) => {
  const chromePath = await findChrome();
  assert.ok(chromePath, "Chrome ou Edge precisa estar instalado para o teste visual headless.");
  const baseUrl = await withDashboard(t);
  const browser = await launchChrome(t, chromePath, `${baseUrl}/index.html`);
  const page = await browser.firstPage();

  await page.send("Runtime.enable");
  await page.waitFor("document.querySelectorAll('#kpis .kpi').length >= 10");
  assert.equal(await page.eval("document.querySelectorAll('.tab').length >= 10"), true);

  await page.eval(`
    const flow = document.querySelector('#flowFilter');
    flow.value = 'IMP';
    flow.dispatchEvent(new Event('change', { bubbles: true }));
  `);
  await page.waitFor("document.querySelector('#exportTrade').href.includes('flow=IMP')");
  assert.equal(await page.eval("document.querySelector('#exportTrade').href.includes('dataset=trade')"), true);

  await page.eval("document.querySelector('[data-tab=\"world\"]').click()");
  await page.waitFor("document.querySelector('#worldTradeMap svg')");
  assert.equal(await page.eval("document.querySelectorAll('#worldTradeMap .world-country.has-trade').length > 0"), true);

  await page.eval("document.querySelector('[data-tab=\"employment\"]').click()");
  await page.waitFor("document.querySelector('#employmentMunicipalityMap svg, #employmentMunicipalityMap .empty')");
  await page.waitFor("document.querySelector('#etlRunStatus').textContent.length > 0");

  await page.eval("document.querySelector('[data-tab=\"tsb-low-carbon\"]').click()");
  await page.waitFor("document.querySelectorAll('#tsbKpis .kpi').length >= 8");
  await page.waitFor("document.querySelectorAll('#impactResults .kpi').length >= 4");
  assert.equal(await page.eval("document.querySelector('#impactResults').textContent.includes('197')"), true);
  await page.waitFor("document.querySelector('#tsbComparisonTable tbody tr')");

  for (const width of [390, 768, 1280]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.waitFor("document.body && document.querySelector('.topbar')");
    const overflow = await page.eval(`(() => {
      const offenders = [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2)
        .slice(0, 5)
        .map((el) => ({ tag: el.tagName, id: el.id, className: el.className, right: Math.round(el.getBoundingClientRect().right) }));
      return { hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 2, scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth, offenders };
    })()`);
    assert.equal(overflow.hasOverflow, false, `layout com overflow horizontal em ${width}px: ${JSON.stringify(overflow)}`);
  }
});

async function findChrome() {
  const { access } = await import("node:fs/promises");
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continua procurando
    }
  }
  return "";
}

async function launchChrome(t, chromePath, url) {
  const debuggingPort = await freePort();
  const profile = await mkdtemp(join(tmpdir(), "border-value-chrome-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });
  t.after(() => chrome.kill());
  await waitFor(`http://127.0.0.1:${debuggingPort}/json/version`);
  return {
    async firstPage() {
      const page = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent(url)}`, {
        method: "PUT",
      }).then((r) => r.json());
      return new CdpPage(page.webSocketDebuggerUrl);
    },
  };
}

class CdpPage {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocketClient(url);
    this.ready = new Promise((resolve, reject) => {
      if (typeof this.socket.once === "function") {
        this.socket.once("open", resolve);
        this.socket.once("error", reject);
        return;
      }
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    const onMessage = async (data) => {
      const message = JSON.parse(await messageText(data?.data ?? data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    };
    if (typeof this.socket.on === "function") this.socket.on("message", onMessage);
    else this.socket.addEventListener("message", onMessage);
  }

  async send(method, params = {}) {
    await withTimeout(this.ready, 7000, "Timeout abrindo WebSocket do Chrome DevTools");
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return withTimeout(promise, 7000, `Timeout no comando Chrome DevTools ${method}`);
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Erro ao avaliar expressao no navegador");
    }
    return result.result.value;
  }

  async waitFor(expression, timeoutMs = 30000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await this.eval(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Timeout aguardando: ${expression}`);
  }
}

function loadWebSocketClient() {
  try {
    return require("next/dist/compiled/ws");
  } catch {
    return WebSocket;
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function messageText(data) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf-8");
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf-8");
  if (data && typeof data.text === "function") return data.text();
  return String(data);
}
