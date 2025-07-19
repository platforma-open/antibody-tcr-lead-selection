#!/usr/bin/env python3

import argparse
import pandas as pd
import re
import os
import time


def parse_arguments():
    parser = argparse.ArgumentParser(description="Rank rows based on Col* columns and output top N rows.")
    parser.add_argument("--csv", required=True, help="Path to input CSV file")
    parser.add_argument("--n", type=int, required=True, help="Number of top rows to output")
    parser.add_argument("--out", required=True, help="Path to output CSV file")
    return parser.parse_args()


def validate_column_format(df):
    print("Found columns:", df.columns.tolist())
    
    # Check for clonotypeKey column
    if 'clonotypeKey' not in df.columns:
        print("Error: Input CSV must contain a 'clonotypeKey' column.")
        return False
    
    # Check for Col* columns
    col_columns = sorted([col for col in df.columns if re.match(r'^Col\d+$', col)],
                        key=lambda x: int(x[3:]))
    print("Found Col* columns:", col_columns)
    
    return col_columns


def rank_rows(df, col_columns, cluster_columns):
    if not cluster_columns:
        # If no cluster column, rank as before
        return df.sort_values(by=col_columns, ascending=False)
    
    # Use the first cluster column found
    cluster_col = cluster_columns[0]
    
    # Get group sizes for ordering clusters by size
    group_sizes = df[cluster_col].value_counts()
    
    # Create a temporary column with cluster sizes for sorting
    df_temp = df.copy()
    df_temp['_cluster_size'] = df_temp[cluster_col].map(group_sizes)
    
    # Single sort operation: by cluster size (desc), then by ranking columns (desc)
    sorted_df = df_temp.sort_values(
        by=['_cluster_size'] + col_columns, 
        ascending=[False] + [False] * len(col_columns)
    )
    
    # Remove temporary column and return
    return sorted_df.drop('_cluster_size', axis=1)


def select_top_n(df, n, cluster_columns):
    if not cluster_columns:
        # If no cluster column, just take top N
        return df.head(n)
    
    # Use the first cluster column found
    cluster_col = cluster_columns[0]
    
    # Get unique groups
    groups = df[cluster_col].unique()
    
    # Round-robin sampling: take top 1 from each cluster, then top 2, etc.
    selected_rows = []
    round_num = 0
    
    while len(selected_rows) < n:
        added_in_round = False
        for group in groups:
            if len(selected_rows) >= n:
                break
            group_df = df[df[cluster_col] == group]
            if round_num < len(group_df):
                selected_rows.append(group_df.iloc[round_num])
                added_in_round = True
        
        # If no rows were added in this round, all clusters are exhausted
        if not added_in_round:
            break
        
        round_num += 1
    
    return pd.DataFrame(selected_rows)


def main():
    start_time = time.time()
    print(f"Starting clonotype sampling at {time.strftime('%H:%M:%S')}")
    
    args = parse_arguments()

    # Load CSV - try both comma and tab separated
    load_start = time.time()
    try:
        df = pd.read_csv(args.csv, sep=',')
    except:
        try:
            df = pd.read_csv(args.csv, sep='\t')
        except Exception as e:
            print(f"Error reading file: {e}")
            return
    
    load_time = time.time() - load_start
    print(f"✓ Data loading: {load_time:.3f}s ({len(df):,} rows, {len(df.columns)} columns)")

    # Validate N
    if args.n <= 0:
        print("Error: N must be a positive integer.")
        return
    if args.n > len(df):
        print(f"Error: N ({args.n}) is greater than the number of rows in the table ({len(df)}).")
        args.n = len(df)
        # return

    # Check for cluster columns and validate
    validation_start = time.time()
    cluster_columns = [col for col in df.columns if re.match(r'^cluster_\d+$', col)]
    col_columns = validate_column_format(df)
    validation_time = time.time() - validation_start
    print(f"✓ Validation: {validation_time:.3f}s (found {len(cluster_columns)} cluster columns, {len(col_columns)} ranking columns)")
    
    # Ranking step
    ranking_start = time.time()
    if not col_columns:
        print("WARNING: User didn't provide ranking columns, selection will be done in table order")
        ranked_df = df.copy()
    else:
        # Rank rows
        ranked_df = rank_rows(df, col_columns, cluster_columns)
    ranking_time = time.time() - ranking_start
    print(f"✓ Ranking: {ranking_time:.3f}s")
    
    # Select top N rows
    selection_start = time.time()
    top_n = select_top_n(ranked_df, args.n, cluster_columns)
    selection_time = time.time() - selection_start
    print(f"✓ Selection: {selection_time:.3f}s (selected {len(top_n)} clonotypes)")

    # Add ranked order column after selection (index 1)
    top_n['ranked_order'] = range(1, len(top_n) + 1)

    # Create and output simplified version with top clonotypes only
    output_start = time.time()
    if cluster_columns:
        cluster_col = cluster_columns[0]
        simplified_df = pd.DataFrame({
            cluster_col: top_n[cluster_col],
            'clonotypeKey': top_n['clonotypeKey'],
            'top': 1,
            'ranked_order': top_n['ranked_order']
        })
    else:
        simplified_df = pd.DataFrame({
            'clonotypeKey': top_n['clonotypeKey'],
            'top': 1,
            'ranked_order': top_n['ranked_order']
        })
    
    # Output simplified version to main output file
    simplified_df.to_csv(args.out, index=False)
    output_time = time.time() - output_start
    print(f"✓ Output: {output_time:.3f}s (wrote to {args.out})")
    
    total_time = time.time() - start_time
    print(f"🎯 Total time: {total_time:.3f}s")


if __name__ == "__main__":
    main()