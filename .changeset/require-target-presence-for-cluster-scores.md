---
'@platforma-open/milaboratories.top-antibodies.workflow': minor
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': minor
'@platforma-open/milaboratories.top-antibodies': minor
---

Require evidence that a clonotype was present in the target before ranking or filtering by cluster-level enrichment

A cluster-level enrichment score describes the cluster, not its individual members, so a
clonotype never observed in a target's selection rounds could still be selected as a lead.
Selection now requires that clonotype's own Max Frequency in that target to be above zero,
checked independently for each target.

The Selection Plot shows this as a first funnel stage, "Observed in rounds". Existing
projects will select fewer leads after re-running.
