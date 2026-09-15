---
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Rank numeric columns as numbers when some clonotypes have no value

The clone table writes a missing number as "". A ranking column with one
missing value reaches the sampler as a string column. The sampler cast that
column back to Float64 with a strict cast. The strict cast raised on "", the
error was swallowed, and the column was sorted as text. Ranking by Overall
Log2FC from highest put 10.11 last, behind a run of 2.59. Clonotypes with no
value were also selected, because "" is not null.

The cast is now non-strict. "" becomes null, and clonotypes with no value are
not selected.
