import argparse
import os
from typing import Dict, List, Tuple, Optional

import polars as pl


def load_anarci_csv(path: Optional[str]) -> Tuple[Optional[Dict[str, str]], Optional[List[str]]]:
    if not path or not os.path.exists(path):
        return None, None
    # Read with polars; enforce string dtypes for robust string ops
    df = pl.read_csv(path, infer_schema_length=0)
    fields = df.columns
    try:
        start_idx = fields.index("1")
    except ValueError:
        start_idx = None
    kabat_cols = fields[start_idx:] if start_idx is not None else []
    positions = kabat_cols[:]
    if not kabat_cols:
        return {}, []

    # Ensure Id and numbered columns are Utf8 strings
    exprs = []
    if "Id" in fields:
        exprs.append(pl.col("Id").cast(pl.Utf8))
    for c in kabat_cols:
        exprs.append(pl.col(c).cast(pl.Utf8).fill_null(""))
    if exprs:
        df = df.with_columns(exprs)

    # Build clonotypeKey and sanitized AA sequence
    seq_expr = pl.concat_str([pl.col(c).fill_null("") for c in kabat_cols]).str.to_uppercase()
    # Keep only AA letters and gaps
    seq_expr = seq_expr.str.replace_all(r"[^ACDEFGHIKLMNPQRSTVWYXBZJ-]", "")
    key_expr = pl.col("Id").cast(pl.Utf8).fill_null("").str.replace(r"\|.*$", "")
    df2 = df.with_columns(
        key_expr.alias("clonotypeKey"),
        seq_expr.alias("seq"),
    )

    seq_by_key: Dict[str, str] = dict(zip(df2["clonotypeKey"].to_list(), df2["seq"].to_list()))
    return seq_by_key, positions


def write_kabat_tsv(
    out_path: str,
    h_rows: Optional[Dict[str, str]],
    h_positions: Optional[List[str]],
    kl_rows: Optional[Dict[str, str]],
    kl_positions: Optional[List[str]],
) -> None:
    keys: List[str] = []
    seen = set()
    for src in (h_rows, kl_rows):
        if not src:
            continue
        for k in src.keys():
            if k not in seen:
                seen.add(k)
                keys.append(k)
    keys.sort()

    cols = ["clonotypeKey"]
    if h_rows is not None:
        cols += ["kabatSequence_H", "kabatPositions_H"]
    if kl_rows is not None:
        cols += ["kabatSequence_KL", "kabatPositions_KL"]

    data: List[List[str]] = []
    for k in keys:
        row: List[str] = [k]
        if h_rows is not None:
            row += [h_rows.get(k, ""), ",".join(h_positions or [])]
        if kl_rows is not None:
            row += [kl_rows.get(k, ""), ",".join(kl_positions or [])]
        data.append(row)

    df_out = pl.DataFrame(data, schema=cols)
    df_out.write_csv(out_path, separator="\t")


def main() -> None:
    p = argparse.ArgumentParser(description="Build KABAT TSV from ANARCI CSV outputs")
    p.add_argument("--h_csv", required=False, help="Path to H chain ANARCI CSV")
    p.add_argument("--kl_csv", required=False, help="Path to KL chain ANARCI CSV")
    p.add_argument("--out_tsv", required=True, help="Output KABAT TSV path")
    args = p.parse_args()
    print(args)

    h_rows, h_pos = load_anarci_csv(args.h_csv)
    kl_rows, kl_pos = load_anarci_csv(args.kl_csv)
    write_kabat_tsv(args.out_tsv, h_rows, h_pos, kl_rows, kl_pos)


if __name__ == "__main__":
    main()


