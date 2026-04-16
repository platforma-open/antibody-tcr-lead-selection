---
"@platforma-open/milaboratories.top-antibodies.workflow": minor
"@platforma-open/milaboratories.top-antibodies.model": minor
"@platforma-open/milaboratories.top-antibodies.ui": minor
---

Track which filter step eliminated each clonotype (or marks it as a
survivor) and visualize the attrition in a new Selection page. The
sample-clonotypes script emits a selectionStage column per clone; the
workflow exposes it as selectionStagePf, and the block UI renders it
via GraphMaker's selection chart type.
