# Changelog

All notable changes to this project are recorded in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) with a `-beta` suffix.
Every entry has an ISO 8601 timestamp in Vienna time (`TZ=Europe/Vienna date -Iminutes`), says briefly what changed, and lists the files that changed.

## [0.1.0-beta] – unreleased

Version 0.1.0-beta is the first public version. The entries below are in time order. The version is tagged `v0.1.0-beta` when it is ready to publish.

### 2026-11-16T21:55+01:00 | First version (laptop)

The first commit (`60d1b40`), built on a laptop from the prompt in `docs/PROMPT.md` ("Prompt for version 0.1.0 (laptop)").

#### Added
- A static single-page site: a Leaflet map of New Caledonia with every sample (reference samples as stars), filters by species, soil type, province, data availability and free text, colouring by species or soil type, a sortable sample table with column groups that can be switched on and off, a detail drawer per sample, species cards with assembly statistics, and CSV/TSV export of the filtered samples and of their FASTQ paths and MD5 sums.
- A simulated dataset (5 species, 10 samples each, 185 FASTQ files) and placeholder species drawings, written by `scripts/simulate_data.py` with a fixed seed (42).
- **Files:** `index.html`, `css/style.css`, `js/app.js`, `data/species.tsv`, `data/samples.tsv`, `data/files.tsv`, `assets/photos/*.svg`, `scripts/simulate_data.py`, `README.md`, `LICENSE`, `.gitignore`.

### 2026-11-22T18:07+01:00 | Build prompts, changelog, and rules against committing private data

#### Added
- `docs/PROMPT.md`: the prompt for this round, exactly as given, followed by the prompt that built the first version and a section for follow-up instructions.
- `CHANGELOG.md` (this file).
- `.gitignore`: folders and file names where real data might be placed by mistake (`private/`, `data/real/`, `data_private/`, `*.private.*`), raw sequencing and assembly files (`*.fastq.gz`, `*.bam`, `*.vcf.gz`, `*.fasta.gz` and others), local tools and previews (`.preview/`, `_site/`, `.venv-*/`, `.tools/`), and the working copy of the prompt (`PROMPT_LiSC.md`).

#### Changed
- `LICENSE`: the copyright holder is now Amin Ghane (was "Diospyros atlas contributors"). The MIT licence text is unchanged.
- The author and committer of the first commit are now the GitHub no-reply address of the author, so that no private email address is published with the history. Dates, message and files are unchanged (new hash `60d1b40`, was `7dac168`).
- **Files:** `docs/PROMPT.md`, `CHANGELOG.md`, `.gitignore`, `LICENSE`.

### 2026-11-22T18:09+01:00 | Data checks

#### Added
- `scripts/check_data.py` (standard library only, Python 3.9 or newer) fails with a clear message, with file and line, if: a column that `js/app.js` needs is missing; a row has the wrong number of cells, or a value contains a tab; a `sample_id` or `species_id` is not unique; a sample or file points to an unknown species or sample; a species does not have exactly one reference sample, or `reference_sample_id` does not match the sample marked `is_reference = yes`; a reference sample has no PacBio HiFi file; an MD5 value is not 32 lowercase hexadecimal characters; coordinates fall outside 23.0–19.5° S, 163.5–168.5° E; or a photo path does not exist.
- Further checks: `js/app.js` uses no sample column that the script does not know; yes/no columns contain only `yes` or `no`; `hifi_available` and `rna_available` agree with `files.tsv`; species names and IDs agree between the tables; colours are `#rrggbb` values (they are written into the page's HTML).
- The check passes on the current data (5 species, 50 samples, 185 files) with Python 3.9 and 3.12. Thirteen deliberately broken copies of the data, one for each rule, all fail with the expected message.
- **Files:** `scripts/check_data.py`, `CHANGELOG.md`.

### 2026-11-22T18:10+01:00 | Description of the simulated data

#### Added
- `data/README.md`: a clear statement that all data are simulated; the rules for what may be committed in `data/` and `assets/photos/`; how `scripts/simulate_data.py` generates the data; the file format; and the meaning and unit of every column of `species.tsv`, `samples.tsv` and `files.tsv`.
- **Files:** `data/README.md`, `CHANGELOG.md`.

### 2026-11-22T18:11+01:00 | Reproducibility guard

#### Added
- `scripts/check_reproducible.sh` proves that the published data are exactly the simulated data. It refuses to run if `data/` or `assets/photos/` have uncommitted changes, so local files are never overwritten. It then re-runs `scripts/simulate_data.py` and fails if `git diff --exit-code -- data assets/photos` shows a difference, if the simulator writes files that are not committed, if a tracked file in these folders is not on its allowlist, or if any tracked file is larger than 5 MB. It uses `python3.12` when available (the version pinned in the workflow).
- The simulator gives byte-identical output on Python 3.9, 3.10, 3.11, 3.12, 3.13 and 3.14 (tested on LiSC). The guard passes on the current repository. Seven deliberately broken copies (uncommitted edit, committed edit, extra committed file, extra file from the simulator, changed seed, file larger than 5 MB, untracked photo) all fail with the expected message.
- **Files:** `scripts/check_reproducible.sh`, `CHANGELOG.md`.

### 2026-11-22T18:12+01:00 | Colourblind-safe colours for species and soil types

#### Fixed
- The old colours were not safe for colour-blind readers. Under simulated deuteranopia, *D. calciphila* (blue) and *D. umbrosa* (purple) were almost identical (smallest colour difference ΔE₀₀ = 2.1), and so were Limestone and Schist (ΔE₀₀ = 4.8).

#### Changed
- Species colours now come from the Okabe & Ito palette, close to the old hues: *D. vieillardii* #009E73 (bluish green), *D. calciphila* #0072B2 (blue), *D. pancheri* #D55E00 (vermillion), *D. umbrosa* #CC79A7 (reddish purple), *D. minimifolia* #E69F00 (orange).
- Soil colours now come from Paul Tol's "muted" palette: Ultramafic (peridotite) #CC6677, Serpentinite #117733, Limestone #88CCEE, Schist #332288, Volcano-sedimentary #DDCC77. Colours for values without a fixed colour use the Okabe & Ito palette.
- Check: the smallest CIEDE2000 difference between two colours, for normal vision and for simulated protanopia, deuteranopia and tritanopia (Machado et al. 2009, full severity). Species: 22.2, 12.2, 12.5 and 10.9 (was 26.9, 6.5, 2.1 and 7.2). Soil types: 39.2, 19.9, 17.6 and 24.2 (was 17.9, 7.5, 4.8 and 7.8).
- The simulated data were regenerated: only the `color` column of `data/species.tsv` and the colours of the placeholder drawings changed. `data/samples.tsv` and `data/files.tsv` are unchanged.
- **Files:** `scripts/simulate_data.py`, `js/app.js`, `data/species.tsv`, `assets/photos/*.svg`, `CHANGELOG.md`.

### 2026-11-22T18:19+01:00 | Accessibility and layout fixes, Leaflet pinned with Subresource Integrity

#### Fixed
- Phone screens: the page no longer scrolls sideways. At 375 px the wide sample table stretched the single layout column to 1735 px; the column is now limited to the screen width (`minmax(0, 1fr)`, as on wide screens) and the table scrolls inside its box.
- Keyboard use of the table: each column header is now a button (sorting works with Enter and Space) and states the sort order to screen readers (`aria-sort`); after sorting, focus stays on the header. Table rows can be reached with Tab and opened with Enter or Space, and show a focus outline.
- Detail drawer: when it opens, focus moves to its heading; when it closes (× button or Escape), focus returns to the row, map marker or button that opened it.
- Screen-reader labels: the "all" and "none" buttons of each filter now say what they do (for example "Select all species", "Clear soil types"); each filter group is named by its title only; the column switches are a labelled group.
- Colours from the data are escaped before they are written into the map markers.
- The page language is British English (`lang="en-GB"`). A "Skip to the map and data" link appears at the top when it receives keyboard focus.

#### Changed
- Leaflet 1.9.4 (CSS and JavaScript from unpkg) is loaded with Subresource Integrity (`integrity`, `crossorigin`). The SHA-256 hashes were computed from the files on unpkg and agree with the hashes published by jsDelivr.
- Checked in headless Firefox at 1440 px and 375 px: no console errors, no horizontal scrolling, and all filter, search, colour, column, sorting, drawer, species-card, base-map and export checks pass (58 checks per width). Both exports, as real downloads, are identical to the filtered data.
- **Files:** `index.html`, `js/app.js`, `css/style.css`, `CHANGELOG.md`.

### 2026-11-22T18:23+01:00 | About page, shared header and footer, version in one place

#### Added
- `about.html`, with the same header, navigation and footer as the map page. It contains: what the site is; who made it (Amin Ghane, Department of Botany and Biodiversity Research, University of Vienna; member of the Plant Ecological Genomics research group led by the supervisor, Ovidiu Paun; links to the group page and the ORCID record); the contact email; an invitation to send feedback by email or through GitHub Issues; the statement that all data are simulated; how to cite (with the version); the licence; the disclaimer; the AI declaration (with links to `docs/PROMPT.md` and `CHANGELOG.md`); credits for Leaflet, OpenStreetMap, OpenTopoMap and Esri World Imagery; and the version with the date of the last change.
- The contact email is put together by JavaScript, so that the plain address is not in the HTML source; without JavaScript the page shows "aminghane [at] univie.ac.at".
- `js/version.js`: the only place the pages read the version (`0.1.0-beta`) and the date of the last change from.
- `js/site.js`: shared by all pages. It holds `REPO_URL` (now set to `https://github.com/amnghn/Diospyros-NC-Atlas`, which shows the GitHub link in the header), and fills in the version, the date and the email link.
- Footer on every page: the version, a one-line disclaimer ("Beta version with simulated data, provided without warranty") and a link to the About page.

#### Changed
- The navigation links to `about.html`; on the About page, "Explorer" and "Species" link back to the map page. `REPO_URL` moved from `js/app.js` to `js/site.js`.
- Map attribution: the topographic map now uses the attribution text requested by OpenTopoMap (map data © OpenStreetMap contributors, SRTM; map style © OpenTopoMap, CC-BY-SA), and the satellite map uses the source text published by the Esri World Imagery service ("Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community") with "Powered by Esri".

#### Removed
- The short About section at the bottom of the map page. Its content moved to `about.html`.
- **Files:** `about.html`, `index.html`, `js/app.js`, `js/site.js`, `js/version.js`, `css/style.css`, `CHANGELOG.md`.

### 2026-11-22T18:25+01:00 | Beta badge, page metadata, preview image and favicon

#### Added
- A small permanent "Beta" badge next to the site title on every page.
- Page metadata: a canonical address, Open Graph tags (title, description, address, preview image with its size and a text alternative, locale) and a Twitter card on the map page and the About page. The descriptions say that the site is a beta version with simulated data.
- `assets/og-image.png` (1200 × 630 px, 190 kB): the preview image for link previews, a screenshot of the map page made with headless Firefox. For this image only, the map was made shorter so that the map attribution (© OpenStreetMap contributors) is inside the frame.
- `favicon.svg`: a simple persimmon (fruit with calyx) in the site's green.
- **Files:** `index.html`, `about.html`, `css/style.css`, `favicon.svg`, `assets/og-image.png`, `CHANGELOG.md`.

### 2026-11-22T18:27+01:00 | 404 page

#### Added
- `404.html`: a simple "Page not found" page with the same header and footer as the other pages and a link back to the map. It asks search engines not to index it.
- GitHub Pages shows this page for every missing address, also in sub-folders. The page therefore sets `<base href="/Diospyros-NC-Atlas/">`, so that its style sheet, scripts and links work at any depth. This is the only place where the repository name is written into a page; it must be changed if the repository is renamed.
- Checked with a local test server that answers missing addresses like GitHub Pages: `/Diospyros-NC-Atlas/no/such/folder/page` shows the styled 404 page with working links, at 1440 px and 375 px.
- **Files:** `404.html`, `CHANGELOG.md`.

### 2026-11-22T18:27+01:00 | Citation file

#### Added
- `CITATION.cff` (Citation File Format 1.2.0), from which GitHub shows a "Cite this repository" button: title "Diospyros of New Caledonia: sample atlas", version 0.1.0-beta, release date, author Amin Ghane (University of Vienna, ORCID 0000-0002-1035-8650), repository and site addresses, MIT licence, abstract and keywords.
- Validated with `cffconvert --validate` (cffconvert 2.0.0, installed in the local environment `.venv-cffconvert/`, which git ignores): "Citation metadata are valid according to schema version 1.2.0". A copy with a malformed ORCID fails, as expected.
- **Files:** `CITATION.cff`, `CHANGELOG.md`.

### 2026-11-22T18:29+01:00 | Site checks and the list of published files

#### Added
- `scripts/site_files.txt`: the files and folders that are published on GitHub Pages (`index.html`, `about.html`, `404.html`, `favicon.svg`, `LICENSE`, `css/`, `js/`, `data/`, `assets/`). The workflow copies exactly these paths.
- `scripts/check_site.py` (standard library only) fails with a clear message if: a page has no title, no description or a language other than en-GB; a page uses an absolute local path, a missing file or a file that is not published (the only exception is `<base>` in `404.html`); the Open Graph image or the canonical address points to a missing file; a script or style sheet from another server has no integrity hash or no `crossorigin`; a plain email address appears in a page; a page lacks the Beta badge, the footer version, the link to the About page or the shared scripts; the version differs between `js/version.js`, `CITATION.cff` and `CHANGELOG.md`; or `scripts/`, `docs/` or `.github/` would be published.
- The check passes with Python 3.9 and 3.12. Eleven deliberately broken copies, one for each rule, all fail with the expected message.
- **Files:** `scripts/check_site.py`, `scripts/site_files.txt`, `CHANGELOG.md`.

### 2026-11-22T18:31+01:00 | GitHub Actions workflow for GitHub Pages, issue templates

#### Added
- `.github/workflows/pages.yml` (prepared, not run). It runs on every push to `main` and by hand (`workflow_dispatch`). The **check** job sets up Python 3.12 (the same minor version as `python3.12` on LiSC) and runs `scripts/check_data.py`, `scripts/check_site.py` and the reproducibility guard. The **deploy** job runs only if the check job passes: it copies exactly the paths in `scripts/site_files.txt` into `_site/` and publishes them with `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5` and `actions/deploy-pages@v5`. Permissions are minimal (read-only by default; `pages: write` and `id-token: write` only for the deploy job), and a `concurrency` group allows one deployment at a time.
- Action versions are the latest major releases on 2026-11-22, read from the GitHub API (checkout 7.0.1, setup-python 7.1.0, configure-pages 6.0.0, upload-pages-artifact 5.0.0, deploy-pages 5.0.1); the inputs used were checked in each action's `action.yml`.
- `.github/ISSUE_TEMPLATE/bug_report.md` and `.github/ISSUE_TEMPLATE/suggestion.md`.
- Checks: `actionlint` 1.7.12 (checksum-verified download in `.tools/`, which git ignores) finds no problems; shellcheck is not installed on LiSC, so the shell commands inside the workflow were not linted. The deploy step was repeated on LiSC from a clean export of the last commit: the resulting site (19 files, 328 kB) passes all 100 browser checks at 1440 px and 375 px, and `scripts/`, `docs/`, `.github/` and `CHANGELOG.md` are not published.
- **Files:** `.github/workflows/pages.yml`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/suggestion.md`, `CHANGELOG.md`.
