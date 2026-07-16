---
"@platforma-open/milaboratories.top-antibodies": patch
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.ui": patch
"@platforma-open/milaboratories.top-antibodies.workflow": patch
"@platforma-open/milaboratories.top-antibodies.umap": patch
"@platforma-open/milaboratories.top-antibodies.spectratype": patch
"@platforma-open/milaboratories.top-antibodies.sample-clonotypes": patch
"@platforma-open/milaboratories.top-antibodies.assembling-fasta": patch
"@platforma-open/milaboratories.top-antibodies.anarci-kabat": patch
---

Keep filter and ranking options available while an upstream block is recalculating.

Previously the filter/ranking config outputs were `retentive`, so a freshly-configured Lead Selection block showed no filter options (an empty, spinning "Filter by" dropdown) for the entire time any upstream block was running. The config outputs now recompute from the currently-available columns instead, so the options stay populated. Selecting a column whose producer is still recalculating is safe — running the block waits for that upstream to finish before executing.

Also migrates the block onto the canonical structurer layout and upgrades the SDK toolchain (block-tools, tengo-builder).
