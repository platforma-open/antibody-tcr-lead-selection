---
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.workflow": patch
---

Support clustering/centroidId datasets in the dataset picker. Per-cluster centroid datasets from clonotype-clustering are peptide-only, so they are now treated as peptide modality (preset, sections, and workflow path) and can be ranked, filtered, and sampled. Previously they were routed as antibody_tcr, which ran the VDJ-only CDR3/V-J/Kabat steps and crashed building an empty sequence table ("Cannot build XSV: no columns have been added").
