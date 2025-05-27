import pandas as pd
import argparse

# Expected input file has clonotypeKey, and one or two cdr3Sequence[.chain] columns, and one or two vGene[.chain] columns
# Spectratype output file will have chain, cdr3Length, vGene, and count columns
# V/J usage output file will have chain, vGene, jGene, and count columns

# An optional input file can be provided: topClonotypes.csv 
# It will have cluster_0,clonotypeKey,top columns (top is 1) and only top clonotypes are included in the file

def main():
    parser = argparse.ArgumentParser(description="Calculate CDR3 lengths and output in long format.")
    parser.add_argument("--input_tsv", required=True, 
                       help="Input TSV file with clonotypeKey, cdr3Sequence[.chain], and vGene[.chain] columns.")
    parser.add_argument("--spectratype_tsv", required=True, 
                       help="Output TSV file with chain, cdr3Length, vGene, and count columns.")
    parser.add_argument("--vj_usage_tsv", required=True,
                        help="Output TSV file with vGene, jGene, and count columns for V/J gene usage.")
    parser.add_argument("--top_clonotypes_csv", required=False,
                        help="Input CSV file with top clonotypes to calculate spectratype and V/J gene usage only on top clonotypes.")
    args = parser.parse_args()

    # Read input data
    df = pd.read_csv(args.input_tsv, sep="\t", dtype=str)

    # Read top clonotypes if provided
    if args.top_clonotypes_csv:
        top_clonotypes = pd.read_csv(args.top_clonotypes_csv, sep=",", dtype=str)
    else:
        top_clonotypes = None

    # Merge with top clonotypes using clonotypeKey if provided
    if top_clonotypes is not None:
        df = pd.merge(df, top_clonotypes, on='clonotypeKey', how='inner')

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
    df_long['cdr3Length'] = df_long['cdr3Sequence'].str.strip().str.len()
    df_long = df_long[df_long['cdr3Length'] > 0].copy()

    if df_long.empty:
        # Create empty outputs if no valid data
        spectratype_df = pd.DataFrame(columns=["chain", "cdr3Length", "vGene", "count"])
        vj_usage_df = pd.DataFrame(columns=["chain", "vGene", "jGene", "count"])
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

    # Write outputs
    spectratype_df.to_csv(args.spectratype_tsv, sep="\t", index=False)
    vj_usage_df.to_csv(args.vj_usage_tsv, sep="\t", index=False)


if __name__ == "__main__":
    main()

# Example usage:
# python software/spectratype/src/main.py --input_tsv cdr3_sequences_input.tsv  --output_tsv 'cdr3_lengths.tsv' --vj_usage_tsv vj_usage.tsv
# python software/spectratype/src/main.py --input_tsv cdr3_sequences_input.tsv  --output_tsv 'cdr3_lengths.tsv' --vj_usage_tsv vj_usage.tsv --top_clonotypes_csv topClonotypes.csv

# You can check the if the output is correct with:
# awk '{ print length($2), $2 }' cdr3_sequences_input.tsv |sort -n -k1,1 | less