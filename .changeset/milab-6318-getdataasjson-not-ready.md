---
"@platforma-open/milaboratories.top-antibodies.model": patch
---

MILAB-6318: fix a transient "Some outputs have errors" banner that flashed during calculation on remote backends. The `selfBlockId` read (which drops self-referential filters) now uses `getDataAsJsonOrUndefined`, which returns `undefined` while the field is resolved-but-not-yet-fetched instead of throwing like `getDataAsJson`.
