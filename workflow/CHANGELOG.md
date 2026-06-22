# @platforma-open/milaboratories.top-antibodies.workflow

## 4.2.1

### Patch Changes

- b466a9b: Fix Selection Plot funnel starting from fewer clonotypes than the project has. The clone table is now built with a Full join plus a dense per-clonotype presence column instead of an inner join, so clonotypes that lack sparse columns (e.g. an enrichment row) reach the funnel and are dropped at the filter stage that checks the missing column rather than before stage tracking — the funnel total now matches the full clonotype count. The optional primary dataset filter is applied as a row pre-condition in the sampler, and null-ranked or null-diversification clonotypes are dropped before selection so they are never sampled.
- Updated dependencies [b466a9b]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.1.5

## 4.2.0

### Minor Changes

- 8edddd1: Add dataset selector with optional filter dropdown. Replaces the plain dataset dropdown with `PlDatasetSelector`, and inner-joins the selected filter column into the clone table so it narrows every downstream stage (final clonotypes, spectratype, Kabat).

## 4.1.2

### Patch Changes

- 6920645: Keep only subtitle in trace

## 4.1.1

### Patch Changes

- c85f63a: SDK update
- Updated dependencies [c85f63a]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.5
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.4
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.1.4
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.5
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.5

## 4.1.0

### Minor Changes

- b812c7d: Track which filter step eliminated each clonotype (or marks it as a
  survivor) and visualize the attrition in a new Selection page. The
  sample-clonotypes script emits a selectionStage column per clone; the
  workflow exposes it as selectionStagePf, and the block UI renders it
  via GraphMaker's selection chart type.

## 4.0.3

### Patch Changes

- 4855fff: dont show column header linker postfix and update sdk
- Updated dependencies [4855fff]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.4
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.3
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.1.3
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.4
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.4

## 4.0.2

### Patch Changes

- 2a2533d: Fix minor issues
- 6042e4a: Minor fix
- 461999c: Fix minor issues

## 4.0.1

### Patch Changes

- dd754ae: Accept both pre- and post-peptide-adaptation spec names from upstream blocks so projects using either version remain functional:

  - Preset filter/ranking allowlists now include `pl7.app/enrichment*` (clonotype-enrichment) and `pl7.app/developability*` (antibody-sequence-liabilities) alongside the legacy `pl7.app/vdj/`-prefixed names.
  - Diversification dropdown, cluster-axis matching, hidden cluster-mapping column, and workflow-side linker matching now recognize both `pl7.app/clusterId` and `pl7.app/vdj/clusterId` axis names (clonotype-clustering rename).
  - Cluster-size query uses a namePattern matching both `pl7.app/clustering/clusterSize` and `pl7.app/vdj/clustering/clusterSize`.

## 4.0.0

### Major Changes

- 1c1c7c1: Support peptides

## 3.0.1

### Patch Changes

- 3e9c9ef: bump sdk for fix table query
- Updated dependencies [3e9c9ef]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.3
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.2
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.1.2
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.3
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.3

## 3.0.0

### Major Changes

- c2c2b06: VDJ Integration support, BlockV3 api migration

## 2.2.2

### Patch Changes

- 199e95d: Updated dependencies
- Updated dependencies [199e95d]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.2
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.1
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.1.1
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.2
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.2

## 2.2.1

### Patch Changes

- Updated dependencies [6ecafd5]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.1

## 2.2.0

### Minor Changes

- f54202c: Add isNA/isNotNA filter types for lead selection filters

  Columns with discrete allowed values (like Structural Liabilities with None/Low/Medium/High) previously only offered "Is one of" / "Is not one of" filter types, making it impossible to filter by empty/NA values. Now all column types (numeric, string, and discrete) include "Is empty (NA)" and "Is not empty (NA)" filter options.

### Patch Changes

- Updated dependencies [f54202c]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.1.0

## 2.1.0

### Minor Changes

- 84a7fe5: Deal with ANARCI numbering issues

### Patch Changes

- Updated dependencies [84a7fe5]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.0

## 2.0.1

### Patch Changes

- 140ce30: Support custom block label

## 2.0.0

### Major Changes

- 590699a: Introduce diverisified ranking, in-vivo score estimation and workflow presets

### Patch Changes

- Updated dependencies [590699a]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.0.0

## 1.17.6

### Patch Changes

- 65cbdd5: Minor fix to prevent leads spec multiple match

## 1.17.5

### Patch Changes

- ff606b5: Implement multi-selection filters
- Updated dependencies [ff606b5]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.9.3

## 1.17.4

### Patch Changes

- 605fdf0: Add domain to exported filter

## 1.17.3

### Patch Changes

- 535be8f: Exporte selected Leads

## 1.17.2

### Patch Changes

- Updated dependencies [5857c20]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.9.2
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.1

## 1.17.1

### Patch Changes

- 0b57c1b: Show only specific columns be default: Clone, Cluster Id, AA sequence and filter/rank columns
- Updated dependencies [0b57c1b]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.9.1

## 1.17.0

### Minor Changes

- b201aaf: Improve cluster ranking, improve performance

### Patch Changes

- Updated dependencies [b201aaf]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.3.0
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.0
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.9.0
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.0

## 1.16.0

### Minor Changes

- 4ecbe6b: Improve cluster-based ranking

### Patch Changes

- Updated dependencies [4ecbe6b]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.8.0

## 1.15.1

### Patch Changes

- 5619236: Fix missing input related error
- Updated dependencies [5619236]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.7.2

## 1.15.0

### Minor Changes

- 00143a9: multiple clustering blocks fix, columns names fix, dependencies updates

## 1.14.1

### Patch Changes

- b99b7ba: Revert optimization changes
- Updated dependencies [b99b7ba]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.7.1
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.2.1
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.2.1
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.7.1
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.1

## 1.14.0

### Minor Changes

- 532b9ed: Block performance optimization

### Patch Changes

- Updated dependencies [532b9ed]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.7.0
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.2.0
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.2.0
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.7.0
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.0

## 1.13.2

### Patch Changes

- e17b19a: Remove unused `saveStdoutContent` calls, update sdk

## 1.13.1

### Patch Changes

- 9245274: Fix filter issues related to data types
- Updated dependencies [9245274]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.6.1

## 1.13.0

### Minor Changes

- 3825a42: Fix errors related to numeric properties that apply only to a subset of clonotypes and to multiple clustering blocks upstream

### Patch Changes

- Updated dependencies [3825a42]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.6.0
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.6.0

## 1.12.0

### Minor Changes

- ccc8076: kabat numbering added

### Patch Changes

- Updated dependencies [ccc8076]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.5.0
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.1.0
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.1.0
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.5.0

## 1.11.3

### Patch Changes

- 44895be: Support parquet format

## 1.11.2

### Patch Changes

- 65e8749: Minor bugs correction and SDK update

## 1.11.1

### Patch Changes

- edbd894: technical release
- 6dc2d2b: technical release
- e581493: technical release
- 1c26f0d: technical release
- Updated dependencies [edbd894]
- Updated dependencies [6dc2d2b]
- Updated dependencies [e581493]
- Updated dependencies [1c26f0d]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.4.4
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.4.4
  - @platforma-open/milaboratories.top-antibodies.umap@1.1.4

## 1.11.0

### Minor Changes

- 67443d9: Move all calculations to prerun

## 1.10.5

### Patch Changes

- technical release
- Updated dependencies
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.4.3
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.4.3
  - @platforma-open/milaboratories.top-antibodies.umap@1.1.3

## 1.10.4

### Patch Changes

- Updated dependencies [020a5b4]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.4.2
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.4.2
  - @platforma-open/milaboratories.top-antibodies.umap@1.1.2

## 1.10.3

### Patch Changes

- 2e6e7c9: Label update and minor fix

## 1.10.2

### Patch Changes

- 22b01ef: Updated SDK to support polars.
- Updated dependencies [22b01ef]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.4.1
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.4.1
  - @platforma-open/milaboratories.top-antibodies.umap@1.1.1

## 1.10.1

### Patch Changes

- Updated dependencies [c4927c6]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.4.0
  - @platforma-open/milaboratories.top-antibodies.umap@1.1.0

## 1.10.0

### Minor Changes

- c282203: Improved block performance. Fixed increasing ranking order and cluster size ranking

### Patch Changes

- Updated dependencies [c282203]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.3.0

## 1.9.0

### Minor Changes

- b499ab2: Add rank column

### Patch Changes

- Updated dependencies [b499ab2]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.2.0

## 1.8.2

### Patch Changes

- f25cad6: Fix slices typo in main workflow

## 1.8.1

### Patch Changes

- 7397001: Remove typo

## 1.8.0

### Minor Changes

- a435169: Move filters to settings and add prerun

### Patch Changes

- Updated dependencies [a435169]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.1.0
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.4.0

## 1.7.0

### Minor Changes

- 4b1a662: Support batch system and small fix

## 1.6.0

### Minor Changes

- d32234f: Support batch system

## 1.5.0

### Minor Changes

- bf454d4: Default ranking column in case user does not select one
- 4990fd8: Fix empty top and ranking cases

## 1.4.0

### Minor Changes

- b603873: chore: update deps

### Patch Changes

- Updated dependencies [b603873]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.0.3
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.3.2
  - @platforma-open/milaboratories.top-antibodies.umap@1.0.3

## 1.3.1

### Patch Changes

- Updated dependencies [b280c5c]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@1.0.2
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.3.1
  - @platforma-open/milaboratories.top-antibodies.umap@1.0.2

## 1.3.0

### Minor Changes

- 2e24f7a: Disable default normalization in VJ usage plot and change spectratype/VJ usage script to run on top clonotypes if provided

### Patch Changes

- Updated dependencies [2e24f7a]
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.3.0

## 1.2.1

### Patch Changes

- Updated dependencies [6443da1]
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.2.0

## 1.2.0

### Minor Changes

- 5ee90ac: Add CDR3 spectratype

### Patch Changes

- Updated dependencies [5ee90ac]
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.1.0

## 1.1.1

### Patch Changes

- 339a780: Main backbone
- Updated dependencies [339a780]
  - @platforma-open/milaboratories.top-antibodies.software@1.0.1

## 1.1.0

### Minor Changes

- 208de2a: First version
