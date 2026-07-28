---
'@platforma-open/milaboratories.top-antibodies.workflow': minor
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': minor
---

Require target presence when ranking or filtering by cluster-level enrichment scores

An enrichment score computed at cluster resolution says nothing about whether an
individual clonotype or peptide was observed in that target's selection rounds. A
cluster could be strongly enriched while one of its members was never seen in the
target at all, and that member could still be selected as a lead — under
diversified ranking it could even become its cluster's representative, since the
cluster contributes one lead regardless of how thin its surviving members are.

Selection now enforces a precondition: whenever a filter or ranking column comes
from an enrichment block, that block's own per-element Max Frequency must be
greater than zero. Sources are identified by the `pl7.app/blockId` domain carried
by every enrichment export and matched to the Max Frequency column of the same
block, so with several enrichment blocks upstream each referenced target is
required independently (AND). Cluster columns from other blocks — clustering,
3d-structure-clustering — own no Max Frequency column and therefore gate nothing.

The precondition is not a user-editable filter, since results that ignore it are
wrong rather than differently-scoped. It is reported in the Selection Plot as a
single funnel stage named "Present in target(s)", placed ahead of the user
filters, so the number of candidates it removes is visible. Max Frequency remains
available as a normal filter for anyone wanting a stricter threshold; a user
filter can only tighten the requirement, never relax it.

An enrichment block that ran before per-element Max Frequency was exported has no
column to check against. The precondition is then skipped for that source, and if
no source resolves one, no stage is emitted at all — so the absence of the stage
in the funnel reports honestly that the check did not run.

Existing projects will select fewer leads after re-running when candidates were
previously admitted on cluster-level evidence alone, and user filter stages shift
by one in the Selection Plot to make room for the new first stage.
