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
    col_columns = [col for col in df.columns if re.match(r'^Col\d+$', col)]
    print("Found Col* columns:", col_columns)
    
    if not col_columns:
        print("Error: Input CSV must contain at least one column starting with 'Col' followed by a number (e.g., Col0, Col1, etc.).")
        return False
    
    return True


def rank_rows(df):
    # Get all Col* columns and sort them by their number
    col_columns = sorted([col for col in df.columns if re.match(r'^Col\d+$', col)],
                        key=lambda x: int(x[3:]))
    
    # Sort the dataframe by each Col* column in order of priority
    # Use ascending=False to get highest values first
    return df.sort_values(by=col_columns, ascending=False)


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

    # Validate column format
    if not validate_column_format(df):
        return

    # Validate N
    if args.n <= 0:
        print("Error: N must be a positive integer.")
        return
    if args.n > len(df):
        print(f"Error: N ({args.n}) is greater than the number of rows in the table ({len(df)}).")
        return

    # Rank rows and get top N
    ranked_df = rank_rows(df)
    top_n = ranked_df.head(args.n)

    # Output full data to csv
    top_n.to_csv(args.out, index=False)

    # Create and output simplified version with just clonotypeKey and top columns
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