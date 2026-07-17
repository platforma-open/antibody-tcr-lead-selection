# @platforma-open/milaboratories.top-antibodies.anarci-kabat

## 1.4.8

### Patch Changes

- c765278: Release software

## 1.4.7

### Patch Changes

- 03894ab: Keep filter and ranking options available while an upstream block is recalculating.

  Previously the filter/ranking config outputs were `retentive`, so a freshly-configured Lead Selection block showed no filter options (an empty, spinning "Filter by" dropdown) for the entire time any upstream block was running. The config outputs now recompute from the currently-available columns instead, so the options stay populated. Selecting a column whose producer is still recalculating is safe — running the block waits for that upstream to finish before executing.

  Also migrates the block onto the canonical structurer layout and upgrades the SDK toolchain (block-tools, tengo-builder).

## 1.4.6

### Patch Changes

- a7b65c0: No Op Change To Unblock

## 1.4.5

### Patch Changes

- c85f63a: SDK update

## 1.4.4

### Patch Changes

- 4855fff: dont show column header linker postfix and update sdk

## 1.4.3

### Patch Changes

- 3e9c9ef: bump sdk for fix table query

## 1.4.2

### Patch Changes

- 199e95d: Updated dependencies

## 1.4.1

### Patch Changes

- 6ecafd5: Update anarci software package version to fix container start command

## 1.4.0

### Minor Changes

- 84a7fe5: Deal with ANARCI numbering issues

## 1.3.0

### Minor Changes

- b201aaf: Improve cluster ranking, improve performance

## 1.2.1

### Patch Changes

- b99b7ba: Revert optimization changes

## 1.2.0

### Minor Changes

- 532b9ed: Block performance optimization

## 1.1.0

### Minor Changes

- ccc8076: kabat numbering added
