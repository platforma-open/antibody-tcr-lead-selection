import { describe, expect, test } from "vitest";
import { filterTypesFor, isSubsetColumn, type FilterColumnOption } from "./filterTypes";

const option = (
  valueType: string,
  annotations: Record<string, string> = {},
): FilterColumnOption => ({ column: { spec: { valueType, annotations } } });

const types = (o: FilterColumnOption) => filterTypesFor(o).map((t) => t.value);

/** repertoire-labeling: one sparse Int column per label, value is the literal 1. */
const labelColumn = option("Int", {
  "pl7.app/label": "Strong binders",
  "pl7.app/isSubset": "true",
  "pl7.app/table/visibility": "default",
});

/** This block's own Selected Leads column. */
const leadSelectionColumn = option("Int", {
  "pl7.app/label": "Selected Leads",
  "pl7.app/isSubset": "true",
});

/** differential-clonotype-abundance Log2FC — a subset column whose values are meaningful. */
const log2FcColumn = option("Double", {
  "pl7.app/label": "Log2FC",
  "pl7.app/isSubset": "true",
  "pl7.app/format": ".2f",
});

describe("subset columns", () => {
  test("a label column admits presence predicates only", () => {
    expect(types(labelColumn)).toEqual(["isNA", "isNotNA"]);
  });

  test("subset wins over the value type", () => {
    expect(types(leadSelectionColumn)).not.toContain("number_greaterThan");
  });

  test("the annotation is what decides, not the label or value type", () => {
    expect(isSubsetColumn(labelColumn)).toBe(true);
    expect(isSubsetColumn(option("Int", { "pl7.app/label": "Rank" }))).toBe(false);
  });

  test("REGRESSION: a mis-annotated numeric column loses its operators", () => {
    expect(types(log2FcColumn)).toEqual(["isNA", "isNotNA"]);
  });
});

describe("non-subset columns keep their predicates", () => {
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
