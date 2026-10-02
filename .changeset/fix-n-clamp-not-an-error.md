---
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Stop reporting the N clamp as an error

Asking for more clonotypes than the table holds selects all of them, which is
the intended behaviour. main.py printed that with an "Error:" prefix, so a
reader grepping the block log for a failure found one that was not there.

The message now states what happened and carries no error prefix.
