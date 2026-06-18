---
'@platforma-open/milaboratories.top-antibodies.model': patch
---

Add clonotype-convergence columns to the in-vivo preset defaults. Convergent
neighbour frequency (`pl7.app/vdj/convergence/nbFreq`) joins the default
in-vivo ranking (descending), and convergent hit
(`pl7.app/vdj/convergence/fastStar`) joins the default in-vivo filters (keep
only "Hit"). Effective when the convergence columns carry the matching
`pl7.app/isScore` / `pl7.app/score/defaultCutoff` annotations (emitted by the
clonotype-convergence block).
