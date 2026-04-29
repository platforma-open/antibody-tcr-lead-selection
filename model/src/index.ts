import strings from '@milaboratories/strings';
import type {
  ColumnSource,
  InferHrefType,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PColumnIdAndSpec,
  PColumnSpec,
  PlRef,
  PTableSorting,
} from '@platforma-sdk/model';
import {
  Annotation,
  ArrayColumnProvider,
  BlockModelV3,
  canonicalizeJson,
  createPFrameForGraphs,
  createPlDataTableV3,
  deriveLabels,
  isHiddenFromGraphColumn,
  isHiddenFromUIColumn,
} from '@platforma-sdk/model';
import { buildCollection, commonExcludeSelectors, IN_VIVO_SCORE_COLUMN_ID, isSelectableMatch, matchToColumnId } from './util';
import { convertFilterUI, convertRankingOrderUI } from './converters';
import { blockDataModel } from './dataModel';
import type { BlockArgs } from './types';

export * from './types';
export * from './converters';
export { getDefaultBlockLabel } from './util';
export { blockDataModel } from './dataModel';
export type Href = InferHrefType<typeof platforma>;
export type BlockOutputs = InferOutputsType<typeof platforma>;

export const platforma = BlockModelV3.create(blockDataModel)

  .args<BlockArgs>((data) => {
    if (data.inputAnchor === undefined) throw new Error('No input anchor');
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
      inputAnchor: data.inputAnchor,
      topClonotypes: data.topClonotypes,
      rankingOrder,
      filters,
      kabatNumbering: data.kabatNumbering,
      diversificationColumn: data.diversificationColumn,
    };
  })

  .output('inputOptions', (ctx) =>
    ctx.resultPool.getOptions([{
      axes: [
        { name: 'pl7.app/sampleId' },
        { name: 'pl7.app/vdj/clonotypeKey' },
      ],
      annotations: { 'pl7.app/isAnchor': 'true' },
    }, {
      axes: [
        { name: 'pl7.app/sampleId' },
        { name: 'pl7.app/vdj/scClonotypeKey' },
      ],
      annotations: { 'pl7.app/isAnchor': 'true' },
    }], { refsWithEnrichments: true }),
  )

  .output('inputAnchorSpec', (ctx) => {
    const ref = ctx.data.inputAnchor;
    if (ref === undefined) return undefined;
    return ctx.resultPool.getPColumnSpecByRef(ref);
  }, { retentive: true })

  // Combined filter config - options and defaults together for atomic updates
  .output('filterConfig', (ctx) => {
    const result = buildCollection(ctx, ctx.data.inputAnchor);
    if (!result) return undefined;

    const filterableMatches = result.collection.findColumns({
      mode: 'enrichment',
      exclude: commonExcludeSelectors,
    }).filter((m) => isSelectableMatch(m, result.sampleAxisName));

    // deriveLabels replaces getDisambiguatedOptions
    const labeled = deriveLabels(
      filterableMatches,
      (m) => m.column.spec,
      { includeNativeLabel: true },
    );
    const options = labeled.map(({ value, label }) => ({
      label,
      value: matchToColumnId(value, ctx.data.inputAnchor!),
      column: value.column,
    }));

    return {
      options,
      defaults: result.meta.defaultFilters,
      inVivoDefaults: result.meta.inVivoDefaults.filters,
      inVitroDefaults: result.meta.inVitroDefaults.filters,
    };
  }, { retentive: true })

  // Combined ranking config - options and defaults together for atomic updates
  .output('rankingConfig', (ctx) => {
    const result = buildCollection(ctx, ctx.data.inputAnchor);
    if (!result) return undefined;

    const rankableMatches = result.collection.findColumns({
      mode: 'enrichment',
      exclude: commonExcludeSelectors,
    }).filter((m) =>
      isSelectableMatch(m, result.sampleAxisName)
      && m.column.spec.valueType !== 'String',
    );

    const labeled = deriveLabels(
      rankableMatches,
      (m) => m.column.spec,
      { includeNativeLabel: true },
    );
    const options = labeled.map(({ value, label }) => ({
      label,
      value: matchToColumnId(value, ctx.data.inputAnchor!),
    }));

    // Add synthetic In Vivo Score option when mutation columns are present
    if (result.meta.hasInVivoScore) {
      options.unshift({
        label: 'In Vivo Score',
        value: {
          anchorRef: ctx.data.inputAnchor!,
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
    };
  }, { retentive: true })

  .output('presetConfig', (ctx) => {
    const result = buildCollection(ctx, ctx.data.inputAnchor);
    if (!result) return undefined;

    return {
      detectedPreset: result.meta.detectedPreset,
      hasInVivoScore: result.meta.hasInVivoScore,
      hasEnrichmentScores: result.meta.hasEnrichmentScores,
    };
  }, { retentive: true })

  .outputWithStatus('pf', (ctx) => {
    const anchor = ctx.data.inputAnchor;
    if (!anchor) return undefined;

    const result = buildCollection(ctx, anchor);
    if (!result) return undefined;

    // Restrict MSA to columns sharing the input-anchor clonotype axis (main
    // dataset only). Cross-axis SC columns are excluded so PFrame never has
    // to join disjoint axes for MSA. Also drop per-sample columns (axis set
    // contains sampleAxis) — they'd duplicate rows in the alignment.
    const anchorClonotypeAxisName = ctx.resultPool.getPColumnSpecByRef(anchor)
      ?.axesSpec[1]?.name;
    if (!anchorClonotypeAxisName) return undefined;

    const msaMatches = result.collection.findColumns({
      mode: 'enrichment',
      exclude: [
        { annotations: { 'pl7.app/isLinkerColumn': 'true' } },
      ],
    }).filter((m) =>
      !isHiddenFromUIColumn(m.column.spec)
      && !isHiddenFromGraphColumn(m.column.spec)
      && m.column.spec.axesSpec.some((a) => a.name === anchorClonotypeAxisName)
      && !m.column.spec.axesSpec.some((a) => a.name === result.sampleAxisName),
    );

    const pCols: PColumn<PColumnDataUniversal>[] = [];
    for (const m of msaMatches) {
      if (!m.column.data) continue;
      const data = m.column.data.get();
      if (!data) return undefined;
      pCols.push({ id: m.column.id, spec: m.column.spec, data });
    }
    return ctx.createPFrame(pCols);
  })

  // Use the cdr3LengthsCalculated cols
  .outputWithStatus('spectratypePf', (ctx) => {
    const pCols = ctx.outputs?.resolve({
      field: 'cdr3VspectratypePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  // Use the cdr3LengthsCalculated cols
  .outputWithStatus('vjUsagePf', (ctx) => {
    const pCols = ctx.outputs?.resolve({
      field: 'vjUsagePf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    })?.getPColumns();
    if (pCols === undefined) return undefined;

    return createPFrameForGraphs(ctx, pCols);
  })

  .outputWithStatus('table', (ctx) => {
    const anchor = ctx.activeArgs?.inputAnchor;
    if (!anchor) return undefined;

    // Don't render table until workflow has been executed
    if (!ctx.outputs) return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(anchor);
    if (!anchorSpec) return undefined;

    // Resolve the sampledRows output
    const sampledRowsAccessor = ctx.outputs.resolve({
      field: 'sampledRows',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });

    const sampledRows = sampledRowsAccessor?.getPColumns();
    const sampledRowsAreFinal = sampledRowsAccessor?.getIsFinal() ?? false;

    // Don't render table if sampledRows don't exist or aren't finalized
    if (sampledRows === undefined || !sampledRowsAreFinal) {
      return undefined;
    }

    // Verify sampledRows belong to current inputAnchor by checking axes
    const samplingCol = sampledRows.find(
      (col) => col.spec.name === 'pl7.app/lead-selection',
    );
    if (samplingCol !== undefined) {
      const clonotypeAxisMatches = samplingCol.spec.axesSpec.some(
        (axis) => JSON.stringify(axis) === JSON.stringify(anchorSpec.axesSpec[1]),
      );
      if (!clonotypeAxisMatches) {
        return undefined;
      }
    }

    const assemblingKabatAccessor = ctx.outputs?.resolve({
      field: 'assemblingKabatPf',
      assertFieldType: 'Input',
      allowPermanentAbsence: true,
    });

    const resultPoolColumns = ctx.resultPool.selectColumns(
      (spec) => (spec.valueType as string) !== 'File'
        && !(spec.annotations?.['pl7.app/isLinkerColumn'] === 'true' && spec.axesSpec.length > 2)
        && !spec.annotations?.[Annotation.Trace]?.includes('antibody-tcr-lead-selection'),
    );
    const sources: ColumnSource[] = [
      new ArrayColumnProvider(resultPoolColumns),
      new ArrayColumnProvider(sampledRows),
    ];
    if (assemblingKabatAccessor) {
      const kabatCols = assemblingKabatAccessor.getPColumns();
      if (kabatCols) sources.push(new ArrayColumnProvider(kabatCols));
    }

    // Use lead-selection column as anchor — it has [clonotypeKey] axis only,
    // so the inner join core is keyed by clonotypeKey (no sampleId duplication).
    const leadSelectionCol = sampledRows.find(
      (col) => col.spec.name === 'pl7.app/lead-selection',
    );
    if (!leadSelectionCol) return undefined;

    // Build filter/ranking spec lookup for columnsDisplayOptions matchers.
    // Match by spec signature (name + domain) since ColumnMatcher receives spec, not ID.
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

    const collectionResult = buildCollection(ctx, anchor);
    const filterRankSpecs = new Set<string>();
    if (collectionResult) {
      for (const m of collectionResult.meta.allMatches) {
        const idStr = m.column.id as string;
        if (filterColumnIds.has(idStr) || rankingColumnIds.has(idStr)) {
          filterRankSpecs.add(canonicalizeJson({
            name: m.column.spec.name,
            domain: m.column.spec.domain,
          }));
        }
      }
    }
    const isFilterOrRank = (spec: PColumnSpec): boolean =>
      filterRankSpecs.has(canonicalizeJson({ name: spec.name, domain: spec.domain }));

    // Sort by ranking-order column (from sampledRows). V3 remaps the ID via originalId.
    const rankingOrderCol = sampledRows.find(
      (col) => col.spec.name === 'pl7.app/ranking-order',
    );
    const sorting: PTableSorting[] | undefined = rankingOrderCol
      ? [{
          column: { type: 'column', id: rankingOrderCol.id },
          ascending: true,
          naAndAbsentAreLeastValues: false,
        }]
      : undefined;

    return createPlDataTableV3(ctx, {
      columns: {
        sources,
        anchors: { main: leadSelectionCol.spec },
        selector: { mode: 'enrichment' },
      },
      tableState: ctx.data.tableState,
      primaryJoinType: 'full',
      sorting,
      labelsOptions: {
        formatters: {
          linker: (labels, spec) =>
            (spec as PColumnSpec).axesSpec.some((a) => a.name === 'pl7.app/clusterId')
              ? undefined
              : `via ${labels.join(' > ')}`,
        },
      },
      displayOptions: {
        ordering: [
          {
            match: (spec) => spec.name === Annotation.Label
              && spec.axesSpec.length === 1
              && (spec.axesSpec[0].name === 'pl7.app/vdj/clonotypeKey'
                || spec.axesSpec[0].name === 'pl7.app/vdj/scClonotypeKey'),
            priority: 1000000,
          },
          {
            match: (spec) =>
              spec.annotations?.['pl7.app/vdj/isAssemblingFeature'] === 'true'
              && spec.annotations?.['pl7.app/vdj/isMainSequence'] === 'true'
              && spec.domain?.['pl7.app/alphabet'] === 'aminoacid',
            priority: 999000,
          },
          {
            match: isFilterOrRank,
            priority: 7000,
          },
        ],
        visibility: [
          {
            match: (spec) =>
              spec.name === 'pl7.app/ranking-order'
              || spec.name === 'pl7.app/vdj/inVivoScore'
              || isFilterOrRank(spec)
              || (spec.annotations?.['pl7.app/vdj/isAssemblingFeature'] === 'true'
                && spec.annotations?.['pl7.app/vdj/isMainSequence'] === 'true'
                && spec.domain?.['pl7.app/alphabet'] === 'aminoacid')
              || (kabatEnabled && spec.name.startsWith('pl7.app/vdj/kabatSequence')),
            visibility: 'default',
          },
          // Clone-to-cluster mapping (name: pl7.app/clusterId, axes: [clonotypeKey])
          // is always hidden — it duplicates the clusterId axis label column.
          {
            match: (spec) => spec.name === 'pl7.app/clusterId',
            visibility: 'hidden',
          },
          // Catch-all: everything else optional (except linkers — V3 manages those)
          {
            match: (spec) => spec.annotations?.['pl7.app/isLinkerColumn'] !== 'true',
            visibility: 'optional',
          },
        ],
      },
    });
  })

  .output('calculating', (ctx) => {
    if (ctx.data.inputAnchor === undefined)
      return false;

    if (!ctx.outputs) return false;

    const outputsState = ctx.outputs.getIsReadyOrError();
    if (outputsState === false) return true;

    return false;
  })

  // Use UMAP output from ctx from clonotype-space block
  .outputWithStatus('umapPf', (ctx) => {
    const anchor = ctx.data.inputAnchor;
    if (anchor === undefined)
      return undefined;

    const umap = ctx.resultPool.getAnchoredPColumns(
      { main: anchor },
      [
        {
          axes: [{ anchor: 'main', idx: 1 }],
          namePattern: '^pl7\\.app/umap[12]$',
        },
      ],
    );

    if (umap === undefined || umap.length === 0)
      return undefined;

    const sampledRows = ctx.outputs?.resolve({ field: 'sampledRows', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();

    return createPFrameForGraphs(ctx, [...umap, ...(sampledRows ?? [])]);
  })

  .outputWithStatus('umapPcols', (ctx) => {
    const anchor = ctx.data.inputAnchor;
    if (anchor === undefined)
      return undefined;

    const umap = ctx.resultPool.getAnchoredPColumns(
      { main: anchor },
      [
        {
          axes: [{ anchor: 'main', idx: 1 }],
          namePattern: '^pl7\\.app/umap[12]$',
        },
      ],
    );

    if (umap === undefined || umap.length === 0)
      return undefined;

    const sampledRows = ctx.outputs?.resolve({ field: 'sampledRows', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();

    return [...umap, ...(sampledRows ?? [])].map(
      (c) =>
        ({
          columnId: c.id,
          spec: c.spec,
        } satisfies PColumnIdAndSpec),
    );
  })

  .output('hasClusterData', (ctx) => {
    const result = buildCollection(ctx, ctx.data.inputAnchor);
    if (!result) return false;

    return result.meta.allMatches.some((m) =>
      m.column.spec.axesSpec.some((a) => a.name === 'pl7.app/clusterId'),
    );
  })

  .output('clusterColumnOptions', (ctx) => {
    const anchor = ctx.data.inputAnchor;
    if (anchor === undefined)
      return undefined;

    const anchorSpec = ctx.resultPool.getPColumnSpecByRef(anchor);
    if (anchorSpec === undefined)
      return undefined;

    // Get linker columns using the same iteration order as util.ts
    const options: Array<{ label: string; ref: PlRef }> = [];

    for (const idx of [0, 1]) {
      let axesToMatch;
      if (idx === 0) {
        axesToMatch = [{}, anchorSpec.axesSpec[1]];
      } else {
        axesToMatch = [anchorSpec.axesSpec[1], {}];
      }

      const linkers = ctx.resultPool.getOptions([
        {
          axes: axesToMatch,
          annotations: { 'pl7.app/isLinkerColumn': 'true' },
        },
      ], {
        label: {
          forceTraceElements: ['milaboratories.clonotype-clustering.clustering'],
        },
      });

      for (const link of linkers) {
        const linkerSpec = ctx.resultPool.getPColumnSpecByRef(link.ref);
        if (!linkerSpec?.axesSpec.some((axis) => axis.name === 'pl7.app/clusterId')) {
          continue;
        }
        // Extract clustering trace element label directly to avoid verbose
        // disambiguation when vdj-integration linkers are present in the pool.
        let label = 'Cluster';
        try {
          const trace = JSON.parse(linkerSpec.annotations?.['pl7.app/trace'] ?? '[]') as { type?: string; label?: string }[];
          const clusteringElement = trace.find((t) => t.type === 'milaboratories.clonotype-clustering.clustering');
          if (clusteringElement?.label) label = clusteringElement.label;
        } catch { /* use default */ }
        options.push({ label, ref: link.ref });
      }
    }

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

  .sections((_) => {
    return [
      { type: 'link', href: '/', label: strings.titles.main },
      { type: 'link', href: '/umap', label: 'Clonotype Space' },
      { type: 'link', href: '/spectratype', label: 'CDR3 V Spectratype' },
      { type: 'link', href: '/usage', label: 'V/J Gene Usage' },
    ];
  })

  .done();
