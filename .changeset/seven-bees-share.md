---
"@platforma-open/milaboratories.top-antibodies.sample-clonotypes": minor
"@platforma-open/milaboratories.top-antibodies.workflow": minor
"@platforma-open/milaboratories.top-antibodies.model": minor
"@platforma-open/milaboratories.top-antibodies.kind": minor
"@platforma-open/milaboratories.top-antibodies.ui": minor
"@platforma-open/milaboratories.top-antibodies": major
---

Balanced ranking, alongside the ranking the block already had

Ranking criteria have always applied in priority order, the second one separating only the sequences that tied exactly on the first. For continuous values exact ties are vanishingly rare, so every criterion after the first was effectively inert. **Balanced score** is a second way to rank: each criterion carries a weight and leads are selected by one combined score, so every criterion has a say.

**Priority stays the default**, for saved projects and for newly added blocks alike, so no project moves to the new ranking on its own. A **Priority** / **Balanced** tab beside "Choose the best sequences by" picks between the two; the criteria list is shared, so switching back and forth costs nothing.

In **Priority**, criteria apply in sequence and a row's position is its priority — drag a row to change it. **This release makes that true.** Until now a row's position was overridden by what the criterion measured: criteria on whole clusters ran before criteria carried over a linker, which ran before criteria on single sequences, and criteria from different clusterings ran in the order the clusterings happened to be found. Criteria now apply in exactly the order they appear. A saved project whose criteria were not already in that old order can select different leads after this upgrade; one ranking on a single criterion is unaffected.

In **Balanced**:

- Every ranking row gains an editable weight, with a read-only percentage beside it showing that weight as a fraction of all the weights together — which is what the score multiplies by. Weights start equal, so a ranking left untouched is a balanced average of its criteria.
- Values are replaced by their rank before weighting, so criteria measured in different units combine meaningfully and a weight means the same thing whatever a criterion's raw scale. Equal values score equally. A missing value scores level with the worst value present and loses the resulting tie to a sequence that was measured, so it still ranks last without being dropped from selection.
- Scaling every weight by the same factor changes nothing — only the balance between them counts. A weight must be above 0 and at most 1000; to stop a criterion counting, remove its row rather than zeroing it.
- Diversification is unchanged; the combined score is simply what it ranks and interleaves by.

Also in this release, in both modes: the "Rank by" dropdown groups columns by whether they act on whole clusters or on single sequences, and the Settings panel is wider to better display compound labels.

"Diversify by" now names every clustering it offers after the block that produced it. It previously recognised clustering blocks from a fixed list, so GLIPH2 Clustering and clusTCR Clustering were offered as a bare "Cluster", and a clustering run on top of another clustering was labelled with the name of the one underneath.
