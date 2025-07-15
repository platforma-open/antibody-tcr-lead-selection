<script setup lang="ts">
import type { PTableColumnId, PlTableFilter } from '@platforma-sdk/model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { PlBtnSecondary, PlElementList, PlIcon16, PlRow, PlTooltip } from '@platforma-sdk/ui-vue';
import { ref, watch } from 'vue';
import { useApp } from '../../app';
import FilterCard from './FilterCard.vue';

export type FilterEntry = {
  id?: string;
  column?: PTableColumnId;
  filter?: PlTableFilter;
  isExpanded?: boolean;
};

const app = useApp();

// Counter for generating unique IDs
const idCounter = ref(0);

const generateUniqueId = () => {
  idCounter.value += 1;
  return `filter-${idCounter.value}-${Date.now()}`;
};

const getColumnLabel = (columnId: PTableColumnId | undefined) => {
  if (!columnId || columnId.type !== 'column') return 'Set filter';

  // This would need to be enhanced to get the actual column label
  // For now, return a generic label
  return 'Set filter';
};

const addFilter = () => {
  app.updateArgs((args) => {
    if (!args.filters || !Array.isArray(args.filters)) {
      args.filters = [];
    }
    args.filters.push({
      id: generateUniqueId(),
      column: undefined,
      filter: { type: 'number_greaterThan', reference: 0 },
      isExpanded: true, // Auto-expand new items
    });
  });
};

const resetToDefaults = () => {
  app.updateArgs((args) => {
    args.filters = app.model.outputs.defaultFilters?.map((defaultFilter: { column: PTableColumnId; default: PlTableFilter }) => ({
      id: generateUniqueId(),
      column: defaultFilter.column,
      filter: defaultFilter.default,
      isExpanded: false,
    })) ?? [];
  });
};

// set default filters when inputAnchor is set
watch(() => app.model.args.inputAnchor, (newValue, oldValue) => {
  if (oldValue === undefined && newValue !== undefined) {
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
      v-model:items="app.model.args.filters"
      :get-item-key="(item: FilterEntry) => item.id ?? 0"
      :is-expanded="(item: FilterEntry) => item.isExpanded === true"
      :on-expand="(item: FilterEntry) => item.isExpanded = !item.isExpanded"
    >
      <template #item-title="{ item }">
        {{ (item as FilterEntry).column ? getColumnLabel((item as FilterEntry).column) : 'Add Filter' }}
      </template>
      <template #item-content="{ index }">
        <FilterCard
          v-model="app.model.args.filters[index]"
          :options="app.model.outputs.filterOptions as ListOption<PTableColumnId>[]"
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
