# Diospyros of New Caledonia — sample atlas

An interactive map and data browser for *Diospyros* (Ebenaceae) samples collected in New Caledonia:
GPS coordinates, DNA, RNA and soil data for every sample, the paths and MD5 sums of the Illumina and
PacBio HiFi FASTQ files, species photos, and one genome assembly per species with its reference sample marked.

> **The data currently in this repository are simulated.** Species names are real; every sample,
> coordinate, measurement, file path and MD5 sum is made up by `scripts/simulate_data.py`.

## Features

- Map of all samples (street, topographic and satellite base maps); reference-genome samples are drawn as stars.
- Filter by species, soil type, province, data availability (RNA-seq, HiFi, reference) and free text.
- Colour the map by species or by soil type.
- Sample table with column groups (Location, Soil, DNA, RNA) that can be switched on and off, sortable by any column.
- Export the filtered samples, or the FASTQ paths + MD5 sums of the filtered samples, as CSV or TSV.
- Click a sample for its full record and file list; species cards show the photo and assembly statistics.

## Run locally

It is a static site with no build step, but the data are loaded with `fetch`, so it must be served over HTTP
(opening `index.html` straight from disk will not work):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Data

Everything the site shows comes from three tab-separated files in `data/`:

| File | One row per | Key columns |
| --- | --- | --- |
| `species.tsv` | species | `species_id`, `species`, `color`, `reference_sample_id`, assembly name / path / MD5 / statistics, `photo`, `photo_credit` |
| `samples.tsv` | sample | `sample_id`, `species_id`, `is_reference`, `latitude`, `longitude`, locality, soil, DNA and RNA columns |
| `files.tsv` | FASTQ file | `sample_id`, `data_type` (DNA/RNA), `platform` (Illumina / PacBio HiFi), `read`, `path`, `size_gb`, `md5` |

To use real data, replace these files keeping the same column names, and put the species photos in
`assets/photos/` (set the `photo` column to their paths). Values must not contain tabs. New soil types,
provinces or species appear in the filters automatically. To add or rename columns shown in the table,
edit `COLUMN_GROUPS` and `LABELS` at the top of `js/app.js`.

To regenerate the simulated dataset:

```bash
python3 scripts/simulate_data.py
```

## Publish with GitHub Pages

Push the repository to GitHub, then in *Settings → Pages* choose *Deploy from a branch*, branch `main`,
folder `/ (root)`. Set `REPO_URL` at the top of `js/app.js` to show a GitHub link in the header.

Note that a public site exposes everything in `data/`, including exact GPS coordinates and server file paths.

## Credits and licence

Code: MIT licence (see `LICENSE`). Maps: [Leaflet](https://leafletjs.com), © OpenStreetMap contributors,
OpenTopoMap (CC-BY-SA), Esri World Imagery.
