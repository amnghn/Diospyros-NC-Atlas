#!/usr/bin/env python3
"""Simulate a demonstration dataset for the Diospyros atlas.

Writes three tab-separated tables into data/ and placeholder species
"photos" into assets/photos/. Everything produced here is FAKE and only
exists so the website can be developed before the real data are added.

Usage:  python3 scripts/simulate_data.py
"""
import csv
import hashlib
import random
from pathlib import Path

SEED = 42
SAMPLES_PER_SPECIES = 10
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PHOTO_DIR = ROOT / "assets" / "photos"
STORAGE_ROOT = "/data/diospyros"

# name: (province, lat, lon, (min_elev, max_elev), soil type, habitat)
LOCALITIES = {
    "Mont Koghi": ("Sud", -22.176, 166.508, (400, 900), "Ultramafic (peridotite)", "Humid evergreen forest"),
    "Parc de la Rivière Bleue": ("Sud", -22.100, 166.660, (150, 500), "Ultramafic (peridotite)", "Humid evergreen forest"),
    "Plaine des Lacs": ("Sud", -22.270, 166.900, (200, 300), "Ultramafic (peridotite)", "Maquis"),
    "Pic du Grand Kaori": ("Sud", -22.285, 166.895, (200, 350), "Ultramafic (peridotite)", "Humid evergreen forest"),
    "Yaté": ("Sud", -22.150, 166.890, (150, 400), "Ultramafic (peridotite)", "Maquis"),
    "Mont Dore": ("Sud", -22.265, 166.585, (200, 750), "Ultramafic (peridotite)", "Maquis"),
    "Mont Humboldt": ("Sud", -21.883, 166.413, (800, 1500), "Ultramafic (peridotite)", "Montane forest"),
    "Thio": ("Sud", -21.630, 166.190, (100, 600), "Ultramafic (peridotite)", "Maquis"),
    "Païta": ("Sud", -22.120, 166.380, (50, 300), "Volcano-sedimentary", "Dry forest"),
    "Farino": ("Sud", -21.660, 165.770, (250, 600), "Volcano-sedimentary", "Humid evergreen forest"),
    "Col d'Amieu": ("Sud", -21.580, 165.800, (400, 700), "Schist", "Humid evergreen forest"),
    "Bourail": ("Sud", -21.560, 165.520, (20, 250), "Volcano-sedimentary", "Dry forest"),
    "Île des Pins": ("Sud", -22.620, 167.480, (10, 120), "Limestone", "Coastal forest"),
    "Massif du Koniambo": ("Nord", -20.990, 164.800, (300, 900), "Ultramafic (peridotite)", "Maquis"),
    "Tiébaghi": ("Nord", -20.450, 164.220, (200, 550), "Serpentinite", "Maquis"),
    "Poum": ("Nord", -20.260, 164.045, (50, 350), "Serpentinite", "Maquis"),
    "Koumac": ("Nord", -20.560, 164.310, (20, 200), "Limestone", "Dry forest"),
    "Pindaï": ("Nord", -21.335, 164.975, (10, 80), "Volcano-sedimentary", "Dry forest"),
    "Poya": ("Nord", -21.340, 165.170, (20, 200), "Volcano-sedimentary", "Dry forest"),
    "Mont Panié": ("Nord", -20.590, 164.770, (500, 1500), "Schist", "Montane forest"),
    "Hienghène": ("Nord", -20.720, 164.920, (50, 400), "Schist", "Humid evergreen forest"),
    "Poindimié": ("Nord", -20.960, 165.300, (50, 400), "Schist", "Humid evergreen forest"),
    "Lifou": ("Îles Loyauté", -20.950, 167.220, (20, 80), "Limestone", "Coastal forest"),
    "Maré": ("Îles Loyauté", -21.520, 167.980, (20, 100), "Limestone", "Coastal forest"),
}

SPECIES = [
    {"species_id": "DVIE", "species": "Diospyros vieillardii", "color": "#1b7f5c",
     "localities": ["Mont Koghi", "Parc de la Rivière Bleue", "Mont Humboldt", "Thio", "Massif du Koniambo", "Tiébaghi"]},
    {"species_id": "DCAL", "species": "Diospyros calciphila", "color": "#3a6ea5",
     "localities": ["Lifou", "Maré", "Île des Pins", "Koumac"]},
    {"species_id": "DPAN", "species": "Diospyros pancheri", "color": "#d1603d",
     "localities": ["Plaine des Lacs", "Pic du Grand Kaori", "Yaté", "Mont Dore", "Poum"]},
    {"species_id": "DUMB", "species": "Diospyros umbrosa", "color": "#8e4a9e",
     "localities": ["Col d'Amieu", "Farino", "Mont Panié", "Hienghène", "Poindimié"]},
    {"species_id": "DMIN", "species": "Diospyros minimifolia", "color": "#c9a227",
     "localities": ["Pindaï", "Poya", "Bourail", "Païta", "Koumac"]},
]

# soil type: (pH, Ni mg/kg, Cr mg/kg, Ca:Mg ratio) as (low, high) ranges
SOIL_CHEMISTRY = {
    "Ultramafic (peridotite)": ((5.5, 6.8), (2000, 8000), (5000, 20000), (0.05, 0.40)),
    "Serpentinite": ((6.5, 7.5), (1500, 5000), (1500, 6000), (0.02, 0.20)),
    "Limestone": ((7.5, 8.4), (10, 80), (20, 120), (5.0, 30.0)),
    "Schist": ((4.8, 6.0), (20, 150), (40, 250), (0.8, 3.0)),
    "Volcano-sedimentary": ((5.5, 7.0), (30, 300), (60, 400), (1.0, 5.0)),
}

RNA_TISSUES = ["Leaf", "Leaf", "Leaf", "Flower bud", "Fruit", "Root"]


def fake_md5(path):
    """A stable, realistic-looking MD5 (hash of the path, not of real content)."""
    return hashlib.md5(f"{SEED}:{path}".encode()).hexdigest()


def write_tsv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), delimiter="\t", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def file_row(sample_id, species_id, data_type, platform, read, path, size_gb):
    return {
        "sample_id": sample_id, "species_id": species_id, "data_type": data_type,
        "platform": platform, "read": read, "path": path,
        "size_gb": f"{size_gb:.1f}", "md5": fake_md5(path),
    }


def placeholder_photo(species, color):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="Placeholder for {species}">
  <rect width="400" height="300" fill="{color}" opacity="0.16"/>
  <rect width="400" height="300" fill="none" stroke="{color}" stroke-width="2" opacity="0.5"/>
  <g transform="translate(200 132)">
    <path d="M-120 34 C-70 -62 40 -72 96 -30 C40 30 -60 56 -120 34Z" fill="{color}" opacity="0.85"/>
    <path d="M-120 34 C-50 4 30 -18 96 -30" fill="none" stroke="#fff" stroke-width="3" opacity="0.7"/>
    <circle cx="70" cy="44" r="34" fill="{color}"/>
    <path d="M52 16 l18 -10 l18 10 l-8 8 h-20z" fill="#fff" opacity="0.55"/>
  </g>
  <text x="200" y="262" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#222">{species}</text>
  <text x="200" y="284" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#555">placeholder — replace with a real photo</text>
</svg>
"""


def main():
    rng = random.Random(SEED)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)

    species_rows, sample_rows, file_rows = [], [], []

    for sp in SPECIES:
        sid = sp["species_id"]
        pool = sp["localities"]
        # Visit every locality at least once, then fill up at random.
        picks = pool + [rng.choice(pool) for _ in range(SAMPLES_PER_SPECIES - len(pool))]
        rng.shuffle(picks)
        reference_index = rng.randrange(SAMPLES_PER_SPECIES)
        reference_id = f"{sid}_{reference_index + 1:02d}"

        for i, loc_name in enumerate(picks):
            sample_id = f"{sid}_{i + 1:02d}"
            is_ref = sample_id == reference_id
            province, lat, lon, elev, soil, habitat = LOCALITIES[loc_name]
            ph, ni, cr, camg = SOIL_CHEMISTRY[soil]
            has_rna = is_ref or rng.random() < 0.7

            sample_rows.append({
                "sample_id": sample_id,
                "species_id": sid,
                "species": sp["species"],
                "is_reference": "yes" if is_ref else "no",
                "collection_date": f"{rng.choice([2023, 2024, 2025])}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
                "locality": loc_name,
                "province": province,
                "latitude": f"{lat + rng.uniform(-0.008, 0.008):.5f}",
                "longitude": f"{lon + rng.uniform(-0.008, 0.008):.5f}",
                "elevation_m": str(rng.randint(*elev)),
                "habitat": habitat,
                "soil_type": soil,
                "soil_ph": f"{rng.uniform(*ph):.1f}",
                "soil_ni_mg_kg": str(round(rng.uniform(*ni))),
                "soil_cr_mg_kg": str(round(rng.uniform(*cr))),
                "soil_ca_mg_ratio": f"{rng.uniform(*camg):.2f}",
                "soil_organic_matter_pct": f"{rng.uniform(2, 18):.1f}",
                "dna_conc_ng_ul": f"{rng.uniform(15, 140):.1f}",
                "dna_a260_280": f"{rng.uniform(1.70, 1.95):.2f}",
                "illumina_depth_x": str(rng.randint(18, 45)),
                "hifi_available": "yes" if is_ref else "no",
                "hifi_depth_x": str(rng.randint(28, 45)) if is_ref else "",
                "rna_available": "yes" if has_rna else "no",
                "rna_tissue": rng.choice(RNA_TISSUES) if has_rna else "",
                "rna_rin": f"{rng.uniform(6.2, 9.4):.1f}" if has_rna else "",
                "rna_conc_ng_ul": f"{rng.uniform(40, 400):.0f}" if has_rna else "",
                "rna_reads_million": f"{rng.uniform(25, 60):.1f}" if has_rna else "",
            })

            base = f"{STORAGE_ROOT}/raw"
            for read in ("R1", "R2"):
                file_rows.append(file_row(sample_id, sid, "DNA", "Illumina", read,
                                          f"{base}/illumina/DNA/{sample_id}/{sample_id}_DNA_{read}.fastq.gz",
                                          rng.uniform(8, 22)))
            if has_rna:
                for read in ("R1", "R2"):
                    file_rows.append(file_row(sample_id, sid, "RNA", "Illumina", read,
                                              f"{base}/illumina/RNA/{sample_id}/{sample_id}_RNA_{read}.fastq.gz",
                                              rng.uniform(2, 6)))
            if is_ref:
                file_rows.append(file_row(sample_id, sid, "DNA", "PacBio HiFi", "ccs",
                                          f"{base}/hifi/{sample_id}/{sample_id}.hifi_reads.fastq.gz",
                                          rng.uniform(25, 45)))

        assembly_name = f"{sid}_v1.0"
        assembly_path = f"{STORAGE_ROOT}/assemblies/{sid}/{assembly_name}.fasta.gz"
        photo = f"assets/photos/{sid}.svg"
        species_rows.append({
            "species_id": sid,
            "species": sp["species"],
            "color": sp["color"],
            "reference_sample_id": reference_id,
            "assembly_name": assembly_name,
            "assembly_path": assembly_path,
            "assembly_md5": fake_md5(assembly_path),
            "genome_size_mb": str(rng.randint(850, 1250)),
            "n_contigs": str(rng.randint(180, 900)),
            "contig_n50_mb": f"{rng.uniform(8, 42):.1f}",
            "busco_complete_pct": f"{rng.uniform(96.0, 99.2):.1f}",
            "photo": photo,
            "photo_credit": "Placeholder illustration",
        })
        (ROOT / photo).write_text(placeholder_photo(sp["species"], sp["color"]), encoding="utf-8")

    write_tsv(DATA_DIR / "species.tsv", species_rows)
    write_tsv(DATA_DIR / "samples.tsv", sample_rows)
    write_tsv(DATA_DIR / "files.tsv", file_rows)
    print(f"Wrote {len(species_rows)} species, {len(sample_rows)} samples, {len(file_rows)} files")


if __name__ == "__main__":
    main()
