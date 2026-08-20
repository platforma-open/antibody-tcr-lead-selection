import { assertParamsObject } from "@platforma-sdk/block-kind";
import { isDatasetSelection } from "@platforma-sdk/model";
import { isBoolean, isString } from "es-toolkit";
import { isNumber } from "es-toolkit/compat";
import type { BlockParams, WorkflowPreset } from "./types";

/**
 * The contract at runtime, for params that arrive from a template file rather
 * than from typed code.
 *
 * Each field the contract names is read and checked; a key it does not name is
 * dropped by never being read, so it needs no rejection here. Params written
 * against a different version of the contract are caught by the version in the
 * template entry's `{name}@{selector}` reference, not by a key-set check.
 */
export function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const params: Record<string, unknown> = {};
  for (const [field, { is, must }] of Object.entries(CONTRACT)) {
    const raw = value[field];
    if (raw === undefined) continue;
    if (!is(raw)) throw new Error(`'${field}' must be ${must}.`);
    params[field] = raw;
  }
  // Every value placed here passed its own field's guard, and `CONTRACT` is
  // proven exhaustive over `BlockParams` by the `satisfies` below.
  return params as BlockParams;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Guard<T> = (value: unknown) => value is T;

/** A guard plus how to finish the sentence "'field' must be …". */
type Check<T> = { readonly is: Guard<T>; readonly must: string };

function check<T>(is: Guard<T>, must: string): Check<T> {
  return { is, must };
}

function oneOf<T extends string>(...allowed: readonly T[]): Guard<T> {
  return (v): v is T => allowed.includes(v as T);
}

/**
 * The contract, field by field, at runtime.
 *
 * The `satisfies` clause is the drift guard: it demands an entry for every key
 * `BlockParams` declares, and types each guard against that key's own type. Add
 * a field to the contract and this stops compiling until the check exists —
 * which matters here because every field is optional, so a parser that simply
 * forgot one would otherwise return a valid `BlockParams` and say nothing.
 *
 * `topClonotypes` is checked as an integer, not against the minimum the field
 * editor enforces. A value below it is a configuration the block itself has to
 * answer for, and the bound lives with the input that sets it; restating it here
 * would make the kind refuse a file the UI can produce the moment either side
 * moves.
 */
const CONTRACT = {
  input: check(isDatasetSelection, "a dataset selection emitted by the dataset picker"),

  preset: check(
    oneOf<WorkflowPreset>("in-vivo", "in-vitro", "peptide"),
    "one of: in-vivo, in-vitro, peptide",
  ),
  topClonotypes: check(isNumber, "a number"),
  kabatNumbering: check(isBoolean, "a boolean"),

  defaultBlockLabel: check(isString, "a string"),
  customBlockLabel: check(isString, "a string"),
} satisfies { [K in keyof BlockParams]-?: Check<NonNullable<BlockParams[K]>> };
