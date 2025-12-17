#!/usr/bin/env python3

import argparse
import polars as pl
import re
import os
import time
import json


def parse_arguments():
    parser = argparse.ArgumentParser(description="Rank rows based on Col* columns and output top N rows.")
    parser.add_argument("--parquet", required=True, help="Path to input Parquet file")
    parser.add_argument("--n", type=int, required=True, help="Number of top rows to output")
    parser.add_argument("--out", required=True, help="Path to output Parquet file")
    parser.add_argument("--ranking-map", type=str, help='JSON string specifying ranking direction for each column, e.g., {"Col0":"decreasing","Col1":"increasing"}')
    parser.add_argument("--disable-cluster-ranking", action="store_true", 
                        help="Disable automatic cluster ranking in backward compatibility mode")
    parser.add_argument("--cluster-column", type=str, 
                        help="Specify which cluster column to use for sampling (e.g., 'cluster_0', 'cluster_1')")
    return parser.parse_args()


def parse_ranking_map(ranking_map_str, clonotype_col_columns, cluster_col_columns, linker_col_columns):
    """Parse and validate the ranking map JSON string for all column types."""
    # Combine all ranking columns
    all_col_columns = clonotype_col_columns + cluster_col_columns + linker_col_columns
    
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
    
    # Check for linker ranking columns (Col_linker.0, Col_linker.1, ...)
    linker_col_columns = sorted([col for col in df.columns if re.match(r'^Col_linker\.\d+$', col)],
                                key=lambda x: int(x.split('.')[1]))
    print("Found linker ranking columns:", linker_col_columns)
    
    # Check for cluster size columns
    cluster_size_columns = [col for col in df.columns if re.match(r'^clusterSize\.\d+$', col)]
    print("Found cluster size columns:", cluster_size_columns)
    
    return clonotype_col_columns, cluster_col_columns, linker_col_columns, cluster_size_columns


def match_cluster_properties_to_columns(cluster_col_columns, linker_col_columns, cluster_columns):
    """
    Match Col_cluster.0 → cluster_0 or clusterAxis_0_*, Col_cluster.1 → cluster_1 or clusterAxis_1_*, etc.
    Match Col_linker.0 → cluster_0 or clusterAxis_0_*, Col_linker.1 → cluster_1 or clusterAxis_1_*, etc.
    Returns dict: {ranking_column_name: cluster_axis_column_name}
    
    Supports both old format (cluster_*) and new format (clusterAxis_*_*).
    
    Examples:
      Col_cluster.0 → cluster_0 or clusterAxis_0_0
      Col_cluster.1 → cluster_1 or clusterAxis_1_0
      Col_linker.0 → cluster_0 or clusterAxis_0_0
    """
    mapping = {}
    
    # Match cluster properties: extract index from Col_cluster.\d+
    for col in cluster_col_columns:
        match = re.match(r'^Col_cluster\.(\d+)$', col)
        if match:
            idx = match.group(1)
            
            # Try old format first
            target_cluster_col = f"cluster_{idx}"
            if target_cluster_col in cluster_columns:
                mapping[col] = target_cluster_col
                print(f"Mapped {col} → {target_cluster_col}")
            else:
                # Try new format: clusterAxis_<idx>_*
                found = False
                for cluster_col in cluster_columns:
                    cluster_match = re.match(r'^clusterAxis_(\d+)_\d+$', cluster_col)
                    if cluster_match and cluster_match.group(1) == idx:
                        mapping[col] = cluster_col
                        print(f"Mapped {col} → {cluster_col}")
                        found = True
                        break
                
                if not found:
                    print(f"Warning: No cluster column (cluster_{idx} or clusterAxis_{idx}_*) found for {col}")
    
    # Match linker properties: extract index from Col_linker.\d+
    for col in linker_col_columns:
        match = re.match(r'^Col_linker\.(\d+)$', col)
        if match:
            idx = match.group(1)
            
            # Try old format first
            target_cluster_col = f"cluster_{idx}"
            if target_cluster_col in cluster_columns:
                mapping[col] = target_cluster_col
                print(f"Mapped {col} → {target_cluster_col}")
            else:
                # Try new format: clusterAxis_<idx>_*
                found = False
                for cluster_col in cluster_columns:
                    cluster_match = re.match(r'^clusterAxis_(\d+)_\d+$', cluster_col)
                    if cluster_match and cluster_match.group(1) == idx:
                        mapping[col] = cluster_col
                        print(f"Mapped {col} → {cluster_col}")
                        found = True
                        break
                
                if not found:
                    print(f"Warning: No cluster column (cluster_{idx} or clusterAxis_{idx}_*) found for {col}")
    
    return mapping


def find_matching_cluster_size(cluster_col, cluster_size_columns):
    """
    Find the cluster size column that matches the given cluster column.
    Extracts index from cluster column name and looks for corresponding clusterSize.N
    
    Args:
        cluster_col: Cluster column name (e.g., 'cluster_0', 'clusterAxis_0_0')
        cluster_size_columns: List of available cluster size columns
    
    Returns:
        Matching cluster size column name, or None if not found
    """
    if not cluster_size_columns:
        return None
    
    # Extract index from cluster column name
    cluster_idx = None
    match = re.match(r'^cluster_(\d+)$', cluster_col)
    if match:
        cluster_idx = match.group(1)
    else:
        match = re.match(r'^clusterAxis_(\d+)_\d+$', cluster_col)
        if match:
            cluster_idx = match.group(1)
    
    # Try to find matching cluster size column
    if cluster_idx:
        target_size_col = f"clusterSize.{cluster_idx}"
        if target_size_col in cluster_size_columns:
            return target_size_col
    
    return None


def rank_rows(df, clonotype_col_columns, cluster_col_columns, linker_col_columns,
              cluster_columns, cluster_size_columns, ranking_map, 
              cluster_property_mapping, disable_cluster_ranking=False, 
              specified_cluster_column=None):
    """
    Rank rows based on three possible cases:
    Case A: No cluster columns OR disable_cluster_ranking flag set
    Case B: Cluster columns exist, but NO cluster properties in ranking (backward compatibility)
    Case C: Cluster properties ARE in ranking (new behavior)
    
    Args:
        specified_cluster_column: Optional specific cluster column to use for Case B ranking
    """
    
    # Convert ranking columns to numeric types if they're strings
    all_ranking_cols = clonotype_col_columns + cluster_col_columns + linker_col_columns
    for col in all_ranking_cols:
        if col in df.columns and df[col].dtype == pl.Utf8:
            try:
                df = df.with_columns(pl.col(col).cast(pl.Float64))
                print(f"Converted ranking column '{col}' from string to numeric")
            except Exception as e:
                print(f"Warning: Could not convert column '{col}' to numeric: {e}")
    
    # Case A: No cluster columns OR cluster ranking disabled
    if not cluster_columns or disable_cluster_ranking:
        print("Ranking mode: Clonotype properties only (Case A)")
        if disable_cluster_ranking and cluster_columns:
            print("  (cluster ranking disabled by flag)")
        
        # Sort by clonotype properties + clonotypeKey
        if clonotype_col_columns:
            col_descending = [ranking_map[col] == "decreasing" for col in clonotype_col_columns]
            sort_columns = clonotype_col_columns + ['clonotypeKey']
            sort_descending = col_descending + [False]
        else:
            # No ranking columns at all, just sort by clonotypeKey
            sort_columns = ['clonotypeKey']
            sort_descending = [False]
        
        return df.sort(sort_columns, descending=sort_descending)
    
    # Case C: Cluster properties ARE in ranking (new behavior)
    if cluster_col_columns or linker_col_columns:
        print("Ranking mode: Cluster/linker properties + clonotype properties (Case C)")
        
        # Combine cluster and linker columns (they should be sorted in ranking order)
        cluster_and_linker_cols = cluster_col_columns + linker_col_columns
        
        # Build sort columns: cluster properties, then clonotype properties, then clonotypeKey
        all_ranking_cols = cluster_and_linker_cols + clonotype_col_columns
        sort_columns = all_ranking_cols + ['clonotypeKey']
        
        # Get descending flags for all columns
        col_descending = [ranking_map.get(col, "decreasing") == "decreasing" for col in all_ranking_cols]
        sort_descending = col_descending + [False]  # clonotypeKey always ascending
        
        print(f"  Sorting by: {' → '.join(sort_columns)}")
        return df.sort(sort_columns, descending=sort_descending)
    
    # Case B: Cluster columns exist, but NO cluster properties in ranking (backward compatibility)
    print("Ranking mode: Cluster size + clonotype properties (Case B - backward compatibility)")
    
    # Determine which cluster column to use for ranking
    if specified_cluster_column and specified_cluster_column in cluster_columns:
        cluster_col = specified_cluster_column
        print(f"  Using specified cluster column for ranking: {cluster_col}")
    else:
        # Fall back to first cluster column if not specified or not found
        cluster_col = cluster_columns[0]
    
    # Find matching cluster size column by index
    cluster_size_col = find_matching_cluster_size(cluster_col, cluster_size_columns)
    
    # If no matching cluster size found, fall back to first available
    if not cluster_size_col and cluster_size_columns:
        cluster_size_col = cluster_size_columns[0]
        print(f"  No matching cluster size found for {cluster_col}, using first: {cluster_size_col}")
    
    # Use existing cluster size column if available, otherwise calculate
    if cluster_size_col:
        print(f"  Using cluster size column: {cluster_size_col} for cluster: {cluster_col}")
        
        # Sort by: cluster size (desc) → clonotype properties → clonotypeKey (asc)
        sort_columns = [cluster_size_col]
        sort_descending = [True]
        
        if clonotype_col_columns:
            col_descending = [ranking_map[col] == "decreasing" for col in clonotype_col_columns]
            sort_columns += clonotype_col_columns
            sort_descending += col_descending
        
        sort_columns += ['clonotypeKey']
        sort_descending += [False]
        
        return df.sort(sort_columns, descending=sort_descending)
    else:
        print(f"  Calculating cluster sizes from data for cluster: {cluster_col}")
        # Get group sizes for ordering clusters by size
        group_sizes = df.group_by(cluster_col).agg(pl.count().alias("_cluster_size"))
        
        # Join with original data to add cluster sizes
        df_with_sizes = df.join(group_sizes, on=cluster_col)
        
        # Sort by: calculated cluster size (desc) → clonotype properties → clonotypeKey (asc)
        sort_columns = ["_cluster_size"]
        sort_descending = [True]
        
        if clonotype_col_columns:
            col_descending = [ranking_map[col] == "decreasing" for col in clonotype_col_columns]
            sort_columns += clonotype_col_columns
            sort_descending += col_descending
        
        sort_columns += ['clonotypeKey']
        sort_descending += [False]
        
        sorted_df = df_with_sizes.sort(sort_columns, descending=sort_descending)
        
        # Remove temporary column and return
        return sorted_df.drop("_cluster_size")


def select_top_n(df, n, cluster_columns, cluster_property_mapping=None, specified_cluster_column=None, 
                 disable_cluster_ranking=False):
    """
    Select top N rows using round-robin sampling if cluster columns exist.
    
    Args:
        df: DataFrame to sample from
        n: Number of rows to select
        cluster_columns: List of available cluster columns
        cluster_property_mapping: Dict mapping cluster properties to cluster columns
        specified_cluster_column: Optional specific cluster column to use for sampling
        disable_cluster_ranking: If True, skip cluster-based sampling even if clusters exist
    """
    if not cluster_columns or disable_cluster_ranking:
        # If no cluster column or cluster ranking disabled, just take top N
        if disable_cluster_ranking and cluster_columns:
            print("Cluster-based sampling disabled by flag - using sequential selection")
        return df.head(n)
    
    # Determine which cluster column to use
    cluster_col = None
    
    # Priority 1: User-specified cluster column
    if specified_cluster_column:
        if specified_cluster_column in cluster_columns:
            cluster_col = specified_cluster_column
            print(f"Using specified cluster column for sampling: {specified_cluster_column}")
        else:
            print(f"Warning: Specified cluster column '{specified_cluster_column}' not found. Available: {cluster_columns}")
            cluster_col = cluster_columns[0]
            print(f"  Using first available cluster column: {cluster_col}")
    
    # Priority 2: If cluster properties were used in ranking, use the first one's cluster column
    elif cluster_property_mapping and len(cluster_property_mapping) > 0:
        # Get the first cluster column from the mapping
        first_cluster_col = list(cluster_property_mapping.values())[0]
        if first_cluster_col in cluster_columns:
            cluster_col = first_cluster_col
            print(f"Using cluster column from ranking properties: {cluster_col}")
        else:
            cluster_col = cluster_columns[0]
            print(f"Using first available cluster column: {cluster_col}")
    
    # Priority 3: Default to first cluster column
    else:
        cluster_col = cluster_columns[0]
        print(f"Using first cluster column for sampling: {cluster_col}")
    
    # Get unique groups - exactly like pandas
    groups = df[cluster_col].unique(maintain_order=True).to_list()
    print(f"Round-robin sampling from {len(groups)} clusters")
    
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
    
    # Concatenate all selected rows
    if selected_rows:
        result = pl.concat(selected_rows)
        return result
    else:
        return df.head(0)


def main():
    start_time = time.time()
    print(f"Starting clonotype sampling at {time.strftime('%H:%M:%S')}")
    
    args = parse_arguments()

    # Load Parquet file
    load_start = time.time()
    try:
        df = pl.read_parquet(args.parquet)
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
    clonotype_col_columns, cluster_col_columns, linker_col_columns, cluster_size_columns = validate_column_format(df)
    validation_time = time.time() - validation_start
    
    total_ranking_cols = len(clonotype_col_columns) + len(cluster_col_columns) + len(linker_col_columns)
    print(f"✓ Validation: {validation_time:.3f}s")
    print(f"  Found {len(cluster_columns)} cluster columns, {total_ranking_cols} ranking columns " +
          f"({len(clonotype_col_columns)} clonotype, {len(cluster_col_columns)} cluster, " +
          f"{len(linker_col_columns)} linker), {len(cluster_size_columns)} cluster size columns")
    
    # Match cluster/linker properties to cluster columns
    cluster_property_mapping = match_cluster_properties_to_columns(
        cluster_col_columns, linker_col_columns, cluster_columns)
    
    # Parse ranking map
    ranking_map = parse_ranking_map(args.ranking_map, clonotype_col_columns, 
                                    cluster_col_columns, linker_col_columns)
    if ranking_map is None:
        print("Error: Invalid ranking-map provided. Exiting.")
        return
    
    # Ranking step
    ranking_start = time.time()
    if not clonotype_col_columns and not cluster_col_columns and not linker_col_columns:
        print("WARNING: No ranking columns provided, selection will be done in table order")
        ranked_df = df.clone()
    else:
        # Rank rows
        ranked_df = rank_rows(df, clonotype_col_columns, cluster_col_columns, linker_col_columns,
                             cluster_columns, cluster_size_columns, ranking_map,
                             cluster_property_mapping, args.disable_cluster_ranking, 
                             args.cluster_column)
    ranking_time = time.time() - ranking_start
    print(f"✓ Ranking: {ranking_time:.3f}s")
    
    # Select top N rows
    selection_start = time.time()
    top_n = select_top_n(ranked_df, args.n, cluster_columns, 
                        cluster_property_mapping, args.cluster_column, args.disable_cluster_ranking)
    # Always add ranked_order column after selection (like original pandas implementation)
    top_n = top_n.with_columns(pl.arange(1, top_n.height + 1).alias("ranked_order"))
    selection_time = time.time() - selection_start
    print(f"✓ Selection: {selection_time:.3f}s (selected {top_n.height} clonotypes)")

    # Create and output simplified version with top clonotypes only
    output_start = time.time()
    if cluster_columns and not args.disable_cluster_ranking:
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
    simplified_df.write_parquet(args.out)
    output_time = time.time() - output_start
    print(f"✓ Output: {output_time:.3f}s (wrote to {args.out})")
    
    total_time = time.time() - start_time
    print(f"🎯 Total time: {total_time:.3f}s")


if __name__ == "__main__":
    main()