import {
  ColumnCollectionBuilder,
  type AnchoredColumnCollection,
  type AxisSpec,
  type ColumnMatch,
  type PlRef,
  type RenderCtx,
  type SUniversalPColumnId,
} from '@platforma-sdk/model';
import type { AnchoredColumnId, BlockArgs, BlockData, ColumnsMeta, PlTableFiltersDefault, RankingOrder } from './types';

/** Converts a ColumnMatch to an AnchoredColumnId for the workflow wire format. */
export function matchToColumnId(match: ColumnMatch, anchorRef: PlRef): AnchoredColumnId {
  return { anchorRef, anchorName: 'main', column: match.column.id };
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
  if (axis1.name !== 'pl7.app/vdj/clusterId' || axis2.name !== 'pl7.app/vdj/clusterId') {
    return false;
  }

  if (!axis1.domain && !axis2.domain) return true;
  if (!axis1.domain || !axis2.domain) return false;

  const keys1 = Object.keys(axis1.domain);
  const keys2 = Object.keys(axis2.domain);

  if (keys1.length !== keys2.length) return false;

  return keys1.every((key) => axis1.domain![key] === axis2.domain![key]);
}

/**
 * Determines which specific cluster axes should be visible based on filter/ranking column usage.
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

    for (const axis of col.spec.axesSpec) {
      if (axis.name === 'pl7.app/vdj/clusterId') {
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

/**
 * Builds an AnchoredColumnCollection from the result pool and computes column metadata
 * (scores, defaults, presets). Replaces the old getColumns() function.
 */
export function buildCollection(
  ctx: RenderCtx<BlockArgs, BlockData>,
  inputAnchor: PlRef | undefined,
): { collection: AnchoredColumnCollection; meta: ColumnsMeta } | undefined {
  if (!inputAnchor) return undefined;

  const anchorSpec = ctx.resultPool.getPColumnSpecByRef(inputAnchor);
  if (!anchorSpec) return undefined;

  // Exclude columns unsupported by the WASM spec frame:
  // - File value type is not recognized
  // - Linker columns with >2 axes have >2 connected components, which the spec frame rejects
  const resultPoolColumns = ctx.resultPool.selectColumns(
    (spec) => (spec.valueType as string) !== 'File'
      && !(spec.annotations?.['pl7.app/isLinkerColumn'] === 'true' && spec.axesSpec.length > 2),
  );
  // Use full 2-axis anchor for ID derivation (so IDs match the workflow's anchor mapping).
  // Override trunk to clonotypeKey only — limits discovery to clonotypeKey-related columns.
  const builder = new ColumnCollectionBuilder(ctx.services.pframeSpec)
    .addSource(resultPoolColumns);
  const collection = builder.build({
    anchors: { main: anchorSpec },
    trunkAxes: [[anchorSpec.axesSpec[1]]],
  });
  if (!collection) return undefined;

  // Discover all enrichment-compatible columns keyed by clonotypeKey.
  // The 'enrichment' mode ensures only columns whose axes are satisfiable
  // by the trunk (clonotypeKey) — directly or via linker traversal — are returned.
  const allMatches = collection.findColumns({
    mode: 'related',
    exclude: [{ annotations: { 'pl7.app/sequence/isAnnotation': 'true' } }],
    maxHops: 2,
  });

  // Extract scores
  const scores = allMatches.filter(
    (m) => m.column.spec.annotations?.['pl7.app/isScore'] === 'true',
  );

  // Compute defaults and presets
  const defaultFilters = computeDefaultFilters(scores, inputAnchor);
  const presets = computePresets(scores, defaultFilters, inputAnchor);

  return {
    collection,
    meta: {
      allMatches,
      scores,
      defaultFilters,
      ...presets,
    },
  };
}

function computeDefaultFilters(scores: ColumnMatch[], anchorRef: PlRef): PlTableFiltersDefault[] {
  const defaultFilters: PlTableFiltersDefault[] = [];

  for (const score of scores) {
    const valueString = score.column.spec.annotations?.['pl7.app/score/defaultCutoff'];
    if (valueString === undefined) continue;

    const spec = score.column.spec;
    if (spec.valueType === 'String') {
      try {
        const value = JSON.parse(valueString) as string[];
        if (!Array.isArray(value)) {
          // invalid string filter — skip silently (console unavailable in model sandbox)
          continue;
        }
        const isDiscreteFilter = spec.annotations?.['pl7.app/isDiscreteFilter'] === 'true';
        const hasDiscreteValues = !!spec.annotations?.['pl7.app/discreteValues'];
        if (isDiscreteFilter && hasDiscreteValues && value.length > 0) {
          defaultFilters.push({
            column: matchToColumnId(score, anchorRef),
            default: { type: 'string_in', reference: JSON.stringify(value) },
          });
        } else {
          defaultFilters.push({
            column: matchToColumnId(score, anchorRef),
            default: { type: 'string_equals', reference: value[0] },
          });
        }
      } catch (_e) {
        // invalid string filter — skip silently (console unavailable in model sandbox)
        continue;
      }
    } else {
      try {
        // Assuming non-String valueType implies a number
        const numericValue = parseFloat(valueString);
        if (isNaN(numericValue)) {
          // invalid numeric value — skip silently (console unavailable in model sandbox)
          continue;
        }

        const direction = spec.annotations?.['pl7.app/score/rankingOrder'] ?? 'increasing';
        if (direction !== 'increasing' && direction !== 'decreasing') {
          // invalid ranking order — skip silently (console unavailable in model sandbox)
          continue;
        }

        defaultFilters.push({
          column: matchToColumnId(score, anchorRef),
          default: {
            type: direction === 'increasing' ? 'number_greaterThanOrEqualTo' : 'number_lessThanOrEqualTo',
            reference: numericValue,
          },
        });
      } catch (_e) {
        // invalid numeric value — skip silently (console unavailable in model sandbox)
        continue;
      }
    }
  }

function computePresets(
  scores: ColumnMatch[],
  defaultFilters: PlTableFiltersDefault[],
  anchorRef: PlRef,
): Omit<ColumnsMeta, 'allMatches' | 'scores' | 'defaultFilters'> {
  const hasInVivoScore = [...IN_VIVO_MUTATION_COLUMNS].every(
    (name) => scores.some((s) => s.column.spec.name === name),
  );

  const ENRICHMENT_COLUMN_PREFIX = 'pl7.app/vdj/enrichment';
  const isEnrichmentColumn = (name: string) => name.startsWith(ENRICHMENT_COLUMN_PREFIX);
  const hasEnrichmentScores = scores.some((s) => isEnrichmentColumn(s.column.spec.name));

  const detectedPreset = hasInVivoScore
    ? 'in-vivo' as const
    : hasEnrichmentScores
      ? 'in-vitro' as const
      : undefined;

  // Default ranking: all non-String scores, excluding mutation columns when In Vivo Score replaces them
  const defaultRankingOrder: RankingOrder[] = scores
    .filter((s) => s.column.spec.valueType !== 'String')
    .filter((s) => !hasInVivoScore || !IN_VIVO_MUTATION_COLUMNS.has(s.column.spec.name))
    .map((s) => ({
      id: `default-rank-${s.column.id}`,
      value: matchToColumnId(s, anchorRef),
      rankingOrder: (s.column.spec.annotations?.['pl7.app/score/rankingOrder'] as 'increasing' | 'decreasing') ?? 'decreasing',
      isExpanded: false,
    }));

  if (hasInVivoScore) {
    defaultRankingOrder.unshift({
      value: { anchorRef, anchorName: 'main', column: IN_VIVO_SCORE_COLUMN_ID },
      rankingOrder: 'decreasing',
    });
  }

  // In Vitro defaults
  const inVitroRankingOrder = scores
    .filter((s) => s.column.spec.valueType !== 'String')
    .filter((s) => !IN_VIVO_MUTATION_COLUMNS.has(s.column.spec.name))
    .map((s) => ({
      value: matchToColumnId(s, anchorRef),
      rankingOrder: (s.column.spec.annotations?.['pl7.app/score/rankingOrder'] as 'increasing' | 'decreasing') ?? 'decreasing',
    }));

  const inVitroDefaults = {
    rankingOrder: inVitroRankingOrder,
    filters: defaultFilters,
  };

  // In Vivo defaults: In Vivo Score ranking + extra mutation filters
  const inVivoFilters: PlTableFiltersDefault[] = [...defaultFilters];

  const fractionCDRMutationsCol = scores.find(
    (s) => s.column.spec.name === 'pl7.app/vdj/sequence/fractionCDRMutations',
  );
  if (fractionCDRMutationsCol) {
    inVivoFilters.push({
      column: matchToColumnId(fractionCDRMutationsCol, anchorRef),
      default: { type: 'number_greaterThan', reference: 0.5 },
    });
  }

  const nMutationsCol = scores.find(
    (s) => s.column.spec.name === 'pl7.app/vdj/sequence/nMutations',
  );
  if (nMutationsCol) {
    inVivoFilters.push({
      column: matchToColumnId(nMutationsCol, anchorRef),
      default: { type: 'number_greaterThanOrEqualTo', reference: 3 },
    });
  }

  const enrichmentColumnIds = new Set(
    scores
      .filter((s) => isEnrichmentColumn(s.column.spec.name))
      .map((s) => matchToColumnId(s, anchorRef).column),
  );

  const inVivoDefaults = {
    rankingOrder: defaultRankingOrder.filter((r) => {
      const col = r.value?.column;
      return col === IN_VIVO_SCORE_COLUMN_ID || (col !== undefined && !enrichmentColumnIds.has(col));
    }),
    filters: inVivoFilters.filter((f) => !enrichmentColumnIds.has(f.column.column)),
  };

  return {
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
