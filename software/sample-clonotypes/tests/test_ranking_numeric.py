"""Ranking has two modes, and most of this file holds for both.

`priority` is the block's original behaviour and the default: criteria apply in
order, each one separating only the candidates that tied exactly on every earlier
one. `balanced` replaces each criterion's values with their dense rank scaled to
[0, 1] and sums them weighted, so every criterion counts in proportion to its
weight and none is merely a tiebreaker.

With a single criterion the two modes agree exactly, so the coercion and
missing-value cases below are parametrised over both. Cases that turn on how
several criteria combine name their mode.

Numeric columns must be treated as numbers even when the clone table delivers
them as strings with "" in the gaps. inf and -inf parse to real floats and keep
the two ends of the scale. "" and NaN have no place on it and score 0, level with
the worst value present — and lose the resulting tie, so they still come last. A
clonotype holding one is kept, not dropped, and keeps whatever the other criteria
give it.
"""

import json

import polars as pl
import pytest

from main import composite_score, diversified_rank_and_select, parse_ranking_map


def clone_table(values, key_prefix="c"):
    """Clone table shaped as parquetFileBuilder writes it: one ranking column,
    missing values already collapsed to ""."""
    return pl.DataFrame(
        {
            "clonotypeKey": [f"{key_prefix}{i}" for i in range(len(values))],
            "Col0": values,
        }
    )


#: Both modes, for the cases that must agree between them.
MODES = ["priority", "balanced"]


def select(df, n, spec, cols, mode, **kw):
    """`diversified_rank_and_select` with the ranking map built from `spec`."""
    return diversified_rank_and_select(df, n, rmap(spec), cols, ranking_mode=mode, **kw)


def rmap(spec):
    """Ranking map as the workflow writes it: {column: {direction, weight}}.

    `spec` gives each column a direction, or a (direction, weight) pair. A bare
    direction gets an equal share, which is what the model emits for a list of
    equally weighted criteria."""
    equal_share = 1.0 / len(spec)
    return {
        col: {"direction": value[0], "weight": value[1]}
        if isinstance(value, tuple)
        else {"direction": value, "weight": equal_share}
        for col, value in spec.items()
    }


@pytest.mark.parametrize("mode", MODES)
def test_string_column_with_empty_gaps_ranks_numerically(mode):
    """MILAB-6954: as text, "9.5" > "100.7", so the highest value ranked last."""
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = select(df, 3, {"Col0": "decreasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c3", "c1", "c0"]
    assert result["ranked_order"].to_list() == [1, 2, 3]


@pytest.mark.parametrize("mode", MODES)
def test_empty_value_row_scores_worst_and_is_still_selectable(mode):
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = select(df, 4, {"Col0": "decreasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c3", "c1", "c0", "c2"]


@pytest.mark.parametrize("mode", MODES)
def test_empty_value_row_ranks_last_when_increasing(mode):
    """Last in either direction — never "smallest, therefore first". c2 holds no
    value and c3 holds 100.7, the worst value present; both score 0, and the
    missing-value tiebreaker puts the measured one first."""
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = select(df, 4, {"Col0": "increasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c0", "c1", "c3", "c2"]


@pytest.mark.parametrize("mode", MODES)
def test_inf_is_the_largest_and_minus_inf_the_smallest(mode):
    """A literal "inf" or "-inf" parses to a real float and keeps it. Both sit on
    the scale, at the two ends."""
    df = clone_table(["9.5", "inf", "100.7", "-inf"])

    result = select(df, 4, {"Col0": "decreasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c1", "c2", "c0", "c3"]


@pytest.mark.parametrize("mode", MODES)
def test_inf_ends_swap_when_the_direction_is_increasing(mode):
    df = clone_table(["9.5", "inf", "100.7", "-inf"])

    result = select(df, 4, {"Col0": "increasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c3", "c0", "c2", "c1"]


@pytest.mark.parametrize("mode", MODES)
def test_nan_and_empty_rank_behind_minus_inf(mode):
    """NaN has no place on the scale, so it scores with "". -inf does have a place
    and keeps the bottom of the scale — the same score of 0 — but it is a measured
    value, so it wins the tie and the two unmeasured rows fall behind it."""
    df = clone_table(["9.5", "NaN", "inf", "100.7", "-inf", ""])

    result = select(df, 6, {"Col0": "decreasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c2", "c3", "c0", "c4", "c1", "c5"]


@pytest.mark.parametrize("mode", MODES)
def test_nan_and_empty_still_rank_last_when_increasing(mode):
    """The same, with inf now the worst value present."""
    df = clone_table(["9.5", "NaN", "inf", "100.7", "-inf", ""])

    result = select(df, 6, {"Col0": "increasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c4", "c0", "c3", "c2", "c1", "c5"]


@pytest.mark.parametrize("mode", MODES)
def test_nan_and_inf_floats_get_the_same_treatment(mode):
    """Same when the column already arrives as Float64 — no "" anywhere."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": [9.5, float("nan"), float("inf"), 100.7],
        }
    )

    result = select(df, 4, {"Col0": "decreasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c2", "c3", "c0", "c1"]


@pytest.mark.parametrize("mode", MODES)
def test_unparseable_text_scores_worst(mode):
    df = clone_table(["9.5", "n/a", "100.7"])

    result = select(df, 3, {"Col0": "decreasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c2", "c0", "c1"]


@pytest.mark.parametrize("mode", MODES)
def test_increasing_direction_respected_on_coerced_column(mode):
    df = clone_table(["9.5", "10.2", "", "100.7"])

    result = select(df, 3, {"Col0": "increasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c0", "c1", "c3"]


def test_cluster_and_linker_columns_are_coerced_too():
    """Both columns are coerced, so "10" outranks "2" rather than losing to it as
    text. c1 is selected over c0 on the strength of its linker value: the cluster
    column no longer has first call on the order just for being added first."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2"],
            "Col_cluster.0": ["2", "", "10"],
            "Col_linker.0.0": ["5.5", "7.25", "40.1"],
        }
    )

    result = select(df, 2, {"Col_cluster.0": "decreasing", "Col_linker.0.0": "decreasing"}, ["Col_cluster.0", "Col_linker.0.0"], "balanced")

    assert result["clonotypeKey"].to_list() == ["c2", "c1"]


def test_a_priority_mode_map_carries_no_weights():
    """`priority` leaves the weight out of the map entirely, so that two blocks whose
    criteria and directions match are one computation however their stored weights
    differ. Parsing must not require it."""
    priority = json.dumps({"Col0": {"direction": "increasing"}, "Col1": {"direction": "decreasing"}})

    parsed = parse_ranking_map(priority, ["Col0", "Col1"])

    assert [parsed[c]["direction"] for c in ("Col0", "Col1")] == ["increasing", "decreasing"]
    # Balanced still sends it, and the sent value wins over the seeded share.
    balanced = json.dumps({"Col0": {"direction": "increasing", "weight": 0.75}})
    assert parse_ranking_map(balanced, ["Col0"])["Col0"]["weight"] == 0.75


def test_priority_mode_applies_criteria_strictly_in_order():
    """The behaviour `priority` exists to preserve. c0 leads on the first criterion and
    holds nothing on the second; the second is only a tiebreaker, and these two do not
    tie, so it never fires. Under `balanced` the second criterion would pull c1 up."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1"],
            "Col0": ["100.0", "1.0"],
            "Col1": ["", "1.0"],
        }
    )

    result = select(df, 2, {"Col0": "decreasing", "Col1": "decreasing"}, ["Col0", "Col1"],
                    "priority")

    assert result["clonotypeKey"].to_list() == ["c0", "c1"]


def test_priority_mode_lets_the_second_criterion_break_a_tie():
    """Where the first criterion does tie, the next one decides — and holding no value
    there loses."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1"],
            "Col0": ["3.0", "3.0"],
            "Col1": ["", "5.0"],
        }
    )

    result = select(df, 2, {"Col0": "decreasing", "Col1": "decreasing"}, ["Col0", "Col1"],
                    "priority")

    assert result["clonotypeKey"].to_list() == ["c1", "c0"]


def test_the_two_modes_disagree_on_the_same_input():
    """The same frame as the coercion case above, run both ways. Priority lets the
    cluster column settle it outright; balanced lets the linker value carry c1 past c0.
    This is the whole reason both modes exist."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2"],
            "Col_cluster.0": ["2", "", "10"],
            "Col_linker.0.0": ["5.5", "7.25", "40.1"],
        }
    )
    spec = {"Col_cluster.0": "decreasing", "Col_linker.0.0": "decreasing"}
    cols = ["Col_cluster.0", "Col_linker.0.0"]

    assert select(df, 2, spec, cols, "priority")["clonotypeKey"].to_list() == ["c2", "c0"]
    assert select(df, 2, spec, cols, "balanced")["clonotypeKey"].to_list() == ["c2", "c1"]


def test_weight_decides_which_criterion_wins():
    """c0 leads on Col0, c1 on Col1, and neither ties. Which one is selected is
    settled by the weights alone."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1"],
            "Col0": ["100.0", "1.0"],
            "Col1": ["1.0", "100.0"],
        }
    )

    first_heavy = select(df, 2, {"Col0": ("decreasing", 0.9), "Col1": ("decreasing", 0.1)}, ["Col0", "Col1"], "balanced")
    second_heavy = select(df, 2, {"Col0": ("decreasing", 0.1), "Col1": ("decreasing", 0.9)}, ["Col0", "Col1"], "balanced")

    assert first_heavy["clonotypeKey"].to_list() == ["c0", "c1"]
    assert second_heavy["clonotypeKey"].to_list() == ["c1", "c0"]


def test_constant_column_is_inert_but_a_gap_in_it_is_not():
    """A column holding one value everywhere cannot order anything, so the other
    criterion decides. Where some rows have no value, that same column does rank
    them below the rest, even though every value present is equal."""
    constant = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1"],
            "Col0": ["3.0", "3.0"],
            "Col1": ["1.0", "5.0"],
        }
    )

    result = select(constant, 2, {"Col0": "decreasing", "Col1": "decreasing"}, ["Col0", "Col1"], "balanced")

    assert result["clonotypeKey"].to_list() == ["c1", "c0"]

    with_gap = constant.with_columns(pl.Series("Col1", ["", "5.0"]))

    result = select(with_gap, 2, {"Col0": "decreasing", "Col1": "decreasing"}, ["Col0", "Col1"], "balanced")

    assert result["clonotypeKey"].to_list() == ["c1", "c0"]


def test_a_missing_value_scores_level_with_the_worst_and_rescales_nothing():
    """A missing value scores 0, exactly what the worst value present scores. The
    column occupies [0, 1] whether or not anything is missing, so a clonotype that
    holds no value here cannot move the score of one that does."""
    cfg = rmap({"Col0": "decreasing"})
    scored = lambda vals: [
        round(x, 6)
        for x in pl.DataFrame({"Col0": vals})
        .select(composite_score(pl.DataFrame({"Col0": vals}), cfg, ["Col0"]))
        .to_series()
        .to_list()
    ]

    assert scored([4.0, 50.0, 100.0, None]) == [0.0, 0.5, 1.0, 0.0]
    # Dropping the clonotype that holds nothing leaves the other three untouched.
    assert scored([4.0, 50.0, 100.0]) == [0.0, 0.5, 1.0]


def test_a_cluster_metric_scores_the_same_however_often_it_repeats():
    """A cluster-level column arrives repeated across the cluster's members. Dense
    rank numbers distinct values rather than rows, so three members holding 5.0
    score exactly what one member holding 5.0 scores. That is why cluster columns
    need no separate normalization over distinct clusters."""
    repeated = pl.DataFrame({"Col_cluster.0": [5.0, 5.0, 5.0, 1.0]})
    once = pl.DataFrame({"Col_cluster.0": [5.0, 1.0]})
    cfg = rmap({"Col_cluster.0": "decreasing"})

    def scores(df):
        return df.select(composite_score(df, cfg, ["Col_cluster.0"])).to_series().to_list()

    assert scores(repeated) == [1.0, 1.0, 1.0, 0.0]
    assert scores(once) == [1.0, 0.0]


@pytest.mark.parametrize("mode", MODES)
def test_already_numeric_column_with_nulls_is_unchanged(mode):
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": [9.5, 10.2, None, 100.7],
        }
    )

    result = select(df, 3, {"Col0": "decreasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c3", "c1", "c0"]


@pytest.mark.parametrize("mode", MODES)
def test_all_empty_column_falls_back_to_key_order(mode):
    """Nothing is rankable, so every clonotype scores 0 — there is no value for a
    missing one to rank behind. The clonotypeKey tiebreaker decides, and every
    clonotype stays selectable."""
    df = clone_table(["", "", ""])

    result = select(df, 3, {"Col0": "decreasing"}, ["Col0"], mode)

    assert result["clonotypeKey"].to_list() == ["c0", "c1", "c2"]


@pytest.mark.parametrize("mode", MODES)
def test_diversification_still_applies_after_coercion(mode):
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2", "c3"],
            "Col0": ["100.7", "90.1", "9.5", ""],
            "cluster_0": ["A", "A", "B", "B"],
        }
    )

    result = select(df, 2, {"Col0": "decreasing"}, ["Col0"], mode, diversification_column="cluster_0")

    assert result["clonotypeKey"].to_list() == ["c0", "c2"]


@pytest.mark.parametrize("mode", MODES)
def test_diversification_spreads_before_it_ranks(mode):
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

    result = select(df, 4, {"Col0": "decreasing"}, ["Col0"], mode, diversification_column="cluster_0")

    assert result["clonotypeKey"].to_list() == ["c0", "c2", "c3", "c1"]


@pytest.mark.parametrize("mode", MODES)
def test_unassigned_diversification_group_is_still_dropped(mode):
    """No cluster means nothing to diversify against — that row stays ineligible."""
    df = pl.DataFrame(
        {
            "clonotypeKey": ["c0", "c1", "c2"],
            "Col0": ["100.7", "90.1", "9.5"],
            "cluster_0": ["A", "B", ""],
        }
    )

    result = select(df, 3, {"Col0": "decreasing"}, ["Col0"], mode, diversification_column="cluster_0")

    assert result["clonotypeKey"].to_list() == ["c0", "c1"]


@pytest.mark.parametrize("mode", MODES)
def test_helper_columns_are_not_in_the_output(mode):
    df = clone_table(["9.5", ""])

    result = select(df, 2, {"Col0": "decreasing"}, ["Col0"], mode)

    assert "_local_rank" not in result.columns
    assert "_composite" not in result.columns
    assert "_missing" not in result.columns
