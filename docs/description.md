# Overview

Ranks and selects top antibody or T-cell receptor (TCR) lead candidates from clonotype data based on configurable scoring metrics and filters to prioritize the most promising candidates for downstream characterization and development. The block compiles calculated scores from upstream analysis blocks (e.g., enrichment scores, differential abundance, pairing scores, sequence liabilities) into a comprehensive table and enables multi-criteria ranking to identify optimal lead candidates.

The block first filters candidates using threshold-based criteria on any score column, then ranks the filtered candidates based on multiple scoring metrics with configurable priority order and direction (increasing or decreasing). The ranking behavior adapts based on available cluster data and user configuration:

* When cluster information is unavailable or cluster ranking is explicitly disabled, candidates are ranked directly by clonotype properties and the top N are selected.
* When cluster data is available but cluster properties are not included in the ranking criteria, the block uses backward-compatible cluster size ranking where clusters are sorted by size (largest first), then within each cluster candidates are sorted by clonotype properties.
* When cluster properties are included in the ranking criteria, candidates are ranked by cluster properties first, then by clonotype properties, enabling sophisticated multi-level ranking strategies.

In modes with cluster data, selection uses round-robin sampling across clusters to ensure diversity while respecting the ranking order. When multiple cluster columns are available from different upstream clustering blocks, users can specify which cluster column to use for sampling.

The block provides interactive visualizations including clonotype space UMAP plots, CDR3 spectratype distributions, and V/J gene usage patterns to help evaluate and compare selected leads, streamlining the lead selection process by consolidating multiple data sources and enabling data-driven prioritization of candidates for further experimental validation.
