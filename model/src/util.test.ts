import type { AxisSpec, ColumnRecipe, PColumnSpec } from "@platforma-sdk/model";
import { canonicalizeAxisId, createGlobalPObjectId } from "@platforma-sdk/model";
import { describe, expect, test } from "vitest";
import {
  defaultsForSubset,
  defaultClusteringSubset,
  isPresenceOnlyColumn,
  isRankableMatch,
  readInitializedForAnchor,
} from "./util";

const sampleAxis: AxisSpec = { type: "String", name: "pl7.app/sampleId" };
const clonotypeAxis: AxisSpec = {
  type: "String",
  name: "pl7.app/vdj/clonotypeKey",
  domain: { "pl7.app/vdj/clonotypingRunId": "run1" },
};
/** Same name and type as the anchor's clonotype axis, with one more domain key. */
const narrowerClonotypeAxis: AxisSpec = {
  type: "String",
  name: "pl7.app/vdj/clonotypeKey",
  domain: { "pl7.app/vdj/clonotypingRunId": "run1", "pl7.app/vdj/chain": "IGH" },
};
/** Same name and type as the anchor's clonotype axis, carrying no domain at all. */
const undomainedClonotypeAxis: AxisSpec = {
  type: "String",
  name: "pl7.app/vdj/clonotypeKey",
};

/** The Contrast axis differential-clonotype-abundance mints; the anchor has no such axis. */
const contrastAxis: AxisSpec = {
  type: "String",
  name: "pl7.app/dea/contrast",
  domain: { "pl7.app/blockId": "da1" },
};

/** The dataset lead selection anchors on. */
const anchor: PColumnSpec = {
  kind: "PColumn",
  name: "pl7.app/vdj/readCount",
  valueType: "Int",
  axesSpec: [sampleAxis, clonotypeAxis],
  annotations: { "pl7.app/isAnchor": "true" },
};

const col = (over: Partial<PColumnSpec> & { axesSpec: AxisSpec[] }): PColumnSpec => ({
  kind: "PColumn",
  name: "test/column",
  valueType: "Int",
  annotations: {},
  ...over,
});

describe("isPresenceOnlyColumn", () => {
  test("a repertoire-labeling label column is presence-only", () => {
    // github.com/platforma-open/repertoire-labeling PR #1. The block emits one sparse Int
    // column per label. The value is the literal 1. The anchor supplies the entity axis.
    const label = col({
      name: "pl7.app/tag",
      valueType: "Int",
      axesSpec: [clonotypeAxis],
      domain: { "pl7.app/tag/name": "AAAAAAAAAAAAAAAAAAAAAAAA" },
      annotations: { "pl7.app/label": "Strong binders", "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(label, anchor)).toBe(true);
  });

  test("NON-REGRESSION: differential-clonotype-abundance Log2FC is not presence-only", () => {
    // The column carries the annotation. It also carries a Contrast axis the anchor lacks,
    // so it is not a subset of the dataset. Its values are real. It keeps its numeric
    // operators and stays rankable.
    const log2fc = col({
      name: "pl7.app/dea/log2foldchange",
      valueType: "Double",
      axesSpec: [contrastAxis, clonotypeAxis],
      annotations: { "pl7.app/label": "Log2FC", "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(log2fc, anchor)).toBe(false);
  });

  // Axis identity includes domain. A same-named axis with an extra key is a different
  // axis. It keys different entities.
  test("an axis with an extra domain key is not presence-only", () => {
    const narrower = col({
      axesSpec: [narrowerClonotypeAxis],
      annotations: { "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(narrower, anchor)).toBe(false);
  });

  // The same rule in the other direction. A label column whose axis lost the anchor's
  // domain keeps its full operator list.
  test("an axis carrying no domain is not presence-only against a domained anchor", () => {
    const undomained = col({
      axesSpec: [undomainedClonotypeAxis],
      annotations: { "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(undomained, anchor)).toBe(false);
  });

  test("a subset-shaped column without the annotation is not presence-only", () => {
    const score = col({
      valueType: "Double",
      axesSpec: [clonotypeAxis],
      annotations: { "pl7.app/isScore": "true" },
    });
    expect(isPresenceOnlyColumn(score, anchor)).toBe(false);
  });

  test("a column keyed by the full anchor axis set is presence-only", () => {
    const perSample = col({
      axesSpec: [sampleAxis, clonotypeAxis],
      annotations: { "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(perSample, anchor)).toBe(true);
  });
});

describe("isPresenceOnlyColumn invariants", () => {
  // Five axes, arrays of one to three: 155 combinations, so these enumerate the space
  // rather than sample it. The pool holds two axes that collide with the anchor's
  // clonotype axis on name and differ only in domain.
  const pool: AxisSpec[] = [
    sampleAxis,
    clonotypeAxis,
    contrastAxis,
    narrowerClonotypeAxis,
    undomainedClonotypeAxis,
  ];
  const axisCombinations: AxisSpec[][] = [];
  for (const a of pool) {
    axisCombinations.push([a]);
    for (const b of pool) {
      axisCombinations.push([a, b]);
      for (const c of pool) axisCombinations.push([a, b, c]);
    }
  }

  const anchorAxisIds = new Set(anchor.axesSpec.map(canonicalizeAxisId));
  const annotated = (axesSpec: AxisSpec[]) =>
    col({ axesSpec, annotations: { "pl7.app/isSubset": "true" } });

  test("an unannotated column is never presence-only", () => {
    for (const axesSpec of axisCombinations) {
      expect(isPresenceOnlyColumn(col({ axesSpec, annotations: {} }), anchor)).toBe(false);
    }
  });

  // Both directions, so a constant-false implementation fails this test.
  test("the verdict tracks whether every axis id is one the anchor carries", () => {
    for (const axesSpec of axisCombinations) {
      const allFromAnchor = axesSpec.every((a) => anchorAxisIds.has(canonicalizeAxisId(a)));
      expect(isPresenceOnlyColumn(annotated(axesSpec), anchor)).toBe(allFromAnchor);
    }
  });

  test("the combinations reach both verdicts", () => {
    const verdicts = axisCombinations.map((a) => isPresenceOnlyColumn(annotated(a), anchor));
    expect(verdicts).toContain(true);
    expect(verdicts).toContain(false);
  });
});

describe("isRankableMatch", () => {
  // Real ids. `isRankableMatch` passes them to `extractPObjectId`.
  const idOf = (name: string) => createGlobalPObjectId("block1", name);
  const recipe = (name: string, spec: PColumnSpec) =>
    ({ id: idOf(name), getSpec: () => spec }) as unknown as ColumnRecipe;

  const presenceOnly = col({
    axesSpec: [clonotypeAxis],
    annotations: { "pl7.app/isSubset": "true" },
  });
  const score = col({
    valueType: "Double",
    axesSpec: [clonotypeAxis],
    annotations: { "pl7.app/isScore": "true" },
  });

  test("an ordinary score column is rankable", () => {
    expect(isRankableMatch(recipe("s", score), anchor, new Set())).toBe(true);
  });

  test("a presence-only column is not rankable", () => {
    expect(isRankableMatch(recipe("p", presenceOnly), anchor, new Set())).toBe(false);
  });

  // The guard for saved projects. Without it, preset defaults replace a ranking list of
  // only presence-only columns. That changes which clonotypes the block selects.
  test("a presence-only column the saved ranking names stays rankable", () => {
    expect(isRankableMatch(recipe("p", presenceOnly), anchor, new Set([idOf("p")]))).toBe(true);
  });

  test("a lead-selection-produced column is never rankable, saved or not", () => {
    const produced = col({
      valueType: "Double",
      axesSpec: [clonotypeAxis],
      annotations: {
        "pl7.app/trace": JSON.stringify([
          { type: "milaboratories.antibody-tcr-lead-selection", label: "Lead Selection" },
        ]),
      },
    });
    expect(isRankableMatch(recipe("l", produced), anchor, new Set())).toBe(false);
    expect(isRankableMatch(recipe("l", produced), anchor, new Set([idOf("l")]))).toBe(false);
  });
});

describe("readInitializedForAnchor", () => {
  const blockId = "f9212394-932e-49ff-8366-017b840d47e9";
  const name = "pf.chain_0/abundance_0";
  const canonical = createGlobalPObjectId(blockId, name);

  test("splits the old joined string, dropping extra ref fields", () => {
    const stored = `${JSON.stringify({ __isRef: true, blockId, name, requireEnrichments: true })}::none`;
    expect(readInitializedForAnchor(stored)).toEqual({ anchor: canonical, preset: "none" });
  });

  test("takes the preset from after the last separator", () => {
    const stored = `${JSON.stringify({ __isRef: true, blockId, name: "a::b" })}::in-vivo`;
    expect(readInitializedForAnchor(stored)).toEqual({
      anchor: createGlobalPObjectId(blockId, "a::b"),
      preset: "in-vivo",
    });
  });

  test("reads a string with no separator as preset none", () => {
    const stored = JSON.stringify({ __isRef: true, blockId, name });
    expect(readInitializedForAnchor(stored)).toEqual({ anchor: canonical, preset: "none" });
  });

  test("keeps an already-split slot", () => {
    const slot = { anchor: canonical, preset: "in-vitro" };
    expect(readInitializedForAnchor(slot)).toEqual(slot);
  });

  test("re-mints an already-split anchor in canonical key order", () => {
    const slot = { anchor: JSON.stringify({ name, blockId, __isRef: true }), preset: "none" };
    expect(readInitializedForAnchor(slot)).toEqual({ anchor: canonical, preset: "none" });
  });

  test("drops a slot whose anchor is not a reference", () => {
    expect(readInitializedForAnchor("not json::none")).toBeUndefined();
    expect(readInitializedForAnchor({ anchor: "{}", preset: "none" })).toBeUndefined();
    expect(readInitializedForAnchor({ anchor: canonical })).toBeUndefined();
    expect(readInitializedForAnchor(42)).toBeUndefined();
    expect(readInitializedForAnchor(undefined)).toBeUndefined();
  });
});

describe("defaultsForSubset", () => {
  const F = createGlobalPObjectId("labeling", "labels.F");
  const G = createGlobalPObjectId("labeling", "labels.G");
  let n = 0;
  const scoreCol = (name: string, subset?: string) => {
    const domain: Record<string, string> = { "pl7.app/vdj/chain": "IGHeavy" };
    if (subset !== undefined) domain["pl7.app/subset"] = subset;
    const spec = col({ name, valueType: "Double", domain, axesSpec: [clonotypeAxis] });
    return { id: `c${n++}`, getSpec: () => spec } as unknown as ColumnRecipe;
  };
  const ids = (cols: ColumnRecipe[]) => cols.map((c) => c.id);

  const REPERTOIRE = "pl7.app/vdj/repertoireScore";
  const LIABILITY = "pl7.app/vdj/developabilityScore";

  test("full-data run: only full-data columns", () => {
    const full = scoreCol(LIABILITY);
    const onF = scoreCol(LIABILITY, F);
    expect(ids(defaultsForSubset([full, onF], undefined))).toEqual([full.id]);
  });

  test("subset run: its own subset's column wins over the full-data one", () => {
    const full = scoreCol(LIABILITY);
    const onF = scoreCol(LIABILITY, F);
    expect(ids(defaultsForSubset([full, onF], F))).toEqual([onF.id]);
  });

  test("subset run: a per-sequence column falls back to full data", () => {
    const full = scoreCol(LIABILITY);
    expect(ids(defaultsForSubset([full], F))).toEqual([full.id]);
  });

  test("subset run: the repertoire score also falls back to full data", () => {
    const full = scoreCol(REPERTOIRE);
    const onF = scoreCol(REPERTOIRE, F);
    expect(ids(defaultsForSubset([full], F))).toEqual([full.id]);
    expect(ids(defaultsForSubset([full, onF], F))).toEqual([onF.id]);
    expect(ids(defaultsForSubset([full, onF], undefined))).toEqual([full.id]);
  });

  test("a column computed on a different subset is never a default", () => {
    const onG = scoreCol(LIABILITY, G);
    expect(ids(defaultsForSubset([onG], F))).toEqual([]);
    expect(ids(defaultsForSubset([onG], undefined))).toEqual([]);
  });
});

describe("defaultClusteringSubset", () => {
  const F = createGlobalPObjectId("labeling", "labels.F");
  const G = createGlobalPObjectId("labeling", "labels.G");
  test.for<{
    available: (string | undefined)[];
    subset: string | undefined;
    expected: string | undefined;
    why: string;
  }>([
    { available: [undefined, F], subset: undefined, expected: undefined, why: "full-data run" },
    { available: [undefined, F], subset: F, expected: F, why: "subset run, own subset exists" },
    {
      available: [undefined, G],
      subset: F,
      expected: undefined,
      why: "subset run, falls back to full data",
    },
  ])("$why", ({ available, subset, expected }) => {
    expect(defaultClusteringSubset(available, subset)).toBe(expected);
  });
});
