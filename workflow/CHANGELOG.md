# @platforma-open/milaboratories.top-antibodies.workflow

## 5.1.2

### Patch Changes

- 5a96d54: MILAB-6832: fix the UMAP graph, and update graph-maker, MSA and ANARCI

  `umapPf` handed result-pool columns to `createPFrameForGraphs` as block columns.
  `getRelatedColumns` registers the result pool as a provider alongside those
  columns, and both sides mint the same global id, so any UMAP column reachable
  from the pool aborted the whole pFrame with "Duplicate column id ... in provider
  ResultPool". Where the projection did not integrate with the input anchor there
  was no crash and no plot either — the output silently returned nothing.

  The pFrame is now built from anchored discovery over the UMAP column specs,
  unioned per column, plus the columns themselves. Anchors are specs rather than
  ids, so the pool's own copy can no longer collide, and the pFrame holds what
  joins the columns the graph puts on X and Y. `umapPcols` moves from anchored
  discovery to a plain filter, so the column list and the pFrame cover the same
  set: anchored discovery required the UMAP axis to carry the input anchor axis'
  full identity, and a projection keyed on a domain-subset of it was dropped.

  The UMAP, spectratype and selection-stage pages set `noBodyGutters` on
  `PlBlockPage`, so each plot fills its page.

  graph-maker 1.4.8 -> 1.7.2, multi-sequence-alignment 1.47.18 -> 1.47.24 and
  software-anarci ^0.0.3 -> ^1.0.1. software-anarci 1.0.1 records
  `docker.entrypoint` in its descriptor, which a Kubernetes pod spec needs — the
  pod overrides the image ENTRYPOINT, so without it the conda environment was
  never activated on server deployments.

  The ANARCI step's output placeholders are marked `writable`. It pre-creates
  `anarci.csv_H.csv` / `anarci.csv_KL.csv` so `saveFile` always finds them, then
  ANARCI writes to those same names; staged files are read-only by default, so on
  server deployments ANARCI died with
  `[Errno 13] Permission denied: 'anarci.csv_H.csv'`.

## 5.1.1

### Patch Changes

- ed82ed4: Update `@platforma-sdk` to 1.81.x and migrate the block model to the new column-access mechanism.

  The removed `ColumnCollectionBuilder` / `ColumnMatch` / `ArrayColumnProvider` APIs are replaced by the host-driven `ColumnsCollection` + `ColumnRecipe` API: column discovery and filtering run host-side via `discover`/`filter` selectors, and specs are fetched on demand through `getSpec()` instead of being pulled eagerly into the sandbox. The main table's `createPlDataTableV3` display rules move from `(spec) => boolean` lambdas to host-side `ColumnSelector`s. No user-facing behavior change intended.

  Follow-ups for 1.81: the renamed predicates (`isColumnLazy` → `isDataColumn`), the `LinkerParts` shape now passed to the `linker` label formatter, and `umapPf` / `umapPcols` moving off the deprecated `ctx.resultPool.getAnchoredPColumns` + `TreeNodeAccessor.getPColumns()` onto anchored `ColumnsCollection` discovery. Every `PlRef` → spec read goes through `getSpecByRef`, which absorbs the `ColumnAbsentError` that `Column(ref)` throws where `ctx.resultPool.getPColumnSpecByRef` used to return `undefined`.

  The filter/ranking wire format stays a leaf `PObjectId`: `matchToColumnId` reduces the discovered recipe id via `extractPObjectId`, and `dedupByLeafId` collapses reachability variants to one entry per column the way the old `findColumns` did. `bundleBuilder.addSingle` resolves a global `PObjectId` by ref and has no branch for the `ColumnDiscoveredId` a linker-reached hit carries, so persisted selections and the workflow keep working unchanged. Putting the full `ColumnUniversalId` on the wire needs an `__isDiscovered` branch in `addSingle` and in `processColumnId` first.

  Drop the dead `anchorName` field from `ScopedColumnId`, along with the unused `ScopedColumn` / `Column` types. `anchorName` was always the literal `"main"` and only mattered while the wire value was an anchored query id; nothing on the workflow side reads it, and the two UI lookups that filtered on it were selecting the first option in a list where every entry carried the same value. **This changes the shape of `BlockArgs`, so existing projects re-run the workflow once.** Stored `BlockData` keeps the field as an inert leftover — no migration needed.

  `getSpecByRef` guards on the column's resolution status instead of catching `ColumnAbsentError`, keeping exceptions out of the control flow. A missing column stays silently ignored, as before: the block works with whatever the upstream graph provides, and the `absent` status occurs in normal configurations.

## 5.1.0

### Minor Changes

- ffff756: Require evidence that a clonotype was present in the target before ranking or filtering by cluster-level enrichment

  A cluster-level enrichment score describes the cluster, not its individual members, so a
  clonotype never observed in a target's selection rounds could still be selected as a lead.
  Selection now requires that clonotype's own Max Frequency in that target to be above zero,
  checked independently for each target.

  The Selection Plot shows this as a first funnel stage, "Observed in rounds". Existing
  projects will select fewer leads after re-running.

### Patch Changes

- Updated dependencies [ffff756]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@3.1.0

## 5.0.1

### Patch Changes

- 13cd3b1: Fix diversification by cluster columns from 3d-structure-clustering

  Diversification silently did nothing when the selected cluster column came from a
  clustering block whose `clusterSize` column was not fetched into the bundle (e.g.
  3d-structure-clustering, which emits `pl7.app/structure/clustering/clusterSize`).
  `resolveClusterColumnHeader` returned a `clusterAxis_<idx>_0` header that only the
  cluster-size loop ever creates, so the sampler logged "Diversification column not
  found" and skipped diversification entirely. It now returns the linker's own
  `cluster_<idx>` header, which exists whenever the linker is in the clone table.

  Clonotypes with no cluster assigned are now excluded from selection again. They
  arrive in the clone table as empty strings — `parquetFileBuilder` writes missing
  values as `""` — so the existing `drop_nulls` guard never saw them and they leaked
  into the leads table after the clone table moved from an Inner to a Full join.

  Also widened the `clusterSizes` bundle query to match
  `pl7.app/structure/clustering/clusterSize`, making 3D cluster sizes available, and
  stopped the cluster-size loop from renaming an axis the linker loop already
  headered.

- Updated dependencies [13cd3b1]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@3.0.1

## 5.0.0

### Major Changes

- 583b0ec: Remove old in vivo score and enable default ranking by repertoire score in "in Vivo" preset

### Patch Changes

- Updated dependencies [583b0ec]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@3.0.0

## 4.3.5

### Patch Changes

- 7af3f2d: Fix selectionStage PColumn build failure caused by empty clonotypeKey rows. The upstream Full join can emit secondary-axis (cluster/linker) rows not tied to any clonotype; their empty clonotypeKey collided on the single-axis selectionStage frame. filter.py now drops null/empty clonotypeKey rows from the selection-stage output.
- Updated dependencies [7af3f2d]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.2.5

## 4.3.4

### Patch Changes

- c8adf0f: Rebuild software with block-tools 2.12.7 so docker images publish to the trusted `containers.pl-open.science` registry instead of the untrusted `quay.io` (backend rejects quay images).
- Updated dependencies [c8adf0f]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.9
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.8
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.2.4
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.9
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.9

## 4.3.3

### Patch Changes

- c765278: Release software
- Updated dependencies [c765278]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.8
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.7
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.2.3
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.8
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.8

## 4.3.2

### Patch Changes

- 03894ab: Keep filter and ranking options available while an upstream block is recalculating.

  Previously the filter/ranking config outputs were `retentive`, so a freshly-configured Lead Selection block showed no filter options (an empty, spinning "Filter by" dropdown) for the entire time any upstream block was running. The config outputs now recompute from the currently-available columns instead, so the options stay populated. Selecting a column whose producer is still recalculating is safe — running the block waits for that upstream to finish before executing.

  Also migrates the block onto the canonical structurer layout and upgrades the SDK toolchain (block-tools, tengo-builder).

- Updated dependencies [03894ab]
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.7
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.7
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.2.2
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.6
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.7

## 4.3.1

### Patch Changes

- a7b65c0: No Op Change To Unblock
- Updated dependencies [a7b65c0]
  - @platforma-open/milaboratories.top-antibodies.anarci-kabat@1.4.6
  - @platforma-open/milaboratories.top-antibodies.assembling-fasta@1.3.5
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.2.1
  - @platforma-open/milaboratories.top-antibodies.spectratype@1.8.6
  - @platforma-open/milaboratories.top-antibodies.umap@1.2.6

## 4.3.0

### Minor Changes

- 0a06331: New changeset

### Patch Changes

- Updated dependencies [0a06331]
  - @platforma-open/milaboratories.top-antibodies.sample-clonotypes@2.2.0

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
