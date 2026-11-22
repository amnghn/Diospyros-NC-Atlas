# Data of the atlas (simulated)

**All data in this folder are simulated.** The species names are real. Every sample, coordinate, measurement, file path and MD5 sum is made up by `scripts/simulate_data.py`. The data exist only so that the website can be designed and tested. They must not be used for research. The real data are not public.

## Rules

- Only the output of `scripts/simulate_data.py` may be committed in `data/` and `assets/photos/`. The only other file allowed here is this `README.md`.
- The reproducibility guard (`bash scripts/check_reproducible.sh`) proves this. It runs on LiSC and in the GitHub Actions workflow. It re-runs the simulator and fails if the committed files differ from its output, if new files appear, or if a file not on its allowlist is committed in these folders.
- Real data must never be placed here. The folders `private/`, `data/real/`, `data_private/` and files named `*.private.*` are ignored by git (see `.gitignore`). However, they are a safety net, not a place to store real data in this repository.

## How the data are generated

```bash
python3 scripts/simulate_data.py
```

The script uses only the Python standard library and a fixed random seed (42). It therefore writes exactly the same files every time, on any Python version from 3.9 to 3.14 (tested; the workflow uses Python 3.12). It writes:

- `data/species.tsv`: 5 species;
- `data/samples.tsv`: 10 samples per species (50 samples);
- `data/files.tsv`: one row per FASTQ file (185 files);
- `assets/photos/*.svg`: one placeholder drawing per species.

How the values are made:

- Each species is assigned a few real New Caledonian localities (approximate centre coordinates, elevation range, soil type and habitat). Its 10 samples visit every one of these localities at least once. The remaining samples are drawn at random from the same localities.
- Coordinates are the locality centre plus a random offset of up to ±0.008° in latitude and longitude.
- Soil values are drawn from fixed ranges for each soil type. For example, ultramafic soils have high nickel and chromium and a low Ca:Mg ratio.
- One random sample per species is the reference sample. Only the reference samples have PacBio HiFi reads. All reference samples, and about 70 % of the other samples, have RNA-seq data.
- Every sample has paired Illumina DNA reads (R1 and R2). Samples with RNA-seq also have paired Illumina RNA reads.
- File paths point to a fictitious storage folder (`/data/diospyros/...`). Each "MD5 sum" is the MD5 hash of the text `42:<path>`, not of a real file.

## File format

- Tab-separated values, UTF-8, Unix line ends (LF), one header line.
- Values must not contain tabs. An empty value means "not available" or "not applicable".
- `scripts/check_data.py` checks the format, the links between the tables and the value rules described below.

## `species.tsv`: one row per species

| Column | Meaning | Unit or format |
| --- | --- | --- |
| `species_id` | Short species code, unique (for example `DVIE`) | text |
| `species` | Scientific name | text |
| `color` | Colour of the species on the map, in the legend and in the filters | `#rrggbb` |
| `reference_sample_id` | The sample from which the genome assembly was built. It must be the only sample of this species with `is_reference = yes`, and it must have a PacBio HiFi file | `sample_id` |
| `assembly_name` | Name and version of the genome assembly | text |
| `assembly_path` | Path of the assembly FASTA file on the storage server | path |
| `assembly_md5` | MD5 sum of the assembly file | 32 lowercase hexadecimal characters |
| `genome_size_mb` | Total length of the assembly | Mb (10⁶ base pairs) |
| `n_contigs` | Number of contigs | count |
| `contig_n50_mb` | Contig N50 | Mb |
| `busco_complete_pct` | Complete BUSCO genes | % |
| `photo` | Photo of the species, relative to the site root (for now, placeholder drawings) | path |
| `photo_credit` | Credit line shown with the photo | text |

## `samples.tsv`: one row per sample

| Column | Meaning | Unit or format |
| --- | --- | --- |
| `sample_id` | Sample code, unique: `<species_id>_<number>` | text |
| `species_id` | Species of the sample (see `species.tsv`) | `species_id` |
| `species` | Scientific name; must match `species.tsv` | text |
| `is_reference` | Whether the genome assembly of the species was built from this sample | `yes` / `no` |
| `collection_date` | Date of collection | ISO 8601 date, `YYYY-MM-DD` |
| `locality` | Place of collection | text |
| `province` | Province of New Caledonia: Sud, Nord or Îles Loyauté | text |
| `latitude` | Latitude; must lie between 23.0° S and 19.5° S | decimal degrees, WGS 84 (negative = south) |
| `longitude` | Longitude; must lie between 163.5° E and 168.5° E | decimal degrees, WGS 84 |
| `elevation_m` | Elevation | m above sea level |
| `habitat` | Vegetation type | text |
| `soil_type` | Soil or substrate type | text (one of five categories) |
| `soil_ph` | Soil pH | pH units |
| `soil_ni_mg_kg` | Nickel concentration in the soil | mg/kg |
| `soil_cr_mg_kg` | Chromium concentration in the soil | mg/kg |
| `soil_ca_mg_ratio` | Calcium to magnesium ratio | ratio (no unit) |
| `soil_organic_matter_pct` | Organic matter in the soil | % |
| `dna_conc_ng_ul` | DNA concentration of the extract | ng/µL |
| `dna_a260_280` | Absorbance ratio A260/A280 of the DNA extract | ratio (no unit) |
| `illumina_depth_x` | Mean sequencing depth of the Illumina DNA reads | × (fold coverage) |
| `hifi_available` | Whether PacBio HiFi reads exist; must agree with `files.tsv` | `yes` / `no` |
| `hifi_depth_x` | Mean sequencing depth of the HiFi reads (empty without HiFi) | × |
| `rna_available` | Whether RNA-seq reads exist; must agree with `files.tsv` | `yes` / `no` |
| `rna_tissue` | Tissue used for RNA extraction (empty without RNA-seq) | text |
| `rna_rin` | RNA integrity number | RIN, 1–10 (no unit) |
| `rna_conc_ng_ul` | RNA concentration of the extract | ng/µL |
| `rna_reads_million` | Number of RNA-seq reads | millions |

## `files.tsv`: one row per FASTQ file

| Column | Meaning | Unit or format |
| --- | --- | --- |
| `sample_id` | Sample the file belongs to (see `samples.tsv`) | `sample_id` |
| `species_id` | Species of that sample; must match `samples.tsv` | `species_id` |
| `data_type` | Type of sequenced material | `DNA` / `RNA` |
| `platform` | Sequencing platform | `Illumina` / `PacBio HiFi` |
| `read` | Read of a pair (`R1`, `R2`) for Illumina, `ccs` for HiFi | text |
| `path` | Path of the FASTQ file on the storage server | path |
| `size_gb` | File size | GB (10⁹ bytes) |
| `md5` | MD5 sum of the file | 32 lowercase hexadecimal characters |
