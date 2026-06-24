---
"@platforma-open/milaboratories.top-antibodies.model": patch
---

Fix columns produced downstream of an earlier Lead Selection (e.g. 3D Structure Prediction / Clustering / 3D Structure-Based Liabilities) being hidden from the ranking, filter and table column pickers. The self-column filter matched `antibody-tcr-lead-selection` anywhere in a column's trace, so it also excluded everything computed after a "Selected Leads" step. It now matches only the producing (last) trace step, so a Lead Selection still hides its own selection-marker columns while surfacing downstream analytical columns such as Developability cost.
