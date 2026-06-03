---
"@platforma-open/milaboratories.top-antibodies.workflow": patch
"@platforma-open/milaboratories.top-antibodies.model": patch
"@platforma-open/milaboratories.top-antibodies.ui": patch
"@platforma-open/milaboratories.top-antibodies": patch
---

Fix Kabat numbering: mark ANARCI placeholder CSV files as writable in writeFile, since the backend now creates writeFile outputs as read-only by default. Bump SDK (workflow-tengo 6.x) for the writable flag support.