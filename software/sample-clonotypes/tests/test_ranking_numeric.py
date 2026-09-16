"""Ranking must treat numeric columns as numbers even when the clone table
delivers them as strings with "" in the gaps.

inf ranks as the largest value and -inf as the smallest. "" and NaN have no
place on the scale, so they rank last, behind inf and -inf. A clonotype that
holds one is kept, not dropped, and keeps its position on every other
criterion."""

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


def test_inf_is_the_largest_and_minus_inf_the_smallest():
    """A literal "inf" or "-inf" parses to a real float and keeps it. Both sit on
    the scale, at the two ends."""
    df = clone_table(["9.5", "inf", "100.7", "-inf"])

    result = diversified_rank_and_select(df, 4, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c1", "c2", "c0", "c3"]


def test_inf_ends_swap_when_the_direction_is_increasing():
    df = clone_table(["9.5", "inf", "100.7", "-inf"])

    result = diversified_rank_and_select(df, 4, {"Col0": "increasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c3", "c0", "c2", "c1"]


def test_nan_and_empty_rank_behind_inf_and_minus_inf():
    """NaN has no place on the scale, so it ranks with "" — behind -inf, which
    does."""
    df = clone_table(["9.5", "NaN", "inf", "100.7", "-inf", ""])

    result = diversified_rank_and_select(df, 6, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c2", "c3", "c0", "c4", "c1", "c5"]


def test_nan_and_empty_still_rank_last_when_increasing():
    df = clone_table(["9.5", "NaN", "inf", "100.7", "-inf", ""])

    result = diversified_rank_and_select(df, 6, {"Col0": "increasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c4", "c0", "c3", "c2", "c1", "c5"]


def test_nan_and_inf_floats_get_the_same_treatment():
    """Same when the column already arrives as Float64 — no "" anywhere."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": [9.5, float("nan"), float("inf"), 100.7],
        }
    )

    result = diversified_rank_and_select(df, 4, {"Col0": "decreasing"}, ["Col0"])

    assert result["clonotypeKey"].to_list() == ["c2", "c3", "c0", "c1"]


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


def test_missing_second_criterion_does_not_cost_first_criterion_standing():
    """c0 leads on the first criterion and has no value on the second. The second
    criterion is a tiebreaker, and c0 and c1 do not tie, so it never fires."""
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

    assert result["clonotypeKey"].to_list() == ["c0", "c1"]


def test_missing_second_criterion_loses_a_tie_on_the_first():
    """Where the first criterion does tie, the second decides — and having no
    value there loses."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1"],
            "Col0": ["3.0", "3.0"],
            "Col1": ["", "5.0"],
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


def test_diversification_spreads_before_it_ranks():
    """c3 has no ranking value but is the only member of cluster C, so it takes a
    first-of-group slot ahead of c1, the second member of cluster A. Diversifying
    across groups is what the setting asks for; the missing value only costs c3
    the ordering inside its own slot."""
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

    assert result["clonotypeKey"].to_list() == ["c0", "c2", "c3", "c1"]


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

    assert "_local_rank" not in result.columns
