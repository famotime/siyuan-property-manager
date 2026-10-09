# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

思源笔记插件「属性管家」（Property Manager / Block Property Manager）。在三个界面中展示并编辑当前聚焦块的属性：

- **右侧栏 Dock 面板**（`PropertyPanel.vue`，主界面）
- **文档内联属性面板**（`DocInlineAttrs.vue`，插入标题与正文之间）
- **移动端底部抽屉**（`MobileBottomSheet.vue`，内部直接复用 `PropertyPanel`）

除属性增删改外，还提供：强类型属性体系（Schema）、属性模板、多维属性统计与下钻、批量重构、由笔记块一键生成思源原生数据库（Attribute View）。

技术栈：Vue 3 + TypeScript + Vite。

## 常用命令

```bash
npm install                  # 安装依赖
npm run dev                  # 开发模式（vite build --watch，需在 .env 设置 VITE_SIYUAN_WORKSPACE_PATH）
npm run build                # 生产构建，输出到 dist/，自动生成 package.zip
npm test                     # 运行 tests/*.test.ts（tsx --test，Node 内置 test runner）
npm run release              # 交互式版本发布（更新 plugin.json/package.json 版本号 → git tag → push）
npm run release:patch        # 直接 patch 版本发布
npm run release:minor        # 直接 minor 版本发布
npm run release:major        # 直接 major 版本发布
npm run release:manual       # 手动指定版本号
```

**开发环境配置**：复制 `.env.example` 为 `.env`，将 `VITE_SIYUAN_WORKSPACE_PATH` 设为思源工作空间路径。dev 模式下 `vite.config.ts` 中的 `syncToSiyuanPlugin` 插件会把 `dist/` 产物同步到 `data/plugins/siyuan-property-manager/`，并先清空目标目录中的残留 `.cjs` 文件。

**Lint**：仓库**没有 `npm run lint` 脚本**，需要时手动执行 `npx eslint .`。配置见 `eslint.config.mjs`（`@antfu/eslint-config` + `eslint-plugin-perfectionist`）。关键规则：2 空格缩进、单引号、`always-multiline` 逗号、Vue 块顺序 `template → script → style`、每行最多 1 个 attribute、多行对象每个属性独占一行。

## 参考工程（核对 API 时必须查阅，不要凭猜测）

在涉及解析思源笔记文档块结构/内容、确认内核 API 时，**必须先查开发者文档与思源源码**，不要靠猜测开发和测试。路径按开发机器取用其一：

| 参考工程 | Windows 开发机 | Linux 开发机（本机） |
| --- | --- | --- |
| siyuan-note（思源本体源码） | `D:\MyCodingProjects\siyuan-note` | `../siyuan` |
| siyuan-slidev（`developer_docs/` 的来源工程） | `D:\MyCodingProjects\slidev` | `../siyuan-slidev` |
| Slidev Templates | `D:\MyCodingProjects\slidev-templates` | — |
| siyuan-property-manager | `D:\MyCodingProjects\siyuan-property-manager` | — |

- **`developer_docs/`**：思源插件开发者文档，已从 `../siyuan-slidev/developer_docs` 复制到仓库根目录，并列入 `.gitignore`（仅本机参考，不入库不推送）。共 30 个文件，结构：`00-version/`（v3.7.3 / v3.8.3 / v3.8.5 迁移指南）、`01-start/`、`02-plugin-api/`、`03-kernel-api/`（含 `official/API_zh_CN.md` 与 `official/router.go`）、`04-database-av/`、`05-block-model/`、`06-guides/`、`07-official-index/`。入口见 `developer_docs/README.md`。
- 与本插件最相关的几篇：`06-guides/插件多端同步与数据持久化防重启指南.md`（对应 `onDataChanged` 那套防重启机制）、`06-guides/插件设置页开关与控件布局FAQ.md`、`04-database-av/AV增删改查与参数模型.md`、`05-block-model/块属性清单与使用建议.md`、`02-plugin-api/事件总线事件清单与版本差异.md`。
- 核对内核行为时以 `../siyuan` 的 Go 源码为准（如 `kernel/server/serve.go`、`kernel/model/assets.go`）；`app/src` 为前端实现参考。
- `developer_docs/` 未覆盖的细节不要凭猜测推断，去源码里确认。
- **版本落差需留意**：`developer_docs/` 面向 SiYuan **v3.8.5**（核对日期 2026-09-25，前端库 `siyuan@1.2.8` / `siyuan-petal@1.2.8`），而本项目 `package.json` 锁 `siyuan@1.1.0`、`plugin.json` 的 `minAppVersion` 为 `3.5.7`。按新版文档使用 API 前，先确认该 API 在 3.5.7 起可用，必要时同步升级依赖与 `minAppVersion`。

## 架构

### 插件生命周期

```
src/index.ts  PropertyManagerPlugin extends Plugin
  onload()
    ├─ addIcons(ICON_SVG)
    ├─ usePlugin(this)                      # 绑定实例，供 mountPanel 取用（src/main.ts）
    ├─ loadSettings() → initTemplates(this) → initSchemas(this) → initAvSync(this) → initCustomKeysCache(...)
    ├─ addTopBar()                           # 移动端 → openMobileDrawer()；桌面端 → toggleDockPanel()
    ├─ addDock({ type: 'property-manager-dock', position: 'RightTop', size: { width: 280 } })
    │     ├─ init()    → mountPanel(this.element)
    │     └─ destroy() → unmountPanel(this.element)
    ├─ mountDocInlineAttrs(this)             # 安装 MutationObserver，注入文档内联面板
    └─ eventBus.on('ws-main', onWsMain)      # 实时刷新：见「跨实例同步」；AV 分支见「属性 ⇄ 数据库双向同步」
  onunload()
    ├─ unmountDocInlineAttrs() / unmountMobileSheet()
    ├─ eventBus.off('ws-main', ...)
    ├─ 清理 wsMainDebounceTimers
    └─ disposeAvSync()                       # 清定时器与索引/令牌缓存
  uninstall()   → removeData(四个持久化 key)
  onDataChanged() → loadSettings() + reloadTemplates() + reloadSchemas() + reloadAvSync()   # 见下方「不可改动项」
  openSetting()   → new Setting(...) + createSettingItemDescriptors(this)  # 见下方说明
```

插件实例通过 Vue `provide/inject` 注入，**全局只有唯一一个注入 key：`'plugin'`**。`src/main.ts`、`src/mobileSheet.ts`、`src/docInlineAttrs.ts` 四处挂载点全部使用 `app.provide('plugin', usePlugin())`；组件内一律 `inject<Plugin>('plugin')`，缺失时应抛错。这是访问 i18n、eventBus 等插件能力的唯一通道，新增依赖注入必须沿用这个 key。

`src/main.ts` 用 `WeakMap<HTMLElement, VueApp>` 记录每个 host 的挂载实例，实现 multi-mount 安全（同一 host 重复 `mountPanel` 会被忽略）。

### 数据流

```
编辑器点击/切换
  → useCurrentBlock（事件监听 + rAF 去抖，模块级单例）
  → currentBlockId / currentBlockKind / currentRootId 变化
  → useBlockAttrs（getBlockAttrs 拉取 + loadToken 防陈旧 + 乐观更新）
  → internalAttrs / customAttrs（计算属性）
  → useAttrPanel（共享逻辑）→ PropertyPanel / DocInlineAttrs 渲染
```

1. **`useCurrentBlock(plugin)`** (`src/composables/useCurrentBlock.ts`)
   - 监听 `click-editorcontent` / `switch-protyle` / `loaded-protyle-static` / `destroy-protyle`，并额外对 `document` 做 click 委托兜底 `.protyle-title`（标题点击不一定触发 `click-editorcontent`）。
   - 同时维护三个状态：`currentBlockId`、`currentBlockKind`（`'doc' | 'block'`）、`currentRootId`。状态转换为纯函数 `nextCurrentBlockState()`（`src/utils/currentBlockState.ts`）。
   - `requestAnimationFrame` 去抖；`bound` 守卫保证模块级单例只绑定一次，多面板共享同一份响应式引用。
   - 首次打开无焦点时由 `resolveInitialBlock()`（`src/utils/activeBlock.ts`）兜底：优先光标/选中块 → 其次当前激活文档，避免面板空白。
   - 跨文档跳转（`setPendingJumpBlockId` + `scrollOpenedDocToBlock` + `highlightBlock`）会轮询等待目标页签渲染完成。

2. **`useBlockAttrs(blockIdRef)`** (`src/composables/useBlockAttrs.ts`)
   - 响应 blockIdRef 变化调用 `getBlockAttrs`；`loadToken` 单调递增，返回时比对，丢弃过期响应。
   - `created` 缺失时由块 ID 解析（`parseCreatedFromId`），`created`/`updated` 做时间戳格式化。
   - **乐观更新**：先写本地 `raw`，失败回滚。
   - 同一 key 的写入经 `chainWrite()` 串行化（Promise 链），防止乱序覆盖。
   - **写入空串 = 删除属性**：思源会自动清理该 key，本地同步从 `raw` 移除。
   - 写入成功后 dispatch `document` 上的 `CustomEvent('spm:attrs-changed')`。

3. **`useAttrPanel(plugin, blockIdRef)`** (`src/composables/useAttrPanel.ts`)
   - Dock 面板与文档内联面板的**共享逻辑**：i18n（`t`/`attrLabel`）、`rowRefs` 行引用、`onSave`/`onDelete`/`onRename`/`onAdd`/`onApplyAttr`、以及 `spm:attrs-changed` 监听。
   - `onRename` 会同时重命名块属性（`renameCustom`）与 schema（`renameSchema`）。
   - **`dispose()` 必须在组件 `onBeforeUnmount` 调用**，否则 `document` 监听器泄漏。

4. **属性分类规则** (`src/constants/attrs.ts`)
   - `custom-` 前缀 → 自定义属性（可编辑、可重命名、可删除）。
   - 其余 → 内部属性；`READONLY_INTERNAL_KEYS`（id/type/updated/created/box/path/hpath/parent_id/root_id/kramdown/content 等）只读。
   - `ALWAYS_SHOW_INTERNAL_KEYS`（title/tags/bookmark/name/alias/memo）与 `ALWAYS_SHOW_READONLY_KEYS`（created）即使服务端未返回也以空行渲染（`placeholder: true`）。

### 跨实例同步（实时刷新）

SiYuan `ws-main` 广播 → `index.ts` 的 `onWsMain()` 从 `transactions[].doOperations[]` 收集变更块 ID → **按 blockId 150ms 防抖** → `document` 上派发 `CustomEvent('spm:attrs-changed', { detail: { blockId } })` → `useAttrPanel` 收到后仅在 `detail.blockId === blockIdRef.value` 时 `reload()`。

写入路径也会主动派发同一事件（`useBlockAttrs`），因此 Dock 面板与文档内联面板、移动端抽屉始终互为镜像。

### 属性 ⇄ 数据库双向同步（Attribute View Sync）

把 `custom-*` 块属性与思源原生数据库（属性视图 / AV）的单元格双向打通。设计依据与内核出处见 `docs/属性与数据库双向同步方案与实施计划.md`。

- **内核无桥**：AV 与块 IAL 是两套独立存储，中间没有任何自动同步通道；「列名写成 `custom-xxx` 就能原生关联」是不成立的假设。同步完全由插件实现。
- **模块划分**：`utils/avSyncOps.ts`（纯函数：op 分类 + `updateAttrs` 变更提取）、`utils/avValueCodec.ts`（纯函数：IAL 字符串 ⇄ AV 单元格值）、`composables/useAvSync.ts`（引擎，模块级单例）、`constants/avSync.ts`（常量与保留键黑名单）、`types/avSync.d.ts`。前两者不依赖思源运行时，是单测主要覆盖对象。
- **触发链路**：`index.ts` 的 `onWsMain` 在 `cmd === 'transactions'` 分支内先调用 `handleAvSyncOps(txs)`。**必须单独成支**：AV 的单元格 op 顶层 `blockID` 是数据库载体块，永远不会为被绑定的源块触发 `spm:attrs-changed`。
- **两个方向**：
  - AV → 属性：`updateAttrViewCell` / `updateAttrViewCells` op **自带新值**（`keyID` / `rowID` / `data`），无需全表 diff；用 `AvIndex` 把 `rowID` 映射到绑定块、`keyID` 映射到属性名，再按 `getBlockAttrs` 比对后仅写差异。
  - 属性 → 数据库：`updateAttrs` op 的 `data.new/old` 携带**全量**属性映射，从 `custom-avs` 反查所属数据库，用 `batchSetAttributeViewBlockAttrs` 按 `keyID + itemID` 定向写入。
- **防环**（关键，改动时勿破坏）：插件写 AV 走 HTTP 直连 API，内核**不产生** `updateAttrViewCell` op，所以「写 AV」是汇不是源；「写 IAL」产生的 `updateAttrs` 已被**回声令牌**（`blockID\0attrKey`，TTL 2s，写 IAL 时登记、回写 AV 前同键同值命中即跳过）拦住，避免日期含时间一类往返有损的值被自损。环路长度不超过 2。
- **`AvIndex`**：`avID → { columns, byAttrKey, rowToBlock, blockToRow, detachedRowIds }`，惰性构建（`renderAttributeView` 一次）、结构性 op 或 TTL 5min 后失效、`insertAttrViewBlock` / `removeAttrViewBlock` 直接增删映射。列 → 属性名优先级：**登记表 `mapping`（keyID → 属性全名）→ 列名本身形如 `custom-<suffix>`**。
- **保留键黑名单**（`AV_RESERVED_ATTR_KEYS` / `AV_RESERVED_ATTR_PREFIXES`）：`custom-avs`、`av-names`、`custom-sy-av-*` 由内核维护，即使带 `custom-` 前缀也不参与同步。
- **不参与同步的列类型**：`block`（主键，仅用于行↔块映射）、`created`/`updated`/`template`/`rollup`/`lineNumber`、`relation`、`mAsset`。
- **游离行**：数据库内新增的未绑定行**不回写、不建块**，仅在数据库卡片上以「未绑定」计数提示。
- **注册表**：`plugin.saveData('av-sync.json', { version, entries })`，`entries[avID] = { avID, name, enabled, mapping }`。建表（`AttrTemplateGroups.vue`）时自动登记并开启；也可在数据库卡片上手动开关。与 Settings / Schema 一致，**JSON 未变化则跳过写入**。
- **方向与仲裁**：`settings.avSyncMode`（`bidirectional` 默认 / `av-to-attr` / `attr-to-av`）与总开关 `settings.avSyncEnabled`（默认 true；注册表为空时无任何行为）。冲突按 op 到达顺序 LWW；唯一例外是**绑定新行时「属性胜」**——用块已有属性回填单元格（内核不会替用户做这件事）。
- **手动对账**：卡片上的「立即同步」→ `syncDatabaseNow(avID)`，**只补空**（AV 空用属性填、属性空用 AV 填），两侧都有值的冲突一律跳过，一键同步不覆盖数据。
- **日志**：`logger.ts` 的 `avSyncDebug/Warn/Error` 复用「属性统计日志」开关，未新增设置项。

### 强类型属性体系（Schema）

把 `custom-*` 键映射到一个**类型**，类型元数据只存在插件里，属性值本身仍在思源块属性中。

- **类型**：`text | number | select | multi-select | date | checkbox | block-ref`（`src/types/schema.d.ts`）。
- **持久化**：`plugin.saveData('types-schema.json', { version, schemas })`，`schemas` 的 key 是**带前缀的全名**（如 `custom-status`）。存储 key 常量 `TYPES_SCHEMA_STORAGE_NAME` 定义在 `src/constants/schema.ts`。
- **`useAttrSchema`** (`src/composables/useAttrSchema.ts`)：模块级单例。模块作用域导出 `initSchemas(plugin)` / `reloadSchemas()`；composable 返回 `getSchema` / `resolveAttrType` / `setAttrType` / `setAttrOptions` / `addAttrOption` / `removeAttrOption` / `removeSchema` / `renameSchema` / `resetToDefaults` / `getAllSchemas`。所有变更 300ms 防抖落盘，JSON 未变化时跳过写入。
- **类型解析优先级**：`schemas[key].type` 优先，否则回退启发式 `inferAttrType()`（`src/utils/typeInference.ts`，先看值格式：`true`/`false`、块 ID `^\d{14}-[a-z0-9]{7}$`、ISO 日期、纯数字、含 `,`/`，`；值为空时再看 key 名后缀，如 `-status`/`-priority` → select、`-tags` → multi-select）。
- **Schema 只作用于 `custom-` 键**；内部属性行强制按 `text` 渲染。
- **值序列化约定**：multi-select 以 `", "` 连接、按 `,` 和 `，` 解析（值本身含逗号无法往返）；checkbox 存字面量 `'true'`/`'false'`（UI 同时把 `'1'` 视为勾选）；date 存 `YYYY-MM-DD`；block-ref 存原始块 ID。
- **控件分发**：`AttrRow.vue` 依据 `resolvedType` 用 `v-if / v-else-if` 链选择 `src/components/types/AttrType*.vue`，`AttrTypeText` 为兜底。`AttrTypeMenu.vue` **不是值编辑器**，而是类型选择按钮（仅可编辑的自定义行显示）。
- 已知遗留：`schema.d.ts` 的 `dateFormat`/`numberFormat` 无人消费；`spm:schema-changed` 事件已派发但**无监听方**（跨实例响应依赖模块单例 ref 与 `reloadSchemas`）；`renameSchema` 只改 schema 存储，不会改写既有块数据。

### 组件结构

```
App.vue → PropertyPanel.vue                      # Dock 面板 / 移动端抽屉复用
             ├─ 头部：标题 + 打开 SchemaManager 按钮
             ├─ Tab: edit
             │    ├─ AttrSection.vue (internal)   # 可折叠，状态存 localStorage
             │    │    └─ AttrRow.vue             # 展示态 ↔ 编辑态，blur 即保存；含重命名/复制/删除
             │    ├─ AttrSection.vue (custom)
             │    │    ├─ AttrRow.vue
             │    │    └─ AddCustomRow.vue         # 新增行，key/value 双自动补全
             │    └─ AttrTemplates.vue             # 属性模板管理
             └─ Tab: stats → AttrStats.vue
                  ├─ DocCustomStats.vue           # 本文档含 custom- 属性的块列表
                  ├─ NotebookAttrStats.vue        # 全笔记本属性分布 + 批量重命名/删除
                  ├─ AttrTemplateGroups.vue        # 模板分组 → 筛选块 → 一键建库（含同步登记）
                  └─ NotebookDbStats.vue           # 笔记本内数据库（AV）资产看板 + 双向同步开关 / 未绑定行计数 / 立即同步
```

`DocInlineAttrs.vue` 不在上述树下：由 `src/docInlineAttrs.ts` 用 `MutationObserver`（过滤 `data-doc-id`/`data-node-id`，80ms 防抖）挂载到每个 `.protyle` 中，插入到 `.protyle-wysiwyg` **之前**，并从标题复制 max-width/padding 以对齐正文排版。它复用 `useAttrPanel`，因此与 Dock 面板天然同步。

`MobileBottomSheet.vue` 渲染一个完整的 `<PropertyPanel/>`；由 `src/mobileSheet.ts` 懒挂载到 `#spm-mobile-bottom-sheet-root`（追加到 `document.body`）。打开入口：桌面顶栏按钮（`isMobile` 时）与内联面板在移动端的展开按钮。

### 统计逻辑

- `src/composables/attrStatsSql.ts` — **纯函数** SQL 构建器与行转换（`buildNotebookAttrStatsQuery` 等）。所有查询带 `LIMIT 9999`（避免内核截断结果集），字符串字面量经 `escapeSqlLiteral` 转义。
- `useSharedStats.ts` — 共享类型与 `runStatsSql()`。
- `useDocCustomStats.ts` → `DocCustomStats.vue`：按文档物理块序排列（`getPathByID` + `getFile` + `buildSyTreeOrderMap`，SQLite DFS 兜底）。
- `useNotebookAttrStats.ts` → `NotebookAttrStats.vue`：笔记本级「属性名 → 去重值 + 计数」，并导出 `getBlocksByAttrValue` / `batchEditAttr` / `batchDeleteAttr`。
- `useNotebookDbStats.ts` → `NotebookDbStats.vue`：笔记本内 AV 数据库资产（名称/字段/行数/绑定块数/未绑定行数）。未绑定行数按主键列 `value.block.id` 是否为空（或 `isDetached === true`）统计。
- `src/utils/attrStatsFilter.ts`（名称匹配，兼容带/不带 `custom-` 前缀）、`src/utils/notebookStatsSort.ts`（排序）为纯函数。

### 常量与工具

- `src/constants/attrs.ts` — 属性键分类与校验（`CUSTOM_KEY_PREFIX`、`isCustomKey`、`isReadonlyKey`、`isValidCustomSuffix`，正则 `^[a-zA-Z0-9][a-zA-Z0-9_-]*$`）。
- `src/constants/schema.ts` — schema 域常量：`TYPES_SCHEMA_STORAGE_NAME`、`DEFAULT_ATTR_TYPE`、`ATTR_TYPE_METAS`（类型→图标/i18n key）、`PRESET_TAG_COLORS`、`DEFAULT_PRESET_SCHEMAS`（22 个内置类型预设，键与类型对齐思源数据库（AV）列类型：已覆盖 text/number/select/mSelect/date/checkbox/relation，另以文本类型补齐 url/email/phone/mAsset；AV 内部的 template/rollup/lineNumber/block 与系统托管的 created/updated 不设预设。**注意**：多选预设取名 `custom-labels`，因为 `custom-tags` 存在到 `custom-category` 的历史迁移且被测试断言为不存在）。**注意与 `presetTemplates.ts` 区分**：后者是 Slidev 的**模板**字典，仅供 `useTemplates.loadSlidevPresets` 使用。
- `src/utils/` — `dom.ts`（`findBlockIdFromEvent`/`isMultiline`/`shortBlockId`/`formatTimestamp`/`parseCreatedFromId`）、`blockJump.ts`（跳转与高亮）、`blockOrder.ts`、`docInlineAttrs.ts`、`notebookStatsSort.ts`、`logger.ts`（条件日志，含 `avSync*` 一组）、`autocomplete.ts`、`typeInference.ts`、`schemaParser.ts`、`avSyncOps.ts` / `avValueCodec.ts`（同步相关纯函数）。
- `src/constants/avSync.ts` — 同步域常量：`AV_SYNC_STORAGE_NAME`、op action（`AV_OP_*` / `AV_STRUCTURAL_ACTIONS`）、保留键黑名单（`AV_RESERVED_ATTR_KEYS` / `AV_RESERVED_ATTR_PREFIXES` + `isSyncableAttrKey`）、不参与同步的列类型（`AV_UNSYNCED_COLUMN_TYPES`）、TTL/防抖/写入预算。

### API 层

`src/api.ts` 是思源 Kernel API 封装。当前**实际使用**的函数：`getBlockAttrs` / `setBlockAttrs`、`getBlockInfo`、`sql`、`getBlockKramdown`、`getPathByID` / `getFile` / `putFile`、Attribute View 相关（`renderAttributeView` / `insertBlock` / `addAttributeViewBlocks` / `batchSetAttributeViewBlockAttrs`）、块引用搜索（`searchBlocksByKeyword` / `getBlockRefInfo`）。其余封装为模板遗留。

注意两个易踩的语义：`addAttributeViewBlocks` 的 `srcs[].itemID` 可**由调用方自带**并由内核原样采用（`AttrTemplateGroups.vue` 建表时即如此，避免回读 AV JSON 猜行 ID）；`batchSetAttributeViewBlockAttrs` 实际写的是 **AV store 而非块属性**，且走 HTTP 直连（不产生 AV op，同步防环依赖这一点）。

### 持久化

插件私有存储（`plugin.saveData` / `loadData`），key 名均导出为常量供 `uninstall()` 清理（`tests/releaseMetadata.test.ts` 会断言这三个值）：

| 常量 | 值 | 用途 |
| --- | --- | --- |
| `SETTINGS_STORAGE_NAME` | `settings` | 插件设置 |
| `TEMPLATES_STORAGE_NAME` | `templates.json` | 属性模板 |
| `TYPES_SCHEMA_STORAGE_NAME` | `types-schema.json` | 属性类型 Schema |
| `AV_SYNC_STORAGE_NAME` | `av-sync.json` | 属性 ⇄ 数据库同步登记表 |

浏览器 `localStorage`：分组折叠状态 `spm.section.<storageKey>`、Schema 管理弹窗尺寸 `spm_schema_dialog_size`；旧版模板数据 `spm.templates` 仅在首次加载时做一次性迁移（`initTemplates`）。

### 类型定义

- `src/types/index.d.ts` — 全局类型（BlockId、Block、BlockType、SyFrontendTypes 等），挂到全局作用域，无需 import。
- `src/types/api.d.ts` — API 响应类型。
- `src/types/schema.d.ts` — Schema 类型（`AttrType`、`AttrOption`、`AttrSchemaItem`、`TypesSchemaStorage`）。
- `src/types/avSync.d.ts` — 同步类型（`AvSyncMode`、`AvSyncRegistryEntry`、`AvIndex`、`AvSyncEvent`、`AttrChangeEvent` 等）。
- `src/types/vue-shim.d.ts` — Vue SFC 类型声明。

### 样式

`src/index.scss`（组件样式）+ `src/scss/types.scss`（类型控件样式），CSS 类名 `spm-` 前缀（siyuan-property-manager 缩写），BEM 风格。

### i18n

翻译文件 `src/i18n/{zh_CN,en_US}.json`（当前各 194 个 key，两份需保持同步），由思源插件内置机制加载，组件内经 `plugin.i18n[key]` 取值。另有约定：属性行标签取 `attr_<key>`（见 `useAttrPanel.attrLabel`）。`plugin.json` 的 `displayName` / `description` 也需同步维护多语言。

### 测试

`tests/*.test.ts`，Node 内置 `node:test` + `tsx --test` 运行器，共 21 个文件。纯函数（SQL 构建、属性分类、DOM 工具、类型推断、schema 解析、排序、补全、AV op 分类、AV 值编解码）是主要覆盖对象；另有基于源码文本断言的元数据测试（`onDataChanged.test.ts`、`releaseMetadata.test.ts`）。

## 不可改动项与易踩坑

- **`onDataChanged()` 必须保持重写**。机制：思源前端以 `shouldReloadOnDataChange(plugin) => plugin.onDataChanged === Plugin.prototype.onDataChanged`（`app/src/plugin/index.ts`）判定——**未覆盖该方法**时，内核收到其他端的 `saveData` 广播后会 `destroyAllDocks` + `onunload()` + `onload()` 强制整插件重载，表现为 Dock 图标高频闪烁、多端互推无限重启；**覆盖后**只调用 `plugin.onDataChanged()`，保留 Dock 与运行时状态。详见 `developer_docs/06-guides/插件多端同步与数据持久化防重启指南.md`。`tests/onDataChanged.test.ts` 会断言 `src/index.ts` 中同时存在 `async onDataChanged(`、`reloadTemplates()`、`reloadSchemas()`、`reloadAvSync()` 与 `this.lastSavedSettingsJson`。
- 由此推论：任何通过 `plugin.saveData()` 写入的路径（模板、Schema、设置、同步登记表）都会触发其他端的该广播，`saveSettings` / `saveAllData` / `saveAllSchemas` / `saveRegistry` 四处都做了「JSON 未变化则跳过写入」的判重，改动时不要去掉，否则会凭空制造广播。
- **同步方向与防环不可混用**：`useAvSync` 的写 IAL 路径必须登记回声令牌，写 AV 路径必须保持走 HTTP API（而非 `/api/transactions`）——后者一旦改成事务推送，`updateAttrViewCell` 会再广播一次，环路长度从 2 变成无界。
- **设置不走 `addSetting`**：思源宿主按方法名调用 `openSetting()`，内部自行构造 `Setting` 弹窗；设置项描述由 `createSettingItemDescriptors()`（`src/settings.ts`）产出。
- **仓库中没有任何 `addCommand` 注册**。
- **`plugin.json` 的 `frontends` 只声明了 `desktop` / `desktop-window` / `browser-desktop`**，但 `index.ts` 依据 `getFrontend()` 分支出完整的移动端路径（顶栏 → 抽屉、内联面板 → 抽屉）。按当前清单，移动端分支在正式发布形态下不可达——改动前先确认是否有意为之。
- **唯一注入 key 是 `'plugin'`**；`usePlugin()` 在未绑定时抛错。
- **空串写入 = 删除属性**（思源语义），本地缓存需同步移除 key。
- **自定义属性键始终是 `custom-` + 后缀**，UI 会先剥掉用户误输入的前缀再校验；`isValidCustomSuffix` 禁止以 `-`/`_` 开头。
- **新挂载的组件必须在卸载路径调用 `dispose()` / `unmountXxx()`**，否则 `document` 监听器与 `MutationObserver` 泄漏。
- **`package.zip` 是入库文件**，`npm run build` 会重新生成，提交时注意是否要一并更新。
- 构建为 CJS（`lib.formats: ['cjs']`），`siyuan` 与 `process` 被 externalize；`tsconfig.json` 中 `strict: false`，`@/*` 别名映射 `./src/*`；`release.js` 会同步更新 `plugin.json` 与 `package.json` 版本号并打 tag 推送。
