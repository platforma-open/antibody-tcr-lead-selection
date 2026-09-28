import type { GlobalPObjectId } from "@milaboratories/pl-model-common";
import type { DatasetSelection, PlRef, PObjectId } from "@platforma-sdk/model";
import type { PlTableFilter } from "./typesFilters";

export * from "./typesFilters";

/**
 * Which bundle of ranking and filter defaults the block offers once a dataset is
 * picked. Changing it re-derives both lists, so it is configuration in its own
 * right and not just a shortcut for them.
 */
export type WorkflowPreset = "in-vivo" | "in-vitro" | "peptide";

/**
 * The anchor the UI last applied ranking / filter defaults for, and the preset it
 * applied them under.
 *
 * One slot, not one per preset: the block holds a single ranking list and a
 * single filter list, and the preset selects which defaults fill them. A stored
 * preset differing from the current one is therefore exactly the signal that the
 * lists belong to the other preset and must be replaced — which is why the
 * comparison lives here rather than being dissolved into per-preset memory.
 *
 * The anchor is its own field rather than being joined onto the preset, and it is
 * the *canonical* serialization of the `PlRef` — a `GlobalPObjectId`. That is what
 * makes it parse as a column identifier, so `relocateBlockIds` rewrites it when a
 * template is applied; it also re-emits it canonically, so whichever side
 * recomputes the value has to canonicalize too or the two will not compare equal.
 * `anchor + "::" + preset` parses as nothing and would arrive still naming the
 * project it was exported from. The preset is not an identifier, so it is carried
 * through untouched.
 */
export type InitializedForAnchor = {
  anchor: GlobalPObjectId;
  preset: WorkflowPreset | "none";
};

/** A column the user picked, together with the anchor it was picked against. */
export type ScopedColumnId = {
  /**
   * Anchor the column was discovered against. The UI uses it to tell a freshly
   * arrived filter/ranking config from a stale one left over from the previous
   * dataset; nothing on the workflow side reads it.
   */
  anchorRef: PlRef;
  /**
   * Terminal storage id of the column, as `extractPObjectId(recipe.id)`.
   *
   * Deliberately *not* the full `ColumnUniversalId` the new API hands out:
   * `bundleBuilder.addSingle` resolves a global `PObjectId` by ref and has no
   * branch for the `ColumnDiscoveredId` that a linker-reached hit carries.
   * Keeping the leaf id reproduces the pre-migration contract, where the model
   * said *which* column and the workflow re-derived *how* to reach it.
   */
  column: PObjectId;
};

export type RankingOrder = {
  value?: ScopedColumnId;
  rankingOrder: "increasing" | "decreasing";
};

/** Filter for matching any of a set of discrete string values */
export type StringInFilter = {
  type: "string_in";
  /** JSON-encoded string array, e.g. '["Yes","No"]' */
  reference: string;
};

/** Filter for excluding a set of discrete string values */
export type StringNotInFilter = {
  type: "string_notIn";
  /** JSON-encoded string array, e.g. '["Yes","No"]' */
  reference: string;
};

export type DiscreteFilter = StringInFilter | StringNotInFilter;

export type Filter = {
  value?: ScopedColumnId;
  filter?: PlTableFilter | DiscreteFilter;
};

/**
 * This block's init-params contract — the shape a block of this kind receives
 * at creation, and exactly what a project template serializes for it.
 *
 * Every field is optional. A block with no dataset picked, no preset chosen and
 * an empty ranking is an ordinary state the UI reaches, so export has to be able
 * to write it and apply has to be able to take it back; a contract that demanded
 * `input` would make export and apply stop being inverses. Whether a
 * configuration is runnable is settled by the model's `args` lambda, not here.
 *
 * The ranking and filter entries carry column identifiers naming a block of the
 * project they were exported from, and they travel anyway: `relocateBlockIds`
 * points every identifier in these params at the blocks of the project being
 * built before the kind ever sees them, walking plain strings as well as
 * ref-shaped objects, so both halves of a {@link ScopedColumnId} — the nested
 * `PlRef` and the canonicalized id string — arrive already rewritten.
 *
 * View state is absent: the table's grid state, the four graph states and the
 * alignment model are what one user was looking at, not the recipe a template
 * exists to reproduce.
 *
 * `inVivoScoreRemovedNotice` is absent: a migration sets it for a stored project
 * that lost the built-in in-vivo score, so carrying it would show that notice to
 * a project which never had the column.
 */
export type BlockParams = {
  // Input wiring — the dataset bundle a template engine fills from an earlier
  // entry's output.
  input?: DatasetSelection;

  // Analysis configuration — the recipe a template exists to reproduce.
  preset?: WorkflowPreset;
  topClonotypes?: number;
  kabatNumbering?: boolean;
  rankingOrder?: RankingOrder[];
  filters?: Filter[];
  diversificationColumn?: PlRef;

  // Which anchor the UI last applied the ranking / filter defaults for, and
  // under which preset. Carried because it relocates: `anchor` is a canonically
  // serialized `PlRef`, which `relocateBlockIds` rewrites to the corresponding
  // block of the project being built, while `preset` is left alone. It therefore
  // matches what the target project computes, so the carried ranking and filter
  // lists are recognized as already applied and kept, rather than being replaced
  // by the landing dataset's defaults.
  filtersInitializedForAnchor?: InitializedForAnchor;
  rankingsInitializedForAnchor?: InitializedForAnchor;

  // Display naming.
  defaultBlockLabel?: string;
  customBlockLabel?: string;
};
