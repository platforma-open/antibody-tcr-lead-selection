#!/usr/bin/env python3

import argparse
import polars as pl
import re
import os
import time
import json


def parse_arguments():
    parser = argparse.ArgumentParser(description="Rank rows based on Col* columns and output top N rows.")
    parser.add_argument("--csv", required=True, help="Path to input CSV file")
    parser.add_argument("--n", type=int, required=True, help="Number of top rows to output")
    parser.add_argument("--out", required=True, help="Path to output CSV file")
    parser.add_argument("--ranking-map", type=str, help='JSON string specifying ranking direction for each column, e.g., {"Col0":"decreasing","Col1":"increasing"}')
    return parser.parse_args()


def parse_ranking_map(ranking_map_str, col_columns):
    """Parse and validate the ranking map JSON string."""
    if not ranking_map_str:
        # Default behavior: all columns decreasing
        default_map = {col: "decreasing" for col in col_columns}
        if col_columns:  # Only print if there are ranking columns
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
        if col not in col_columns:
            print(f"Warning: Column '{col}' in ranking-map not found in data. Ignoring.")
    
    # Fill in missing columns with default (decreasing)
    complete_map = {col: "decreasing" for col in col_columns}
    complete_map.update({col: direction for col, direction in ranking_map.items() if col in col_columns})
    
    print(f"Using ranking directions: {complete_map}")
    return complete_map


def validate_column_format(df):
    print("Found columns:", df.columns)
    
    # Check for clonotypeKey column
    if 'clonotypeKey' not in df.columns:
        print("Error: Input CSV must contain a 'clonotypeKey' column.")
        return False
    
    # Check for Col* columns
    col_columns = sorted([col for col in df.columns if re.match(r'^Col\d+$', col)],
                        key=lambda x: int(x[3:]))
    print("Found Col* columns:", col_columns)
    
    # Check for cluster size columns
    cluster_size_columns = [col for col in df.columns if re.match(r'^clusterSize\.\d+$', col)]
    print("Found cluster size columns:", cluster_size_columns)
    
    return col_columns, cluster_size_columns


def rank_rows(df, col_columns, cluster_columns, cluster_size_columns, ranking_map):
    if not cluster_columns:
        # If no cluster column, rank as before
        col_descending = [ranking_map[col] == "decreasing" for col in col_columns]
        return df.sort(col_columns, descending=col_descending)
    
    # Use the first cluster column found
    cluster_col = cluster_columns[0]
    
    # Use existing cluster size column if available, otherwise calculate
    if cluster_size_columns:
        cluster_size_col = cluster_size_columns[0]
        print(f"Using existing cluster size column: {cluster_size_col}")
        # Single sort operation: by existing cluster size (desc), then by ranking columns (custom directions)
        sort_columns = [cluster_size_col] + col_columns
        # Cluster size always descending, then follow ranking map for Col columns
        col_descending = [ranking_map[col] == "decreasing" for col in col_columns]
        sort_descending = [True] + col_descending
        sorted_df = df.sort(sort_columns, descending=sort_descending)
        return sorted_df
    else:
        print("No cluster size column found, calculating from data")
        # Get group sizes for ordering clusters by size
        group_sizes = df.group_by(cluster_col).agg(pl.count().alias("_cluster_size"))
        
        # Join with original data to add cluster sizes
        df_with_sizes = df.join(group_sizes, on=cluster_col)
        
        # Single sort operation: by cluster size (desc), then by ranking columns (custom directions)
        sort_columns = ["_cluster_size"] + col_columns
        # Cluster size always descending, then follow ranking map for Col columns
        col_descending = [ranking_map[col] == "decreasing" for col in col_columns]
        sort_descending = [True] + col_descending
        
        sorted_df = df_with_sizes.sort(sort_columns, descending=sort_descending)
        
        # Remove temporary column and return
        return sorted_df.drop("_cluster_size")


def select_top_n(df, n, cluster_columns):
    if not cluster_columns:
        # If no cluster column, just take top N
        return df.head(n)
    
    # Use the first cluster column found
    cluster_col = cluster_columns[0]
    
    # Get unique groups - exactly like pandas
    groups = df[cluster_col].unique(maintain_order=True).to_list()
    
    # Round-robin sampling: take top 1 from each cluster, then top 2, etc.
    selected_rows = []
    round_num = 0
    
    while len(selected_rows) < n:
        added_in_round = False
        for group in groups:
            if len(selected_rows) >= n:
                break
            # Filter on-the-fly like pandas: df[df[cluster_col] == group]
            group_df = df.filter(pl.col(cluster_col) == group)
            if round_num < group_df.height:
                # Get row at round_num position like pandas: group_df.iloc[round_num]
                selected_rows.append(group_df.slice(round_num, 1))
                added_in_round = True
        
        # If no rows were added in this round, all clusters are exhausted
        if not added_in_round:
            break
        
        round_num += 1
    
    # Concatenate all selected rows and add ranked order
    if selected_rows:
        result = pl.concat(selected_rows)
        result = result.with_columns(pl.arange(1, result.height + 1).alias("ranked_order"))
        return result
    else:
        return df.head(0)


def main():
    start_time = time.time()
    print(f"Starting clonotype sampling at {time.strftime('%H:%M:%S')}")
    
    args = parse_arguments()

    # Load CSV - try both comma and tab separated
    load_start = time.time()
    try:
        df = pl.read_csv(args.csv, separator=',')
    except:
        try:
            df = pl.read_csv(args.csv, separator='\t')
        except Exception as e:
            print(f"Error reading file: {e}")
            return
    
    load_time = time.time() - load_start
    print(f"✓ Data loading: {load_time:.3f}s ({df.height:,} rows, {len(df.columns)} columns)")

    # Validate N
    if args.n <= 0:
        print("Error: N must be a positive integer.")
        return
    if args.n > df.height:
        print(f"Error: N ({args.n}) is greater than the number of rows in the table ({df.height}).")
        args.n = df.height
        # return

    # Check for cluster columns and validate
    validation_start = time.time()
    # Support both old format (cluster_*) and new format (clusterAxis_*)
    cluster_columns = ([col for col in df.columns if re.match(r'^cluster_\d+$', col)] + 
                      [col for col in df.columns if re.match(r'^clusterAxis_\d+_\d+$', col)])
    col_columns, cluster_size_columns = validate_column_format(df)
    validation_time = time.time() - validation_start
    print(f"✓ Validation: {validation_time:.3f}s (found {len(cluster_columns)} cluster columns, {len(col_columns)} ranking columns, {len(cluster_size_columns)} cluster size columns)")
    
    # Parse ranking map
    ranking_map = parse_ranking_map(args.ranking_map, col_columns)
    if ranking_map is None:
        print("Error: Invalid ranking-map provided. Exiting.")
        return
    
    # No mode announcement needed - matches original pandas script
    
    # Ranking step
    ranking_start = time.time()
    if not col_columns:
        print("WARNING: User didn't provide ranking columns, selection will be done in table order")
        ranked_df = df.clone()
    else:
        # Rank rows
        ranked_df = rank_rows(df, col_columns, cluster_columns, cluster_size_columns, ranking_map)
    ranking_time = time.time() - ranking_start
    print(f"✓ Ranking: {ranking_time:.3f}s")
    
    # Select top N rows
    selection_start = time.time()
    top_n = select_top_n(ranked_df, args.n, cluster_columns)
    selection_time = time.time() - selection_start
    print(f"✓ Selection: {selection_time:.3f}s (selected {top_n.height} clonotypes)")

    # Create and output simplified version with top clonotypes only
    output_start = time.time()
    if cluster_columns:
        cluster_col = cluster_columns[0]
        simplified_df = pl.DataFrame({
            cluster_col: top_n[cluster_col],
            'clonotypeKey': top_n['clonotypeKey'],
            'top': [1] * top_n.height,
            'ranked_order': top_n['ranked_order']
        })
    else:
        simplified_df = pl.DataFrame({
            'clonotypeKey': top_n['clonotypeKey'],
            'top': [1] * top_n.height,
            'ranked_order': top_n['ranked_order']
        })
    
    # Output simplified version to main output file
    simplified_df.write_csv(args.out)
    output_time = time.time() - output_start
    print(f"✓ Output: {output_time:.3f}s (wrote to {args.out})")
    
    total_time = time.time() - start_time
    print(f"🎯 Total time: {total_time:.3f}s")


if __name__ == "__main__":
    main()