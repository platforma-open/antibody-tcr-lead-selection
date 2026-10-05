<script setup lang="ts">
import type {
  RankingOrder,
  ScopedColumnId,
} from "@platforma-open/milaboratories.top-antibodies.model";
import {
  DEFAULT_RANKING_WEIGHT,
  getInputAnchorRef,
  getInputFilterRef,
  normalizeWeights,
} from "@platforma-open/milaboratories.top-antibodies.model";
import {
  PlBtnSecondary,
  PlElementList,
  PlIcon16,
  PlNumberField,
  PlRow,
  PlSectionSeparator,
  PlTooltip,
} from "@platforma-sdk/ui-vue";
import { computed, ref, toRaw } from "vue";
import { useApp } from "../../app";
import { useAnchorSyncedDefaults } from "../../composables/useAnchorSyncedDefaults";
import { formatWeightNorm } from "../../util";
import RankCard from "./RankCard.vue";

const app = useApp();

// Counter for generating unique IDs
const idCounter = ref(0);

const generateUniqueId = () => {
  idCounter.value += 1;
  return `rank-${idCounter.value}-${Date.now()}`;
};

// Keyed on the column id alone: a stored row and a freshly built option can carry the same
// column with their keys in a different order. A map, not a scan, because every row looks up
// its label and its level on each render.
const optionByColumn = computed(
  () => new Map((app.model.outputs.rankingConfig?.options ?? []).map((o) => [o.value.column, o])),
);

const getMetricOption = (value: ScopedColumnId | undefined) =>
  value ? optionByColumn.value.get(value.column) : undefined;

const getMetricLabel = (value: ScopedColumnId | undefined) =>
  getMetricOption(value)?.label ?? "Set rank";

/** Group order: cluster metrics, then per-record metrics, then rows with no metric chosen. */
const groupRank = (row: { value?: ScopedColumnId }) => {
  const level = getMetricOption(row.value)?.level;
  if (level === "cluster") return 0;
  if (level === "clonotype") return 1;
  return 2;
};

/**
 * The stored list, kept grouped so each group stays contiguous — headings depend on it. Stable,
 * so the order inside a group is the user's.
 *
 * Every index in the template reads through here, not through `app.model.data`, so a row's
 * weight, percentage and heading always come from the same row. Same objects either way, so
 * edits still reach stored data.
 */
const rows = computed({
  get: () => {
    const stored = app.model.data.rankingOrder ?? [];
    return stored
      .map((row, i) => ({ row, i }))
      .sort((a, b) => groupRank(a.row) - groupRank(b.row) || a.i - b.i)
      .map(({ row }) => row);
  },
  set: (value) => {
    app.model.data.rankingOrder = [...value].sort((a, b) => groupRank(a) - groupRank(b));
  },
});

/** Each row's weight as a fraction of all of them. Derived, never stored. */
const weightNorms = computed(() => normalizeWeights(rows.value.map((row) => row.weight)));

/**
 * Headings show when any metric is cluster-level: a cluster-only ranking shifts whole clusters
 * and reorders nothing within them, which is worth saying. An all-per-record list gets none.
 */
const showGroupHeadings = computed(() => {
  const ranks = rows.value.filter((row) => row.value).map(groupRank);
  if (ranks.length === 0) return false;
  return ranks.includes(0);
});

/** The record name lowercased for prose; same source as the group headings. */
const recordWord = computed(() =>
  (app.model.outputs.rankingConfig?.levelLabels?.clonotype ?? "Clonotype").toLowerCase(),
);

/**
 * The heading that belongs above row `index`, when a group starts there.
 *
 * Rendered from two places: `PlElementList` forwards `item-before` only for pinned items, so
 * the first heading sits above the list and later ones ride the previous row's `item-after`.
 */
const groupHeading = (index: number) => {
  if (!showGroupHeadings.value) return undefined;
  const row = rows.value[index];
  if (row === undefined) return undefined;
  const rank = groupRank(row);
  if (rank === 2) return undefined;
  if (index > 0 && groupRank(rows.value[index - 1]) === rank) return undefined;
  const labels = app.model.outputs.rankingConfig?.levelLabels;
  return rank === 0 ? (labels?.cluster ?? "Cluster") : (labels?.clonotype ?? "Clonotype");
};

const addRankColumn = () => {
  const ui = app.model.data;

  if (!Array.isArray(ui.rankingOrder)) {
    ui.rankingOrder = [];
  }

  ui.rankingOrder.push({
    id: generateUniqueId(),
    value: undefined,
    rankingOrder: "decreasing",
    weight: DEFAULT_RANKING_WEIGHT,
    isExpanded: true, // Auto-expand new items
  });
};

const getPresetDefaults = () => {
  const config = app.model.outputs.rankingConfig;
  if (!config) return undefined;
  const preset = app.model.data.preset;
  if (preset === "in-vivo") return config.inVivoDefaults;
  if (preset === "in-vitro") return config.inVitroDefaults;
  if (preset === "peptide") return config.inPeptideDefaults;
  return undefined;
};

const resetToDefaults = () => {
  const defaults = getPresetDefaults();
  app.model.data.rankingOrder =
    defaults?.map((defaultRank: RankingOrder) => ({
      id: generateUniqueId(),
      value: structuredClone(toRaw(defaultRank.value)),
      rankingOrder: defaultRank.rankingOrder,
      weight: defaultRank.weight ?? DEFAULT_RANKING_WEIGHT,
      isExpanded: false,
    })) ?? [];
};

// Use shared anchor sync logic
const { configIsCurrent } = useAnchorSyncedDefaults({
  getAnchor: () => getInputAnchorRef(app.model.data),
  // A different dataset filter is a different input: its defaults replace the lists.
  getFilter: () => getInputFilterRef(app.model.data),
  getConfig: () => app.model.outputs.rankingConfig,
  clearState: () => {
    app.model.data.rankingOrder = [];
  },
  applyDefaults: () => {
    resetToDefaults();
  },
  hasDefaults: () => (getPresetDefaults()?.length ?? 0) > 0,
  getPreset: () => app.model.data.preset,
  // Preserve existing user selections on component remount (e.g., when Settings panel reopens)
  // Returns true if existing state uses columns from the current config
  hasExistingStateForConfig: (config) => {
    const items = app.model.data.rankingOrder ?? [];
    if (items.length === 0) {
      return false;
    }
    const configColumnIds = new Set(config.options?.map((o) => o.value.column) ?? []);
    // Check if at least one item uses a column from current config
    const result = items.some((item) => {
      if (!item.value?.column) return false;
      const matches = configColumnIds.has(item.value.column);
      return matches;
    });
    return result;
  },
  // Check if there are any items at all (used to avoid clearing on remount before config loads)
  hasAnyItems: () => {
    const count = app.model.data.rankingOrder?.length ?? 0;
    return count > 0;
  },
  // Persisted tracking of which anchor's defaults have been applied, and under
  // which preset. One slot, because there is one ranking list: a stored preset
  // that differs from the current one means the list belongs to the other preset
  // and must be replaced, so the read reports "not initialized" and the
  // composable falls through to the defaults path. The anchor is kept as its own
  // field, a bare stringified `PlRef`, so a project template can relocate it.
  getInitializedAnchorKey: () => {
    const stored = app.model.data.rankingsInitializedForAnchor;
    if (stored === undefined) return undefined;
    return stored.preset === (app.model.data.preset ?? "none") ? stored.anchor : undefined;
  },
  setInitializedAnchorKey: (key) => {
    app.model.data.rankingsInitializedForAnchor =
      key === undefined ? undefined : { anchor: key, preset: app.model.data.preset ?? "none" };
  },
});
</script>

<template>
  <div class="rank-list d-flex flex-column gap-6">
    <PlRow>
      Choose the best sequences by:
      <PlTooltip>
        <PlIcon16 name="info" />
        <template #tooltip>
          Select the criteria used to prioritize lead sequences during selection.
          <br /><br />
          One <b>combined score</b> is computed per {{ recordWord }}: each ranking selection counts
          in proportion to its weight. Candidates are then selected from that ranking. The
          <b>%</b> column shows each weight as a fraction of all the weights together — and that
          percentage is what the score actually multiplies by: <br /><br />
          <code>score = Σ ( % × ranked value )</code>
          <br /><br />
          Each selection's values are replaced by their rank before weighting, so columns in
          different units can be combined.
        </template>
      </PlTooltip>
    </PlRow>

    <div
      v-if="(app.model.data.rankingOrder ?? []).length > 0"
      class="rank-columns text-caps11 d-flex gap-8"
    >
      <span class="rank-columns__weight">Weight</span>
      <span class="rank-columns__weight-norm">%</span>
    </div>

    <PlSectionSeparator v-if="groupHeading(0)" compact>{{ groupHeading(0) }}</PlSectionSeparator>

    <PlElementList
      v-model:items="rows"
      :get-item-key="(item) => item.id ?? 0"
      :is-expanded="(item) => item.isExpanded === true"
      :on-expand="(item) => (item.isExpanded = !item.isExpanded)"
      disable-dragging
    >
      <template #item-after="{ index }">
        <PlSectionSeparator v-if="groupHeading(index + 1)" compact>
          {{ groupHeading(index + 1) }}
        </PlSectionSeparator>
      </template>
      <!-- Weight and percentage lead the row so the list can be balanced without expanding
           anything. `@click.stop` keeps the field from toggling the card. -->
      <template #item-title="{ item, index }">
        <div class="rank-weight flex-shrink-0 align-self-center" @click.stop>
          <PlNumberField
            v-model="rows[index].weight"
            :min-value="0"
            :max-value="1000"
            :step="0.1"
            disable-steps
            required
          />
        </div>
        <span class="rank-weight-norm text-description flex-shrink-0">
          {{ formatWeightNorm(weightNorms[index]) }}
        </span>
        <span>{{ item.value ? getMetricLabel(item.value) : "Add Rank" }}</span>
      </template>
      <template #item-content="{ index }">
        <RankCard v-model="rows[index]" :options="app.model.outputs.rankingConfig?.options" />
      </template>
    </PlElementList>

    <div class="d-flex flex-column gap-6">
      <PlBtnSecondary icon="add" @click="addRankColumn"> Add Ranking Column </PlBtnSecondary>

      <PlBtnSecondary icon="reverse" :disabled="!configIsCurrent" @click="resetToDefaults">
        Reset to defaults
      </PlBtnSecondary>
    </div>
  </div>
</template>

<style scoped>
/*
 * `PlNumberField` is 40px tall by default, which makes the row 56px; trimmed to 24px it fits the
 * row's existing padding. Its 12px inner padding leaves only 30px of text in a 52px field, and
 * "1000" measures 32px, so that is tightened too. `:deep` is safe because the component styles
 * itself with plain global class names, not CSS modules.
 */
.rank-list {
  --rank-weight-width: 52px;
  --rank-weight-norm-width: 32px;
  /*
   * Where a row's title slot begins: the row's border and padding plus `PlElementList`'s expand
   * chevron. Measured, because the heading row cannot read their width. Goes stale if the list
   * changes that furniture; the symptom is a heading offset from its columns.
   */
  --rank-row-lead-width: 29px;
}

/* One heading row, naming the two numeric columns. The metric column needs no heading. */
.rank-columns {
  padding-left: var(--rank-row-lead-width);
  /* "WEIGHT" nearly fills its column, so a heading overflows rather than wrapping. */
  white-space: nowrap;
}

/*
 * Fixed widths, shared by the heading cell and the row cell so the two cannot drift, and so every
 * metric name starts at the same place whatever the percentage reads.
 */
.rank-weight,
.rank-columns__weight {
  width: var(--rank-weight-width);
}

.rank-weight-norm,
.rank-columns__weight-norm {
  width: var(--rank-weight-norm-width);
}

.rank-weight :deep(.pl-number-field__main-wrapper) {
  height: 24px;
}

.rank-weight :deep(.pl-number-field__wrapper) {
  padding-left: 8px;
  padding-right: 8px;
}
</style>
