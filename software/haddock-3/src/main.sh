

# Input variables
outputPath = "./output"
antibodyPdb = "./output/abodyBuilder.pdb"


# *Important: For a docking run with HADDOCK, each molecule should consist of 
# a single chain with non-overlapping residue numbering within the same chain.
# As an antibody consists of two chains (L+H), we will have to prepare it 
# for use in HADDOCK. For this we will be making use of pdb-tools from the command line.
pdb_tidy ${antibodyPdb} | pdb_selchain -H | pdb_fixinsert | pdb_keepcoord | pdb_tidy -strict > ${outputPath}/H.pdb
pdb_tidy ${antibodyPdb} | pdb_selchain -L | pdb_fixinsert | pdb_keepcoord | pdb_tidy -strict > ${outputPath}/L.pdb

# HADDOCK3 docking
haddock3 -i ${outputPath}/H.pdb -o ${outputPath}/H.pdb.haddock3.out -d ${outputPath}/L.pdb -o ${outputPath}/L.pdb.haddock3.out

# Prodigy affinity prediction
prodigy -i ${outputPath}/H.pdb.haddock3.out -o ${outputPath}/H.pdb.haddock3.out.prodigy.out
prodigy -i ${outputPath}/L.pdb.haddock3.out -o ${outputPath}/L.pdb.haddock3.out.prodigy.out
