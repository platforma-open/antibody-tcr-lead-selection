---
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Keep the selection-stage update on the membership form of is_in

main.py passed a Series to is_in when it bumped the sampled clonotypes to the
final selection stage. Polars deprecated that form and will switch it to an
element-wise comparison, which would mark the wrong rows without failing.

The argument is now imploded, which keeps the membership test and clears the
DeprecationWarning from the block log.
