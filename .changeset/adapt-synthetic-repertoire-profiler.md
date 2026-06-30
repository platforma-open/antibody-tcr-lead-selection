---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies.ui': patch
---

Polish for `synthetic-repertoire-profiler` (amplicon) variant datasets. The block already handled amplicon functionally (variantKey routes down the non-VDJ path); these are labeling/scoping fixes only:

- The sequence-space section is labeled "Variant Space" for amplicon input (axis domain `pl7.app/repertoire/extractionRunId`), instead of "Peptide Space".
- The preset chip is labeled "Variant" for amplicon (the preset value stays `peptide`, so preset application is unchanged).
- Centroid origin-cluster hiding now also reads `pl7.app/repertoire/extractionRunId`, so an amplicon centroid dataset's origin cluster is hidden as it is for peptide centroids.

The `modality` output intentionally still reports `peptide` for amplicon — that value drives the correct non-VDJ preset/sampling behavior in the UI.
