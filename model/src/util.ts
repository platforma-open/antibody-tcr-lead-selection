import {
  isLabelColumn,
  type AxisSpec,
  type PlRef,
  type RenderCtx,
  type RenderCtxLegacy,
  type SUniversalPColumnId,
} from '@platforma-sdk/model';
import type { AnchoredColumn, AnchoredColumnId, BlockArgs, BlockData, Columns, PlTableFiltersDefault, RankingOrder } from './types';

export function anchoredColumnId(anchoredColumn: AnchoredColumn): AnchoredColumnId {
  return { ...anchoredColumn, column: anchoredColumn.column.id as SUniversalPColumnId };
}

// Sentinel column ID for the computed In Vivo Score ranking
export const IN_VIVO_SCORE_COLUMN_ID = 'pl7.app/vdj/inVivoScore' as SUniversalPColumnId;

// SHM mutation columns that are replaced by In Vivo Score in ranking.
export const IN_VIVO_MUTATION_COLUMNS = new Set([
  'pl7.app/vdj/sequence/fractionCDRMutations',
  'pl7.app/vdj/sequence/nMutations',
  'pl7.app/vdj/sequence/nAAMutationsCDR',
  'pl7.app/vdj/sequence/nAAMutationsFWR',
]);

/**
 * Checks if two cluster axes match by comparing their domains.
 * Used to identify which specific cluster axis is being used.
 */
export function clusterAxisDomainsMatch(axis1: AxisSpec, axis2: AxisSpec): boolean {
  // Both must be clusterId axes
  if (axis1.name !== 'pl7.app/vdj/clusterId' || axis2.name !== 'pl7.app/vdj/clusterId') {
    return false;
  }

  // If either has no domain, they don't match (or both have no domain = match)
  if (!axis1.domain && !axis2.domain) return true;
  if (!axis1.domain || !axis2.domain) return false;

  // Compare all domain keys and values
  const keys1 = Object.keys(axis1.domain);
  const keys2 = Object.keys(axis2.domain);

  if (keys1.length !== keys2.length) return false;

  return keys1.every((key) => axis1.domain![key] === axis2.domain![key]);
}

/**
 * Determines which specific cluster axes should be visible based on filter/ranking column usage.
 * Returns an array of cluster axis specs that should be shown.
 *
 * @param allColumns - All columns in the table
 * @param filterColumnIds - Set of column IDs used in filters
 * @param rankingColumnIds - Set of column IDs used in rankings
 * @returns Array of cluster axes that should be visible
 */
export function getVisibleClusterAxes<T extends { id: unknown; spec: { axesSpec: AxisSpec[] } }>(
  allColumns: T[],
  filterColumnIds: Set<string>,
  rankingColumnIds: Set<string>,
): AxisSpec[] {
  const visibleClusterAxes: AxisSpec[] = [];

  for (const col of allColumns) {
    const colIdStr = col.id as string;
    const isFilterOrRankColumn = filterColumnIds.has(colIdStr) || rankingColumnIds.has(colIdStr);
    if (!isFilterOrRankColumn) continue;

    // Check each axis in this column
    for (const axis of col.spec.axesSpec) {
      if (axis.name === 'pl7.app/vdj/clusterId') {
        // Check if we already have a matching cluster axis
        const alreadyAdded = visibleClusterAxes.some((existingAxis) =>
          clusterAxisDomainsMatch(existingAxis, axis),
        );
        if (!alreadyAdded) {
          visibleClusterAxes.push(axis);
        }
      }
    }
  }

  return visibleClusterAxes;
}

export function getColumns(ctx: RenderCtx<BlockArgs, BlockData> | RenderCtxLegacy<BlockArgs, BlockData>, inputAnchor: PlRef | undefined): Columns | undefined {
  const anchor = inputAnchor;
  if (anchor === undefined)
    return undefined;

  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(anchor);
  if (anchorSpec === undefined)
    return undefined;

  // all clone properties
  const cloneProps = (ctx.resultPool.getAnchoredPColumns(
    { main: anchor },
    [
      {
        axes: [{ anchor: 'main', idx: 1 }],
      },
    ]) ?? [])
    .filter((p) =>
      p.spec.annotations?.['pl7.app/sequence/isAnnotation'] !== 'true',
    )
    .map((p) => ({ anchorRef: anchor, anchorName: 'main', column: p }));

  // links to use in table
  const links: AnchoredColumn[] = [];

  // linker columns
  const linkProps: AnchoredColumn[] = [];
  let i = 0;
  for (const idx of [0, 1]) {
    let axesToMatch;
    if (idx === 0) {
      // clonotypeKey in second axis
      axesToMatch = [{}, anchorSpec.axesSpec[1]];
    } else {
      // clonotypeKey in first axis
      axesToMatch = [anchorSpec.axesSpec[1], {}];
    }
    // save linkers to use in table
    links.push(...(ctx.resultPool.getAnchoredPColumns(
      { main: anchor },
      [
        {
          axes: axesToMatch,
          annotations: { 'pl7.app/isLinkerColumn': 'true' },
        },
      ],
    ) ?? []).map((c) => ({ anchorRef: anchor, anchorName: 'main', column: c })));

    // get linkers as PlRefs to use in the workflow
    const linkers = ctx.resultPool.getOptions([
      {
        axes: axesToMatch,
        annotations: { 'pl7.app/isLinkerColumn': 'true' },
      },
    ]);

    for (const link of linkers) {
      const anchorName = 'linker-' + i;
      const anchorSpec: Record<string, PlRef> = {};
      anchorSpec[anchorName] = link.ref;

      const props = ctx.resultPool.getAnchoredPColumns(
        anchorSpec,
        [
          {
            axes: [{ anchor: anchorName, idx: idx }],
          },
        ],
      ) ?? [];
      linkProps.push(...props
        .filter((p) => !isLabelColumn(p.spec))
        .map((p) => ({ anchorRef: link.ref, anchorName, column: p })));
      i++;
    }
  }

  // score columns
  const cloneScores = cloneProps?.filter((p) => p.column.spec.annotations?.['pl7.app/isScore'] === 'true');

  // links score columns
  const linkScores = linkProps?.filter((p) => p.column.spec.annotations?.['pl7.app/isScore'] === 'true');

  // calculate default filters
  const scores = [...cloneScores, ...linkScores];
  const defaultFilters: PlTableFiltersDefault[] = [];

  for (const score of scores) {
    const valueString = score.column.spec.annotations?.['pl7.app/score/defaultCutoff'];
    if (valueString === undefined) continue;

    const spec = score.column.spec;
    if (spec.valueType === 'String') {
      try {
        const value = JSON.parse(valueString) as string[];
        // should be an array of strings
        if (!Array.isArray(value)) {
          console.error('defaultFilters: invalid string filter', valueString);
          continue;
        }
        const isDiscreteFilter = spec.annotations?.['pl7.app/isDiscreteFilter'] === 'true';
        const hasDiscreteValues = !!spec.annotations?.['pl7.app/discreteValues'];
        if (isDiscreteFilter && hasDiscreteValues && value.length > 0) {
          // Multi-select: use string_in with all default cutoff values
          defaultFilters.push({
            column: anchoredColumnId(score),
            default: {
              type: 'string_in',
              reference: JSON.stringify(value),
            },
          });
        } else {
          defaultFilters.push({
            column: anchoredColumnId(score),
            default: {
              type: 'string_equals',
              reference: value[0],
            },
          });
        }
      } catch (e) {
        console.error('defaultFilters: invalid string filter', valueString, e);
        continue;
      }
    } else {
      try {
        // Assuming non-String valueType implies a number
        const numericValue = parseFloat(valueString);
        if (isNaN(numericValue)) {
          console.error('defaultFilters: invalid numeric value', valueString);
          continue;
        }

        const direction = spec.annotations?.['pl7.app/score/rankingOrder'] ?? 'increasing';
        if (direction !== 'increasing' && direction !== 'decreasing') {
          console.error('defaultFilters: invalid ranking order', direction);
          continue;
        }

        defaultFilters.push({
          column: anchoredColumnId(score),
          default: {
            type: direction === 'increasing' ? 'number_greaterThanOrEqualTo' : 'number_lessThanOrEqualTo',
            reference: numericValue,
          },
        });
      } catch (e) {
        console.error('defaultFilters: invalid numeric value', valueString, e);
        continue;
      }
    }
  }

  // Detect In Vivo Score availability: all SHM mutation columns present
  const hasInVivoScore = [...IN_VIVO_MUTATION_COLUMNS].every(
    (name) => scores.some((s) => s.column.spec.name === name),
  );

  // Detect enrichment score columns (pl7.app/vdj/enrichment, pl7.app/vdj/enrichmentQuality, etc.)
  const ENRICHMENT_COLUMN_PREFIX = 'pl7.app/vdj/enrichment';
  const isEnrichmentColumn = (name: string) => name.startsWith(ENRICHMENT_COLUMN_PREFIX);
  const hasEnrichmentScores = scores.some((s) => isEnrichmentColumn(s.column.spec.name));

  // Auto-detect preset based on available columns
  const detectedPreset = hasInVivoScore
    ? 'in-vivo' as const
    : hasEnrichmentScores
      ? 'in-vitro' as const
      : undefined;

  // Build default ranking, excluding mutation columns when In Vivo Score replaces them
  const defaultRankingOrder: RankingOrder[] = scores
    .filter((s) => s.column.spec.valueType !== 'String')
    .filter((s) => !hasInVivoScore || !IN_VIVO_MUTATION_COLUMNS.has(s.column.spec.name))
    .map((s) => ({
      id: `default-rank-${s.column.id}`,
      value: anchoredColumnId(s),
      rankingOrder: (s.column.spec.annotations?.['pl7.app/score/rankingOrder'] as 'increasing' | 'decreasing') ?? 'decreasing',
      isExpanded: false,
    }));

  if (hasInVivoScore) {
    defaultRankingOrder.unshift({
      value: {
        anchorRef: anchor,
        anchorName: 'main',
        column: IN_VIVO_SCORE_COLUMN_ID,
      },
      rankingOrder: 'decreasing',
    });
  }

  // In Vitro defaults: annotation-driven defaults, excluding mutation columns
  const inVitroRankingOrder = scores
    .filter((s) => s.column.spec.valueType !== 'String')
    .filter((s) => !IN_VIVO_MUTATION_COLUMNS.has(s.column.spec.name))
    .map((s) => ({
      value: anchoredColumnId(s),
      rankingOrder: (s.column.spec.annotations?.['pl7.app/score/rankingOrder'] as 'increasing' | 'decreasing') ?? 'decreasing',
    }));

  const inVitroDefaults = {
    rankingOrder: inVitroRankingOrder,
    filters: defaultFilters,
  };

  // In Vivo defaults: In Vivo Score ranking + extra mutation filters
  const inVivoFilters: PlTableFiltersDefault[] = [...defaultFilters];

  // Add fractionCDRMutations > 0.5 filter if column exists
  const fractionCDRMutationsCol = scores.find(
    (s) => s.column.spec.name === 'pl7.app/vdj/sequence/fractionCDRMutations',
  );
  if (fractionCDRMutationsCol) {
    inVivoFilters.push({
      column: anchoredColumnId(fractionCDRMutationsCol),
      default: {
        type: 'number_greaterThan',
        reference: 0.5,
      },
    });
  }

  // Add nMutations >= 3 filter if column exists
  const nMutationsCol = scores.find(
    (s) => s.column.spec.name === 'pl7.app/vdj/sequence/nMutations',
  );
  if (nMutationsCol) {
    inVivoFilters.push({
      column: anchoredColumnId(nMutationsCol),
      default: {
        type: 'number_greaterThanOrEqualTo',
        reference: 3,
      },
    });
  }

  // Collect enrichment column IDs to exclude from in-vivo defaults
  const enrichmentColumnIds = new Set(
    scores
      .filter((s) => isEnrichmentColumn(s.column.spec.name))
      .map((s) => anchoredColumnId(s).column),
  );

  const inVivoDefaults = {
    rankingOrder: defaultRankingOrder.filter((r) => {
      const col = r.value?.column;
      return col === IN_VIVO_SCORE_COLUMN_ID || (col !== undefined && !enrichmentColumnIds.has(col));
    }),
    filters: inVivoFilters.filter((f) => !enrichmentColumnIds.has(f.column.column)),
  };

  return {
    props: [...links, ...cloneProps, ...linkProps],
    scores: scores,
    defaultFilters: defaultFilters,
    defaultRankingOrder,
    hasInVivoScore,
    hasEnrichmentScores,
    detectedPreset,
    inVivoDefaults,
    inVitroDefaults,
  };
}

export function getDefaultBlockLabel(data: {
  datasetLabel?: string;
}) {
  return data.datasetLabel || 'Select dataset';
}
