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
Kabat numbering toggle and the block labels.

The stored ranking and filter lists stay out of it: each entry carries a
`PObjectId`, whose global form is a canonicalized `PlRef` naming a column of the
exporting project, and the UI rebuilds both lists from the block's own
`rankingConfig` / `filterConfig` outputs against whatever dataset the block
lands on. `preset` is what carries that recipe across instead, so the target
project fills in its own ids. `diversificationColumn` is out for the same
reason — the UI writes it from the `clusterColumnOptions` output. Table grid
state, the four graph states, the alignment model, the panel-init guards and
the dismissed one-time notice are view state and never cross the boundary.

The facade now publishes with `--unstable`.
