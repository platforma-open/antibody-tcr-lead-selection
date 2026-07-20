---
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.ui": patch
"@platforma-open/milaboratories.top-antibodies.workflow": patch
---

Update `@platforma-sdk` to 1.80.x and migrate the model to the new column-access mechanism.

`ColumnCollectionBuilder` / `ColumnMatch` / `ArrayColumnProvider` are replaced by the host-driven `ColumnsCollection` + `ColumnRecipe` API; specs are now fetched on demand via `getSpec()` instead of being pulled eagerly into the sandbox. `resultPool.getPColumnSpecByRef` → `Column(ref).getSpec()`, `accessor.getPColumns()` → `ColumnsCollection([accessor])`, `getAnchoredPColumns` → anchored `discover()`, and the main table's `createPlDataTableV3` display rules move from `(spec) => boolean` lambdas to host-side `ColumnSelector`s. No user-facing behavior change intended.
