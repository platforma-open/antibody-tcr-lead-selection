# @platforma-open/milaboratories.top-antibodies.spectratype

## 1.8.8

### Patch Changes

- c765278: Release software

## 1.8.7

### Patch Changes

- 03894ab: Keep filter and ranking options available while an upstream block is recalculating.

  Previously the filter/ranking config outputs were `retentive`, so a freshly-configured Lead Selection block showed no filter options (an empty, spinning "Filter by" dropdown) for the entire time any upstream block was running. The config outputs now recompute from the currently-available columns instead, so the options stay populated. Selecting a column whose producer is still recalculating is safe — running the block waits for that upstream to finish before executing.

  Also migrates the block onto the canonical structurer layout and upgrades the SDK toolchain (block-tools, tengo-builder).

## 1.8.6

### Patch Changes

- a7b65c0: No Op Change To Unblock

## 1.8.5

### Patch Changes

- c85f63a: SDK update

## 1.8.4

### Patch Changes

- 4855fff: dont show column header linker postfix and update sdk

## 1.8.3

### Patch Changes

- 3e9c9ef: bump sdk for fix table query

## 1.8.2

### Patch Changes

- 199e95d: Updated dependencies

## 1.8.1

### Patch Changes

- 5857c20: Fix Windows encoding in python scripts

## 1.8.0

### Minor Changes

- b201aaf: Improve cluster ranking, improve performance

## 1.7.1

### Patch Changes

- b99b7ba: Revert optimization changes

## 1.7.0

### Minor Changes

- 532b9ed: Block performance optimization

## 1.6.0

### Minor Changes

- 3825a42: Fix errors related to numeric properties that apply only to a subset of clonotypes and to multiple clustering blocks upstream

## 1.5.0

### Minor Changes

- ccc8076: kabat numbering added

## 1.4.4

### Patch Changes

- edbd894: technical release
- 6dc2d2b: technical release
- e581493: technical release
- 1c26f0d: technical release

## 1.4.3

### Patch Changes

- technical release

## 1.4.2

### Patch Changes

- 020a5b4: Update SDK and python

## 1.4.1

### Patch Changes

- 22b01ef: Updated SDK to support polars.

## 1.4.0

### Minor Changes

- a435169: Move filters to settings and add prerun

## 1.3.2

### Patch Changes

- b603873: chore: update deps

## 1.3.1

### Patch Changes

- b280c5c: Use embedded kalign

## 1.3.0

### Minor Changes

- 2e24f7a: Disable default normalization in VJ usage plot and change spectratype/VJ usage script to run on top clonotypes if provided

## 1.2.0

### Minor Changes

- 6443da1: Improve spectratype script

## 1.1.0

### Minor Changes

- 5ee90ac: Add CDR3 spectratype
