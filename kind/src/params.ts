import { assertParamsObject } from "@platforma-sdk/block-kind";
import { isDatasetSelection, isPlRef } from "@platforma-sdk/model";
import { isBoolean, isPlainObject, isString } from "es-toolkit";
import { isArray, isNumber } from "es-toolkit/compat";
import type {
  BlockParams,
  DiscreteFilter,
  Filter,
  InitializedForAnchor,
  RankingOrder,
  ScopedColumnId,
  WorkflowPreset,
} from "./types";
import type { PlTableFilter } from "./typesFilters";

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

function arrayOf<T>(item: Guard<T>): Guard<T[]> {
  return (v): v is T[] => isArray(v) && v.every((e) => item(e));
}

/** Lifts a guard over a field the type declares optional. */
function optional<T>(item: Guard<T>): Guard<T | undefined> {
  return (v): v is T | undefined => v === undefined || item(v);
}

/**
 * `column` is a branded canonical id minted by `extractPObjectId`, so it is
 * checked as a string and no further: taking its shape apart here would restate
 * an encoding the block does not own. Both it and `anchorRef` name a block of
 * whichever project exported them, and `relocateBlockIds` has already pointed
 * them at the blocks of the project being built by the time this runs.
 */
const isScopedColumnId: Guard<ScopedColumnId> = (v): v is ScopedColumnId =>
  isPlainObject(v) && isPlRef(v.anchorRef) && isString(v.column);

/**
 * A filter predicate, by its envelope only — a tagged object. Which tags exist
 * and which operands each one carries is settled where the filter is compiled;
 * spelling the union out here would make the kind refuse a file the UI can
 * produce the moment a predicate is added.
 */
const isFilterPredicate: Guard<PlTableFilter | DiscreteFilter> = (
  v,
): v is PlTableFilter | DiscreteFilter => isPlainObject(v) && isString(v.type);

const isRankingOrder: Guard<RankingOrder> = (v): v is RankingOrder =>
  isPlainObject(v) &&
  optional(isScopedColumnId)(v.value) &&
  oneOf("increasing", "decreasing")(v.rankingOrder);

const isFilter: Guard<Filter> = (v): v is Filter =>
  isPlainObject(v) && optional(isScopedColumnId)(v.value) && optional(isFilterPredicate)(v.filter);

/**
 * The defaults-init slot, by its envelope only. `preset` is checked as a string
 * and not against the known union: a preset a later contract adds must not be
 * refused here, and what a preset name means is settled where the defaults are
 * looked up, not at the kind boundary.
 */
const isInitializedForAnchor: Guard<InitializedForAnchor> = (v): v is InitializedForAnchor =>
  isPlainObject(v) && isString(v.anchor) && isString(v.preset);

const REF = "a reference to another block's output";
const INITIALIZED_SLOT = "an object of { anchor, preset }, both strings";

/**
 * The contract, field by field, at runtime.
 *
 * The `satisfies` clause is the drift guard: it demands an entry for every key
 * `BlockParams` declares, and types each guard against that key's own type. Add
 * a field to the contract and this stops compiling until the check exists —
 * which matters here because every field is optional, so a parser that simply
 * forgot one would otherwise return a valid `BlockParams` and say nothing.
 *
 * `topClonotypes` is checked as a number, not against the minimum the field
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
  rankingOrder: check(
    arrayOf(isRankingOrder),
    "an array of { value?, rankingOrder: 'increasing' | 'decreasing' } entries",
  ),
  filters: check(arrayOf(isFilter), "an array of { value?, filter? } entries"),
  diversificationColumn: check(isPlRef, REF),
  filtersInitializedForAnchor: check(isInitializedForAnchor, INITIALIZED_SLOT),
  rankingsInitializedForAnchor: check(isInitializedForAnchor, INITIALIZED_SLOT),

  defaultBlockLabel: check(isString, "a string"),
  customBlockLabel: check(isString, "a string"),
} satisfies { [K in keyof BlockParams]-?: Check<NonNullable<BlockParams[K]>> };
