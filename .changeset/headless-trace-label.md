---
"@platforma-open/milaboratories.top-antibodies.kind": minor
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.ui": patch
---

Compute the block subtitle without opening the block

The subtitle shows the input dataset's label, written when the user picks a dataset,
so opening the block no longer changes its arguments and marks it and everything
downstream stale. Existing blocks keep their subtitle and show stale once after the
update. The init-params contract no longer carries `defaultBlockLabel`; templates that
still contain it keep loading.
