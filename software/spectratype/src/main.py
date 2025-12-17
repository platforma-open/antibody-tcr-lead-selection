import pandas as pd
import argparse
import time

# Expected input file has clonotypeKey, and one or two cdr3Sequence[.chain] columns, and one or two vGene[.chain] columns
# Spectratype output file will have chain, cdr3Length, vGene, and count columns
# V/J usage output file will have chain, vGene, jGene, and count columns

# An optional input file can be provided: final_clonotypes.csv 
# It will have cluster_0,clonotypeKey,top columns (top is 1) and only final clonotypes are included in the file

def main():
    start_time = time.time()
    print(f"Starting CDR3 spectratype calculation at {time.strftime('%H:%M:%S')}")
    
    parser = argparse.ArgumentParser(description="Calculate CDR3 lengths and output in long format.")
    parser.add_argument("--input_parquet", required=True, 
                       help="Input Parquet file with clonotypeKey, cdr3Sequence[.chain], and vGene[.chain] columns.")
    parser.add_argument("--final-clonotypes", required=False,
                        help="Input Parquet file with top/filtered clonotypes to calculate spectratype and V/J gene usage only on them.")
    parser.add_argument("--spectratype_tsv", required=True, 
                       help="Output TSV file with chain, cdr3Length, vGene, and count columns.")
    parser.add_argument("--vj_usage_tsv", required=True,
                        help="Output TSV file with vGene, jGene, and count columns for V/J gene usage.")
    args = parser.parse_args()

    # Read input data
    load_start = time.time()
    df = pd.read_parquet(args.input_parquet)
    load_time = time.time() - load_start
    print(f"✓ Data loading: {load_time:.3f}s ({len(df):,} rows, {len(df.columns)} columns)")

    # Read final clonotypes if provided (now in Parquet format)
    if args.final_clonotypes:
        final_clonotypes = pd.read_parquet(args.final_clonotypes)
        print(f"✓ Loaded final clonotypes: {len(final_clonotypes):,} rows")
    else:
        final_clonotypes = None

    # Merge with final clonotypes using clonotypeKey if provided
    processing_start = time.time()
    if final_clonotypes is not None:
        df = pd.merge(df, final_clonotypes, on='clonotypeKey', how='inner')
        print(f"✓ Merged with final clonotypes: {len(df):,} rows remaining")

    # Transform data to long format
    df_long = pd.wide_to_long(
        df,
        stubnames=['cdr3Sequence', 'vGene', 'jGene'],
        i='clonotypeKey',
        j='chain',
        sep='.',
        suffix='.+'
    ).reset_index()

    # Calculate lengths for valid sequences and filter out empty ones
    # Ensure string dtype to avoid .str accessor errors and use .str.len()
    df_long['cdr3Length'] = df_long['cdr3Sequence'].fillna('').str.strip().str.len()
    df_long = df_long[df_long['cdr3Length'] > 0].copy()

    if df_long.empty:
        # Create empty outputs if no valid data
        spectratype_df = pd.DataFrame(columns=["chain", "cdr3Length", "vGene", "count"])
        vj_usage_df = pd.DataFrame(columns=["chain", "vGene", "jGene", "count"])
        print("Warning: No valid CDR3 sequences found")
    else:
        # Generate CDR3 length spectratype
        spectratype_df = (df_long
                         .groupby(['chain', 'cdr3Length', 'vGene'])
                         .size()
                         .reset_index(name='count')
                         .sort_values(['chain', 'cdr3Length']))

        # Generate V/J gene usage
        vj_usage_df = (df_long
                      .groupby(['chain', 'vGene', 'jGene'])
                      .size()
                      .reset_index(name='count')
                      .sort_values('count'))
        
        print(f"✓ Generated spectratype: {len(spectratype_df):,} entries")
        print(f"✓ Generated V/J usage: {len(vj_usage_df):,} entries")
    
    processing_time = time.time() - processing_start
    print(f"✓ Processing: {processing_time:.3f}s")

    # Write outputs
    output_start = time.time()
    spectratype_df.to_csv(args.spectratype_tsv, sep="\t", index=False)
    vj_usage_df.to_csv(args.vj_usage_tsv, sep="\t", index=False)
    output_time = time.time() - output_start
    print(f"✓ Output: {output_time:.3f}s")
    
    total_time = time.time() - start_time
    print(f"🎯 Total time: {total_time:.3f}s")


if __name__ == "__main__":
    main()

# Example usage:
# python software/spectratype/src/main.py --input_tsv cdr3_sequences_input.tsv  --output_tsv 'cdr3_lengths.tsv' --vj_usage_tsv vj_usage.tsv
# python software/spectratype/src/main.py --input_tsv cdr3_sequences_input.tsv  --output_tsv 'cdr3_lengths.tsv' --vj_usage_tsv vj_usage.tsv --final_clonotypes_csv topClonotypes.csv

# You can check the if the output is correct with:
# awk '{ print length($2), $2 }' cdr3_sequences_input.tsv |sort -n -k1,1 | less