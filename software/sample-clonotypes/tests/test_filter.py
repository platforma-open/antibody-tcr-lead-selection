"""Behaviour of filter.py: the predicates, the numeric coercion, and the
selection-stage bookkeeping the funnel is drawn from.

The stage output is the part worth guarding hardest. Every clonotype must
appear in it exactly once: it becomes a PColumn keyed on clonotypeKey as a
unique axis, so a duplicate or a dropped key corrupts the funnel rather than
failing loudly.
"""

import json
import math
import subprocess
import sys
from pathlib import Path

import polars as pl
import pytest
from filter import (
    apply_filter,
    apply_filters,
    apply_precondition,
    coerce_numeric_columns,
    drop_empty_keys,
)
from hypothesis import given, settings
from hypothesis import strategies as st


def frame(**columns):
    """Clone table with a clonotypeKey per row, keys named from the first column."""
    length = len(next(iter(columns.values())))
    return pl.DataFrame({"clonotypeKey": [f"c{i}" for i in range(length)], **columns})


def keys(df):
    return df["clonotypeKey"].to_list()


# --------------------------------------------------------------------------
# apply_filter: one case per supported predicate
# --------------------------------------------------------------------------

NUMBERS = [1.0, 5.0, 10.0]
WORDS = ["alpha", "beta", "gamma"]


@pytest.mark.parametrize(
    "column, filter_type, reference, expected",
    [
        ("n", "number_greaterThan", 5, ["c2"]),
        ("n", "number_greaterThanOrEqualTo", 5, ["c1", "c2"]),
        ("n", "number_lessThan", 5, ["c0"]),
        ("n", "number_lessThanOrEqualTo", 5, ["c0", "c1"]),
        ("n", "number_equals", 5, ["c1"]),
        ("n", "number_notEquals", 5, ["c0", "c2"]),
        ("s", "string_equals", "beta", ["c1"]),
        ("s", "string_notEquals", "beta", ["c0", "c2"]),
        ("s", "string_contains", "a", ["c0", "c1", "c2"]),
        ("s", "string_doesNotContain", "a", []),
        ("s", "string_in", '["alpha", "gamma"]', ["c0", "c2"]),
        ("s", "string_notIn", '["alpha", "gamma"]', ["c1"]),
    ],
    ids=lambda value: str(value) if isinstance(value, str) else repr(value),
)
def test_each_predicate_keeps_the_rows_it_names(column, filter_type, reference, expected):
    df = frame(n=NUMBERS, s=WORDS)

    assert keys(apply_filter(df, column, filter_type, reference)) == expected


def test_string_in_accepts_a_list_as_well_as_a_json_string():
    """The workflow sends JSON, tests and callers may pass the list directly."""
    df = frame(s=WORDS)

    assert keys(apply_filter(df, "s", "string_in", ["alpha"])) == ["c0"]


def test_unknown_filter_type_raises():
    df = frame(n=NUMBERS)

    with pytest.raises(ValueError, match="Unknown filter type"):
        apply_filter(df, "n", "number_almostEquals", 5)


# --------------------------------------------------------------------------
# Missing values
# --------------------------------------------------------------------------


def test_numeric_filters_exclude_nan_and_null():
    """A clonotype with no usable number cannot satisfy a numeric threshold, so
    it is filtered out rather than compared."""
    df = frame(n=[1.0, float("nan"), None, 50.0])

    assert keys(apply_filter(df, "n", "number_greaterThan", 0)) == ["c0", "c3"]


def test_is_na_counts_null_and_empty_string_but_not_nan():
    """isNA tests the text form, so a NaN reads as "NaN" and is not NA — while
    every numeric filter still excludes it. Pinned because the two disagree."""
    numeric = frame(n=[1.0, float("nan"), None])
    assert keys(apply_filter(numeric, "n", "isNA", None)) == ["c2"]
    assert keys(apply_filter(numeric, "n", "isNotNA", None)) == ["c0", "c1"]

    text = frame(s=["value", "", None])
    assert keys(apply_filter(text, "s", "isNA", None)) == ["c1", "c2"]
    assert keys(apply_filter(text, "s", "isNotNA", None)) == ["c0"]


def test_drop_empty_keys_removes_rows_with_no_clonotype():
    """The upstream Full join can emit secondary-axis rows with no clonotype.
    Kept, they collide on the unique clonotypeKey axis of selectionStage."""
    df = pl.DataFrame({"clonotypeKey": ["a", "", None, "d"], "n": [1.0, 2.0, 3.0, 4.0]})

    assert keys(drop_empty_keys(df)) == ["a", "d"]


# --------------------------------------------------------------------------
# coerce_numeric_columns
# --------------------------------------------------------------------------


def test_empty_string_becomes_nan_and_unparseable_text_becomes_null():
    """parquetFileBuilder writes a missing number as "", so a numeric column
    with one gap arrives as text. Both results fail every numeric filter."""
    df = frame(v=["5", "", "not a number"])
    spec = {"v": {"type": "number_greaterThan", "reference": 0, "valueType": "Double"}}

    coerced = coerce_numeric_columns(df, spec)

    assert coerced["v"].dtype == pl.Float64
    values = coerced["v"].to_list()
    assert values[0] == 5.0
    assert math.isnan(values[1])
    assert values[2] is None
    assert keys(apply_filter(coerced, "v", "number_greaterThan", 0)) == ["c0"]


def test_string_columns_are_left_alone():
    df = frame(v=["alpha", "beta"])
    spec = {"v": {"type": "string_equals", "reference": "alpha", "valueType": "String"}}

    assert coerce_numeric_columns(df, spec)["v"].dtype == pl.String


def test_a_spec_for_an_absent_column_is_skipped():
    """The workflow can name a column the table does not carry; that must not
    stop the run."""
    df = frame(v=["1", "2"])
    spec = {"missing": {"type": "number_greaterThan", "reference": 0, "valueType": "Double"}}

    assert coerce_numeric_columns(df, spec).equals(df)


# --------------------------------------------------------------------------
# apply_precondition
# --------------------------------------------------------------------------


def test_precondition_reports_what_it_eliminated():
    df = frame(Precond_0=[1.0, 0.0, 2.0])
    spec = {"Precond_0": {"type": "number_greaterThan", "reference": 0, "valueType": "Double"}}

    survived, eliminated = apply_precondition(df, spec)

    assert keys(survived) == ["c0", "c2"]
    assert keys(eliminated) == ["c1"]


def test_no_precondition_columns_means_nothing_is_eliminated():
    df = frame(n=NUMBERS)

    survived, eliminated = apply_precondition(df, {"Precond_0": {"type": "isNotNA"}})

    assert keys(survived) == keys(df)
    assert eliminated is None


# --------------------------------------------------------------------------
# apply_filters: stage bookkeeping
# --------------------------------------------------------------------------


def test_stage_numbers_follow_the_order_the_filters_are_applied():
    """Stage 1 is the precondition, then one stage per Filter_* column, and
    survivors take the stage after the last one."""
    df = frame(
        Precond_0=[1.0, 1.0, 1.0, 0.0, 1.0],
        Filter_0=[10.0, 1.0, 10.0, 10.0, 1.0],
        Filter_1=[10.0, 10.0, 1.0, 10.0, 1.0],
    )
    above_five = {"type": "number_greaterThan", "reference": 5, "valueType": "Double"}
    positive = {"type": "number_greaterThan", "reference": 0, "valueType": "Double"}

    survivors, stages = apply_filters(df, {"Filter_0": above_five, "Filter_1": above_five}, {"Precond_0": positive})

    assert keys(survivors) == ["c0"]
    assert dict(zip(stages["clonotypeKey"], stages["selectionStage"])) == {
        "c3": 1,  # precondition
        "c1": 2,  # Filter_0
        "c4": 2,
        "c2": 3,  # Filter_1
        "c0": 4,  # survived everything
    }


def test_without_a_precondition_the_first_filter_is_stage_one():
    df = frame(Filter_0=[10.0, 1.0])
    above_five = {"type": "number_greaterThan", "reference": 5, "valueType": "Double"}

    survivors, stages = apply_filters(df, {"Filter_0": above_five})

    assert keys(survivors) == ["c0"]
    assert dict(zip(stages["clonotypeKey"], stages["selectionStage"])) == {"c1": 1, "c0": 2}


def test_no_filters_keeps_everything_and_marks_the_top_column():
    df = frame(n=NUMBERS)

    survivors, stages = apply_filters(df, {}, {})

    assert keys(survivors) == keys(df)
    assert survivors["top"].to_list() == [1, 1, 1]
    assert stages["selectionStage"].to_list() == [1, 1, 1]


def test_a_filter_whose_type_does_not_match_its_value_type_eliminates_nothing():
    """The workflow always pairs them, so this is a safety net: the stage is
    still consumed, keeping stage numbers aligned with the workflow's labels."""
    df = frame(Filter_0=["alpha", "beta"])
    mismatched = {"type": "number_greaterThan", "reference": 5, "valueType": "String"}

    survivors, stages = apply_filters(df, {"Filter_0": mismatched})

    assert keys(survivors) == keys(df)
    assert stages["selectionStage"].to_list() == [2, 2]


# --------------------------------------------------------------------------
# Invariants of the stage output
# --------------------------------------------------------------------------

# Float64, explicitly: a column reaches filter.py either already numeric or as
# text that coerce_numeric_columns casts to Float64. Building it from a bare
# list of None would give polars the Null dtype, which the pipeline never
# produces and which is_not_nan() cannot handle.
value_lists = st.lists(
    st.one_of(st.floats(min_value=-1e6, max_value=1e6, allow_nan=False), st.none()),
    min_size=1,
    max_size=40,
)


def numeric_frame(**columns):
    length = len(next(iter(columns.values())))
    return pl.DataFrame(
        {
            "clonotypeKey": [f"c{i}" for i in range(length)],
            **{name: pl.Series(values, dtype=pl.Float64) for name, values in columns.items()},
        }
    )


@given(first=value_lists, threshold=st.floats(min_value=-1e6, max_value=1e6, allow_nan=False))
@settings(max_examples=150, deadline=None)
def test_every_clonotype_is_staged_exactly_once(first, threshold):
    """The stage frame becomes a PColumn on a unique clonotypeKey axis. A
    duplicate or a dropped key corrupts the funnel silently, so this holds for
    any input, not just the shapes enumerated above."""
    df = numeric_frame(Filter_0=first, Filter_1=list(reversed(first)))
    above = {"type": "number_greaterThan", "reference": threshold, "valueType": "Double"}

    survivors, stages = apply_filters(df, {"Filter_0": above, "Filter_1": above})

    assert sorted(keys(stages)) == sorted(keys(df))
    assert len(set(keys(stages))) == stages.height


@given(values=value_lists, threshold=st.floats(min_value=-1e6, max_value=1e6, allow_nan=False))
@settings(max_examples=150, deadline=None)
def test_survivors_are_exactly_the_clonotypes_at_the_final_stage(values, threshold):
    """The funnel reads "selected" off the survivor stage, so the two views of
    the same answer must agree.

    The survivor stage is n_filters + offset + 1, a constant. It is not the
    largest stage present: when every clonotype is eliminated no row carries it,
    and reading max() instead would call the last eliminated batch the
    survivors."""
    df = numeric_frame(Filter_0=values)
    above = {"type": "number_greaterThan", "reference": threshold, "valueType": "Double"}

    survivors, stages = apply_filters(df, {"Filter_0": above})

    survivor_stage = 2  # one filter, no precondition
    at_survivor_stage = set(stages.filter(pl.col("selectionStage") == survivor_stage)["clonotypeKey"].to_list())

    assert at_survivor_stage == set(keys(survivors))
    assert set(keys(survivors)) <= set(keys(df))
    assert stages["selectionStage"].is_between(1, survivor_stage).all()


# --------------------------------------------------------------------------
# The command line: what the workflow actually invokes
# --------------------------------------------------------------------------

FILTER_CLI = Path(__file__).resolve().parents[1] / "src" / "filter.py"


def run_filter(tmp_path, df, filter_map):
    """Run filter.py end to end. Returns the process and both output frames."""
    clone = tmp_path / "clones.parquet"
    df.write_parquet(clone)
    out = tmp_path / "out.parquet"
    selection = tmp_path / "selection.parquet"

    process = subprocess.run(
        [
            sys.executable,
            str(FILTER_CLI),
            "--parquet",
            str(clone),
            "--out",
            str(out),
            "--filter-map",
            json.dumps(filter_map),
            "--emit-selection",
            str(selection),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return (
        process,
        pl.read_parquet(out) if out.exists() else None,
        pl.read_parquet(selection) if selection.exists() else None,
    )


def test_cli_writes_the_filtered_rows_and_their_stages(tmp_path):
    df = pl.DataFrame({"clonotypeKey": ["a", "b", "c"], "Filter_0": ["10", "", "1"]})
    above_five = {"type": "number_greaterThan", "reference": 5, "valueType": "Double"}

    process, filtered, stages = run_filter(tmp_path, df, {"Filter_0": above_five})

    assert process.returncode == 0
    assert keys(filtered) == ["a"]
    assert filtered["top"].to_list() == [1]
    assert dict(zip(stages["clonotypeKey"], stages["selectionStage"])) == {"a": 2, "b": 1, "c": 1}


def test_cli_drops_rows_with_no_clonotype_before_staging(tmp_path):
    """A secondary-axis row carries no clonotypeKey. It must reach neither
    output, or it collides on the unique clonotypeKey axis downstream."""
    df = pl.DataFrame({"clonotypeKey": ["a", "", "c"], "Filter_0": ["10", "10", "10"]})
    above_five = {"type": "number_greaterThan", "reference": 5, "valueType": "Double"}

    _, filtered, stages = run_filter(tmp_path, df, {"Filter_0": above_five})

    assert keys(filtered) == ["a", "c"]
    assert sorted(keys(stages)) == ["a", "c"]


def test_cli_writes_typed_empty_outputs_for_an_empty_input(tmp_path):
    """An empty clone table must still produce both files with the right
    schema; a downstream reader fails on a missing or untyped column."""
    empty = pl.DataFrame(schema={"clonotypeKey": pl.Utf8, "Filter_0": pl.Utf8})

    process, filtered, stages = run_filter(tmp_path, empty, {})

    assert process.returncode == 0
    assert filtered.height == 0
    assert filtered.schema == {"clonotypeKey": pl.Utf8, "top": pl.Int64}
    assert stages.height == 0
    assert stages.schema == {"clonotypeKey": pl.Utf8, "selectionStage": pl.Int64}
