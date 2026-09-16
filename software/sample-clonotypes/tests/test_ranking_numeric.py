"""Ranking must treat numeric columns as numbers even when the clone table
delivers them as strings with "" in the gaps, and must keep a clonotype that
has no usable value — behind every clonotype that has one."""

import polars as pl

from main import diversified_rank_and_select


def clone_table(values, key_prefix="c"):
    """Clone table shaped as parquetFileBuilder writes it: one ranking column,
    missing values already collapsed to ""."""
    return pl.DataFrame(
        {
            "clonotypeKey": [f"{key_prefix}{i}" for i in range(len(values))],
            "Col0": values,
        }
    )


def test_string_column_with_empty_gaps_ranks_numerically():
    """MILAB-6954: as text, "9.5" > "100.7", so the highest value ranked last."""
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = diversified_rank_and_select(df, 3, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c3", "c1", "c0"]
    assert result["ranked_order"].to_list() == [1, 2, 3]


def test_empty_value_row_ranks_last_and_is_still_selectable():
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = diversified_rank_and_select(df, 4, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c3", "c1", "c0", "c2"]


def test_empty_value_row_ranks_last_when_increasing():
    """Last means last in either direction — not "smallest, therefore first"."""
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = diversified_rank_and_select(df, 4, {"Col0": "increasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c0", "c1", "c3", "c2"]


def test_nan_and_inf_strings_rank_last():
    """A literal "NaN" or "inf" parses to a real float that polars sorts ahead of
    every finite value. Both must rank last instead."""
    df = clone_table(["9.5", "NaN", "inf", "100.7", "-inf", ""])

    result = diversified_rank_and_select(df, 6, {"Col0": "decreasing"}, ["Col0"])

    ranked = result["clonotypeKey"].to_list()
    assert ranked[:2] == ["c3", "c0"]
    assert sorted(ranked[2:]) == ["c1", "c2", "c4", "c5"]


def test_nan_and_inf_floats_rank_last():
    """Same when the column already arrives as Float64 — no "" anywhere."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": [9.5, float("nan"), float("inf"), 100.7],
        }
    )

    result = diversified_rank_and_select(df, 4, {"Col0": "decreasing"}, ["Col0"])

    ranked = result["clonotypeKey"].to_list()
    assert ranked[:2] == ["c3", "c0"]
    assert sorted(ranked[2:]) == ["c1", "c2"]


def test_unparseable_text_ranks_last():
    df = clone_table(["9.5", "n/a", "100.7"])

    result = diversified_rank_and_select(df, 3, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c2", "c0", "c1"]


def test_increasing_direction_respected_on_coerced_column():
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = diversified_rank_and_select(df, 3, {"Col0": "increasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c0", "c1", "c3"]


def test_cluster_and_linker_columns_are_coerced_too():
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2"],
            "Col_cluster.0": ["2", "", "10"],
            "Col_linker.0.0": ["5.5", "7.25", "40.1"],
        }
    )

    result = diversified_rank_and_select(
        df,
        2,
        {"Col_cluster.0": "decreasing", "Col_linker.0.0": "decreasing"},
        ["Col_cluster.0", "Col_linker.0.0"],
    )

    assert result["clonotypeKey"].to_list() == ["c2", "c0"]


def test_row_missing_one_of_two_ranking_values_ranks_behind_complete_rows():
    """c0 leads on the first criterion but has no value on the second. A complete
    row outranks it, however weak its first value."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1"],
            "Col0": ["100.0", "1.0"],
            "Col1": ["", "1.0"],
        }
    )

    result = diversified_rank_and_select(
        df, 2, {"Col0": "decreasing", "Col1": "decreasing"}, ["Col0", "Col1"]
    )

    assert result["clonotypeKey"].to_list() == ["c1", "c0"]


def test_already_numeric_column_with_nulls_is_unchanged():
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": [9.5, 10.2, None, 100.7],
        }
    )

    result = diversified_rank_and_select(df, 3, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c3", "c1", "c0"]


def test_all_empty_column_falls_back_to_key_order():
    """Nothing is rankable, so nothing outranks anything. The clonotypeKey
    tiebreaker decides, and every clonotype stays selectable."""
    df = clone_table(["", "", ""])

    result = diversified_rank_and_select(df, 3, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c0", "c1", "c2"]


def test_diversification_still_applies_after_coercion():
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": ["100.7", "90.1", "9.5", ""],
            "cluster_0": ["A", "A", "B", "B"],
        }
    )

    result = diversified_rank_and_select(
        df, 2, {"Col0": "decreasing"}, ["Col0"], diversification_column="cluster_0"
    )

    assert result["clonotypeKey"].to_list() == ["c0", "c2"]


def test_diversification_does_not_promote_an_unranked_clonotype():
    """c3 is the only member of cluster C, so diversification would hand it
    _local_rank 1. It has no ranking value, so it still goes last."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": ["100.7", "90.1", "9.5", ""],
            "cluster_0": ["A", "A", "B", "C"],
        }
    )

    result = diversified_rank_and_select(
        df, 4, {"Col0": "decreasing"}, ["Col0"], diversification_column="cluster_0"
    )

    assert result["clonotypeKey"].to_list()[-1] == "c3"


def test_unassigned_diversification_group_is_still_dropped():
    """No cluster means nothing to diversify against — that row stays ineligible."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2"],
            "Col0": ["100.7", "90.1", "9.5"],
            "cluster_0": ["A", "B", ""],
        }
    )

    result = diversified_rank_and_select(
        df, 3, {"Col0": "decreasing"}, ["Col0"], diversification_column="cluster_0"
    )

    assert result["clonotypeKey"].to_list() == ["c0", "c1"]


def test_helper_columns_are_not_in_the_output():
    df = clone_table(["9.5", ""])

    result = diversified_rank_and_select(df, 2, {"Col0": "decreasing"}, ["Col0"])

    assert "_unranked" not in result.columns
    assert "_local_rank" not in result.columns
