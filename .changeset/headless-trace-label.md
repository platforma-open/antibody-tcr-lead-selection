---
"@platforma-open/milaboratories.top-antibodies.kind": minor
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.ui": patch
---

Keep pool text out of the block arguments

The subtitle shows the input dataset's label, kept outside the block's arguments, so
opening the block no longer changes its arguments and marks it and everything
downstream stale. Existing blocks keep their subtitle and show stale once after the
update. The init-params contract no longer carries `defaultBlockLabel`; templates that
still contain it keep loading.
