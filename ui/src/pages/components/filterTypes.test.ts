import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  createFilter,
  filterTypeOptions,
  filterTypesFor,
  type FilterColumnOption,
} from "./filterTypes";

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
    // differential-clonotype-abundance Log2FC. It carries the annotation. The model does
    // not flag it, so it keeps every numeric operator.
    const log2fc = option("Double", { "pl7.app/isSubset": "true", "pl7.app/format": ".2f" }, false);
    expect(types(log2fc)).toEqual(types(option("Double")));
  });
});

describe("a saved predicate stays visible", () => {
  const presenceOnly = option("Int", {}, true);

  test("a numeric predicate saved before the column became presence-only is kept", () => {
    // clonotype-browser and cell-browser annotation filters are presence-only columns.
    // They already exist in projects. A saved `Filter > 0` must stay in the list.
    expect(types(presenceOnly)).toEqual(["isNA", "isNotNA"]);
    const withSaved = filterTypesFor(presenceOnly, "number_greaterThan").map((t) => t.value);
    expect(withSaved).toContain("number_greaterThan");
    expect(withSaved).toEqual(expect.arrayContaining(["isNA", "isNotNA"]));
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

describe("createFilter", () => {
  // The shape a fresh filter starts in. FilterCard writes it into block args. A missing
  // or wrongly-typed `reference` reaches the workflow.
  test.each([
    ["isNotNA", { type: "isNotNA" }],
    ["isNA", { type: "isNA" }],
    ["number_greaterThan", { type: "number_greaterThan", reference: 0 }],
    ["string_equals", { type: "string_equals", reference: "" }],
    ["string_in", { type: "string_in", reference: "[]" }],
  ])("%s", (type, expected) => {
    expect(createFilter(type)).toEqual(expected);
  });

  test("an unknown type falls back to a usable numeric filter", () => {
    expect(createFilter("not_a_filter")).toEqual({ type: "number_greaterThan", reference: 0 });
  });

  test("every offered predicate builds a filter of that type", () => {
    for (const { value } of filterTypeOptions) {
      expect(createFilter(value)).toMatchObject({ type: value });
    }
  });
});

describe("invariants", () => {
  const anyOption = fc.record(
    {
      presenceOnly: fc.boolean(),
      column: fc.record({
        spec: fc.record({
          valueType: fc.constantFrom("Int", "Long", "Float", "Double", "String"),
          annotations: fc.dictionary(fc.string(), fc.string()),
        }),
      }),
    },
    { requiredKeys: ["column"] },
  );
  const knownType = fc.constantFrom(...filterTypeOptions.map((t) => t.value));

  // The guard for saved projects. A predicate already in block args stays in the
  // dropdown, whatever the column now admits.
  test("a known saved predicate is always offered", () => {
    fc.assert(
      fc.property(anyOption, knownType, (option, current) => {
        expect(filterTypesFor(option as FilterColumnOption, current).map((t) => t.value)).toContain(
          current,
        );
      }),
    );
  });

  test("the result is always a duplicate-free subset of the known predicates", () => {
    const known = new Set(filterTypeOptions.map((t) => t.value));
    fc.assert(
      fc.property(anyOption, fc.option(knownType, { nil: undefined }), (option, current) => {
        const out = filterTypesFor(option as FilterColumnOption, current).map((t) => t.value);
        expect(out.every((v) => known.has(v))).toBe(true);
        expect(new Set(out).size).toBe(out.length);
      }),
    );
  });

  // Passing a saved predicate only ever adds to the list.
  test("a saved predicate never removes an otherwise-admissible one", () => {
    fc.assert(
      fc.property(anyOption, knownType, (option, current) => {
        const base = filterTypesFor(option as FilterColumnOption).map((t) => t.value);
        const withSaved = filterTypesFor(option as FilterColumnOption, current).map((t) => t.value);
        expect(base.every((v) => withSaved.includes(v))).toBe(true);
      }),
    );
  });

  test("every column offers at least one predicate", () => {
    fc.assert(
      fc.property(anyOption, (option) => {
        expect(filterTypesFor(option as FilterColumnOption).length).toBeGreaterThan(0);
      }),
    );
  });
});
