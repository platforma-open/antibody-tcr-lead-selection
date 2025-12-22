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
}

/**
 * Composable for synchronizing filter/ranking defaults with anchor changes.
 * Handles the common logic of:
 * - Tracking which anchor's defaults have been applied
 * - Detecting stale configs after anchor changes
 * - Applying fresh defaults when config matches current anchor
 */
export function useAnchorSyncedDefaults(options: UseAnchorSyncedDefaultsOptions) {
  const { getAnchor, getConfig, clearState, applyDefaults, hasDefaults } = options;

  // Track which anchor's defaults we've applied
  const appliedForAnchor = ref<PlRef | null>(null);

  // Extract the config's anchor key for efficient watching (avoids deep: true)
  const configAnchorKey = computed(() => {
    const config = getConfig();
    if (!config?.options?.length) return null;
    const mainOption = config.options.find((o) => o.value?.anchorName === 'main');
    return mainOption?.value?.anchorRef ? JSON.stringify(mainOption.value.anchorRef) : null;
  });

  // Watch inputAnchor and the config's anchor key
  watch(
    [getAnchor, configAnchorKey],
    ([currentAnchor, configKey]: [PlRef | undefined, string | null]) => {
      const config = getConfig();

      // No anchor = clear state
      if (!currentAnchor) {
        clearState();
        appliedForAnchor.value = null;
        return;
      }

      // Already applied for this anchor? Skip
      if (appliedForAnchor.value && plRefsEqual(appliedForAnchor.value, currentAnchor)) {
        return;
      }

      // No config yet = clear state and reset tracking (wait for config)
      if (!config || !configKey) {
        clearState();
        appliedForAnchor.value = null;
        return;
      }

      // Verify config matches current anchor BEFORE checking defaults
      const mainOption = config.options?.find((o) => o.value?.anchorName === 'main');
      if (!mainOption?.value || !plRefsEqual(mainOption.value.anchorRef, currentAnchor)) {
        // Config is stale - clear and wait for fresh config
        clearState();
        appliedForAnchor.value = null;
        return;
      }

      // No defaults available - mark as applied (empty defaults is valid for this anchor)
      if (!hasDefaults()) {
        clearState();
        appliedForAnchor.value = currentAnchor;
        return;
      }

      // Config is fresh and has defaults - apply them
      appliedForAnchor.value = currentAnchor;
      applyDefaults();
    },
    { immediate: true },
  );

  return {
    appliedForAnchor,
    configAnchorKey,
  };
}
