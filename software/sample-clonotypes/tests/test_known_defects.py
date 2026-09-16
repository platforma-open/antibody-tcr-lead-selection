"""Regression tests for three defects found while reviewing PR #187.

Each one was committed failing, then fixed in its own commit. They assert the
behaviour a caller or an operator can observe, not the internal shape of the
fix, so they keep holding if the implementation changes.
"""

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
            '{"Col0":"decreasing"}',
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


def test_missing_clonotype_key_reports_its_error_instead_of_raising():
    """validate_column_format used to return a bare False, which the caller
    unpacked into three names and died on. It now always returns three lists."""
    df = pl.DataFrame({"Col0": [1.0, 2.0]})

    clonotype_cols, cluster_cols, linker_cols = validate_column_format(df)

    assert clonotype_cols == ["Col0"]
    assert cluster_cols == []
    assert linker_cols == []


def test_n_larger_than_the_table_selects_every_row(tmp_path):
    """Asking for more clonotypes than the table holds is not a failure, so the
    log must not call it one. Asserted against the clamp message specifically —
    a broad "Error:" search would fail on any unrelated message later."""
    process, selected, _ = run_main(tmp_path, ["9.5", "10.2", "100.7"], n=500)

    assert process.returncode == 0
    assert selected.height == 3
    assert "Error: N (500)" not in process.stdout
    assert "Selecting all 3 rows" in process.stdout


def test_only_the_sampled_clonotypes_are_bumped_to_the_final_stage(tmp_path):
    """main.py marks the sampled clonotypes with is_in. Passing a bare Series
    is deprecated in polars, which will read it element-wise and bump rows by
    position instead of by membership.

    This asserts the outcome, not the warning: when polars drops the warning the
    danger arrives, and a test that only watched stderr would turn green exactly
    then. With four keys and two selected, positional matching would mark the
    wrong rows and this fails."""
    process, selected, stages = run_main(tmp_path, ["9.5", "3.1", "100.7", "50.0"], n=2)

    assert process.returncode == 0

    sampled = set(selected["clonotypeKey"].to_list())
    assert sampled == {"c2", "c3"}, "top two by decreasing Col0 are 100.7 (c2) and 50.0 (c3)"

    bumped = set(stages.filter(pl.col("selectionStage") == 2)["clonotypeKey"].to_list())
    untouched = set(stages.filter(pl.col("selectionStage") == 1)["clonotypeKey"].to_list())

    assert bumped == sampled
    assert untouched == {"c0", "c1"}


def test_selection_stage_update_emits_no_deprecation_warning(tmp_path):
    """Secondary to the test above: the warning is the early signal, the stage
    assignment is the thing that must stay correct."""
    process, _, _ = run_main(tmp_path, ["9.5", "3.1", "100.7", "50.0"], n=2)

    assert process.returncode == 0
    assert "DeprecationWarning" not in process.stderr
