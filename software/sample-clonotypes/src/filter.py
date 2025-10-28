#!/usr/bin/env python3

import argparse
import polars as pl
import re
import os
import json


def parse_arguments():
    parser = argparse.ArgumentParser(description="Filter rows based on Filter_* columns using provided filter specifications.")
    parser.add_argument("--csv", required=True, help="Path to input CSV file")
    parser.add_argument("--out", required=True, help="Path to output CSV file")
    parser.add_argument("--filter-map", required=True, help="JSON string containing filter mapping")
    return parser.parse_args()


def apply_filter(df, column_name, filter_type, reference_value):
    """
    Apply a filter to a Polars DataFrame column based on the filter type and reference value.
    
    Args:
        df: polars DataFrame
        column_name: name of the column to filter on
        filter_type: type of filter to apply
        reference_value: reference value for the filter
    
    Returns:
        polars DataFrame with filtered rows
    """
    
    print(f"Applying filter: {column_name} {filter_type} {reference_value}")
    
    if filter_type == "number_greaterThan":
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
    else:
        raise ValueError(f"Unknown filter type '{filter_type}' for column \
                         '{column_name}'. Supported types: number_greaterThan, \
                            number_greaterThanOrEqualTo, number_lessThan, \
                            number_lessThanOrEqualTo, number_equals, \
                            number_notEquals, string_equals, string_notEquals, \
                            string_contains, string_doesNotContain")


def apply_filters(df, filter_map):
    """
    Apply all filters specified in the filter_map to the DataFrame.
    If filter_map is empty, return the input table with a "top" column added with value 1.
    
    Args:
        df: polars DataFrame
        filter_map: dictionary mapping column names to filter specifications
    
    Returns:
        polars DataFrame with all filters applied and "top" columns or input table with "top" column if no filters
    """
    # If filter_map is empty, return input table with "top" column
    if not filter_map:
        print("Filter map is empty. Returning input table with 'top' column added.")
        return df.with_columns(pl.lit(1).alias("top"))
    
    filtered_df = df.clone()
    initial_rows = filtered_df.height
    
    # Find all Filter_* columns in the DataFrame
    filter_columns = sorted([col for col in df.columns if re.match(r'^Filter_\d+$', col)],
                           key=lambda x: int(x[7:]))  # Extract number after "Filter_"
    
    print(f"Found Filter_* columns: {filter_columns}")
    print(f"Filter map keys: {list(filter_map.keys())}")
    
    # Apply filters 
    for column_name in filter_columns:
        filter_spec = filter_map[column_name]
        
        filter_type = filter_spec["type"]
        reference_value = filter_spec["reference"]
        
        # Apply the filter
        filtered_df = apply_filter(filtered_df, column_name, filter_type, reference_value)
        
        rows_after_filter = filtered_df.height
        print(f"Filter '{column_name}' {filter_type} {reference_value}: {initial_rows} -> {rows_after_filter} rows")
        initial_rows = rows_after_filter
    
    return filtered_df


def main():
    args = parse_arguments()

    # Load CSV 
    try:
        df = pl.read_csv(args.csv, separator=',')
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Check if file is empty
    if df.height == 0:
        print("Warning: Input CSV file is empty. Creating empty output file with minimal headers.")
        # Create empty output file with minimal required columns
        empty_df = pl.DataFrame(schema={
            'clonotypeKey': pl.Utf8,
        })
        empty_df.write_csv(args.out)
        print(f"Empty output file created: {args.out}")
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
        if filter_map[column]["type"].startswith("number_") and df.schema[column] == pl.String:
            print("Data type inconsistency in column {column}. Trying to cast to Float64.")
            # Most tommon case is that zero values are represented as ""
            df = df.with_columns(pl.col(column).replace("", float("NaN")).cast(pl.Float64))

    # Apply filters
    print(f"Initial rows: {df.height}")
    filtered_df = apply_filters(df, filter_map)
    print(f"Rows after filtering: {filtered_df.height}")

    # Add a column named top with value 1
    filtered_df = filtered_df.with_columns(pl.lit(1).alias("top"))
    
    if filtered_df.height == 0:
        print("Warning: No rows remain after filtering. Creating empty output file.")
        # Create empty output file with same columns as input
        filtered_df.write_csv(args.out)
        return

    # Output filtered data to csv
    filtered_df.write_csv(args.out)
    print(f"Filtered data written to: {args.out}")

if __name__ == "__main__":
    main() 