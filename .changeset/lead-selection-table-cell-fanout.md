---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Stop the results table joining per-cell columns, which replicated every lead row

Discovery for the results table placed no constraint on axes, so it reached
per-cell columns through `pl7.app/sc/cellLinker`. That linker is one-to-many: it
maps one clonotype to every (sample, cell) that carries it, so a column keyed by
`[sampleId, cellId]` joins each lead row once per cell.

The single-axis anchor did not prevent this. The anchor fixes the table's core,
while the joined axis set is the union over all columns, and the added axes are
then marked hidden because visibility follows the primary column's axes. The
extra rows never showed in the UI and the join still materialised them.

A crashed session shows the shape: 21 joined columns, of which 14 sit on the
clonotype axis and are harmless, six are `pl7.app/antigen/rawUmiCount` on
`[sampleId, cellId]` reached through the cell linker, and one is
`pl7.app/antigen/panelOfSample` on `[sampleId]`. All seven carry the per-sample
axis. The middle-layer worker went from 390 MiB to 101 GiB of private memory in
35 seconds and was killed. Each of the six also re-runs the cell-linker join on
its own, so the plan carries six copies of the same subtree.

Discovery now excludes columns carrying the per-sample axis, the same exclusion
the filter and ranking lists already apply. The per-clonotype aggregates that
summarise these columns — `boundCount`, `cellCount`, `medianUmiCount`,
`identityVerdict` — are unaffected.
