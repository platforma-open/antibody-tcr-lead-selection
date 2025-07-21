#!/usr/bin/env python3

import argparse
import os
import json
from ImmuneBuilder import ABodyBuilder2


def parse_arguments():
    parser = argparse.ArgumentParser(description="Generate 3D antibody structures using AbodyBuilder2.")
    parser.add_argument("--h-sequence", required=True, help="Heavy chain amino acid sequence")
    parser.add_argument("--l-sequence", help="Light chain amino acid sequence")
    parser.add_argument("--output-path", required=True, help="Path to output directory")
    parser.add_argument("--output-file", default="abodyBuilder.pdb", help="Output PDB filename (default: abodyBuilder.pdb)")
    return parser.parse_args()


def validate_sequence(sequence, chain_type):
    """
    Validate amino acid sequence for antibody modeling.
    
    Args:
        sequence: amino acid sequence string
        chain_type: type of chain ('H' for heavy, 'L' for light)
    
    Returns:
        bool: True if sequence is valid, False otherwise
    """
    if not sequence:
        return False
    
    # Check for valid amino acid characters
    valid_aa = set('ACDEFGHIKLMNPQRSTVWY')
    sequence_aa = set(sequence.upper())
    
    if not sequence_aa.issubset(valid_aa):
        print(f"Warning: {chain_type} sequence contains invalid amino acid characters")
        return False
    
    # Check minimum length for antibody modeling
    if len(sequence) < 50:
        print(f"Warning: {chain_type} sequence is very short ({len(sequence)} aa) for antibody modeling")
        return False
    
    return True


def predict_antibody_structure(h_sequence, l_sequence=None, output_path=".", output_file="abodyBuilder.pdb"):
    """
    Predict 3D antibody structure using AbodyBuilder2.
    
    Args:
        h_sequence: heavy chain amino acid sequence (required)
        l_sequence: light chain amino acid sequence (optional)
        output_path: directory to save output files
        output_file: name of output PDB file
    
    Returns:
        str: path to generated PDB file
    """
    
    # Validate sequences
    sequences = {}
    
    # Heavy chain is always required
    if validate_sequence(h_sequence, 'H'):
        sequences['H'] = h_sequence
    else:
        raise ValueError("Invalid heavy chain sequence")
    
    if l_sequence:
        if validate_sequence(l_sequence, 'L'):
            sequences['L'] = l_sequence
        else:
            raise ValueError("Invalid light chain sequence")
    
    print(f"Predicting antibody structure with sequences: {list(sequences.keys())}")
    print(f"Heavy chain length: {len(h_sequence) if h_sequence else 'N/A'}")
    print(f"Light chain length: {len(l_sequence) if l_sequence else 'N/A'}")
    
    # Initialize AbodyBuilder2
    try:
        predictor = ABodyBuilder2()
        print("AbodyBuilder2 initialized successfully")
    except Exception as e:
        raise RuntimeError(f"Failed to initialize AbodyBuilder2: {e}")
    
    # Predict antibody structure
    try:
        antibody = predictor.predict(sequences)
        print("Antibody structure prediction completed successfully")
    except Exception as e:
        raise RuntimeError(f"Failed to predict antibody structure: {e}")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_path, exist_ok=True)
    
    # Save structure to PDB file
    output_file_path = os.path.join(output_path, output_file)
    try:
        antibody.save(output_file_path)
        print(f"Antibody structure saved to: {output_file_path}")
    except Exception as e:
        raise RuntimeError(f"Failed to save antibody structure: {e}")
    
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
        # Predict antibody structure
        output_file_path = predict_antibody_structure(
            h_sequence=args.h_sequence,
            l_sequence=args.l_sequence,
            output_path=args.output_path,
            output_file=args.output_file
        )
        
        print(f"Antibody modeling completed successfully")
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