---
'@platforma-open/milaboratories.top-antibodies.model': patch
'@platforma-open/milaboratories.top-antibodies.ui': patch
'@platforma-open/milaboratories.top-antibodies': patch
---

Show the "Computing the preset defaults" message only while presets are computing

While the selected dataset was still being produced upstream, the message stayed up for as long
as that block ran, often minutes, though nothing was being computed. It now appears only once the
dataset is available; until then the dataset dropdown's spinner shows the wait.
