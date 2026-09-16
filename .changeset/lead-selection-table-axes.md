---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Keep the results table on the lead axis instead of joining columns that multiply its rows

Discovery for the results table accepted every column reachable from the
lead-selection anchor, including columns keyed by an axis the anchor does not
have — per-sample abundance, cluster membership, and anything else carrying a
second axis.

A column like that shares only the clonotype axis with the table's core, so the
join keys on that axis alone and carries the extra axis into the result: every
lead row is repeated once per sample, once per cluster, and so on. Picking a
single-axis anchor did not prevent it, because the anchor fixes the core while
the joined axis set is the union over all columns. The extra axis was then
marked hidden, since axis visibility follows the primary column's axes, so the
repetition never showed in the UI while the join still built the full product.

On a many-sample dataset this reached roughly a billion rows in one join and
exhausted memory before the table could render.

Discovery now drops any column carrying an axis the lead-selection column does
not have. Nothing the block shows by default was per-sample: the filter and
ranking lists already excluded per-sample and cluster columns, and label columns
come in through the table's own axis-aware label discovery.
