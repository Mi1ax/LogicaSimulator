---
name: Commit Style Guide
description: Enforces the unified commit message style for this project
trigger: always_on
---

# Commit Message Style Guide

When committing changes in this repository, ALWAYS use the following prefix convention in the commit message:

- **[Feature]** - Adding new functionality for the user (e.g., adding a new chip, a new panel).
- **[Fix]** - Fixing bugs and logical errors.
- **[UI]** - Changes to the interface, layout, styles, and UX that do not affect the simulation core.
- **[Core]** - Changes in the simulation engine, basic data structures, algorithms.
- **[Refactor]** - Improving or simplifying code without changing its actual behavior.
- **[Chore]** - Updating dependencies, build settings (Vite, TypeScript), linters, utility scripts.
- **[Docs]** - Updating documentation, README, comments.

Example: `[Feature] Add 74LS138 and 74LS244 chips`

If a task involves multiple aspects (e.g., Core and UI), choose the prefix that reflects the main goal of the changes, or split them into two commits.
Commit messages must be written in English.

## When to Commit
- **NEVER commit changes automatically.** Only run `git commit` if the user's message explicitly contains the exact phrase `"Делай commit"`.
- Do not create git tags unless explicitly requested by the user.

## Versioning Guide (`vMAJOR.MINOR.PATCH`, e.g. `v1.0.0`)

This project follows **Semantic Versioning (SemVer)** in the format `vX.Y.Z`:

1. **`MAJOR` (`X.0.0` — 1st digit, e.g. `v1.0.0` → `v2.0.0`)**
   - Incremented for **breaking changes** or major architectural milestones:
     - Incompatible changes to the `.logica` circuit file format that break backward compatibility.
     - Complete overhaul of the simulation core or UI architecture.
   - Resets `MINOR` and `PATCH` to `0`.

2. **`MINOR` (`1.Y.0` — 2nd digit, e.g. `v1.0.0` → `v1.1.0`)**
   - Incremented when adding **backward-compatible new features** (corresponds to **`[Feature]`** and major **`[Core]`** / **`[UI]`** commits):
     - Adding new logic gates, 74LS/memory/PLD chips, or canvas annotation tools (`REGION_BOX`, `TEXT_LABEL`, `STICKY_NOTE`).
     - Adding new editor modes, panels, modal dialogs, or backward-compatible `.logica` file fields (such as `simSpeed`).
   - Resets `PATCH` to `0`.

3. **`PATCH` (`1.0.Z` — 3rd digit, e.g. `v1.0.0` → `v1.0.1`)**
   - Incremented for **backward-compatible bug fixes and minor polish** without new features (corresponds to **`[Fix]`**, minor **`[UI]`**, **`[Refactor]`**, **`[Chore]`**, **`[Docs]`** commits):
     - Fixing simulation logic bugs, pin definitions, or editor hit-testing/scroll bugs.
     - Small styling tweaks (icons, colors, text measurement), refactoring, or dependency updates.

- When creating a new version tag (`git tag -a vX.Y.Z -m "Release vX.Y.Z"`), also keep the `"version"` field in `package.json` in sync (`X.Y.Z`).

