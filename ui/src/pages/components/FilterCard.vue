<script setup lang="ts">
import type { PlTableFilter, PTableColumnId } from '@platforma-sdk/model';
import type { ListOption } from '@platforma-sdk/ui-vue';
import { PlDropdown, PlTextField } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';

export type FilterEntry = {
  id?: string;
  column?: PTableColumnId;
  filter?: PlTableFilter;
  isExpanded?: boolean;
};

const model = defineModel<FilterEntry>({
  default: {
    filter: { type: 'number_greaterThan', reference: 0 },
  },
});

const props = defineProps<{
  options?: ListOption<PTableColumnId>[];
}>();

const filterTypeOptions = [
  { value: 'number_greaterThan', label: 'Greater than' },
  { value: 'number_greaterThanOrEqualTo', label: 'Greater than or equal' },
  { value: 'number_lessThan', label: 'Less than' },
  { value: 'number_lessThanOrEqualTo', label: 'Less than or equal' },
  { value: 'number_equals', label: 'Equals' },
  { value: 'number_notEquals', label: 'Not equals' },
  { value: 'string_equals', label: 'Equals' },
  { value: 'string_notEquals', label: 'Not equals' },
  { value: 'string_contains', label: 'Contains' },
  { value: 'string_doesNotContain', label: 'Does not contain' },
];

const getFilterTypeOptions = (columnId?: PTableColumnId) => {
  if (!columnId || columnId.type !== 'column') return filterTypeOptions;

  // This would need to be enhanced to get the actual column spec
  // For now, return all options
  return filterTypeOptions;
};

const isNumberFilter = (type?: string) => {
  return type?.startsWith('number_');
};

const isStringFilter = (type?: string) => {
  return type?.startsWith('string_');
};

const hasReference = (filter: PlTableFilter): filter is PlTableFilter & { reference: string | number } => {
  return 'reference' in filter;
};

const getReferenceValue = (filter?: PlTableFilter): string | number | undefined => {
  if (!filter || !hasReference(filter)) return undefined;
  return filter.reference;
};

const setReferenceValue = (filter: PlTableFilter, value: string | number) => {
  if (hasReference(filter)) {
    if (isNumberFilter(filter.type)) {
      filter.reference = Number(value);
    } else if (isStringFilter(filter.type)) {
      filter.reference = String(value);
    }
  }
};

const createFilter = (type: string): PlTableFilter => {
  if (isNumberFilter(type)) {
    return { type: type as any, reference: 0 };
  } else if (isStringFilter(type)) {
    return { type: type as any, reference: '' };
  } else {
    return { type: 'number_greaterThan', reference: 0 };
  }
};

const referenceValue = computed(() => {
  return String(getReferenceValue(model.value.filter) || '');
});

const updateReferenceValue = (value: string) => {
  if (model.value.filter) {
    setReferenceValue(model.value.filter, value);
  }
};

const showNumberInput = computed(() => {
  return model.value.filter && isNumberFilter(model.value.filter.type);
});

const showStringInput = computed(() => {
  return model.value.filter && isStringFilter(model.value.filter.type);
});

const filterType = computed({
  get: () => model.value.filter?.type || 'number_greaterThan',
  set: (value: string) => {
    if (!model.value.filter) {
      model.value.filter = createFilter(value);
    } else {
      model.value.filter = createFilter(value);
    }
  },
});
</script>

<template>
  <div class="d-flex flex-column gap-6">
    <PlDropdown
      v-model="model.column"
      :options="props.options"
      label="Filter by"
      required
    />

    <PlDropdown
      v-model="filterType"
      :options="getFilterTypeOptions(model.column)"
      label="Filter type"
      required
    />

    <PlTextField
      v-if="showNumberInput"
      :model-value="referenceValue"
      label="Reference value"
      required
      @update:model-value="updateReferenceValue"
    />

    <PlTextField
      v-if="showStringInput"
      :model-value="referenceValue"
      label="Reference value"
      required
      @update:model-value="updateReferenceValue"
    />
  </div>
</template>
