---
"@platforma-open/milaboratories.top-antibodies.workflow": minor
"@platforma-open/milaboratories.top-antibodies.model": minor
"@platforma-open/milaboratories.top-antibodies.ui": minor
"@platforma-open/milaboratories.top-antibodies": minor
---

Support dataset filters from Repertoire Labeling and other subset columns

- Any subset column, Repertoire Labeling tags included, can now be picked as the dataset filter. The picked filter is no longer offered again in the filter list.
- Default filters, ranking and presets follow the dataset filter: columns computed on the same subset are preferred, with the full-data version as fallback; a full-data run never defaults to subset columns, and columns from a different subset are never defaults.
- The diversification default follows the same rule, and clusterings run on a subset show the subset name in their label.
- Changing the dataset filter re-applies the defaults, resets the preset to None and clears the diversification column, as a dataset change does.
- "Reset to defaults" is disabled while the defaults for a new dataset or filter are still being computed, and an info message asks to wait meanwhile.
- The exported selection's trace starts from the dataset filter when one is set, so it names the subset.
- Fewer result-pool discoveries per dataset change: the filter and ranking lists reuse one discovery, and two unused outputs were removed.
