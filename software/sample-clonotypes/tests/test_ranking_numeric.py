"""Ranking must treat numeric columns as numbers even when the clone table
delivers them as strings with "" in the gaps."""

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


def test_empty_value_row_is_never_selected():
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = diversified_rank_and_select(df, 4, {"Col0": "decreasing"}, ["Col0"])

    assert result.height == 3
    assert "c2" not in result["clonotypeKey"].to_list()


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


def test_already_numeric_column_with_nulls_is_unchanged():
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": [9.5, 10.2, None, 100.7],
        }
    )

    result = diversified_rank_and_select(df, 4, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c3", "c1", "c0"]



def test_all_empty_column_selects_nothing():
    df = clone_table(["", "", ""])

    result = diversified_rank_and_select(df, 3, {"Col0": "decreasing"}, ["Col0"])

    assert result.height == 0


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
