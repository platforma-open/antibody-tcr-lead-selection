#!/usr/bin/env python3

import argparse
import polars as pl
import re
import os
import time
import json



# In Vivo Score: source column headers and composite weights
IN_VIVO_SCORE_SOURCES = {
    "inVivo_primaryAbundance": 0.40,
    "inVivo_fractionCDR": 0.35,
    "inVivo_nMutations": 0.25,
}


def compute_in_vivo_score(df):
    """Compute In Vivo Score: weighted percentile combination of primary abundance,
    CDR mutation fraction, and total nucleotide mutations.

    score = 0.40 * percentile(primaryAbundance)
          + 0.35 * percentile(fractionCDRMutations)
          + 0.25 * percentile(nMutations)

    percentile(x) = (average_rank(x) - 1) / (N - 1), where N = non-NA count.
    NA -> 0.0. When N = 1, percentile = 0.5.
    """
    missing = [col for col in IN_VIVO_SCORE_SOURCES if col not in df.columns]
    if missing:
        print(f"Warning: Missing In Vivo Score source columns: {missing}. Cannot compute score.")
        return df

    score_expr = pl.lit(0.0)
    for col_name, weight in IN_VIVO_SCORE_SOURCES.items():
        n = df[col_name].drop_nulls().len()
        if n == 0:
            pct = pl.lit(0.0)
        elif n == 1:
            pct = pl.when(pl.col(col_name).is_not_null()).then(0.5).otherwise(0.0)
        else:
            pct = (
                (pl.col(col_name).rank(method="average") - 1) / (n - 1)
            ).fill_null(0.0)
        score_expr = score_expr + pct * weight

    df = df.with_columns(score_expr.alias("inVivoScore"))
    print(f"Computed In Vivo Score for {df.height} rows")
    return df


def parse_arguments():
    parser = argparse.ArgumentParser(description="Rank rows based on Col* columns and output top N rows. Supports Col0, Col1 (clonotype properties), Col_cluster.0 (cluster properties), and Col_linker.0.0, Col_linker.0.1 (linker properties).")
    parser.add_argument("--parquet", required=True, help="Path to input Parquet file")
    parser.add_argument("--n", type=int, required=True, help="Number of top rows to output")
    parser.add_argument("--out", required=True, help="Path to output Parquet file")
    parser.add_argument("--ranking-map", type=str, help='JSON string specifying ranking direction for each column, e.g., {"Col0":"decreasing","Col1":"increasing","Col_linker.0.0":"decreasing"}')
    parser.add_argument("--diversification-column", type=str,
                        help="Column header name to use for diversified ranking (e.g., 'clusterAxis_0_0')")
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


def diversified_rank_and_select(df, n, ranking_map, all_ranking_cols, diversification_column=None):
    """
    Rank and select top N rows using diversified ranking.

    Algorithm:
    1. Sort by ranking criteria + clonotypeKey tiebreaker
    2. If diversification_column is set:
       a. Compute _local_rank = cumulative count within each group (preserves sort order)
       b. Re-sort by (_local_rank ASC, ranking criteria)
    3. Take top N
    4. Add ranked_order column
    """
    # Convert ranking columns to numeric types if they're strings
    for col in all_ranking_cols:
        if col in df.columns and df[col].dtype == pl.Utf8:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Float64))
                print(f"Converted ranking column '{col}' from string to numeric")
            except Exception as e:
                print(f"Warning: Could not convert column '{col}' to numeric: {e}")

    # Build sort criteria from ranking_map
    if all_ranking_cols:
        sort_columns = all_ranking_cols + ['clonotypeKey']
        sort_descending = [ranking_map.get(col, "decreasing") == "decreasing" for col in all_ranking_cols] + [False]
        print(f"Sorting by: {' -> '.join(sort_columns)}")
    else:
        sort_columns = ['clonotypeKey']
        sort_descending = [False]
        print("No ranking columns, sorting by clonotypeKey only")

    # Step 1: Sort by ranking criteria
    df = df.sort(sort_columns, descending=sort_descending)

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
        df = df.sort(final_sort_columns, descending=final_sort_descending)

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
    print(f"Starting clonotype sampling at {time.strftime('%H:%M:%S')}")
    args = parse_arguments()
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

    # Compute In Vivo Score if requested in ranking map
    if args.ranking_map:
        try:
            raw_map = json.loads(args.ranking_map)
            if "inVivoScore" in raw_map:
                df = compute_in_vivo_score(df)
                if "inVivoScore" in df.columns:
                    all_ranking_cols = ["inVivoScore"] + all_ranking_cols
                    print(f"  Added In Vivo Score computed from source columns: {list(IN_VIVO_SCORE_SOURCES.keys())}")
        except json.JSONDecodeError:
            pass  # Will be handled by parse_ranking_map

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
    if 'inVivoScore' in result.columns:
        output_columns['inVivoScore'] = result['inVivoScore']

    simplified_df = pl.DataFrame(output_columns)

    # Output simplified version to main output file
    simplified_df.write_parquet(args.out)
    output_time = time.time() - output_start
    print(f"Output: {output_time:.3f}s (wrote to {args.out})")

    total_time = time.time() - start_time
    print(f"Total time: {total_time:.3f}s")


if __name__ == "__main__":
    main()
