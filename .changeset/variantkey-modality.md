---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Report a bare antibody set as antibody, not peptide

Three producers key on `pl7.app/variantKey` and only the run-id in the axis domain separates
them. A bare antibody set from import-vdj-data was reported as the peptide modality: its
sequence-space section read "Peptide Space" and the preset picker offered only the peptide
preset.

Modality and "supports the gene-based analyses" were the same test, and they are not the same
question. They are now separate. A bare antibody set is antibody — so it gets "Clonotype Space"
and the full preset list — but it still does not get CDR3 V Spectratype or V/J Gene Usage,
because nothing aligned its sequences to a reference and there are no V/J calls to plot. Same
outcome as before for those two sections, now for the accurate reason.

Peptide and amplicon inputs are unaffected.
