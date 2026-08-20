---
'@platforma-open/milaboratories.top-antibodies.kind': minor
'@platforma-open/milaboratories.top-antibodies.model': minor
'@platforma-open/milaboratories.top-antibodies': minor
---

Add the mandatory block kind and upgrade the SDK

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
