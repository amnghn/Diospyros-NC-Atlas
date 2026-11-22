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
