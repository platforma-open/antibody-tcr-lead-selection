#!/usr/bin/env python3

import argparse
import pandas as pd
import re
import os


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
    
    if not col_columns:
        print("Error: Input CSV must contain at least one column starting with 'Col' followed by a number (e.g., Col0, Col1, etc.).")
        return False
    
    return col_columns


def rank_rows(df, col_columns):
    # Check if there's a cluster column
    cluster_columns = [col for col in df.columns if re.match(r'^cluster_\d+$', col)]
    
    if not cluster_columns:
        # If no cluster column, rank as before
        return df.sort_values(by=col_columns, ascending=False)
    
    # Use the first cluster column found
    cluster_col = cluster_columns[0]
    
    # Get group sizes for ordering
    group_sizes = df[cluster_col].value_counts()
    
    # Sort groups by size (descending)
    sorted_groups = group_sizes.index.tolist()
    
    # Rank within each group
    ranked_dfs = []
    for group in sorted_groups:
        group_df = df[df[cluster_col] == group].copy()
        ranked_group = group_df.sort_values(by=col_columns, ascending=False)
        ranked_dfs.append(ranked_group)
    
    # Combine all ranked groups
    return pd.concat(ranked_dfs)


def select_top_n(df, n, cluster_columns):
    if not cluster_columns:
        # If no cluster column, just take top N
        return df.head(n)
    
    # Use the first cluster column found
    cluster_col = cluster_columns[0]
    
    # Get unique groups
    groups = df[cluster_col].unique()
    num_groups = len(groups)
    
    # Calculate how many rows to take from each group
    rows_per_group = n // num_groups
    extra_rows = n % num_groups
    
    # Select rows
    selected_rows = []
    for i in range(rows_per_group + (1 if extra_rows > 0 else 0)):
        for group in groups:
            if len(selected_rows) >= n:
                break
            group_df = df[df[cluster_col] == group]
            if i < len(group_df):
                selected_rows.append(group_df.iloc[i])
    
    return pd.DataFrame(selected_rows)


def main():
    args = parse_arguments()

    # Load CSV - try both comma and tab separated
    try:
        df = pd.read_csv(args.csv, sep=',')
    except:
        try:
            df = pd.read_csv(args.csv, sep='\t')
        except Exception as e:
            print(f"Error reading file: {e}")
            return

    # Validate column format and get col columns
    col_columns = validate_column_format(df)
    if not col_columns:
        return

    # Validate N
    if args.n <= 0:
        print("Error: N must be a positive integer.")
        return
    if args.n > len(df):
        print(f"Error: N ({args.n}) is greater than the number of rows in the table ({len(df)}).")
        return

    # Check for cluster columns
    cluster_columns = [col for col in df.columns if re.match(r'^cluster_\d+$', col)]
    
    # Rank rows
    ranked_df = rank_rows(df, col_columns)
    
    # Select top N rows
    top_n = select_top_n(ranked_df, args.n, cluster_columns)

    # Add cluster_size column if cluster column exists
    if cluster_columns:
        cluster_col = cluster_columns[0]
        group_sizes = df[cluster_col].value_counts()
        top_n['cluster_size'] = top_n[cluster_col].map(group_sizes)

    # Output full data to csv
    top_n.to_csv(args.out, index=False)

    # Create and output simplified version
    if cluster_columns:
        cluster_col = cluster_columns[0]
        simplified_df = pd.DataFrame({
            cluster_col: top_n[cluster_col],
            'clonotypeKey': top_n['clonotypeKey'],
            'top': 1
        })
    else:
        simplified_df = pd.DataFrame({
            'clonotypeKey': top_n['clonotypeKey'],
            'top': 1
        })
    
    # Create output filename for simplified version
    base, ext = os.path.splitext(args.out)
    simplified_out = f"{base}_top{ext}"
    simplified_df.to_csv(simplified_out, index=False)


if __name__ == "__main__":
    main()