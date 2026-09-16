"""Failing tests for three defects found while reviewing PR #187.

Each test asserts the behaviour we want, so each one fails today. They are here
to pin the defects, not to pass. Delete the test or keep it green once the
matching fix lands.
"""

import subprocess
import sys
from pathlib import Path

import polars as pl
from main import validate_column_format

MAIN = Path(__file__).resolve().parents[1] / "src" / "main.py"


def run_main(tmp_path, values, n):
    """Run main.py end to end and return the completed process."""
    clone = tmp_path / "clones.parquet"
    pl.DataFrame(
        {
            "clonotypeKey": [f"c{i}" for i in range(len(values))],
            "Col0": values,
        }
    ).write_parquet(clone)

    selection = tmp_path / "selection.parquet"
    pl.DataFrame(
        {
            "clonotypeKey": [f"c{i}" for i in range(len(values))],
            "selectionStage": [1] * len(values),
        }
    ).write_parquet(selection)

    return subprocess.run(
        [
            sys.executable,
            str(MAIN),
            "--parquet",
            str(clone),
            "--n",
            str(n),
            "--out",
            str(tmp_path / "out.parquet"),
            "--ranking-map",
            '{"Col0":"decreasing"}',
            "--selection-in",
            str(selection),
            "--selection-out",
            str(tmp_path / "selection-out.parquet"),
        ],
        capture_output=True,
        text=True,
        check=False,
    )


def test_missing_clonotype_key_reports_its_error_instead_of_raising():
    """validate_column_format returns a bare False when clonotypeKey is absent,
    but main.py unpacks three values from it. The caller raises a TypeError, so
    the operator never sees the error message the function printed."""
    df = pl.DataFrame({"Col0": [1.0, 2.0]})

    clonotype_cols, cluster_cols, linker_cols = validate_column_format(df)

    assert clonotype_cols == ["Col0"]
    assert cluster_cols == []
    assert linker_cols == []


def test_n_larger_than_the_table_is_not_reported_as_an_error(tmp_path):
    """main.py clamps N to the row count and carries on, which is correct. It
    prints that clamp with an "Error:" prefix, so a reader grepping the log for
    a failure finds one that is not there."""
    result = run_main(tmp_path, ["9.5", "10.2", "100.7"], n=500)

    assert result.returncode == 0
    assert "Error:" not in result.stdout


def test_selection_stage_update_emits_no_deprecation_warning(tmp_path):
    """main.py passes a Series to is_in. Polars deprecated that form: it will
    switch to element-wise comparison, which silently bumps the wrong rows."""
    result = run_main(tmp_path, ["9.5", "10.2", "100.7"], n=2)

    assert result.returncode == 0
    assert "DeprecationWarning" not in result.stderr
