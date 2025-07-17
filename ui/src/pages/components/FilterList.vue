<script setup lang="ts">
import type { AnchoredColumnId, FilterUI } from '@platforma-open/milaboratories.top-antibodies.model';
import type { PlTableFilter } from '@platforma-sdk/model';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import { ref, watch } from 'vue';
import { useApp } from '../../app';
import FilterCard from './FilterCard.vue';

const app = useApp();

// Counter for generating unique IDs
const idCounter = ref(0);

const generateUniqueId = () => {
  idCounter.value += 1;
  return `filter-${idCounter.value}-${Date.now()}`;
};

const getColumnLabel = (columnId: AnchoredColumnId | undefined) => {
  const column = app.model.outputs.allFilterableOptions?.find(
    (option) => option && option.value.column === columnId?.column,
  );
  return column?.label ?? 'Set filter';
};

const addFilter = () => {
  const ui = app.model.ui;

  if (!Array.isArray(ui.filters)) {
    ui.filters = [];
  }

  ui.filters.push({
    id: generateUniqueId(),
    value: undefined,
    filter: { type: 'number_greaterThan', reference: 0 },
    isExpanded: true, // Auto-expand new items
  });
};

const resetToDefaults = () => {
  app.model.ui.filters = app.model.outputs.defaultFilters?.map((defaultFilter: { column: AnchoredColumnId; default: PlTableFilter }) => ({
    id: generateUniqueId(),
    value: defaultFilter.column,
    filter: defaultFilter.default,
    isExpanded: false,
  })) ?? [];
};

// set default filters when becomes available after inputAnchor is set
watch(() => app.model.outputs.defaultFilters, (newValue) => {
  if (newValue && app.model.args.inputAnchor && (!app.model.ui.filters || app.model.ui.filters.length === 0)) {
    resetToDefaults();
  }
});
</script>

<template>
  <div class="d-flex flex-column gap-6">
    <PlRow>
      Filter by:
      <PlTooltip>
        <PlIcon16 name="info" />
        <template #tooltip> Select columns to use for filtering the data. </template>
      </PlTooltip>
    </PlRow>

    <PlElementList
      v-model:items="app.model.ui.filters"
      :get-item-key="(item: FilterUI) => item.id ?? 0"
      :is-expanded="(item: FilterUI) => item.isExpanded === true"
      :on-expand="(item: FilterUI) => item.isExpanded = !item.isExpanded"
    >
      <template #item-title="{ item }">
        {{ (item as FilterUI).value ? getColumnLabel((item as FilterUI).value) : 'Add Filter' }}
      </template>
      <template #item-content="{ index }">
        <FilterCard
          v-model="app.model.ui.filters[index]"
          :options="app.model.outputs.allFilterableOptions"
        />
      </template>
    </PlElementList>

    <div class="d-flex flex-column gap-6">
      <PlBtnSecondary icon="add" @click="addFilter">
        Add Filter
      </PlBtnSecondary>

      <PlBtnSecondary icon="reverse" @click="resetToDefaults">
        Reset to defaults
      </PlBtnSecondary>
    </div>
  </div>
</template>
