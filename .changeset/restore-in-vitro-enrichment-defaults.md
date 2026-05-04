---
"@platforma-open/milaboratories.top-antibodies": patch
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.workflow": patch
---

Accept both pre- and post-peptide-adaptation spec names from upstream blocks so projects using either version remain functional:

- Preset filter/ranking allowlists now include `pl7.app/enrichment*` (clonotype-enrichment) and `pl7.app/developability*` (antibody-sequence-liabilities) alongside the legacy `pl7.app/vdj/`-prefixed names.
- Diversification dropdown, cluster-axis matching, hidden cluster-mapping column, and workflow-side linker matching now recognize both `pl7.app/clusterId` and `pl7.app/vdj/clusterId` axis names (clonotype-clustering rename).
- Cluster-size query uses a namePattern matching both `pl7.app/clustering/clusterSize` and `pl7.app/vdj/clustering/clusterSize`.