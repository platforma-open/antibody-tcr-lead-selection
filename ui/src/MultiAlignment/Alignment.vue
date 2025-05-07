<script lang="ts" setup>
import {
  isSequenceColumn,
  type AlignmentModel,
} from '@platforma-open/milaboratories.top-antibodies.model';
import {
  getRawPlatformaInstance,
  isPTableAbsent,
  PTableNA,
  type PColumn,
  type PColumnKey,
  type PColumnValues,
  type PColumnValuesEntry,
  type PObjectId,
  type PTableHandle,
  type PTableColumnSpec,
  pTableValue,
} from '@platforma-sdk/model';
import {
  PlDropdown,
  type ListOption,
  type PTableRowKey,
} from '@platforma-sdk/ui-vue';
import {
  watch,
  watchEffect,
} from 'vue';
import type { SequenceRow } from '../types';

const model = defineModel<AlignmentModel>({ default: {} });
const sequenceRows = defineModel<SequenceRow[] | undefined>('sequence-rows');

const props = defineProps<{
  labelOptions: readonly ListOption<PObjectId>[];
  tableColumns: readonly PTableColumnSpec[];
  selectedRows: readonly PTableRowKey[];
  table: PTableHandle | undefined;
}>();

const FilterColumnId = '__FILTER_COLUMN__' as PObjectId;

watchEffect(() => {
  model.value.filterColumn = (() => {
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
        .map((key) => ({
          key,
          val: 1,
        } satisfies PColumnValuesEntry)),
    } satisfies PColumn<PColumnValues>;
  })();
});

const driver = getRawPlatformaInstance().pFrameDriver;

watch(
  () => props.table,
  async (table) => {
    const result: SequenceRow[] = [];

    if (table) {
      const specs = await driver.getSpec(table);
      const labelColumns = [];
      const sequenceColumns = [];
      const a = [];
      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        if (spec.type === 'axis') {
          a.push(i);
          continue;
        }
        if (spec.id === FilterColumnId) continue;
        if (isSequenceColumn(spec.spec)) {
          // TODO: properly order for single cell case
          sequenceColumns.push(i);
        } else {
          labelColumns.push(i);
        }
      }

      const shape = await driver.getShape(table);
      const data = await driver.getData(table, [...a, ...labelColumns, ...sequenceColumns]);
      for (let iRow = 0; iRow < shape.rows; iRow++) {
        const label = pTableValue(data[a.length + 0], iRow, { na: '', absent: '' });
        const sequence = [];
        for (let iCol = a.length + 1; iCol < data.length; iCol++) {
          sequence.push(pTableValue(data[iCol], iRow, { na: '', absent: '' }));
        }
        const key = [];
        for (let i = 0; i < a.length; i++) {
          key.push(pTableValue(data[i], iRow, { na: '', absent: '' }));
        }

        if (typeof label !== 'string' || label === '' || sequence.some((s) => typeof s !== 'string' || s === '')) {
          console.warn(`skipping record at row ${iRow} because of invalid label or sequence`);
          continue;
        }

        result.push({ label, sequence: sequence.join(''), key: JSON.stringify(key) });
      }
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
      :options="props.labelOptions"
    />
  </div>
</template>
