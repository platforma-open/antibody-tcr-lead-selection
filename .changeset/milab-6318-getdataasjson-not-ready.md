---
"@platforma-open/milaboratories.top-antibodies.model": patch
---

MILAB-6318: read `selfBlockId` via `getDataAsJsonOrUndefined` instead of `getDataAsJson`. `getDataAsJson` throws "Resource has no content." when the field is resolved but its blob is not yet fetched, flashing a transient block error during calculation on remote backends.
