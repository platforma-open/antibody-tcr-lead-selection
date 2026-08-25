import strings from "@milaboratories/strings";
import type {
  ColumnRecipe,
  InferHrefType,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PColumnIdAndSpec,
  PlRef,
  PObjectSpec,
  PTableSorting,
  RelaxedColumnSelector,
  RenderCtx,
  TreeNodeAccessor,
} from "@platforma-sdk/model";
import {
  Annotation,
  BlockModelV3,
  buildDatasetOptions,
  canonicalizeJson,
  ColumnsCollection,
  createPFrameForGraphs,
  createPlDataTableV3,
  dedupColumns,
  deriveDistinctLabels,
  extractPObjectId,
  isDataColumn,
  isPColumnSpec,
} from "@platforma-sdk/model";
import {
  buildCollection,
  CLUSTER_ID_AXIS_NAMES,
  dedupByLeafId,
  discoveryExcludeSelectors,
  exactMatch,
  getInputAnchorRef,
  getInputFilterRef,
  getSpecByRef,
  isClusterIdAxisName,
  isPresenceOnlyColumn,
  isProducedByLeadSelection,
  isSelectableMatch,
  matchToColumnId,
} from "./util";
import { kind } from "@platforma-open/milaboratories.top-antibodies.kind";
import { convertFilterUI, convertRankingOrderUI } from "./converters";
import { blockDataModel } from "./dataModel";
import type { BlockArgs, BlockData } from "./types";

export * from "./types";
export * from "./converters";
export {
  anchorInitializedId,
  getDefaultBlockLabel,
  getInputAnchorRef,
  getInputFilterRef,
} from "./util";
export { blockDataModel } from "./dataModel";
export type Href = InferHrefType<typeof platforma>;
export type BlockOutputs = InferOutputsType<typeof platforma>;

// Trace element types emitted by upstream clustering blocks. Lead-selection
// pulls each linker's clustering label from these types when populating the
// cluster-column dropdown; any new clustering producer must be added here.
const CLUSTERING_TRACE_TYPES = [
  "milaboratories.clonotype-clustering.clustering",
  "milaboratories.3d-structure-clustering.clustering",
  "milaboratories.embedding-clustering.clustering",
];

// Display selectors for the main table (host-side `ColumnSelector`s — the V3
// replacement for the old `(spec) => boolean` display lambdas).

/** Label column keyed by exactly one clonotype/variant key axis. Omitting
 *  `partialAxesMatch` requires the exact axis set, i.e. `axesSpec.length === 1`. */
const LABEL_KEY_AXIS_SELECTORS: RelaxedColumnSelector[] = [
  "pl7.app/vdj/clonotypeKey",
  "pl7.app/vdj/scClonotypeKey",
  "pl7.app/variantKey",
].map((axisName) => ({
  name: exactMatch(Annotation.Label),
  axes: [{ name: exactMatch(axisName) }],
}));

/** Amino-acid main-sequence columns (VDJ assembling feature or peptide assembling feature). */
const AA_MAIN_SEQUENCE_SELECTORS: RelaxedColumnSelector[] = [
  {
    domain: { [Annotation.Alphabet]: "aminoacid" },
    annotations: {
      [Annotation.VDJ.IsAssemblingFeature]: "true",
      [Annotation.VDJ.IsMainSequence]: "true",
    },
  },
  {
    domain: { [Annotation.Alphabet]: "aminoacid" },
    // Peptide assembling-feature keys have no `Annotation.*` constant yet.
    annotations: {
      "pl7.app/isAssemblingFeature": "true",
      "pl7.app/isMainSequence": "true",
    },
  },
];

/** Clone-to-cluster mapping columns (matched by column name), always hidden. */
const CLUSTER_ID_SELECTORS: RelaxedColumnSelector[] = [...CLUSTER_ID_AXIS_NAMES].map((name) => ({
  name: exactMatch(name),
}));

// Internal columns to be hidden from the table
const OWN_PLUMBING_SELECTORS: RelaxedColumnSelector[] = [
  { name: exactMatch("pl7.app/selectionStage") },
  { name: exactMatch("pl7.app/lead-selection") },
];

/**
 * Adapt column recipes to `PColumn`s for the helpers that still take
 * materialised `PColumn[]` and have no id form (`createPFrameForGraphs`,
 * `PColumnIdAndSpec`).
 *
 * Only bare leaves qualify: `PColumn.id` is typed `PObjectId`, which no wrapper
 * recipe carries — hence `isDataColumn` rather than `hasReachableData`, which
 * also admits spec-overrides over a leaf. Deduped by id: the same leaf can be
 * reachable via more than one path and `createPFrameForGraphs` rejects
 * duplicates.
 */
function toGraphColumns(recipes: ColumnRecipe[]): PColumn<undefined | PColumnDataUniversal>[] {
  return dedupColumns(
    recipes.filter(isDataColumn).map((c) => ({ id: c.id, spec: c.getSpec(), data: c.getData() })),
    (c) => c.id,
    (c) => c.spec,
  );
}

/** {@link toGraphColumns} over a single block-output accessor; `undefined` when absent. */
function accessorGraphColumns(
  accessor: TreeNodeAccessor | undefined,
): PColumn<undefined | PColumnDataUniversal>[] | undefined {
  if (!accessor) return undefined;
  return toGraphColumns(ColumnsCollection([accessor]).getColumns());
}

/**
 * UMAP columns from the sequence-space block plus this block's own sampled-rows
 * markers, materialised for `createPFrameForGraphs` / `PColumnIdAndSpec`.
 *
 * The legacy `{ anchor: "main", idx: 1 }` axis binding has no selector form, so
 * the clonotype axis name is read off the resolved anchor spec and matched by
 * name. Omitting `partialAxesMatch` keeps the old exact-axis-set semantics.
 */
function umapGraphColumns(
  ctx: RenderCtx<BlockArgs, BlockData>,
): PColumn<undefined | PColumnDataUniversal>[] | undefined {
  const anchorSpec = getSpecByRef(getInputAnchorRef(ctx.data));
  const clonotypeAxisName = anchorSpec?.axesSpec[1]?.name;
  if (anchorSpec === undefined || clonotypeAxisName === undefined) return undefined;

  const umap = ColumnsCollection(["result_pool"])
    .discover({
      anchors: { main: anchorSpec },
      include: {
        name: "^pl7\\.app/umap[12]$",
        axes: [{ name: exactMatch(clonotypeAxisName) }],
      },
    })
    .getColumns();
  if (umap.length === 0) return undefined;

  const sampledRows = ColumnsCollection(
    [
      ctx.outputs?.resolve({
        field: "sampledRows",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      }),
    ].filter((a) => a !== undefined),
  ).getColumns();

  return toGraphColumns([...umap, ...sampledRows]);
}

export const platforma = BlockModelV3.create({ dataModel: blockDataModel, kind })

  // Inverse of `init` — the same fields, projected back out for template export.
  // The ranking and filter entries travel: `relocateBlockIds` points every
  // column identifier they carry at the blocks of the project being built
  // before the kind's parser or `init` ever see them. They go out through the
  // same converters the args lambda uses, so the per-row UI extras (`id`,
  // `isExpanded`) stay behind.
  //
  // View state — the table, the four graphs, the alignment model — never
  // crosses, nor does `inVivoScoreRemovedNotice`, which a migration sets for a
  // project that lost the built-in in-vivo score. The two
  // `…InitializedForAnchor` slots do cross, and they carry their weight: each
  // holds a bare stringified anchor beside the preset it was applied under, so
  // relocation rewrites the anchor while leaving the preset alone, and the
  // applied block recognizes the ranking and filter lists above as already
  // applied instead of replacing them with the landing dataset's defaults.
  .templateParams((data) => ({
    input: data.input,

    preset: data.preset,
    topClonotypes: data.topClonotypes,
    kabatNumbering: data.kabatNumbering,
    rankingOrder: convertRankingOrderUI(data.rankingOrder),
    filters: convertFilterUI(data.filters),
    diversificationColumn: data.diversificationColumn,
    filtersInitializedForAnchor: data.filtersInitializedForAnchor,
    rankingsInitializedForAnchor: data.rankingsInitializedForAnchor,

    defaultBlockLabel: data.defaultBlockLabel,
    customBlockLabel: data.customBlockLabel,
  }))

  .args<BlockArgs>((data) => {
    const inputAnchor = getInputAnchorRef(data);
    if (inputAnchor === undefined) throw new Error("No input anchor");
    if (data.topClonotypes === undefined) throw new Error("No top clonotypes");

    const rankingOrder = convertRankingOrderUI(data.rankingOrder);
    if (rankingOrder.some((order) => order.value === undefined))
      throw new Error("Incomplete ranking order");
    const filters = convertFilterUI(data.filters);
    if (filters.some((filter) => filter.value === undefined)) throw new Error("Incomplete filters");

    return {
      defaultBlockLabel: data.defaultBlockLabel,
      customBlockLabel: data.customBlockLabel,
      inputAnchor,
      inputFilter: getInputFilterRef(data),
      topClonotypes: data.topClonotypes,
      rankingOrder,
      filters,
      kabatNumbering: data.kabatNumbering,
      diversificationColumn: data.diversificationColumn,
    };
  })

  // Dataset picker entries. Primary accepts any anchor column whose row axis
  // is clonotypeKey, scClonotypeKey, or variantKey — the three modalities
  // this block supports. After building, drop filter entries that came from
  // *this* block instance (matched by `ref.blockId` against the
  // workflow-exposed `selfBlockId`) — otherwise every completed run would
  // surface its own sampled subset as a filter on the next configuration.
  // Filter entries from *other* lead-selection instances are kept.
  .output("datasetOptions", (ctx) => {
    const opts = buildDatasetOptions(ctx, {
      primary: (spec: PObjectSpec): boolean => {
        if (!isPColumnSpec(spec)) return false;
        if (spec.annotations?.[Annotation.IsAnchor] !== "true") return false;
        if (spec.axesSpec.length < 2) return false;
        if (spec.axesSpec[0]?.name !== "pl7.app/sampleId") return false;
        const rowAxis = spec.axesSpec[1]?.name;
        return (
          rowAxis === "pl7.app/vdj/clonotypeKey" ||
          rowAxis === "pl7.app/vdj/scClonotypeKey" ||
          rowAxis === "pl7.app/variantKey"
        );
      },
    });
    if (!opts) return opts;

    // selfBlockId only exists once the block has produced outputs at least
    // once. Before that there are no self-filter entries to drop anyway.
    // Not-ready-safe read — getDataAsJson throws mid-run here on remote backends (MILAB-6318).
    const selfBlockId = ctx.outputs
      ?.resolve({
        field: "selfBlockId",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      })
      ?.getDataAsJsonOrUndefined<string>();
    if (selfBlockId === undefined) return opts;

    return opts.map((opt) => {
      const filtered = opt.filters?.filter((f) => f.ref.blockId !== selfBlockId);
      return {
        ...opt,
        filters: filtered && filtered.length > 0 ? filtered : undefined,
      };
    });
  })

  .output(
    "inputAnchorSpec",
    (ctx) => {
      return getSpecByRef(getInputAnchorRef(ctx.data));
    },
    { retentive: true },
  )

  .output(
    "modality",
    (ctx) => {
      const spec = getSpecByRef(getInputAnchorRef(ctx.data));
      if (!spec) return undefined;
      return spec.axesSpec[1]?.name === "pl7.app/variantKey" ? "peptide" : "antibody_tcr";
    },
    { retentive: true },
  )

  // Combined filter config - options and defaults together for atomic updates
  .output("filterConfig", (ctx) => {
    const inputAnchor = getInputAnchorRef(ctx.data);
    const result = buildCollection(inputAnchor);
    if (!result) return undefined;

    const filterableMatches = dedupByLeafId(
      result.collection
        .discover({
          anchors: { main: result.anchorSpec },
          exclude: discoveryExcludeSelectors(result.sampleAxisName),
        })
        .getColumns(),
    ).filter(isSelectableMatch);

    const labels = deriveDistinctLabels(
      filterableMatches.map((c) => c.getSpec()),
      { includeNativeLabel: true },
    );
    const options = filterableMatches.map((c, i) => {
      const spec = c.getSpec();
      return {
        label: labels[i],
        value: matchToColumnId(c, inputAnchor!),
        // FilterCard reads `option.column.spec` to pick the right filter control.
        column: { id: c.id, spec },
        // Decided here, not in the card: the card has the spec but not the anchor.
        presenceOnly: isPresenceOnlyColumn(spec, result.anchorSpec),
      };
    });

    return {
      options,
      defaults: result.meta.defaultFilters,
      inVivoDefaults: result.meta.inVivoDefaults.filters,
      inVitroDefaults: result.meta.inVitroDefaults.filters,
      inPeptideDefaults: result.meta.inPeptideDefaults.filters,
    };
  })

  // Combined ranking config - options and defaults together for atomic updates
  .output("rankingConfig", (ctx) => {
    const inputAnchor = getInputAnchorRef(ctx.data);
    const result = buildCollection(inputAnchor);
    if (!result) return undefined;

    // `type: "String"` is a valid ValueType, so the non-string filter goes
    // host-side too — only File / lead-selection-produced survive to isSelectableMatch.
    // Presence-only columns carry nothing to order by. That test needs the anchor, so it
    // cannot be a host-side selector; it runs beside `isSelectableMatch` on the survivors.
    const rankableMatches = dedupByLeafId(
      result.collection
        .discover({
          anchors: { main: result.anchorSpec },
          exclude: [...discoveryExcludeSelectors(result.sampleAxisName), { type: "String" }],
        })
        .getColumns(),
    ).filter((c) => isSelectableMatch(c) && !isPresenceOnlyColumn(c.getSpec(), result.anchorSpec));

    const labels = deriveDistinctLabels(
      rankableMatches.map((c) => c.getSpec()),
      { includeNativeLabel: true },
    );
    const options = rankableMatches.map((c, i) => ({
      label: labels[i],
      value: matchToColumnId(c, inputAnchor!),
    }));

    return {
      options,
      defaults: result.meta.defaultRankingOrder,
      inVivoDefaults: result.meta.inVivoDefaults.rankingOrder,
      inVitroDefaults: result.meta.inVitroDefaults.rankingOrder,
      inPeptideDefaults: result.meta.inPeptideDefaults.rankingOrder,
    };
  })

  .output(
    "presetConfig",
    (ctx) => {
      const result = buildCollection(getInputAnchorRef(ctx.data));
      if (!result) return undefined;

      return {
        detectedPreset: result.meta.detectedPreset,
        hasRepertoireScore: result.meta.hasRepertoireScore,
        hasEnrichmentScores: result.meta.hasEnrichmentScores,
      };
    },
    { retentive: true },
  )

  .outputWithStatus("pf", (ctx) => {
    const anchor = getInputAnchorRef(ctx.data);
    if (!anchor) return undefined;

    const result = buildCollection(anchor);
    if (!result) return undefined;

    // Restrict MSA to columns sharing the input-anchor clonotype axis (main
    // dataset only). Cross-axis SC columns are excluded so PFrame never has
    // to join disjoint axes for MSA. Also drop per-sample columns (axis set
    // contains sampleAxis) — they'd duplicate rows in the alignment.
    const anchorClonotypeAxisName = result.anchorSpec.axesSpec[1]?.name;
    if (!anchorClonotypeAxisName) return undefined;

    // Every constraint is host-side: must carry the anchor clonotype axis, must
    // NOT carry the per-sample axis, and linker / hide-from-ui / hide-from-graph
    // columns are excluded (the hide-* annotations are StringifiedJson<boolean>,
    // so an exact "true" match is faithful). With no JS predicate left we take
    // ids straight from the host — zero spec round-trips. Set-dedup the ids since
    // the same leaf can surface via multiple paths and createPFrame rejects dupes.
    const msaIds = result.collection
      .discover({
        anchors: { main: result.anchorSpec },
        include: { axes: [{ name: exactMatch(anchorClonotypeAxisName) }], partialAxesMatch: true },
        exclude: [
          { annotations: { [Annotation.IsLinkerColumn]: "true" } },
          { axes: [{ name: exactMatch(result.sampleAxisName) }], partialAxesMatch: true },
          { annotations: { [Annotation.HideDataFromUi]: exactMatch("true") } },
          { annotations: { [Annotation.HideDataFromGraphs]: exactMatch("true") } },
        ],
      })
      .getColumnIds();

    return ctx.createPFrame([...new Set(msaIds)]);
  })
  // Use the cdr3LengthsCalculated cols
  .outputWithStatus("spectratypePf", (ctx) => {
    const pCols = accessorGraphColumns(
      ctx.outputs?.resolve({
        field: "cdr3VspectratypePf",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      }),
    );
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  // Use the cdr3LengthsCalculated cols
  .outputWithStatus("vjUsagePf", (ctx) => {
    const pCols = accessorGraphColumns(
      ctx.outputs?.resolve({
        field: "vjUsagePf",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      }),
    );
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  .outputWithStatus("selectionStagePf", (ctx) => {
    const pCols = accessorGraphColumns(
      ctx.outputs?.resolve({
        field: "selectionStagePf",
        assertFieldType: "Input",
        allowPermanentAbsence: true,
      }),
    );
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  .outputWithStatus("table", (ctx) => {
    const anchor = ctx.activeArgs?.inputAnchor;
    if (!anchor) return undefined;

    // Don't render table until workflow has been executed
    if (!ctx.outputs) return undefined;

    const anchorSpec = getSpecByRef(anchor);
    if (!anchorSpec) return undefined;

    // Resolve the sampledRows output
    const sampledRowsAccessor = ctx.outputs.resolve({
      field: "sampledRows",
      assertFieldType: "Input",
      allowPermanentAbsence: true,
    });
    if (!sampledRowsAccessor) return undefined;

    const sampledRowsCollection = ColumnsCollection([sampledRowsAccessor]);

    // Don't render table if sampledRows aren't finalized
    if (!sampledRowsCollection.isFinal()) return undefined;

    // Use lead-selection column as anchor — it has [clonotypeKey] axis only,
    // so the inner join core is keyed by clonotypeKey (no sampleId duplication).
    const leadSelectionCol = sampledRowsCollection
      .filter({ include: { name: [{ type: "exact", value: "pl7.app/lead-selection" }] } })
      .getColumns()[0];
    if (!leadSelectionCol) return undefined;
    const leadSelectionSpec = leadSelectionCol.getSpec();

    // Verify sampledRows belong to current inputAnchor by checking axes
    const clonotypeAxisMatches = leadSelectionSpec.axesSpec.some(
      (axis) => JSON.stringify(axis) === JSON.stringify(anchorSpec.axesSpec[1]),
    );
    if (!clonotypeAxisMatches) return undefined;

    const poolDiscovered = ColumnsCollection()
      .discover({ anchors: { main: leadSelectionSpec } })
      .getColumns()
      .filter((c) => {
        const spec = c.getSpec();
        return !isProducedByLeadSelection(spec);
      });

    const primaryColumns = poolDiscovered.filter((c) => c.id === leadSelectionCol.id);
    const secondaryColumns = poolDiscovered.filter((c) => c.id !== leadSelectionCol.id);

    // Build filter/ranking display signatures. The selected filter/ranking
    // columns are given ordering priority and forced visible. Matched by
    // spec signature (name + domain) via selectors, since display rules receive
    // specs, not ids. Args carry leaf ids (see ScopedColumnId.column), so the
    // discovered recipes are reduced to their leaf before comparing.
    const filterColumnIds = new Set<string>(
      ctx.activeArgs?.filters
        .filter((f) => f.value?.column !== undefined)
        .map((f) => f.value!.column as string),
    );
    const rankingColumnIds = new Set<string>(
      ctx.activeArgs?.rankingOrder
        .filter((r) => r.value?.column !== undefined)
        .map((r) => r.value!.column as string),
    );
    const kabatEnabled = ctx.activeArgs?.kabatNumbering ?? false;

    const collectionResult = buildCollection(anchor);
    const filterRankSignatures = new Map<
      string,
      { name: string; domain?: Record<string, string> }
    >();
    if (collectionResult) {
      for (const m of collectionResult.meta.allMatches) {
        const idStr = extractPObjectId(m.id) as string;
        if (filterColumnIds.has(idStr) || rankingColumnIds.has(idStr)) {
          const spec = m.getSpec();
          filterRankSignatures.set(canonicalizeJson({ name: spec.name, domain: spec.domain }), {
            name: spec.name,
            domain: spec.domain,
          });
        }
      }
    }
    const filterRankSelectors: RelaxedColumnSelector[] = [...filterRankSignatures.values()].map(
      ({ name, domain }) => ({
        name: [{ type: "exact", value: name }],
        ...(domain && Object.keys(domain).length > 0 ? { domain } : {}),
      }),
    );

    // Sort by ranking-order column (from sampledRows). V3 remaps the ID via originalId.
    const rankingOrderCol = sampledRowsCollection
      .filter({ include: { name: [{ type: "exact", value: "pl7.app/ranking-order" }] } })
      .getColumns()[0];
    const sorting: PTableSorting[] | undefined = rankingOrderCol
      ? [
          {
            column: { type: "column", id: rankingOrderCol.id },
            ascending: true,
            naAndAbsentAreLeastValues: false,
          },
        ]
      : undefined;

    const defaultVisibleSelectors: RelaxedColumnSelector[] = [
      { name: exactMatch("pl7.app/ranking-order") },
      ...filterRankSelectors,
      ...LABEL_KEY_AXIS_SELECTORS,
      ...AA_MAIN_SEQUENCE_SELECTORS,
      ...(kabatEnabled ? [{ name: "^pl7\\.app/vdj/kabatSequence" } as RelaxedColumnSelector] : []),
    ];

    return createPlDataTableV3(ctx, {
      primaryColumns: primaryColumns,
      columns: secondaryColumns,
      tableState: ctx.data.tableState,
      sorting,
      labelsOptions: {
        formatters: {
          // `LinkerParts` replaced the flat label array in SDK 1.81: the chain
          // now arrives as `parts.linkers`, each carrying its rendered `text`.
          linker: (parts, hit) => {
            if (hit?.axesSpec.some((a) => isClusterIdAxisName(a.name))) return undefined;
            const chain = parts.linkers.map((l) => l.text).join(" > ");
            return chain ? `via ${chain}` : undefined;
          },
        },
      },
      displayOptions: {
        ordering: [
          { match: LABEL_KEY_AXIS_SELECTORS, priority: 1000000 },
          { match: AA_MAIN_SEQUENCE_SELECTORS, priority: 999000 },
          ...(filterRankSelectors.length > 0
            ? [{ match: filterRankSelectors, priority: 7000 }]
            : []),
        ],
        visibility: [
          { match: defaultVisibleSelectors, visibility: "default" },
          // Clone-to-cluster mapping is always hidden — it duplicates the
          // clusterId axis label column.
          { match: CLUSTER_ID_SELECTORS, visibility: "hidden" },
          { match: OWN_PLUMBING_SELECTORS, visibility: "hidden" },
          // Catch-all: everything else optional (V3 manages linker columns).
          { match: {}, visibility: "optional" },
        ],
      },
    });
  })

  .output("calculating", (ctx) => {
    if (getInputAnchorRef(ctx.data) === undefined) return false;

    if (!ctx.outputs) return false;

    const outputsState = ctx.outputs.getIsReadyOrError();
    if (outputsState === false) return true;

    return false;
  })

  // Use UMAP output from ctx from clonotype-space block
  .outputWithStatus("umapPf", (ctx) => {
    const pCols = umapGraphColumns(ctx);
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  .outputWithStatus("umapPcols", (ctx) => {
    const pCols = umapGraphColumns(ctx);
    if (pCols === undefined) return undefined;

    return pCols.map(
      (c) =>
        ({
          columnId: c.id,
          spec: c.spec,
        }) satisfies PColumnIdAndSpec,
    );
  })

  .output("hasClusterData", (ctx) => {
    const result = buildCollection(getInputAnchorRef(ctx.data));
    if (!result) return false;

    return result.meta.allMatches.some((m) =>
      m.getSpec().axesSpec.some((a) => isClusterIdAxisName(a.name)),
    );
  })

  .output("clusterColumnOptions", (ctx) => {
    const anchor = getInputAnchorRef(ctx.data);
    if (anchor === undefined) return undefined;

    const anchorSpec = getSpecByRef(anchor);
    if (anchorSpec === undefined) return undefined;

    // A centroid dataset's key axis carries the producing clustering block's id; that run's
    // cluster axis carries the same id. When they match, it's the origin cluster (one centroid
    // per cluster -> diversification is a no-op), so we drop it below. A fresh clustering run on
    // the centroid dataset has a different id and is kept.
    // axesSpec[1] is the clonotype-key axis by platform convention (axis 0 = sampleId), same as the
    // linker matching below. If it's ever absent this resolves to undefined and the origin cluster
    // simply isn't hidden (degrades to prior behaviour, no error).
    const datasetClusteringId =
      anchorSpec.axesSpec[1]?.domain?.["pl7.app/peptide/extractionRunId"] ??
      anchorSpec.axesSpec[1]?.domain?.["pl7.app/repertoire/extractionRunId"];

    // Get linker columns using the same iteration order as util.ts.
    // `getOptions` preserves the `PlRef` wire shape the UI + workflow consume
    // (diversificationColumn is a PlRef), so it stays the entry point here.
    const options: Array<{ label: string; ref: PlRef }> = [];

    for (const idx of [0, 1]) {
      let axesToMatch;
      if (idx === 0) {
        axesToMatch = [{}, anchorSpec.axesSpec[1]];
      } else {
        axesToMatch = [anchorSpec.axesSpec[1], {}];
      }

      // Deliberately still on `ctx.resultPool.getOptions`: the picked option is
      // persisted as `data.diversificationColumn` and handed to the workflow's
      // `addAnchor("selectedCluster", ...)`, which needs the `PlRef` wire shape.
      // `deriveColumnOptions` yields `ColumnUniversalId`s instead, so moving to
      // it means changing the workflow and migrating stored data together.
      const linkers = ctx.resultPool.getOptions(
        [
          {
            axes: axesToMatch,
            annotations: { [Annotation.IsLinkerColumn]: "true" },
          },
        ],
        {
          label: {
            forceTraceElements: CLUSTERING_TRACE_TYPES,
          },
        },
      );

      for (const link of linkers) {
        const linkerSpec = getSpecByRef(link.ref);
        if (!linkerSpec) {
          continue;
        }
        const clusterAxis = linkerSpec.axesSpec.find((axis) => isClusterIdAxisName(axis.name));
        if (!clusterAxis) {
          continue;
        }
        // Hide the origin cluster of a centroid dataset (see datasetClusteringId above).
        if (
          datasetClusteringId !== undefined &&
          clusterAxis.domain?.["pl7.app/clustering/blockId"] === datasetClusteringId
        ) {
          continue;
        }
        // Extract clustering trace element label directly to avoid verbose
        // disambiguation when vdj-integration linkers are present in the pool.
        let label = "Cluster";
        try {
          const trace = JSON.parse(linkerSpec.annotations?.[Annotation.Trace] ?? "[]") as {
            type?: string;
            label?: string;
          }[];
          const clusteringElement = trace.find((t) =>
            CLUSTERING_TRACE_TYPES.includes(t.type ?? ""),
          );
          if (clusteringElement?.label) label = clusteringElement.label;
        } catch {
          /* use default */
        }
        options.push({ label, ref: link.ref });
      }
    }

    return options.length > 0 ? options : undefined;
  })

  .output("kabatWarning", (ctx) => {
    if (!ctx.data.kabatNumbering) return undefined;
    const numbered = parseInt(
      ctx.outputs
        ?.resolve({
          field: "kabatStatsContent",
          assertFieldType: "Input",
          allowPermanentAbsence: true,
        })
        ?.getDataAsString() ?? "",
      10,
    );
    if (Number.isNaN(numbered)) return undefined;
    if (numbered === 0) {
      return "Kabat numbering could not be applied to any clonotype. The framework regions may be too divergent from known germline sequences. Kabat sequence columns will be empty.";
    }
    return `Kabat numbering was applied to ${numbered.toLocaleString()} clonotype${numbered === 1 ? "" : "s"}. Clonotypes that could not be numbered will have empty Kabat sequence columns.`;
  })

  .output("isRunning", (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title(() => "Lead Selection")

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel)

  .sections((ctx) => {
    const ref = getInputAnchorRef(ctx.data);
    const keyAxis = getSpecByRef(ref)?.axesSpec[1];
    const isPeptide = keyAxis?.name === "pl7.app/variantKey";
    // Amplicon (synthetic-repertoire-profiler) shares the variantKey axis with
    // peptide-extraction; only the axis domain tells them apart. It takes the same
    // non-VDJ path as peptide (so the isPeptide gating below stays) — only the
    // sequence-space section label differs.
    const isAmplicon =
      isPeptide && keyAxis?.domain?.["pl7.app/repertoire/extractionRunId"] !== undefined;
    const spaceLabel = isAmplicon
      ? "Variant Space"
      : isPeptide
        ? "Peptide Space"
        : "Clonotype Space";

    const sections: Array<{ type: "link"; href: `/${string}`; label: string }> = [
      { type: "link", href: "/", label: strings.titles.main },
      { type: "link", href: "/umap", label: spaceLabel },
      { type: "link", href: "/selection", label: "Selection Plot" },
    ];
    if (!isPeptide) {
      sections.push(
        { type: "link", href: "/spectratype", label: "CDR3 V Spectratype" },
        { type: "link", href: "/usage", label: "V/J Gene Usage" },
      );
    }
    return sections;
  })

  .done();
