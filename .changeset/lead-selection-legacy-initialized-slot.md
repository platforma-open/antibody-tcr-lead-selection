---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Stop exporting templates the block's kind refuses. A block whose stored data still held the old joined `anchor::preset` string in `filtersInitializedForAnchor` / `rankingsInitializedForAnchor` exported it as is, and applying the template failed with "'filtersInitializedForAnchor' must be an object of { anchor, preset }". A new data migration splits any such string again, and template export writes the two slots in the `{ anchor, preset }` form either way.
