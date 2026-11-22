#!/usr/bin/env bash
# Reproducibility guard: prove that the data published with the site are
# exactly the output of scripts/simulate_data.py, and nothing else.
#
# 1. Refuse to run if data/ or assets/photos/ have uncommitted changes
#    (the simulator rewrites these folders, and local edits must never be lost).
# 2. Re-run scripts/simulate_data.py.
# 3. Fail if `git diff --exit-code -- data assets/photos` shows any difference.
# 4. Fail if the simulator wrote files that are not committed.
# 5. Fail if data/ or assets/photos/ contain tracked files that are not on the
#    allowlist below (an extra committed file would not show in `git diff`).
# 6. Fail if any tracked file in the repository is larger than 5 MB.
#
# Usage:  bash scripts/check_reproducible.sh
# Python: python3.12 if it is on PATH (the version pinned in the workflow),
#         otherwise python3; set PYTHON=... to choose another interpreter.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
PYTHON="${PYTHON:-$(command -v python3.12 || command -v python3)}"
GUARDED=(data assets/photos)
MAX_BYTES=$((5 * 1024 * 1024))

# Every file that may be committed in data/ and assets/photos/. All of them
# except data/README.md are written by scripts/simulate_data.py. Change this
# list only together with the simulator.
ALLOWED=(
  data/README.md
  data/species.tsv
  data/samples.tsv
  data/files.tsv
  assets/photos/DVIE.svg
  assets/photos/DCAL.svg
  assets/photos/DPAN.svg
  assets/photos/DUMB.svg
  assets/photos/DMIN.svg
)

fail() { printf 'Reproducibility guard FAILED: %s\n' "$1" >&2; exit 1; }
git_q() { git -c core.quotePath=false "$@"; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not inside a git repository"
echo "Python: $("$PYTHON" --version 2>&1) ($PYTHON)"

# 1. Clean starting point
dirty=$(git_q status --porcelain --untracked-files=all -- "${GUARDED[@]}")
if [ -n "$dirty" ]; then
  printf '%s\n' "$dirty" >&2
  fail "data/ or assets/photos/ have uncommitted changes (listed above). Commit them or move them out of these folders first; the guard does not overwrite uncommitted files."
fi

# 2. Re-run the simulator
"$PYTHON" scripts/simulate_data.py

# 3. The committed data must equal the simulator output, byte for byte
if ! git_q diff --exit-code --stat -- "${GUARDED[@]}"; then
  fail "the committed files differ from the output of scripts/simulate_data.py (see the list above; run 'git diff -- data assets/photos' for details)."
fi

# 4. No new files from the simulator that are not committed
untracked=$(git_q status --porcelain --untracked-files=all -- "${GUARDED[@]}")
if [ -n "$untracked" ]; then
  printf '%s\n' "$untracked" >&2
  fail "the simulator wrote files that are not committed (listed above)."
fi

# 5. Only allowed files are tracked in data/ and assets/photos/
if ! unexpected=$(diff <(printf '%s\n' "${ALLOWED[@]}" | LC_ALL=C sort) \
                       <(git_q ls-files -- "${GUARDED[@]}" | LC_ALL=C sort)); then
  printf '%s\n' "$unexpected" >&2
  fail "the tracked files in data/ and assets/photos/ do not match the allowlist ('>' = tracked but not allowed, '<' = allowed but missing)."
fi

# 6. No tracked file larger than 5 MB
large=""
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  size=$(wc -c < "$f")
  if [ "$size" -gt "$MAX_BYTES" ]; then large+="  $f ($size bytes)"$'\n'; fi
done < <(git_q ls-files -z)
[ -z "$large" ] || { printf '%s' "$large" >&2; fail "tracked files larger than 5 MB (listed above)."; }

echo "Reproducibility guard passed: data/ and assets/photos/ are exactly the simulated data (${#ALLOWED[@]} allowed files), and no tracked file is larger than 5 MB."
