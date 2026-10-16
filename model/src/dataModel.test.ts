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

  test("a stored list from before weights gets equal weights", () => {
    // The order is still the priority — the block migrates into `priority` mode — so the
    // weights carry no ordering of their own and start level for the balanced score.
    expect(migrateRanking("Ver_2026_09_28", weightless).map((r) => r.weight)).toEqual([1, 1, 1]);
  });

  test("directions and columns come through untouched", () => {
    const migrated = migrateRanking("Ver_2026_09_28", weightless);
    expect(migrated.map((r) => r.rankingOrder)).toEqual(["decreasing", "increasing", "decreasing"]);
    expect(migrated.map((r) => r.value)).toEqual(weightless.map((r) => r.value));
  });

  test("four metrics each take a quarter of the balanced score", () => {
    const weights = migrateRanking("Ver_2026_09_28", [...weightless, weightless[0]]).map(
      (r) => r.weight,
    );
    expect(weights).toEqual([1, 1, 1, 1]);
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

describe("the chain survives the shapes stored data really has", () => {
  // A throwing migration leaves the block unable to take the new pack at all, so
  // every version key must tolerate a ranking list that is absent or malformed.
  // Entering at Ver_2026_09_28 hides this: the weights step rebuilds the array
  // before the later steps see it. These enter at every key.
  const VERSIONS = [
    "Ver_2026_02_25",
    "Ver_2026_05_08",
    "Ver_2026_05_21",
    "Ver_2026_07_28",
    "Ver_2026_08_20",
    "Ver_2026_09_28",
  ];
  const SHAPES: [string, unknown][] = [
    ["no ranking key", {}],
    ["rankingOrder undefined", { rankingOrder: undefined }],
    ["empty ranking", { rankingOrder: [] }],
  ];

  for (const version of VERSIONS) {
    for (const [label, data] of SHAPES) {
      test(`${version} + ${label}`, () => {
        expect(() => blockDataModel.migrate({ version, data })).not.toThrow();
        // Whatever the stored shape, the block lands on the behaviour it already had.
        expect(blockDataModel.migrate({ version, data }).data.rankingMode).toBe("priority");
      });
    }
  }
});

describe("ranking mode default", () => {
  /** Runs stored data through the chain from the version it was left at. */
  const mode = (version: string, data: unknown) =>
    blockDataModel.migrate({ version, data }).data.rankingMode;

  test("a migrated project keeps the behaviour it already had", () => {
    expect(mode("Ver_2026_09_28", { rankingOrder: [{ rankingOrder: "decreasing" }] })).toBe(
      "priority",
    );
  });

  test("so does one that never ranked anything", () => {
    expect(mode("Ver_2026_09_28", {})).toBe("priority");
  });

  test("migrated rows carry equal weights, not a descending priority", () => {
    const rows = blockDataModel.migrate({
      version: "Ver_2026_09_28",
      data: { rankingOrder: [{ rankingOrder: "decreasing" }, { rankingOrder: "increasing" }] },
    }).data.rankingOrder;
    expect(rows.map((r) => r.weight)).toEqual([1, 1]);
  });
});
