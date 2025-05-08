<script lang="ts" setup>
import {
  createRowSelectionColumn,
  type PlMultiAlignmentViewModel,
  type RowSelectionModel,
} from '@platforma-open/milaboratories.top-antibodies.model';
import type {
  PColumnSpec,
  PFrameHandle,
  PColumn,
  PColumnValues,
  PObjectId,
  CalculateTableDataRequest,
  PTableSorting,
  ColumnJoinEntry,
  InlineColumnJoinEntry,
} from '@platforma-sdk/model';
import {
  getRawPlatformaInstance,
  pTableValue,
} from '@platforma-sdk/model';
import type {
  ListOption,
} from '@platforma-sdk/ui-vue';
import {
  PlDropdown,
} from '@platforma-sdk/ui-vue';
import {
  computed,
  ref,
  watch,
} from 'vue';
import type { SequenceRow } from '../types';

const model = defineModel<PlMultiAlignmentViewModel>({ default: {} });
const sequenceRows = defineModel<SequenceRow[] | undefined>('sequence-rows');

const props = defineProps<{
  labelColumnOptionPredicate: (column: PColumnSpec) => boolean;
  sequenceColumnPredicate: (column: PColumnSpec) => boolean;
  pframe: PFrameHandle | undefined;
  rowSelectionModel?: RowSelectionModel | undefined;
}>();

const driver = getRawPlatformaInstance().pFrameDriver;

const labelColumnOptions = ref<ListOption<PObjectId>[]>();
const labelColumnId = computed(() => model.value.label);

watch(
  () => [props.pframe, props.rowSelectionModel, labelColumnId.value] as const,
  async ([pframe, rowSelectionModel, labelColumnId]) => {
    if (!pframe) {
      labelColumnOptions.value = undefined;
      sequenceRows.value = undefined;
      return;
    }

    const columns = await driver.listColumns(pframe);
    labelColumnOptions.value = columns
      .filter((c) => props.labelColumnOptionPredicate(c.spec))
      .map((c) => ({
        label: c.spec.annotations?.['pl7.app/label'] ?? '',
        value: c.columnId,
      }));
    const sequenceColumns = columns.filter((c) => props.sequenceColumnPredicate(c.spec));
    if (!labelColumnId
      || !columns.find((c) => c.columnId === labelColumnId)
      || sequenceColumns.length === 0) {
      sequenceRows.value = undefined;
      return;
    }
    const FilterColumnId = '__FILTER_COLUMN__' as PObjectId;
    const filterColumn = createRowSelectionColumn(FilterColumnId, rowSelectionModel);

    const def = JSON.parse(JSON.stringify({
      src: {
        type: 'outer',
        primary: {
          type: 'inner',
          entries: [
            ...(filterColumn && filterColumn.data.length > 0
              ? [{
                type: 'inlineColumn',
                column: filterColumn,
              } satisfies InlineColumnJoinEntry]
              : []),
            ...sequenceColumns.map((c) => ({
              type: 'column',
              column: c.columnId,
            } satisfies ColumnJoinEntry<PObjectId>)),
          ].filter((e): e is ColumnJoinEntry<PObjectId> => e !== undefined),
        },
        secondary: [{
          type: 'column',
          column: labelColumnId,
        } satisfies ColumnJoinEntry<PObjectId>],
      },
      filters: [],
      sorting: sequenceColumns.map((c) => ({
        column: {
          type: 'column',
          id: c.columnId,
        },
        ascending: true,
        naAndAbsentAreLeastValues: true,
      } satisfies PTableSorting)),
    } satisfies CalculateTableDataRequest<PObjectId>));
    const table = await driver.calculateTableData(pframe, def);

    const result: SequenceRow[] = [];
    const labelColumnIndices = [];
    const sequenceColumnIndices = [];
    for (let i = 0; i < table.length; i++) {
      const spec = table[i].spec;
      if (spec.type === 'axis') continue;
      if (spec.id === FilterColumnId) continue;
      if (props.sequenceColumnPredicate(spec.spec)) {
        // TODO: properly order for single cell case
        sequenceColumnIndices.push(i);
      } else {
        labelColumnIndices.push(i);
      }
    }
    if (labelColumnIndices.length === 0 || sequenceColumnIndices.length === 0) {
      sequenceRows.value = undefined;
      throw new Error('No label or sequence columns found');
    }

    const rowCount = table[0].data.data.length;
    let key = 0;
    for (let iRow = 0; iRow < rowCount; iRow++) {
      const label = pTableValue(table[labelColumnIndices[0]].data, iRow, { na: '', absent: '' });
      const sequence = [];
      for (const iCol of sequenceColumnIndices) {
        sequence.push(pTableValue(table[iCol].data, iRow, { na: '', absent: '' }));
      }

      if (typeof label !== 'string' || label === '' || sequence.some((s) => typeof s !== 'string' || s === '')) {
        console.warn(`skipping record at row ${iRow} because of invalid label or sequence`, label, sequence);
        continue;
      }

      result.push({ label, sequence: sequence.join(''), header: String(++key) });
    }

    sequenceRows.value = result;
  },
  { immediate: true },
);
</script>

<template>
  <div :style="{ maxInlineSize: 'fit-content' }">
    <PlDropdown
      v-model="model.label"
      label="Label Column"
      :options="labelColumnOptions"
    />
  </div>
</template>
