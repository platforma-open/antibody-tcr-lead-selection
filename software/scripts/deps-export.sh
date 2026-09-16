#!/usr/bin/env bash
# Regenerate every <package>/src/requirements.txt from pyproject.toml.
#
# pyproject.toml is the single source of truth. One dependency group per package
# holds that package's runtime pins. pl-pkg builds the shipped environment from
# the generated requirements.txt, so the two must agree. The requirements-sync CI
# job fails the build when they drift.
#
# --no-deps keeps the output to top-level pins. The offline build installs with
# --no-index --find-links. A leaked transitive dependency breaks that install at
# runtime, not here.
#
# Usage, from software/:   ./scripts/deps-export.sh
set -euo pipefail
cd "$(dirname "$0")/.."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for package_dir in */src; do
    package="${package_dir%/src}"

    uv run --no-project python - "$package" > "$tmp/in.txt" <<'PY'
import sys, tomllib, pathlib
package = sys.argv[1]
groups = tomllib.loads(pathlib.Path("pyproject.toml").read_text())["dependency-groups"]
if package not in groups:
    sys.exit(f"pyproject.toml has no dependency group for '{package}'")
print("\n".join(groups[package]))
PY

    uv pip compile --quiet --no-deps --no-annotate --no-header \
        "$tmp/in.txt" --output-file "$package_dir/requirements.txt"

    echo "wrote $package_dir/requirements.txt"
done
