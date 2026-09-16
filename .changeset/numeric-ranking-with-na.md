---
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Rank numeric columns as numbers, and rank a clonotype with no value last

The clone table writes a missing number as "". A ranking column with one
missing value reaches the sampler as a string column. The sampler cast that
column back to Float64 with a strict cast. The strict cast raised on "", the
error was swallowed, and the column was sorted as text. Ranking by Overall
Log2FC from highest put 10.11 last, behind a run of 2.59.

The cast is now non-strict, so "" and any text that is not a number become
null. "NaN", "inf" and "-inf" parse to real floats that sort ahead of every
finite value, so they become null too, as does a NaN or inf that arrives in an
already-numeric column.

A clonotype with no usable value in an active ranking column is no longer
dropped from selection. It ranks behind every clonotype that has one — in both
directions, and under diversification — and is selected only once N reaches it.
A clonotype with no diversification group is still dropped, because there is no
group to spread it across.
