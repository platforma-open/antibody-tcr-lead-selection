---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Hide repertoire-labeling tags from the dataset picker's filter row

The filter row offers a subset column that scopes the chosen dataset. It admitted every column
annotated `pl7.app/isSubset`, so a repertoire-labeling block added one entry per label. A label
is an analysis filter and not a dataset restriction, and the row grew with the label count.

The row now rejects `pl7.app/tag`. The tags still reach the block's own filter list through
`filterConfig`, which is where a scientist filters leads by a label.
