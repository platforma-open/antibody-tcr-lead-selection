#!/usr/bin/env python3

import argparse
import polars as pl
import re
import os
import json
import time
import io
from datetime import datetime


def log_with_timestamp(message):
    """Print a message with a timestamp prefix."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] {message}")


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
    
    log_with_timestamp(f"Applying filter: {column_name} {filter_type} {reference_value}")
    
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


def write_csv_chunked(df, output_path, chunk_size=500000):
    """
    Write Polars DataFrame to CSV using optimized chunked approach for large datasets.

    Args:
        df: Polars DataFrame to write
        output_path: Path to output CSV file
        chunk_size: Number of rows to write per chunk (default: 500000)
    """
    total_rows = df.height

    if total_rows == 0:
        # Write empty DataFrame with headers only
        df.write_csv(output_path)
        return

    if total_rows <= chunk_size:
        # Small enough to write in one go using sink_csv
        df.lazy().sink_csv(
            path=output_path,
            separator=",",
            include_bom=False,
            include_header=True
        )
        return

    # Write in chunks for large datasets
    log_with_timestamp(f"Writing CSV in chunks of {chunk_size:,} rows (total: {total_rows:,} rows)...")

    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        # Write header
        f.write(",".join(df.columns) + "\n")

        chunks_written = 0
        for i in range(0, total_rows, chunk_size):
            batch = df.slice(i, chunk_size)
            # Write batch to string buffer first, then to file
            buffer = io.StringIO()
            batch.write_csv(buffer, separator=",", include_header=False)
            f.write(buffer.getvalue())
            buffer.close()

            chunks_written += 1
            written_rows = min(i + chunk_size, total_rows)

            # Log progress every 10 chunks or on last chunk
            if chunks_written % 10 == 0 or written_rows == total_rows:
                progress_pct = 100 * written_rows / total_rows
                log_with_timestamp(f"Written {written_rows:,} / {total_rows:,} rows ({progress_pct:.1f}%) - {chunks_written} chunks")


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
        log_with_timestamp("Filter map is empty. Returning input table with 'top' column added.")
        return df.with_columns(pl.lit(1).alias("top"))
    
    filtered_df = df.clone()
    initial_rows = filtered_df.height
    
    # Find all Filter_* columns in the DataFrame
    filter_columns = sorted([col for col in df.columns if re.match(r'^Filter_\d+$', col)],
                           key=lambda x: int(x[7:]))  # Extract number after "Filter_"
    
    log_with_timestamp(f"Found Filter_* columns: {filter_columns}")
    log_with_timestamp(f"Filter map keys: {list(filter_map.keys())}")
    
    # Apply filters 
    for column_name in filter_columns:
        filter_spec = filter_map[column_name]
        
        filter_type = filter_spec["type"]
        reference_value = filter_spec["reference"]
        data_type = filter_spec["valueType"]

        # Apply the filter if is correct for the given data type
        if (((data_type == "String") and (filter_type.startswith("string_"))) or
            ((data_type != "String") and (filter_type.startswith("number_")))):
            filtered_df = apply_filter(filtered_df, column_name, filter_type, reference_value)
        
        rows_after_filter = filtered_df.height
        log_with_timestamp(f"Filter '{column_name}' {filter_type} {reference_value}: {initial_rows} -> {rows_after_filter} rows")
        initial_rows = rows_after_filter
    
    return filtered_df


def main():
    args = parse_arguments()

    # Load CSV 
    try:
        read_start = time.time()
        df = pl.read_csv(args.csv, separator=',')
        read_duration = time.time() - read_start
        log_with_timestamp(f"Read operation completed in {read_duration:.4f} seconds")
    except Exception as e:
        log_with_timestamp(f"Error reading file: {e}")
        return

    # Check if file is empty
    if df.height == 0:
        log_with_timestamp("Warning: Input CSV file is empty. Creating empty output file with minimal headers.")
        # Create empty output file with minimal required columns
        empty_df = pl.DataFrame(schema={
            'clonotypeKey': pl.Utf8,
        })
        write_start = time.time()
        empty_df.write_csv(args.out)
        write_duration = time.time() - write_start
        log_with_timestamp(f"Write operation completed in {write_duration:.4f} seconds")
        log_with_timestamp(f"Empty output file created: {args.out}")
        return

    # Parse filter map from JSON string
    try:
        filter_map = json.loads(args.filter_map)
        log_with_timestamp(f"Loaded filter map: {filter_map}")
    except json.JSONDecodeError as e:
        log_with_timestamp(f"Error parsing filter map JSON: {e}")
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

    # Apply filters
    log_with_timestamp(f"Initial rows: {df.height}")
    filter_start = time.time()
    filtered_df = apply_filters(df, filter_map)
    filter_duration = time.time() - filter_start
    log_with_timestamp(f"Filter operation completed in {filter_duration:.4f} seconds")
    log_with_timestamp(f"Rows after filtering: {filtered_df.height}")

    # Add a column named top with value 1
    filtered_df = filtered_df.with_columns(pl.lit(1).alias("top"))
    
    if filtered_df.height == 0:
        log_with_timestamp("Warning: No rows remain after filtering. Creating empty output file.")
        # Create empty output file with same columns as input
        write_start = time.time()
        filtered_df.write_csv(args.out)
        write_duration = time.time() - write_start
        log_with_timestamp(f"Write operation completed in {write_duration:.4f} seconds")
        return

    # Output filtered data to csv
    # Use chunked approach for datasets with more than 1,000,000 rows
    write_start = time.time()
    if filtered_df.height > 1000000:
        log_with_timestamp(f"Large dataset detected ({filtered_df.height:,} rows). Using chunked write approach.")
        write_csv_chunked(filtered_df, args.out, chunk_size=500000)
    else:
        # Use sink_csv for optimized streaming writes for smaller datasets
        filtered_df.lazy().sink_csv(
            path=args.out,
            separator=",",
            include_bom=False,
            include_header=True
        )
    write_duration = time.time() - write_start
    log_with_timestamp(f"Write operation completed in {write_duration:.4f} seconds")
    log_with_timestamp(f"Filtered data written to: {args.out}")

if __name__ == "__main__":
    script_name = os.path.splitext(os.path.basename(__file__))[0]
    log_file = "filter.time.log"
    start_time = datetime.now()

    try:
        main()
    finally:
        end_time = datetime.now()
        duration = end_time - start_time
        with open(log_file, 'w') as f:
            f.write(f"Start time: {start_time.isoformat()}\n")
            f.write(f"End time: {end_time.isoformat()}\n")
            log_with_timestamp(f"Duration: {duration.total_seconds():.6f} seconds")
            f.write(f"Duration: {duration.total_seconds():.6f} seconds\n")