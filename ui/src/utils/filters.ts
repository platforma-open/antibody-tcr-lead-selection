import type { PTableRecordSingleValueFilterV2, PTableColumnId } from '@platforma-sdk/model';

/**
 * Returns an enrichment threshold filter array if conditions are met, otherwise empty array
 */
export function getEnrichmentThresholdFilter(
  enrichmentScoreColumn: { id: string; type?: string } | undefined,
  threshold: number | undefined,
): PTableRecordSingleValueFilterV2[] {
  if (!enrichmentScoreColumn || threshold === undefined || !threshold) {
    return [];
  }

  return [{
    type: 'bySingleColumnV2',
    column: { type: 'column', id: enrichmentScoreColumn.id } as PTableColumnId,
    predicate: {
      operator: 'GreaterOrEqual',
      reference: threshold,
    },
  }];
}

/**
 * Returns a frequency threshold filter array if conditions are met, otherwise empty array
 */
export function getFrequencyThresholdFilter(
  frequencyScoreColumn: { id: string; type?: string } | undefined,
  threshold: number | undefined,
): PTableRecordSingleValueFilterV2[] {
  if (!frequencyScoreColumn || threshold === undefined || !threshold) {
    return [];
  }

  return [{
    type: 'bySingleColumnV2',
    column: { type: 'column', id: frequencyScoreColumn.id } as PTableColumnId,
    predicate: {
      operator: 'GreaterOrEqual',
      reference: threshold,
    },
  }];
}
