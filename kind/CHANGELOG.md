# @platforma-open/milaboratories.top-antibodies.kind

## 1.2.1

### Patch Changes

- 562c7c8: Update tools version

## 1.2.0

### Minor Changes

- 04a7d27: Balanced ranking, alongside the ranking the block already had

  Ranking criteria have always applied in priority order, the second one separating only the sequences that tied exactly on the first. For continuous values exact ties are vanishingly rare, so every criterion after the first was effectively inert. **Balanced score** is a second way to rank: each criterion carries a weight and leads are selected by one combined score, so every criterion has a say.

  **Priority stays the default**, for saved projects and for newly added blocks alike, so no project moves to the new ranking on its own. A **Priority** / **Balanced** tab beside "Choose the best sequences by" picks between the two; the criteria list is shared, so switching back and forth costs nothing.

  In **Priority**, criteria apply in sequence and a row's position is its priority — drag a row to change it. **This release makes that true.** Until now a row's position was overridden by what the criterion measured: criteria on whole clusters ran before criteria carried over a linker, which ran before criteria on single sequences, and criteria from different clusterings ran in the order the clusterings happened to be found. Criteria now apply in exactly the order they appear. A saved project whose criteria were not already in that old order can select different leads after this upgrade; one ranking on a single criterion is unaffected.

  In **Balanced**:

  - Every ranking row gains an editable weight, with a read-only percentage beside it showing that weight as a fraction of all the weights together — which is what the score multiplies by. Weights start equal, so a ranking left untouched is a balanced average of its criteria.
  - Values are replaced by their rank before weighting, so criteria measured in different units combine meaningfully and a weight means the same thing whatever a criterion's raw scale. Equal values score equally. A missing value scores level with the worst value present and loses the resulting tie to a sequence that was measured, so it still ranks last without being dropped from selection.
  - Scaling every weight by the same factor changes nothing — only the balance between them counts. A weight must be above 0 and at most 1000; to stop a criterion counting, remove its row rather than zeroing it.
  - Diversification is unchanged; the combined score is simply what it ranks and interleaves by.

  Also in this release, in both modes: the "Rank by" dropdown groups columns by whether they act on whole clusters or on single sequences, and the Settings panel is wider to better display compound labels.

  "Diversify by" now names every clustering it offers after the block that produced it. It previously recognised clustering blocks from a fixed list, so GLIPH2 Clustering and clusTCR Clustering were offered as a bare "Cluster", and a clustering run on top of another clustering was labelled with the name of the one underneath.

## 1.1.0

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
