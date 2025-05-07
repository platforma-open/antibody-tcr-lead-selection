<script lang="ts" setup>
import type {
  AlignmentV2Model,
} from '@platforma-open/milaboratories.top-antibodies.model';
import type {
  PColumnSpec,
  PFrameHandle,
  PColumn,
  PColumnKey,
  PColumnValues,
  PColumnValuesEntry,
  PObjectId,
  PTableColumnSpec,
  CalculateTableDataRequest,
  PTableSorting,
  ColumnJoinEntry,
  InlineColumnJoinEntry,
} from '@platforma-sdk/model';
import {
  getRawPlatformaInstance,
  isPTableAbsent,
  PTableNA,
  pTableValue,
} from '@platforma-sdk/model';
import type {
  ListOption,
  PTableRowKey,
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

const model = defineModel<AlignmentV2Model>({ default: {} });
const sequenceRows = defineModel<SequenceRow[] | undefined>('sequence-rows');

const props = defineProps<{
  labelColumnOptionPredicate: (column: PColumnSpec) => boolean;
  sequenceColumnPredicate: (column: PColumnSpec) => boolean;
  tableColumns: readonly PTableColumnSpec[];
  selectedRows: readonly PTableRowKey[];
  pframe: PFrameHandle | undefined;
}>();

const FilterColumnId = '__FILTER_COLUMN__' as PObjectId;

const filterColumn = computed<PColumn<PColumnValues> | undefined>(() => {
  const axes = props.tableColumns.filter((c) => c.type === 'axis');
  if (axes.length === 0) return undefined;

  return {
    id: FilterColumnId,
    spec: {
      kind: 'PColumn',
      valueType: 'Int',
      name: FilterColumnId,
      axesSpec: axes.map((a) => a.spec),
    },
    data: props.selectedRows
      .filter((r): r is PColumnKey => !r.some((v) => isPTableAbsent(v) || v === PTableNA))
      .map((r) => ({
        key: r,
        val: 1,
      } satisfies PColumnValuesEntry)),
  } satisfies PColumn<PColumnValues>;
});

const driver = getRawPlatformaInstance().pFrameDriver;

const labelColumnOptions = ref<ListOption<PObjectId>[]>();
const labelColumnId = computed(() => model.value.label);

watch(
  () => [props.pframe, filterColumn.value, labelColumnId.value] as const,
  async ([pframe, filterColumn, labelColumnId]) => {
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
    if (!filterColumn
      || !labelColumnId
      || !columns.find((c) => c.columnId === labelColumnId)
      || sequenceColumns.length === 0) {
      sequenceRows.value = undefined;
      return;
    }

    const def = {
      src: {
        type: 'outer',
        primary: {
          type: 'inner',
          entries: [
          {
            type: 'inlineColumn',
            column: filterColumn,
          } satisfies InlineColumnJoinEntry,
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
    } satisfies CalculateTableDataRequest<PObjectId>;
    const table = await driver.calculateTableData(pframe, JSON.parse(JSON.stringify(def)));

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
    console.log('>>>', table[0].data.data);
    for (let iRow = 0; iRow < rowCount; iRow++) {
      const key = table[0].data.data[iRow];
      const label = pTableValue(table[labelColumnIndices[0]].data, iRow, { na: '', absent: '' });
      const sequence = [];
      for (const iCol of sequenceColumnIndices) {
        sequence.push(pTableValue(table[iCol].data, iRow, { na: '', absent: '' }));
      }

      if (typeof label !== 'string' || label === '' || sequence.some((s) => typeof s !== 'string' || s === '')) {
        console.warn(`skipping record at row ${iRow} because of invalid label or sequence`, label, sequence);
        continue;
      }

      result.push({ label, sequence: sequence.join(''), key: JSON.stringify(key) });
    }

    sequenceRows.value = result;
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <PlDropdown
      v-model="model.label"
      :options="labelColumnOptions"
    />
  </div>
</template>
