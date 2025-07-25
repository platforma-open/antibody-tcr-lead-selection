import os
import zipfile
import re
import gzip
import shutil
import argparse
from biobb_pdb_tools.pdb_tools.biobb_pdb_tidy import biobb_pdb_tidy
from biobb_pdb_tools.pdb_tools.biobb_pdb_selchain import biobb_pdb_selchain
from biobb_pdb_tools.pdb_tools.biobb_pdb_fixinsert import biobb_pdb_fixinsert
from biobb_pdb_tools.pdb_tools.biobb_pdb_keepcoord import biobb_pdb_keepcoord
from biobb_pdb_tools.pdb_tools.biobb_pdb_merge import biobb_pdb_merge
from biobb_pdb_tools.pdb_tools.biobb_pdb_reres import biobb_pdb_reres
from biobb_pdb_tools.pdb_tools.biobb_pdb_chain import biobb_pdb_chain
from biobb_pdb_tools.pdb_tools.biobb_pdb_chainxseg import biobb_pdb_chainxseg
from biobb_haddock.haddock_restraints.haddock3_restrain_bodies import haddock3_restrain_bodies
from biobb_haddock.haddock.haddock3_run import haddock3_run

# Command line commands used in this script
# pdb_tidy abodyBuilder.pdb | pdb_selchain -H | pdb_fixinsert | pdb_keepcoord | pdb_tidy -strict > H.pdb
# pdb_tidy abodyBuilder.pdb | pdb_selchain -L | pdb_fixinsert | pdb_keepcoord | pdb_tidy -strict > L.pdb

# # combined the heavy and light chain into one, renumbering the residues starting at 1 to avoid overlap 
# # in residue numbering between the chains and assigning a unique chainID/segID
# pdb_merge H.pdb L.pdb | pdb_reres -1 | pdb_chain -A | pdb_chainxseg | pdb_tidy -strict > HL_clean.pdb

# # Same for antigen
# pdb_tidy -strict esmfold_antibody.pdb | pdb_keepcoord | pdb_chain -B | pdb_chainxseg | pdb_tidy -strict > B_clean.pdb

# # define a few distance restraints to keep the two antibody chains together during the high temperature flexible refinement stage
# haddock3-restraints restrain_bodies HL_clean.pdb > antibody-unambig.tbl

# # Run hadock with run file (example below)
# haddock3 run.toml

def process_pdb_chain_biobb(input_file: str, output_file: str, chain_id: str):
    """
    Processes a PDB file for a specific chain using a pipeline of biobb_pdb_tools.

    Args:
        input_file: The path to the source PDB file.
        output_file: The path to write the final PDB output.
        chain_id: The chain to select (e.g., 'H' or 'L').
    """
    print(f"Processing chain {chain_id} from {input_file} using BioBBs...")

    # Define paths for the intermediate files
    # Each step will write to a new file
    temp_path_1 = f"tmp_1_tidy_{chain_id}.pdb"
    temp_path_2 = f"tmp_2_selchain_{chain_id}.pdb"
    temp_path_3 = f"tmp_3_fixinsert_{chain_id}.pdb"
    temp_path_4 = f"tmp_4_keepcoord_{chain_id}.pdb"
    
    intermediate_files = [temp_path_1, temp_path_2, temp_path_3, temp_path_4]

    try:            
        # Step 1: pdb_tidy (initial tidy)
        # Input: original file, Output: temp_path_1
        biobb_pdb_tidy(input_file_path=input_file, 
                 output_file_path=temp_path_1)

        # Step 2: pdb_selchain
        # Input: temp_path_1, Output: temp_path_2
        # The chain is passed via the 'properties' dictionary
        prop_selchain = {'chains': f"{chain_id}"}
        biobb_pdb_selchain(input_file_path=temp_path_1, 
                        output_file_path=temp_path_2, 
                        properties=prop_selchain)

        # Step 3: pdb_fixinsert
        # Input: temp_path_2, Output: temp_path_3
        biobb_pdb_fixinsert(input_file_path=temp_path_2, 
                      output_file_path=temp_path_3)

        # Step 4: pdb_keepcoord
        # Input: temp_path_3, Output: temp_path_4
        biobb_pdb_keepcoord(input_file_path=temp_path_3, 
                      output_file_path=temp_path_4)

        # Step 5: pdb_tidy -strict (final tidy)
        # Input: temp_path_4, Output: final output file
        # The '-strict' flag is passed via the 'properties' dictionary
        prop_tidy_strict = {'strict': True}
        biobb_pdb_tidy(input_file_path=temp_path_4, 
                 output_file_path=output_file, 
                 properties=prop_tidy_strict)

        print(f"Successfully created {output_file}")

    except Exception as e:
        print(f"An error occurred: {e}")
    
    finally:
        # Step 6: Clean up all the intermediate files
        print("Cleaning up intermediate files...")
        for file_path in intermediate_files:
            if os.path.exists(file_path):
                os.remove(file_path)


def merge_and_clean_chains_biobb(input_h_pdb: str, input_l_pdb: str, output_file: str):
    """
    Merges H and L chain PDBs and runs a cleaning pipeline using biobb_pdb_tools.

    Args:
        input_h_pdb: Path to the Heavy chain PDB file.
        input_l_pdb: Path to the Light chain PDB file.
        output_file: Path for the final, cleaned PDB file.
    """
    print("Starting merge and clean pipeline using BioBBs...")

    # Define paths for the intermediate files
    temp_zip_path = "tmp_0_inputs.zip"
    temp_path_1 = "tmp_1_merged.pdb"
    temp_path_2 = "tmp_2_reres.pdb"
    temp_path_3 = "tmp_3_chain.pdb"
    temp_path_4 = "tmp_4_chainxseg.pdb"

    intermediate_files = [temp_zip_path, temp_path_1, temp_path_2, temp_path_3, temp_path_4]

    try:
        print(f"Creating ZIP archive for merging: {temp_zip_path}")
        with zipfile.ZipFile(temp_zip_path, 'w') as zipf:
            zipf.write(input_h_pdb, os.path.basename(input_h_pdb))
            zipf.write(input_l_pdb, os.path.basename(input_l_pdb))

        # Step 1: pdb_merge
        # Input: H.pdb and L.pdb, Output: temp_path_1
        biobb_pdb_merge(input_file_path=temp_zip_path,
                        output_file_path=temp_path_1)

        # Step 2: pdb_reres -1
        # Input: temp_path_1, Output: temp_path_2
        # The renumbering start is passed via 'properties'
        prop_reres = {'residue_number': -1}
        biobb_pdb_reres(input_file_path=temp_path_1,
                        output_file_path=temp_path_2,
                        properties=prop_reres)

        # Step 3: pdb_chain -A
        # Input: temp_path_2, Output: temp_path_3
        # The new chain ID is passed via 'properties'
        prop_chain = {'chain': 'A'}
        biobb_pdb_chain(input_file_path=temp_path_2,
                        output_file_path=temp_path_3,
                        properties=prop_chain)

        # Step 4: pdb_chainxseg
        # Input: temp_path_3, Output: temp_path_4
        biobb_pdb_chainxseg(input_file_path=temp_path_3,
                            output_file_path=temp_path_4)

        # Step 5: pdb_tidy -strict
        # Input: temp_path_4, Output: final output file
        prop_tidy_strict = {'strict': True}
        biobb_pdb_tidy(input_file_path=temp_path_4,
                       output_file_path=output_file,
                       properties=prop_tidy_strict)

        print(f"Successfully created {output_file}")

    except Exception as e:
        print(f"An error occurred: {e}")

    finally:
        # Step 6: Clean up all the intermediate files
        print("Cleaning up intermediate files...")
        for file_path in intermediate_files:
            if os.path.exists(file_path):
                os.remove(file_path)




# Function to generate the run.toml file
def generate_toml_file(config_file: str, finalAntibodyPDB: str, 
                       cleanAntigenPDB: str, unambigAntibody: str, 
                       nCPU: int, sampling: int, haddockSeleTop: int, 
                       haddockFinalTop: int, heavyCdrs: list[tuple[int, int]], 
                       lightCdrs: list[tuple[int, int]]):


    heavyCdrString = "".join([f"rair_sta_1_{i} = {cdr[0]}\nrair_end_1_{i} = {cdr[1]}\n" 
                              for i, cdr in enumerate(heavyCdrs, start=1)])
    startPos = len(heavyCdrs) + 1
    lightCdrString = "".join([f"rair_sta_1_{i} = {cdr[0]}\nrair_end_1_{i} = {cdr[1]}\n" 
                              for i, cdr in enumerate(lightCdrs, start=startPos)])

    toml_ref = f"""
# ====================================================================
# Protein-protein docking example with NMR-derived ambiguous interaction restraints

# directory in which the scoring will be done
run_dir = "docking_output"

# execution mode
mode = "local"
ncores = {nCPU}
debug = true

# molecules to be docked
molecules =  [
    "{finalAntibodyPDB}",
    "{cleanAntigenPDB}",
    ]

# ====================================================================
# Parameters for each stage are defined below, prefer full paths
# ====================================================================
[topoaa]

[rigidbody]
tolerance = 5
# turn on random definiton of AIRs
ranair = true
# for antibody sample only CDR loops
# Heavy Chain CDRs
{heavyCdrString}
# Light Chain CDRs (renumbered with an offset to add H chain length)
{lightCdrString}
# High sampling (default of 1000)
# For making best use of the available CPU resources it is recommended to adapt
# the sampling parameter to be a multiple of the number of available cores 
# when running in local mode
sampling = {sampling}

[seletop]
select = {haddockSeleTop}

[flexref]
tolerance = 5
contactairs = true
# Restraints to keep the antibody chains together
unambig_fname = "{unambigAntibody}"

[emref]
tolerance = 5
# Restraints to keep the antibody chains together
unambig_fname = "{unambigAntibody}"

[clustfcc]

[seletopclusts]
top_models = {haddockFinalTop}

# ====================================================================
"""

    # Store file
    with open(config_file, 'w') as f:
        f.write(toml_ref)

def parse_annotation(annotation_string: str, offset: int = 0) -> list[tuple[int, int]]:
    """
    Parses an annotation string into a list of start and end coordinates.
    The annotation string is a series of pipe-separated segments.
    Each segment is in the format 'id:start+length'.
    'start' and 'length' are base36 encoded.
    An optional offset can be added to the coordinates.
    """
    cdrs = []
    # Regex inspired by the TypeScript version.
    # It captures id, start, and optional length.
    # Python's 're' module uses `(?P<name>...)` for named capture groups.
    regex = r"(?P<id>[^:]*):(?P<start>[0-9A-Za-z]*)(?:\+(?P<length>[0-9A-Za-z]*))?"
    
    for match in re.finditer(regex, annotation_string):
        match_dict = match.groupdict()
        start_b36 = match_dict.get('start')
        length_b36 = match_dict.get('length')

        start = int(start_b36, 36) if start_b36 else 0
        length = int(length_b36, 36) if length_b36 else 0
        
        # The output format is (start, end), where end is start + length.
        cdrs.append((start + offset, start + length + offset))
        
    return cdrs


def extract_final_pdbs(zip_path: str, output_dir: str = "."):
    """
    Extracts and unzips .pdb.gz files from the haddock output zip archive.
    Specifically looks in directories like '.../6_seletopclusts/'.
    The files are extracted to the root of the output_dir, flattening the hierarchy.
    """
    print(f"\nExtracting final PDB files from {zip_path}...")
    
    # Haddock modules are numbered. 'seletopclusts' is typically step 6 or 7.
    # We look for this folder name in the path.
    target_folder_segment = '6_seletopclusts/'
    
    extracted_gz_files = []

    try:
        os.makedirs(output_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Find all relevant files first
            members_to_extract = [
                m for m in zip_ref.namelist() 
                if target_folder_segment in m and m.endswith('.pdb.gz')
            ]

            if not members_to_extract:
                print(f"Warning: No '.pdb.gz' files found in a '{target_folder_segment}' directory inside {zip_path}.")
                print("The Haddock step number might be different. Please check the zip file contents.")
                return

            # Extract them to a flat directory structure
            for member in members_to_extract:
                # Extract filename from the path inside the zip
                filename = os.path.basename(member)
                target_path = os.path.join(output_dir, filename)

                # Read the file data from the zip and write to the target path
                with zip_ref.open(member) as source_file, open(target_path, 'wb') as target_file:
                    shutil.copyfileobj(source_file, target_file)
                
                extracted_gz_files.append(target_path)
                print(f"  - Extracted {member} to {target_path}")

        # Unzip them
        print("\nUnzipping extracted files...")
        for gz_path in extracted_gz_files:
            pdb_path = gz_path[:-3]  # Remove '.gz'
            try:
                with gzip.open(gz_path, 'rb') as f_in:
                    with open(pdb_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                
                os.remove(gz_path)
                print(f"  -> Created {pdb_path}")
            except Exception as e:
                print(f"Error unzipping {gz_path}: {e}")

    except FileNotFoundError:
        print(f"Error: The file {zip_path} was not found.")
    except Exception as e:
        print(f"An error occurred during extraction: {e}")


def main(args):
    """
    Main function to run the Haddock docking pipeline.
    """
    # --- Execute the commands ---
    
    # Unpack arguments
    input_pdb_file = args.input_pdb_file
    cleanAntigenPDB = args.input_antigen_pdb_file
    nCPU = args.n_cpu
    offset = args.offset
    annotationHeavy = args.annotation_heavy
    annotationLight = args.annotation_light
    sampling = args.sampling
    haddockSeleTop = args.haddock_sele_top
    haddockFinalTop = args.haddock_top_clusters
    output_dir = args.output_dir

    # Output file names #
    finalAntibodyPDB = 'HL_clean.pdb'
    cleanAntigenPDB = 'B_clean.pdb'
    # file with distance restraints to keep the two antibody chains together during 
    # the high temperature flexible refinement stage
    unambigAntibody = 'antibody-unambig.tbl'
    config_file = "./run.toml"

    # Docking preparation #
    print("--- Preparing structures for docking ---")
    # Process the Heavy chain ('H')
    process_pdb_chain_biobb(input_pdb_file, 'H.pdb', 'H')
    # Process the Light chain ('L')
    process_pdb_chain_biobb(input_pdb_file, 'L.pdb', 'L')

    # Merge and clean the chains
    merge_and_clean_chains_biobb('H.pdb', 'L.pdb', finalAntibodyPDB)

    # Generate distance restraints to keep bodies together
    haddock3_restrain_bodies(input_structure_path=finalAntibodyPDB,
                            output_tbl_path=unambigAntibody)

    # Extract the CDR coordinates using the annotation 
    heavyCdrs = parse_annotation(annotationHeavy)
    lightCdrs = parse_annotation(annotationLight, offset)

    # Prepare the run file
    generate_toml_file(config_file, finalAntibodyPDB, cleanAntigenPDB, 
                       unambigAntibody, nCPU, sampling, haddockSeleTop, 
                       haddockFinalTop, heavyCdrs, lightCdrs)

    # Docking #
    print("\n--- Starting Haddock docking run ---")
    # Call the haddock3_run function directly
    haddock_output_zip_path = os.path.join('./', 'haddock_output.zip')
    haddock3_run(
        mol1_input_pdb_path=finalAntibodyPDB,
        mol2_input_pdb_path=cleanAntigenPDB,
        unambig_restraints_table_path=unambigAntibody,
        output_haddock_wf_data_zip=haddock_output_zip_path,
        haddock_config_path=config_file
    )

    # Get final pdb files #
    extract_final_pdbs(haddock_output_zip_path, output_dir)
    print("\n--- Pipeline finished successfully ---")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Haddock docking pipeline script.")
    
    # Required arguments
    parser.add_argument("--input-pdb-file", required=True, help="Path to the antibody PDB file.")
    parser.add_argument("--input-antigen-pdb-file", required=True, help="Path to the antigen PDB file.")
    parser.add_argument("--annotation-heavy", required=True, help="Annotation string for the heavy chain (e.g., '1:P+8|2:1E+8|3:2N+L').")
    parser.add_argument("--annotation-light", required=True, help="Annotation string for the light chain (e.g., '1:P+8|2:1E+3|3:2G+C').")
    parser.add_argument("--offset", type=int, required=True, help="Residue offset for the light chain.")
    
    # Optional arguments with defaults
    parser.add_argument("--n-cpu", type=int, default=8, help="Number of CPUs to use. (default: 8)")
    parser.add_argument("--sampling", type=int, default=1000, help="Haddock rigidbody sampling parameter. (default: 1000)")
    parser.add_argument("--haddock-sele-top", type=int, default=200, help="Haddock seletop parameter. (default: 200)")
    parser.add_argument("--haddock-top-clusters", type=int, default=10, help="Haddock seletopclusts parameter. (default: 10)")
    parser.add_argument("--output-dir", default='./dockedModels', help="Output directory for the final PDB models. (default: ./dockedModels)")
    
    # input_pdb_file = '/home/jmendieta/temporal/affinityPipelineHaddock/output/abodyBuilder.pdb'
    # input_antigen_pdb_file = '/home/jmendieta/temporal/affinityPipelineHaddock/output/esmfold_antibody.pdb'
    # nCPU = 8
    # # obtained in workflow
    # offset = 127
    # annotationHeavy = "1:P+8|2:1E+8|3:2N+L"
    # annotationLight = "1:P+8|2:1E+3|3:2G+C"

    # sampling = 1000
    # haddockSeleTop = 200
    # haddockFinalTop = 10
    # output_dir = './dockedModels'

    # python /Users/julen/Downloads/haddock.py \
    # --input_pdb_file "/home/jmendieta/temporal/affinityPipelineHaddock/output/abodyBuilder.pdb" \
    # --input_antigen_pdb_file "/home/jmendieta/temporal/affinityPipelineHaddock/output/esmfold_antibody.pdb" \
    # --annotation_heavy "1:P+8|2:1E+8|3:2N+L" \
    # --annotation_light "1:P+8|2:1E+3|3:2G+C" \
    # --offset 127 \
    # --n_cpu 8 \
    # --sampling 5 \
    # --output_dir "./docking_results"
    # --haddock_sele_top 2 \
    # --haddock_top_clusters 1 \
    # --output_dir "./docking_results"

    args = parser.parse_args()
    main(args)


