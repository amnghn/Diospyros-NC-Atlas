'use strict';

/* ---------- Configuration ---------- */

// Set this to the GitHub repository URL to show a "GitHub" link in the header.
const REPO_URL = '';

const DATA_FILES = {
  species: 'data/species.tsv',
  samples: 'data/samples.tsv',
  files: 'data/files.tsv',
};

// Columns always shown in the table and always included in sample exports.
const CORE_COLUMNS = ['sample_id', 'species', 'is_reference'];

// Column groups that can be switched on and off above the table.
const COLUMN_GROUPS = [
  { id: 'location', label: 'Location', on: true,
    columns: ['locality', 'province', 'latitude', 'longitude', 'elevation_m', 'habitat', 'collection_date'] },
  { id: 'soil', label: 'Soil', on: true,
    columns: ['soil_type', 'soil_ph', 'soil_ni_mg_kg', 'soil_cr_mg_kg', 'soil_ca_mg_ratio', 'soil_organic_matter_pct'] },
  { id: 'dna', label: 'DNA', on: false,
    columns: ['dna_conc_ng_ul', 'dna_a260_280', 'illumina_depth_x', 'hifi_available', 'hifi_depth_x'] },
  { id: 'rna', label: 'RNA', on: false,
    columns: ['rna_available', 'rna_tissue', 'rna_rin', 'rna_conc_ng_ul', 'rna_reads_million'] },
];

const LABELS = {
  sample_id: 'Sample', species: 'Species', is_reference: 'Reference',
  locality: 'Locality', province: 'Province', latitude: 'Latitude', longitude: 'Longitude',
  elevation_m: 'Elevation (m)', habitat: 'Habitat', collection_date: 'Collected',
  soil_type: 'Soil type', soil_ph: 'Soil pH', soil_ni_mg_kg: 'Ni (mg/kg)', soil_cr_mg_kg: 'Cr (mg/kg)',
  soil_ca_mg_ratio: 'Ca:Mg', soil_organic_matter_pct: 'Organic matter (%)',
  dna_conc_ng_ul: 'DNA (ng/µL)', dna_a260_280: 'A260/280', illumina_depth_x: 'Illumina depth (×)',
  hifi_available: 'HiFi', hifi_depth_x: 'HiFi depth (×)',
  rna_available: 'RNA-seq', rna_tissue: 'RNA tissue', rna_rin: 'RIN', rna_conc_ng_ul: 'RNA (ng/µL)',
  rna_reads_million: 'RNA reads (M)',
};

// Facets shown as checkbox lists in the filter panel.
const FACETS = [
  { key: 'species_id', label: 'Species' },
  { key: 'soil_type', label: 'Soil type' },
  { key: 'province', label: 'Province' },
];

const SOIL_COLORS = {
  'Ultramafic (peridotite)': '#a63d2f',
  'Serpentinite': '#2f8f83',
  'Limestone': '#4a78c2',
  'Schist': '#7b5ea7',
  'Volcano-sedimentary': '#c58a1e',
};
const FALLBACK_COLORS = ['#1b7f5c', '#d1603d', '#3a6ea5', '#8e4a9e', '#c9a227', '#5c6b73', '#b0457a', '#6a8f2a'];

/* ---------- State ---------- */

const state = {
  samples: [],
  species: new Map(),      // species_id -> species row
  filesBySample: new Map(),
  facetFilters: {},        // facet key -> Set of selected values
  flags: { rna: false, hifi: false, ref: false },
  query: '',
  visibleGroups: new Set(COLUMN_GROUPS.filter(g => g.on).map(g => g.id)),
  colorBy: 'species_id',
  sort: { column: 'sample_id', dir: 1 },
  selected: null,
};

let map, markerLayer, legendEl;
const fallbackAssigned = new Map();

/* ---------- Helpers ---------- */

const $ = sel => document.querySelector(sel);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseTSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
  const header = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const cells = line.split('\t');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

function toDelimited(rows, columns, sep) {
  const needsQuote = sep === ',' ? /[",\n]/ : /["\t\n]/;
  const cell = v => {
    const s = String(v ?? '');
    return needsQuote.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(sep), ...rows.map(r => columns.map(c => cell(r[c])).join(sep))].join('\n') + '\n';
}

function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fallbackColor(value) {
  if (!fallbackAssigned.has(value)) {
    fallbackAssigned.set(value, FALLBACK_COLORS[fallbackAssigned.size % FALLBACK_COLORS.length]);
  }
  return fallbackAssigned.get(value);
}

function colorFor(key, value) {
  if (key === 'species_id') return state.species.get(value)?.color || fallbackColor(value);
  if (key === 'soil_type') return SOIL_COLORS[value] || fallbackColor(value);
  return null;
}

function facetLabel(key, value) {
  return key === 'species_id' ? (state.species.get(value)?.species || value) : value;
}

function uniqueValues(key) {
  return [...new Set(state.samples.map(s => s[key]))].sort((a, b) => a.localeCompare(b));
}

function visibleColumns() {
  return [...CORE_COLUMNS, ...COLUMN_GROUPS.filter(g => state.visibleGroups.has(g.id)).flatMap(g => g.columns)];
}

/* ---------- Filtering ---------- */

function passes(s) {
  for (const { key } of FACETS) {
    if (!state.facetFilters[key].has(s[key])) return false;
  }
  if (state.flags.rna && s.rna_available !== 'yes') return false;
  if (state.flags.hifi && s.hifi_available !== 'yes') return false;
  if (state.flags.ref && s.is_reference !== 'yes') return false;
  if (state.query) {
    const haystack = [s.sample_id, s.species, s.locality, s.province, s.habitat, s.soil_type, s.rna_tissue]
      .join(' ').toLowerCase();
    if (!haystack.includes(state.query)) return false;
  }
  return true;
}

function filteredSamples() {
  const { column, dir } = state.sort;
  return state.samples.filter(passes).sort((a, b) => {
    const x = a[column], y = b[column];
    if (x === '' || y === '') return (x === '') - (y === '');   // blanks last
    const nx = Number(x), ny = Number(y);
    const cmp = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y);
    return cmp * dir;
  });
}

/* ---------- Filter panel ---------- */

function renderFacets() {
  $('#facets').innerHTML = FACETS.map(({ key, label }) => {
    const options = uniqueValues(key).map(value => {
      const count = state.samples.filter(s => s[key] === value).length;
      const color = colorFor(key, value);
      const swatch = color ? `<span class="swatch" style="background:${esc(color)}"></span>` : '';
      const text = key === 'species_id' ? `<span class="sci">${esc(facetLabel(key, value))}</span>` : esc(value);
      return `<label><input type="checkbox" data-facet="${key}" value="${esc(value)}" checked>${swatch}${text}<span class="count">${count}</span></label>`;
    }).join('');
    return `<fieldset class="facet"><legend>${label}
      <span class="facet-actions"><button type="button" data-facet-all="${key}">all</button><button type="button" data-facet-none="${key}">none</button></span>
      </legend>${options}</fieldset>`;
  }).join('');
}

function syncFacetCheckboxes() {
  document.querySelectorAll('input[data-facet]').forEach(box => {
    box.checked = state.facetFilters[box.dataset.facet].has(box.value);
  });
  document.querySelectorAll('input[data-flag]').forEach(box => { box.checked = state.flags[box.dataset.flag]; });
  $('#search').value = state.query;
}

function resetFilters() {
  for (const { key } of FACETS) state.facetFilters[key] = new Set(uniqueValues(key));
  state.flags = { rna: false, hifi: false, ref: false };
  state.query = '';
  syncFacetCheckboxes();
}

/* ---------- Map ---------- */

function initMap() {
  map = L.map('map', { scrollWheelZoom: true }).fitBounds([[-22.85, 163.6], [-19.95, 168.2]]);
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  });
  const imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18, attribution: 'Imagery &copy; Esri and its data providers',
  });
  L.control.layers({ 'Street map': osm, 'Topographic': topo, 'Satellite': imagery }, null, { position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    legendEl = L.DomUtil.create('div', 'legend');
    L.DomEvent.disableClickPropagation(legendEl);
    return legendEl;
  };
  legend.addTo(map);
}

function markerIcon(sample) {
  const color = colorFor(state.colorBy, sample[state.colorBy]);
  const isRef = sample.is_reference === 'yes';
  const size = isRef ? 28 : 18;
  const shape = isRef
    ? `<path d="M12 1.6l3.2 6.6 7.2 1-5.2 5 1.2 7.2L12 18l-6.4 3.4 1.2-7.2-5.2-5 7.2-1z" fill="${color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`
    : `<circle cx="12" cy="12" r="8.5" fill="${color}" stroke="#fff" stroke-width="2.5"/>`;
  return L.divIcon({
    className: 'mk' + (sample.sample_id === state.selected ? ' mk-selected' : ''),
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${shape}</svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function renderMap(rows) {
  markerLayer.clearLayers();
  for (const s of rows) {
    const isRef = s.is_reference === 'yes';
    L.marker([Number(s.latitude), Number(s.longitude)], {
      icon: markerIcon(s),
      title: s.sample_id,
      zIndexOffset: (isRef ? 1000 : 0) + (s.sample_id === state.selected ? 2000 : 0),
    })
      .bindTooltip(`<strong>${esc(s.sample_id)}</strong>${isRef ? ' ★ reference' : ''}<br><em>${esc(s.species)}</em><br>${esc(s.locality)} · ${esc(s.soil_type)}`, { direction: 'top', offset: [0, -8] })
      .on('click', () => selectSample(s.sample_id, false))
      .addTo(markerLayer);
  }
}

function renderLegend(rows) {
  const key = state.colorBy;
  const present = new Set(rows.map(s => s[key]));
  const items = uniqueValues(key).filter(v => present.has(v)).map(v => {
    const text = key === 'species_id' ? `<em>${esc(facetLabel(key, v))}</em>` : esc(v);
    return `<div><span class="swatch" style="background:${esc(colorFor(key, v))}"></span>${text}</div>`;
  }).join('');
  legendEl.innerHTML = `${items || '<div>No samples shown</div>'}<hr><div><span class="star">★</span>Reference genome sample</div>`;
}

function zoomToResults(rows) {
  if (!rows.length) return;
  const bounds = L.latLngBounds(rows.map(s => [Number(s.latitude), Number(s.longitude)]));
  map.fitBounds(bounds.pad(0.15), { maxZoom: 12 });
}

/* ---------- Table ---------- */

function renderColumnToggles() {
  $('#column-toggles').innerHTML = COLUMN_GROUPS.map(g =>
    `<label><input type="checkbox" data-group="${g.id}" ${state.visibleGroups.has(g.id) ? 'checked' : ''}>${g.label}</label>`
  ).join('');
}

function cellHTML(sample, column) {
  const value = sample[column];
  if (column === 'species') return `<td class="sci">${esc(value)}</td>`;
  if (column === 'is_reference') return `<td>${value === 'yes' ? '<span class="badge">★ reference</span>' : ''}</td>`;
  if (column === 'soil_type') {
    return `<td><span class="swatch" style="background:${esc(colorFor('soil_type', value))}"></span> ${esc(value)}</td>`;
  }
  const numeric = value !== '' && Number.isFinite(Number(value));
  return `<td${numeric ? ' class="num"' : ''}>${esc(value)}</td>`;
}

function renderTable(rows) {
  const columns = visibleColumns();
  $('#sample-table thead').innerHTML = '<tr>' + columns.map(c => {
    const arrow = state.sort.column === c ? `<span class="arrow">${state.sort.dir === 1 ? '▲' : '▼'}</span>` : '';
    return `<th data-column="${c}" scope="col">${esc(LABELS[c] || c)}${arrow}</th>`;
  }).join('') + '</tr>';
  $('#sample-table tbody').innerHTML = rows.map(s =>
    `<tr data-id="${esc(s.sample_id)}"${s.sample_id === state.selected ? ' class="selected"' : ''}>${columns.map(c => cellHTML(s, c)).join('')}</tr>`
  ).join('');
  $('#empty').hidden = rows.length > 0;
}

function renderSummary(rows) {
  const nSpecies = new Set(rows.map(s => s.species_id)).size;
  const nFiles = rows.reduce((n, s) => n + (state.filesBySample.get(s.sample_id)?.length || 0), 0);
  $('#summary').innerHTML =
    `Showing <strong>${rows.length}</strong> of ${state.samples.length} samples · <strong>${nSpecies}</strong> species · <strong>${nFiles}</strong> FASTQ files`;
}

/* ---------- Detail drawer ---------- */

function kv(pairs) {
  return '<dl class="kv">' + pairs.filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + '</dl>';
}

function renderDetail() {
  const panel = $('#detail');
  const s = state.samples.find(x => x.sample_id === state.selected);
  if (!s) { panel.hidden = true; return; }
  const sp = state.species.get(s.species_id) || {};
  const files = state.filesBySample.get(s.sample_id) || [];
  const isRef = s.is_reference === 'yes';

  const fileHTML = files.map(f => `
    <div class="file">
      <div class="meta"><strong>${esc(f.data_type)} · ${esc(f.platform)} · ${esc(f.read)}</strong><span>${esc(f.size_gb)} GB</span></div>
      <div class="path">${esc(f.path)}</div>
      <div class="md5">MD5 ${esc(f.md5)}</div>
    </div>`).join('');

  $('#detail-body').innerHTML = `
    <h3>${esc(s.sample_id)} ${isRef ? '<span class="badge">★ reference</span>' : ''}</h3>
    <p class="sub"><em>${esc(s.species)}</em></p>
    ${sp.photo ? `<img src="${esc(sp.photo)}" alt="${esc(s.species)}">` : ''}
    <h4>Location</h4>
    ${kv([['Locality', s.locality], ['Province', s.province], ['Latitude', s.latitude], ['Longitude', s.longitude],
          ['Elevation', s.elevation_m && s.elevation_m + ' m'], ['Habitat', s.habitat], ['Collected', s.collection_date]])}
    <h4>Soil</h4>
    ${kv([['Soil type', s.soil_type], ['pH', s.soil_ph], ['Ni', s.soil_ni_mg_kg && s.soil_ni_mg_kg + ' mg/kg'],
          ['Cr', s.soil_cr_mg_kg && s.soil_cr_mg_kg + ' mg/kg'], ['Ca:Mg ratio', s.soil_ca_mg_ratio],
          ['Organic matter', s.soil_organic_matter_pct && s.soil_organic_matter_pct + ' %']])}
    <h4>DNA</h4>
    ${kv([['Concentration', s.dna_conc_ng_ul && s.dna_conc_ng_ul + ' ng/µL'], ['A260/280', s.dna_a260_280],
          ['Illumina depth', s.illumina_depth_x && s.illumina_depth_x + '×'], ['HiFi reads', s.hifi_available],
          ['HiFi depth', s.hifi_depth_x && s.hifi_depth_x + '×']])}
    <h4>RNA</h4>
    ${s.rna_available === 'yes'
      ? kv([['Tissue', s.rna_tissue], ['RIN', s.rna_rin], ['Concentration', s.rna_conc_ng_ul + ' ng/µL'], ['Reads', s.rna_reads_million + ' M']])
      : '<p class="hint">No RNA-seq for this sample.</p>'}
    <h4>Genome assembly</h4>
    ${isRef
      ? `<p>This sample is the reference for <strong>${esc(sp.assembly_name)}</strong>.</p>`
      : `<p>Reference for this species: <button type="button" class="link-btn" data-goto="${esc(sp.reference_sample_id)}">${esc(sp.reference_sample_id)}</button> (${esc(sp.assembly_name)})</p>`}
    <h4>Sequencing files (${files.length})</h4>
    ${fileHTML || '<p class="hint">No files recorded.</p>'}`;
  panel.hidden = false;
}

function selectSample(id, flyTo) {
  state.selected = id;
  const s = state.samples.find(x => x.sample_id === id);
  if (s && !passes(s)) resetFilters();   // make sure the selected sample is visible
  render();
  if (s && flyTo) map.flyTo([Number(s.latitude), Number(s.longitude)], Math.max(map.getZoom(), 11), { duration: 0.6 });
}

/* ---------- Species cards ---------- */

function renderSpeciesCards() {
  $('#species-cards').innerHTML = [...state.species.values()].map(sp => {
    const samples = state.samples.filter(s => s.species_id === sp.species_id);
    const soils = [...new Set(samples.map(s => s.soil_type))].sort().join(', ');
    return `<article class="card">
      <img src="${esc(sp.photo)}" alt="${esc(sp.species)}" loading="lazy">
      <div class="card-body">
        <h3><span class="swatch" style="background:${esc(sp.color)}"></span>${esc(sp.species)}</h3>
        <p class="credit">Photo: ${esc(sp.photo_credit)}</p>
        ${kv([['Samples', samples.length], ['Soil types', soils], ['Assembly', sp.assembly_name],
              ['Genome size', sp.genome_size_mb + ' Mb'], ['Contigs', sp.n_contigs],
              ['Contig N50', sp.contig_n50_mb + ' Mb'], ['BUSCO complete', sp.busco_complete_pct + ' %'],
              ['Reference sample', '★ ' + sp.reference_sample_id]])}
        <div class="path">${esc(sp.assembly_path)}<br>MD5 ${esc(sp.assembly_md5)}</div>
        <div class="card-actions">
          <button type="button" data-show-species="${esc(sp.species_id)}">Show on map</button>
          <button type="button" data-goto="${esc(sp.reference_sample_id)}">Go to reference sample</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

/* ---------- Export ---------- */

function exportData(kind, format) {
  const rows = filteredSamples();
  const sep = format === 'csv' ? ',' : '\t';
  const mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'text/tab-separated-values;charset=utf-8';
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'samples') {
    download(`diospyros_samples_${stamp}.${format}`, toDelimited(rows, visibleColumns(), sep), mime);
  } else {
    const fileRows = rows.flatMap(s => (state.filesBySample.get(s.sample_id) || []).map(f => ({ ...f, species: s.species })));
    const columns = ['sample_id', 'species', 'data_type', 'platform', 'read', 'path', 'size_gb', 'md5'];
    download(`diospyros_fastq_files_${stamp}.${format}`, toDelimited(fileRows, columns, sep), mime);
  }
}

/* ---------- Render + events ---------- */

function render() {
  const rows = filteredSamples();
  renderSummary(rows);
  renderMap(rows);
  renderLegend(rows);
  renderTable(rows);
  renderDetail();
}

function bindEvents() {
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.facet) {
      const set = state.facetFilters[t.dataset.facet];
      t.checked ? set.add(t.value) : set.delete(t.value);
    } else if (t.dataset.flag) {
      state.flags[t.dataset.flag] = t.checked;
    } else if (t.dataset.group) {
      t.checked ? state.visibleGroups.add(t.dataset.group) : state.visibleGroups.delete(t.dataset.group);
    } else if (t.id === 'color-by') {
      state.colorBy = t.value;
    } else return;
    render();
  });

  $('#search').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); render(); });

  document.addEventListener('click', e => {
    const t = e.target.closest('button, th, tr');
    if (!t) return;
    const d = t.dataset;
    if (d.facetAll || d.facetNone) {
      const key = d.facetAll || d.facetNone;
      state.facetFilters[key] = new Set(d.facetAll ? uniqueValues(key) : []);
      syncFacetCheckboxes();
      render();
    } else if (d.export) {
      exportData(d.export, d.format);
    } else if (d.goto) {
      selectSample(d.goto, true);
      $('#explorer').scrollIntoView({ behavior: 'smooth' });
    } else if (d.showSpecies) {
      resetFilters();
      state.facetFilters.species_id = new Set([d.showSpecies]);
      syncFacetCheckboxes();
      render();
      zoomToResults(filteredSamples());
      $('#explorer').scrollIntoView({ behavior: 'smooth' });
    } else if (t.id === 'reset-filters') {
      resetFilters();
      render();
    } else if (t.id === 'zoom-results') {
      zoomToResults(filteredSamples());
    } else if (t.id === 'detail-close') {
      state.selected = null;
      render();
    } else if (t.tagName === 'TH' && d.column) {
      state.sort = { column: d.column, dir: state.sort.column === d.column ? -state.sort.dir : 1 };
      render();
    } else if (t.tagName === 'TR' && d.id) {
      selectSample(d.id, true);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.selected) { state.selected = null; render(); }
  });
}

async function loadTable(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return parseTSV(await response.text());
}

async function main() {
  if (REPO_URL) {
    const link = $('#repo-link');
    link.href = REPO_URL;
    link.hidden = false;
  }
  try {
    const [species, samples, files] = await Promise.all(Object.values(DATA_FILES).map(loadTable));
    state.samples = samples;
    species.forEach(sp => state.species.set(sp.species_id, sp));
    for (const f of files) {
      if (!state.filesBySample.has(f.sample_id)) state.filesBySample.set(f.sample_id, []);
      state.filesBySample.get(f.sample_id).push(f);
    }
  } catch (err) {
    $('main').innerHTML = `<p class="error"><strong>Could not load the data files.</strong> ${esc(err.message)}<br>
      If you opened index.html directly from disk, start a local web server instead
      (<code>python3 -m http.server</code>) — browsers block data loading from <code>file://</code> pages.</p>`;
    return;
  }
  for (const { key } of FACETS) state.facetFilters[key] = new Set(uniqueValues(key));
  initMap();
  renderFacets();
  renderColumnToggles();
  renderSpeciesCards();
  bindEvents();
  render();
  zoomToResults(state.samples);
}

main();
