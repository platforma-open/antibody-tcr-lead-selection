#!/usr/bin/env python3

import argparse
import polars as pl
import re
import os
import json
import time


def parse_arguments():
    parser = argparse.ArgumentParser(description="Filter rows based on Filter_* columns using provided filter specifications.")
    parser.add_argument("--parquet", required=True, help="Path to input Parquet file")
    parser.add_argument("--out", required=True, help="Path to output Parquet file")
    parser.add_argument("--filter-map", required=True, help="JSON string containing filter mapping")
    parser.add_argument("--precondition-map", required=False,
                        help='JSON string mapping Precond_* columns to filter specifications, e.g. '
                             '{"Precond_0":{"type":"number_greaterThan","reference":0,"valueType":"Double"}}. '
                             'Applied as a single selection stage ahead of the user filters.')
    parser.add_argument("--emit-selection", required=False, help="Path to output selection stage parquet (clonotypeKey + selectionStage)")
    return parser.parse_args()


def apply_filter(df, column_name, filter_type, reference_value):
    """
    Apply a filter to a Polars DataFrame column based on the filter type and reference value.

    Args:
        df: polars DataFrame
        column_name: name of the column to filter on
        filter_type: type of filter to apply
        reference_value: reference value for the filter (None for isNA/isNotNA)

    Returns:
        polars DataFrame with filtered rows
    """

    print(f"Applying filter: {column_name} {filter_type} {reference_value}")

    if filter_type == "isNA":
        return df.filter(pl.col(column_name).is_null() | (pl.col(column_name).cast(pl.Utf8) == ""))
    elif filter_type == "isNotNA":
        return df.filter(pl.col(column_name).is_not_null() & (pl.col(column_name).cast(pl.Utf8) != ""))
    elif filter_type == "number_greaterThan":
        return df.filter((pl.col(column_name) > reference_value) & (pl.col(column_name).is_not_nan()))
    elif filter_type == "number_greaterThanOrEqualTo":
        return df.filter((pl.col(column_name) >= reference_value) & (pl.col(column_name).is_not_nan()))
    elif filter_type == "number_lessThan":
        return df.filter((pl.col(column_name) < reference_value) & (pl.col(column_name).is_not_nan()))
    elif filter_type == "number_lessThanOrEqualTo":
        return df.filter((pl.col(column_name) <= reference_value) & (pl.col(column_name).is_not_nan()))
    elif filter_type == "number_equals":
        return df.filter((pl.col(column_name) == reference_value) & (pl.col(column_name).is_not_nan()))
    elif filter_type == "number_notEquals":
        return df.filter((pl.col(column_name) != reference_value) & (pl.col(column_name).is_not_nan()))
    elif filter_type == "string_equals":
        return df.filter(pl.col(column_name) == str(reference_value))
    elif filter_type == "string_notEquals":
        return df.filter(pl.col(column_name) != str(reference_value))
    elif filter_type == "string_contains":
        return df.filter(pl.col(column_name).str.contains(str(reference_value)))
    elif filter_type == "string_doesNotContain":
        return df.filter(~pl.col(column_name).str.contains(str(reference_value)))
    elif filter_type == "string_in":
        values = json.loads(reference_value) if isinstance(reference_value, str) else reference_value
        return df.filter(pl.col(column_name).is_in([str(v) for v in values]))
    elif filter_type == "string_notIn":
        values = json.loads(reference_value) if isinstance(reference_value, str) else reference_value
        return df.filter(~pl.col(column_name).is_in([str(v) for v in values]))
    else:
        raise ValueError(f"Unknown filter type '{filter_type}' for column \
                         '{column_name}'. Supported types: number_greaterThan, \
                            number_greaterThanOrEqualTo, number_lessThan, \
                            number_lessThanOrEqualTo, number_equals, \
                            number_notEquals, string_equals, string_notEquals, \
                            string_contains, string_doesNotContain, \
                            string_in, string_notIn, isNA, isNotNA")


def drop_empty_keys(df):
    """Remove rows with null or empty clonotypeKey.

    The clone table is built with a Full join upstream, which can introduce rows
    from secondary-axis columns (cluster/linker) that are not tied to any
    clonotype. Their clonotypeKey is null (empty string after the parquet
    round-trip). Such rows are not real clonotypes; if kept they collide on any
    PColumn built with clonotypeKey as a unique axis (e.g. selectionStage).
    Dropping them at load keeps both the filtered output and the selection-stage
    output clean.
    """
    before = df.height
    df = df.filter(
        pl.col("clonotypeKey").is_not_null()
        & (pl.col("clonotypeKey").cast(pl.Utf8) != "")
    )
    dropped = before - df.height
    if dropped > 0:
        print(f"drop_empty_keys: removed {dropped} rows with empty/null clonotypeKey")
    return df


def coerce_numeric_columns(df, spec_map):
    """Cast string-typed columns to numeric where a numeric filter targets them.

    The clone table is written with parquetFileBuilder, whose naStr/nullStr default
    to "", so a column with any missing value arrives as Utf8 with "" in the gaps.
    Numeric comparisons need a real numeric dtype, and "" must become NaN so the
    is_not_nan() guard in apply_filter() excludes those rows.

    Float64 is the target for every numeric column, integer-valued ones included:
    the "" gaps become NaN, which no integer dtype can hold, and the comparisons in
    apply_filter() behave the same on either dtype.
    """
    for column in spec_map.keys():
        if column not in df.columns:
            print(f"Column '{column}' from spec map not present in table. Skipping cast.")
            continue

        spec = spec_map[column]
        filter_type = spec["type"]
        data_type = spec["valueType"]
        # Check data type if filters are non-string and correct for the given data type
        if ((data_type != "String") and (filter_type.startswith("number_"))):

            if df.schema[column] == pl.String:
                print(f"Data type inconsistency in column {column}. Casting to Float64.")
                # Most common case is that zero values are represented as ""
                nulls_before = df.select(pl.col(column).is_null().sum()).item()
                df = df.with_columns(
                    pl.col(column).replace("", float("NaN")).cast(pl.Float64, strict=False)
                )
                nulls_after = df.select(pl.col(column).is_null().sum()).item()
                # A non-numeric value becomes null rather than aborting the run, but it
                # then fails every numeric filter, so report it instead of losing it.
                if nulls_after > nulls_before:
                    print(f"Column {column}: {nulls_after - nulls_before} values could not be "
                          f"parsed as numbers and became null. They pass no numeric filter.")

    return df


def apply_precondition(df, precondition_map):
    """Apply the target-presence precondition as one combined step.

    Every Precond_* column must pass its predicate (AND across enrichment
    sources): an element judged by a source's cluster-level score must also be
    backed by that source's own per-element Max Frequency. Unlike the user
    filters this is not a tunable, so it is reported as a single stage rather
    than one stage per source.

    Returns (filtered df, eliminated clonotypeKey df or None).
    """
    precond_columns = sorted([col for col in df.columns if re.match(r'^Precond_\d+$', col)],
                             key=lambda x: int(x[8:]))  # Extract number after "Precond_"

    print(f"Found Precond_* columns: {precond_columns}")

    if not precond_columns:
        print("No Precond_* columns in table; target-presence precondition not applied.")
        return df, None

    before_keys = df.select("clonotypeKey")
    for column_name in precond_columns:
        spec = precondition_map.get(column_name)
        if spec is None:
            print(f"No precondition spec for column '{column_name}'. Skipping.")
            continue
        before_rows = df.height
        df = apply_filter(df, column_name, spec["type"], spec.get("reference"))
        print(f"Precondition '{column_name}' {spec['type']} {spec.get('reference')}: "
              f"{before_rows} -> {df.height} rows")

    eliminated = before_keys.join(df.select("clonotypeKey"), on="clonotypeKey", how="anti")
    return df, eliminated


def apply_filters(df, filter_map, precondition_map=None):
    """
    Apply the target-presence precondition and all filters specified in the
    filter_map to the DataFrame.
    If both maps are empty, return the input table with a "top" column added with value 1.

    Args:
        df: polars DataFrame
        filter_map: dictionary mapping column names to filter specifications
        precondition_map: dictionary mapping Precond_* columns to filter
            specifications, applied together as stage 1

    Returns:
        tuple of (filtered polars DataFrame, selection stage polars DataFrame)
        Selection stage DataFrame has columns: clonotypeKey, selectionStage (Int64)
        selectionStage = stage index (1-based) that eliminated the clone, or
        N_filters+offset+1 for clones that survived everything, where offset is 1
        when a precondition is applied and 0 otherwise.
    """
    precondition_map = precondition_map or {}

    # If there is nothing to apply, all clones survive (stage 1)
    if not filter_map and not precondition_map:
        print("No filters or preconditions to apply. Returning input table with 'top' column added.")
        selection_df = df.select("clonotypeKey").with_columns(
            pl.lit(1).cast(pl.Int64).alias("selectionStage")
        )
        return df.with_columns(pl.lit(1).alias("top")), selection_df

    filtered_df = df.clone()
    selection_parts = []

    # Target-presence precondition: one tracked stage ahead of the user filters.
    # The offset is derived from the map being non-empty — the same condition the
    # workflow uses to decide whether to emit the stage label — so labels and
    # stage numbers stay aligned even if the columns are absent from the table.
    stage_offset = 1 if precondition_map else 0
    if precondition_map:
        filtered_df, eliminated_by_precondition = apply_precondition(filtered_df, precondition_map)
        if eliminated_by_precondition is not None and eliminated_by_precondition.height > 0:
            selection_parts.append(
                eliminated_by_precondition.with_columns(
                    pl.lit(1).cast(pl.Int64).alias("selectionStage")
                )
            )

    initial_rows = filtered_df.height

    # Find all Filter_* columns in the DataFrame
    filter_columns = sorted([col for col in df.columns if re.match(r'^Filter_\d+$', col)],
                           key=lambda x: int(x[7:]))  # Extract number after "Filter_"

    print(f"Found Filter_* columns: {filter_columns}")
    print(f"Filter map keys: {list(filter_map.keys())}")

    n_filters = len(filter_columns)

    # Apply filters
    for stage_idx, column_name in enumerate(filter_columns, start=stage_offset + 1):
        filter_spec = filter_map.get(column_name)
        if filter_spec is None:
            # The workflow always pairs a Filter_<i> column with a filter_map entry,
            # so this is a safety net rather than an expected state. The stage index
            # is still consumed so stage numbers stay aligned with the workflow's
            # stage labels; it simply eliminates nothing.
            print(f"No filter spec for column '{column_name}'. Skipping.")
            continue

        filter_type = filter_spec["type"]
        reference_value = filter_spec.get("reference")
        data_type = filter_spec["valueType"]

        before_keys = filtered_df.select("clonotypeKey")

        # isNA/isNotNA applies to any data type
        if filter_type in ("isNA", "isNotNA"):
            filtered_df = apply_filter(filtered_df, column_name, filter_type, reference_value)
            rows_after_filter = filtered_df.height
            print(f"Filter '{column_name}' {filter_type}: {initial_rows} -> {rows_after_filter} rows")
            initial_rows = rows_after_filter
        # Apply the filter if is correct for the given data type
        elif (((data_type == "String") and (filter_type.startswith("string_"))) or
              ((data_type != "String") and (filter_type.startswith("number_")))):
            filtered_df = apply_filter(filtered_df, column_name, filter_type, reference_value)

            rows_after_filter = filtered_df.height
            print(f"Filter '{column_name}' {filter_type} {reference_value}: {initial_rows} -> {rows_after_filter} rows")
            initial_rows = rows_after_filter

        # Track eliminated clones at this stage
        after_keys = filtered_df.select("clonotypeKey")
        eliminated = before_keys.join(after_keys, on="clonotypeKey", how="anti")
        if eliminated.height > 0:
            selection_parts.append(
                eliminated.with_columns(pl.lit(stage_idx).cast(pl.Int64).alias("selectionStage"))
            )

    # Surviving clones get selectionStage = N_filters + offset + 1
    survivors = filtered_df.select("clonotypeKey").with_columns(
        pl.lit(n_filters + stage_offset + 1).cast(pl.Int64).alias("selectionStage")
    )
    selection_parts.append(survivors)

    selection_df = pl.concat(selection_parts)
    print(f"Selection stage tracking: {selection_df.height} total clones across "
          f"{n_filters + stage_offset} stages ({stage_offset} precondition, {n_filters} filter)")

    return filtered_df, selection_df


def main():
    start_time = time.time()
    print(f"filter.py:main() START at {time.strftime('%H:%M:%S')}")

    args = parse_arguments()
    print(f"filter.py:args: parquet={args.parquet} out={args.out} emit_selection={args.emit_selection}")

    # Load Parquet file
    load_start = time.time()
    try:
        df = pl.read_parquet(args.parquet)
    except Exception as e:
        print(f"Error reading file: {e}")
        return
    
    load_time = time.time() - load_start
    print(f"Data loading: {load_time:.3f}s ({df.height:,} rows, {len(df.columns)} columns)")

    # Check if file is empty
    if df.height == 0:
        print("Warning: Input Parquet file is empty. Creating empty output file with minimal headers.")
        empty_df = pl.DataFrame(schema={
            'clonotypeKey': pl.Utf8,
            'top': pl.Int64,
        })
        empty_df.write_parquet(args.out)
        if args.emit_selection:
            empty_selection = pl.DataFrame(schema={
                'clonotypeKey': pl.Utf8,
                'selectionStage': pl.Int64,
            })
            empty_selection.write_parquet(args.emit_selection)
        total_time = time.time() - start_time
        print(f"Empty output file created: {args.out}")
        print(f"Total time: {total_time:.3f}s")
        return

    # Drop empty/null clonotypeKey rows once, at the source, so both the filtered
    # output (args.out) and the selection-stage output are free of Full-join
    # secondary-axis rows that would collide on a unique clonotypeKey axis.
    df = drop_empty_keys(df)

    # Parse filter map from JSON string
    try:
        filter_map = json.loads(args.filter_map)
        print(f"Loaded filter map: {filter_map}")
    except json.JSONDecodeError as e:
        print(f"Error parsing filter map JSON: {e}")
        return

    # Parse precondition map from JSON string
    precondition_map = {}
    if args.precondition_map:
        try:
            precondition_map = json.loads(args.precondition_map)
            print(f"Loaded precondition map: {precondition_map}")
        except json.JSONDecodeError as e:
            print(f"Error parsing precondition map JSON: {e}")
            return

    # Make sure numeric columns where loaded as such. Precondition columns need the
    # same treatment as filter columns: they arrive as Utf8 with "" for elements the
    # enrichment source never observed, and "" must become NaN to be excluded.
    df = coerce_numeric_columns(df, {**filter_map, **precondition_map})

    # Optional primary filter (PlDatasetSelector): a pre-condition, not a tracked
    # stage. The Full join keeps all clonotypes (null/empty for those outside the
    # filter), so narrow here, before stage tracking — not via join semantics.
    if "primary_filter" in df.columns:
        before_primary = df.height
        df = df.filter(
            pl.col("primary_filter").is_not_null()
            & (pl.col("primary_filter").cast(pl.Utf8) != "")
        )
        print(f"Primary filter pre-drop: {before_primary} -> {df.height} rows")

    # Apply filters
    filtering_start = time.time()
    print(f"Initial rows: {df.height}")
    filtered_df, selection_df = apply_filters(df, filter_map, precondition_map)
    filtering_time = time.time() - filtering_start
    print(f"Rows after filtering: {filtered_df.height}")
    print(f"Filtering: {filtering_time:.3f}s")

    # Add a column named top with value 1
    filtered_df = filtered_df.with_columns(pl.lit(1).alias("top"))

    # Output filtered data to parquet
    output_start = time.time()
    if filtered_df.height == 0:
        print("Warning: No rows remain after filtering. Creating empty output file.")

    filtered_df.write_parquet(args.out)
    output_time = time.time() - output_start
    print(f"Output: {output_time:.3f}s (wrote to {args.out})")

    # Write selection stage data if requested
    if args.emit_selection:
        print(f"filter.py:writing selection parquet: schema={selection_df.schema} rows={selection_df.height}")
        selection_df.write_parquet(args.emit_selection)
        print(f"filter.py:wrote selection parquet: {args.emit_selection}")
    else:
        print(f"filter.py:WARNING: --emit-selection not passed")

    total_time = time.time() - start_time
    print(f"filter.py:DONE in {total_time:.3f}s")

if __name__ == "__main__":
    main() 