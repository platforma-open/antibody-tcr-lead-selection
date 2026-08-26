# @platforma-open/milaboratories.top-antibodies.model

## 5.1.4

### Patch Changes

- 05343d4: Report a bare antibody set as antibody, not peptide

  Three producers key on `pl7.app/variantKey` and only the run-id in the axis domain separates
  them. A bare antibody set from import-vdj-data was reported as the peptide modality: its
  sequence-space section read "Peptide Space" and the preset picker offered only the peptide
  preset.

  Provenance and "supports the gene-based analyses" were the same test, and they are not the same
  question. They are now separate. An imported antibody set is a receptor dataset like any other —
  so it gets "Clonotype Space" and the full preset list — but it still does not get CDR3 V
  Spectratype or V/J Gene Usage, because nothing aligned its sequences to a reference and there are
  no V/J calls to plot. Same outcome as before for those two sections, now for the accurate reason.

  The discriminator is the run-id key in the record axis's domain rather than the axis name, which
  is what makes it survive the migration that moves every producer onto `pl7.app/variantKey`. How a
  receptor dataset was produced is deliberately not modelled: assembled from reads or uploaded as
  sequences, it is the same thing to this block.

  Peptide and amplicon inputs are unaffected.

## 5.1.3

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

## 5.1.2

### Patch Changes

- 931d9b9: Presence-only columns admit presence predicates only, and are no longer offered for ranking

## 5.1.1

### Patch Changes

- 846f9eb: Hide unneeded columns from main table

## 5.1.0

### Minor Changes

- 516b70b: Add the mandatory block kind and upgrade the SDK

  The block now declares a `kind/` package carrying its identity and its
  init-params contract — the fields a project template supplies to seed a new
  instance. The model consumes them in `init` and projects the same set back out
  via `templateParams`, so export and apply are inverses. The contract covers the
  input dataset selection, the workflow preset, the number of top clonotypes, the
  Kabat numbering toggle, the ranking and filter lists, the diversification
  column, the defaults-init slots and the block labels.

  The ranking and filter lists and the diversification column carry column
  identifiers naming a block of the project they were exported from, and `relocateBlockIds` points every one of them at the blocks of
  the project being built before the kind's parser or `init` see them — it walks
  plain strings as well as ref-shaped objects, so both halves of a
  `ScopedColumnId` arrive rewritten and canonical. `ScopedColumnId`, `RankingOrder`,
  `Filter` and the filter predicate union now live in the kind and are re-exported
  from the model, since the model depends on the kind and not the reverse.

  The two `…InitializedForAnchor` fields travel too, reshaped by a
  `Ver_2026_08_20` migration from one `JSON.stringify(anchor) + "::" + preset`
  string into `{ anchor: GlobalPObjectId, preset }`. That is what makes them work
  across projects: a canonically serialized `PlRef` parses as a column identifier
  and so gets relocated, while the preset beside it is left alone — the old joined
  form was unparseable and stranded naming the project it came from. The migration
  re-mints the anchor through `createGlobalPObjectId` rather than carrying the old
  bytes over, and the UI computes the key it compares against through the same
  helper: relocation re-canonicalizes the stored value, so a side still using
  `JSON.stringify` would stop matching for any ref whose keys are not already in
  alphabetical order. It stays one slot rather than one
  entry per preset, because there is one ranking list and one filter list: a
  stored preset differing from the current one is the signal that the lists belong
  to the other preset and must be replaced. With the anchor relocated, an applied
  block recognizes the carried lists as already applied and keeps them, instead of
  replacing them with the landing dataset's defaults.

  Left out: the table grid state, the four graph states and the alignment model,
  which are view state; and `inVivoScoreRemovedNotice`, which a migration sets for
  a project that lost the built-in in-vivo score.

  The facade now publishes with `--unstable`.

### Patch Changes

- ed82ed4: Update `@platforma-sdk` to 1.81.x and migrate the block model to the new column-access mechanism.

  The removed `ColumnCollectionBuilder` / `ColumnMatch` / `ArrayColumnProvider` APIs are replaced by the host-driven `ColumnsCollection` + `ColumnRecipe` API: column discovery and filtering run host-side via `discover`/`filter` selectors, and specs are fetched on demand through `getSpec()` instead of being pulled eagerly into the sandbox. The main table's `createPlDataTableV3` display rules move from `(spec) => boolean` lambdas to host-side `ColumnSelector`s. No user-facing behavior change intended.

  Follow-ups for 1.81: the renamed predicates (`isColumnLazy` → `isDataColumn`), the `LinkerParts` shape now passed to the `linker` label formatter, and `umapPf` / `umapPcols` moving off the deprecated `ctx.resultPool.getAnchoredPColumns` + `TreeNodeAccessor.getPColumns()` onto anchored `ColumnsCollection` discovery. Every `PlRef` → spec read goes through `getSpecByRef`, which absorbs the `ColumnAbsentError` that `Column(ref)` throws where `ctx.resultPool.getPColumnSpecByRef` used to return `undefined`.

  The filter/ranking wire format stays a leaf `PObjectId`: `matchToColumnId` reduces the discovered recipe id via `extractPObjectId`, and `dedupByLeafId` collapses reachability variants to one entry per column the way the old `findColumns` did. `bundleBuilder.addSingle` resolves a global `PObjectId` by ref and has no branch for the `ColumnDiscoveredId` a linker-reached hit carries, so persisted selections and the workflow keep working unchanged. Putting the full `ColumnUniversalId` on the wire needs an `__isDiscovered` branch in `addSingle` and in `processColumnId` first.

  Drop the dead `anchorName` field from `ScopedColumnId`, along with the unused `ScopedColumn` / `Column` types. `anchorName` was always the literal `"main"` and only mattered while the wire value was an anchored query id; nothing on the workflow side reads it, and the two UI lookups that filtered on it were selecting the first option in a list where every entry carried the same value. **This changes the shape of `BlockArgs`, so existing projects re-run the workflow once.** Stored `BlockData` keeps the field as an inert leftover — no migration needed.

  `getSpecByRef` guards on the column's resolution status instead of catching `ColumnAbsentError`, keeping exceptions out of the control flow. A missing column stays silently ignored, as before: the block works with whatever the upstream graph provides, and the `absent` status occurs in normal configurations.

- Updated dependencies [516b70b]
  - @platforma-open/milaboratories.top-antibodies.kind@1.1.0

## 5.0.1

### Patch Changes

- ac31c31: Migrate projects that ranked by the removed built-in In Vivo Score: the stale ranking column is dropped and a one-time notice points to the Repertoire Score block, which now produces the score

## 5.0.0

### Major Changes

- 583b0ec: Remove old in vivo score and enable default ranking by repertoire score in "in Vivo" preset

## 4.3.4

### Patch Changes

- 03894ab: Keep filter and ranking options available while an upstream block is recalculating.

  Previously the filter/ranking config outputs were `retentive`, so a freshly-configured Lead Selection block showed no filter options (an empty, spinning "Filter by" dropdown) for the entire time any upstream block was running. The config outputs now recompute from the currently-available columns instead, so the options stay populated. Selecting a column whose producer is still recalculating is safe — running the block waits for that upstream to finish before executing.

  Also migrates the block onto the canonical structurer layout and upgrades the SDK toolchain (block-tools, tengo-builder).

## 4.3.3

### Patch Changes

- f756694: Polish for `synthetic-repertoire-profiler` (amplicon) variant datasets. The block already handled amplicon functionally (variantKey routes down the non-VDJ path); these are labeling/scoping fixes only:

  - The sequence-space section is labeled "Variant Space" for amplicon input (axis domain `pl7.app/repertoire/extractionRunId`), instead of "Peptide Space".
  - The preset chip is labeled "Variant" for amplicon (the preset value stays `peptide`, so preset application is unchanged).
  - Centroid origin-cluster hiding now also reads `pl7.app/repertoire/extractionRunId`, so an amplicon centroid dataset's origin cluster is hidden as it is for peptide centroids.

  The `modality` output intentionally still reports `peptide` for amplicon — that value drives the correct non-VDJ preset/sampling behavior in the UI.

## 4.3.2

### Patch Changes

- 5f9643d: Hide a centroid dataset's origin cluster from the diversification options, since each centroid is already its own cluster.

## 4.3.1

### Patch Changes

- a7b65c0: No Op Change To Unblock

## 4.3.0

### Minor Changes

- 0a06331: New changeset
- 76621cc: Rank by Max Frequency (`pl7.app/maxFrequency`) by default in the in-vitro preset, alongside enrichment scores.

## 4.2.4

### Patch Changes

- 2b913d6: Fix columns produced downstream of an earlier Lead Selection (e.g. 3D Structure Prediction / Clustering / 3D Structure-Based Liabilities) being hidden from the ranking, filter and table column pickers. The self-column filter matched `antibody-tcr-lead-selection` anywhere in a column's trace, so it also excluded everything computed after a "Selected Leads" step. It now matches only the producing (last) trace step, so a Lead Selection still hides its own selection-marker columns while surfacing downstream analytical columns such as Developability cost.

## 4.2.3

### Patch Changes

- b294bfc: MILAB-6318: fix a transient "Some outputs have errors" banner that flashed during calculation on remote backends. The `selfBlockId` read (which drops self-referential filters) now uses `getDataAsJsonOrUndefined`, which returns `undefined` while the field is resolved-but-not-yet-fetched instead of throwing like `getDataAsJson`.

## 4.2.2

### Patch Changes

- 25fc14f: Include embedding clustering trace

## 4.2.1

### Patch Changes

- 16db3ce: Add clonotype-convergence columns to the in-vivo preset defaults. Convergent
  neighbour frequency (`pl7.app/vdj/convergence/nbFreq`) joins the default
  in-vivo ranking (descending), and convergent hit
  (`pl7.app/vdj/convergence/fastStar`) joins the default in-vivo filters (keep
  only "Hit"). Effective when the convergence columns carry the matching
  `pl7.app/isScore` / `pl7.app/score/defaultCutoff` annotations (emitted by the
  clonotype-convergence block).
- f17abee: Update SDK

## 4.2.0

### Minor Changes

- 8edddd1: Add dataset selector with optional filter dropdown. Replaces the plain dataset dropdown with `PlDatasetSelector`, and inner-joins the selected filter column into the clone table so it narrows every downstream stage (final clonotypes, spectratype, Kabat).

## 4.1.5

### Patch Changes

- 73fbf24: Recognize 3d-structure-clustering linkers when populating the cluster-column dropdown. The label is now extracted from the producer block's clustering trace element for both clonotype-clustering and 3d-structure-clustering sources.

  Show the "Clone Id" axis-label column by default in the main lead-selection table (previously it was orderable but only visible from the optional-columns picker).

## 4.1.4

### Patch Changes

- f4fb49e: Update SDK

## 4.1.3

### Patch Changes

- c1cdb27: Revert udpate

## 4.1.2

### Patch Changes

- 0b07f15: update dependencies
- 2eff103: Update dependencies

## 4.1.1

### Patch Changes

- c85f63a: SDK update

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

## 4.0.2

### Patch Changes

- 2a2533d: Fix minor issues
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

## 3.2.0

### Minor Changes

- 2963224: Show table with partial data

## 3.1.1

### Patch Changes

- 9faee69: Ensure that presets contain only expected filters and ranking columns

## 3.1.0

### Minor Changes

- 23ba36d: update sdk for fixing loading axes data in table

## 3.0.3

### Patch Changes

- 3e9c9ef: bump sdk for fix table query

## 3.0.2

### Patch Changes

- 8fcb373: new export

## 3.0.1

### Patch Changes

- 3229116: SDK update

## 3.0.0

### Major Changes

- c2c2b06: VDJ Integration support, BlockV3 api migration

## 2.2.1

### Patch Changes

- 199e95d: Updated dependencies

## 2.2.0

### Minor Changes

- f54202c: Add isNA/isNotNA filter types for lead selection filters

  Columns with discrete allowed values (like Structural Liabilities with None/Low/Medium/High) previously only offered "Is one of" / "Is not one of" filter types, making it impossible to filter by empty/NA values. Now all column types (numeric, string, and discrete) include "Is empty (NA)" and "Is not empty (NA)" filter options.

## 2.1.1

### Patch Changes

- d80f198: fix filter options, update dependencies

## 2.1.0

### Minor Changes

- 84a7fe5: Deal with ANARCI numbering issues

## 2.0.4

### Patch Changes

- 1e872e3: Allow in filter options multiple choice filters without defaul valuet

## 2.0.3

### Patch Changes

- f5800e7: Allow to use mutation columns in rank

## 2.0.2

### Patch Changes

- 592b8dd: Fix lead filter

## 2.0.1

### Patch Changes

- 60a81eb: Fix MSA row duplication for single cell data

## 2.0.0

### Major Changes

- 590699a: Introduce diverisified ranking, in-vivo score estimation and workflow presets

## 1.15.11

### Patch Changes

- c112c60: Fix hidden columns (e.g. Selected Leads) incorrectly appearing in table column controls by preserving original visibility annotations from workflow

## 1.15.10

### Patch Changes

- 7db9d6c: Filter-out exports from main table

## 1.15.9

### Patch Changes

- ff606b5: Implement multi-selection filters

## 1.15.8

### Patch Changes

- 748d512: Ensure block labels are visible when there are columns with identical label

## 1.15.7

### Patch Changes

- a197d00: Update SDK

## 1.15.6

### Patch Changes

- dda8ecc: Show only KABAT sequence column, improve block label generation, use SDK strings for status messages

## 1.15.5

### Patch Changes

- 9cb3d0b: Update block label

## 1.15.4

### Patch Changes

- 6a912d1: Show running state for tables and graphs

## 1.15.3

### Patch Changes

- accb214: correct table headers

## 1.15.2

### Patch Changes

- 1ec3ac8: Make KABAT columns visible by default

## 1.15.1

### Patch Changes

- 0b57c1b: Show only specific columns be default: Clone, Cluster Id, AA sequence and filter/rank columns

## 1.15.0

### Minor Changes

- b201aaf: Improve cluster ranking, improve performance

## 1.14.0

### Minor Changes

- 4ecbe6b: Improve cluster-based ranking

## 1.13.0

### Minor Changes

- 00143a9: multiple clustering blocks fix, columns names fix, dependencies updates

## 1.12.0

### Minor Changes

- 3825a42: Fix errors related to numeric properties that apply only to a subset of clonotypes and to multiple clustering blocks upstream

## 1.11.0

### Minor Changes

- ccc8076: kabat numbering added

## 1.10.3

### Patch Changes

- 44895be: Support parquet format

## 1.10.2

### Patch Changes

- 65e8749: Minor bugs correction and SDK update

## 1.10.1

### Patch Changes

- edbd894: technical release
- 6dc2d2b: technical release
- e581493: technical release
- 1c26f0d: technical release

## 1.10.0

### Minor Changes

- 67443d9: Move all calculations to prerun

## 1.9.4

### Patch Changes

- technical release

## 1.9.3

### Patch Changes

- 020a5b4: Update SDK and python

## 1.9.2

### Patch Changes

- 22b01ef: Updated SDK to support polars.

## 1.9.1

### Patch Changes

- 878a86a: Update packages versions

## 1.9.0

### Minor Changes

- b499ab2: Add rank column

## 1.8.0

### Minor Changes

- a435169: Move filters to settings and add prerun

## 1.7.0

### Minor Changes

- 456ba67: Use ui state for ranking metadata

## 1.6.0

### Minor Changes

- 792dea6: Migrate to PlElementList

### Patch Changes

- f0a7b9b: Upgrade to use latest PlAgDataTableV2 update

## 1.5.1

### Patch Changes

- 44c4b32: PlAgDataTableV2 upgrade

## 1.5.0

### Minor Changes

- bf454d4: Default ranking column in case user does not select one
- 4990fd8: Fix empty top and ranking cases

## 1.4.0

### Minor Changes

- 2e24f7a: Disable default normalization in VJ usage plot and change spectratype/VJ usage script to run on top clonotypes if provided

## 1.3.0

### Minor Changes

- 5ee90ac: Add CDR3 spectratype

## 1.2.1

### Patch Changes

- 339a780: Main backbone

## 1.2.0

### Minor Changes

- 1990e84: Fix table

## 1.1.0

### Minor Changes

- 208de2a: First version
