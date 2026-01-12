import type { AnchoredColumnId } from '@platforma-open/milaboratories.top-antibodies.model';
import type { PlRef } from '@platforma-sdk/model';
import { plRefsEqual } from '@platforma-sdk/model';
import { computed, ref, watch } from 'vue';

export interface ConfigWithOptions {
  options?: Array<{ value: AnchoredColumnId; label: string }>;
  defaults?: unknown[];
}

export interface UseAnchorSyncedDefaultsOptions {
  /** Getter for the current input anchor */
  getAnchor: () => PlRef | undefined;
  /** Getter for the config (options + defaults) */
  getConfig: () => ConfigWithOptions | undefined;
  /** Function to clear the UI state */
  clearState: () => void;
  /** Function to apply defaults */
  applyDefaults: () => void;
  /** Whether the config has defaults available */
  hasDefaults: () => boolean;
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
   * Gets the anchor key for which defaults have been initialized (persisted in UI state).
   * Returns undefined if never initialized.
   */
  getInitializedAnchorKey?: () => string | undefined;
  /**
   * Sets the anchor key for which defaults have been initialized (persists in UI state).
   */
  setInitializedAnchorKey?: (key: string | undefined) => void;
}

/**
 * Composable for synchronizing filter/ranking defaults with anchor changes.
 * Handles the common logic of:
 * - Tracking which anchor's defaults have been applied
 * - Detecting stale configs after anchor changes
 * - Applying fresh defaults when config matches current anchor
 */
export function useAnchorSyncedDefaults(options: UseAnchorSyncedDefaultsOptions) {
  const {
    getAnchor, getConfig, clearState, applyDefaults, hasDefaults,
    hasExistingStateForConfig, hasAnyItems,
    getInitializedAnchorKey, setInitializedAnchorKey,
  } = options;

  // Track which anchor's defaults we've applied
  const appliedForAnchor = ref<PlRef | null>(null);

  // Extract the config's anchor key for efficient watching (avoids deep: true)
  const configAnchorKey = computed(() => {
    const config = getConfig();
    if (!config?.options?.length) return null;
    const mainOption = config.options.find((o) => o.value?.anchorName === 'main');
    return mainOption?.value?.anchorRef ? JSON.stringify(mainOption.value.anchorRef) : null;
  });

  // Track the last known anchor to detect actual anchor changes
  const lastKnownAnchor = ref<PlRef | null>(null);

  // Watch inputAnchor and the config's anchor key
  watch(
    [getAnchor, configAnchorKey],
    ([currentAnchor, configKey]: [PlRef | undefined, string | null]) => {
      const config = getConfig();
      const currentAnchorKey = currentAnchor ? JSON.stringify(currentAnchor) : null;
      const initializedAnchorKey = getInitializedAnchorKey?.();
      const isAlreadyInitialized = currentAnchorKey && initializedAnchorKey === currentAnchorKey;

      // No anchor = clear state and reset initialized tracking
      if (!currentAnchor) {
        clearState();
        appliedForAnchor.value = null;
        lastKnownAnchor.value = null;
        setInitializedAnchorKey?.(undefined);
        return;
      }

      // Already applied for this anchor (in this component instance)? Skip
      if (appliedForAnchor.value && plRefsEqual(appliedForAnchor.value, currentAnchor)) {
        return;
      }

      // Already initialized for this anchor (persisted in UI state)? Preserve state
      // This handles component remount - user's choices (including empty state) are preserved
      if (isAlreadyInitialized) {
        appliedForAnchor.value = currentAnchor;
        lastKnownAnchor.value = currentAnchor;
        return;
      }

      // No config yet - wait for config before making decisions
      // If we have existing items, preserve them until config confirms anchor change
      if (!config || !configKey) {
        // If there are existing items, don't clear - wait for config to confirm
        if (hasAnyItems?.()) {
          return;
        }
        // No existing items - only clear tracking if anchor actually changed
        const anchorActuallyChanged = !lastKnownAnchor.value || !plRefsEqual(lastKnownAnchor.value, currentAnchor);
        if (anchorActuallyChanged) {
          appliedForAnchor.value = null;
        }
        // Don't update lastKnownAnchor - wait for valid config
        return;
      }

      // Verify config matches current anchor BEFORE checking defaults
      const mainOption = config.options?.find((o) => o.value?.anchorName === 'main');
      if (!mainOption?.value || !plRefsEqual(mainOption.value.anchorRef, currentAnchor)) {
        // Config is stale - only clear if anchor actually changed
        const anchorActuallyChanged = !lastKnownAnchor.value || !plRefsEqual(lastKnownAnchor.value, currentAnchor);
        if (anchorActuallyChanged) {
          clearState();
          appliedForAnchor.value = null;
          setInitializedAnchorKey?.(undefined);
        }
        return;
      }

      // Update last known anchor now that we have valid config
      lastKnownAnchor.value = currentAnchor;

      // Check if existing state matches current config (e.g., after component remount)
      // This must be done AFTER we have valid config to compare against
      if (hasExistingStateForConfig?.(config)) {
        appliedForAnchor.value = currentAnchor;
        setInitializedAnchorKey?.(currentAnchorKey!);
        return;
      }

      // No defaults available - just mark as applied without clearing state
      // (user might have manually configured items that we should preserve)
      if (!hasDefaults()) {
        appliedForAnchor.value = currentAnchor;
        setInitializedAnchorKey?.(currentAnchorKey!);
        return;
      }

      // Config is fresh and has defaults - apply them and mark as initialized
      appliedForAnchor.value = currentAnchor;
      setInitializedAnchorKey?.(currentAnchorKey!);
      applyDefaults();
    },
    { immediate: true },
  );

  return {
    appliedForAnchor,
    configAnchorKey,
  };
}
