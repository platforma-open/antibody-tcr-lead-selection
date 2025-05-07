#!/usr/bin/env python3
"""
kmer_umap.py: Command-line tool to convert nucleotide sequences from a TSV file into 6-mer count vectors,
compute pairwise Euclidean distances, perform PCA, and output only the final UMAP embeddings.

Usage:
    python kmer_umap.py \
        -i input.tsv -c sequence_column \
        -u umap.csv \
        [--pca-components 10] [--umap-components 2] \
        [--umap-neighbors 15] [--umap-min-dist 0.1]

Inputs:
  - A TSV file (`-i`/`--input`) with at least one column of nucleotide sequences.
  - Specify the sequence column name with `-c`/`--seq-col` (default: "sequence").

Outputs:
  - A CSV file (`-u`/`--umap-output`) containing the UMAP embeddings for each sequence.
    Columns will be named UMAP1, UMAP2, etc.

Options:
  --pca-components   Number of PCA dimensions before UMAP (default: 10)
  --umap-components  Number of UMAP dimensions (default: 2)
  --umap-neighbors   UMAP n_neighbors (default: 15)
  --umap-min-dist    UMAP min_dist (default: 0.1)
"""

import argparse
import itertools
import numpy as np
import pandas as pd
import sys
from scipy.spatial.distance import pdist, squareform
from sklearn.metrics.pairwise import euclidean_distances
#from sklearn.decomposition import PCA
from sklearn.decomposition import TruncatedSVD
import umap


def kmer_count_vectors(sequences, k=6):
    bases = ['A', 'C', 'G', 'T']
    all_kmers = [''.join(p) for p in itertools.product(bases, repeat=k)]
    kmer_to_index = {kmer: idx for idx, kmer in enumerate(all_kmers)}

    num_seqs = len(sequences)
    num_kmers = len(all_kmers)
    matrix = np.zeros((num_seqs, num_kmers), dtype=int)

    for i, seq in enumerate(sequences):
        seq = str(seq).upper().strip("_")
        for j in range(len(seq) - k + 1):
            kmer = seq[j:j + k]
            idx = kmer_to_index.get(kmer)
            if idx is not None:
                matrix[i, idx] += 1
    return matrix


def main():
    parser = argparse.ArgumentParser(
        description='Compute UMAP embeddings from nucleotide sequences via k-mer counts and PCA.')
    parser.add_argument('-i', '--input', required=True,
                        help='Input TSV file with sequence column')
    parser.add_argument('-c', '--seq-col', default='aaSequence',
                        help='Name of the column containing sequences')
    parser.add_argument('-u', '--umap-output', required=True,
                        help='Output CSV file for UMAP embeddings')
    parser.add_argument('--dr-components', type=int, default=10,
                        help='Number of dimensionality reduction components before UMAP')
    parser.add_argument('--umap-components', type=int, default=2,
                        help='Number of UMAP dimensions')
    parser.add_argument('--umap-neighbors', type=int, default=15,
                        help='UMAP n_neighbors')
    parser.add_argument('--umap-min-dist', type=float, default=0.1,
                        help='UMAP min_dist')
    args = parser.parse_args()

    # Load input
    try:
        df_input = pd.read_csv(args.input, sep='\t', dtype=str)
    except Exception as e:
        sys.exit(f"Error reading input file: {e}")

    if args.seq_col not in df_input.columns:
        sys.exit(f"Error: column '{args.seq_col}' not found in input TSV.")
    sequences = df_input[args.seq_col].tolist()
    if not sequences:
        sys.exit('Error: No sequences found in the specified column.')

    # Compute k-mer counts
    matrix = kmer_count_vectors(sequences, k=6)
    
    # Avoid computing distances
    # print("Distances")
    # Compute distances
    # dist_matrix = squareform(pdist(matrix, metric='euclidean'))
    
    # Avoid PCA for sparse data. Use truncated SVD
    # print("PCA")

    # PCA on distance matrix
    # pca = PCA(n_components=args.dr_components)
    # pca_embed = pca.fit_transform(dist_matrix)

    # Run truncated SVD instead of PCA (nevermind the pca_components argument name)
    print("Running Truncated SVD...")
    svd = TruncatedSVD(n_components=args.dr_components)
    svd_embed = svd.fit_transform(matrix)
    
    print("UMAP")

    # UMAP on PCA results
    umap_model = umap.UMAP(
        n_components=args.umap_components,
        n_neighbors=args.umap_neighbors,
        min_dist=args.umap_min_dist,
        random_state=42				# Set seed for reproducibility
    )
    umap_embed = umap_model.fit_transform(svd_embed)

    # Save UMAP embeddings
    umap_df = pd.DataFrame(
        umap_embed,
	index=df_input.clonotypeKey,
        # index=df_input.index.astype(str),
        columns=[f'UMAP{i+1}' for i in range(args.umap_components)]
    )
    umap_df.to_csv(args.umap_output, index=False, sep='\t')
    print(f'UMAP embeddings saved to {args.umap_output}')

if __name__ == '__main__':
    main()
