# Repository Guidelines

## Project overview

`siyuan-property-manager` ("Property Manager" / 属性管家) is a SiYuan Note plugin that displays and edits the focused block's attributes. It ships three surfaces for the same data:

- a right-side **dock panel** (`PropertyPanel.vue`) — the primary UI,
- a **doc-inline panel** (`DocInlineAttrs.vue`) injected between the document title and body,
- a **mobile bottom sheet** (`MobileBottomSheet.vue`) that reuses `PropertyPanel` verbatim.

Beyond attribute CRUD it provides a typed-attribute schema system, attribute templates, multi-dimensional attribute statistics with drill-down, batch refactoring, and one-click generation of native SiYuan databases (Attribute Views) from note blocks.

Stack: Vue 3, TypeScript, Vite. Build output is CJS; `siyuan` and `process` are externalized.

## Common commands

- `pnpm install` — install dependencies (the `preinstall` hook enforces pnpm; `npm install` fails by design).
- `npm run dev` — watch build for local plugin development. Requires `.env` copied from `.env.example` with `VITE_SIYUAN_WORKSPACE_PATH` set. A custom Vite plugin (`syncToSiyuanPlugin`) mirrors `dist/` into `data/plugins/siyuan-property-manager/` and deletes stale `.cjs` files there.
- `npm run build` — production build to `dist/` and regenerate `package.zip`.
- `npm test` — run `tests/*.test.ts` via `tsx --test` (Node's built-in test runner).
- `npm run release[:patch|:minor|:major|:manual]` — update versions, tag, and push via `release.js`.

There is **no `lint` script**; run `npx eslint .` when needed.

## Reference projects — verify, do not guess

When parsing SiYuan document block structure/content or confirming a kernel API, consult the developer docs and the SiYuan source first. Never infer undocumented behavior.

| Reference | Windows dev machine | Linux dev machine (local) |
| --- | --- | --- |
| siyuan-note (SiYuan source) | `D:\MyCodingProjects\siyuan-note` | `../siyuan` |
| siyuan-live-slides (source of `developer_docs/`) | `D:\MyCodingProjects\slidev` | `../siyuan-live-slides` |
| Slidev Templates | `D:\MyCodingProjects\slides-templates` | — |
| siyuan-property-manager | `D:\MyCodingProjects\siyuan-property-manager` | — |

- **`developer_docs/`** — SiYuan plugin developer docs, copied locally from `../siyuan-live-slides/developer_docs` to the repo root and listed in `.gitignore` (local reference only; never committed or pushed). 30 files: `00-version/` (v3.7.3 / v3.8.3 / v3.8.5 migration guides), `01-start/`, `02-plugin-api/`, `03-kernel-api/` (incl. `official/API_zh_CN.md`, `official/router.go`), `04-database-av/`, `05-block-model/`, `06-guides/`, `07-official-index/`. Start at `developer_docs/README.md`.
- Most relevant to this plugin: `06-guides/插件多端同步与数据持久化防重启指南.md` (the `onDataChanged` anti-restart mechanism), `06-guides/插件设置页开关与控件布局FAQ.md`, `04-database-av/AV增删改查与参数模型.md`, `05-block-model/块属性清单与使用建议.md`, `02-plugin-api/事件总线事件清单与版本差异.md`.
- For kernel behavior, the Go source in `../siyuan` is authoritative (e.g. `kernel/server/serve.go`, `kernel/model/assets.go`); `app/src` is a frontend reference implementation.
- **Version gap to watch:** `developer_docs/` targets SiYuan **v3.8.5** (verified 2026-09-25, frontend libs `siyuan@1.2.8` / `siyuan-petal@1.2.8`), while this project pins `siyuan@1.1.0` in `package.json` and `minAppVersion: "3.5.7"` in `plugin.json`. Before adopting an API from the newer docs, confirm it exists as of 3.5.7 — otherwise bump the dependency and `minAppVersion` together.

## Architecture notes

### Lifecycle (`src/index.ts`)

`PropertyManagerPlugin extends Plugin`. `onload()` registers icons, binds the instance via `usePlugin(this)`, loads settings/templates/schemas (`loadSettings` → `initTemplates` → `initSchemas` → `initCustomKeysCache`), initializes AV sync (`initAvSync(this)`), adds a top-bar button (mobile → `openMobileDrawer()`, desktop → `toggleDockPanel()`), adds the dock (`type: 'property-manager-dock'`, `RightTop`, 280px wide; `init` → `mountPanel`, `destroy` → `unmountPanel`), calls `mountDocInlineAttrs(this)`, and subscribes `eventBus.on('ws-main', ...)` (attribute-change branch + `handleAvSyncOps` branch). `onunload()` reverses all of that and clears debounce timers. `uninstall()` removes the four plugin data keys (`settings`, `templates.json`, `types-schema.json`, `av-sync.json`).

Dependency injection has exactly **one key: `'plugin'`** — set via `app.provide('plugin', usePlugin())` at every mount site (`src/main.ts` for the dock panel and schema-manager dialog, `src/mobileSheet.ts`, `src/docInlineAttrs.ts`). Components resolve it with `inject<Plugin>('plugin')`; any new DI must reuse this key.

There are **no `addCommand` registrations**. Settings are **not** registered via `addSetting`; the host calls `openSetting()`, which builds a `Setting` dialog from `createSettingItemDescriptors()` (`src/settings.ts`).

### Data flow

1. `src/composables/useCurrentBlock.ts` — module-level singleton tracking `currentBlockId` / `currentBlockKind` (`'doc' | 'block'`) / `currentRootId`. Listens to `click-editorcontent`, `switch-protyle`, `loaded-protyle-static`, `destroy-protyle`, plus a delegated `document` click for `.protyle-title` (title clicks do not reliably emit `click-editorcontent`). rAF-debounced; a `bound` guard ensures listeners bind once. When nothing is focused, `resolveInitialBlock()` (`src/utils/activeBlock.ts`) falls back to the active document so the panel is never blank. State transitions are the pure function `nextCurrentBlockState()` (`src/utils/currentBlockState.ts`).
2. `src/composables/useBlockAttrs.ts` — fetches via `getBlockAttrs`, guarded by a monotonically increasing `loadToken` so stale responses are discarded. Optimistic local writes with rollback on failure; per-key writes serialized through `chainWrite()`. Writing an empty string deletes the attribute (SiYuan semantics), mirrored locally.
3. `src/composables/useAttrPanel.ts` — shared logic for both the dock panel and the doc-inline panel: i18n (`t`, `attrLabel` → `attr_<key>`), row refs, save/delete/rename/add handlers, and the cross-instance sync listener. **`dispose()` must be called from `onBeforeUnmount`** or the `document` listener leaks.

Attribute key taxonomy lives in `src/constants/attrs.ts`: `custom-*` keys are user-editable custom attributes; everything else is internal, with `READONLY_INTERNAL_KEYS` read-only and `ALWAYS_SHOW_INTERNAL_KEYS` / `ALWAYS_SHOW_READONLY_KEYS` rendered as empty rows even when the server omits them.

### Cross-instance sync

SiYuan's `ws-main` broadcast → `onWsMain()` collects changed block IDs from `transactions[].doOperations[]` → debounced 150 ms per block ID → dispatches a `document` `CustomEvent('spm:attrs-changed', { detail: { blockId } })` → `useAttrPanel` reloads only when `detail.blockId === blockIdRef.value`. Writes dispatch the same event, so the dock panel, the doc-inline panel, and the mobile sheet stay mirrored.

### Attribute ⇄ database bidirectional sync (avSync)

Event-driven, directed translation between block IAL attributes (`custom-*`) and Attribute View cells. Design doc: `docs/属性与数据库双向同步方案与实施计划.md` (kernel facts N1–N10 cited there from `../siyuan` source).

- **Scope**: only databases registered in `av-sync.json` sync (`entries[avID] = { enabled, mapping: { keyID → full attr name } }`); `createDatabaseFromSelection()` auto-registers new databases with `enabled: true`. Unregistered databases are inert until the user toggles sync on the database card.
- **Engine**: `src/composables/useAvSync.ts` (module singleton; `initAvSync` / `reloadAvSync` / `disposeAvSync` / `handleAvSyncOps`). Pure helpers `src/utils/avSyncOps.ts` (op classification/extraction) and `src/utils/avValueCodec.ts` (IAL string ⇄ AV cell value) are kernel-free and unit-tested.
- **Loop prevention**: no full-table mirroring. Each op translates exactly one value; plugin AV writes go through `batchSetAttributeViewBlockAttrs` which produces no `updateAttrViewCell` op; an **echo token** (`(blockID, attrKey, value)`, TTL 2 s) blocks the AV→IAL→AV write-back; a per-refresh write budget (`AV_SYNC_WRITE_BUDGET = 200`) trips a fuse.
- **Kernel-managed keys are blacklisted** (`custom-avs`, `av-names`, `custom-sy-av-*`) — never translated.
- **Conflict policy**: LWW by op arrival; binding-time exception — inserting an already-attributed block into a database backfills its IAL values into the AV cells. Detached (unbound) rows are skipped and only counted.
- **Sync-now** on the database card is a directed reconciliation that only fills empty cells (never overwrites non-empty values on either side).
- **SiYuan 3.8.7 note**: the `/api/av/addAttributeViewBlocks` HTTP API no longer broadcasts an `insertAttrViewBlock` op (it runs a fromAPI transaction that only pushes `refreshAttributeView`), so bindings made through that API do not trigger the bind-time backfill; UI-originated insertions (frontend submits the op via `/api/transactions`) and the plugin's own database-creation flow (explicit backfill) are unaffected. The index-stale rebuild on unknown-rowID cell ops covers the drift. Verified end-to-end on 3.8.7 (2026-10-25): all directions sync, datetime round-trips preserved, mSelect clearing deletes the IAL key.
- Settings: `avSyncEnabled` (default true) and `avSyncMode` (`bidirectional` | `av-to-attr` | `attr-to-av`); registry reloads via `onDataChanged()` → `reloadAvSync()`.

### Typed schema system

Maps a `custom-*` key to a type; only the type metadata lives in the plugin, values stay in SiYuan block attributes.

- Types: `text | number | select | multi-select | date | checkbox | block-ref` (`src/types/schema.d.ts`).
- Persisted via `plugin.saveData('types-schema.json', { version, schemas })`; keys in `schemas` are the **prefixed** names (`custom-status`). Constant `TYPES_SCHEMA_STORAGE_NAME` lives in `src/constants/schema.ts`.
- `src/composables/useAttrSchema.ts` — module singleton. Module-scope `initSchemas(plugin)` / `reloadSchemas()`; the composable exposes `getSchema`, `resolveAttrType`, `setAttrType`, `setAttrOptions`, `addAttrOption`, `removeAttrOption`, `removeSchema`, `renameSchema`, `resetToDefaults`, `getAllSchemas`. Saves are 300 ms debounced and skipped when the serialized JSON is unchanged.
- Resolution order: configured `schemas[key].type` wins, else the heuristic `inferAttrType()` (`src/utils/typeInference.ts`) — value format first (`true`/`false`, block ID `^\d{14}-[a-z0-9]{7}$`, ISO date, numeric, contains `,`/`，`), then key-name suffix rules when the value is empty.
- Schema applies **only to `custom-` keys**; internal rows always render as `text`.
- Value conventions: multi-select joins with `", "` and parses on both `,` and `，`; checkbox stores `'true'`/`'false'` (the UI also treats `'1'` as checked); date stores `YYYY-MM-DD`; block-ref stores the raw block ID.
- `AttrRow.vue` dispatches to `src/components/types/AttrType*.vue` via a `v-if / v-else-if` chain on `resolvedType`, with `AttrTypeText` as fallback. `AttrTypeMenu.vue` is the type *selector*, not a value editor. `AttrTypeText`/`AttrTypeNumber` editing states and the `AttrTypeSelect`/`AttrTypeMultiSelect` dropdowns offer historical-value suggestions via `suggestCustomValues` (`useValueSuggest` composable).
- Display formatting: `dateFormat`/`numberFormat` on a schema drive read-only rendering through `src/utils/valueFormat.ts` (`number`/`currency`/`percent`; date format variants). Editing always stores the raw canonical value. Renaming a schema key in `SchemaManager` optionally rewrites the old key on all affected blocks (SQL find + per-block set/delete, explicit confirm).

### Components

```
App.vue → PropertyPanel.vue
             ├─ header: title + kind badge/ID + open SchemaManager
             ├─ tab edit (当前文档)
             │    ├─ AttrSection (internal) → AttrRow*
             │    ├─ AttrSection (custom)   → AttrRow* + AddCustomRow
             │    └─ DocCustomStats         (blocks in this doc with custom- attrs, collapsible)
             ├─ tab stats (笔记本) → AttrStats
             │    ├─ AttrTemplates          (attribute templates CRUD/apply)
             │    └─ NotebookAttrStats      (notebook-wide distribution + single/batch rename & delete)
             └─ tab database (数据库) → AttrDatabase
                  ├─ AttrTemplateGroups     (create AV database from template)
                  └─ NotebookDbStats        (database / AV asset board)
```

`DocInlineAttrs.vue` sits outside this tree: `src/docInlineAttrs.ts` mounts it into every `.protyle` via a `MutationObserver` (filtered to `data-doc-id`/`data-node-id`, 80 ms debounced), inserted immediately before `.protyle-wysiwyg` and copying the title's max-width/padding for alignment. It reuses `useAttrPanel`, so it stays in sync with the dock panel.

Statistics composables: `attrStatsSql.ts` (pure SQL builders; every query carries `LIMIT 9999` and escapes literals), `useSharedStats.ts` (`runStatsSql`), `useDocCustomStats.ts`, `useNotebookAttrStats.ts` (plus `getBlocksByAttrValue` / `batchEditAttr` / `batchDeleteAttr`), `useNotebookDbStats.ts`.

### Persistence

Plugin data (all names exported as constants and asserted by `tests/releaseMetadata.test.ts`): `settings`, `templates.json`, `types-schema.json`, `av-sync.json` (AV sync registry — see the avSync section). Browser `localStorage` holds section collapse state (`spm.section.<key>`) and the schema dialog size (`spm_schema_dialog_size`); legacy `spm.templates` is migrated once by `initTemplates`.

### API layer

`src/api.ts` is the SiYuan kernel wrapper and contains **only** the functions in use: `getBlockAttrs` / `setBlockAttrs`, `getBlockInfo`, `sql`, `getBlockKramdown`, `getPathByID` / `getFile` / `putFile`, the Attribute View family (`renderAttributeView`, `insertBlock`, `addAttributeViewBlocks`, `batchSetAttributeViewBlockAttrs`), and block-ref search (`searchBlocksByKeyword`, `getBlockRefInfo`).

## Source layout

- `src/index.ts` — plugin entry and lifecycle.
- `src/main.ts` — Vue mounting (`WeakMap` per host) and the schema-manager dialog.
- `src/components/` — dock panel, sections, rows, stats panels, templates, and `types/` value editors.
- `src/composables/` — `useCurrentBlock`, `useBlockAttrs`, `useAttrPanel`, `useAttrSchema`, stats composables, `useTemplates`, `useMobileSheet`.
- `src/constants/` — `attrs.ts` (key taxonomy), `schema.ts` (types + presets), `presetTemplates.ts` (siyuan-live-slides presets — `slides-*`, distinct from `schema.ts`). `DEFAULT_PRESET_SCHEMAS` holds 22 presets whose types mirror the SiYuan attribute-view column types from `kernel/av/av.go`: `text`/`number`/`select`/`mSelect`/`date`/`checkbox`/`relation` are covered natively, and `url`/`email`/`phone`/`mAsset` are represented as `text`. AV-internal types (`template`, `rollup`, `lineNumber`, `block`) and system-managed `created`/`updated` get no preset. The multi-select preset is keyed `custom-labels`, **not** `custom-tags` — that key has a migration to `custom-category` and tests assert it stays absent.
- `src/utils/` — pure helpers (DOM/block resolution, jump, ordering, inference, parsing, autocomplete, batch refactor planning, AV sync op/codec, value formatting, logging).
- `src/composables/useAvSync.ts` — AV sync engine singleton (see the avSync architecture section).
- `src/i18n/en_US.json`, `src/i18n/zh_CN.json` — translation keys (keep both in sync, 277 keys).
- `src/index.scss`, `src/scss/types.scss` — styles, `spm-` BEM-style class names.
- `tests/` — `node:test` suites (39 files, 277 cases).
- `docs/` — engineering documents & active plans (see `docs/README.md`); background references & deep dives in `docs/reference/`. `developer_docs/` — local-only reference (gitignored).

## Coding conventions

- Follow the existing style: 2-space indentation, single quotes, no semicolons, `always-multiline` trailing commas.
- Keep Vue SFCs in block order `<template>` → `<script>` → `<style>`, with at most one attribute per line for multi-attribute tags.
- Prefer the `@/*` alias for imports from `src`.
- Keep user-visible strings in both i18n JSON files; attribute-row labels use the `attr_<key>` convention.
- Use existing `spm-` class naming and place component styles in the SCSS entry points unless there is a strong reason to split.
- Preserve the single `'plugin'` provide/inject key.
- Every mount path needs a matching teardown (`dispose()` / `unmountXxx()`) to avoid listener and observer leaks.

## Invariants and pitfalls

- **`onDataChanged()` must stay overridden.** Mechanism: the frontend decides via `shouldReloadOnDataChange(plugin) => plugin.onDataChanged === Plugin.prototype.onDataChanged` (`app/src/plugin/index.ts`). If the method is *not* overridden, a `saveData()` broadcast from another client makes the kernel `destroyAllDocks` + `onunload()` + `onload()` the whole plugin — dock-icon flicker and a multi-end restart storm. Overridden, it calls only `plugin.onDataChanged()` and keeps the dock and runtime state. See `developer_docs/06-guides/插件多端同步与数据持久化防重启指南.md`. `tests/onDataChanged.test.ts` asserts `src/index.ts` contains `async onDataChanged(`, `reloadTemplates()`, `reloadSchemas()`, and `this.lastSavedSettingsJson`.
- Corollary: every `plugin.saveData()` path (templates, schema, settings) triggers that broadcast on other clients, so `saveSettings` / `saveAllData` / `saveAllSchemas` all skip the write when the serialized JSON is unchanged. Do not remove those dedupe guards — they prevent spurious broadcasts.
- **`plugin.json` `frontends` lists only desktop targets**, yet `index.ts` branches on `getFrontend()` for a full mobile path. As shipped, the mobile branch is unreachable — the mobile UI (bottom sheet, top-bar entry, compact inline badge) is a **preset capability**: fully implemented but disabled until `mobile`/`browser-mobile` are added to `frontends` (a deliberate product decision; also requires real-device regression). Confirm intent before changing it.
- Writing an empty string deletes an attribute; the local cache must drop the key too.
- Custom attribute keys are always `custom-` + suffix; the UI strips an accidental prefix before validating, and `isValidCustomSuffix` forbids a leading `-` or `_`.
- `package.zip` is regenerated by `npm run build` and validated by the release pipeline; it is **not** tracked in git (see the release workflow in `.github/` and `scripts/`).
- `tsconfig.json` has `strict: false`; `@/*` maps to `./src/*`.

## Validation

Before committing, run:

```bash
npm test
npm run build
```

Note: the build updates `dist/` and regenerates the untracked `package.zip`.

## Reference Projects

重要：在涉及解析思源笔记文档块结构和内容、确认API时，务必查看developer_docs目录下开发者文档 和 siyuan-note 项目源码确认，不要凭猜测开发和测试。

路径按开发机器取用其一（两套路径指向同一批参考工程，不同机器布局不同）：

- siyuan-note（思源笔记源码项目）
  - Windows 开发机：`D:\MyCodingProjects\siyuan-note`
  - Linux 开发机：`/home/quincyzou/projects/siyuan-note`
- `developer_docs/`：思源笔记插件开发者文档
  - 仓库根目录，并已列入 `.gitignore`（仅本机参考，不入库、不推送）。
- 核对内核行为时以 siyuan-note 的 Go 源码为准（`kernel/server/serve.go`、`kernel/model/assets.go`），`app/src` 为前端实现参考；developer_docs 未覆盖的细节不要凭猜测推断。
