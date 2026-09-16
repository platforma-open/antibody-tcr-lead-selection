---
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
'@platforma-open/milaboratories.top-antibodies.spectratype': patch
'@platforma-open/milaboratories.top-antibodies.umap': patch
'@platforma-open/milaboratories.top-antibodies.anarci-kabat': patch
'@platforma-open/milaboratories.top-antibodies.assembling-fasta': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Format the python sources with ruff and gate them in CI

Adds a repo-root ruff.toml and runs ruff check, ruff format --check and pytest
from a new Python Tests workflow. The workflow runs only when something under
software/ changes.

The dev environment moves from software/sample-clonotypes/ to software/, so one
pyproject.toml and one uv.lock cover every package. pytest collects every
<package>/tests/ directory, and each package puts its own src/ on sys.path from
its tests/conftest.py.

The suite now runs what the block ships. The dev group carries pytest and ruff
only, and scripts/pytest.sh layers in each package's src/requirements.txt, the
file pl-pkg builds from. requires-python is capped below 3.13 and .python-version
pins 3.12.10, the version of the runenv the packages declare; uv was resolving
3.13.5 before. New tests assert the interpreter and every runtime version match
what the packages pin.

Every python source under software/ is reformatted. ruff also removed four
unused imports: os in sample-clonotypes main.py and filter.py, and pdist,
squareform and euclidean_distances in umap main.py. No behaviour changes.
