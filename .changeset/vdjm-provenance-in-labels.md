---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Show VDJ Multiomic Integration provenance in the filter and ranking column labels.

Its per-clonotype columns (dominant antigen, per-antigen fractions, restriction index, breadth) share generic names, and label derivation only appends trace steps to disambiguate — the high-importance upstream dataset step won those slots, so the columns showed no sign of coming from VDJ Multiomic Integration. Force-include that block's trace type in the filter/ranking label derivation (the same mechanism already used for clustering columns) so its columns are identifiable.
