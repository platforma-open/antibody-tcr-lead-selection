<script setup lang="ts">
import type { AnchoredColumnId, DiscreteFilter, FilterUI } from '@platforma-open/milaboratories.top-antibodies.model';
import type { PlTableFilter } from '@platforma-sdk/model';
import { PlDropdown, PlDropdownMulti, PlTextField } from '@platforma-sdk/ui-vue';
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

type DiscreteFilterType = 'string_in' | 'string_notIn';

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
  { value: 'string_in', label: 'Is one of' },
  { value: 'string_notIn', label: 'Is not one of' },
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
    // Multi-select discrete columns get "Is one of" / "Is not one of" options
    if (isMultiSelectColumn(selectedOption)) {
      return filterTypeOptions.filter((opt) => isDiscreteFilterType(opt.value));
    }
    return filterTypeOptions.filter((opt) => opt.value.startsWith('string_') && !isDiscreteFilterType(opt.value));
  } else {
    // Double, Int, Long, etc. - return only number filters
    return filterTypeOptions.filter((opt) => opt.value.startsWith('number_'));
  }
};

const isNumberFilter = (type?: string): type is NumberFilterType => {
  return type?.startsWith('number_') ?? false;
};

const isStringFilter = (type?: string): type is StringFilterType => {
  return (type?.startsWith('string_') && type !== 'string_in' && type !== 'string_notIn') ?? false;
};

const isDiscreteFilterType = (type?: string): type is DiscreteFilterType => {
  return type === 'string_in' || type === 'string_notIn';
};

/** Check if a column option supports multi-select discrete filtering */
const isMultiSelectColumn = (option?: { column?: { spec: { annotations?: Record<string, string> } } }) => {
  if (!option?.column?.spec?.annotations) return false;
  const ann = option.column.spec.annotations;
  return ann['pl7.app/isDiscreteFilter'] === 'true'
    && !!ann['pl7.app/score/defaultCutoff']
    && !!ann['pl7.app/discreteValues'];
};

type AnyFilter = PlTableFilter | DiscreteFilter;

const hasReference = (filter: AnyFilter): filter is AnyFilter & { reference: string | number } => {
  return 'reference' in filter;
};

const getReferenceValue = (filter?: AnyFilter): string | number | undefined => {
  if (!filter || !hasReference(filter)) return undefined;
  return filter.reference;
};

const setReferenceValue = (filter: AnyFilter, value: string | number) => {
  if (hasReference(filter)) {
    if (isNumberFilter(filter.type)) {
      filter.reference = Number(value);
    } else if (isStringFilter(filter.type)) {
      filter.reference = String(value);
    }
    // For discrete filters, reference is set via setDiscreteReferenceValues
  }
};

const createFilter = (type: string): AnyFilter => {
  if (isNumberFilter(type)) {
    return { type, reference: 0 };
  } else if (isDiscreteFilterType(type)) {
    return { type, reference: '[]' };
  } else if (isStringFilter(type)) {
    return { type, reference: '' };
  } else {
    return { type: 'number_greaterThan', reference: 0 };
  }
};

const referenceValue = computed(() => {
  return String(getReferenceValue(model.value.filter) ?? '');
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
  return model.value.filter && isStringFilter(model.value.filter.type) && getDiscreteValues() && !isCurrentColumnMultiSelect.value;
});

const isCurrentColumnMultiSelect = computed(() => {
  if (!model.value.value) return false;
  const selectedOption = props.options?.find((opt) =>
    opt.value.column === model.value.value?.column,
  );
  return isMultiSelectColumn(selectedOption);
});

const showMultiDiscreteDropdown = computed(() => {
  return model.value.filter && isDiscreteFilterType(model.value.filter.type) && isCurrentColumnMultiSelect.value;
});

/** Parse the JSON-encoded array from a discrete filter reference */
const discreteReferenceValues = computed<string[]>(() => {
  const filter = model.value.filter;
  if (!filter || !isDiscreteFilterType(filter.type)) return [];
  try {
    const parsed = JSON.parse((filter as DiscreteFilter).reference);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});

const updateDiscreteReferenceValues = (values: string[]) => {
  if (model.value.filter && isDiscreteFilterType(model.value.filter.type)) {
    (model.value.filter as DiscreteFilter).reference = JSON.stringify(values);
  }
};

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
        } else if (isStringFilter(value) && typeof currentReference === 'string' && !isDiscreteFilterType(model.value.filter!.type)) {
          // String to string filter - preserve value (but not from discrete)
          newFilter.reference = currentReference;
        } else if (isDiscreteFilterType(value) && isDiscreteFilterType(model.value.filter!.type)) {
          // Discrete to discrete - preserve the JSON array reference
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

  // Check if the new column is multi-select discrete
  const selectedOption = props.options?.find((opt) =>
    opt.value.column === model.value.value?.column,
  );
  const newIsMultiSelect = isMultiSelectColumn(selectedOption);

  const currentFilterType = model.value.filter?.type;
  if (newIsMultiSelect) {
    // Switch to string_in if not already a discrete filter type
    if (!isDiscreteFilterType(currentFilterType)) {
      model.value.filter = createFilter('string_in');
    }
    return;
  }

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

  <PlDropdownMulti
    v-if="showMultiDiscreteDropdown"
    :model-value="discreteReferenceValues"
    :options="getDiscreteValues()"
    label="Values"
    required
    @update:model-value="updateDiscreteReferenceValues"
  />

  <PlTextField
    v-if="showStringInput"
    :model-value="referenceValue"
    label="Value"
    required
    @update:model-value="updateReferenceValue"
  />
</template>
