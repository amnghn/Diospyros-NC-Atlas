#!/usr/bin/env python3
"""Check the three data tables of the Diospyros atlas before they are published.

The script fails (exit code 1) with a clear message for every problem it finds:

* a column that js/app.js needs is missing, a row has the wrong number of cells,
  or a value contains a tab (which shows as a row with too many cells);
* a sample_id or species_id is not unique, or a sample or file points to an
  unknown species or sample;
* a species does not have exactly one reference sample, or reference_sample_id
  in species.tsv does not match the sample marked is_reference = yes;
* a reference sample has no PacBio HiFi file;
* an MD5 value is not 32 lowercase hexadecimal characters;
* coordinates fall outside a box around New Caledonia and the Loyalty Islands;
* a photo path in species.tsv does not exist.

It also checks that yes/no columns contain only "yes" or "no", that the
hifi_available and rna_available flags agree with files.tsv, that names and
species IDs agree between the tables, and that colours are #rrggbb values.

Standard library only; Python 3.9 or newer.

Usage:  python3 scripts/check_data.py [--root DIR]
"""
import argparse
import re
import sys
from pathlib import Path

# Columns that js/app.js reads from each table. Keep in sync with js/app.js;
# the script also reads js/app.js and fails if the app uses a sample column
# that is not listed here.
EXPECTED_COLUMNS = {
    "species": [
        "species_id", "species", "color", "reference_sample_id", "assembly_name",
        "assembly_path", "assembly_md5", "genome_size_mb", "n_contigs",
        "contig_n50_mb", "busco_complete_pct", "photo", "photo_credit",
    ],
    "samples": [
        "sample_id", "species_id", "species", "is_reference", "collection_date",
        "locality", "province", "latitude", "longitude", "elevation_m", "habitat",
        "soil_type", "soil_ph", "soil_ni_mg_kg", "soil_cr_mg_kg", "soil_ca_mg_ratio",
        "soil_organic_matter_pct", "dna_conc_ng_ul", "dna_a260_280", "illumina_depth_x",
        "hifi_available", "hifi_depth_x", "rna_available", "rna_tissue", "rna_rin",
        "rna_conc_ng_ul", "rna_reads_million",
    ],
    "files": ["sample_id", "data_type", "platform", "read", "path", "size_gb", "md5"],
}

# Bounding box around New Caledonia and the Loyalty Islands (decimal degrees, WGS 84).
LAT_MIN, LAT_MAX = -23.0, -19.5
LON_MIN, LON_MAX = 163.5, 168.5

HIFI_PLATFORM = "PacBio HiFi"
YES_NO_COLUMNS = ["is_reference", "hifi_available", "rna_available"]
MD5_RE = re.compile(r"^[0-9a-f]{32}$")
COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class Table:
    """One TSV file: header, rows (as dicts) and the file line number of each row."""

    def __init__(self, name, path):
        self.name = name
        self.path = path
        self.header = []
        self.rows = []
        self.lines = []


def read_table(name, root, relpath, problems):
    """Read a TSV the same way js/app.js does (blank lines skipped, \\r removed)."""
    path = root / relpath
    table = Table(name, relpath)
    if not path.is_file():
        problems.append(f"{relpath}: file not found")
        return table
    text = path.read_text(encoding="utf-8").replace("\r", "")
    numbered = [(i, line) for i, line in enumerate(text.split("\n"), start=1) if line.strip() != ""]
    if not numbered:
        problems.append(f"{relpath}: the file is empty")
        return table
    table.header = numbered[0][1].split("\t")
    duplicates = sorted({c for c in table.header if table.header.count(c) > 1})
    if duplicates:
        problems.append(f"{relpath}: duplicate column names in the header: {', '.join(duplicates)}")
    for line_no, line in numbered[1:]:
        cells = line.split("\t")
        if len(cells) != len(table.header):
            hint = " (a value may contain a tab)" if len(cells) > len(table.header) else ""
            problems.append(
                f"{relpath}, line {line_no}: {len(cells)} cells, but the header has {len(table.header)}{hint}"
            )
            continue
        table.rows.append(dict(zip(table.header, cells)))
        table.lines.append(line_no)
    if not table.rows:
        problems.append(f"{relpath}: no data rows")
    return table


def columns_used_by_app(app_js):
    """Sample columns named in CORE_COLUMNS, COLUMN_GROUPS and FACETS of js/app.js."""
    text = app_js.read_text(encoding="utf-8")
    names = set()
    core = re.search(r"const CORE_COLUMNS\s*=\s*\[([^\]]*)\]", text)
    if core:
        names.update(re.findall(r"'([^']+)'", core.group(1)))
    groups = re.search(r"const COLUMN_GROUPS\s*=\s*\[(.*?)\];", text, re.S)
    if groups:
        for block in re.findall(r"columns:\s*\[([^\]]*)\]", groups.group(1)):
            names.update(re.findall(r"'([^']+)'", block))
    facets = re.search(r"const FACETS\s*=\s*\[(.*?)\];", text, re.S)
    if facets:
        names.update(re.findall(r"key:\s*'([^']+)'", facets.group(1)))
    return names


def where(table, index):
    return f"{table.path}, line {table.lines[index]}"


def check(root):
    problems = []
    species = read_table("species", root, "data/species.tsv", problems)
    samples = read_table("samples", root, "data/samples.tsv", problems)
    files = read_table("files", root, "data/files.tsv", problems)

    # 1. Columns expected by js/app.js
    app_js = root / "js" / "app.js"
    if app_js.is_file():
        unknown = sorted(columns_used_by_app(app_js) - set(EXPECTED_COLUMNS["samples"]))
        if unknown:
            problems.append(
                f"js/app.js uses sample columns that check_data.py does not list: {', '.join(unknown)}"
                " (add them to EXPECTED_COLUMNS)"
            )
    else:
        problems.append("js/app.js: file not found")
    for table in (species, samples, files):
        if not table.header:
            continue
        missing = [c for c in EXPECTED_COLUMNS[table.name] if c not in table.header]
        if missing:
            problems.append(f"{table.path}: missing columns needed by js/app.js: {', '.join(missing)}")
    if problems:
        return problems, species, samples, files   # later checks need the columns

    # 2. Unique IDs and links between the tables
    species_ids, sample_ids = {}, {}
    for i, row in enumerate(species.rows):
        sid = row["species_id"]
        if sid in species_ids:
            problems.append(f"{where(species, i)}: species_id {sid!r} is not unique")
        species_ids.setdefault(sid, row)
    for i, row in enumerate(samples.rows):
        sid = row["sample_id"]
        if sid in sample_ids:
            problems.append(f"{where(samples, i)}: sample_id {sid!r} is not unique")
        sample_ids.setdefault(sid, row)
        sp = species_ids.get(row["species_id"])
        if sp is None:
            problems.append(f"{where(samples, i)}: sample {sid!r} points to unknown species {row['species_id']!r}")
        elif row["species"] != sp["species"]:
            problems.append(
                f"{where(samples, i)}: sample {sid!r} has species name {row['species']!r},"
                f" but species.tsv calls {row['species_id']!r} {sp['species']!r}"
            )
    for i, row in enumerate(files.rows):
        sample = sample_ids.get(row["sample_id"])
        if sample is None:
            problems.append(f"{where(files, i)}: file {row['path']!r} points to unknown sample {row['sample_id']!r}")
        elif "species_id" in row and row["species_id"] != sample["species_id"]:
            problems.append(
                f"{where(files, i)}: file {row['path']!r} has species_id {row['species_id']!r},"
                f" but its sample {row['sample_id']!r} belongs to {sample['species_id']!r}"
            )

    # 3. yes/no columns
    for i, row in enumerate(samples.rows):
        for col in YES_NO_COLUMNS:
            if row[col] not in ("yes", "no"):
                problems.append(f"{where(samples, i)}: {col} must be 'yes' or 'no', not {row[col]!r}")

    # 4. Exactly one reference sample per species, matching species.tsv, with a HiFi file
    hifi_samples = {f["sample_id"] for f in files.rows if f["platform"] == HIFI_PLATFORM}
    rna_samples = {f["sample_id"] for f in files.rows if f["data_type"] == "RNA"}
    for i, sp in enumerate(species.rows):
        refs = [s["sample_id"] for s in samples.rows
                if s["species_id"] == sp["species_id"] and s["is_reference"] == "yes"]
        if len(refs) != 1:
            listed = ", ".join(refs) if refs else "none"
            problems.append(
                f"{where(species, i)}: species {sp['species_id']!r} must have exactly one reference sample"
                f" (is_reference = yes), found {len(refs)}: {listed}"
            )
        elif refs[0] != sp["reference_sample_id"]:
            problems.append(
                f"{where(species, i)}: reference_sample_id is {sp['reference_sample_id']!r},"
                f" but the sample marked is_reference = yes is {refs[0]!r}"
            )
        ref = sp["reference_sample_id"]
        if ref in sample_ids and ref not in hifi_samples:
            problems.append(f"{where(species, i)}: reference sample {ref!r} has no {HIFI_PLATFORM} file in files.tsv")

    # 5. Availability flags agree with files.tsv
    for i, s in enumerate(samples.rows):
        sid = s["sample_id"]
        if s["hifi_available"] == "yes" and sid not in hifi_samples:
            problems.append(f"{where(samples, i)}: {sid!r} has hifi_available = yes but no {HIFI_PLATFORM} file")
        if s["hifi_available"] == "no" and sid in hifi_samples:
            problems.append(f"{where(samples, i)}: {sid!r} has hifi_available = no but a {HIFI_PLATFORM} file")
        if s["rna_available"] == "yes" and sid not in rna_samples:
            problems.append(f"{where(samples, i)}: {sid!r} has rna_available = yes but no RNA file")
        if s["rna_available"] == "no" and sid in rna_samples:
            problems.append(f"{where(samples, i)}: {sid!r} has rna_available = no but RNA files")

    # 6. MD5 values
    for i, f in enumerate(files.rows):
        if not MD5_RE.match(f["md5"]):
            problems.append(f"{where(files, i)}: MD5 {f['md5']!r} is not 32 lowercase hexadecimal characters")
    for i, sp in enumerate(species.rows):
        if not MD5_RE.match(sp["assembly_md5"]):
            problems.append(
                f"{where(species, i)}: assembly_md5 {sp['assembly_md5']!r} is not 32 lowercase hexadecimal characters"
            )

    # 7. Coordinates inside New Caledonia and the Loyalty Islands
    for i, s in enumerate(samples.rows):
        try:
            lat, lon = float(s["latitude"]), float(s["longitude"])
        except ValueError:
            problems.append(
                f"{where(samples, i)}: {s['sample_id']!r} has non-numeric coordinates"
                f" ({s['latitude']!r}, {s['longitude']!r})"
            )
            continue
        if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
            problems.append(
                f"{where(samples, i)}: {s['sample_id']!r} at ({lat}, {lon}) is outside New Caledonia"
                f" (latitude {LAT_MIN} to {LAT_MAX}, longitude {LON_MIN} to {LON_MAX})"
            )

    # 8. Photos exist; colours are #rrggbb (they are written into the page's HTML)
    for i, sp in enumerate(species.rows):
        photo = sp["photo"]
        if not photo or photo.startswith("/") or ".." in Path(photo).parts or not (root / photo).is_file():
            problems.append(f"{where(species, i)}: photo {photo!r} does not exist (paths are relative to the site root)")
        if not COLOR_RE.match(sp["color"]):
            problems.append(f"{where(species, i)}: color {sp['color']!r} is not a #rrggbb value")

    return problems, species, samples, files


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent,
                        help="site root that contains data/, js/ and assets/ (default: this repository)")
    args = parser.parse_args()
    root = args.root.resolve()
    problems, species, samples, files = check(root)
    if problems:
        print(f"Data check FAILED: {len(problems)} problem(s) in {root / 'data'}", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    print(f"Data check passed: {len(species.rows)} species, {len(samples.rows)} samples, {len(files.rows)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
