---
"@platforma-open/milaboratories.top-antibodies.sample-clonotypes": patch
"@platforma-open/milaboratories.top-antibodies.workflow": patch
"@platforma-open/milaboratories.top-antibodies": patch
---

Fix selectionStage PColumn build failure caused by empty clonotypeKey rows. The upstream Full join can emit secondary-axis (cluster/linker) rows not tied to any clonotype; their empty clonotypeKey collided on the single-axis selectionStage frame. filter.py now drops null/empty clonotypeKey rows from the selection-stage output.
