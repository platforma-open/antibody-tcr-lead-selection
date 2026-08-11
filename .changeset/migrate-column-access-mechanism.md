---
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.ui": patch
"@platforma-open/milaboratories.top-antibodies.workflow": patch
---

Update `@platforma-sdk` to 1.81.x and migrate the block model to the new column-access mechanism.

The removed `ColumnCollectionBuilder` / `ColumnMatch` / `ArrayColumnProvider` APIs are replaced by the host-driven `ColumnsCollection` + `ColumnRecipe` API: column discovery and filtering run host-side via `discover`/`filter` selectors, and specs are fetched on demand through `getSpec()` instead of being pulled eagerly into the sandbox. The main table's `createPlDataTableV3` display rules move from `(spec) => boolean` lambdas to host-side `ColumnSelector`s. No user-facing behavior change intended.

Follow-ups for 1.81: the renamed predicates (`isColumnLazy` → `isDataColumn`), the `LinkerParts` shape now passed to the `linker` label formatter, and `umapPf` / `umapPcols` moving off the deprecated `ctx.resultPool.getAnchoredPColumns` + `TreeNodeAccessor.getPColumns()` onto anchored `ColumnsCollection` discovery. Every `PlRef` → spec read goes through `getSpecByRef`, which absorbs the `ColumnAbsentError` that `Column(ref)` throws where `ctx.resultPool.getPColumnSpecByRef` used to return `undefined`.

The filter/ranking wire format stays a leaf `PObjectId`: `matchToColumnId` reduces the discovered recipe id via `extractPObjectId`, and `dedupByLeafId` collapses reachability variants to one entry per column the way the old `findColumns` did. `bundleBuilder.addSingle` resolves a global `PObjectId` by ref and has no branch for the `ColumnDiscoveredId` a linker-reached hit carries, so persisted selections and the workflow keep working unchanged. `docs/handoff-addsingle-discovered-ids.md` records what has to land in workflow-tengo before the full `ColumnUniversalId` can go on the wire.
