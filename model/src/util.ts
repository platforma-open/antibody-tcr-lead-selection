import {
  Annotation,
  Column,
  ColumnsCollection,
  createGlobalPObjectId,
  DataColumn,
  extractPObjectId,
  getAxisId,
  isGlobalPObjectId,
  matchAxisId,
  readAnnotationJson,
  type AxisSpec,
  type ColumnRecipe,
  type PColumnSpec,
  type PlRef,
  type PObjectId,
  type RelaxedColumnSelector,
} from "@platforma-sdk/model";
import type {
  BlockData,
  ColumnsMeta,
  InitializedForAnchor,
  PlTableFiltersDefault,
  RankingOrder,
  ScopedColumnId,
  WorkflowPreset,
} from "./types";

/**
 * The canonical column identifier for an anchor, as the defaults-init guard
 * stores it.
 *
 * The single place it is minted: the UI computes the current key with it and the
 * `Ver_2026_08_20` migration rewrites stored values with it, so the two can never
 * disagree on bytes for the same anchor — which they would if one used
 * `JSON.stringify` and the other canonicalized, and which matters because
 * relocation re-emits the stored value canonically when a template is applied.
 *
 * `createGlobalPObjectId` is the SDK's named constructor for this id form, and it
 * takes the two fields rather than the object: an oddly-ordered `PlRef` cannot
 * leak its key order in, and stray fields on the ref — `requireEnrichments`, say,
 * which does not change which column is meant — cannot reach the id. The
 * narrowing is what keeps this cast-free; the constructor always produces the
 * global form, so the `undefined` branch is unreachable in practice.
 */
export function anchorInitializedId(ref: PlRef): InitializedForAnchor["anchor"] | undefined {
  const id = createGlobalPObjectId(ref.blockId, ref.name);
  return isGlobalPObjectId(id) ? id : undefined;
}

/** Underlying primary `PlRef` from `data.input` — undefined when no dataset is picked. */
export function getInputAnchorRef(data: Pick<BlockData, "input">): PlRef | undefined {
  return data.input?.primary.column;
}

/** Optional filter `PlRef` the user picked alongside the primary in `PlDatasetSelector`. */
export function getInputFilterRef(data: Pick<BlockData, "input">): PlRef | undefined {
  return data.input?.primary.filter;
}

/** Exact-match string matcher for a column/axis selector value. */
export const exactMatch = (value: string) => [{ type: "exact" as const, value }];

/**
 * Spec behind a `PlRef`, or undefined when there is nothing to render from.
 *
 * A missing column is a normal state for this block, not an error: it works with
 * whatever the upstream graph happens to provide and ignores the rest. So all
 * three resolution statuses collapse to "render nothing" here.
 *
 * `Column(ref)` already returns undefined while a column is still resolving; the
 * guard exists only for the `absent` status, where it throws `ColumnAbsentError`
 * instead. Guarding on the status rather than catching keeps exceptions out of
 * the control flow — and note `absent` is not the definitive "gone for good" its
 * name suggests: it shows up in perfectly normal configurations, so it must stay
 * silent rather than drive any user-facing warning.
 */
export function getSpecByRef(ref: PlRef | undefined): PColumnSpec | undefined {
  if (ref === undefined || DataColumn.getStatusByPlRef(ref) === "absent") return undefined;
  return Column(ref)?.getSpec();
}

/** Common host-side exclude selectors shared across filter/rank/table discovery.
 *  Linker columns and per-sequence annotations are dropped from discovery
 *  *results* — linkers still stay in the source collection so anchored
 *  discovery can traverse them. */
export const commonExcludeSelectors: RelaxedColumnSelector[] = [
  { annotations: { [Annotation.IsLinkerColumn]: "true" } },
  { annotations: { [Annotation.Sequence.IsAnnotation]: "true" } },
];

/** Cluster-id axis / column names. Both unprefixed (post-peptide-adaptation)
 *  and `pl7.app/vdj/`-prefixed (pre-peptide) names are recognized so older
 *  clonotype-clustering instances remain selectable. */
export const CLUSTER_ID_AXIS_NAMES: ReadonlySet<string> = new Set([
  "pl7.app/clusterId",
  "pl7.app/vdj/clusterId",
]);
export const isClusterIdAxisName = (name: string): boolean => CLUSTER_ID_AXIS_NAMES.has(name);

/**
 * Host-side excludes for the "selectable for filter/rank" discovery: linkers,
 * per-sequence annotations, the label column, clonotype-mapping (clusterId-named)
 * columns, and per-sample (sampleId-axis) columns. Pushed into `discover`/`filter`
 * so non-matching columns never have their spec fetched into the sandbox. The two
 * predicates that CAN'T be selectors — File value type and lead-selection-produced
 * columns — remain in {@link isSelectableMatch}, paid only for the survivors.
 */
export function discoveryExcludeSelectors(sampleAxisName: string): RelaxedColumnSelector[] {
  return [
    ...commonExcludeSelectors,
    { name: exactMatch(Annotation.Label) },
    ...[...CLUSTER_ID_AXIS_NAMES].map((name) => ({ name: exactMatch(name) })),
    { axes: [{ name: exactMatch(sampleAxisName) }], partialAxesMatch: true },
  ];
}

/** Trace-step `type` stamped by a lead-selection block onto the columns it produces. */
const LEAD_SELECTION_TRACE_TYPE = "milaboratories.antibody-tcr-lead-selection";

/** True when the column was produced *by* a lead-selection block, as opposed to merely
 *  being downstream of one. `pSpec.makeTrace` appends the producing block as the LAST
 *  trace step, so only the final entry identifies the producer — a substring match on
 *  the whole trace also (wrongly) catches everything computed downstream of a Selected
 *  Leads step (3D structure prediction/clustering/liabilities, etc.). */
export function isProducedByLeadSelection(spec: PColumnSpec): boolean {
  const trace = readAnnotationJson(spec, Annotation.Trace);
  return (
    Array.isArray(trace) &&
    trace.length > 0 &&
    trace[trace.length - 1]?.type === LEAD_SELECTION_TRACE_TYPE
  );
}

/**
 * True when a column carries no readable value: presence in the key space is the whole signal.
 *
 * Both halves are required. `pl7.app/isSubset` alone is not enough — a column may declare it
 * while still carrying meaningful values, and a column whose axes are not a subset of the
 * anchor's is not a subset of the dataset at all. The axes test is the same constraint the
 * SDK's own filter-column discovery applies (`enrichment` mode, `allowFloatingHitAxes: false`).
 */
export function isPresenceOnlyColumn(spec: PColumnSpec, anchorSpec: PColumnSpec): boolean {
  if (spec.annotations?.[Annotation.IsSubset] !== "true") return false;
  const anchorAxes = anchorSpec.axesSpec.map(getAxisId);
  return spec.axesSpec.every((axis) => {
    const id = getAxisId(axis);
    return anchorAxes.some((anchorAxis) => matchAxisId(id, anchorAxis));
  });
}

/** JS post-filter for the residual predicates that {@link discoveryExcludeSelectors}
 *  can't express host-side: File value type (`File` is not a matchable `ValueType`)
 *  and columns produced by a lead-selection block (last-trace-step check on parsed
 *  JSON). Paid only for the survivors of the host-side exclude. */
export function isSelectableMatch(c: ColumnRecipe): boolean {
  const spec = c.getSpec();
  return !isProducedByLeadSelection(spec);
}

/**
 * Collapses discovery results to one recipe per storage column, first hit wins.
 *
 * Restores the pre-migration shape of a discovery result. The old
 * `findColumns()` reduced hits into a `Map<PObjectId, ColumnMatch>` keyed by the
 * leaf column, merging several reachability variants into one entry; the new
 * `discover().getColumns()` returns one recipe *per variant* instead. Since the
 * wire format is the leaf id (see {@link ScopedColumnId.column}), variants of the
 * same column would otherwise become several dropdown entries sharing one value.
 *
 * Only for the user-facing filter/ranking lists. The table wants the full
 * recipes: their distinct ids are what `createPlDataTableV3` joins on.
 */
export function dedupByLeafId(recipes: ColumnRecipe[]): ColumnRecipe[] {
  const seen = new Set<PObjectId>();
  return recipes.filter((c) => {
    const leaf = extractPObjectId(c.id);
    if (seen.has(leaf)) return false;
    seen.add(leaf);
    return true;
  });
}

// The Repertoire Score exported by the repertoire-score block. When present
// upstream it is used as the primary In Vivo ranking.
export const REPERTOIRE_SCORE_COLUMN_NAME = "pl7.app/vdj/repertoireScore";

/**
 * Converts a discovered column recipe to a ScopedColumnId for the workflow wire format.
 *
 * `extractPObjectId` walks the recipe id down to the storage column it ends at.
 * For a direct hit that is already the id itself; for a hit reached through a
 * linker chain it strips the `ColumnDiscoveredId` wrapper the workflow cannot
 * read. See the note on {@link ScopedColumnId.column}.
 */
export function matchToColumnId(recipe: ColumnRecipe, anchorRef: PlRef): ScopedColumnId {
  return { anchorRef, column: extractPObjectId(recipe.id) };
}

// SHM mutation columns that are replaced by the Repertoire Score in ranking.
export const IN_VIVO_MUTATION_COLUMNS = new Set([
  "pl7.app/vdj/sequence/fractionCDRMutations",
  "pl7.app/vdj/sequence/nMutations",
  "pl7.app/vdj/sequence/nAAMutationsCDR",
  "pl7.app/vdj/sequence/nAAMutationsFWR",
]);

// In Vivo preset allowlist: only score columns whose spec.name is in this set
// can contribute discovery-driven defaults to the in-vivo filter list.
// Mutation cutoffs (fractionCDRMutations, nMutations) are added separately with
// preset-specific overrides.
// Both unprefixed (post-peptide-adaptation) and `pl7.app/vdj/` (pre-peptide)
// spec names are listed so projects using either upstream block version still
// get defaults.
export const IN_VIVO_FILTER_SPEC_NAMES = new Set([
  "pl7.app/vdj/isProductive",
  "pl7.app/developabilityRisk",
  "pl7.app/vdj/developabilityRisk",
]);

// In Vivo preset allowlist for ranking. The Repertoire Score (pulled to the front
// in computePresets when present) is the primary ranking; the entries below are
// kept as secondary rankings when their columns are present upstream.
export const IN_VIVO_RANKING_SPEC_NAMES = new Set([
  "pl7.app/vdj/repertoireScore",
  "pl7.app/developabilityScore",
  "pl7.app/vdj/developabilityScore",
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
  "pl7.app/vdj/isProductive",
  "pl7.app/developabilityRisk",
  "pl7.app/vdj/developabilityRisk",
  "pl7.app/enrichmentQuality",
  "pl7.app/vdj/enrichmentQuality",
  "pl7.app/vdj/bindingSpecificity",
  "pl7.app/enrichment",
  "pl7.app/vdj/enrichment",
]);

export const IN_VITRO_RANKING_SPEC_NAMES = new Set([
  "pl7.app/developabilityScore",
  "pl7.app/vdj/developabilityScore",
  "pl7.app/enrichment",
  "pl7.app/vdj/enrichment",
  // Max frequency across target rounds (clonotype-enrichment) — ranked descending.
  "pl7.app/maxFrequency",
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
 * Builds a host-driven {@link ColumnsCollection} over the upstream result pool
 * and computes column metadata (scores, defaults, presets).
 *
 * The returned `collection` is the shared base (result pool minus File-typed
 * columns); callers run their own `discover({ anchors: { main: anchorSpec } })`
 * against it with the mode/selectors they need. `anchorSpec` is exposed so those
 * callers don't refetch it.
 *
 * Relies on the ambient render ctx (set during output evaluation) for
 * `Column` / `ColumnsCollection` resolution — no `ctx` argument needed.
 */
export function buildCollection(inputAnchor: PlRef | undefined):
  | {
      collection: ColumnsCollection;
      anchorSpec: PColumnSpec;
      meta: ColumnsMeta;
      sampleAxisName: string;
    }
  | undefined {
  if (!inputAnchor) return undefined;

  const anchorSpec = getSpecByRef(inputAnchor);
  if (!anchorSpec) return undefined;

  // Host-driven base: the whole upstream result pool. Linker columns are kept in
  // the source so anchored discovery can traverse them; they're dropped from
  // results (along with label/cluster-mapping/per-sample columns) host-side via
  // `discoveryExcludeSelectors`. Only File / lead-selection-produced survive to
  // the `isSelectableMatch` post-filter.
  const collection = ColumnsCollection(["result_pool"]);

  // Use the full 2-axis input anchor as the discovery anchor. The anchored ID
  // deriver keys idx:0=sampleId, idx:1=clonotypeKey — matching the workflow's
  // `addAnchor("main", inputAnchor)` reference frame — so discovered column ids
  // resolve correctly in bundleBuilder.
  const sampleAxisName = anchorSpec.axesSpec[0].name;
  const allMatches = dedupByLeafId(
    collection
      .discover({
        anchors: { main: anchorSpec },
        mode: "related",
        maxHops: 2,
        exclude: discoveryExcludeSelectors(sampleAxisName),
      })
      .getColumns(),
  ).filter(isSelectableMatch);

  // Extract scores
  const scores = allMatches.filter((c) => c.getSpec().annotations?.[Annotation.IsScore] === "true");

  // Compute defaults and presets
  const defaultFilters = computeDefaultFilters(scores, inputAnchor);
  const presets = computePresets(scores, defaultFilters, inputAnchor, anchorSpec);

  return {
    collection,
    anchorSpec,
    sampleAxisName,
    meta: {
      allMatches,
      scores,
      defaultFilters,
      ...presets,
    },
  };
}

function computeDefaultFilters(scores: ColumnRecipe[], anchorRef: PlRef): PlTableFiltersDefault[] {
  const defaultFilters: PlTableFiltersDefault[] = [];

  for (const score of scores) {
    const spec = score.getSpec();
    const valueString = spec.annotations?.[Annotation.Score.DefaultCutoff];
    if (valueString === undefined) continue;

    if (spec.valueType === "String") {
      try {
        const value = JSON.parse(valueString) as string[];
        if (!Array.isArray(value)) {
          // invalid string filter — skip silently (console unavailable in model sandbox)
          continue;
        }
        const isDiscreteFilter = spec.annotations?.[Annotation.IsDiscreteFilter] === "true";
        const hasDiscreteValues = !!spec.annotations?.[Annotation.DiscreteValues];
        if (isDiscreteFilter && hasDiscreteValues && value.length > 0) {
          defaultFilters.push({
            column: matchToColumnId(score, anchorRef),
            default: { type: "string_in", reference: JSON.stringify(value) },
          });
        } else {
          defaultFilters.push({
            column: matchToColumnId(score, anchorRef),
            default: { type: "string_equals", reference: value[0] },
          });
        }
      } catch {
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

        const direction = spec.annotations?.[Annotation.Score.RankingOrder] ?? "increasing";
        if (direction !== "increasing" && direction !== "decreasing") {
          // invalid ranking order — skip silently (console unavailable in model sandbox)
          continue;
        }

        defaultFilters.push({
          column: matchToColumnId(score, anchorRef),
          default: {
            type:
              direction === "increasing"
                ? "number_greaterThanOrEqualTo"
                : "number_lessThanOrEqualTo",
            reference: numericValue,
          },
        });
      } catch {
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
  anchorRef: PlRef,
  anchorSpec: PColumnSpec,
): Omit<ColumnsMeta, "allMatches" | "scores" | "defaultFilters"> {
  const isPeptide = anchorSpec.axesSpec[1]?.name === "pl7.app/variantKey";

  // The Repertoire Score (repertoire-score block), when present upstream, is the
  // In Vivo preset's primary ranking.
  const repertoireScore = scores.find((s) => s.getSpec().name === REPERTOIRE_SCORE_COLUMN_NAME);
  const hasRepertoireScore = repertoireScore !== undefined;

  const isEnrichmentColumn = (name: string) =>
    name.startsWith("pl7.app/enrichment") || name.startsWith("pl7.app/vdj/enrichment");
  const hasEnrichmentScores = scores.some((s) => isEnrichmentColumn(s.getSpec().name));

  // Peptide anchors always auto-select the peptide preset, regardless of which
  // score columns are upstream.
  const detectedPreset: WorkflowPreset | undefined = isPeptide
    ? "peptide"
    : hasRepertoireScore
      ? "in-vivo"
      : hasEnrichmentScores
        ? "in-vitro"
        : undefined;

  // Default ranking: all non-String scores. When the Repertoire Score is present
  // it is pulled to the front (below) as the primary ranking, and the raw SHM
  // mutation columns it subsumes are dropped.
  const defaultRankingOrder: RankingOrder[] = scores
    .filter((s) => s.getSpec().valueType !== "String")
    .filter((s) => !hasRepertoireScore || s.getSpec().name !== REPERTOIRE_SCORE_COLUMN_NAME)
    .filter((s) => !hasRepertoireScore || !IN_VIVO_MUTATION_COLUMNS.has(s.getSpec().name))
    .map((s) => ({
      id: `default-rank-${s.id}`,
      value: matchToColumnId(s, anchorRef),
      rankingOrder:
        (s.getSpec().annotations?.[Annotation.Score.RankingOrder] as "increasing" | "decreasing") ??
        "decreasing",
      isExpanded: false,
    }));

  if (repertoireScore) {
    defaultRankingOrder.unshift({
      value: matchToColumnId(repertoireScore, anchorRef),
      rankingOrder:
        (repertoireScore.getSpec().annotations?.["pl7.app/score/rankingOrder"] as
          | "increasing"
          | "decreasing") ?? "decreasing",
    });
  }

  // Both presets intersect discovery-driven defaults with a per-preset
  // allowlist of spec names, so new upstream score columns can't bloat them.
  const specNameByColumnId = new Map(
    scores.map((s) => [matchToColumnId(s, anchorRef).column, s.getSpec().name]),
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

  const fractionCDRMutationsCol = scores.find(
    (s) => s.getSpec().name === "pl7.app/vdj/sequence/fractionCDRMutations",
  );
  if (fractionCDRMutationsCol) {
    inVivoFilters.push({
      column: matchToColumnId(fractionCDRMutationsCol, anchorRef),
      default: { type: "number_greaterThan", reference: 0.5 },
    });
  }

  const nMutationsCol = scores.find((s) => s.getSpec().name === "pl7.app/vdj/sequence/nMutations");
  if (nMutationsCol) {
    inVivoFilters.push({
      column: matchToColumnId(nMutationsCol, anchorRef),
      default: { type: "number_greaterThanOrEqualTo", reference: 3 },
    });
  }

  const inVivoRankingOrder: RankingOrder[] = defaultRankingOrder.filter((r) => {
    const col = r.value?.column;
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
    rankingOrder: scores
      .filter((s) => s.getSpec().valueType !== "String")
      .map((s) => ({
        value: matchToColumnId(s, anchorRef),
        rankingOrder:
          (s.getSpec().annotations?.[Annotation.Score.RankingOrder] as
            | "increasing"
            | "decreasing") ?? "decreasing",
      })),
    filters: defaultFilters,
  };

  return {
    defaultRankingOrder,
    hasRepertoireScore,
    hasEnrichmentScores,
    detectedPreset,
    inVivoDefaults,
    inVitroDefaults,
    inPeptideDefaults,
  };
}

export function getDefaultBlockLabel(data: { datasetLabel?: string }) {
  return data.datasetLabel || "Select dataset";
}
