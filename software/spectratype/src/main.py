import polars as pl
import argparse
import os
from datetime import datetime
import re


def log_with_timestamp(message):
    """Print a message with a timestamp prefix."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] {message}")


# Expected input file has clonotypeKey, and one or two cdr3Sequence[.chain] columns, and one or two vGene[.chain] columns
# Spectratype output file will have chain, cdr3Length, vGene, and count columns
# V/J usage output file will have chain, vGene, jGene, and count columns

# An optional input file can be provided: final_clonotypes.csv 
# It will have cluster_0,clonotypeKey,top columns (top is 1) and only final clonotypes are included in the file

def wide_to_long_polars(df, stubnames, id_col, j_col, sep='.', suffix='.+'):
    """
    Polars equivalent of pandas wide_to_long using unpivot.
    Transforms wide format (columns like 'cdr3Sequence.alpha', 'cdr3Sequence.beta')
    to long format (rows with 'chain' column).
    """
    # Find all columns that match any stubname pattern
    pattern = re.compile(f"^({'|'.join(re.escape(s) for s in stubnames)}){re.escape(sep)}{suffix}$")
    value_cols = [col for col in df.columns if pattern.match(col)]

    if not value_cols:
        # Return empty DataFrame with expected schema
        schema = {id_col: pl.Utf8, j_col: pl.Utf8}
        for stub in stubnames:
            schema[stub] = pl.Utf8
        return pl.DataFrame(schema=schema)

    # Unpivot all matching columns at once
    df_long = df.unpivot(
        on=value_cols,
        index=id_col,
        variable_name='_variable',
        value_name='_value'
    )

    # Extract stubname and chain from variable name
    df_long = df_long.with_columns([
        pl.col('_variable').str.split(sep).list.get(0).alias('_stubname'),
        pl.col('_variable').str.split(sep).list.get(1).alias(j_col)
    ])

    # Pivot to get stubnames as columns (equivalent to reset_index in pandas)
    result = df_long.pivot(
        values='_value',
        index=[id_col, j_col],
        on='_stubname'
    )

    return result


def main():
    parser = argparse.ArgumentParser(description="Calculate CDR3 lengths and output in long format.")
    parser.add_argument("--input", required=False,
                       help="Input file (Parquet or TSV) with clonotypeKey, cdr3Sequence[.chain], and vGene[.chain] columns.")
    parser.add_argument("--input_tsv", required=False,
                       help="Input TSV file with clonotypeKey, cdr3Sequence[.chain], and vGene[.chain] columns (deprecated, use --input instead).")
    parser.add_argument("--spectratype_tsv", required=True, 
                       help="Output TSV file with chain, cdr3Length, vGene, and count columns.")
    parser.add_argument("--vj_usage_tsv", required=True,
                        help="Output TSV file with vGene, jGene, and count columns for V/J gene usage.")
    parser.add_argument("--final_clonotypes_csv", required=False,
                        help="Input CSV file with top/filtered clonotypes to calculate spectratype and V/J gene usage only on them.")
    parser.add_argument("--final_clonotypes_parquet", required=False,
                        help="Input Parquet file with top/filtered clonotypes to calculate spectratype and V/J gene usage only on them.")
    args = parser.parse_args()

    # Determine input file path (support both --input and --input_tsv for backward compatibility)
    input_file = args.input if args.input else args.input_tsv
    if not input_file:
        parser.error("Either --input or --input_tsv must be provided")

    # Read input data - auto-detect format from extension or try both formats
    try:
        if input_file.endswith('.parquet'):
            df = pl.read_parquet(input_file)
            # Convert all columns to string to match TSV behavior
            df = df.with_columns([pl.col(col).cast(pl.Utf8) for col in df.columns])
        elif input_file.endswith('.tsv') or input_file.endswith('.csv'):
            # Read with all columns as string
            df = pl.read_csv(input_file, separator="\t", infer_schema_length=0)
            df = df.with_columns([pl.col(col).cast(pl.Utf8) for col in df.columns])
        else:
            # Auto-detect: try parquet first, then TSV
            try:
                df = pl.read_parquet(input_file)
                df = df.with_columns([pl.col(col).cast(pl.Utf8) for col in df.columns])
            except:
                df = pl.read_csv(input_file, separator="\t", infer_schema_length=0)
                df = df.with_columns([pl.col(col).cast(pl.Utf8) for col in df.columns])
    except Exception as e:
        parser.error(f"Error reading input file '{input_file}': {e}")

    # Read final clonotypes if provided (prioritize parquet over CSV)
    if args.final_clonotypes_parquet:
        final_clonotypes = pl.read_parquet(args.final_clonotypes_parquet)
        # Convert all columns to string to match CSV behavior
        final_clonotypes = final_clonotypes.with_columns([pl.col(col).cast(pl.Utf8) for col in final_clonotypes.columns])
    elif args.final_clonotypes_csv:
        final_clonotypes = pl.read_csv(args.final_clonotypes_csv, separator=",", infer_schema_length=0)
        final_clonotypes = final_clonotypes.with_columns([pl.col(col).cast(pl.Utf8) for col in final_clonotypes.columns])
    else:
        final_clonotypes = None

    # Merge with final clonotypes using clonotypeKey if provided
    if final_clonotypes is not None:
        df = df.join(final_clonotypes, on='clonotypeKey', how='inner')

    # Transform data to long format
    df_long = wide_to_long_polars(
        df,
        stubnames=['cdr3Sequence', 'vGene', 'jGene'],
        id_col='clonotypeKey',
        j_col='chain',
        sep='.',
        suffix='.+'
    )

    # Calculate lengths for valid sequences and filter out empty ones
    df_long = df_long.with_columns([
        pl.col('cdr3Sequence')
        .fill_null('')
        .str.strip_chars()
        .str.len_chars()
        .alias('cdr3Length')
    ])
    df_long = df_long.filter(pl.col('cdr3Length') > 0)

    if df_long.is_empty():
        # Create empty outputs if no valid data
        spectratype_df = pl.DataFrame(schema={"chain": pl.Utf8, "cdr3Length": pl.Int64, "vGene": pl.Utf8, "count": pl.UInt32})
        vj_usage_df = pl.DataFrame(schema={"chain": pl.Utf8, "vGene": pl.Utf8, "jGene": pl.Utf8, "count": pl.UInt32})
    else:
        # Generate CDR3 length spectratype
        # Sort by chain and cdr3Length, with vGene as tiebreaker for deterministic output
        spectratype_df = (df_long
                         .group_by(['chain', 'cdr3Length', 'vGene'])
                         .agg(pl.len().alias('count'))
                         .sort(['chain', 'cdr3Length', 'vGene']))

        # Generate V/J gene usage
        # Sort by count, then by chain, vGene, jGene for deterministic output
        vj_usage_df = (df_long
                      .group_by(['chain', 'vGene', 'jGene'])
                      .agg(pl.len().alias('count'))
                      .sort(['count', 'chain', 'vGene', 'jGene']))

    # Write outputs
    spectratype_df.write_csv(args.spectratype_tsv, separator="\t")
    vj_usage_df.write_csv(args.vj_usage_tsv, separator="\t")


if __name__ == "__main__":
    script_name = os.path.splitext(os.path.basename(__file__))[0]
    log_file = "spectratype.time.log"
    start_time = datetime.now()

    try:
        main()
    finally:
        end_time = datetime.now()
        duration = end_time - start_time
        with open(log_file, 'w') as f:
            f.write(f"Start time: {start_time.isoformat()}\n")
            f.write(f"End time: {end_time.isoformat()}\n")
            f.write(f"Duration: {duration.total_seconds():.6f} seconds\n")

# Example usage:
# python software/spectratype/src/main.py --input_tsv cdr3_sequences_input.tsv  --output_tsv 'cdr3_lengths.tsv' --vj_usage_tsv vj_usage.tsv
# python software/spectratype/src/main.py --input_tsv cdr3_sequences_input.tsv  --output_tsv 'cdr3_lengths.tsv' --vj_usage_tsv vj_usage.tsv --final_clonotypes_csv topClonotypes.csv

# You can check the if the output is correct with:
# awk '{ print length($2), $2 }' cdr3_sequences_input.tsv |sort -n -k1,1 | less