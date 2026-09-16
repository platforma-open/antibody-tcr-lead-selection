---
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Rank numeric columns as numbers, and rank a missing value last in its own column

The clone table writes a missing number as "". A ranking column with one missing
value reaches the sampler as a string column. The sampler cast that column back
to Float64 with a strict cast. The strict cast raised on "". The sampler swallowed
the error and sorted the column as text. Ranking by Overall Log2FC from highest
put the largest value at rank 475, behind every single-digit value.

The cast is now non-strict. "" and any text that is not a number become null. The
literals "NaN", "inf" and "-inf" parse to real floats that sort ahead of every
finite value, so they become null as well. A NaN or an inf in a column that is
already numeric gets the same treatment.

A clonotype with no usable value stays in the selection. It ranks last in the
column where its value is missing, in either direction. It keeps its position on
every other ranking criterion. A clonotype with no diversification group is still
dropped, because there is no group to spread it across.
