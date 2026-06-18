---
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
---

Fix Selection Plot funnel starting from fewer clonotypes than the project has. The clone table is now built with a Full join plus a dense per-clonotype presence column instead of an inner join, so clonotypes that lack sparse columns (e.g. an enrichment row) reach the funnel and are dropped at the filter stage that checks the missing column rather than before stage tracking — the funnel total now matches the full clonotype count. The optional primary dataset filter is applied as a row pre-condition in the sampler, and null-ranked or null-diversification clonotypes are dropped before selection so they are never sampled.
