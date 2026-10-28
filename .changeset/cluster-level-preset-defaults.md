---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Restore cluster-level enrichment scores in preset defaults

Restricting default seeding to the selected dataset's own axes excluded every column reached
through a link, not only columns of another dataset. When Enrichment Analysis ran on clusters,
Max Log2FC and Enrichment Quality dropped out of the In Vitro default filters and rankings, and
In Vitro was no longer auto-detected.

A score now seeds defaults when it resolves to one value per record of the selected dataset,
directly or through that dataset's own links (clusters, lineages), and neither the score nor
any link on its path is keyed by another dataset's records. Columns of a dataset joined by VDJ
Integration still stay out of the defaults and remain available in the dropdowns.
