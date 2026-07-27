---
'@platforma-open/milaboratories.top-antibodies': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': patch
---

Fix diversification by cluster columns from 3d-structure-clustering

Diversification silently did nothing when the selected cluster column came from a
clustering block whose `clusterSize` column was not fetched into the bundle (e.g.
3d-structure-clustering, which emits `pl7.app/structure/clustering/clusterSize`).
`resolveClusterColumnHeader` returned a `clusterAxis_<idx>_0` header that only the
cluster-size loop ever creates, so the sampler logged "Diversification column not
found" and skipped diversification entirely. It now returns the linker's own
`cluster_<idx>` header, which exists whenever the linker is in the clone table.

Clonotypes with no cluster assigned are now excluded from selection again. They
arrive in the clone table as empty strings — `parquetFileBuilder` writes missing
values as `""` — so the existing `drop_nulls` guard never saw them and they leaked
into the leads table after the clone table moved from an Inner to a Full join.

Also widened the `clusterSizes` bundle query to match
`pl7.app/structure/clustering/clusterSize`, making 3D cluster sizes available, and
stopped the cluster-size loop from renaming an axis the linker loop already
headered.
