import type { DatasetSelection } from "@platforma-sdk/model";

/**
 * Which bundle of ranking and filter defaults the block applies once a dataset
 * is picked. The concrete rankings and filters are re-derived from it against
 * whatever columns the dataset actually carries, so this is the portable form
 * of "how leads are selected".
 */
export type WorkflowPreset = "in-vivo" | "in-vitro" | "peptide";

/**
 * This block's init-params contract — the shape a block of this kind receives
 * at creation, and exactly what a project template serializes for it.
 *
 * Every field is optional. A block with no dataset picked and no preset chosen
 * is an ordinary state the UI reaches, so export has to be able to write it and
 * apply has to be able to take it back; a contract that demanded `input` would
 * make export and apply stop being inverses. Whether a configuration is
 * runnable is settled by the model's `args` lambda, not here.
 *
 * The stored ranking and filter lists are deliberately absent. Each of their
 * entries carries a `PObjectId`, whose global form is a canonicalized `PlRef` —
 * it names a column of the *exporting* project's block and resolves to nothing
 * anywhere else. The UI also rebuilds both lists from the `rankingConfig` /
 * `filterConfig` outputs whenever the config it holds does not match the anchor
 * the block landed on, so a carried list would be overwritten in the good case
 * and stranded in the bad one. `preset` is what actually travels: it names the
 * defaults, and the target project fills in its own ids.
 *
 * `diversificationColumn` is absent for the same reason — the UI writes it from
 * the `clusterColumnOptions` output, picking the first linker the landing
 * dataset offers, and only when it is unset. A carried ref would name the
 * exporting project's linker column and would suppress that re-derivation
 * rather than be corrected by it.
 *
 * View state — table grid state, the four graph states, the alignment model,
 * the panel-init guards, the dismissed one-time notice — is absent because it
 * is what one user was looking at, not the recipe a template exists to
 * reproduce.
 */
export type BlockParams = {
  // Input wiring — the dataset bundle a template engine fills from an earlier
  // entry's output.
  input?: DatasetSelection;

  // Analysis configuration — the recipe a template exists to reproduce.
  preset?: WorkflowPreset;
  topClonotypes?: number;
  kabatNumbering?: boolean;

  // Display naming.
  defaultBlockLabel?: string;
  customBlockLabel?: string;
};
