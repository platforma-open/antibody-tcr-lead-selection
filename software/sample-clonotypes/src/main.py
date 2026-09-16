#!/usr/bin/env python3

import argparse
import polars as pl
import re
import os
import time
import json


def parse_arguments():
    parser = argparse.ArgumentParser(description="Rank rows based on Col* columns and output top N rows. Supports Col0, Col1 (clonotype properties), Col_cluster.0 (cluster properties), and Col_linker.0.0, Col_linker.0.1 (linker properties).")
    parser.add_argument("--parquet", required=True, help="Path to input Parquet file")
    parser.add_argument("--n", type=int, required=True, help="Number of top rows to output")
    parser.add_argument("--out", required=True, help="Path to output Parquet file")
    parser.add_argument("--ranking-map", type=str, help='JSON string specifying ranking direction for each column, e.g., {"Col0":"decreasing","Col1":"increasing","Col_linker.0.0":"decreasing"}')
    parser.add_argument("--diversification-column", type=str,
                        help="Column header name to use for diversified ranking (e.g., 'cluster_0')")
    parser.add_argument("--selection-in", type=str, required=False,
                        help="Path to selection stage parquet from filter.py (clonotypeKey + selectionStage)")
    parser.add_argument("--selection-out", type=str, required=False,
                        help="Path to write updated selection stage parquet (sampled clones get bumped stage)")
    return parser.parse_args()


def parse_ranking_map(ranking_map_str, all_col_columns):
    """Parse and validate the ranking map JSON string for all column types."""
    if not ranking_map_str:
        # Default behavior: all columns decreasing
        default_map = {col: "decreasing" for col in all_col_columns}
        if all_col_columns:  # Only print if there are ranking columns
            print(f"Using default ranking directions: {default_map}")
        return default_map

    try:
        ranking_map = json.loads(ranking_map_str)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in ranking-map: {e}")
        return None

    # Validate the ranking map
    valid_directions = ["increasing", "decreasing"]
    for col, direction in ranking_map.items():
        if direction not in valid_directions:
            print(f"Error: Invalid direction '{direction}' for column '{col}'. Must be 'increasing' or 'decreasing'.")
            return None
        if col not in all_col_columns:
            print(f"Warning: Column '{col}' in ranking-map not found in data. Ignoring.")

    # Fill in missing columns with default (decreasing)
    complete_map = {col: "decreasing" for col in all_col_columns}
    complete_map.update({col: direction for col, direction in ranking_map.items() if col in all_col_columns})

    print(f"Using ranking directions: {complete_map}")
    return complete_map


def validate_column_format(df):
    print("Found columns:", df.columns)

    # Check for clonotypeKey column
    if 'clonotypeKey' not in df.columns:
        print("Error: Input CSV must contain a 'clonotypeKey' column.")
        return False

    # Check for clonotype ranking columns (Col0, Col1, ...)
    clonotype_col_columns = sorted([col for col in df.columns if re.match(r'^Col\d+$', col)],
                                   key=lambda x: int(x[3:]))
    print("Found clonotype ranking columns:", clonotype_col_columns)

    # Check for cluster ranking columns (Col_cluster.0, Col_cluster.1, ...)
    cluster_col_columns = sorted([col for col in df.columns if re.match(r'^Col_cluster\.\d+$', col)],
                                 key=lambda x: int(x.split('.')[1]))
    print("Found cluster ranking columns:", cluster_col_columns)

    # Check for linker ranking columns (Col_linker.0, Col_linker.0.0, Col_linker.0.1, etc.)
    linker_col_columns = sorted([col for col in df.columns if re.match(r'^Col_linker\.\d+(?:\.\d+)?$', col)],
                                key=lambda x: tuple(map(int, x.split('.')[1:])))
    print("Found linker ranking columns:", linker_col_columns)

    return clonotype_col_columns, cluster_col_columns, linker_col_columns


def coerce_ranking_columns(df, ranking_cols):
    """Make every ranking column a float whose unrankable entries are null.

    The clone table is written by parquetFileBuilder with naStr and nullStr "".
    A numeric column with one missing value arrives as Utf8 with "" in the gaps.
    The model offers only non-String columns for ranking, so every ranking
    column holds numbers. The cast is non-strict: "" and any text that is not a
    number become null.

    "NaN", "inf", "-inf" and "Infinity" parse to real floats. Polars sorts NaN
    ahead of every finite value and inf ahead of every finite value when the
    direction is decreasing, so they are folded into null as well. Null ranks
    last (see diversified_rank_and_select). A Float64 column that already holds
    NaN or inf gets the same treatment.
    """
    for col in ranking_cols:
        if col not in df.columns:
            continue

        dtype = df.schema[col]

        if dtype == pl.Utf8:
            blank = df[col].is_null().sum() + (df[col] == "").sum()
            df = df.with_columns(pl.col(col).cast(pl.Float64, strict=False))
            print(f"Cast ranking column '{col}' from string to numeric")

            unparsed = df[col].null_count() - blank
            if unparsed > 0:
                print(f"Ranking column '{col}': {unparsed} values did not parse as "
                      f"numbers. They rank last.")
            dtype = df.schema[col]

        if dtype in (pl.Float32, pl.Float64):
            # is_finite() is null where the value is null, so this counts NaN and
            # +/-inf only.
            nonfinite = (~df[col].is_finite()).sum()
            if nonfinite:
                df = df.with_columns(
                    pl.when(pl.col(col).is_finite())
                    .then(pl.col(col))
                    .otherwise(None)
                    .alias(col)
                )
                print(f"Ranking column '{col}': {nonfinite} NaN/inf values. "
                      f"They rank last.")

    return df


def diversified_rank_and_select(df, n, ranking_map, all_ranking_cols, diversification_column=None):
    """
    Rank and select top N rows using diversified ranking.

    Algorithm:
    1. Sort by ranking criteria + clonotypeKey tiebreaker, nulls last
    2. If diversification_column is set:
       a. Compute _local_rank = cumulative count within each group (preserves sort order)
       b. Re-sort by (_local_rank ASC, ranking criteria)
    3. Take top N
    4. Add ranked_order column

    A clonotype with no value in a ranking column is kept. It ranks last within
    that column and keeps its standing on every other criterion.
    A clonotype with no diversification group is dropped.
    """
    df = coerce_ranking_columns(df, all_ranking_cols)

    # A null diversification value means the clonotype belongs to no group, so it
    # cannot be diversified against and is not eligible for selection. It still
    # appears in the funnel at its "passed filters" stage; it is simply never
    # sampled. Ranking columns are NOT dropped — see the sort below.
    if diversification_column and diversification_column in df.columns:
        before_null_drop = df.height
        df = df.drop_nulls(subset=[diversification_column])
        print(f"Dropped null '{diversification_column}' rows: "
              f"{before_null_drop} -> {df.height}")

    # A clonotype with no cluster assigned cannot be diversified against, so it is
    # not eligible for selection. It arrives here as an EMPTY STRING, not a null:
    # pframes.parquetFileBuilder defaults naStr/nullStr to "" when writing the
    # clone table, so the Full join's unmatched keys become "" and drop_nulls above
    # never sees them. Scoped to the diversification column only — ranking columns
    # are cast to numeric above, where a missing value is already a real null.
    if diversification_column and diversification_column in df.columns:
        if df[diversification_column].dtype == pl.Utf8:
            before_empty_drop = df.height
            df = df.filter(pl.col(diversification_column) != "")
            print(f"Dropped rows with unassigned '{diversification_column}': "
                  f"{before_empty_drop} -> {df.height}")

    # Build sort criteria from ranking_map
    if all_ranking_cols:
        sort_columns = all_ranking_cols + ['clonotypeKey']
        sort_descending = [ranking_map.get(col, "decreasing") == "decreasing" for col in all_ranking_cols] + [False]
        print(f"Sorting by: {' -> '.join(sort_columns)}")
    else:
        sort_columns = ['clonotypeKey']
        sort_descending = [False]
        print("No ranking columns, sorting by clonotypeKey only")

    # A missing ranking value costs the clonotype only inside its own column:
    # nulls_last puts it behind every clonotype that holds a value there, in either
    # direction. Its standing on the other criteria is untouched, and it is never
    # dropped. The criteria are one sort, so a later criterion only separates
    # clonotypes that tie exactly on every earlier one.
    if all_ranking_cols:
        missing = int(
            df.select(
                pl.any_horizontal([pl.col(col).is_null() for col in all_ranking_cols])
            ).to_series().sum()
        )
        if missing:
            print(f"{missing} clonotypes have no value in at least one ranking "
                  f"column. They rank last in that column only.")

    # Step 1: Sort by ranking criteria
    df = df.sort(sort_columns, descending=sort_descending, nulls_last=True)

    # Step 2: If diversification_column is set, compute local rank and re-sort
    if diversification_column and diversification_column in df.columns:
        print(f"Diversifying by column: {diversification_column}")

        # Compute _local_rank: cumulative count within each group (1-based)
        # Since df is already sorted by ranking criteria, row_nr() within each group
        # gives us the local rank preserving the ranking order
        df = df.with_columns(
            pl.col(diversification_column).cum_count().over(diversification_column).alias("_local_rank")
        )

        # Re-sort by (_local_rank ASC, ranking criteria)
        final_sort_columns = ["_local_rank"] + sort_columns
        final_sort_descending = [False] + sort_descending
        df = df.sort(final_sort_columns, descending=final_sort_descending, nulls_last=True)

        # Take top N
        result = df.head(n)

        # Drop _local_rank
        result = result.drop("_local_rank")
    else:
        if diversification_column:
            print(f"Warning: Diversification column '{diversification_column}' not found in data. Skipping diversification.")
        # No diversification: plain sort, take top N
        result = df.head(n)

    # Add ranked_order column
    result = result.with_columns(pl.arange(1, result.height + 1).alias("ranked_order"))
    return result


def main():
    start_time = time.time()
    print(f"main.py:START at {time.strftime('%H:%M:%S')}")
    args = parse_arguments()
    print(f"main.py:args: parquet={args.parquet} out={args.out} selection_in={args.selection_in} selection_out={args.selection_out}")
    # Handle deprecated flags: map old args to new diversification-column
    diversification_column = args.diversification_column

    # Load Parquet file
    load_start = time.time()
    try:
        df = pl.read_parquet(args.parquet)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    load_time = time.time() - load_start
    print(f"Data loading: {load_time:.3f}s ({df.height:,} rows, {len(df.columns)} columns)")

    # Validate N
    if args.n <= 0:
        print("Error: N must be a positive integer.")
        return
    if args.n > df.height:
        print(f"Error: N ({args.n}) is greater than the number of rows in the table ({df.height}).")
        args.n = df.height

    # Validate columns
    validation_start = time.time()
    clonotype_col_columns, cluster_col_columns, linker_col_columns = validate_column_format(df)
    validation_time = time.time() - validation_start

    all_ranking_cols = cluster_col_columns + linker_col_columns + clonotype_col_columns
    total_ranking_cols = len(all_ranking_cols)
    print(f"Validation: {validation_time:.3f}s")
    print(f"  Found {total_ranking_cols} ranking columns " +
          f"({len(clonotype_col_columns)} clonotype, {len(cluster_col_columns)} cluster, " +
          f"{len(linker_col_columns)} linker)")

    # Parse ranking map
    ranking_map = parse_ranking_map(args.ranking_map, all_ranking_cols)
    if ranking_map is None:
        print("Error: Invalid ranking-map provided. Exiting.")
        return

    # Rank and select
    ranking_start = time.time()
    if not all_ranking_cols:
        print("WARNING: No ranking columns provided, selection will be done in table order")

    result = diversified_rank_and_select(df, args.n, ranking_map, all_ranking_cols, diversification_column)
    ranking_time = time.time() - ranking_start
    print(f"Ranking + selection: {ranking_time:.3f}s (selected {result.height} clonotypes)")

    # Create and output simplified version with top clonotypes only
    output_start = time.time()
    output_columns = {}
    if diversification_column and diversification_column in df.columns:
        output_columns[diversification_column] = result[diversification_column]
    output_columns['clonotypeKey'] = result['clonotypeKey']
    output_columns['top'] = [1] * result.height
    output_columns['ranked_order'] = result['ranked_order']

    simplified_df = pl.DataFrame(output_columns)

    # Output simplified version to main output file
    simplified_df.write_parquet(args.out)
    output_time = time.time() - output_start
    print(f"Output: {output_time:.3f}s (wrote to {args.out})")

    # Update selection stage data: bump sampled clones to a new final stage
    if args.selection_in and args.selection_out:
        selection = pl.read_parquet(args.selection_in)
        print(f"main.py:read selection_in: schema={selection.schema} rows={selection.height}")
        sampled_keys = result.select("clonotypeKey")
        max_stage = selection["selectionStage"].max() or 0
        selection = selection.with_columns(
            pl.when(pl.col("clonotypeKey").is_in(sampled_keys["clonotypeKey"]))
            .then(pl.lit(max_stage + 1).cast(pl.Int64))
            .otherwise(pl.col("selectionStage"))
            .alias("selectionStage")
        )
        print(f"main.py:writing selection_out: schema={selection.schema} rows={selection.height}")
        selection.write_parquet(args.selection_out)
        print(f"main.py:wrote selection_out: bumped {sampled_keys.height} sampled clones to stage {max_stage + 1}")
    else:
        print(f"main.py:WARNING: --selection-in/--selection-out not both set")

    total_time = time.time() - start_time
    print(f"main.py:DONE in {total_time:.3f}s")


if __name__ == "__main__":
    main()
