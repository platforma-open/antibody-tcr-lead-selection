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

describe("ranking weight migration", () => {
  const column = (n: string) => ({
    anchorRef: { __isRef: true, blockId, name: n },
    column: createGlobalPObjectId(blockId, n),
  });

  /** Runs a stored ranking list through the chain from the version it was left at. */
  function migrateRanking(version: string, rankingOrder: unknown) {
    return blockDataModel.migrate({ version, data: { rankingOrder } }).data.rankingOrder;
  }

  const weightless = [
    { value: column("a"), rankingOrder: "decreasing" },
    { value: column("b"), rankingOrder: "increasing" },
    { value: column("c"), rankingOrder: "decreasing" },
  ];

  test("a stored list from before weights gets descending weights in its own order", () => {
    // The order was the priority; descending weights keep it.
    expect(migrateRanking("Ver_2026_09_28", weightless).map((r) => r.weight)).toEqual([3, 2, 1]);
  });

  test("directions and columns come through untouched", () => {
    const migrated = migrateRanking("Ver_2026_09_28", weightless);
    expect(migrated.map((r) => r.rankingOrder)).toEqual(["decreasing", "increasing", "decreasing"]);
    expect(migrated.map((r) => r.value)).toEqual(weightless.map((r) => r.value));
  });

  test("four metrics come out at 0.4 / 0.3 / 0.2 / 0.1 of the score", () => {
    const weights = migrateRanking("Ver_2026_09_28", [...weightless, weightless[0]]).map(
      (r) => r.weight,
    );
    expect(weights).toEqual([4, 3, 2, 1]);
  });

  test("stored data holding no ranking list at all still migrates", () => {
    // The weights step runs on every project, so it must survive data with no ranking list.
    expect(
      blockDataModel.migrate({ version: "Ver_2026_09_28", data: {} }).data.rankingOrder,
    ).toEqual([]);
  });

  test("the migrated ranking is what the kind accepts", () => {
    expect(() =>
      kind.parseInitializationParams({
        rankingOrder: migrateRanking("Ver_2026_09_28", weightless),
      }),
    ).not.toThrow();
  });
});

describe("balanced ranking notice", () => {
  /** Runs stored data through the chain from the version it was left at. */
  const notice = (version: string, data: unknown) =>
    blockDataModel.migrate({ version, data }).data.balancedRankingNotice;

  test("a project with a stored ranking is told its results will change", () => {
    expect(
      notice("Ver_2026_10_02", { rankingOrder: [{ rankingOrder: "decreasing", weight: 1 }] }),
    ).toBe(true);
  });

  test("a project that never ranked anything is not", () => {
    expect(notice("Ver_2026_10_02", { rankingOrder: [] })).toBeUndefined();
  });
});
