---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Seed preset defaults only from the selected dataset's own columns

Default filters and rankings, and every workflow preset, were computed from every score column
discovery could reach, including columns of another dataset joined through a linker such as the
one VDJ Integration emits. A bulk dataset linked to a single-cell reference received default
filters on the single-cell columns; every bulk clonotype without a match carried null there and
was dropped at the first selection stage.

Scores now qualify only when every axis of the column is an axis of the selected dataset.
Linked columns remain in the filter and ranking dropdowns for explicit selection. All anchored
discoveries in the model share one traversal scope.
