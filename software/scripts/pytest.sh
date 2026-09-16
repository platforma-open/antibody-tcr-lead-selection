#!/usr/bin/env bash
# Run the python suite against the versions the block actually ships.
#
# The dev group carries pytest and ruff only. Every runtime library is layered
# in from the packages' own src/requirements.txt, the same files pl-pkg builds
# from, so a test can never pass against a version the block does not run.
#
# Usage, from software/:   ./scripts/pytest.sh [pytest args...]
set -euo pipefail
cd "$(dirname "$0")/.."

args=()
for req in */src/requirements.txt; do
    args+=(--with-requirements "$req")
done

echo "Layering runtime pins from: ${args[*]//--with-requirements /}"

# python -m pytest, not pytest: the console script in .venv/bin runs the project
# interpreter and never sees the --with-requirements overlay, so the runtime
# libraries would be missing and every import would fail.
exec uv run "${args[@]}" python -m pytest "$@"
