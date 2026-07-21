---
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.ui": patch
"@platforma-open/milaboratories.top-antibodies.workflow": patch
---

Update `@platforma-sdk` to 1.80.x and migrate the block model to the new column-access mechanism.

The removed `ColumnCollectionBuilder` / `ColumnMatch` / `ArrayColumnProvider` APIs are replaced by the host-driven `ColumnsCollection` + `ColumnRecipe` API: column discovery and filtering run host-side via `discover`/`filter` selectors, and specs are fetched on demand through `getSpec()` instead of being pulled eagerly into the sandbox. The main table's `createPlDataTableV3` display rules move from `(spec) => boolean` lambdas to host-side `ColumnSelector`s. No user-facing behavior change intended.
