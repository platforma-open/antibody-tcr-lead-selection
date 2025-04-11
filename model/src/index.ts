import type { InferOutputsType, PlDataTableState, PlRef } from '@platforma-sdk/model';
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

  .output('scoresTable', (ctx) => {
    if (ctx.args.inputAnchor === undefined) return undefined;
    const inputAnchorDomain = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor)?.domain;
    if (inputAnchorDomain === undefined) return undefined;
    const pCols = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [
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

    const scoresTable = createPlDataTable(
      ctx,
      pCols,
      ctx.uiState.tableState,
    );

    return { scoresTable, count: pCols.length };
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Main' },
  ]))

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
