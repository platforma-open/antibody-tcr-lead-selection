import type { AxisSpec, PColumnSpec } from "@platforma-sdk/model";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { isPresenceOnlyColumn } from "./util";

const sampleAxis: AxisSpec = { type: "String", name: "pl7.app/sampleId" };
const clonotypeAxis: AxisSpec = {
  type: "String",
  name: "pl7.app/vdj/clonotypeKey",
  domain: { "pl7.app/vdj/clonotypingRunId": "run1" },
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
    // github.com/platforma-open/repertoire-labeling PR #1: one sparse Int column per
    // label, value is the literal 1, single entity axis taken from the anchor.
    const label = col({
      name: "pl7.app/tag",
      valueType: "Int",
      axesSpec: [clonotypeAxis],
      domain: { "pl7.app/tag/name": "AAAAAAAAAAAAAAAAAAAAAAAA" },
      annotations: { "pl7.app/label": "Strong binders", "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(label, anchor)).toBe(true);
  });

  test("this block's own Selected Leads column is presence-only", () => {
    const leads = col({
      name: "pl7.app/lead-selection",
      axesSpec: [clonotypeAxis],
      annotations: { "pl7.app/label": "Selected Leads", "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(leads, anchor)).toBe(true);
  });

  test("NON-REGRESSION: differential-clonotype-abundance Log2FC is not presence-only", () => {
    // Annotated isSubset, but it carries a Contrast axis the anchor lacks, so it is not a
    // subset of the dataset and its values are real. It must keep its numeric operators
    // and stay rankable.
    const log2fc = col({
      name: "pl7.app/dea/log2foldchange",
      valueType: "Double",
      axesSpec: [contrastAxis, clonotypeAxis],
      annotations: { "pl7.app/label": "Log2FC", "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(log2fc, anchor)).toBe(false);
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
  const anyAxis = fc.constantFrom(sampleAxis, clonotypeAxis, contrastAxis);
  const anySpec = fc
    .record({
      axesSpec: fc.array(anyAxis, { minLength: 1, maxLength: 3 }),
      annotations: fc.dictionary(fc.string(), fc.string()),
    })
    .map((over) => col(over));

  // Without the annotation the shape never matters. This is what keeps every ordinary
  // score column, whatever its axes, out of the presence-only path.
  test("an unannotated column is never presence-only", () => {
    fc.assert(
      fc.property(anySpec, (spec) => {
        const withoutAnnotation = { ...spec, annotations: {} };
        expect(isPresenceOnlyColumn(withoutAnnotation, anchor)).toBe(false);
      }),
    );
  });

  // The other half: a true verdict implies every axis is one the anchor carries.
  test("a presence-only verdict implies every axis matches the anchor", () => {
    const anchorNames = new Set(anchor.axesSpec.map((a) => a.name));
    fc.assert(
      fc.property(anySpec, (spec) => {
        const annotated = { ...spec, annotations: { "pl7.app/isSubset": "true" } };
        if (isPresenceOnlyColumn(annotated, anchor)) {
          expect(annotated.axesSpec.every((a) => anchorNames.has(a.name))).toBe(true);
        }
      }),
    );
  });

  test("the anchor's own axis set is presence-only when annotated", () => {
    const onAnchorAxes = col({
      axesSpec: anchor.axesSpec,
      annotations: { "pl7.app/isSubset": "true" },
    });
    expect(isPresenceOnlyColumn(onAnchorAxes, anchor)).toBe(true);
  });
});
