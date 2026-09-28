---
'@platforma-open/milaboratories.top-antibodies.kind': major
'@platforma-open/milaboratories.top-antibodies.model': minor
'@platforma-open/milaboratories.top-antibodies.ui': minor
'@platforma-open/milaboratories.top-antibodies': minor
---

Store the defaults-init anchor as a `PlRef` object instead of a serialized string.

`filtersInitializedForAnchor` / `rankingsInitializedForAnchor` are now `{ anchor: PlRef, preset }`: nothing in the slot is a string that has to be parsed back, and `relocateBlockIds` repoints the `PlRef` when a template is applied. The kind accepts only this form, so a template carrying the old serialized anchor, or the older joined `anchor::preset` string, is refused (breaking for the kind).

The `Ver_2026_09_28` data migration reads both old stored forms into the new one. This also repairs projects whose data still held the joined string after `Ver_2026_08_20`; a template exported from such a project was refused on apply with "'filtersInitializedForAnchor' must be an object of { anchor, preset }". The UI compares the stored anchor with `plRefsEqual`, ignoring enrichments.
