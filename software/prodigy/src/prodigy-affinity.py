import subprocess
import os
import argparse
import re
import csv
import shutil

def run_prodigy(input_path: str, selection_chains: list = None):
    """
    Runs the PRODIGY command on an input file or directory, optionally with a chain selection.

    Args:
        input_path: The path to the input PDB file or directory.
        selection_chains: A list of chain IDs for the --selection argument (e.g., ['A', 'B']).

    Returns:
        The standard output from the PRODIGY command as a string, or None if an error occurs.
    """
    if not os.path.exists(input_path):
        print(f"Error: Input path not found at '{input_path}'")
        return None

    # Build the command list
    command = ["prodigy", input_path]
    if selection_chains and isinstance(selection_chains, list):
        command.append("--selection")
        command.extend(selection_chains)

    print(f"Executing command: {' '.join(command)}")

    try:
        # Run the command and capture the output
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )
        print("PRODIGY executed successfully.")
        return result.stdout

    except FileNotFoundError:
        print("Error: 'prodigy' command not found. Is 'prodigy-prot' installed and in your PATH?")
        return None
    except subprocess.CalledProcessError as e:
        print("An error occurred while running PRODIGY:")
        print(f"Error Output:\n{e.stderr}")
        return None

def process_and_store_results(prodigy_output: str, input_directory: str, output_file: str, best_affinity_file: str, output_pdb_name: str):
    """
    Parses the PRODIGY output, prints it, saves it to files, and copies the best PDB.

    Args:
        prodigy_output: The raw string output from the PRODIGY command.
        input_directory: Directory where input PDBs are located.
        output_file: The path to the output CSV file for all results.
        best_affinity_file: The path to the output file for the best result.
        output_pdb_name: Name for the PDB file with the highest affinity.
    """
    results = []
    # Split the output into blocks for each complex, using the separator
    complex_blocks = prodigy_output.strip().split('##########################################')

    # Regex patterns to find the required data
    file_name_pattern = re.compile(r"\[\+\] Parsed structure file (\S+)")
    affinity_pattern = re.compile(r"Predicted binding affinity \(kcal\.mol-1\):\s*(\S+)")
    dissociation_pattern = re.compile(r"Predicted dissociation constant \(M\) at .*?˚C:\s*(\S+)")

    for block in complex_blocks:
        if not block.strip():
            continue

        file_name_match = file_name_pattern.search(block)
        affinity_match = affinity_pattern.search(block)
        dissociation_match = dissociation_pattern.search(block)

        # Extract data if all parts are found
        if file_name_match and affinity_match and dissociation_match:
            file_name = file_name_match.group(1)
            affinity = affinity_match.group(1)
            dissociation = dissociation_match.group(1)
            results.append((file_name, affinity, dissociation))

    # Process the results if any were found
    if results:
        # --- 1. Print the results in a table to the console ---
        print("\n--- PRODIGY Affinity Prediction Results ---")
        headers = ["Complex File Name", "Binding Affinity (kcal/mol)", "Dissociation Constant (M)"]
        print(f"{headers[0]:<30} | {headers[1]:<30} | {headers[2]:<30}")
        print("-" * 94)
        for row in results:
            print(f"{row[0]:<30} | {row[1]:<30} | {row[2]:<30}")

        # --- 2. Write all results to a CSV file ---
        try:
            with open(output_file, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(headers)
                writer.writerows(results)
            print(f"\nFull results successfully saved to {output_file}")
        except IOError as e:
            print(f"Error writing to file {output_file}: {e}")

        # --- 3. Find the best result and save it to a separate file ---
        try:
            # Find the row with the minimum binding affinity (most negative)
            best_result = min(results, key=lambda row: float(row[1]))
            with open(best_affinity_file, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(best_result)
            print(f"Best result successfully saved to {best_affinity_file}")

            # --- 4. Copy the PDB file with the highest affinity ---
            best_pdb_basename = best_result[0]
            # PRODIGY output doesn't include the .pdb extension, so we add it.
            source_pdb_path = os.path.join(input_directory, best_pdb_basename + ".pdb")
            
            if os.path.exists(source_pdb_path):
                shutil.copyfile(source_pdb_path, output_pdb_name)
                print(f"Copied PDB with highest affinity to {output_pdb_name}")
            else:
                print(f"Warning: Could not find PDB file for best result at '{source_pdb_path}'")

        except (IOError, ValueError) as e:
            print(f"Error processing or writing best result: {e}")

    else:
        print("Could not parse any complete results from the PRODIGY output.")
        # Optionally print the raw output for debugging
        print("\n--- Raw PRODIGY Output ---")
        print(prodigy_output)

def main():
    """
    Main function to run the PRODIGY affinity prediction.
    """
    parser = argparse.ArgumentParser(description="Run PRODIGY for affinity prediction.")
    parser.add_argument("--input_directory", required=True, help="Directory containing PDB files.")
    parser.add_argument("--chains", required=True, help="A space-separated string of chain IDs for selection (e.g., \"A B\").")
    parser.add_argument("--output_file", required=True, help="Path to the output CSV file for all results.")
    parser.add_argument("--best_affinity_file", required=True, help="Path to save the line with the best affinity.")
    parser.add_argument("--output_pdb_name", default="highest_affinity.pdb", help="Name for the PDB file with the highest affinity.")
    
    args = parser.parse_args()

    # 1. Define the input directory and selection from arguments
    input_directory = args.input_directory
    chains = args.chains.split()

    # 2. Run PRODIGY
    prodigy_output = run_prodigy(input_directory, selection_chains=chains)

    # 3. Process and store the output
    if prodigy_output:
        process_and_store_results(prodigy_output, args.input_directory, args.output_file, args.best_affinity_file, args.output_pdb_name)

# --- Main Execution Block ---
if __name__ == "__main__":
    main()

# python prodigy-affinity.py --input_directory docking_results --chains "A B" --output_file "prodigy_results.csv" --best_affinity_file "best_affinity_result.csv" --output_pdb_name "highest_affinity.pdb"