# Antibody & TCR Lead Selection

Rank and select the most promising antibody, TCR, or peptide candidates from a discovery campaign. This Platforma block compiles every score your upstream analysis produced — abundance, enrichment across selection rounds, somatic hypermutation quality, liabilities, sequence properties — then filters, ranks, and diversifies across clonal families so the panel you advance is developable and structurally varied rather than a redundant Top-N list.

Open-source analysis block for Platforma, the biologics discovery platform by MiLaboratories. For the full no-code workflow, see [platforma.bio](https://platforma.bio/).

> **Naming:** this block appears as **Lead Selection** in the Platforma app; the repository is named `antibody-tcr-lead-selection`. They are the same block.

## What it does

Lead Selection is the decision step at the end of the discovery workflow. Everything upstream produces evidence about candidates; this block turns that evidence into a shortlist — replacing the spreadsheet where that call usually gets made by hand.

Ranking by abundance alone puts near-identical members of one expanded lineage at the top of the list. Instead, the block filters candidates on thresholds you set over any score column, ranks the survivors on multiple criteria with an explicit priority order and direction, then applies **diversified ranking** across clusters so no single family dominates the panel. Where several upstream blocks contributed cluster assignments, you choose which one drives diversification; where no cluster data exists, or you turn diversification off, candidates are ranked directly and the top N taken.

Every filter and ranking rule is visible and editable in the interface — nothing is applied silently in the background.

The block also annotates the selected panel. Turning on **Kabat numbering** runs ANARCI over the selected leads' variable-region amino acid sequences and adds Kabat-numbered position columns per chain, so CDR and framework residues can be compared directly. A multiple sequence alignment view covers the selected candidates alongside the table.

### Workflow presets

Three presets configure sensible filters and ranking for common campaign types, and the block detects which one applies from the columns present upstream. All defaults remain editable.

* **In Vivo** (immunization or infection) — ranks by the **Repertoire Score** from the upstream [Repertoire Score](https://github.com/platforma-open/repertoire-score) block, a composite of clonal expansion, CDR mutation frequency, and germinal-centre selection signal, with default filters on mutation metrics to focus on immune-refined candidates.
* **In Vitro** (display or panning) — ranks by enrichment across selection rounds, identifying clones selected for target binding.
* **Peptide** — ranks by the available numeric scores, typically enrichment, sequence properties, and liabilities. Selected automatically for peptide input, where SHM metrics do not apply.

### Visualizations

* **Sequence Space** — the UMAP from the upstream [Sequence Space](https://github.com/platforma-open/clonotype-space) block with your selected candidates highlighted, the fastest way to confirm the panel is spread across the library rather than concentrated in one region
* **Selection Plot** — candidates across selection stages
* **CDR3 V Spectratype** and **V/J Gene Usage** — antibody and TCR input only, hidden for peptides

## Inputs & outputs

* **Input:** an annotated clonotype, single-cell clonotype, or peptide dataset, plus any score columns upstream blocks have added — enrichment, differential abundance, pairing scores, repertoire score, sequence liabilities, humanness, sequence properties, cluster assignments. The more evidence present, the more there is to rank on.
* **Output:** a ranked, diversified lead panel as a table, with optional Kabat-numbered sequence columns, a multiple sequence alignment, and the visualizations above. The selection is exposed as columns, so it can be carried into further analysis or export.

## Specifications

| | |
|---|---|
| Block title in app | Lead Selection |
| Modalities | Antibodies, TCRs, peptides — bulk, single-cell, and variant/peptide datasets |
| Presets | In Vivo, In Vitro, Peptide — auto-detected from available score columns |
| Filtering | Threshold criteria on any score column |
| Ranking | Multi-criteria, with configurable priority order and direction per criterion |
| Diversification | Across cluster assignments from any upstream clustering block; selectable cluster column; can be disabled |
| Sequence numbering | Optional Kabat numbering via [ANARCI](https://github.com/oxpig/ANARCI), per chain |
| Views | Table, multiple sequence alignment, Sequence Space UMAP with selection highlighted, Selection Plot, CDR3 V spectratype, V/J gene usage |

## Use cases

* **Immunization campaigns:** rank on somatic hypermutation evidence — CDR-focused mutations signalling affinity maturation over framework-heavy mutations signalling structural risk — combined with clonal expansion, via the Repertoire Score.
* **Display and panning campaigns:** rank on enrichment across selection rounds together with developability and affinity data.
* **Peptide selection:** rank peptide candidates on enrichment, properties, and liabilities.
* **Diverse panel construction:** cap how much of the panel any one clonal family can occupy, so downstream characterization covers distinct sequences.
* **Developability-aware picking:** filter out candidates carrying liability motifs or low humanness before ranking, rather than discovering the problem after synthesis.
* **Panel review:** check the selection on the Sequence Space map to confirm the leads are not all drawn from one neighbourhood.

## FAQ

### How is this different from just sorting a table by abundance?

Sorting by abundance returns the largest clones, which in an expanded repertoire means many near-identical sequences. Lead Selection ranks on several criteria at once and then diversifies across clonal families, so the panel spans distinct sequences instead of one lineage repeated.

### What is diversified ranking?

Cluster assignments from an upstream clustering block group related sequences into families. Diversified ranking walks the ranked list while limiting how many candidates come from the same family, so the top of the panel is structurally varied. You choose which cluster column to use, or turn it off to rank sequences directly.

### Which preset should I choose?

The block detects it. Peptide input always uses the Peptide preset; otherwise, if a Repertoire Score column is present upstream it selects In Vivo, and if enrichment scores are present it selects In Vitro. You can override the choice and edit every default.

### Where does the In Vivo composite score come from?

From the upstream [Repertoire Score](https://github.com/platforma-open/repertoire-score) block, which combines clonal expansion, CDR mutation frequency, and germinal-centre selection signal into one metric. Lead Selection ranks by it; it does not compute it. Without that block upstream, the In Vivo preset has nothing to rank on.

### Can I use it for peptides?

Yes. Peptide datasets get their own preset, ranking on enrichment, sequence properties, and liabilities. The SHM-based and V/J gene views are hidden, since they do not apply.

### What does Kabat numbering add?

It assigns standard Kabat residue positions to the selected leads' variable-region amino acid sequences, per chain, so CDR and framework residues line up across candidates for comparison. It is optional and runs only on the selected panel. Heavily engineered scaffolds whose framework regions diverge too far from known germlines may not be numberable — the block reports that rather than failing.

### What if a score I want to rank on is missing?

Add the block that produces it upstream and re-run. Lead Selection ranks on what is in the project: enrichment from Enrichment Analysis, liabilities from Sequence Liabilities, humanness from Humanness Score, clusters from Sequence Clustering or Embedding Clustering, and so on.

## Documentation

Step-by-step guide: [Antibody Lead Selection](https://docs.platforma.bio/guides/antibody-discovery/lead-selection/)

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio/) by [MiLaboratories](https://github.com/milaboratory), and uses [ANARCI](https://github.com/oxpig/ANARCI) for Kabat numbering. Explore the other open-source blocks at [github.com/platforma-open](https://github.com/platforma-open) and the docs for antibody discovery at [docs.platforma.bio/biology-guides/antibody-discovery](https://docs.platforma.bio/biology-guides/antibody-discovery/).
