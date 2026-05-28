import {
  Annotation,
  Column,
  ColumnsCollection,
  createGlobalPObjectId,
  type AxisSpec,
  type ColumnRecipe,
  type ColumnsCollection as ColumnsCollectionType,
  type ColumnUniversalId,
  type PColumnSpec,
  type PlRef,
  type RelaxedColumnSelector,
  type RenderCtx,
} from '@platforma-sdk/model';
import type { BlockArgs, BlockData, ColumnsMeta, PlTableFiltersDefault, RankingOrder, ScopedColumnId, WorkflowPreset } from './types';

/** Underlying primary `PlRef` from `data.input` — undefined when no dataset is picked.
 *  Kept for callers that still need a `PlRef` (e.g. `buildDatasetOptions` consumers). */
export function getInputAnchorRef(data: Pick<BlockData, 'input'>): PlRef | undefined {
  return data.input?.primary.column;
}

/** Canonical `ColumnUniversalId` for the primary anchor — derived from the
 *  underlying result-pool leaf `PlRef`. Returns `undefined` when no dataset is picked. */
export function getInputAnchorId(data: Pick<BlockData, 'input'>): ColumnUniversalId | undefined {
  const ref = data.input?.primary.column;
  return ref !== undefined ? createGlobalPObjectId(ref.blockId, ref.name) : undefined;
}

/** Canonical `ColumnUniversalId` for the optional filter column picked alongside
 *  the primary in `PlDatasetSelector`. */
export function getInputFilterId(data: Pick<BlockData, 'input'>): ColumnUniversalId | undefined {
  const ref = data.input?.primary.filter;
  return ref !== undefined ? createGlobalPObjectId(ref.blockId, ref.name) : undefined;
}

/** Common exclude selectors shared across filter/rank/table discovery.
 *  These run host-side — `commonExcludeSelectors` covers everything that can be
 *  expressed as a selector. The sample-axis exclude depends on the anchor's
 *  runtime sampleId axis name, so it is computed per-anchor inside
 *  `buildCollection`, not baked into this static list.
 *
 *  Replaces the legacy JS-side `isSelectableMatch` post-filter:
 *  - linker columns and sequence annotations excluded by annotation key,
 *  - cluster-id mapping columns excluded by name (both prefixed / unprefixed),
 *  - `pl7.app/label` excluded by exact name,
 *  - self-trace excluded via `pl7.app/trace` regex. */
export const commonExcludeSelectors: RelaxedColumnSelector[] = [
  { annotations: { 'pl7.app/isLinkerColumn': 'true' } },
  { annotations: { 'pl7.app/sequence/isAnnotation': 'true' } },
  // cluster-id mapping columns — both unprefixed (post-peptide-adaptation) and
  // `pl7.app/vdj/`-prefixed (pre-peptide). Selector values are regex strings;
  // `.` and `/` are escaped so the literal name matches.
  { name: [{ type: 'exact', value: 'pl7.app/clusterId' }, { type: 'exact', value: 'pl7.app/vdj/clusterId' }] },
  // label columns
  { name: [{ type: 'exact', value: 'pl7.app/label' }] },
  // self-trace — columns produced by this block carry this trace fragment.
  { annotations: { [Annotation.Trace]: '.*antibody-tcr-lead-selection.*' } },
];

/** Cluster-id axis / column names. Both unprefixed (post-peptide-adaptation)
 *  and `pl7.app/vdj/`-prefixed (pre-peptide) names are recognized so older
 *  clonotype-clustering instances remain selectable. */
export const CLUSTER_ID_AXIS_NAMES: ReadonlySet<string> = new Set([
  'pl7.app/clusterId',
  'pl7.app/vdj/clusterId',
]);
export const isClusterIdAxisName = (name: string): boolean => CLUSTER_ID_AXIS_NAMES.has(name);

/** Converts a `ColumnRecipe` to a `ScopedColumnId` for the workflow wire format. */
export function recipeToColumnId(recipe: ColumnRecipe, anchorRef: ColumnUniversalId): ScopedColumnId {
  return { anchorRef, anchorName: 'main', column: recipe.id };
}

// Sentinel column ID for the computed In Vivo Score ranking
export const IN_VIVO_SCORE_COLUMN_ID = 'pl7.app/vdj/inVivoScore' as ColumnUniversalId;

// SHM mutation columns that are replaced by In Vivo Score in ranking.
export const IN_VIVO_MUTATION_COLUMNS = new Set([
  'pl7.app/vdj/sequence/fractionCDRMutations',
  'pl7.app/vdj/sequence/nMutations',
  'pl7.app/vdj/sequence/nAAMutationsCDR',
  'pl7.app/vdj/sequence/nAAMutationsFWR',
]);

// In Vivo preset allowlist: only score columns whose spec.name is in this set
// can contribute discovery-driven defaults to the in-vivo filter list.
// Mutation cutoffs (fractionCDRMutations, nMutations) are added separately with
// preset-specific overrides.
// Both unprefixed (post-peptide-adaptation) and `pl7.app/vdj/` (pre-peptide)
// spec names are listed so projects using either upstream block version still
// get defaults.
export const IN_VIVO_FILTER_SPEC_NAMES = new Set([
  'pl7.app/vdj/isProductive',
  'pl7.app/developabilityRisk',
  'pl7.app/vdj/developabilityRisk',
]);

// In Vivo preset allowlist for ranking. The In Vivo Score sentinel is added
// separately when mutation columns are present.
export const IN_VIVO_RANKING_SPEC_NAMES = new Set([
  'pl7.app/developabilityScore',
  'pl7.app/vdj/developabilityScore',
]);

// In Vitro preset allowlists. Same intersection-with-discovery approach as
// in-vivo: only score columns with these spec names contribute defaults, so
// new upstream score columns can't bloat the preset. Max Log2FC and Overall
// Log2FC share the spec name `pl7.app/enrichment` — only Max carries
// isScore=true upstream, so the discovery pipeline already excludes Overall.
// Both unprefixed (post-peptide-adaptation) and `pl7.app/vdj/` (pre-peptide)
// spec names are listed so projects using either upstream block version still
// get defaults.
export const IN_VITRO_FILTER_SPEC_NAMES = new Set([
  'pl7.app/vdj/isProductive',
  'pl7.app/developabilityRisk',
  'pl7.app/vdj/developabilityRisk',
  'pl7.app/enrichmentQuality',
  'pl7.app/vdj/enrichmentQuality',
  'pl7.app/vdj/bindingSpecificity',
  'pl7.app/enrichment',
  'pl7.app/vdj/enrichment',
]);

export const IN_VITRO_RANKING_SPEC_NAMES = new Set([
  'pl7.app/developabilityScore',
  'pl7.app/vdj/developabilityScore',
  'pl7.app/enrichment',
  'pl7.app/vdj/enrichment',
]);

/**
 * Checks if two cluster axes match by comparing their domains.
 * Used to identify which specific cluster axis is being used.
 */
export function clusterAxisDomainsMatch(axis1: AxisSpec, axis2: AxisSpec): boolean {
  // Two axes from different clustering-block versions (one prefixed, one not)
  // can never refer to the same clustering run, so require the names to be
  // identical and both be cluster-id axes.
  if (axis1.name !== axis2.name || !isClusterIdAxisName(axis1.name)) {
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
      if (isClusterIdAxisName(axis.name)) {
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
 * Discovers all columns related to the input anchor in the result pool and
 * computes column metadata (scores, defaults, presets).
 *
 * The returned `collection` is the same `ColumnsCollection` that produced
 * `allMatches` — callers can chain further `.discover` / `.filter` calls
 * against it without re-running the anchor + exclude pipeline.
 */
export function buildCollection(
  ctx: RenderCtx<BlockArgs, BlockData>,
  inputAnchor: ColumnUniversalId | undefined,
): { collection: ColumnsCollectionType; meta: ColumnsMeta; sampleAxisName: string; anchorSpec: PColumnSpec } | undefined {
  if (!inputAnchor) return undefined;

  const anchorSpec = Column(inputAnchor)?.getSpec();
  if (!anchorSpec) return undefined;

  const sampleAxisName = anchorSpec.axesSpec[0].name;

  // Push every selector-expressible exclusion into the host-side `exclude` list:
  // - shared `commonExcludeSelectors` (linker, sequence-annotation, cluster-id mapping, label, self-trace),
  // - sample-axis exclusion derived from the runtime anchor sampleId axis name.
  const exclude: RelaxedColumnSelector[] = [
    ...commonExcludeSelectors,
    { axes: [{ name: [{ type: 'exact', value: sampleAxisName }] }], partialAxesMatch: true },
  ];

  const collection = ColumnsCollection(['result_pool'])
    .discover({
      anchors: { main: anchorSpec },
      mode: 'related',
      maxHops: 2,
      exclude,
    });

  const allMatches = collection.getColumns();

  // Score columns — `pl7.app/isScore` annotation. This requires `getSpec()` per
  // survivor, but the upstream `exclude` has already narrowed the set drastically.
  const scores = allMatches.filter(
    (m) => m.getSpec().annotations?.['pl7.app/isScore'] === 'true',
  );

  // Compute defaults and presets
  const defaultFilters = computeDefaultFilters(scores, inputAnchor);
  const presets = computePresets(scores, defaultFilters, inputAnchor, anchorSpec);

  return {
    collection,
    sampleAxisName,
    anchorSpec,
    meta: {
      allMatches,
      scores,
      defaultFilters,
      ...presets,
    },
  };
}

function computeDefaultFilters(scores: ColumnRecipe[], anchorRef: ColumnUniversalId): PlTableFiltersDefault[] {
  const defaultFilters: PlTableFiltersDefault[] = [];

  for (const score of scores) {
    const spec = score.getSpec();
    const valueString = spec.annotations?.['pl7.app/score/defaultCutoff'];
    if (valueString === undefined) continue;

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
            column: recipeToColumnId(score, anchorRef),
            default: { type: 'string_in', reference: JSON.stringify(value) },
          });
        } else {
          defaultFilters.push({
            column: recipeToColumnId(score, anchorRef),
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
          column: recipeToColumnId(score, anchorRef),
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

  return defaultFilters;
}

function computePresets(
  scores: ColumnRecipe[],
  defaultFilters: PlTableFiltersDefault[],
  anchorRef: ColumnUniversalId,
  anchorSpec: PColumnSpec,
): Omit<ColumnsMeta, 'allMatches' | 'scores' | 'defaultFilters'> {
  const isPeptide = anchorSpec.axesSpec[1]?.name === 'pl7.app/variantKey';

  // Memoise getSpec() per score recipe — `hasInVivoScore`, `hasEnrichmentScores`
  // and the per-preset filter/ranking passes below all read the same spec.
  const scoreSpecs = scores.map((s) => ({ recipe: s, spec: s.getSpec() }));

  const hasInVivoScore = [...IN_VIVO_MUTATION_COLUMNS].every(
    (name) => scoreSpecs.some(({ spec }) => spec.name === name),
  );

  const isEnrichmentColumn = (name: string) => name.startsWith('pl7.app/enrichment') || name.startsWith('pl7.app/vdj/enrichment');
  const hasEnrichmentScores = scoreSpecs.some(({ spec }) => isEnrichmentColumn(spec.name));

  // Peptide anchors always auto-select the peptide preset, regardless of which
  // score columns are upstream.
  const detectedPreset: WorkflowPreset | undefined = isPeptide
    ? 'peptide'
    : hasInVivoScore
      ? 'in-vivo'
      : hasEnrichmentScores
        ? 'in-vitro'
        : undefined;

  // Default ranking: all non-String scores, excluding mutation columns when In Vivo Score replaces them
  const defaultRankingOrder: RankingOrder[] = scoreSpecs
    .filter(({ spec }) => spec.valueType !== 'String')
    .filter(({ spec }) => !hasInVivoScore || !IN_VIVO_MUTATION_COLUMNS.has(spec.name))
    .map(({ recipe, spec }) => ({
      id: `default-rank-${recipe.id}`,
      value: recipeToColumnId(recipe, anchorRef),
      rankingOrder: (spec.annotations?.['pl7.app/score/rankingOrder'] as 'increasing' | 'decreasing') ?? 'decreasing',
      isExpanded: false,
    }));

  if (hasInVivoScore) {
    defaultRankingOrder.unshift({
      value: { anchorRef, anchorName: 'main', column: IN_VIVO_SCORE_COLUMN_ID },
      rankingOrder: 'decreasing',
    });
  }

  // Both presets intersect discovery-driven defaults with a per-preset
  // allowlist of spec names, so new upstream score columns can't bloat them.
  const specNameByColumnId = new Map<ColumnUniversalId, string>(
    scoreSpecs.map(({ recipe, spec }) => [recipeToColumnId(recipe, anchorRef).column, spec.name]),
  );

  // In Vitro defaults
  const inVitroFilters: PlTableFiltersDefault[] = defaultFilters.filter((f) => {
    const specName = specNameByColumnId.get(f.column.column);
    return specName !== undefined && IN_VITRO_FILTER_SPEC_NAMES.has(specName);
  });

  const inVitroRankingOrder: RankingOrder[] = defaultRankingOrder.filter((r) => {
    const col = r.value?.column;
    if (col === undefined) return false;
    const specName = specNameByColumnId.get(col);
    return specName !== undefined && IN_VITRO_RANKING_SPEC_NAMES.has(specName);
  });

  const inVitroDefaults = {
    rankingOrder: inVitroRankingOrder,
    filters: inVitroFilters,
  };

  // In Vivo defaults: allowlist + explicit mutation filters with
  // preset-specific cutoffs.
  const inVivoFilters: PlTableFiltersDefault[] = defaultFilters.filter((f) => {
    const specName = specNameByColumnId.get(f.column.column);
    return specName !== undefined && IN_VIVO_FILTER_SPEC_NAMES.has(specName);
  });

  const fractionCDRMutationsCol = scoreSpecs.find(
    ({ spec }) => spec.name === 'pl7.app/vdj/sequence/fractionCDRMutations',
  );
  if (fractionCDRMutationsCol) {
    inVivoFilters.push({
      column: recipeToColumnId(fractionCDRMutationsCol.recipe, anchorRef),
      default: { type: 'number_greaterThan', reference: 0.5 },
    });
  }

  const nMutationsCol = scoreSpecs.find(
    ({ spec }) => spec.name === 'pl7.app/vdj/sequence/nMutations',
  );
  if (nMutationsCol) {
    inVivoFilters.push({
      column: recipeToColumnId(nMutationsCol.recipe, anchorRef),
      default: { type: 'number_greaterThanOrEqualTo', reference: 3 },
    });
  }

  const inVivoRankingOrder: RankingOrder[] = defaultRankingOrder.filter((r) => {
    const col = r.value?.column;
    if (col === IN_VIVO_SCORE_COLUMN_ID) return true;
    if (col === undefined) return false;
    const specName = specNameByColumnId.get(col);
    return specName !== undefined && IN_VIVO_RANKING_SPEC_NAMES.has(specName);
  });

  const inVivoDefaults = {
    rankingOrder: inVivoRankingOrder,
    filters: inVivoFilters,
  };

  // Peptide defaults: all numeric score columns; no SHM exclusions.
  const inPeptideDefaults = {
    rankingOrder: scoreSpecs
      .filter(({ spec }) => spec.valueType !== 'String')
      .map(({ recipe, spec }) => ({
        value: recipeToColumnId(recipe, anchorRef),
        rankingOrder: (spec.annotations?.['pl7.app/score/rankingOrder'] as 'increasing' | 'decreasing') ?? 'decreasing',
      })),
    filters: defaultFilters,
  };

  return {
    defaultRankingOrder,
    hasInVivoScore,
    hasEnrichmentScores,
    detectedPreset,
    inVivoDefaults,
    inVitroDefaults,
    inPeptideDefaults,
  };
}

export function getDefaultBlockLabel(data: {
  datasetLabel?: string;
}) {
  return data.datasetLabel || 'Select dataset';
}
