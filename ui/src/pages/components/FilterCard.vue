<script setup lang="ts">
import type { AnchoredColumnId, FilterUI } from '@platforma-open/milaboratories.top-antibodies.model';
import type { PlTableFilter } from '@platforma-sdk/model';
import { PlDropdown, PlTextField } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';

// Define specific filter types to avoid 'as any'
type NumberFilterType =
  | 'number_greaterThan'
  | 'number_greaterThanOrEqualTo'
  | 'number_lessThan'
  | 'number_lessThanOrEqualTo'
  | 'number_equals'
  | 'number_notEquals';

type StringFilterType =
  | 'string_equals'
  | 'string_notEquals'
  | 'string_contains'
  | 'string_doesNotContain';

const model = defineModel<FilterUI>({
  default: {
    filter: { type: 'number_greaterThan', reference: 0 },
  },
});

const props = defineProps<{
  options?: { label: string; value: AnchoredColumnId; column?: { spec: { annotations?: Record<string, string> } } }[];
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

const getFilterTypeOptions = (columnId?: AnchoredColumnId) => {
  if (!columnId) return filterTypeOptions;

  // This would need to be enhanced to get the actual column spec
  // For now, return all options
  return filterTypeOptions;
};

const isNumberFilter = (type?: string): type is NumberFilterType => {
  return type?.startsWith('number_') ?? false;
};

const isStringFilter = (type?: string): type is StringFilterType => {
  return type?.startsWith('string_') ?? false;
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
    return { type, reference: 0 };
  } else if (isStringFilter(type)) {
    return { type, reference: '' };
  } else {
    return { type: 'number_greaterThan', reference: 0 };
  }
};

const referenceValue = computed(() => {
  return String(getReferenceValue(model.value.filter) || '');
});

const updateReferenceValue = (value: string | undefined) => {
  if (model.value.filter && value !== undefined) {
    setReferenceValue(model.value.filter, value);
  }
};

const showNumberInput = computed(() => {
  return model.value.filter && isNumberFilter(model.value.filter.type);
});

const showStringInput = computed(() => {
  return model.value.filter && isStringFilter(model.value.filter.type) && !getDiscreteValues();
});

const showDiscreteDropdown = computed(() => {
  return model.value.filter && isStringFilter(model.value.filter.type) && getDiscreteValues();
});

const getDiscreteValues = () => {
  if (!model.value.value) return null;

  const selectedOption = props.options?.find((opt) =>
    opt.value.column === model.value.value?.column,
  );

  if (!selectedOption?.column?.spec?.annotations?.['pl7.app/discreteValues']) {
    return null;
  }

  try {
    const discreteValues = JSON.parse(selectedOption.column.spec.annotations['pl7.app/discreteValues']);
    return discreteValues.map((val: string) => ({ label: val, value: val }));
  } catch {
    return null;
  }
};

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
  <PlDropdown
    v-model="model.value"
    :options="props.options"
    label="Filter by"
    required
  />

  <PlDropdown
    v-model="filterType"
    :options="getFilterTypeOptions(model.value)"
    label="Filter type"
    required
  />

  <PlTextField
    v-if="showNumberInput"
    :model-value="referenceValue"
    label="Value"
    required
    @update:model-value="updateReferenceValue"
  />

  <PlDropdown
    v-if="showDiscreteDropdown"
    :model-value="referenceValue"
    :options="getDiscreteValues()"
    label="Value"
    required
    @update:model-value="updateReferenceValue"
  />

  <PlTextField
    v-if="showStringInput"
    :model-value="referenceValue"
    label="Value"
    required
    @update:model-value="updateReferenceValue"
  />
</template>
