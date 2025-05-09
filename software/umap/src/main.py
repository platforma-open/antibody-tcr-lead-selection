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
import os
from scipy.spatial.distance import pdist, squareform
from sklearn.metrics.pairwise import euclidean_distances
from sklearn.decomposition import TruncatedSVD
import umap

def kmer_count_vectors(sequences, k=6):
    """
    Convert amino acid sequences to k-mer count vectors.
    
    Args:
        sequences (list): List of amino acid sequences
        k (int): Size of k-mers to count
        
    Returns:
        numpy.ndarray: Matrix of k-mer counts
    """
    print(f"Generating {k}-mer count vectors...")
    # Standard amino acid alphabet
    amino_acids = ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 
                   'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'Y']
    all_kmers = [''.join(p) for p in itertools.product(amino_acids, repeat=k)]
    kmer_to_index = {kmer: idx for idx, kmer in enumerate(all_kmers)}

    num_seqs = len(sequences)
    num_kmers = len(all_kmers)
    
    # Use sparse matrix for memory efficiency
    from scipy import sparse
    matrix = sparse.lil_matrix((num_seqs, num_kmers), dtype=np.int32)

    # Process sequences in batches
    batch_size = 1000
    for i in range(0, num_seqs, batch_size):
        batch_end = min(i + batch_size, num_seqs)
        print(f"Processing sequences {i+1} to {batch_end} of {num_seqs}...")
        
        for j in range(i, batch_end):
            seq = str(sequences[j]).upper().strip("_")
            for pos in range(len(seq) - k + 1):
                kmer = seq[pos:pos + k]
                idx = kmer_to_index.get(kmer)
                if idx is not None:
                    matrix[j, idx] += 1
    
    # Convert to CSR format for efficient operations
    return matrix.tocsr()

def main():
    parser = argparse.ArgumentParser(
        description='Compute UMAP embeddings from amino acid sequences via k-mer counts and PCA.')
    parser.add_argument('-i', '--input', required=True,
                        help='Input TSV file with sequence column')
    parser.add_argument('-c', '--seq-col', default='aaSequence',
                        help='Name of the column containing amino acid sequences')
    parser.add_argument('-u', '--umap-output', required=True,
                        help='Output TSV file for UMAP embeddings')
    parser.add_argument('--dr-components', type=int, default=5,
                        help='Number of dimensionality reduction components before UMAP (default: 5)')
    parser.add_argument('--umap-components', type=int, default=2,
                        help='Number of UMAP dimensions (default: 2)')
    parser.add_argument('--umap-neighbors', type=int, default=8,
                        help='UMAP n_neighbors (default: 8)')
    parser.add_argument('--umap-min-dist', type=float, default=0.05,
                        help='UMAP min_dist (default: 0.05)')
    parser.add_argument('--k-mer-size', type=int, default=3,
                        help='Size of k-mers to use for sequence analysis (default: 3 for amino acids)')
    parser.add_argument('--output-dir', default='.',
                        help='Directory to save output files')
    args = parser.parse_args()

    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    print("Starting k-mer UMAP analysis for amino acid sequences")
    print(f"Input file: {args.input}")
    print(f"Output file: {args.umap_output}")
    print(f"Parameters: k-mer size={args.k_mer_size}, "
          f"DR components={args.dr_components}, "
          f"UMAP components={args.umap_components}, "
          f"UMAP neighbors={args.umap_neighbors}, "
          f"UMAP min_dist={args.umap_min_dist}")

    # Validate input parameters
    if args.dr_components < 1:
        print("Error: Number of dimensionality reduction components must be at least 1")
        sys.exit(1)
    if args.umap_components < 1:
        print("Error: Number of UMAP components must be at least 1")
        sys.exit(1)
    if args.umap_neighbors < 1:
        print("Error: UMAP neighbors must be at least 1")
        sys.exit(1)
    if args.umap_min_dist < 0 or args.umap_min_dist > 1:
        print("Error: UMAP min_dist must be between 0 and 1")
        sys.exit(1)
    if args.k_mer_size < 1:
        print("Error: k-mer size must be at least 1")
        sys.exit(1)

    # Load input with better error handling
    try:
        print("Loading input file...")
        df_input = pd.read_csv(args.input, sep='\t', dtype=str)
        print(f"Loaded {len(df_input)} sequences")
    except FileNotFoundError:
        print(f"Error: Input file '{args.input}' not found")
        sys.exit(1)
    except pd.errors.EmptyDataError:
        print("Error: Input file is empty")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading input file: {e}")
        sys.exit(1)

    if args.seq_col not in df_input.columns:
        print(f"Error: Column '{args.seq_col}' not found in input TSV. Available columns: {', '.join(df_input.columns)}")
        sys.exit(1)
    
    sequences = df_input[args.seq_col].tolist()
    if not sequences:
        print('Error: No sequences found in the specified column.')
        sys.exit(1)
    
    # Validate sequences for amino acids
    valid_aas = {'A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 
                 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'Y', '*'}
    invalid_seqs = []
    for i, seq in enumerate(sequences):
        # Remove trailing underscore and check each character
        seq = str(seq).upper().rstrip("_")
        if not all(aa in valid_aas for aa in seq):
            invalid_seqs.append(i)
    if invalid_seqs:
        print(f"Error: Invalid amino acid sequences found at rows: {invalid_seqs}")
        sys.exit(1)

    # Compute k-mer counts
    print("Computing k-mer counts...")
    matrix = kmer_count_vectors(sequences, k=args.k_mer_size)
    
    # Run truncated SVD
    print("Running Truncated SVD...")
    svd = TruncatedSVD(n_components=args.dr_components)
    svd_embed = svd.fit_transform(matrix)
    print(f"Explained variance ratio: {sum(svd.explained_variance_ratio_):.3f}")
    
    # Run UMAP
    print("Running UMAP...")
    umap_model = umap.UMAP(
        n_components=args.umap_components,
        n_neighbors=args.umap_neighbors,
        min_dist=args.umap_min_dist,
        n_jobs=-1  # Use all available cores
    )
    umap_embed = umap_model.fit_transform(svd_embed)

    # Save UMAP embeddings
    output_path = os.path.join(args.output_dir, args.umap_output)
    umap_df = pd.DataFrame(
        umap_embed,
        index=df_input.clonotypeKey,
        columns=[f'UMAP{i+1}' for i in range(args.umap_components)]
    )
    umap_df.to_csv(output_path, index=True, sep='\t')
    print(f'UMAP embeddings saved to {output_path}')
    print("Analysis complete")

if __name__ == '__main__':
    main()
