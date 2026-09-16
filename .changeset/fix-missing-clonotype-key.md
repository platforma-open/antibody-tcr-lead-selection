---
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Report a missing clonotypeKey column instead of raising

validate_column_format returned a bare False when the input table had no
clonotypeKey column, but main.py unpacks three values from the return. The
caller raised "TypeError: cannot unpack non-iterable bool object", so the
error message the function printed never reached the operator.

main.py now checks for the column and stops with the message.
