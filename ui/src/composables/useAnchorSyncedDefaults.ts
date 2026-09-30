import type {
  InitializedForAnchor,
  ScopedColumnId,
} from "@platforma-open/milaboratories.top-antibodies.model";
import {
  anchorInitializedId,
  inputKeyOf,
} from "@platforma-open/milaboratories.top-antibodies.model";
import type { PlRef } from "@platforma-sdk/model";
import { computed, ref, watch } from "vue";

export interface ConfigWithOptions {
  options?: Array<{ value: ScopedColumnId; label: string }>;
  defaults?: unknown[];
  /** The input (anchor + dataset filter) the config was computed for, see `inputKeyOf`. */
  inputKey?: string;
}

export interface UseAnchorSyncedDefaultsOptions {
  /** Getter for the current input anchor */
  getAnchor: () => PlRef | undefined;
  /**
   * Getter for the current dataset filter (subset). A different filter is a different input:
   * its defaults replace the lists, as a different anchor's do.
   */
  getFilter?: () => PlRef | undefined;
  /** Getter for the config (options + defaults) */
  getConfig: () => ConfigWithOptions | undefined;
  /** Function to clear the UI state */
  clearState: () => void;
  /** Function to apply defaults */
  applyDefaults: () => void;
  /** Whether the config has defaults available */
  hasDefaults: () => boolean;
  /** Getter for the current preset (used to invalidate defaults when preset changes) */
  getPreset?: () => string | undefined;
  /**
   * Whether the UI state already has user selections that match the CURRENT config options.
   * Should return true only if existing state uses columns from the current config.
   * This prevents overwriting user selections on component remount.
   */
  hasExistingStateForConfig?: (config: ConfigWithOptions) => boolean;
  /**
   * Whether the UI state has ANY items (regardless of anchor).
   * Used to avoid clearing state on component remount when config isn't ready yet.
   */
  hasAnyItems?: () => boolean;
  /**
   * Gets the anchor for which defaults have been initialized (persisted in UI
   * state). Returns undefined if never initialized, and also when the stored
   * preset differs from the current one — the stored lists then belong to the
   * other preset, so they must be replaced rather than preserved.
   */
  getInitializedAnchorKey?: () => InitializedForAnchor["anchor"] | undefined;
  /**
   * Sets the anchor for which defaults have been initialized, stamped with the
   * current preset (persists in UI state). `undefined` clears the slot.
   */
  setInitializedAnchorKey?: (key: InitializedForAnchor["anchor"] | undefined) => void;
}

/**
 * Composable for synchronizing filter/ranking defaults with input (anchor + dataset filter) changes.
 * Handles the common logic of:
 * - Tracking which input's defaults have been applied
 * - Detecting stale configs after input changes
 * - Applying fresh defaults when config matches current input
 */
export function useAnchorSyncedDefaults(options: UseAnchorSyncedDefaultsOptions) {
  const {
    getAnchor,
    getConfig,
    clearState,
    applyDefaults,
    hasDefaults,
    hasExistingStateForConfig,
    hasAnyItems,
    getInitializedAnchorKey,
    setInitializedAnchorKey,
    getPreset,
    getFilter,
  } = options;

  // The input a list is synced to (see inputKeyOf), and the one the config was computed for.
  const currentInputKey = computed(() => inputKeyOf(getAnchor(), getFilter?.()) ?? null);
  const configInputKey = computed(() => {
    const config = getConfig();
    return config?.options?.length ? (config.inputKey ?? null) : null;
  });

  // Track which input+preset combo we've applied defaults for
  const appliedForInput = ref<string | null>(null);
  const appliedForPreset = ref<string | null>(null);
  const setApplied = (input: string | null, preset: string | null) => {
    appliedForInput.value = input;
    appliedForPreset.value = preset;
  };

  // Changes whenever the config describes a different input or its defaults become ready, so the
  // watch below re-runs then: right after a change the config's defaults can still be empty while
  // the pool fills in. Watched as a string to avoid deep: true.
  const configKey = computed(() =>
    configInputKey.value === null
      ? null
      : `${configInputKey.value}|${hasDefaults() ? "defaults" : "no-defaults"}`,
  );

  // Computed preset value for watching
  const currentPreset = computed(() => getPreset?.() ?? "none");

  // Track the last known input to detect actual input changes
  const lastKnownInput = ref<string | null>(null);
  // Set when the lists were cleared for an input change and nothing has been applied since.
  const clearedForInputChange = ref(false);

  // Watch the input, the config's key, and preset
  watch(
    [currentInputKey, configKey, currentPreset],
    ([input, configKeyValue, preset]: [string | null, string | null, string]) => {
      const config = getConfig();
      const currentAnchor = getAnchor();
      // The anchor as a canonical column identifier, minted by the same helper
      // the stored value is written with — a single `createGlobalPObjectId` call
      // site. Relocation re-canonicalizes that stored value when a template is
      // applied, so this side has to produce the same bytes or the comparison
      // below never matches, and the constructor is what guarantees it. The
      // preset is not joined in: it is stored as its own field, since a joined
      // string parses as no identifier at all and would not relocate.
      const currentAnchorKey = currentAnchor ? (anchorInitializedId(currentAnchor) ?? null) : null;
      const initializedAnchorKey = getInitializedAnchorKey?.();
      // The persisted slot records the anchor only. When the input changed in this session (a
      // new dataset filter keeps the anchor), the lists were initialized for the previous one, so
      // the slot does not count.
      const inputChanged = lastKnownInput.value !== null && lastKnownInput.value !== input;
      const isAlreadyInitialized =
        currentAnchorKey && initializedAnchorKey === currentAnchorKey && !inputChanged;

      // No anchor = clear state and reset initialized tracking
      if (input === null) {
        clearState();
        setApplied(null, null);
        lastKnownInput.value = null;
        setInitializedAnchorKey?.(undefined);
        return;
      }

      // Already applied for this input+preset combo (in this component instance)? Skip
      if (appliedForInput.value === input && appliedForPreset.value === preset) {
        return;
      }

      // Already initialized for this anchor+preset (persisted in UI state)? Preserve state
      // This handles component remount - user's choices (including empty state) are preserved
      if (isAlreadyInitialized) {
        setApplied(input, preset);
        lastKnownInput.value = input;
        return;
      }

      // No config yet - wait for config before making decisions
      // If we have existing items, preserve them until config confirms input change
      if (!config || !configKeyValue) {
        // If there are existing items, don't clear - wait for config to confirm
        if (hasAnyItems?.()) {
          return;
        }
        // No existing items - only clear tracking if the input actually changed
        if (lastKnownInput.value !== input) {
          setApplied(null, null);
        }
        // Don't update lastKnownInput - wait for valid config
        return;
      }

      // Verify config matches current input BEFORE checking defaults
      if (configInputKey.value !== input) {
        // Config is stale - only clear if the input actually changed
        if (lastKnownInput.value !== input) {
          clearedForInputChange.value = true;
          clearState();
          setApplied(null, null);
          setInitializedAnchorKey?.(undefined);
        }
        return;
      }

      // Update last known input now that we have valid config
      lastKnownInput.value = input;

      // Check if existing state matches current config (e.g., after component remount)
      // This must be done AFTER we have valid config to compare against
      // Skip this check when preset changed — user explicitly wants new defaults — and when the
      // input changed: the existing lists may use the same columns (a filter change keeps the
      // anchor), but were chosen for the previous input.
      const presetChanged = appliedForInput.value === input && appliedForPreset.value !== preset;
      if (!presetChanged && !inputChanged && hasExistingStateForConfig?.(config)) {
        setApplied(input, preset);
        setInitializedAnchorKey?.(currentAnchorKey!);
        clearedForInputChange.value = false;
        return;
      }

      // No defaults available:
      // - If preset changed, still apply (clears previous preset's items)
      // - Otherwise, preserve user's manual configuration
      // Right after an input change the lists are empty and there is nothing of the user's to
      // preserve: wait for the defaults instead of recording "applied" for empty lists.
      if (!hasDefaults() && clearedForInputChange.value) {
        return;
      }
      if (!hasDefaults() && !presetChanged && !inputChanged) {
        setApplied(input, preset);
        setInitializedAnchorKey?.(currentAnchorKey!);
        return;
      }

      // Apply defaults (or clear state if defaults are empty)
      setApplied(input, preset);
      setInitializedAnchorKey?.(currentAnchorKey!);
      clearedForInputChange.value = false;
      applyDefaults();
    },
    { immediate: true },
  );

  // Whether the config's defaults are the current input's: right after a dataset or filter change
  // the config still describes the previous one until the model recomputes it.
  const configIsCurrent = computed(
    () => currentInputKey.value !== null && configInputKey.value === currentInputKey.value,
  );

  return { configIsCurrent };
}
