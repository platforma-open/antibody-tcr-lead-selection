#!/usr/bin/env python3

import argparse
import os
import torch
from transformers import EsmForProteinFolding


def parse_arguments():
    parser = argparse.ArgumentParser(description="Generate 3D protein structures using ESMFold.")
    parser.add_argument("--sequence", required=True, help="Protein amino acid sequence")
    parser.add_argument("--output-path", default=".", help="Path to output directory (default: current directory)")
    parser.add_argument("--output-file", default="esmfold_structure.pdb", help="Output PDB filename (default: esmfold_structure.pdb)")
    parser.add_argument("--chunk-size", type=int, help="Chunk size for axial attention (default: auto)")
    return parser.parse_args()


def validate_sequence(sequence):
    """
    Validate amino acid sequence for protein modeling.
    
    Args:
        sequence: amino acid sequence string
    
    Returns:
        bool: True if sequence is valid, False otherwise
    """
    if not sequence:
        return False
    
    # Check for valid amino acid characters
    valid_aa = set('ACDEFGHIKLMNPQRSTVWY')
    sequence_aa = set(sequence.upper())
    
    if not sequence_aa.issubset(valid_aa):
        print(f"Warning: Sequence contains invalid amino acid characters")
        return False
    
    # Check minimum length for meaningful protein modeling
    if len(sequence) < 10:
        print(f"Warning: Sequence is very short ({len(sequence)} aa), may not have meaningful 3D structure")
        # Don't return False, just warn
    
    # Check maximum length (ESMFold can handle long sequences but with memory constraints)
    if len(sequence) > 2000:
        print(f"Warning: Sequence is very long ({len(sequence)} aa), may require significant memory and time")
        return False
    
    return True


def predict_protein_structure(sequence, output_path=".", output_file="esmfold_structure.pdb", chunk_size=None):
    """
    Predict 3D protein structure using ESMFold.
    
    Args:
        sequence: protein amino acid sequence
        output_path: directory to save output files
        output_file: name of output PDB file
        chunk_size: chunk size for axial attention (optional)
    
    Returns:
        str: path to generated PDB file
    """
    
    # Validate sequence
    if not validate_sequence(sequence):
        raise ValueError("Invalid protein sequence")
    
    print(f"Predicting protein structure for sequence length: {len(sequence)}")
    
    # Check CUDA availability
    if not torch.cuda.is_available():
        print("Warning: CUDA not available, using CPU (this will be much slower)")
        device = "cpu"
    else:
        device = "cuda"
        print("Using CUDA for acceleration")
    
    # Initialize ESMFold model
    try:
        model = EsmForProteinFolding.from_pretrained("facebook/esmfold_v1")
        model = model.eval().to(device)
        print("ESMFold model loaded successfully")
    except Exception as e:
        raise RuntimeError(f"Failed to load ESMFold model: {e}")
    
    # Set chunk size if provided
    if chunk_size:
        try:
            model.set_chunk_size(chunk_size)
            print(f"Set chunk size to: {chunk_size}")
        except Exception as e:
            print(f"Warning: Failed to set chunk size: {e}")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_path, exist_ok=True)
    
    # Predict protein structure
    try:
        with torch.no_grad():
            output = model.infer_pdb(sequence)
        print("Protein structure prediction completed successfully")
    except Exception as e:
        raise RuntimeError(f"Failed to predict protein structure: {e}")
    
    # Save structure to PDB file
    output_file_path = os.path.join(output_path, output_file)
    try:
        with open(output_file_path, "w") as f:
            f.write(output)
        print(f"Protein structure saved to: {output_file_path}")
    except Exception as e:
        raise RuntimeError(f"Failed to save protein structure: {e}")
    
    return output_file_path


def main():
    args = parse_arguments()
    
    # Validate output path
    if not os.path.exists(args.output_path):
        try:
            os.makedirs(args.output_path, exist_ok=True)
            print(f"Created output directory: {args.output_path}")
        except Exception as e:
            print(f"Error creating output directory: {e}")
            return 1
    
    try:
        # Predict protein structure
        output_file_path = predict_protein_structure(
            sequence=args.sequence,
            output_path=args.output_path,
            output_file=args.output_file,
            chunk_size=args.chunk_size
        )
        
        print(f"Protein modeling completed successfully")
        print(f"Output file: {output_file_path}")
        return 0
        
    except ValueError as e:
        print(f"Validation error: {e}")
        return 1
    except RuntimeError as e:
        print(f"Runtime error: {e}")
        return 1
    except Exception as e:
        print(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())