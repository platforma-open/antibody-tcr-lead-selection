# Overview

Ranks and selects top antibody or T-cell receptor (TCR) lead candidates from clonotype data using configurable scoring metrics, filters, and diversified ranking to prioritize the most promising candidates for downstream characterization and development. The block compiles calculated scores from upstream analysis blocks (e.g., enrichment scores, differential abundance, pairing scores, sequence liabilities) into a comprehensive table and enables multi-criteria ranking to identify optimal lead candidates.

## Workflow presets

The block offers built-in presets for common discovery workflows:

* **In Vivo (immunization/infection):** Ranks candidates by In Vivo Score, a composite metric calculated from clonal expansion, CDR mutation frequency, and germinal center selection signals. Applies default filters on mutation-related metrics (e.g., fraction of CDR mutations, total number of mutations) to focus on immune-refined candidates.
* **In Vitro (display/panning):** Ranks candidates by enrichment scores across selection rounds to identify clones selected for target binding.

Presets configure default filters and ranking criteria that can be further customized by the user.

## Filtering and ranking

The block first filters candidates using threshold-based criteria on any score column, then ranks the filtered candidates based on multiple scoring metrics with configurable priority order and direction (increasing or decreasing).

## Diversified ranking

The ranking behavior adapts based on available cluster data and user configuration:

* When cluster information is unavailable or diversification is explicitly disabled, candidates are ranked directly by clonotype properties and the top N are selected.
* When cluster data is available, diversified ranking is applied across clusters to ensure diversity in the selected panel while respecting the ranking order.
* When multiple cluster columns are available from different upstream clustering blocks, users can specify which cluster column to use for diversification.

## Visualizations

The block provides interactive visualizations including clonotype space UMAP plots, CDR3 spectratype distributions, and V/J gene usage patterns to help evaluate and compare selected leads, streamlining the lead selection process by consolidating multiple data sources and enabling data-driven prioritization of candidates for further experimental validation.
