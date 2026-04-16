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


def apply_filters(df, filter_map):
    """
    Apply all filters specified in the filter_map to the DataFrame.
    If filter_map is empty, return the input table with a "top" column added with value 1.

    Args:
        df: polars DataFrame
        filter_map: dictionary mapping column names to filter specifications

    Returns:
        tuple of (filtered polars DataFrame, selection stage polars DataFrame or None)
        Selection stage DataFrame has columns: clonotypeKey, selectionStage (Int32)
        selectionStage = filter index (1-based) that eliminated the clone,
        or N_filters+1 for clones that survived all filters.
    """
    # If filter_map is empty, all clones survive (stage 1)
    if not filter_map:
        print("Filter map is empty. Returning input table with 'top' column added.")
        selection_df = df.select("clonotypeKey").with_columns(
            pl.lit(1).cast(pl.Int64).alias("selectionStage")
        )
        return df.with_columns(pl.lit(1).alias("top")), selection_df

    filtered_df = df.clone()
    initial_rows = filtered_df.height

    # Find all Filter_* columns in the DataFrame
    filter_columns = sorted([col for col in df.columns if re.match(r'^Filter_\d+$', col)],
                           key=lambda x: int(x[7:]))  # Extract number after "Filter_"

    print(f"Found Filter_* columns: {filter_columns}")
    print(f"Filter map keys: {list(filter_map.keys())}")

    n_filters = len(filter_columns)
    selection_parts = []

    # Apply filters
    for stage_idx, column_name in enumerate(filter_columns, start=1):
        filter_spec = filter_map[column_name]

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

    # Surviving clones get selectionStage = N_filters + 1
    survivors = filtered_df.select("clonotypeKey").with_columns(
        pl.lit(n_filters + 1).cast(pl.Int64).alias("selectionStage")
    )
    selection_parts.append(survivors)

    selection_df = pl.concat(selection_parts)
    print(f"Selection stage tracking: {selection_df.height} total clones across {n_filters} filter stages")

    return filtered_df, selection_df


def aggregate_across_samples(df):
    """Collapse sample dimension by summing abundance across samples.

    Only applies when the sampleId column is present (In Vivo Score case).
    All columns except sampleId and inVivo_primaryAbundance have identical values
    per clonotype, so grouping by them naturally deduplicates the rows.
    """
    if "sampleId" not in df.columns:
        return df

    # Abundance may be loaded as String with "" for missing values
    if df["inVivo_primaryAbundance"].dtype == pl.Utf8:
        df = df.with_columns(
            pl.col("inVivo_primaryAbundance").replace("", None).cast(pl.Int64)
        )

    group_cols = [col for col in df.columns 
                     if col not in ("sampleId", "inVivo_primaryAbundance")]
    rows_before = df.height
    df = df.group_by(group_cols).agg(pl.col("inVivo_primaryAbundance").sum()).sort("clonotypeKey")
    print(f"Aggregated across samples: {rows_before} -> {df.height} rows (summed inVivo_primaryAbundance)")
    return df


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

    # Parse filter map from JSON string
    try:
        filter_map = json.loads(args.filter_map)
        print(f"Loaded filter map: {filter_map}")
    except json.JSONDecodeError as e:
        print(f"Error parsing filter map JSON: {e}")
        return

    # Make sure numeric columns where loaded as such
    for column in filter_map.keys():
        filter_spec = filter_map[column]
        
        filter_type = filter_spec["type"]
        data_type = filter_spec["valueType"]
        # Check data type if filters are non-string and correct for the given data type 
        if ((data_type != "String") and (filter_type.startswith("number_"))):
            
            if filter_map[column]["type"].startswith("number_") and df.schema[column] == pl.String:
                print("Data type inconsistency in column {column}. Trying to find out if it's an integer or a float...")
                # Check if non-empty values ("") might be integers or floats
                non_empty_values = df.filter(pl.col(column) != "").select(pl.col(column)).to_series().to_list()
                consensus_type = {"interger": 0, "float": 0}
                for value in non_empty_values[:50]:
                    if isinstance(value, int):
                        consensus_type["interger"] += 1
                    elif isinstance(value, float):
                        consensus_type["float"] += 1
                    else:
                        print(f"Value {value} is not an integer or float. Skipping cast.")
                # decide data type based on consensus
                if consensus_type["interger"] > consensus_type["float"]:
                    dtype = pl.Int32
                    print(f"Casting column {column} to Int64 based on consensus.")
                else:
                    dtype = pl.Float64
                    print(f"Casting column {column} to Float64 based on consensus.")
                # Most tommon case is that zero values are represented as ""
                df = df.with_columns(pl.col(column).replace("", float("NaN")).cast(dtype))

    # Collapse sample dimension if present (In Vivo Score case)
    df = aggregate_across_samples(df)

    # Apply filters
    filtering_start = time.time()
    print(f"Initial rows: {df.height}")
    filtered_df, selection_df = apply_filters(df, filter_map)
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