# Antibody & TCR Lead Selection

Select and rank the most promising antibody or TCR candidates from
sequencing data — combining abundance, somatic hypermutation quality, and
sequence liabilities to pick a diverse, developable lead panel rather than a
redundant Top-N list.

Open-source analysis block for **Platforma**, the no-code antibody and TCR
discovery platform by **MiLaboratories** — built on **MiXCR**, the
open-source immune-repertoire toolkit. For the full no-code workflow, see
[platforma.bio](https://platforma.bio).

## What it does

Lead Selection is the final decision step in the Platforma antibody discovery
workflow. It takes annotated clonotypes and produces a ranked, diversified
panel of candidates to advance — automating the call that scientists
otherwise make by hand in spreadsheets.

Rather than ranking by sequence abundance alone, it selects the best
representative from each clonal family and ranks on the full evidence, so the
final panel is structurally diverse instead of a set of near-identical clones.

## Inputs & outputs

- **Input:** annotated clonotypes from a Platforma MiXCR workflow, with
  abundance, somatic-hypermutation, enrichment, and/or liability data
- **Output:** a ranked, diversified antibody/TCR lead panel

## How ranking works

Every ranking and diversification rule is visible and controllable in the
interface — no hidden defaults or backend-only logic. Candidates are ranked on
the criteria you choose, then diversified across clonal families so the top of
the list isn't dominated by one lineage. For in-vivo campaigns, a composite
score combines clonal abundance, overall mutation level, and the proportion of
mutations focused in the CDRs into a single default ranking.

## Usage

It supports two workflows out of the box:

- **In vivo** (immunization campaigns): ranks candidates using somatic
  hypermutation evidence — clones with CDR-focused mutations, which signal
  affinity maturation, over framework-heavy mutations, which signal structural
  risk — combined with clonal expansion into a single composite score.
- **In vitro** (display / panning campaigns): ranks candidates by enrichment
  across selection rounds, developability, and affinity.

## Documentation

Full guide: [docs.platforma.bio/guides/antibody-discovery/lead-selection](https://docs.platforma.bio/guides/antibody-discovery/lead-selection/)

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio) by
[MiLaboratories](https://github.com/milaboratory), the team behind
[MiXCR](https://github.com/milaboratory/mixcr). Explore the other open-source
blocks at [github.com/platforma-open](https://github.com/platforma-open) and
the docs for antibody discovery at [https://docs.platforma.bio/biology-guides/antibody-discovery/](https://docs.platforma.bio/biology-guides/antibody-discovery/)
