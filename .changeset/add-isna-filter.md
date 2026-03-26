---
'@platforma-open/milaboratories.top-antibodies.model': minor
'@platforma-open/milaboratories.top-antibodies.ui': minor
'@platforma-open/milaboratories.top-antibodies.workflow': minor
'@platforma-open/milaboratories.top-antibodies.sample-clonotypes': minor
'@platforma-open/milaboratories.top-antibodies': minor
---

Add isNA/isNotNA filter types for lead selection filters

Columns with discrete allowed values (like Structural Liabilities with None/Low/Medium/High) previously only offered "Is one of" / "Is not one of" filter types, making it impossible to filter by empty/NA values. Now all column types (numeric, string, and discrete) include "Is empty (NA)" and "Is not empty (NA)" filter options.
