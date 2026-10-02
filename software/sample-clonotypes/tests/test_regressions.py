"""Regressions in main.py: behaviours that broke once and must not break again.

Each test asserts what a caller or an operator can observe, so it keeps holding
if the implementation changes.
"""

import json
import subprocess
import sys
from pathlib import Path

import polars as pl
from main import validate_column_format

MAIN = Path(__file__).resolve().parents[1] / "src" / "main.py"


def run_main(tmp_path, values, n):
    """Run main.py end to end. Returns the process and the two output frames."""
    clone = tmp_path / "clones.parquet"
    keys = [f"c{i}" for i in range(len(values))]
    pl.DataFrame({"clonotypeKey": keys, "Col0": values}).write_parquet(clone)

    selection_in = tmp_path / "selection.parquet"
    pl.DataFrame({"clonotypeKey": keys, "selectionStage": [1] * len(keys)}).write_parquet(selection_in)

    out = tmp_path / "out.parquet"
    selection_out = tmp_path / "selection-out.parquet"

    process = subprocess.run(
        [
            sys.executable,
            str(MAIN),
            "--parquet",
            str(clone),
            "--n",
            str(n),
            "--out",
            str(out),
            "--ranking-map",
            json.dumps({"Col0": "decreasing"}),
            "--selection-in",
            str(selection_in),
            "--selection-out",
            str(selection_out),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    selected = pl.read_parquet(out) if out.exists() else None
    stages = pl.read_parquet(selection_out) if selection_out.exists() else None
    return process, selected, stages


def test_missing_clonotype_key_is_reported_not_raised():
    """validate_column_format always returns three lists, and the caller checks
    for clonotypeKey itself. Returning a single sentinel instead would make the
    caller's three-way unpack raise, hiding the message it had just printed."""
    df = pl.DataFrame({"Col0": [1.0, 2.0]})

    clonotype_cols, cluster_cols, linker_cols = validate_column_format(df)

    assert clonotype_cols == ["Col0"]
    assert cluster_cols == []
    assert linker_cols == []


def test_n_larger_than_the_table_selects_every_row(tmp_path):
    """Asking for more clonotypes than the table holds is not a failure, so the
    log must not call it one. This names the clamp message. A broad "Error:"
    search would fail on any unrelated message added later."""
    process, selected, _ = run_main(tmp_path, ["9.5", "10.2", "100.7"], n=500)

    assert process.returncode == 0
    assert selected.height == 3
    assert "Error: N (500)" not in process.stdout
    assert "Selecting all 3 rows" in process.stdout


def test_only_the_sampled_clonotypes_are_bumped_to_the_final_stage(tmp_path):
    """The stage update must mark clonotypes by membership in the sampled set,
    never by row position. With four keys and two selected, a positional match
    marks the wrong two, and nothing downstream would notice: the block would
    just report leads the ranking never chose."""
    process, selected, stages = run_main(tmp_path, ["9.5", "3.1", "100.7", "50.0"], n=2)

    assert process.returncode == 0

    sampled = set(selected["clonotypeKey"].to_list())
    assert sampled == {"c2", "c3"}, "top two by decreasing Col0 are 100.7 (c2) and 50.0 (c3)"

    bumped = set(stages.filter(pl.col("selectionStage") == 2)["clonotypeKey"].to_list())
    untouched = set(stages.filter(pl.col("selectionStage") == 1)["clonotypeKey"].to_list())

    assert bumped == sampled
    assert untouched == {"c0", "c1"}


def test_selection_stage_update_emits_no_deprecation_warning(tmp_path):
    """Secondary to the test above: a polars deprecation warning here is the
    early signal that the membership form is being dropped. The stage
    assignment is the thing that must stay correct either way."""
    process, _, _ = run_main(tmp_path, ["9.5", "3.1", "100.7", "50.0"], n=2)

    assert process.returncode == 0
    assert "DeprecationWarning" not in process.stderr
