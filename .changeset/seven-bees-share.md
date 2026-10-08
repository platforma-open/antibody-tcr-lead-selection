---
"@platforma-open/milaboratories.top-antibodies.sample-clonotypes": minor
"@platforma-open/milaboratories.top-antibodies.workflow": major
"@platforma-open/milaboratories.top-antibodies.model": minor
"@platforma-open/milaboratories.top-antibodies.kind": minor
"@platforma-open/milaboratories.top-antibodies.ui": minor
"@platforma-open/milaboratories.top-antibodies": major
---

Balanced ranking: one weighted score across every ranking criterion

Ranking no longer applies criteria in priority order, where the second one separated only the sequences that tied exactly on the first. For continuous values ties are vanishingly rare, so every criterion after the first was effectively inert. Each criterion now carries a weight, and leads are selected by a single combined score. **Re-running an existing project may select a different set of leads**, and a one-time notice in the block says so. A ranking with a single criterion is unaffected.

- Every ranking row has an editable weight, with a read-only percentage beside it showing that weight as a fraction of all the weights together — which is what the score actually multiplies by. Weights start equal, so a ranking left untouched is a balanced average of its criteria.
- A stored ranking migrates on its own: each criterion keeps its direction and gains a weight from its old position, descending by rank, so three criteria become 50% / 33% / 17%.
- Values are replaced by their rank before weighting, so criteria measured in different units combine meaningfully and a weight means the same thing whatever a criterion's raw scale. Equal values score equally. A missing value scores level with the worst value present and loses the resulting tie to a sequence that was measured, so it still ranks last without being dropped from selection.
- Scaling every weight by the same factor changes nothing — only the balance between them counts. A weight must be above 0.
- Diversification is unchanged; the combined score is simply what it now ranks and interleaves by.
- The "Rank by" dropdown groups columns by whether they act on whole clusters or on single sequences.
- The Settings panel is wider, to better display compound labels.
