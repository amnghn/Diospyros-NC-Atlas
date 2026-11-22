# Prompt for Claude Code on LiSC: publish the "Diospyros of New Caledonia" sample atlas on GitHub Pages

**Working directory:** `/lisc/data/scratch/botany/amin/Diospyros_NC_Atlas`
**GitHub repository:** `https://github.com/amnghn/Diospyros-NC-Atlas`
**Public site (after publishing):** `https://amnghn.github.io/Diospyros-NC-Atlas/`

---

## 0. How to work (read first)

- You are running on LiSC, the University of Vienna HPC cluster (SLURM, EasyBuild modules). This is shared infrastructure. Work in **Plan mode first**. This project is a small static website, so nothing here needs `sbatch`; still, do not start long-running or heavy processes on the login node.
- All shell scripts start with `set -euo pipefail`. Avoid `sort | head` pipelines under `pipefail`; use `awk -v n="$N" 'NR<=n'`.
- Keep everything inside the working directory. Do not install anything system-wide.
- **Never delete anything.** You may create files and edit the files of this project, but you must not delete, empty or overwrite-to-remove any file or folder, anywhere. This includes `rm`, `rmdir`, `unlink`, `find -delete`, `rsync --delete`, `mv` onto an existing file, `git rm`, `git clean`, `git reset --hard`, `git checkout -- <file>`, `git restore`, `git stash drop`, `git branch -D` and `git tag -d`. If a file or folder should be removed, stop and tell me the exact command, and I will run it myself. Ask me before any command where you are not sure whether it deletes something.
- **Do not push to any remote repository, and do not add a remote.** I will create the GitHub repository and run `git push` myself. You may make local commits (see Section 6).
- There are three **stop points** (marked **⏸ STOP**) where you must stop, summarise, and wait for my approval.
- Language for all text on the site and in the documentation: plain English, simple grammar, short sentences, but academic and formal. British spelling.
- Colours: keep colourblind-safe palettes. If you change a palette, check it (for example against Okabe–Ito) and say so.
- **Do not redesign the site.** I am still finalising the design and will send design changes later as follow-up instructions. In this round, change the design only where Section 4 asks for it, or to fix a clear bug. List any other design ideas at STOP 1 instead of building them.

---

## 1. Goal

The website is an interactive map and data browser for my PhD project on *Diospyros* (Ebenaceae) in New Caledonia. It shows every sample on a map of New Caledonia, with the GPS coordinates, DNA, RNA and soil data of each sample, the paths and MD5 sums of the Illumina and PacBio HiFi FASTQ files, one genome assembly per species with its reference sample marked, and a photo of each species. Users can filter the samples, switch groups of attributes on and off, and export the filtered data as CSV or TSV.

The goal of this round is to **make the site public on GitHub Pages, with clean version control and clear documentation**, while it still uses **simulated data only**. My real data must stay private and must never enter this repository.

LiSC cannot host a public website. The site is static (no server, no login, no build step), so GitHub Pages hosts it. LiSC is only the place where you prepare, check and commit it.

---

## 2. Starting point (what already exists)

The directory was built on my laptop and copied to LiSC, including the hidden `.git` folder (one commit on branch `main`). It contains:

```
index.html                 # single page: filters, map, sample table, detail drawer, species cards, About section
css/style.css
js/app.js                  # all logic; loads the three TSV files with fetch(); Leaflet 1.9.4 from unpkg
data/species.tsv           # one row per species (5 rows)
data/samples.tsv           # one row per sample (50 rows)
data/files.tsv             # one row per FASTQ file (185 rows)
assets/photos/*.svg        # placeholder drawings, one per species
scripts/simulate_data.py   # writes data/*.tsv and assets/photos/*.svg; fixed seed (42); standard library only
README.md
LICENSE                    # MIT
.gitignore
```

- Species names are real (*D. vieillardii*, *D. calciphila*, *D. pancheri*, *D. umbrosa*, *D. minimifolia*). Every sample, coordinate, measurement, file path and MD5 sum is **simulated**. The page already shows a yellow "Simulated data" banner.
- `js/app.js` has a constant `REPO_URL = ''` at the top. When it is set, a "GitHub" link appears in the header.
- The site must be served over HTTP to work (browsers block `fetch()` from `file://`). Preview with `python3 -m http.server`.

First, read every file. Run the site locally and check that it works before you change anything.

---

## 3. Data privacy rules (most important)

1. Only the output of `scripts/simulate_data.py` may be committed in `data/` and `assets/photos/`. Never copy, read or reference any real data from elsewhere on LiSC.
2. Add a **reproducibility guard**: a check script (and the same step in the GitHub Actions workflow) that re-runs `scripts/simulate_data.py` and fails if `git diff --exit-code -- data assets/photos` shows any difference. This proves that the published data are exactly the simulated data. Make sure the simulator gives byte-identical output on LiSC's Python and on the Python version you pin in the workflow; test this and pin the same minor version.
3. Add `data/README.md` that says clearly that all data are simulated, how they are generated, and what each column means (units included).
4. Extend `.gitignore` with folders where real data might later be placed by mistake, for example `private/`, `data/real/`, `data_private/`, `*.private.tsv`, `*.private.csv`. Explain these in the README.
5. Before every commit, run `git status` and check that only expected files are staged. Never commit files larger than 5 MB.
6. Keep the "Simulated data" banner. Do not remove the reproducibility guard. Only I will decide when real data are added, and that will be a separate round with its own instructions.

---

## 4. Tasks

### 4.1 Review and small fixes
- Check the current code for bugs, broken links, console errors, and accessibility problems (keyboard use, focus, labels, colour contrast). Fix clear bugs. List anything bigger at STOP 1.
- Check that **all paths are relative** (`data/...`, `css/...`, `js/...`), because the site will be served from the sub-path `/Diospyros-NC-Atlas/`, not from the domain root.
- Pin the Leaflet files with Subresource Integrity (`integrity` and `crossorigin` attributes). Get the hashes from the official Leaflet download page or compute them from the files; never write a hash from memory.
- Check the layout on a phone-width screen (about 375 px). Fix anything that breaks.

### 4.2 Data checks
Write `scripts/check_data.py` (standard library only) that fails with a clear message if:
- a column expected by `js/app.js` is missing from a TSV file, or a file has rows with the wrong number of cells, or a value contains a tab;
- a `sample_id` or `species_id` is not unique, or a sample or file points to an unknown species or sample;
- a species does not have **exactly one** reference sample, or the `reference_sample_id` in `species.tsv` does not match the sample marked `is_reference = yes`;
- a reference sample has no HiFi file;
- an MD5 value is not 32 lowercase hexadecimal characters;
- coordinates fall outside a bounding box around New Caledonia and the Loyalty Islands (about 23.0–19.5° S, 163.5–168.5° E);
- a photo path in `species.tsv` does not exist.

Run it locally and in the workflow (Section 4.5).

### 4.3 Site changes
- **About page**: move the About content to its own page, `about.html`, with the same header, navigation and footer as `index.html`. Content (plain, formal English):
  - **What this is:** one short paragraph on the project and the site.
  - **Who made it:** Amin Ghane, PhD student in Ecology and Evolution, Department of Botany and Biodiversity Research, University of Vienna. Member of the research group of my supervisor, Ovidiu Paun (group page: https://plantgenomics.univie.ac.at/index.php?id=26086&L=0). Read the group page to get the exact group name and how the group presents itself; if the page cannot be reached or the name is unclear, ask me. Link the group page and my ORCID (https://orcid.org/0000-0002-1035-8650).
  - **Contact:** aminghane@univie.ac.at. Use exactly this address and no other. Show it in a form that is hard for spam bots to read (for example assembled with JavaScript, so the plain address does not appear in the HTML source), with a `mailto:` link for real users.
  - **Feedback:** suggestions and bug reports are welcome, by email or through GitHub Issues (link to the repository's Issues page).
  - **Data:** all data on this site are simulated for design and testing; the real data are not public.
  - **How to cite:** link to `CITATION.cff` and show a short citation with the version number.
  - **Licence:** the whole repository (code and site text) is under the MIT licence. Add one sentence that the real data and species photos, when they are added later, will have their own terms.
  - **Disclaimer** (polish the wording, keep all points): this site is a beta version and a work in progress. It is provided "as is", without warranty of any kind. The data shown are simulated and must not be used for research.
  - **AI declaration:** This website was developed with the help of Claude Code (Anthropic), an AI coding assistant. The author designed the website, wrote the instructions, reviewed the code and the text, and checked the results. The prompts used to build it are available in the GitHub repository (`docs/PROMPT.md`). A record of all changes is in `CHANGELOG.md`.
  - **Credits:** Leaflet, OpenStreetMap contributors, OpenTopoMap, Esri World Imagery (with their licence terms).
  - **Version and date of the last change**, read from one place (for example a small `js/version.js` that you update together with `CHANGELOG.md`).
- **Beta badge and version:** a small permanent "Beta" badge next to the site title, and the version (`v0.1.0-beta`) in the footer of every page, with a one-line disclaimer linking to the About page.
- **Header link:** set `REPO_URL` to the GitHub repository URL.
- **Metadata:** a page `<title>` and `description` on each page, Open Graph tags (title, description, a preview image you make from the map, relative or absolute to the Pages URL), and a simple favicon (an SVG is fine).
- **404 page:** a simple `404.html` with a link back to the map.

### 4.4 Documentation
- **`README.md`** (rewrite it; clear and complete): what the site is, a link to the live site, a screenshot, the "simulated data only" statement, features, how to run it locally, the data format (link to `data/README.md`), how to regenerate the simulated data, how to run the checks, how deployment works, repository layout, how to cite, licence, AI declaration, and how to report problems.
- **`CHANGELOG.md`** in the repository root, "Keep a Changelog" style (Added / Changed / Fixed / Removed). Add an entry for the existing first version (`v0.1.0-beta`, from the first commit), then **update it after every step** of this round, not only at the end. Every entry has a timestamp in ISO 8601 with the Vienna time zone, from `TZ=Europe/Vienna date -Iminutes`; never write the time from memory. Each entry says briefly what changed and which files changed. Use semantic versioning with a `-beta` suffix until I decide to drop it.
- **`CITATION.cff`**: author Amin Ghane, affiliation University of Vienna, title, version, date, repository URL, licence (MIT), ORCID `https://orcid.org/0000-0002-1035-8650`. This makes GitHub show a "Cite this repository" button. Validate the file against the CFF 1.2.0 schema (for example with `cffconvert --validate`, installed in a local environment inside the working directory); if you cannot install the validator, say so.
- **`docs/PROMPT.md`**: save this prompt, exactly as I gave it to you. Add the earlier prompt that built the first version below it, under a heading "Prompt for version 0.1.0 (laptop)": *"I want to make a website for my Diospyros PhD project. It should show a map of New Caledonia with all samples from all species, with all the data we have for each single species. I'm not giving you any real data now. Simulate a dataset of 5 species with 10 samples each and show them on the map. The map should be interactive, and I should be able to toggle different attribute data on and off. For example, if I want to see all data for one soil type, I should be able to filter it and export it as a CSV or TSV. For each sample, we have DNA, RNA and soil data, and GPS coordinates. For each species, we have one genome assembly, and the sample as the reference should be marked. Path to the fastq files of Illumina and HiFi reads; the MD5 sum of each file is also available. We have photos of each species. The website should be open source, and the code should be available on GitHub."* If I give you later instructions, add them at the end under "Follow-up instructions", with the date. Never edit earlier text. Do not delete `PROMPT_LiSC.md` from the root (it is this file); at STOP 1, tell me the command to remove it after you have saved `docs/PROMPT.md`, and do not commit `PROMPT_LiSC.md`.
- **`.github/ISSUE_TEMPLATE/`**: two short templates, "Bug report" and "Suggestion".

### 4.5 GitHub Actions workflow for GitHub Pages (prepare, do not run)
Create `.github/workflows/pages.yml` that runs on every push to `main` (and manually with `workflow_dispatch`):
1. **Check job:** check out the code, set up Python (pinned minor version, see Section 3.2), run `scripts/check_data.py`, run the reproducibility guard.
2. **Deploy job** (only if the check job passes): copy only the files the site needs (`index.html`, `about.html`, `404.html`, `css/`, `js/`, `data/`, `assets/`, favicon, `LICENSE`) into a `_site/` folder, and deploy it with the official GitHub Pages actions (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`). Look up the current major version of each action online; do not use versions from memory. Set the minimum permissions (`contents: read`, `pages: write`, `id-token: write`) and a `concurrency` group.

Do not publish `scripts/`, `docs/` or `.github/` as part of the site.

### 4.6 Local preview
Do not build a local `_site/` copy (refreshing it would need deletions). Instead, test the site under the same sub-path it will have on GitHub Pages: create a folder `.preview/` (add it to `.gitignore`) containing a symbolic link `.preview/Diospyros-NC-Atlas` that points to the working directory, then run `python3 -m http.server 8765 --bind 127.0.0.1 --directory .preview` and open `http://localhost:8765/Diospyros-NC-Atlas/`. I will forward the port with VS Code Remote-SSH. Do not open public ports. Stop the server when you no longer need it.

---

## 5. Phases and stop points

**Phase 0 – Audit and plan.**
- Check the environment: `python3 --version`, `git --version`, `git config user.name`, `git config user.email` (if either is empty, ask me; do not set them yourself), and internet access to github.com and unpkg.com.
- Read all files, run the site, and run a first version of the data checks.
- Write a short plan: what you will change, file by file, and a list of bugs and design ideas you found (ideas only, not built).
- **⏸ STOP 1:** show me the plan and wait.

**Phase 1 – Build.**
- Do Sections 3 and 4. Commit after each finished unit of work (Section 6) and update `CHANGELOG.md` each time.
- Run `scripts/check_data.py` and the reproducibility guard. Preview the site and check every page, every filter, both export buttons (open the exported files and check their content), the detail drawer, the species cards, the About page and the 404 page, on desktop and phone widths. Check the browser console for errors.
- **⏸ STOP 2:** give me the preview command, a list of what changed, the check results, and known limitations. Wait.

**Phase 2 – Ready to publish.**
- Fix anything from my STOP 2 feedback.
- Check that the contact email on the About page is exactly aminghane@univie.ac.at and that the `mailto:` link works.
- **⏸ STOP 3:** give me the exact steps to publish (Section 7), with the commands filled in. Do not run `git remote add` or `git push`.

At every stop point, first update `CHANGELOG.md` and commit.

---

## 6. Version control

- Work on branch `main`. Keep the existing commit history.
- Make small commits, one per finished unit of work, with a clear message in the imperative mood (for example `Add About page with disclaimer and AI declaration`). Add a blank line and a short body when the change needs explanation.
- Tag the commit that is ready to publish as `v0.1.0-beta` (lightweight tags are fine; I will push tags myself).
- Never commit secrets, tokens, or any file from outside the working directory.

---

## 7. Publishing steps to give me at STOP 3

Write these out with the real names filled in:
1. The repository `https://github.com/amnghn/Diospyros-NC-Atlas` already exists and is **private**. Ask me whether it is empty. If it already has commits (for example a README or licence made on GitHub), give me safe commands to combine them with the local history (for example `git pull --rebase origin main` after adding the remote), and tell me how to resolve conflicts, keeping the local files. Never suggest a force push.
2. I push with **SSH**. Give me: a check that my SSH key works (`ssh -T git@github.com`), then `git remote add origin git@github.com:amnghn/Diospyros-NC-Atlas.git`, `git push -u origin main`, `git push origin --tags`.
3. Make the repository **public**: *Settings → General → Danger Zone → Change repository visibility*. GitHub Pages needs a public repository on a free account. Remind me that the whole commit history becomes public, and confirm that the history contains only simulated data and no secrets (check with `git log --stat` before STOP 3).
4. In the repository: *Settings → Pages → Build and deployment → Source: GitHub Actions*.
5. Watch the first workflow run in the *Actions* tab, and open the site at `https://amnghn.github.io/Diospyros-NC-Atlas/`.
6. Optional: add the site URL and topics (for example `diospyros`, `new-caledonia`, `leaflet`, `biodiversity`) to the repository's *About* box.

---

## 8. Definition of done

- The site runs as a static site from `_site/` with no server-side code, and works under the sub-path `/Diospyros-NC-Atlas/`.
- Only simulated data are in the repository, and the reproducibility guard proves it in the workflow.
- `scripts/check_data.py` passes.
- `about.html` shows the author, the group and supervisor with links, the ORCID link, the contact email, the feedback invitation, the data statement, the disclaimer, the AI declaration and the version, with working links to `docs/PROMPT.md`, `CHANGELOG.md` and `CITATION.cff` on GitHub.
- The Beta badge and version appear on every page.
- `README.md`, `data/README.md`, `CHANGELOG.md` (timestamped entry for every step), `CITATION.cff`, `docs/PROMPT.md` and the issue templates exist.
- `.github/workflows/pages.yml` is ready, and nothing has been pushed.
- The work is committed in small, clear commits on `main`, tagged `v0.1.0-beta`.

---

# Prompt for version 0.1.0 (laptop)

This is the earlier prompt that built the first version of the site on a laptop (first commit).

> I want to make a website for my Diospyros PhD project. It should show a map of New Caledonia with all samples from all species, with all the data we have for each single species. I'm not giving you any real data now. Simulate a dataset of 5 species with 10 samples each and show them on the map. The map should be interactive, and I should be able to toggle different attribute data on and off. For example, if I want to see all data for one soil type, I should be able to filter it and export it as a CSV or TSV. For each sample, we have DNA, RNA and soil data, and GPS coordinates. For each species, we have one genome assembly, and the sample as the reference should be marked. Path to the fastq files of Illumina and HiFi reads; the MD5 sum of each file is also available. We have photos of each species. The website should be open source, and the code should be available on GitHub.

---

# Follow-up instructions

Later instructions are added below, each under a heading with its date. Earlier text is never edited.
