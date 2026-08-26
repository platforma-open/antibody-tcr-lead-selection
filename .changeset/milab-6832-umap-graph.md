---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies.ui': patch
'@platforma-open/milaboratories.top-antibodies.workflow': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

MILAB-6832: fix the UMAP graph, and update graph-maker, MSA and ANARCI

`umapPf` handed result-pool columns to `createPFrameForGraphs` as block columns.
`getRelatedColumns` registers the result pool as a provider alongside those
columns, and both sides mint the same global id, so any UMAP column reachable
from the pool aborted the whole pFrame with "Duplicate column id ... in provider
ResultPool". Where the projection did not integrate with the input anchor there
was no crash and no plot either — the output silently returned nothing.

The pFrame is now built from anchored discovery over the UMAP column specs,
unioned per column, plus the columns themselves. Anchors are specs rather than
ids, so the pool's own copy can no longer collide, and the pFrame holds what
joins the columns the graph puts on X and Y. `umapPcols` moves from anchored
discovery to a plain filter, so the column list and the pFrame cover the same
set: anchored discovery required the UMAP axis to carry the input anchor axis'
full identity, and a projection keyed on a domain-subset of it was dropped.

The UMAP, spectratype and selection-stage pages set `noBodyGutters` on
`PlBlockPage`, so each plot fills its page.

graph-maker 1.4.8 -> 1.7.2, multi-sequence-alignment 1.47.18 -> 1.47.24 and
software-anarci ^0.0.3 -> ^1.0.1. software-anarci 1.0.1 records
`docker.entrypoint` in its descriptor, which a Kubernetes pod spec needs — the
pod overrides the image ENTRYPOINT, so without it the conda environment was
never activated on server deployments.

The ANARCI step's output placeholders are marked `writable`. It pre-creates
`anarci.csv_H.csv` / `anarci.csv_KL.csv` so `saveFile` always finds them, then
ANARCI writes to those same names; staged files are read-only by default, so on
server deployments ANARCI died with
`[Errno 13] Permission denied: 'anarci.csv_H.csv'`.
