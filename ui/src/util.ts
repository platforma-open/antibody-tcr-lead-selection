import type { PColumnIdAndSpec, PColumnSpec } from '@platforma-sdk/model';

export const isSequenceColumn = (column: PColumnIdAndSpec) => {
  if (!(column.spec.annotations?.['pl7.app/vdj/isAssemblingFeature'] === 'true'))
    return false;

  const isBulkSequence = (column: PColumnSpec) =>
    column.domain?.['pl7.app/alphabet'] === 'aminoacid';
  const isSingleCellSequence = (column: PColumnSpec) =>
    column.domain?.['pl7.app/vdj/scClonotypeChain/index'] === 'primary'
    && column.domain?.['pl7.app/alphabet'] === 'aminoacid'
    // && column.axesSpec.length >= 1
    && column.axesSpec[0].name === 'pl7.app/vdj/scClonotypeKey';

  return isBulkSequence(column.spec) || isSingleCellSequence(column.spec);
};
