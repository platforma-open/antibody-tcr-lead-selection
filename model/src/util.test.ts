import type { AxisSpec, ColumnRecipe, PColumnSpec } from "@platforma-sdk/model";
import { canonicalizeAxisId, createGlobalPObjectId } from "@platforma-sdk/model";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { isPresenceOnlyColumn, isRankableMatch } from "./util";

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
  // The two domain variants let the generator reach name collisions that differ only
  // in domain.
  const anyAxis = fc.constantFrom(
    sampleAxis,
    clonotypeAxis,
    contrastAxis,
    narrowerClonotypeAxis,
    undomainedClonotypeAxis,
  );
  const anySpec = fc
    .record({
      axesSpec: fc.array(anyAxis, { minLength: 1, maxLength: 3 }),
      annotations: fc.dictionary(fc.string(), fc.string()),
    })
    .map((over) => col(over));

  const anchorAxisIds = new Set(anchor.axesSpec.map(canonicalizeAxisId));
  const annotate = (spec: PColumnSpec) => ({
    ...spec,
    annotations: { "pl7.app/isSubset": "true" },
  });

  test("an unannotated column is never presence-only", () => {
    fc.assert(
      fc.property(anySpec, (spec) => {
        expect(isPresenceOnlyColumn({ ...spec, annotations: {} }, anchor)).toBe(false);
      }),
    );
  });

  // Both directions. A constant-false implementation fails the first case.
  test("the verdict tracks whether every axis id is one the anchor carries", () => {
    fc.assert(
      fc.property(anySpec, (spec) => {
        const allFromAnchor = spec.axesSpec.every((a) => anchorAxisIds.has(canonicalizeAxisId(a)));
        expect(isPresenceOnlyColumn(annotate(spec), anchor)).toBe(allFromAnchor);
      }),
    );
  });

  test("a column built only from the anchor's own axes is presence-only", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...anchor.axesSpec), { minLength: 1, maxLength: 3 }),
        (axesSpec) => {
          expect(isPresenceOnlyColumn(annotate(col({ axesSpec })), anchor)).toBe(true);
        },
      ),
    );
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
