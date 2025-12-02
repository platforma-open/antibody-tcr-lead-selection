import argparse
import csv
import sys
import os
from datetime import datetime
from typing import List


def to_fasta(input_tsv: str, key_column: str, output_fasta: str, final_csv: str | None = None, final_parquet: str | None = None) -> None:
    keys: set[str] | None = None
    if final_parquet:
        import pandas as pd
        keys = set()
        df = pd.read_parquet(final_parquet)
        # Prefer explicit key columns if present
        key_field = (
            "clonotypeKey"
            if "clonotypeKey" in df.columns
            else ("scClonotypeKey" if "scClonotypeKey" in df.columns else None)
        )
        if key_field is None and len(df.columns) > 0:
            key_field = df.columns[0]
        if key_field:
            keys = set(df[key_field].astype(str).tolist())
    elif final_csv:
        keys = set()
        with open(final_csv, newline="") as f:
            r = csv.DictReader(f)
            # Prefer explicit key columns if present
            key_field = (
                "clonotypeKey"
                if "clonotypeKey" in (r.fieldnames or [])
                else ("scClonotypeKey" if "scClonotypeKey" in (r.fieldnames or []) else None)
            )
            if key_field is None and r.fieldnames:
                key_field = r.fieldnames[0]
            for row in r:
                keys.add(row[key_field])  # type: ignore[arg-type]

    with open(input_tsv, newline="") as f, open(output_fasta, "w") as out:
        r = csv.DictReader(f, delimiter="\t")
        fieldnames: List[str] = list(r.fieldnames or [])
        if key_column not in fieldnames:
            print(f"Key column '{key_column}' not found in TSV", file=sys.stderr)
            sys.exit(2)

        seq_cols = [c for c in fieldnames if c != key_column]
        for row in r:
            key = (row.get(key_column) or "").strip()
            if not key:
                continue
            if keys is not None and key not in keys:
                continue
            for c in seq_cols:
                seq = (row.get(c) or "").strip()
                if not seq:
                    continue
                # header contains clonotype key and column header to distinguish chains/features
                out.write(f">{key}|{c}\n{seq}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert assembling feature TSV to FASTA")
    parser.add_argument("--input_tsv", required=True, help="Input TSV: key + one or more sequence columns")
    parser.add_argument("--key_column", required=True, help="Name of the key column (clonotypeKey or scClonotypeKey)")
    parser.add_argument("--output_fasta", required=True, help="Output FASTA file path")
    parser.add_argument("--final_clonotypes_csv", required=False, help="Optional CSV with allowed keys (deprecated, use --final_clonotypes_parquet instead)")
    parser.add_argument("--final_clonotypes_parquet", required=False, help="Optional Parquet file with allowed keys")

    args = parser.parse_args()
    to_fasta(
        input_tsv=args.input_tsv,
        key_column=args.key_column,
        output_fasta=args.output_fasta,
        final_csv=args.final_clonotypes_csv,
        final_parquet=args.final_clonotypes_parquet,
    )


if __name__ == "__main__":
    script_name = os.path.splitext(os.path.basename(__file__))[0]
    log_file = f"{script_name}.time.log"
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


