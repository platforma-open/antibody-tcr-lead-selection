import strings from '@milaboratories/strings';
import type {
  ColumnRecipe, InferHrefType,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PColumnIdAndSpec,
  PColumnSpec,
  PObjectId,
  PObjectSpec,
  PTableSorting,
  RelaxedColumnSelector,
} from '@platforma-sdk/model';
import {
  Annotation,
  BlockModelV3,
  buildDatasetOptions,
  Column,
  ColumnsCollection,
  createPFrameForGraphs,
  createPlDataTableV3,
  deriveColumnOptions,
  deriveDistinctLabels, isColumnLazy,
  isHiddenFromGraphColumn,
  isHiddenFromUIColumn,
  isLeafColumn,
  isPColumnSpec,
} from '@platforma-sdk/model';
import {
  buildCollection, getInputAnchorId, getInputFilterId,
  IN_VIVO_SCORE_COLUMN_ID,
  isClusterIdAxisName,
  recipeToColumnId,
} from './util';
import { convertFilterUI, convertRankingOrderUI } from './converters';
import { blockDataModel } from './dataModel';
import type { BlockArgs } from './types';

export * from './types';
export * from './converters';
export { getDefaultBlockLabel, getInputAnchorId, getInputAnchorRef, getInputFilterId } from './util';
export { blockDataModel } from './dataModel';
export type Href = InferHrefType<typeof platforma>;
export type BlockOutputs = InferOutputsType<typeof platforma>;

// Trace element types emitted by upstream clustering blocks. Lead-selection
// pulls each linker's clustering label from these types when populating the
// cluster-column dropdown; any new clustering producer must be added here.
const CLUSTERING_TRACE_TYPES = [
  'milaboratories.clonotype-clustering.clustering',
  'milaboratories.3d-structure-clustering.clustering',
];

/** Narrow a recipe list to leaves and materialise them for `createPFrameForGraphs`,
 *  which still requires `PColumn<PColumnDataUniversal>[]`. Returns `undefined` if
 *  any leaf's data is still resolving — caller should treat as "not ready". */
function recipesToPColumns(
  recipes: ColumnRecipe[],
): PColumn<PColumnDataUniversal>[] | undefined {
  const leaves = recipes.filter(isColumnLazy);
  const out: PColumn<PColumnDataUniversal>[] = [];
  for (const c of leaves) {
    const data = c.getData();
    if (data === undefined) return undefined;
    out.push({ id: c.id, spec: c.getSpec(), data });
  }
  return out;
}

/** Build a `RelaxedColumnSelector[]` matching the spec signatures (name +
 *  domain) of recipes whose id appears in `targetIds`. This lifts the legacy
 *  lambda-based isFilterOrRank predicate into selector form so it can drive
 *  `displayOptions.ordering[].match` / `visibility[].match`, which the V3 API
 *  types as `ColumnSelector`, not `(spec) => boolean`. */
function filterRankSelectors(
  allMatches: ColumnRecipe[],
  targetIds: Set<string>,
): RelaxedColumnSelector[] {
  if (targetIds.size === 0) return [];
  const seen = new Set<string>();
  const out: RelaxedColumnSelector[] = [];
  for (const recipe of allMatches) {
    if (!targetIds.has(recipe.id as string)) continue;
    const spec = recipe.getSpec();
    const key = JSON.stringify({ name: spec.name, domain: spec.domain ?? null });
    if (seen.has(key)) continue;
    seen.add(key);
    const selector: RelaxedColumnSelector = { name: [{ type: 'exact', value: spec.name }] };
    if (spec.domain && Object.keys(spec.domain).length > 0) {
      selector.domain = spec.domain;
    }
    out.push(selector);
  }
  return out;
}

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    const inputAnchor = getInputAnchorId(data);
    if (inputAnchor === undefined) throw new Error('No input anchor');
    if (data.topClonotypes === undefined) throw new Error('No top clonotypes');

    const rankingOrder = convertRankingOrderUI(data.rankingOrder);
    if (rankingOrder.some((order) => order.value === undefined))
      throw new Error('Incomplete ranking order');
    const filters = convertFilterUI(data.filters);
    if (filters.some((filter) => filter.value === undefined))
      throw new Error('Incomplete filters');

    return {
      defaultBlockLabel: data.defaultBlockLabel,
      customBlockLabel: data.customBlockLabel,
      inputAnchor,
      inputFilter: getInputFilterId(data),
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
  .output('datasetOptions', (ctx) => {
    const opts = buildDatasetOptions(ctx, {
      primary: (spec: PObjectSpec): boolean => {
        if (!isPColumnSpec(spec)) return false;
        if (spec.annotations?.['pl7.app/isAnchor'] !== 'true') return false;
        if (spec.axesSpec.length < 2) return false;
        if (spec.axesSpec[0]?.name !== 'pl7.app/sampleId') return false;
        const rowAxis = spec.axesSpec[1]?.name;
        return rowAxis === 'pl7.app/vdj/clonotypeKey'
          || rowAxis === 'pl7.app/vdj/scClonotypeKey'
          || rowAxis === 'pl7.app/variantKey';
      },
    });
    if (!opts) return opts;

    // selfBlockId only exists once the block has produced outputs at least
    // once. Before that there are no self-filter entries to drop anyway.
    const selfBlockId = ctx.outputs?.resolve({
      field: 'selfBlockId',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getDataAsJson<string>();
    if (selfBlockId === undefined) return opts;

    return opts.map((opt) => {
      const filtered = opt.filters?.filter((f) => f.ref.blockId !== selfBlockId);
      return {
        ...opt,
        filters: filtered && filtered.length > 0 ? filtered : undefined,
      };
    });
  })

  .output('inputAnchorSpec', (ctx) => {
    const id = getInputAnchorId(ctx.data);
    if (id === undefined) return undefined;
    return Column(id)?.getSpec();
  }, { retentive: true })

  .output('modality', (ctx) => {
    const id = getInputAnchorId(ctx.data);
    if (id === undefined) return undefined;
    const spec = Column(id)?.getSpec();
    if (!spec) return undefined;
    return spec.axesSpec[1]?.name === 'pl7.app/variantKey' ? 'peptide' : 'antibody_tcr';
  }, { retentive: true })

  // Combined filter config - options and defaults together for atomic updates
  .output('filterConfig', (ctx) => {
    const anchorId = getInputAnchorId(ctx.data);
    const result = buildCollection(ctx, anchorId);
    if (!result || anchorId === undefined) return undefined;

    const columns = result.meta.allMatches;
    const labeled = deriveDistinctLabels(columns.map((c) => c.getSpec()), { includeNativeLabel: true });
    const options = labeled.map((label, i) => ({
      label,
      value: recipeToColumnId(columns[i], anchorId),
    }));

    return {
      options,
      defaults: result.meta.defaultFilters,
      inVivoDefaults: result.meta.inVivoDefaults.filters,
      inVitroDefaults: result.meta.inVitroDefaults.filters,
      inPeptideDefaults: result.meta.inPeptideDefaults.filters,
    };
  }, { retentive: true })

  // Combined ranking config - options and defaults together for atomic updates
  .output('rankingConfig', (ctx) => {
    const anchorId = getInputAnchorId(ctx.data);
    const result = buildCollection(ctx, anchorId);
    if (!result || anchorId === undefined) return undefined;

    const rankable = result.meta.allMatches.filter(
      (c) => c.getSpec().valueType !== 'String',
    );
    const labeled = deriveDistinctLabels(rankable.map((c) => c.getSpec()), { includeNativeLabel: true });
    const options = labeled.map((label, i) => ({
      label,
      value: recipeToColumnId(rankable[i], anchorId),
    }));

    if (result.meta.hasInVivoScore) {
      options.unshift({
        label: 'In Vivo Score',
        value: {
          anchorRef: anchorId,
          anchorName: 'main',
          column: IN_VIVO_SCORE_COLUMN_ID,
        },
      });
    }

    return {
      options,
      defaults: result.meta.defaultRankingOrder,
      inVivoDefaults: result.meta.inVivoDefaults.rankingOrder,
      inVitroDefaults: result.meta.inVitroDefaults.rankingOrder,
      inPeptideDefaults: result.meta.inPeptideDefaults.rankingOrder,
    };
  }, { retentive: true })

  .output('presetConfig', (ctx) => {
    const result = buildCollection(ctx, getInputAnchorId(ctx.data));
    if (!result) return undefined;

    return {
      detectedPreset: result.meta.detectedPreset,
      hasInVivoScore: result.meta.hasInVivoScore,
      hasEnrichmentScores: result.meta.hasEnrichmentScores,
    };
  }, { retentive: true })

  .outputWithStatus('pf', (ctx) => {
    const anchorId = getInputAnchorId(ctx.data);
    if (anchorId === undefined) return undefined;

    const anchorSpec = Column(anchorId)?.getSpec();
    if (!anchorSpec) return undefined;

    const anchorClonotypeAxisName = anchorSpec.axesSpec[1]?.name;
    if (!anchorClonotypeAxisName) return undefined;
    const sampleAxisName = anchorSpec.axesSpec[0].name;

    // Restrict MSA to columns sharing the input-anchor clonotype axis (main
    // dataset only). Cross-axis SC columns are excluded so PFrame never has
    // to join disjoint axes for MSA. Drop per-sample columns (axis set
    // contains sampleAxis) — they'd duplicate rows in the alignment.
    const msaRecipes = ColumnsCollection(['result_pool'])
      .discover({
        anchors: { main: anchorSpec },
        mode: 'enrichment',
        exclude: [{ annotations: { 'pl7.app/isLinkerColumn': 'true' } }],
      })
      .filter({
        include: {
          axes: [{ name: [{ type: 'exact', value: anchorClonotypeAxisName }] }],
          partialAxesMatch: true,
        },
        exclude: {
          axes: [{ name: [{ type: 'exact', value: sampleAxisName }] }],
          partialAxesMatch: true,
        },
      })
      .getColumns()
      .filter((c) => {
        const spec = c.getSpec();
        return !isHiddenFromUIColumn(spec) && !isHiddenFromGraphColumn(spec);
      });

    return ctx.createPFrame(msaRecipes.map((c) => c.id));
  })

  // Use the cdr3LengthsCalculated cols
  .outputWithStatus('spectratypePf', (ctx) => {
    const accessor = ctx.outputs?.resolve({
      field: 'cdr3VspectratypePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });
    if (accessor === undefined) return undefined;
    const pCols = recipesToPColumns(ColumnsCollection([accessor]).getColumns());
    if (pCols === undefined) return undefined;
    return createPFrameForGraphs(ctx, pCols);
  })

  // Use the cdr3LengthsCalculated cols
  .outputWithStatus('vjUsagePf', (ctx) => {
    const accessor = ctx.outputs?.resolve({
      field: 'vjUsagePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });
    if (accessor === undefined) return undefined;
    const pCols = recipesToPColumns(ColumnsCollection([accessor]).getColumns());
    if (pCols === undefined) return undefined;
    return createPFrameForGraphs(ctx, pCols);
  })

  .outputWithStatus('selectionStagePf', (ctx) => {
    const accessor = ctx.outputs?.resolve({
      field: 'selectionStagePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });
    if (accessor === undefined) return undefined;
    const pCols = recipesToPColumns(ColumnsCollection([accessor]).getColumns());
    if (pCols === undefined) return undefined;
    return createPFrameForGraphs(ctx, pCols);
  })

  .outputWithStatus('table', (ctx) => {
    const anchorId = ctx.activeArgs?.inputAnchor;
    if (!anchorId) return undefined;

    // Don't render table until workflow has been executed
    if (!ctx.outputs) return undefined;

    const anchorSpec = Column(anchorId)?.getSpec();
    if (!anchorSpec) return undefined;

    // Resolve the sampledRows output as a column source
    const sampledRowsAccessor = ctx.outputs.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });
    if (sampledRowsAccessor === undefined) return undefined;

    const sampledRowsCollection = ColumnsCollection([sampledRowsAccessor]);
    const sampledRowsAreFinal = sampledRowsCollection.isFinal();
    if (!sampledRowsAreFinal) return undefined;

    const leadSelectionCol = sampledRowsCollection
      .filter({ include: { name: [{ type: 'exact', value: 'pl7.app/lead-selection' }] } })
      .getColumns()[0];
    if (!leadSelectionCol || !isLeafColumn(leadSelectionCol)) return undefined;

    // Verify sampledRows belong to current inputAnchor by checking axes
    const leadSelectionSpec = leadSelectionCol.getSpec();
    const clonotypeAxisMatches = leadSelectionSpec.axesSpec.some(
      (axis) => JSON.stringify(axis) === JSON.stringify(anchorSpec.axesSpec[1]),
    );
    if (!clonotypeAxisMatches) return undefined;

    const assemblingKabatAccessor = ctx.outputs.resolve({
      field: 'assemblingKabatPf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });

    // Sort by ranking-order column (from sampledRows). V3 remaps the ID via originalId.
    const rankingOrderCol = sampledRowsCollection
      .filter({ include: { name: [{ type: 'exact', value: 'pl7.app/ranking-order' }] } })
      .getColumns()[0];
    const sorting: PTableSorting[] | undefined = rankingOrderCol
      ? [{
          column: { type: 'column', id: rankingOrderCol.id },
          ascending: true,
          naAndAbsentAreLeastValues: false,
        }]
      : undefined;

    // Discover the candidate table columns. The leadSelectionCol anchor has
    // [clonotypeKey] axis only, so the inner join core is keyed by
    // clonotypeKey (no sampleId duplication).
    const tableSources: Parameters<typeof ColumnsCollection>[0] = [
      'result_pool',
      sampledRowsAccessor,
    ];
    if (assemblingKabatAccessor) tableSources.push(assemblingKabatAccessor);

    // Host-side exclusions: drop File-typed columns and self-trace columns
    // (avoid cycles with previous outputs of this block).
    const discoveredCols = ColumnsCollection(tableSources)
      .discover({
        anchors: { main: leadSelectionCol.getSpec() },
        mode: 'enrichment',
        exclude: [{ annotations: { [Annotation.Trace]: '.*antibody-tcr-lead-selection.*' } }],
      })
      .getColumns();

    // Primary must be leaf-form only — multi-axis Discovered hits would break
    // the engine join (`axes sets are disjoint`). Prefer the lead-selection
    // recipe surfaced by discover; fall back to the original leaf otherwise.
    const leadSelectionId = leadSelectionCol.id;
    const primaryFromDiscover = discoveredCols.filter(
      (c) => c.id === leadSelectionId && isLeafColumn(c),
    );
    const primary: ColumnRecipe[] = primaryFromDiscover.length > 0
      ? primaryFromDiscover
      : [leadSelectionCol];

    const primaryIds = new Set(primary.map((c) => c.id));
    const secondary = discoveredCols.filter((c) => !primaryIds.has(c.id));

    // Build filter/rank id sets and lift them to selector form for the V3
    // display rules — `match` is ColumnSelector, not a lambda.
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
    const filterRankIds = new Set<string>([...filterColumnIds, ...rankingColumnIds]);
    const kabatEnabled = ctx.activeArgs?.kabatNumbering ?? false;

    const collectionResult = buildCollection(ctx, anchorId);
    const filterRankSelectorsList = collectionResult
      ? filterRankSelectors(collectionResult.meta.allMatches, filterRankIds)
      : [];

    // Catch-all selectors for the "main sequence + amino-acid alphabet" group
    // (vdj + peptide variants) shared by ordering and visibility rules.
    const mainAaVdjSelector: RelaxedColumnSelector = {
      domain: { 'pl7.app/alphabet': 'aminoacid' },
      annotations: {
        'pl7.app/vdj/isAssemblingFeature': 'true',
        'pl7.app/vdj/isMainSequence': 'true',
      },
    };
    const mainAaPeptideSelector: RelaxedColumnSelector = {
      domain: { 'pl7.app/alphabet': 'aminoacid' },
      annotations: {
        'pl7.app/isAssemblingFeature': 'true',
        'pl7.app/isMainSequence': 'true',
      },
    };

    // Label columns on the row axis (clonotypeKey / scClonotypeKey / variantKey).
    const rowLabelSelectors: RelaxedColumnSelector[] = [
      'pl7.app/vdj/clonotypeKey',
      'pl7.app/vdj/scClonotypeKey',
      'pl7.app/variantKey',
    ].map((axisName) => ({
      name: [{ type: 'exact', value: Annotation.Label }],
      axes: [{ name: [{ type: 'exact', value: axisName }] }],
    }));

    const visibilityDefault: RelaxedColumnSelector[] = [
      { name: [{ type: 'exact', value: 'pl7.app/ranking-order' }] },
      { name: [{ type: 'exact', value: 'pl7.app/vdj/inVivoScore' }] },
      ...rowLabelSelectors,
      mainAaVdjSelector,
      mainAaPeptideSelector,
      ...filterRankSelectorsList,
    ];
    if (kabatEnabled) {
      // Selectors match values as regex — anchor prefix with `^`.
      visibilityDefault.push({ name: '^pl7\\.app/vdj/kabatSequence' });
    }

    return createPlDataTableV3(ctx, {
      primaryColumns: primary,
      columns: secondary,
      tableState: ctx.data.tableState,
      primaryJoinType: 'full',
      sorting,
      labelsOptions: {
        formatters: {
          linker: (labels, spec) =>
            (spec as PColumnSpec).axesSpec.some((a) => isClusterIdAxisName(a.name))
              ? undefined
              : `via ${labels.join(' > ')}`,
        },
      },
      displayOptions: {
        ordering: [
          { match: rowLabelSelectors, priority: 1000000 },
          { match: [mainAaVdjSelector, mainAaPeptideSelector], priority: 999000 },
          ...(filterRankSelectorsList.length > 0
            ? [{ match: filterRankSelectorsList, priority: 7000 }]
            : []),
        ],
        visibility: [
          { match: visibilityDefault, visibility: 'default' },
          // Clone-to-cluster mapping (name: pl7.app/clusterId, axes: [clonotypeKey])
          // is always hidden — it duplicates the clusterId axis label column.
          {
            match: [
              { name: [{ type: 'exact', value: 'pl7.app/clusterId' }] },
              { name: [{ type: 'exact', value: 'pl7.app/vdj/clusterId' }] },
            ],
            visibility: 'hidden',
          },
          // Linker columns are always hidden — V3 manages those internally.
          {
            match: { annotations: { 'pl7.app/isLinkerColumn': 'true' } },
            visibility: 'hidden',
          },
          // Catch-all: everything else optional.
          { match: {}, visibility: 'optional' },
        ],
      },
    });
  })

  .output('calculating', (ctx) => {
    if (getInputAnchorId(ctx.data) === undefined)
      return false;

    if (!ctx.outputs) return false;

    const outputsState = ctx.outputs.getIsReadyOrError();
    if (outputsState === false) return true;

    return false;
  })

  // Use UMAP output from ctx from clonotype-space block
  .outputWithStatus('umapPf', (ctx) => {
    const anchorId = getInputAnchorId(ctx.data);
    if (anchorId === undefined) return undefined;

    const anchorSpec = Column(anchorId)?.getSpec();
    if (!anchorSpec) return undefined;
    const rowAxisName = anchorSpec.axesSpec[1]?.name;
    if (!rowAxisName) return undefined;

    const umap = ColumnsCollection(['result_pool'])
      .discover({
        anchors: { main: anchorSpec },
        include: {
          name: [
            { type: 'exact', value: 'pl7.app/umap1' },
            { type: 'exact', value: 'pl7.app/umap2' },
          ],
          axes: [{ name: [{ type: 'exact', value: rowAxisName }] }],
          partialAxesMatch: true,
        },
      })
      .getColumns();

    if (umap.length === 0) return undefined;

    const umapPCols = recipesToPColumns(umap);
    if (umapPCols === undefined) return undefined;

    const sampledRowsAccessor = ctx.outputs?.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });
    const sampledRowsPCols = sampledRowsAccessor
      ? recipesToPColumns(ColumnsCollection([sampledRowsAccessor]).getColumns())
      : [];
    if (sampledRowsPCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, [...umapPCols, ...sampledRowsPCols]);
  })

  .outputWithStatus('umapPcols', (ctx) => {
    const anchorId = getInputAnchorId(ctx.data);
    if (anchorId === undefined) return undefined;

    const anchorSpec = Column(anchorId)?.getSpec();
    if (!anchorSpec) return undefined;
    const rowAxisName = anchorSpec.axesSpec[1]?.name;
    if (!rowAxisName) return undefined;

    const umap = ColumnsCollection(['result_pool'])
      .discover({
        anchors: { main: anchorSpec },
        include: {
          name: [
            { type: 'exact', value: 'pl7.app/umap1' },
            { type: 'exact', value: 'pl7.app/umap2' },
          ],
          axes: [{ name: [{ type: 'exact', value: rowAxisName }] }],
          partialAxesMatch: true,
        },
      })
      .getColumns();

    if (umap.length === 0) return undefined;

    const sampledRowsAccessor = ctx.outputs?.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });
    const sampledRows = sampledRowsAccessor
      ? ColumnsCollection([sampledRowsAccessor]).getColumns()
      : [];

    return [...umap, ...sampledRows]
      .map((c) =>
        ({
          columnId: c.id as PObjectId,
          spec: c.getSpec(),
        } satisfies PColumnIdAndSpec),
      );
  })

  .output('hasClusterData', (ctx) => {
    const result = buildCollection(ctx, getInputAnchorId(ctx.data));
    if (!result) return false;

    return result.meta.allMatches.some((c) =>
      c.getSpec().axesSpec.some((a) => isClusterIdAxisName(a.name)),
    );
  })

  .output('clusterColumnOptions', (ctx) => {
    const anchorId = getInputAnchorId(ctx.data);
    if (anchorId === undefined) return undefined;

    const anchorSpec = Column(anchorId)?.getSpec();
    if (anchorSpec === undefined) return undefined;

    const clonotypeAxisName = anchorSpec.axesSpec[1]?.name;
    if (clonotypeAxisName === undefined) return undefined;

    // Discover linker columns that touch both the clonotype row axis and a
    // cluster-id axis (in either order). Names are matched via regex on the
    // cluster-id axis to cover both prefixed and unprefixed clusterId forms.
    const linkers = ColumnsCollection(['result_pool']).filter({
      include: {
        annotations: { 'pl7.app/isLinkerColumn': 'true' },
        axes: [
          { name: [{ type: 'exact', value: clonotypeAxisName }] },
          { name: '^pl7\\.app/(vdj/)?clusterId$' },
        ],
      },
    });

    const baseOptions = deriveColumnOptions(linkers, {
      forceTraceElements: CLUSTERING_TRACE_TYPES,
    });
    if (baseOptions.length === 0) return undefined;

    // Override the derived label with the clustering trace element's own
    // label when available — avoids verbose disambiguation when multiple
    // vdj-integration linkers exist in the pool.
    const options = baseOptions.map((opt) => {
      const linkerSpec = Column(opt.id)?.getSpec();
      let label = opt.label || 'Cluster';
      if (linkerSpec) {
        try {
          const trace = JSON.parse(
            linkerSpec.annotations?.[Annotation.Trace] ?? '[]',
          ) as { type?: string; label?: string }[];
          const clusteringElement = trace.find(
            (t) => CLUSTERING_TRACE_TYPES.includes(t.type ?? ''),
          );
          if (clusteringElement?.label) label = clusteringElement.label;
        } catch { /* keep derived label */ }
      }
      return { label, id: opt.id };
    });

    return options.length > 0 ? options : undefined;
  })

  .output('kabatWarning', (ctx) => {
    if (!ctx.data.kabatNumbering) return undefined;
    const numbered = parseInt(ctx.outputs?.resolve({ field: 'kabatStatsContent', assertFieldType: 'Input', allowPermanentAbsence: true })?.getDataAsString() ?? '', 10);
    if (Number.isNaN(numbered)) return undefined;
    if (numbered === 0) {
      return 'Kabat numbering could not be applied to any clonotype. The framework regions may be too divergent from known germline sequences. Kabat sequence columns will be empty.';
    }
    return `Kabat numbering was applied to ${numbered.toLocaleString()} clonotype${numbered === 1 ? '' : 's'}. Clonotypes that could not be numbered will have empty Kabat sequence columns.`;
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title(() => 'Lead Selection')

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel)

  .sections((ctx) => {
    const id = getInputAnchorId(ctx.data);
    const isPeptide = id !== undefined
      && Column(id)?.getSpec()?.axesSpec[1]?.name === 'pl7.app/variantKey';

    const sections: Array<{ type: 'link'; href: `/${string}`; label: string }> = [
      { type: 'link', href: '/', label: strings.titles.main },
      { type: 'link', href: '/umap', label: isPeptide ? 'Peptide Space' : 'Clonotype Space' },
      { type: 'link', href: '/selection', label: 'Selection Plot' },
    ];
    if (!isPeptide) {
      sections.push(
        { type: 'link', href: '/spectratype', label: 'CDR3 V Spectratype' },
        { type: 'link', href: '/usage', label: 'V/J Gene Usage' },
      );
    }
    return sections;
  })

  .done();
