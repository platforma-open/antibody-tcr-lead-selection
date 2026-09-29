import { kind } from "@platforma-open/milaboratories.top-antibodies.kind";
import { createGlobalPObjectId } from "@platforma-sdk/model";
import { describe, expect, test } from "vitest";
import { blockDataModel } from "./dataModel";

const blockId = "f9212394-932e-49ff-8366-017b840d47e9";
const name = "pf.chain_0/abundance_0";
const anchor = createGlobalPObjectId(blockId, name);
const joined = `${JSON.stringify({ __isRef: true, blockId, name, requireEnrichments: true })}::none`;

/** Runs one stored pair of defaults-init slots through the migration chain. */
function migrateSlots(version: string, stored: unknown) {
  const { data } = blockDataModel.migrate({
    version,
    data: { filtersInitializedForAnchor: stored, rankingsInitializedForAnchor: stored },
  });
  return {
    filtersInitializedForAnchor: data.filtersInitializedForAnchor,
    rankingsInitializedForAnchor: data.rankingsInitializedForAnchor,
  };
}

describe("defaults-init slot migration", () => {
  test("a joined string left at Ver_2026_08_20 is split", () => {
    expect(migrateSlots("Ver_2026_08_20", joined)).toEqual({
      filtersInitializedForAnchor: { anchor, preset: "none" },
      rankingsInitializedForAnchor: { anchor, preset: "none" },
    });
  });

  test("a joined string from before Ver_2026_08_20 is split", () => {
    expect(migrateSlots("Ver_2026_07_28", joined).filtersInitializedForAnchor).toEqual({
      anchor,
      preset: "none",
    });
  });

  test("an already split slot is kept", () => {
    const slot = { anchor, preset: "in-vitro" };
    expect(migrateSlots("Ver_2026_08_20", slot).filtersInitializedForAnchor).toEqual(slot);
  });

  test("the migrated slots are what the kind accepts, and the joined string is not", () => {
    expect(() =>
      kind.parseInitializationParams(migrateSlots("Ver_2026_08_20", joined)),
    ).not.toThrow();
    expect(() => kind.parseInitializationParams({ filtersInitializedForAnchor: joined })).toThrow(
      "'filtersInitializedForAnchor' must be an object of { anchor, preset }",
    );
  });
});
