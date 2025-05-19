import type { PColumnIdAndSpec, PColumnSpec } from '@platforma-sdk/model';
import { type PlTableFilter, type PTableColumnSpec } from '@platforma-sdk/model';

export const isSequenceColumn = (column: PColumnIdAndSpec) => {
  if (!(column.spec.annotations?.['pl7.app/vdj/isAssemblingFeature'] === 'true'))
    return false;

  const isBulkSequence = (column: PColumnSpec) =>
    column.domain?.['pl7.app/alphabet'] === 'aminoacid';
  const isSingleCellSequence = (column: PColumnSpec) =>
    column.domain?.['pl7.app/vdj/scClonotypeChain/index'] === 'primary'
    // && column.axesSpec.length >= 1
    && column.axesSpec[0].name === 'pl7.app/vdj/scClonotypeKey';

  return isBulkSequence(column.spec) || isSingleCellSequence(column.spec);
};

export const isLabelColumnOption = (_column: PColumnIdAndSpec) => {
  // allow using any column as label
  return true;
};

export const isLinkerColumn = (column: PColumnIdAndSpec) => {
  return column.spec.annotations?.['pl7.app/isLinkerColumn'] === 'true';
};

export function defaultFilters(tSpec: PTableColumnSpec): (PlTableFilter | undefined) {
  console.log('defaultFilters spec', tSpec);
  if (tSpec.type !== 'column') {
    return undefined;
  }

  const spec = tSpec.spec;

  if (spec.annotations?.['pl7.app/isScore'] !== 'true')
    return undefined;

  const valueString = spec.annotations?.['pl7.app/score/defaultCutoff'];
  if (valueString === undefined)
    return undefined;

  if (spec.valueType === 'String') {
    const value = JSON.parse(valueString);
    // should be an array of strings
    if (!Array.isArray(value)) {
      console.error('defaultFilters: invalid string filter', valueString);
      return undefined;
    }
    console.log('defaultFilters: string filter', value);
    return {
      type: 'string_equals',
      reference: value[0], // @TODO: support multiple values
    };
  } else {
    // Assuming non-String valueType implies a number for 'number_greaterThan'
    const numericValue = parseFloat(valueString);
    if (isNaN(numericValue)) {
      console.error('defaultFilters: invalid numeric value', valueString);
      return undefined;
    }

    const direction = spec.annotations?.['pl7.app/score/rankingOrder'] ?? 'increasing';
    if (direction !== 'increasing' && direction !== 'decreasing') {
      console.error('defaultFilters: invalid ranking order', direction);
      return undefined;
    }

    console.log('defaultFilters: number filter', numericValue, direction);
    return {
      type: direction === 'increasing' ? 'number_greaterThanOrEqualTo' : 'number_lessThanOrEqualTo',
      reference: numericValue,
    };
  }
};
