import { describe, expect, test } from "vitest";
import { kind } from "./index";

const parse = (params: unknown) => kind.parseInitializationParams(params);

describe("templates written by earlier versions of the kind", () => {
  test("a defaultBlockLabel key is ignored, not rejected", () => {
    const parsed = parse({
      topClonotypes: 50,
      defaultBlockLabel: "Donor 3 clonotypes",
      customBlockLabel: "My leads",
    });
    expect(parsed).toEqual({ topClonotypes: 50, customBlockLabel: "My leads" });
    expect(parsed).not.toHaveProperty("defaultBlockLabel");
  });
});
