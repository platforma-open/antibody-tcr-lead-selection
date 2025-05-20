import pandas as pd
import argparse

def main():
    parser = argparse.ArgumentParser(description="Calculate CDR3 lengths and output in long format.")
    parser.add_argument("--input_tsv", required=True, help="Input TSV file with clonotypeKey, cdr3Sequence[.chain], and vGene[.chain] columns.")
    parser.add_argument("--output_tsv", required=True, help="Output TSV file with chain, cdr3Length, vGene, and count columns.")
    args = parser.parse_args()

    df = pd.read_csv(args.input_tsv, sep="\t", dtype=str)

    # The input file has clonotypeKey, and one or two cdr3Sequence[.chain] columns, and one or two vGene[.chain] columns
    # The output file will have chain, cdr3Length, vGene, and count columns

    # Identify sequence and vGene columns
    sequence_cols = [col for col in df.columns if col.startswith("cdr3Sequence")]
    vgene_cols = [col for col in df.columns if col.startswith("vGene")]
    output_rows = []

    for _, row in df.iterrows():
        for seq_col in sequence_cols:
            cdr3_sequence = row[seq_col]
            if pd.notna(cdr3_sequence) and str(cdr3_sequence).strip() != "":
                # Extract chain from column name
                chain = seq_col.split(".", 1)[1] if "." in seq_col else "unknown"
                # Find corresponding vGene column and value
                # next() returns the first element of the iterator that satisfies the condition, else returns None
                vgene_col = next((col for col in vgene_cols if col.endswith(f".{chain}")), None)
                vgene = row[vgene_col] if vgene_col else "unknown"
                
                output_rows.append({
                    "chain": chain,
                    "cdr3Length": len(str(cdr3_sequence)),
                    "vGene": vgene
                })

    # Convert to DataFrame and aggregate
    if not output_rows:
        output_df = pd.DataFrame(columns=["chain", "cdr3Length", "vGene", "count"])
    else:
        temp_df = pd.DataFrame(output_rows)
        temp_df['cdr3Length'] = pd.to_numeric(temp_df['cdr3Length'])
        output_df = temp_df.groupby(['chain', 'cdr3Length', 'vGene']).size().reset_index(name='count')
        output_df = output_df.sort_values(['chain', 'cdr3Length'])

    output_df.to_csv(args.output_tsv, sep="\t", index=False)

# Example usage:
# python software/spectratype/src/main.py --input_tsv cdr3_sequences_input.tsv  --output_tsv 'cdr3_lengths.tsv'

# You can check the if the output is correct with:
# awk '{ print length($2), $2 }' cdr3_sequences_input.tsv |sort -n -k1,1 | less

if __name__ == "__main__":
    main()