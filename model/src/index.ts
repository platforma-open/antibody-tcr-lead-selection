import type { InferOutputsType,
  PColumnSpec, PlDataTableState, PlRef, PlTableFiltersModel } from '@platforma-sdk/model';
import { BlockModel, createPlDataTable } from '@platforma-sdk/model';
import type {
  ListOption } from '@platforma-sdk/ui-vue';

// get clonotypingRunId from multiple MiXCR versions
function getinfoData(inputSpec: PColumnSpec | undefined):
{ clonotypingRunId: string; chain: string } | undefined {
  if (inputSpec === undefined) {
    return undefined;
  }
  // Old MiXCR versions
  let clonotypingRunId = inputSpec?.domain?.['pl7.app/vdj/clonotypingRunId'];
  let chain = inputSpec?.domain?.['pl7.app/vdj/chain'];
  // New MiXCR versions
  if (clonotypingRunId === undefined) {
    clonotypingRunId = inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/clonotypingRunId'];
    chain = inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/chain'];
  }

  if (clonotypingRunId === undefined || chain === undefined) {
    return undefined;
  }
  return { clonotypingRunId, chain };
}

export type BlockArgs = {
  name?: string;
  inputAnchor?: PlRef;
  // clonotypingRunId?: string;
  // nClonotypesCluster?: number;
  title?: string;
};

export type UiState = {
  title?: string;
  tableState: PlDataTableState;
  filterModel?: PlTableFiltersModel;
  settingsOpen: boolean;
  frequencyScoreThreshold: number;
  enrichmentScoreThreshold: number;
  liabilitiesScore: string[];
  condition: string[];
  conditionList?: ListOption<string>[];
  // graphStateUMAP: GraphMakerState;
};

export const model = BlockModel.create()

  .withArgs<BlockArgs>({
  })

  .withUiState<UiState>({
    title: 'Top Antibodies',
    settingsOpen: true,
    tableState: {
      gridState: {},
    },
    enrichmentScoreThreshold: 0,
    frequencyScoreThreshold: 0,
    liabilitiesScore: [],
    condition: [],
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

  .output('enrichmentScoreColumn', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const result = getinfoData(ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor));
    const clonotypingRunId = result?.clonotypingRunId;
    if (clonotypingRunId === undefined) return undefined;
    const pCols = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [
        // second column condition (OR logic) will take any PCol satisfying below specs that have ONE axis
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
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

  .output('frequencyScoreColumn', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const result = getinfoData(ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor));
    const clonotypingRunId = result?.clonotypingRunId;
    if (clonotypingRunId === undefined) return undefined;

    const pCols = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [
        // second column condition (OR logic) will take any PCol satisfying below specs that have ONE axis
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
            },
          }, {}],
          annotations: {
            'pl7.app/vdj/isScore': 'true',
          },
          name: 'pl7.app/vdj/frequency',
        },
      ],
    );

    if (pCols === undefined || pCols.length === 0) return undefined;

    return pCols[0];
  })

  .output('Cdr3SeqAaColumn', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const result = getinfoData(ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor));
    const clonotypingRunId = result?.clonotypingRunId;
    const chain = result?.chain;
    if (clonotypingRunId === undefined || chain == undefined) return undefined;

    const pCols = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [
        // second column condition (OR logic) will take any PCol satisfying below specs that have ONE axis
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
              'pl7.app/vdj/chain': chain,
            },
          }],
          domain: {
            'pl7.app/alphabet': 'aminoacid',
            'pl7.app/vdj/feature': 'CDR3',
          },
          name: 'pl7.app/vdj/sequence',
        },
      ],
    );

    if (pCols === undefined || pCols.length === 0) return undefined;

    return pCols[0];
  })

  .output('liabilitiesColumn', (ctx) => {
    if (ctx.args.inputAnchor === undefined)
      return undefined;
    const result = getinfoData(ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor));
    const clonotypingRunId = result?.clonotypingRunId;
    if (clonotypingRunId === undefined) return undefined;

    const pCols = ctx.resultPool.getAnchoredPColumns(
      { main: ctx.args.inputAnchor },
      [
        // second column condition (OR logic) will take any PCol satisfying below specs that have ONE axis
        {
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
            },
          }],
          annotations: {
            'pl7.app/vdj/isScore': 'true',
          },
          name: 'pl7.app/vdj/liabilitiesRisk',
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
    let chain = inputSpec?.domain?.['pl7.app/vdj/chain'];
    // New MiXCR versions
    if (clonotypingRunId === undefined) {
      clonotypingRunId = inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/clonotypingRunId'];
      chain = inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/chain'];
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
        // CDR3 aa sequence bulk data new MiXCR
        {
          annotationPatterns: {
            'pl7.app/label': 'CDR3 aa',
          },
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
              'pl7.app/vdj/chain': chain ?? '',
            },
          }],
        },
        // CDR3 aa sequence bulk data old MiXCR
        {
          annotationPatterns: {
            'pl7.app/label': 'CDR3 aa',
          },
          domain: {
            'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
            'pl7.app/vdj/chain': chain ?? '',
          },
        },
        // @TODO: Look only for the chains on which we ran clustering
        // CDR3 aa sequence sc data new MiXCR
        {
          annotationPatterns: {
            'pl7.app/label': 'CDR3 aa Primary',
          },
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
              'pl7.app/vdj/receptor': inputSpec?.domain?.['pl7.app/vdj/receptor'] ?? '',
            },
          }],
        },
        // CDR3 aa sequence sc data old MiXCR
        {
          annotationPatterns: {
            'pl7.app/label': 'CDR3 aa Primary',
          },
          domain: {
            'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
            'pl7.app/vdj/receptor': inputSpec?.domain?.['pl7.app/vdj/receptor'] ?? '',
          },
        },
        // scFc new version (length Pcolumns are empty)
        // {
        //   annotationPatterns: {
        //     'pl7.app/label': 'CDR3 aa',
        //   },
        //   domain: {
        //     'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
        //   },
        //   axes: [{
        //     domain: {
        //       'pl7.app/vdj/receptor': inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/receptor'] ?? '',
        //     },
        //   }],
        // },
      ],
    );

    if (pCols === undefined) return undefined;

    // Check and modify pColumn to solve compatibility issues between MiXCR versions and packages
    // @TODO: Remove when new version specs get consensuated
    for (const p of pCols) {
      const runIdtemp = p.spec?.domain?.['pl7.app/vdj/clonotypingRunId'];
      const chaintemp = p.spec?.domain?.['pl7.app/vdj/chain'];
      if (p.spec?.axesSpec?.[0].domain) {
        if (runIdtemp) {
          p.spec.axesSpec[0].domain['pl7.app/vdj/clonotypingRunId'] = runIdtemp;
        }
        if (chaintemp) {
          p.spec.axesSpec[0].domain['pl7.app/vdj/chain'] = chaintemp;
        }
      }
    }

    const scoresTable = createPlDataTable(
      ctx,
      pCols,
      ctx.uiState.tableState,
      { filters: ctx.uiState.filterModel?.filters ?? [] },
    );

    return { scoresTable, count: pCols.length };
  })

  .output('scoresPf', (ctx) => {
    if (ctx.args.inputAnchor === undefined) return undefined;
    const inputSpec = ctx.resultPool.getPColumnSpecByRef(ctx.args.inputAnchor);
    // Old MiXCR versions
    let clonotypingRunId = inputSpec?.domain?.['pl7.app/vdj/clonotypingRunId'];
    let chain = inputSpec?.domain?.['pl7.app/vdj/chain'];
    // New MiXCR versions
    if (clonotypingRunId === undefined) {
      clonotypingRunId = inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/clonotypingRunId'];
      chain = inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/chain'];
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
        // CDR3 aa sequence bulk data new MiXCR
        {
          annotationPatterns: {
            'pl7.app/label': 'CDR3 aa',
          },
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
              'pl7.app/vdj/chain': chain ?? '',
            },
          }],
        },
        // CDR3 aa sequence bulk data old MiXCR
        {
          annotationPatterns: {
            'pl7.app/label': 'CDR3 aa',
          },
          domain: {
            'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
            'pl7.app/vdj/chain': chain ?? '',
          },
        },
        // @TODO: Look only for the chains on which we ran clustering
        // CDR3 aa sequence sc data new MiXCR
        {
          annotationPatterns: {
            'pl7.app/label': 'CDR3 aa Primary',
          },
          axes: [{
            domain: {
              'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
              'pl7.app/vdj/receptor': inputSpec?.domain?.['pl7.app/vdj/receptor'] ?? '',
            },
          }],
        },
        // CDR3 aa sequence sc data old MiXCR
        {
          annotationPatterns: {
            'pl7.app/label': 'CDR3 aa Primary',
          },
          domain: {
            'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
            'pl7.app/vdj/receptor': inputSpec?.domain?.['pl7.app/vdj/receptor'] ?? '',
          },
        },
        // scFc new version (length Pcolumns are empty)
        // {
        //   annotationPatterns: {
        //     'pl7.app/label': 'CDR3 aa',
        //   },
        //   domain: {
        //     'pl7.app/vdj/clonotypingRunId': clonotypingRunId,
        //   },
        //   axes: [{
        //     domain: {
        //       'pl7.app/vdj/receptor': inputSpec?.axesSpec[1]?.domain?.['pl7.app/vdj/receptor'] ?? '',
        //     },
        //   }],
        // },
      ],
    );

    if (pCols === undefined) return undefined;

    // Check and modify pColumn to solve compatibility issues between MiXCR versions and packages
    // @TODO: Remove when new version specs get consensuated
    for (const p of pCols) {
      const runIdtemp = p.spec?.domain?.['pl7.app/vdj/clonotypingRunId'];
      const chaintemp = p.spec?.domain?.['pl7.app/vdj/chain'];
      if (p.spec?.axesSpec?.[0].domain) {
        if (runIdtemp) {
          p.spec.axesSpec[0].domain['pl7.app/vdj/clonotypingRunId'] = runIdtemp;
        }
        if (chaintemp) {
          p.spec.axesSpec[0].domain['pl7.app/vdj/chain'] = chaintemp;
        }
      }
    }
    return ctx.createPFrame(pCols);
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .sections((_ctx) => ([
    { type: 'link', href: '/', label: 'Main' },
  ]))

  .done();

export type BlockOutputs = InferOutputsType<typeof model>;
