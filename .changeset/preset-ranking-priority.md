---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Give each preset's default rankings and filters a fixed order

A preset's starting criteria and filters were listed in whatever order they were discovered upstream. For rankings that order decided their priority, and it could shift as a project gained blocks. Each preset now declares both lists in the order they apply.

**Rankings**

- **In Vivo** — Repertoire score, then Developability cost.
- **In Vitro** and **Peptide** — Max Log2FC, then Max Frequency, then Developability cost, with a per-comparison Log2FC after those for each comparison Enrichment Analysis was asked to export.

Max Frequency sits ahead of Developability cost because it is the first criterion measured per sequence. When Enrichment Analysis runs on clusters, every sequence in a cluster carries the same Max Log2FC, so the criterion after it is what orders sequences inside a cluster — and only a per-sequence value can do that, which is what keeps a barely-present member of an enriched cluster away from the top.

**Filters**

- **In Vivo** — Fraction CDR mutations, nMutations, Developability risk, Is Productive.
- **In Vitro** and **Peptide** — Binding Specificity, Enrichment Quality, Max Log2FC, per-comparison Log2FC, Developability risk, Is Productive.

The two mutation filters keep the stricter cutoffs the In Vivo preset has always applied, and they now lead the list instead of being appended after it. A project selects the same sequences as before from the same filters; only the order they are listed in has changed.

Criteria or filters sharing a position — a per-comparison Log2FC for each comparison, say — are ordered by name, so related columns stay together.

A filter whose column appears more than once, such as a mutation count reported per chain in single-cell data, now contributes one filter per column. Previously only the first was kept.

The peptide preset previously started with every numeric score column rather than a chosen set; it now starts with the same criteria and filters as In Vitro, which are the ones peptide projects carry. Any score column left out of a preset's defaults is still available to add by hand.
