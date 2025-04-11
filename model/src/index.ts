import type { InferOutputsType, PlDataTableState, PlRef, PlTableFiltersModel } from '@platforma-sdk/model';
import { BlockModel, createPlDataTable } from '@platforma-sdk/model';

export type BlockArgs = {
  name?: string;
  inputAnchor?: PlRef;
  // clonotypingRunId?: string;
  // nClonotypesCluster?: number;
  frequencyScore?: number;
  enrichmentScore?: number;
  liabilitiesScore: string[];
  title?: string;
};

export type UiState = {
  title?: string;
  tableState: PlDataTableState;
  filterModel?: PlTableFiltersModel;
  settingsOpen: boolean;
  // graphStateUMAP: GraphMakerState;
};

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
    liabilitiesScore: ['None'],
  })

  .withUiState<UiState>({
    title: 'Top Antibodies',
    settingsOpen: true,
    tableState: {
      gridState: {},
    },
    // graphStateUMAP: {
    //   title: 'UMAP',
    //   template: 'dots',
    // },
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
    }]),
  )

  .output('anchorSpecs', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    return ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
  })

  .output('filterColumn', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const inputAnchorDomain = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor)?.domain;
    if (inputAnchorDomain === undefined) return undefined;

    const pCols = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [
        // second column condition (OR logic) will take any PCol satisfying below specs that have ONE axis
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': inputAnchorDomain['pl7.app/vdj/clonotypingRunId'],
            },
          }, {}],
          annotations: {
            'pl7.app/vdj/isScore': 'true',
          },
          name: 'pl7.app/vdj/enrichment',
        },
      ],
    );

    if (pCols === undefined || pCols.length === 0) return undefined;

    return pCols[0];
  })

  .output('scoresTable', (ctx) => {
    if (ctx.args.inputAnchor === undefined) return undefined;
    const inputSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
    // Old MiXCR versions
    let clonotypingRunId = inputSpec?.domain?.['pl7.app/vdj/clonotypingRunId'];
    // New MiXCR versions
    if (clonotypingRunId === undefined) {
      clonotypingRunId = inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/clonotypingRunId'];
    }
    if (clonotypingRunId === undefined) return undefined;
    const pCols = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [
        // first column condition will take any PCol satisfying below specs that have TWO axes
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
            },
          }, {}],
          annotations: {
            'pl7.app/vdj/isScore': 'true',
          },
        },
        // second column condition (OR logic) will take any PCol satisfying below specs that have ONE axes
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
            },
          }],
          annotations: {
            'pl7.app/vdj/isScore': 'true',
          },
        },
      ],
    );

    if (pCols === undefined) return undefined;

    const scoresTable = createPlDataTable(
      ctx,
      pCols,
      ctx.uiState.tableState,
      { filters: ctx.uiState.filterModel?.filters ?? [] },
    );

    return { scoresTable, count: pCols.length };
  })

  .output('test', (ctx) => {
    if (ctx.args.inputAnchor === undefined) return undefined;
    const inputAnchorDomain = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor)?.domain;
    if (inputAnchorDomain === undefined) return undefined;
    const pCols = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [
        // first column condition will take any PCol satisfying below specs that have TWO axes
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': inputAnchorDomain['pl7.app/vdj/clonotypingRunId'],
            },
          }, {}],
          annotations: {
            'pl7.app/vdj/isScore': 'true',
          },
        },
        // second column condition (OR logic) will take any PCol satisfying below specs that have ONE axis
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': inputAnchorDomain['pl7.app/vdj/clonotypingRunId'],
            },
          }],
          annotations: {
            'pl7.app/vdj/isScore': 'true',
          },
        },
      ],
    );

    if (pCols === undefined) return undefined;
    return pCols;
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Main' },
  ]))

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
