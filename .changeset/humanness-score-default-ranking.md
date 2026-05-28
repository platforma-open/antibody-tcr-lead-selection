---
"@platforma-open/milaboratories.top-antibodies.model": patch
---

Recognize the humanization-score block's output (`pl7.app/humannessScore`) as a default ranking criterion in both the In Vivo and In Vitro presets. Discovery already picks the column up via `pl7.app/isScore=true`; this change adds it to the per-preset spec-name allowlist so it contributes to the default ranking order (ranking only — no filter cutoff). Higher = more human, ordering decreasing.
