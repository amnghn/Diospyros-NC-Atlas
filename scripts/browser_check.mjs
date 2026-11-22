#!/usr/bin/env node
/**
 * Headless browser check of the atlas: Firefox through WebDriver BiDi. Needs Node 22 or newer
 * (built-in WebSocket) and Firefox; no npm packages. Used on LiSC before a release, not in the
 * GitHub Actions workflow.
 *
 * It opens every page of a running preview server and checks: console errors, horizontal
 * scrolling, the filters, search, colour-by, column groups, sorting (mouse and keyboard), the
 * detail drawer (Enter, Escape, focus), the species cards, the three base maps, both exports
 * (real downloads, compared byte for byte with what the page should write), the About page
 * (email link, links, version) and the 404 page. It writes screenshots, the downloaded files
 * and report_<width>.json into --out.
 *
 * Usage:
 *   node scripts/browser_check.mjs --url http://127.0.0.1:8765/Diospyros-NC-Atlas/ --out <dir>
 *        [--width 1440] [--height 900] [--basic]
 *        [--og <file.png>]          (also save a 1200 × 630 preview image of the map page)
 *        [--screenshot <file.png>]  (also save a screenshot of the map page for the README)
 *        [--pages-404]              (also open a missing address in a sub-folder; needs a server
 *                                    that answers like GitHub Pages, with 404.html)
 *
 * --basic only loads the pages and checks console errors and horizontal scrolling.
 * Nothing is deleted: the Firefox profile and the downloads are new folders inside --out.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true"]);
    return acc;
  }, []),
);
const BASE = args.url ?? "http://127.0.0.1:8765/Diospyros-NC-Atlas/";
const OUT = resolve(args.out ?? "browser_check_out");
const W = Number(args.width ?? 1440);
const H = Number(args.height ?? 900);
const BASIC = Boolean(args.basic);
const STAMP = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const PROFILE = join(OUT, `firefox-profile-${W}-${STAMP}`);
const DOWNLOADS = join(OUT, `downloads-${W}-${STAMP}`);
const PORT = 9300 + Math.floor(Math.random() * 500);
const EMAIL = ["aminghane", "univie.ac.at"].join("@");
for (const dir of [OUT, PROFILE, DOWNLOADS]) mkdirSync(dir, { recursive: true });
writeFileSync(
  join(PROFILE, "user.js"),
  [
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("toolkit.telemetry.enabled", false);',
    'user_pref("app.update.enabled", false);',
    'user_pref("browser.download.folderList", 2);',
    `user_pref("browser.download.dir", ${JSON.stringify(DOWNLOADS)});`,
    'user_pref("browser.download.useDownloadDir", true);',
    'user_pref("browser.download.always_ask_before_handling_new_types", false);',
    'user_pref("browser.download.manager.showWhenStarting", false);',
    'user_pref("browser.download.alwaysOpenPanel", false);',
    'user_pref("browser.helperApps.neverAsk.saveToDisk", "text/csv,text/tab-separated-values");',
  ].join("\n"),
);

const ff = spawn("firefox", ["--headless", "--no-remote", "--profile", PROFILE, `--remote-debugging-port=${PORT}`, "about:blank"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let ffLog = "";
ff.stderr.on("data", (d) => (ffLog += d));
ff.stdout.on("data", (d) => (ffLog += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
let nextId = 1;
const waiting = new Map();
const logs = [];
const results = [];
let ctx;
let page = "";

async function connect() {
  for (let k = 0; k < 120 && !/WebDriver BiDi listening/.test(ffLog); k++) await sleep(250);
  return await new Promise((res, rej) => {
    const sock = new WebSocket(`ws://127.0.0.1:${PORT}/session`);
    sock.onopen = () => res(sock);
    sock.onerror = (e) => rej(new Error(`websocket: ${e.message ?? e}`));
  });
}
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => waiting.set(id, { res, rej, method }));
}
async function evaluate(expression) {
  const r = await send("script.evaluate", { expression, target: { context: ctx }, awaitPromise: true, resultOwnership: "none" });
  if (r.type === "exception") throw new Error(`page exception in ${page}: ${r.exceptionDetails?.text ?? JSON.stringify(r)}`);
  return r.result?.value;
}
const json = async (expr) => JSON.parse(await evaluate(`JSON.stringify(${expr})`));
const waitFor = (cond, ms = 20000) =>
  evaluate(`new Promise((res) => { const t0 = performance.now(); const tick = () => { let ok = false; try { ok = Boolean(${cond}); } catch (e) {} if (ok) res(Math.round(performance.now() - t0)); else if (performance.now() - t0 > ${ms}) res(-1); else setTimeout(tick, 50); }; tick(); })`);
async function nav(path) {
  page = path || "index";
  await send("browsingContext.navigate", { context: ctx, url: new URL(path, BASE).href, wait: "complete" });
}
async function key(value) {
  await send("input.performActions", { context: ctx, actions: [{ type: "key", id: "keyboard", actions: [{ type: "keyDown", value }, { type: "keyUp", value }] }] });
  await send("input.releaseActions", { context: ctx });
  await sleep(150);
}
const KEY = { enter: "", escape: "", space: " " };
async function shot(name, origin = "document") {
  const r = await send("browsingContext.captureScreenshot", { context: ctx, origin });
  const file = name.endsWith(".png") ? name : join(OUT, `${name}_${W}.png`);
  writeFileSync(file, Buffer.from(r.data, "base64"));
  return file;
}
function check(name, ok, detail = "") {
  results.push({ page, name, ok: Boolean(ok), detail });
  if (!ok) console.log(`FAIL [${page}] ${name}${detail ? `: ${detail}` : ""}`);
}
const noOverflow = () => json(`({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth })`);
async function checkOverflow(label) {
  const o = await noOverflow();
  check(`no horizontal scrolling (${label})`, o.scrollW <= o.innerW, `scrollWidth ${o.scrollW} > ${o.innerW}`);
}
async function status(path) {
  try {
    return (await fetch(new URL(path, BASE))).status;
  } catch (e) {
    return String(e);
  }
}
async function waitForDownload(prefix, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const hit = readdirSync(DOWNLOADS).find((f) => f.startsWith(prefix) && !f.endsWith(".part"));
    if (hit && !existsSync(join(DOWNLOADS, `${hit}.part`))) {
      await sleep(200);
      return join(DOWNLOADS, hit);
    }
    await sleep(200);
  }
  return null;
}
// Minimal CSV/TSV reader with quotes, used to check the exports independently of the app's code.
function parseDelimited(text, sep) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const pageInfo = `({ title: document.title, description: document.querySelector('meta[name=description]')?.content ?? '',
  ogImage: document.querySelector('meta[property="og:image"]')?.content ?? '', beta: document.querySelector('.beta-badge')?.textContent ?? '',
  footer: document.querySelector('.site-footer')?.textContent.replace(/\\s+/g, ' ').trim() ?? '', lang: document.documentElement.lang,
  favicon: document.querySelector('link[rel=icon]')?.getAttribute('href') ?? '',
  noindex: /noindex/.test(document.querySelector('meta[name=robots]')?.content ?? '') })`;

async function checkCommon(label) {
  const info = await json(pageInfo);
  check("page has a title and a description", info.title && info.description, JSON.stringify(info));
  if (!BASIC) {
    check("Beta badge next to the title", /beta/i.test(info.beta), info.beta);
    const version = await evaluate(`(window.SITE && window.SITE.version) || ''`);
    check("footer shows the version", version && info.footer.includes(`v${version}`), info.footer);
    check("footer links to the About page", await evaluate(`Boolean(document.querySelector('.site-footer a[href="about.html"]'))`));
    if (!info.noindex) check("Open Graph image is an absolute URL", /^https:\/\/amnghn\.github\.io\/Diospyros-NC-Atlas\//.test(info.ogImage), info.ogImage);
    check("favicon link", info.favicon !== "", info.favicon);
    check("lang is en-GB", info.lang === "en-GB", info.lang);
    const repo = await json(`({ href: document.querySelector('#repo-link')?.href ?? '', hidden: document.querySelector('#repo-link')?.hidden })`);
    check("GitHub link in the header", repo.href === "https://github.com/amnghn/Diospyros-NC-Atlas" && repo.hidden === false, JSON.stringify(repo));
  }
  await checkOverflow(label);
}

async function testIndex() {
  await nav("");
  const ready = await waitFor(`document.querySelectorAll('.leaflet-marker-icon').length === 50 && document.querySelectorAll('#sample-table tbody tr').length === 50`);
  check("map shows 50 markers and the table 50 rows", ready >= 0, `waited ${ready} ms`);
  await waitFor(`document.querySelectorAll('img.leaflet-tile').length > 0 && !document.querySelector('img.leaflet-tile:not(.leaflet-tile-loaded)')`, 20000);
  await checkCommon("map page");
  check("Leaflet loaded (integrity hash accepted)", await evaluate(`typeof L === 'object' && L.version === '1.9.4'`));
  const sri = await json(`[...document.querySelectorAll('script[src^="http"], link[rel=stylesheet][href^="http"]')].map(e => ({ url: e.src || e.href, integrity: e.integrity, crossOrigin: e.crossOrigin }))`);
  if (!BASIC) check("external files have integrity and crossorigin", sri.length === 2 && sri.every((e) => e.integrity.startsWith("sha256-") && e.crossOrigin === "anonymous"), JSON.stringify(sri));
  await shot("index_top", "viewport");
  await shot("index_full");
  if (BASIC) return;

  const counts = `({ rows: document.querySelectorAll('#sample-table tbody tr').length, markers: document.querySelectorAll('.leaflet-marker-icon').length,
    empty: !document.querySelector('#empty').hidden, summary: document.querySelector('#summary').textContent })`;
  const expected = (filterJs) => evaluate(`state.samples.filter(${filterJs}).length`);

  // Facets: "none" empties the map and the table, "all" restores it; one box removes one value
  for (const facet of ["species_id", "soil_type", "province"]) {
    await evaluate(`document.querySelector('[data-facet-none="${facet}"]').click(); true`);
    let c = await json(counts);
    check(`facet ${facet}: "none" shows no samples`, c.rows === 0 && c.markers === 0 && c.empty && /Showing 0 of 50/.test(c.summary), JSON.stringify(c));
    await evaluate(`document.querySelector('[data-facet-all="${facet}"]').click(); true`);
    c = await json(counts);
    check(`facet ${facet}: "all" shows all samples`, c.rows === 50 && c.markers === 50, JSON.stringify(c));
    const value = await evaluate(`document.querySelector('input[data-facet="${facet}"]').value`);
    await evaluate(`document.querySelector('input[data-facet="${facet}"]').click(); true`);
    c = await json(counts);
    const want = 50 - (await expected(`s => s['${facet}'] === ${JSON.stringify(value)}`));
    check(`facet ${facet}: unticking "${value}" removes its samples`, c.rows === want && c.markers === want, `${c.rows} rows, ${c.markers} markers, expected ${want}`);
    await evaluate(`document.querySelector('input[data-facet="${facet}"]').click(); true`);
  }
  const labels = await json(`[...document.querySelectorAll('[data-facet-all],[data-facet-none]')].map(b => b.getAttribute('aria-label') || '')`);
  check("facet all/none buttons have specific labels", labels.every((l) => /^(Select all|Clear) /.test(l)), JSON.stringify(labels));

  // Data-available flags
  for (const [flag, filter] of [["rna", "s => s.rna_available === 'yes'"], ["hifi", "s => s.hifi_available === 'yes'"], ["ref", "s => s.is_reference === 'yes'"]]) {
    await evaluate(`document.querySelector('input[data-flag="${flag}"]').click(); true`);
    const c = await json(counts);
    const want = await expected(filter);
    check(`flag ${flag} keeps only matching samples`, c.rows === want && c.markers === want, `${c.rows} rows, expected ${want}`);
    await evaluate(`document.querySelector('input[data-flag="${flag}"]').click(); true`);
  }

  // Search
  await evaluate(`(() => { const s = document.querySelector('#search'); s.value = 'Koghi'; s.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  let c = await json(counts);
  const wantKoghi = await expected(`s => s.locality.includes('Koghi')`);
  check("search 'Koghi' finds the Mont Koghi samples", c.rows === wantKoghi && wantKoghi > 0, `${c.rows} rows, expected ${wantKoghi}`);
  await evaluate(`document.querySelector('#reset-filters').click(); true`);
  c = await json(counts);
  check("Reset restores all samples and clears the search", c.rows === 50 && (await evaluate(`document.querySelector('#search').value`)) === "", JSON.stringify(c));

  // Colour by soil type
  await evaluate(`(() => { const s = document.querySelector('#color-by'); s.value = 'soil_type'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  const soil = await json(`({ legend: document.querySelector('.legend').textContent, fills: [...new Set([...document.querySelectorAll('.leaflet-marker-icon svg [fill]')].map(e => e.getAttribute('fill').toUpperCase()))].filter(f => f.startsWith('#')).sort(), soilColors: Object.values(SOIL_COLORS).map(x => x.toUpperCase()).sort() })`);
  check("colour by soil type: legend and markers use the soil colours", /Limestone/.test(soil.legend) && soil.fills.every((f) => soil.soilColors.includes(f)), JSON.stringify(soil));
  await shot("index_colour_by_soil", "viewport");
  await evaluate(`(() => { const s = document.querySelector('#color-by'); s.value = 'species_id'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

  // Column groups
  const header = `[...document.querySelectorAll('#sample-table thead th')].map(th => th.textContent.replace(/[▲▼]/g, '').trim())`;
  await evaluate(`document.querySelector('input[data-group="dna"]').click(); true`);
  let h = await json(header);
  check("column group DNA can be switched on", h.includes("DNA (ng/µL)"), JSON.stringify(h));
  await evaluate(`document.querySelector('input[data-group="location"]').click(); true`);
  h = await json(header);
  check("column group Location can be switched off", !h.includes("Locality") && h.includes("DNA (ng/µL)"), JSON.stringify(h));
  check("column toggles are a labelled group", await evaluate(`document.querySelector('#column-toggles').getAttribute('role') === 'group'`));
  await evaluate(`document.querySelector('input[data-group="location"]').click(); document.querySelector('input[data-group="dna"]').click(); true`);

  // Sorting by elevation: mouse click, then keyboard on the header button
  const elevations = `(() => { const i = [...document.querySelectorAll('#sample-table thead th')].findIndex(th => th.dataset.column === 'elevation_m'); return [...document.querySelectorAll('#sample-table tbody tr')].map(tr => Number(tr.children[i].textContent)); })()`;
  const sortButton = `(document.querySelector('th[data-column="elevation_m"] button') || document.querySelector('th[data-column="elevation_m"]'))`;
  await evaluate(`${sortButton}.click(); true`);
  let e = await json(elevations);
  check("sorting by elevation (ascending)", e.every((v, i) => i === 0 || e[i - 1] <= v), e.slice(0, 5).join(","));
  check("aria-sort is ascending", (await evaluate(`document.querySelector('th[data-column="elevation_m"]').getAttribute('aria-sort')`)) === "ascending");
  // Headless Firefox has no window focus (document.hasFocus() is false), so it does not turn
  // synthetic Enter/Space key presses into button clicks. Check instead that every sort control
  // is a native <button> (the browser makes it work with Enter and Space), then click it again.
  check("sort controls are native buttons (Enter and Space work)", await evaluate(`[...document.querySelectorAll('#sample-table thead th')].every(th => th.querySelector('button[type="button"]'))`));
  await evaluate(`${sortButton}.focus(); ${sortButton}.click(); true`);
  e = await json(elevations);
  check("sorting again by elevation: descending", e.every((v, i) => i === 0 || e[i - 1] >= v), e.slice(0, 5).join(","));
  check("aria-sort is descending", (await evaluate(`document.querySelector('th[data-column="elevation_m"]').getAttribute('aria-sort')`)) === "descending");
  check("sort header keeps focus after sorting", await evaluate(`document.activeElement === document.querySelector('th[data-column="elevation_m"] button')`));
  await evaluate(`document.querySelector('th[data-column="sample_id"] button').click(); true`);

  // Detail drawer: click a row; Escape closes it and focus returns to the row
  const drawer = `({ open: !document.querySelector('#detail').hidden, heading: document.querySelector('#detail h3')?.textContent ?? '', focusInDrawer: document.querySelector('#detail').contains(document.activeElement), active: document.activeElement?.dataset?.id ?? document.activeElement?.tagName })`;
  const firstId = await evaluate(`document.querySelector('#sample-table tbody tr').dataset.id`);
  await evaluate(`document.querySelector('#sample-table tbody tr').click(); true`);
  let d = await json(drawer);
  check("row click opens the detail drawer", d.open && d.heading.includes(firstId), JSON.stringify(d));
  check("focus moves into the drawer", d.focusInDrawer, JSON.stringify(d));
  await checkOverflow("drawer open");
  await shot("index_drawer", "viewport");
  await key(KEY.escape);
  d = await json(drawer);
  check("Escape closes the drawer and focus returns to the row", !d.open && d.active === firstId, JSON.stringify(d));

  // Keyboard: Enter and Space on a focused row
  const secondId = await evaluate(`document.querySelectorAll('#sample-table tbody tr')[1].dataset.id`);
  check("table rows are focusable", await evaluate(`document.querySelectorAll('#sample-table tbody tr')[1].tabIndex === 0`));
  await evaluate(`document.querySelectorAll('#sample-table tbody tr')[1].focus(); true`);
  await key(KEY.enter);
  d = await json(drawer);
  check("Enter on a focused row opens the drawer", d.open && d.heading.includes(secondId), JSON.stringify(d));
  await evaluate(`document.querySelector('#detail-close').click(); true`);
  d = await json(drawer);
  check("the close button closes the drawer and focus returns to the row", !d.open && d.active === secondId, JSON.stringify(d));
  await evaluate(`document.querySelector('#sample-table tbody tr[data-id="${secondId}"]').focus(); true`);
  const scrollBefore = await evaluate(`scrollY`);
  await key(KEY.space);
  d = await json(drawer);
  check("Space on a focused row opens the drawer without scrolling the page", d.open && d.heading.includes(secondId) && (await evaluate(`scrollY`)) === scrollBefore, JSON.stringify(d));
  await key(KEY.escape);

  // Species cards
  await evaluate(`document.querySelector('[data-show-species="DCAL"]').click(); true`);
  await sleep(300);
  c = await json(counts);
  const species = await json(`[...document.querySelectorAll('input[data-facet="species_id"]:checked')].map(b => b.value)`);
  check("species card 'Show on map' filters to that species", c.rows === 10 && species.join() === "DCAL", JSON.stringify({ ...c, species }));
  const ref = await evaluate(`state.species.get('DPAN').reference_sample_id`);
  await evaluate(`document.querySelector('.card [data-goto="${ref}"]').click(); true`);
  await sleep(800);
  d = await json(drawer);
  check("species card 'Go to reference sample' opens that sample", d.open && d.heading.includes(ref) && /reference/.test(d.heading), JSON.stringify(d));
  const refButton = await evaluate(`(() => { const b = document.querySelector('#detail [data-goto]'); return b ? b.dataset.goto : 'none'; })()`);
  check("the reference sample's drawer has no 'go to reference' link", refButton === "none", refButton);
  await key(KEY.escape);
  await evaluate(`document.querySelector('#reset-filters').click(); true`);

  // Base maps: each layer loads tiles and shows its attribution
  const layers = {};
  for (const [label, host] of [["Topographic", "opentopomap"], ["Satellite", "arcgisonline"], ["Street map", "openstreetmap"]]) {
    await evaluate(`(() => { const i = [...document.querySelectorAll('.leaflet-control-layers-base label')].find(l => l.textContent.trim() === ${JSON.stringify(label)}).querySelector('input'); i.click(); return true; })()`);
    const ms = await waitFor(`document.querySelector('img.leaflet-tile.leaflet-tile-loaded[src*="${host}"]')`, 20000);
    layers[label] = { loadedMs: ms, attribution: await evaluate(`document.querySelector('.leaflet-control-attribution').textContent`) };
    check(`base map "${label}" loads tiles`, ms >= 0, JSON.stringify(layers[label]));
  }

  // Exports: real downloads, compared byte for byte with what the page should write
  await evaluate(`document.querySelector('[data-facet-none="soil_type"]').click(); document.querySelector('input[data-facet="soil_type"][value="Limestone"]').click(); document.querySelector('input[data-group="rna"]').click(); true`);
  const exp = await json(`(() => {
    const rows = filteredSamples();
    const fileRows = rows.flatMap(s => (state.filesBySample.get(s.sample_id) || []).map(f => ({ ...f, species: s.species })));
    const fileCols = ['sample_id', 'species', 'data_type', 'platform', 'read', 'path', 'size_gb', 'md5'];
    return { nSamples: rows.length, nFiles: fileRows.length, sampleCols: visibleColumns(), fileCols,
      samples: { csv: toDelimited(rows, visibleColumns(), ','), tsv: toDelimited(rows, visibleColumns(), '\\t') },
      files: { csv: toDelimited(fileRows, fileCols, ','), tsv: toDelimited(fileRows, fileCols, '\\t') },
      firstSample: rows[0] };
  })()`);
  const exportReport = {};
  for (const kind of ["samples", "files"]) {
    for (const format of ["csv", "tsv"]) {
      await evaluate(`document.querySelector('[data-export="${kind}"][data-format="${format}"]').click(); true`);
      const prefix = kind === "samples" ? "diospyros_samples_" : "diospyros_fastq_files_";
      const file = await waitForDownload(prefix + new Date().toISOString().slice(0, 10) + "." + format);
      if (!file) {
        check(`export ${kind} ${format}: file downloaded`, false, `nothing in ${DOWNLOADS}`);
        continue;
      }
      const text = readFileSync(file, "utf-8");
      const rows = parseDelimited(text, format === "csv" ? "," : "\t");
      const cols = kind === "samples" ? exp.sampleCols : exp.fileCols;
      const n = kind === "samples" ? exp.nSamples : exp.nFiles;
      exportReport[`${kind}.${format}`] = { file, bytes: text.length, rows: rows.length - 1, header: rows[0] };
      check(`export ${kind} ${format}: identical to the filtered data`, text === exp[kind][format], `${text.length} vs ${exp[kind][format].length} characters`);
      check(`export ${kind} ${format}: header and ${n} rows`, JSON.stringify(rows[0]) === JSON.stringify(cols) && rows.length - 1 === n && rows.every((r) => r.length === cols.length), JSON.stringify(rows[0]));
      if (kind === "samples") {
        const first = Object.fromEntries(rows[0].map((h, i) => [h, rows[1][i]]));
        check(`export samples ${format}: values read back correctly`, cols.every((col) => first[col] === exp.firstSample[col]), JSON.stringify(first));
      }
    }
  }
  check("exports follow the filter (Limestone only)", exp.nSamples > 0 && exp.nSamples < 50, `${exp.nSamples} samples, ${exp.nFiles} files`);
  await evaluate(`document.querySelector('input[data-group="rna"]').click(); document.querySelector('#reset-filters').click(); true`);
  results.push({ page, name: "export details", ok: true, detail: JSON.stringify(exportReport) });
  results.push({ page, name: "base map details", ok: true, detail: JSON.stringify(layers) });
}

async function testAbout() {
  if ((await status("about.html")) !== 200) return check("about.html exists", false, String(await status("about.html")));
  await nav("about.html");
  await waitFor(`document.querySelector('#contact-email a')`, 5000);
  await checkCommon("About page");
  await shot("about");
  if (BASIC) return;
  const mail = await json(`(() => { const a = document.querySelector('#contact-email a'); return a ? { href: a.getAttribute('href'), text: a.textContent } : null; })()`);
  check("email link is exactly mailto:" + EMAIL, mail && mail.href === `mailto:${EMAIL}` && mail.text === EMAIL, JSON.stringify(mail));
  const source = await evaluate(`fetch(location.href).then(r => r.text())`);
  check("the plain email address is not in the HTML source", !source.includes(EMAIL) && !/aminghane\s*@\s*univie/.test(source));
  const links = await json(`[...document.querySelectorAll('main a[href]')].map(a => a.href)`);
  for (const want of [
    "https://plantgenomics.univie.ac.at/index.php?id=26086&L=0",
    "https://orcid.org/0000-0002-1035-8650",
    "https://github.com/amnghn/Diospyros-NC-Atlas/issues",
    "https://github.com/amnghn/Diospyros-NC-Atlas/blob/main/CITATION.cff",
    "https://github.com/amnghn/Diospyros-NC-Atlas/blob/main/docs/PROMPT.md",
    "https://github.com/amnghn/Diospyros-NC-Atlas/blob/main/CHANGELOG.md",
  ]) check(`About links to ${want}`, links.includes(want));
  const v = await json(`({ version: document.querySelector('[data-site="version"]')?.textContent ?? '', date: document.querySelector('[data-site="date"]')?.textContent ?? '', cite: document.querySelector('#citation')?.textContent ?? '', site: window.SITE })`);
  check("About shows the version and the date of the last change", v.version === v.site.version && v.date === v.site.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date), JSON.stringify(v));
  check("citation includes the version", v.cite.includes(v.site.version), v.cite);
  check("About link is marked as the current page", await evaluate(`document.querySelector('nav a[aria-current="page"]')?.getAttribute('href') === 'about.html'`));
}

async function test404() {
  if ((await status("404.html")) !== 200) return check("404.html exists", false, String(await status("404.html")));
  await nav("404.html");
  await checkCommon("404 page");
  await shot("404");
  if (BASIC) return;
  const back = await evaluate(`[...document.querySelectorAll('main a')].map(a => a.href).find(h => h === ${JSON.stringify(BASE)}) || ''`);
  check("404 page links back to the map", back === BASE, back);
  check("404 page asks search engines not to index it", await evaluate(`/noindex/.test(document.querySelector('meta[name=robots]')?.content ?? '')`));
  const css = await evaluate(`getComputedStyle(document.querySelector('.site-header')).backgroundColor`);
  check("404 page is styled (style.css loaded)", css !== "rgba(0, 0, 0, 0)", css);
}

// GitHub Pages answers every missing address with 404.html, also in sub-folders. With a server
// that does the same, check that the page is styled there and that its links still work.
async function testNested404() {
  const url = new URL("no/such/folder/page", BASE).href;
  await nav("no/such/folder/page");
  page = "missing address";
  const r = await json(`({ title: document.title, css: getComputedStyle(document.querySelector('.site-header')).backgroundColor,
    back: [...document.querySelectorAll('main a')].map(a => a.href), about: document.querySelector('nav a[href="about.html"]')?.href ?? '',
    version: document.querySelector('.site-footer [data-site="version"]')?.textContent ?? '' })`);
  check(`missing address ${url} shows the 404 page`, /not found/i.test(r.title), r.title);
  check("404 page in a sub-folder is styled", r.css !== "rgba(0, 0, 0, 0)", r.css);
  check("404 page in a sub-folder links back to the map", r.back.includes(BASE), JSON.stringify(r.back));
  check("404 page in a sub-folder links to the About page", r.about === new URL("about.html", BASE).href, r.about);
  check("404 page in a sub-folder shows the version (scripts loaded)", r.version !== "", r.version);
  await shot("404_nested");
}

async function makeImages() {
  if (args.og) {
    await send("browsingContext.setViewport", { context: ctx, viewport: { width: 1200, height: 630 } });
    await nav("");
    await waitFor(`document.querySelectorAll('.leaflet-marker-icon').length === 50`);
    // For this image only: shorten the map so that it ends inside the 630 px frame and the
    // map attribution (© OpenStreetMap contributors) stays visible.
    await evaluate(`(() => { const m = document.querySelector('#map'); m.style.height = (innerHeight - m.getBoundingClientRect().top - 14) + 'px'; map.invalidateSize(); zoomToResults(state.samples); return true; })()`);
    await sleep(500);
    await waitFor(`document.querySelectorAll('img.leaflet-tile').length > 0 && !document.querySelector('img.leaflet-tile:not(.leaflet-tile-loaded)')`, 20000);
    await sleep(800);
    console.log("Open Graph image:", await shot(resolve(args.og), "viewport"));
  }
  if (args.screenshot) {
    await send("browsingContext.setViewport", { context: ctx, viewport: { width: 1440, height: 900 } });
    await nav("");
    await waitFor(`document.querySelectorAll('.leaflet-marker-icon').length === 50`);
    await waitFor(`document.querySelectorAll('img.leaflet-tile').length > 0 && !document.querySelector('img.leaflet-tile:not(.leaflet-tile-loaded)')`, 20000);
    await sleep(800);
    console.log("README screenshot:", await shot(resolve(args.screenshot), "viewport"));
  }
}

let fatal = null;
try {
  ws = await connect();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      const w = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.type === "error" || msg.error) w.rej(new Error(`${w.method}: ${msg.error} ${msg.message ?? ""}`));
      else w.res(msg.result);
    } else if (msg.method === "log.entryAdded") {
      const e = msg.params;
      logs.push({ page, level: e.level, type: e.type, text: e.text });
    }
  };
  await send("session.new", { capabilities: {} });
  await send("session.subscribe", { events: ["log.entryAdded"] });
  ctx = (await send("browsingContext.getTree", {})).contexts[0].context;
  await send("browsingContext.setViewport", { context: ctx, viewport: { width: W, height: H } });
  await testIndex();
  await testAbout();
  await test404();
  if (args["pages-404"]) await testNested404();
  await makeImages();
  await send("session.end", {}).catch(() => {});
} catch (e) {
  fatal = String(e?.stack ?? e);
} finally {
  try {
    ws?.close();
  } catch {}
  ff.kill("SIGTERM");
  await sleep(500);
  if (!ff.killed) ff.kill("SIGKILL");
}
const errors = logs.filter((l) => l.level === "error");
const failed = results.filter((r) => !r.ok);
const report = { url: BASE, viewport: [W, H], basic: BASIC, firefox: (ffLog.match(/Mozilla Firefox[^\n]*/) ?? [""])[0], results, logs, fatal };
writeFileSync(join(OUT, `report_${W}.json`), JSON.stringify(report, null, 2));
console.log(`Width ${W} px: ${results.filter((r) => r.ok).length} checks passed, ${failed.length} failed; console errors: ${errors.length}${fatal ? `; FATAL: ${fatal}` : ""}`);
for (const e of errors) console.log(`  console error [${e.page}]: ${e.text}`);
console.log(`Report: ${join(OUT, `report_${W}.json`)}`);
process.exit(fatal || failed.length || errors.length ? 1 : 0);
