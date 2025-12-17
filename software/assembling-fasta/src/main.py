import argparse
import sys
from typing import List
import polars as pl


def to_fasta(input_parquet: str, key_column: str, output_fasta: str, final_clonotypes: str | None = None) -> None:
    keys: set[str] | None = None
    if final_clonotypes:
        keys = set()
        # Read final clonotypes from Parquet
        final_df = pl.read_parquet(final_clonotypes)
        # Prefer explicit key columns if present
        key_field = None
        if "clonotypeKey" in final_df.columns:
            key_field = "clonotypeKey"
        elif "scClonotypeKey" in final_df.columns:
            key_field = "scClonotypeKey"
        elif len(final_df.columns) > 0:
            key_field = final_df.columns[0]
        
        if key_field:
            for row in final_df.to_dicts():
                key_value = row.get(key_field)
                if key_value is not None:
                    keys.add(str(key_value))

    # Read parquet file using Polars
    df = pl.read_parquet(input_parquet)
    fieldnames: List[str] = list(df.columns)
    
    if key_column not in fieldnames:
        print(f"Key column '{key_column}' not found in Parquet file", file=sys.stderr)
        sys.exit(2)

    seq_cols = [c for c in fieldnames if c != key_column]
    
    with open(output_fasta, "w") as out:
        # Iterate over rows as dictionaries
        for row in df.to_dicts():
            key = str(row.get(key_column) or "").strip()
            if not key:
                continue
            if keys is not None and key not in keys:
                continue
            for c in seq_cols:
                seq = str(row.get(c) or "").strip()
                if not seq:
                    continue
                # header contains clonotype key and column header to distinguish chains/features
                out.write(f">{key}|{c}\n{seq}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert assembling feature Parquet to FASTA")
    parser.add_argument("--input_parquet", required=True, help="Input Parquet: key + one or more sequence columns")
    parser.add_argument("--key_column", required=True, help="Name of the key column (clonotypeKey or scClonotypeKey)")
    parser.add_argument("--output_fasta", required=True, help="Output FASTA file path")
    parser.add_argument("--final-clonotypes", required=False, help="Optional Parquet file with allowed keys")

    args = parser.parse_args()
    to_fasta(
        input_parquet=args.input_parquet,
        key_column=args.key_column,
        output_fasta=args.output_fasta,
        final_clonotypes=args.final_clonotypes,
    )


if __name__ == "__main__":
    main()


