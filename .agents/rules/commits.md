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
