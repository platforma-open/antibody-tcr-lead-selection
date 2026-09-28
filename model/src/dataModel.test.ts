import { kind } from "@platforma-open/milaboratories.top-antibodies.kind";
import { createPlRef } from "@platforma-sdk/model";
import { describe, expect, test } from "vitest";
import { blockDataModel } from "./dataModel";

const blockId = "f9212394-932e-49ff-8366-017b840d47e9";
const name = "pf.chain_0/abundance_0";
const anchor = createPlRef(blockId, name);
const serializedAnchor = JSON.stringify({ __isRef: true, blockId, name, requireEnrichments: true });

/** Runs one stored pair of defaults-init slots through the migration chain. */
function migrateSlots(version: string, filters: unknown, rankings: unknown = filters) {
  const { data } = blockDataModel.migrate({
    version,
    data: { filtersInitializedForAnchor: filters, rankingsInitializedForAnchor: rankings },
  });
  return {
    filters: data.filtersInitializedForAnchor,
    rankings: data.rankingsInitializedForAnchor,
  };
}

describe("defaults-init slot migration", () => {
  test("a joined string left at Ver_2026_08_20 becomes a PlRef slot", () => {
    expect(migrateSlots("Ver_2026_08_20", `${serializedAnchor}::none`)).toEqual({
      filters: { anchor, preset: "none" },
      rankings: { anchor, preset: "none" },
    });
  });

  test("a split slot with a serialized anchor becomes a PlRef slot", () => {
    const stored = { anchor: JSON.stringify({ name, blockId, __isRef: true }), preset: "in-vitro" };
    expect(migrateSlots("Ver_2026_08_20", stored).filters).toEqual({ anchor, preset: "in-vitro" });
  });

  test("a joined string from before Ver_2026_08_20 becomes a PlRef slot", () => {
    expect(migrateSlots("Ver_2026_07_28", `${serializedAnchor}::in-vivo`).filters).toEqual({
      anchor,
      preset: "in-vivo",
    });
  });

  test("the preset is taken from after the last separator", () => {
    const stored = `${JSON.stringify({ __isRef: true, blockId, name: "a::b" })}::peptide`;
    expect(migrateSlots("Ver_2026_08_20", stored).filters).toEqual({
      anchor: createPlRef(blockId, "a::b"),
      preset: "peptide",
    });
  });

  test("a string with no separator reads as preset none", () => {
    expect(migrateSlots("Ver_2026_08_20", JSON.stringify(anchor)).filters).toEqual({
      anchor,
      preset: "none",
    });
  });

  test("a slot whose anchor is not a reference is dropped", () => {
    for (const stored of ["not json::none", { anchor: "{}", preset: "none" }, 42, undefined]) {
      expect(migrateSlots("Ver_2026_08_20", stored).filters).toBeUndefined();
    }
  });

  test("the migrated slot is what the kind accepts, and the old forms are not", () => {
    const { filters, rankings } = migrateSlots("Ver_2026_08_20", `${serializedAnchor}::none`);
    expect(() =>
      kind.parseInitializationParams({
        filtersInitializedForAnchor: filters,
        rankingsInitializedForAnchor: rankings,
      }),
    ).not.toThrow();

    for (const legacy of [
      `${serializedAnchor}::none`,
      { anchor: serializedAnchor, preset: "none" },
    ]) {
      expect(() => kind.parseInitializationParams({ filtersInitializedForAnchor: legacy })).toThrow(
        "'filtersInitializedForAnchor' must be an object of { anchor, preset }",
      );
    }
  });
});
