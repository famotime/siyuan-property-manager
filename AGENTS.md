# Repository Guidelines

## Project overview

This is a SiYuan Note plugin named `siyuan-property-manager`. It shows and edits the focused block's attributes in a right-side dock panel.

Stack: Vue 3, TypeScript, Vite, SiYuan plugin APIs.

## Common commands

- `npm install` — install dependencies.
- `npm run dev` — watch build for local plugin development. Requires `.env` copied from `.env.example` with `VITE_SIYUAN_WORKSPACE_PATH` set.
- `npm run build` — production build to `dist/` and generate `package.zip`.
- `npm test` — run Node test files in `tests/*.test.ts`.
- `npm run release[:patch|:minor|:major|:manual]` — update versions, tag, and push via `release.js`.

## Architecture notes

- Plugin entry: `src/index.ts`
  - Extends SiYuan `Plugin`.
  - Registers the dock in `onload()`.
  - Dock init/destroy mounts and unmounts Vue through `src/main.ts`.
- Vue root: `src/App.vue` -> `src/components/PropertyPanel.vue`.
- The plugin instance is provided to Vue with key `'plugin'`; components should use `inject<Plugin>('plugin')` for i18n/eventBus access.
- Main composables:
  - `src/composables/useCurrentBlock.ts` tracks focused/current block ID from SiYuan editor events.
  - `src/composables/useBlockAttrs.ts` loads and writes block attributes with request de-staling, optimistic updates, and serialized writes per key.
  - `src/composables/useAttrStats.ts` / `attrStatsSql.ts` support attribute statistics.
  - `src/composables/useTemplates.ts` stores custom attribute templates in `localStorage`.
- Attribute rules live in `src/constants/attrs.ts`:
  - `custom-*` attributes are user-editable custom attributes.
  - readonly/internal and always-visible internal keys are defined there.
- SiYuan kernel API helpers are in `src/api.ts`; the core property flow mainly uses `getBlockAttrs` and `setBlockAttrs`.

## Source layout

- `src/components/` — Vue SFCs for the property panel, rows, sections, stats, templates, and inputs.
- `src/i18n/en_US.json`, `src/i18n/zh_CN.json` — plugin translation keys.
- `src/index.scss` — shared plugin styles with `spm-` BEM-style class names.
- `src/types/` — global and API type declarations.
- `developer_docs/` — local SiYuan plugin/API reference docs.
- `plugin-sample-vite-vue/` — upstream sample project for reference only.

## Coding conventions

- Follow the existing style: 2-space indentation, single quotes, no semicolons.
- Keep Vue SFCs in the existing order: `<template>` before `<script setup>`.
- Prefer the `@/*` alias for imports from `src`.
- Keep user-visible strings in both i18n JSON files.
- Use existing `spm-` class naming and place component styles in `src/index.scss` unless there is a strong reason to split styles.
- Do not introduce broad API wrapper usage unless needed; prefer the narrow helpers already used by the feature.

## Validation

Before committing, run:

```bash
npm test
npm run build
```

Note: build output updates `dist/` and `package.zip`; `package.zip` is tracked.
