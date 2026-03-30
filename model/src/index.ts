import strings from '@milaboratories/strings';
import type {
  ColumnSource,
  InferHrefType,
  InferOutputsType,
  PColumn,
  PColumnDataUniversal,
  PColumnIdAndSpec,
  PlRef,
} from '@platforma-sdk/model';
import {
  Annotation,
  ArrayColumnProvider,
  BlockModelV3,
  createPFrameForGraphs,
  createPlDataTableV3,
  deriveLabels,
  isHiddenFromGraphColumn,
  isHiddenFromUIColumn,
} from '@platforma-sdk/model';
import { buildCollection, IN_VIVO_SCORE_COLUMN_ID, matchToColumnId } from './util';
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

    // Discover filterable columns — exclude linkers and own trace
    const filterableMatches = result.collection.findColumns({
      mode: 'enrichment',
      exclude: [
        { annotations: { 'pl7.app/isLinkerColumn': 'true' } },
        { annotations: { 'pl7.app/sequence/isAnnotation': 'true' } },
      ],
    }).filter((m) => !m.column.spec.annotations?.[Annotation.Trace]?.includes('antibody-tcr-lead-selection'));

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
      exclude: [
        { annotations: { 'pl7.app/isLinkerColumn': 'true' } },
        { annotations: { 'pl7.app/sequence/isAnnotation': 'true' } },
      ],
    }).filter((m) =>
      m.column.spec.valueType !== 'String'
      && !m.column.spec.annotations?.[Annotation.Trace]?.includes('antibody-tcr-lead-selection'),
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

    // Discover columns for MSA — exclude linkers and hidden columns
    const msaMatches = result.collection.findColumns({
      mode: 'enrichment',
      exclude: [
        { annotations: { 'pl7.app/isLinkerColumn': 'true' } },
      ],
    }).filter((m) => !isHiddenFromUIColumn(m.column.spec) && !isHiddenFromGraphColumn(m.column.spec));

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
      (col) => col.spec.name === 'pl7.app/vdj/lead-selection',
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

    // Build sources: filtered result pool + workflow outputs
    // Exclude columns unsupported by the WASM spec frame:
    // - File value type is not recognized
    // - Linker columns with >2 axes have >2 connected components
    // Wrap in ArrayColumnProvider — V3 only accepts ColumnSnapshotProvider instances
    const resultPoolColumns = ctx.resultPool.selectColumns(
      (spec) => (spec.valueType as string) !== 'File'
        && !(spec.annotations?.['pl7.app/isLinkerColumn'] === 'true' && spec.axesSpec.length > 2),
    );
    const sources: ColumnSource[] = [new ArrayColumnProvider(resultPoolColumns)];
    if (sampledRows) sources.push(new ArrayColumnProvider(sampledRows));
    const kabatCols = assemblingKabatAccessor?.getPColumns();
    if (kabatCols) sources.push(new ArrayColumnProvider(kabatCols));

    return createPlDataTableV3(ctx, {
      source: sources,
      columns: {
        anchors: { main: anchorSpec },
        mode: 'enrichment',
      },
      state: ctx.data.tableState,
      coreColumnPredicate: (col) => col.spec.name === 'pl7.app/vdj/lead-selection',
      coreJoinType: 'inner',
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
          namePattern: '^pl7\\.app/vdj/umap[12]$',
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
          namePattern: '^pl7\\.app/vdj/umap[12]$',
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
      m.column.spec.axesSpec.some((a) => a.name === 'pl7.app/vdj/clusterId'),
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
        if (!linkerSpec?.axesSpec.some((axis) => axis.name === 'pl7.app/vdj/clusterId')) {
          continue;
        }
        options.push({
          label: link.label || 'Cluster',
          ref: link.ref,
        });
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

  .title(() => 'Antibody/TCR Leads')

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
