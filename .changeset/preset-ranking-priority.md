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

The two mutation filters keep the stricter cutoffs the In Vivo preset has always applied, and they now lead the list instead of being appended after it.

Criteria or filters sharing a position are ordered by the label they show, so related columns stay together — the per-comparison fold changes, for instance. Two columns that share a position *and* a label, as happens when a project runs two Enrichment Analysis blocks, keep a stable order between runs rather than following whichever was discovered first.

Saved projects keep the lists they already have; the new order applies when a preset seeds its defaults, so to a newly added block or after **Reset to defaults**.

The peptide preset previously started with every numeric score column rather than a chosen set; it now starts with the same criteria and filters as In Vitro. A peptide project carrying none of those metrics gets no pre-filled criteria, where before it got whatever scores it had — and a project whose filter set changes selects a different set of sequences. Any score column left out of a preset's defaults is still available to add by hand.
