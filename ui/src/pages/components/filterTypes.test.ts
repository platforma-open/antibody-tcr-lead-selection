import { describe, expect, test } from "vitest";
import { filterTypesFor, isPresenceOnlyOption, type FilterColumnOption } from "./filterTypes";

const option = (
  valueType: string,
  annotations: Record<string, string> = {},
  presenceOnly = false,
): FilterColumnOption => ({ column: { spec: { valueType, annotations } }, presenceOnly });

const types = (o: FilterColumnOption) => filterTypesFor(o).map((t) => t.value);

describe("presence-only columns", () => {
  test("admit presence predicates only", () => {
    expect(types(option("Int", { "pl7.app/label": "Strong binders" }, true))).toEqual([
      "isNA",
      "isNotNA",
    ]);
  });

  test("presence-only wins over the value type", () => {
    expect(types(option("Double", {}, true))).not.toContain("number_greaterThan");
    expect(types(option("String", {}, true))).not.toContain("string_contains");
  });

  test("the model's flag decides, not the raw annotation", () => {
    // A column carrying the annotation but NOT flagged by the model keeps its operators:
    // this is the differential-clonotype-abundance Log2FC case.
    const log2fc = option("Double", { "pl7.app/isSubset": "true", "pl7.app/format": ".2f" }, false);
    expect(isPresenceOnlyOption(log2fc)).toBe(false);
    expect(types(log2fc)).toContain("number_greaterThan");
  });
});

describe("a saved predicate stays visible", () => {
  const presenceOnly = option("Int", {}, true);

  test("a numeric predicate saved before the column became presence-only is kept", () => {
    // clonotype-browser / cell-browser annotation filters are presence-only columns that
    // already exist in projects, where a saved `Filter > 0` must not vanish from the list.
    expect(types(presenceOnly)).toEqual(["isNA", "isNotNA"]);
    expect(filterTypesFor(presenceOnly, "number_greaterThan").map((t) => t.value)).toEqual([
      "isNA",
      "isNotNA",
      "number_greaterThan",
    ]);
  });

  test("an admissible predicate is not duplicated", () => {
    expect(filterTypesFor(presenceOnly, "isNotNA").map((t) => t.value)).toEqual([
      "isNA",
      "isNotNA",
    ]);
    expect(filterTypesFor(option("Double"), "number_lessThan").map((t) => t.value)).toEqual(
      types(option("Double")),
    );
  });

  test("an unknown predicate is ignored", () => {
    expect(filterTypesFor(presenceOnly, "not_a_filter").map((t) => t.value)).toEqual([
      "isNA",
      "isNotNA",
    ]);
  });
});

describe("non-presence-only columns keep their predicates", () => {
  test("a numeric score gets numeric operators", () => {
    const t = types(option("Double", { "pl7.app/isScore": "true" }));
    expect(t).toContain("number_greaterThan");
    expect(t).toContain("isNotNA");
    expect(t).not.toContain("string_equals");
  });

  test("a discrete string column gets multi-select", () => {
    const t = types(
      option("String", {
        "pl7.app/isDiscreteFilter": "true",
        "pl7.app/discreteValues": JSON.stringify(["bound", "not bound"]),
      }),
    );
    expect(t).toEqual(["string_in", "string_notIn", "isNA", "isNotNA"]);
  });

  test("a plain string column gets string operators", () => {
    const t = types(option("String"));
    expect(t).toContain("string_contains");
    expect(t).not.toContain("string_in");
  });

  test("an unknown column offers everything", () => {
    expect(filterTypesFor(undefined)).toHaveLength(14);
  });
});
