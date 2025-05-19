import pandas as pd
import argparse

# Expected input file has clonotypeKey, and one or two cdr3Sequence[.chain] columns, and one or two vGene[.chain] columns
# Output file will have chain, cdr3Length, vGene, and count columns

def main():
    parser = argparse.ArgumentParser(description="Calculate CDR3 lengths and output in long format.")
    parser.add_argument("--input_tsv", required=True, 
                       help="Input TSV file with clonotypeKey, cdr3Sequence[.chain], and vGene[.chain] columns.")
    parser.add_argument("--output_tsv", required=True, 
                       help="Output TSV file with chain, cdr3Length, vGene, and count columns.")
    args = parser.parse_args()

    # Read input data
    df = pd.read_csv(args.input_tsv, sep="\t", dtype=str)

    # Transform data to long format
    df_long = pd.wide_to_long(
        df,
        stubnames=['cdr3Sequence', 'vGene'],
        i='clonotypeKey',
        j='chain',
        sep='.',
        suffix='.+'
    ).reset_index()

    # Filter out rows with empty sequences
    mask = df_long['cdr3Sequence'].notna() & (df_long['cdr3Sequence'].str.strip() != '')
    df_long = df_long[mask].copy()

    if df_long.empty:
        # Create empty output if no valid data after filtering
        output_df = pd.DataFrame(columns=["chain", "cdr3Length", "vGene", "count"])
    else:
        # Calculate CDR3 lengths
        df_long['cdr3Length'] = df_long['cdr3Sequence'].str.len()

        # Group and aggregate
        output_df = (df_long
                    .groupby(['chain', 'cdr3Length', 'vGene'])
                    .size()
                    .reset_index(name='count'))

        # Sort by chain and length
        #output_df = output_df.sort_values(['chain', 'cdr3Length'])

    # Write output
    output_df.to_csv(args.output_tsv, sep="\t", index=False)


if __name__ == "__main__":
    main()

# Example usage:
# python software/spectratype/src/main.py --input_tsv cdr3_sequences_input.tsv  --output_tsv 'cdr3_lengths.tsv'

# You can check the if the output is correct with:
# awk '{ print length($2), $2 }' cdr3_sequences_input.tsv |sort -n -k1,1 | less