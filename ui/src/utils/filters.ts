import { type PTableRecordSingleValueFilterV2, type PTableColumnId } from '@platforma-sdk/model';
// import semver from 'semver';

/**
 * Returns a pColumn threshold filter array if conditions are met, otherwise empty array
 */
export function GreaterOrEqualFilter(
  pColumn: { id: string; type?: string } | undefined,
  threshold: number | undefined,
): PTableRecordSingleValueFilterV2[] {
  if (!pColumn || threshold === undefined || !threshold) {
    return [];
  }

  return [{
    type: 'bySingleColumnV2',
    column: { type: 'column', id: pColumn.id } as PTableColumnId,
    predicate: {
      operator: 'GreaterOrEqual',
      reference: threshold,
    },
  }];
}

/**
 * Returns a filtered array without rows having NA in given Pcolumn
 */
export function isNotNaFilter(
  pColumn: { id: string; type?: string } | undefined,
): PTableRecordSingleValueFilterV2[] {
  if (!pColumn) {
    return [];
  }

  return [{
    type: 'bySingleColumnV2',
    column: { type: 'column', id: pColumn.id } as PTableColumnId,
    predicate: {
      operator: 'Not',
      operand: {
        operator: 'IsNA',
      },
    },
  }];
}

/**
 * Returns an array filtered by specif pColumn value
 */
export function equalStringFilter(
  pColumn: { id: string; type?: string } | undefined,
  colVals: string[] | undefined,
): PTableRecordSingleValueFilterV2[] {
  if (!pColumn || colVals === undefined || colVals.length === 0) {
    return [];
  }

  type Operand = {
    operator: 'Equal';
    reference: string;
  };

  const operandList: Operand[] = [];
  for (const col of colVals) {
    operandList.push({
      operator: 'Equal',
      reference: col,
    });
  }
  return [{
    type: 'bySingleColumnV2',
    column: { type: 'column', id: pColumn.id } as PTableColumnId,
    predicate: {
      operator: 'Or',
      operands: operandList },
  }];
}
