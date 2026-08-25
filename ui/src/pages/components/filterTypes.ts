// Which predicates a column admits, and how a fresh filter of each type is built.

import type {
  DiscreteFilter,
  PlTableFilter,
} from "@platforma-open/milaboratories.top-antibodies.model";

export type NumberFilterType =
  | "number_greaterThan"
  | "number_greaterThanOrEqualTo"
  | "number_lessThan"
  | "number_lessThanOrEqualTo"
  | "number_equals"
  | "number_notEquals";

export type StringFilterType =
  | "string_equals"
  | "string_notEquals"
  | "string_contains"
  | "string_doesNotContain";

export type DiscreteFilterType = "string_in" | "string_notIn";

export type NAFilterType = "isNA" | "isNotNA";

export type AnyFilter = PlTableFilter | DiscreteFilter;

/** The column half of a "Filter by" option, as `filterConfig` builds it. */
export type FilterColumnOption = {
  column?: { spec: { valueType?: string; annotations?: Record<string, string> } };
  /** Set by `filterConfig`. The column carries no readable value. */
  presenceOnly?: boolean;
};

export const filterTypeOptions = [
  { value: "number_greaterThan", label: "Greater than" },
  { value: "number_greaterThanOrEqualTo", label: "Greater than or equal" },
  { value: "number_lessThan", label: "Less than" },
  { value: "number_lessThanOrEqualTo", label: "Less than or equal" },
  { value: "number_equals", label: "Equals" },
  { value: "number_notEquals", label: "Not equals" },
  { value: "string_equals", label: "Equals" },
  { value: "string_notEquals", label: "Not equals" },
  { value: "string_contains", label: "Contains" },
  { value: "string_doesNotContain", label: "Does not contain" },
  { value: "string_in", label: "Is one of" },
  { value: "string_notIn", label: "Is not one of" },
  { value: "isNA", label: "Is empty (NA)" },
  { value: "isNotNA", label: "Is not empty (NA)" },
];

export const isNumberFilter = (type?: string): type is NumberFilterType =>
  type?.startsWith("number_") ?? false;

export const isStringFilter = (type?: string): type is StringFilterType =>
  (type?.startsWith("string_") && type !== "string_in" && type !== "string_notIn") ?? false;

export const isDiscreteFilterType = (type?: string): type is DiscreteFilterType =>
  type === "string_in" || type === "string_notIn";

export const isNAFilterType = (type?: string): type is NAFilterType =>
  type === "isNA" || type === "isNotNA";

/** Presence-only column. Decided by `filterConfig`, which has the anchor spec. */
export const isPresenceOnlyOption = (option?: FilterColumnOption): boolean =>
  option?.presenceOnly === true;

/** Column declaring a closed vocabulary, filtered by multi-select. */
export const isMultiSelectColumn = (option?: FilterColumnOption): boolean => {
  const ann = option?.column?.spec?.annotations;
  if (!ann) return false;
  return ann["pl7.app/isDiscreteFilter"] === "true" && !!ann["pl7.app/discreteValues"];
};

/**
 * The predicates a column admits.
 *
 * Precedence: presence-only, then discrete, then value type.
 */
export function filterTypesFor(option?: FilterColumnOption, currentType?: string) {
  return admitCurrent(admissibleTypesFor(option), currentType);
}

/** Keeps a saved predicate in the list after the column stops admitting it. */
function admitCurrent(types: typeof filterTypeOptions, currentType?: string) {
  if (!currentType || types.some((t) => t.value === currentType)) return types;
  const saved = filterTypeOptions.find((t) => t.value === currentType);
  return saved ? [...types, saved] : types;
}

function admissibleTypesFor(option?: FilterColumnOption) {
  if (!option) return filterTypeOptions;

  if (isPresenceOnlyOption(option)) {
    return filterTypeOptions.filter((opt) => isNAFilterType(opt.value));
  }

  const valueType = option.column?.spec?.valueType;
  if (!valueType) return filterTypeOptions;

  if (valueType === "String") {
    if (isMultiSelectColumn(option)) {
      return filterTypeOptions.filter(
        (opt) => isDiscreteFilterType(opt.value) || isNAFilterType(opt.value),
      );
    }
    return filterTypeOptions.filter(
      (opt) =>
        (opt.value.startsWith("string_") && !isDiscreteFilterType(opt.value)) ||
        isNAFilterType(opt.value),
    );
  }

  return filterTypeOptions.filter(
    (opt) => opt.value.startsWith("number_") || isNAFilterType(opt.value),
  );
}

export function createFilter(type: string): AnyFilter {
  if (isNAFilterType(type)) {
    return { type } as AnyFilter;
  } else if (isNumberFilter(type)) {
    return { type, reference: 0 };
  } else if (isDiscreteFilterType(type)) {
    return { type, reference: "[]" };
  } else if (isStringFilter(type)) {
    return { type, reference: "" };
  } else {
    return { type: "number_greaterThan", reference: 0 };
  }
}
