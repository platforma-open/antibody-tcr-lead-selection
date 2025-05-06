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
  type PTableShape,
  type PTableColumnSpec,
  pTableValue,
} from '@platforma-sdk/model';
import {
  PlDropdown,
  type ListOption,
  type PTableRowKey,
} from '@platforma-sdk/ui-vue';
import {
  ref,
  watch,
  watchEffect,
} from 'vue';

const model = defineModel<AlignmentModel>({ default: {} });

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
        .map((r) => ({
          key: r,
          val: 1,
        } satisfies PColumnValuesEntry)),
    } satisfies PColumn<PColumnValues>;
  })();
});

const driver = getRawPlatformaInstance().pFrameDriver;
const labelsToRecords = ref<Record<string, string> | undefined>();
watch(
  () => props.table,
  async (table) => {
    const result: Record<string, string> = {};

    if (table) {
      const specs = await driver.getSpec(table);
      const labelColumns = [];
      const sequenceColumns = [];
      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        if (spec.type === 'axis') continue;
        if (spec.id === FilterColumnId) continue;
        if (isSequenceColumn(spec.spec)) {
          // TODO: properly order for single cell case
          sequenceColumns.push(i);
        } else {
          labelColumns.push(i);
        }
      }

      const data = await driver.getData(table, [...labelColumns, ...sequenceColumns]);
      for (let iRow = 0; iRow < data.length; iRow++) {
        const label = pTableValue(data[0], iRow, { na: '', absent: '' });
        const sequence = [];
        for (let iCol = 1; iCol < data.length; iCol++) {
          sequence.push(pTableValue(data[iCol], iRow, { na: '', absent: '' }));
        }

        if (typeof label !== 'string' || label === '' || sequence.some((s) => typeof s !== 'string' || s === '')) {
          console.warn(`skipping record at row ${iRow} because of invalid label or sequence`);
          continue;
        }

        result[label] = sequence.join('');
      }
    }

    labelsToRecords.value = result;
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
    <p>Labels to records: {{ labelsToRecords }}</p>
  </div>
</template>
