<script setup lang="ts">
import type {
  ScopedColumnId,
  DiscreteFilter,
  FilterUI,
  PlTableFilter,
} from "@platforma-open/milaboratories.top-antibodies.model";
import { PlDropdown, PlDropdownMulti, PlTextField } from "@platforma-sdk/ui-vue";
import { computed, watch } from "vue";
import type { AnyFilter, FilterColumnOption } from "./filterTypes";
import {
  createFilter,
  filterTypesFor,
  isDiscreteFilterType,
  isMultiSelectColumn,
  isNAFilterType,
  isNumberFilter,
  isStringFilter,
  isSubsetColumn,
} from "./filterTypes";

const model = defineModel<FilterUI>({
  default: {
    filter: { type: "number_greaterThan", reference: 0 },
  },
});

const props = defineProps<{
  options?: ({
    label: string;
    value: ScopedColumnId;
  } & FilterColumnOption)[];
}>();

const getFilterTypeOptions = (columnId?: ScopedColumnId) => {
  if (!columnId) return filterTypesFor(undefined);
  return filterTypesFor(props.options?.find((opt) => opt.value.column === columnId.column));
};

const hasReference = (filter: AnyFilter): filter is AnyFilter & { reference: string | number } => {
  return "reference" in filter;
};

const getReferenceValue = (filter?: AnyFilter): string | number | undefined => {
  if (!filter || !hasReference(filter)) return undefined;
  return filter.reference;
};

const setReferenceValue = (filter: AnyFilter, value: string | number) => {
  if (hasReference(filter)) {
    if (isNumberFilter(filter.type)) {
      let r = Number(value);
      if (Number.isNaN(r)) {
        r = 0.0; // TMP fix to avoid NaN on text or incomplete number input (e.g. "1e-")
      }
      filter.reference = r;
    } else if (isStringFilter(filter.type)) {
      filter.reference = String(value);
    }
    // For discrete filters, reference is set via setDiscreteReferenceValues
  }
};

const referenceValue = computed(() => {
  return String(getReferenceValue(model.value.filter) ?? "");
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
  return (
    model.value.filter &&
    isStringFilter(model.value.filter.type) &&
    getDiscreteValues() &&
    !isCurrentColumnMultiSelect.value
  );
});

const isCurrentColumnMultiSelect = computed(() => {
  if (!model.value.value) return false;
  const selectedOption = props.options?.find(
    (opt) => opt.value.column === model.value.value?.column,
  );
  return isMultiSelectColumn(selectedOption);
});

const showMultiDiscreteDropdown = computed(() => {
  return (
    model.value.filter &&
    isDiscreteFilterType(model.value.filter.type) &&
    isCurrentColumnMultiSelect.value
  );
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

  const selectedOption = props.options?.find(
    (opt) => opt.value.column === model.value.value?.column,
  );

  if (!selectedOption?.column?.spec?.annotations?.["pl7.app/discreteValues"]) {
    return null;
  }

  try {
    const discreteValues = JSON.parse(
      selectedOption.column.spec.annotations["pl7.app/discreteValues"],
    );
    return discreteValues.map((val: string) => ({ label: val, value: val }));
  } catch {
    return null;
  }
};

const filterType = computed({
  get: () => model.value.filter?.type || "number_greaterThan",
  set: (value: string) => {
    if (!model.value.filter) {
      model.value.filter = createFilter(value);
    } else {
      // Preserve the current reference value if compatible with the new filter type
      const currentReference = getReferenceValue(model.value.filter);
      const newFilter = createFilter(value);

      // Try to preserve the value if types are compatible
      if (currentReference !== undefined && hasReference(newFilter)) {
        if (isNumberFilter(value) && typeof currentReference === "number") {
          // Number to number filter - preserve value
          newFilter.reference = currentReference;
        } else if (
          isStringFilter(value) &&
          typeof currentReference === "string" &&
          !isDiscreteFilterType(model.value.filter!.type)
        ) {
          // String to string filter - preserve value (but not from discrete)
          newFilter.reference = currentReference;
        } else if (isDiscreteFilterType(value) && isDiscreteFilterType(model.value.filter!.type)) {
          // Discrete to discrete - preserve the JSON array reference
          newFilter.reference = currentReference;
        } else if (isNumberFilter(value) && typeof currentReference === "string") {
          // String to number - try to convert if it's a valid number
          const numValue = Number(currentReference);
          if (!isNaN(numValue)) {
            newFilter.reference = numValue;
          }
        } else if (isStringFilter(value) && typeof currentReference === "number") {
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
  const selectedOption = props.options?.find(
    (opt) => opt.value.column === model.value.value?.column,
  );
  return selectedOption?.column?.spec?.valueType;
};

// Watch for column changes and reset filter when column type changes
watch(
  () => model.value.value?.column,
  (newColumn, oldColumn) => {
    // Only reset if the column actually changed
    if (newColumn === oldColumn) return;

    const newValueType = getCurrentColumnValueType();

    // If column not found in options, don't reset - options may be stale during anchor transition
    if (newValueType === undefined) return;

    const currentFilterType = model.value.filter?.type;

    // isNA/isNotNA is compatible with all column types — keep it
    if (isNAFilterType(currentFilterType)) return;

    const selectedOption = props.options?.find(
      (opt) => opt.value.column === model.value.value?.column,
    );

    // Subset columns admit presence predicates only; isNotNA is the meaningful one.
    if (isSubsetColumn(selectedOption)) {
      model.value.filter = createFilter("isNotNA");
      return;
    }

    // Check if the new column is multi-select discrete
    const newIsMultiSelect = isMultiSelectColumn(selectedOption);

    if (newIsMultiSelect) {
      // Switch to string_in if not already a discrete filter type
      if (!isDiscreteFilterType(currentFilterType)) {
        model.value.filter = createFilter("string_in");
      }
      return;
    }

    // Determine if current filter type is compatible with new column type
    const isCompatible =
      (newValueType === "String" && isStringFilter(currentFilterType)) ||
      (newValueType !== "String" && isNumberFilter(currentFilterType));
    // If not compatible, reset the filter with appropriate defaults
    if (!isCompatible) {
      if (newValueType === "String") {
        model.value.filter = createFilter("string_equals");
      } else {
        model.value.filter = createFilter("number_greaterThan");
      }
    }
  },
);
</script>

<template>
  <PlDropdown v-model="model.value" :options="props.options" label="Filter by" required />

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
