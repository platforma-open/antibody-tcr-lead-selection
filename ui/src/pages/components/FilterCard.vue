<script setup lang="ts">
import type { AnchoredColumnId, FilterUI } from '@platforma-open/milaboratories.top-antibodies.model';
import type { PlTableFilter } from '@platforma-sdk/model';
import { PlDropdown, PlTextField } from '@platforma-sdk/ui-vue';
import { computed, watch } from 'vue';

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
  options?: { label: string; value: AnchoredColumnId; column?: { spec: { valueType?: string; annotations?: Record<string, string> } } }[];
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

  // Find the selected option to access column spec
  const selectedOption = props.options?.find((opt) =>
    opt.value.column === columnId.column,
  );

  if (!selectedOption?.column?.spec?.valueType) {
    // If we can't determine the type, return all options
    return filterTypeOptions;
  }

  const valueType = selectedOption.column.spec.valueType;

  // If String, return only string filters; otherwise return only number filters
  if (valueType === 'String') {
    return filterTypeOptions.filter((opt) => opt.value.startsWith('string_'));
  } else {
    // Double, Int, Long, etc. - return only number filters
    return filterTypeOptions.filter((opt) => opt.value.startsWith('number_'));
  }
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
      // Preserve the current reference value if compatible with the new filter type
      const currentReference = getReferenceValue(model.value.filter);
      const newFilter = createFilter(value);
      
      // Try to preserve the value if types are compatible
      if (currentReference !== undefined && hasReference(newFilter)) {
        if (isNumberFilter(value) && typeof currentReference === 'number') {
          // Number to number filter - preserve value
          newFilter.reference = currentReference;
        } else if (isStringFilter(value) && typeof currentReference === 'string') {
          // String to string filter - preserve value
          newFilter.reference = currentReference;
        } else if (isNumberFilter(value) && typeof currentReference === 'string') {
          // String to number - try to convert if it's a valid number
          const numValue = Number(currentReference);
          if (!isNaN(numValue)) {
            newFilter.reference = numValue;
          }
        } else if (isStringFilter(value) && typeof currentReference === 'number') {
          // Number to string - convert to string
          newFilter.reference = String(currentReference);
        }
      }
      
      model.value.filter = newFilter;
    }
  },
});

// Get the value type for the currently selected column
const getCurrentColumnValueType = () => {
  if (!model.value.value) return undefined;
  const selectedOption = props.options?.find((opt) =>
    opt.value.column === model.value.value?.column,
  );
  return selectedOption?.column?.spec?.valueType;
};

// Watch for column changes and reset filter when column type changes
watch(() => model.value.value?.column, (newColumn, oldColumn) => {
  // Only reset if the column actually changed
  if (newColumn === oldColumn) return;

  const newValueType = getCurrentColumnValueType();

  // If column not found in options, don't reset - options may be stale during anchor transition
  if (newValueType === undefined) return;

  const currentFilterType = model.value.filter?.type;
  // Determine if current filter type is compatible with new column type
  const isCompatible = (newValueType === 'String' && isStringFilter(currentFilterType))
    || (newValueType !== 'String' && isNumberFilter(currentFilterType));
  // If not compatible, reset the filter with appropriate defaults
  if (!isCompatible) {
    if (newValueType === 'String') {
      model.value.filter = createFilter('string_equals');
    } else {
      model.value.filter = createFilter('number_greaterThan');
    }
  }
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
