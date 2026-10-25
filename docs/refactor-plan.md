# 重构计划

> 历史轮次：2026-06-14 统计模块拆分（RF-009/RF-010，已完成，产出 `DocCustomStats` / `NotebookAttrStats` 等）。本计划为第二轮，覆盖此后新增的 AV 同步引擎、Schema 类型系统、数据库 Tab 等模块。

## 1. 项目快照

- 生成日期：2026-10-25
- 范围：siyuan-property-manager 全仓库（`src/` 约 14.6k 行，重点为 2026-06 后新增模块）
- 目标：修复分析中发现的 2 个真实缺陷；拆分过度庞大的 AV 同步引擎并补齐纯逻辑测试；收敛组件家族中的系统性重复；清理死代码；同步过时的仓库文档。
- 文档刷新目标：`docs/project-structure.md`（严重过时，缺 15+ 文件）、`README.md`
- 基线状态：`npm test` 173/173 通过；`npm run build` 通过（2026-10-25 验证）

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| AV 同步引擎 | `src/composables/useAvSync.ts` (939 行) | 事件驱动的属性⇄数据库双向翻译（登记表持久化、索引构建、回声令牌、双向往返、对账） | 单文件承担 9 类职责；`normalizeEntries`、索引构建的列映射优先级、`mergeDerivedMappings` 等关键纯逻辑埋在单例内部不可测 | 纯辅助 `avSyncOps.ts`、`avValueCodec.ts` 有测试；引擎本身 0 直接测试 |
| 类型控件家族 | `src/components/types/AttrType*.vue` (8 个) + `AttrRow.vue` + `AddCustomRow.vue` + `AutocompleteDropdown.vue`（合计约 2825 行） | 按 Schema 类型分发属性值编辑控件 | 6 份下拉 open/close/点击外部关闭副本（约 180 行）；`AttrTypeText`/`AttrTypeNumber` 约 110 行编辑态生命周期逐行重复（`AttrRow` 键名重命名是第三份）；10 份 `t()` inject 辅助；7 份取模导航循环；`AddCustomRow` 内两个平行联想状态机（约 150 行）；`editChange` 契约仅 Text/Number 实现 | 仅 `utils/autocomplete.ts` 有测试 |
| 统计/数据库组件 | `NotebookAttrStats.vue` (549)、`AttrTemplateGroups.vue` (583)、`NotebookDbStats.vue` (354)、`AttrDatabase.vue`、`AttrStats.vue` | 属性统计下钻、批量重构、数据库资产板、按模板建库 | 下钻块列表模板段 2 处各约 55 行复制（`NotebookAttrStats.vue:149-204` vs `NotebookDbStats.vue:122-177`）；`jumpToBlock` 27 行在 `AttrStats.vue:43-69` 与 `AttrDatabase.vue:30-56` 逐行相同；`copyText`、过滤输入条、boxId 解析多处重复；`AttrTemplateGroups` 内联 SQL 拼接与 210 行建库编排（`buildAvJsonWithAttrs` + `createDatabaseFromSelection`）不可测 | `attrStatsSql`/`notebookStatsSort`/`attrStatsFilter` 有测试；`useNotebookDbStats` 内联排序、建库编排 0 测试 |
| 插件生命周期 | `src/index.ts` (235) | onload 12 件事 / onunload 5 件事 / ws-main 分发 | 属性变更支（约 40 行含防抖状态）内联在插件类；事件名 `spm:attrs-changed` 裸字符串 4 处（常量 `AV_SPM_ATTRS_CHANGED_EVENT` 已存在未用）；`mountSchemaManager` 死导入 | `onDataChanged.test.ts` 源文本断言 |
| API 层 | `src/api.ts` (235)、`src/types/api.d.ts` | 思源内核 API 封装 | 死代码：`setCustomQueryRunner` 机制（`api.ts:44-53`）、`getBlockContent`（`api.ts:225-233`）；`types/api.d.ts` 12 接口中 10 个无引用，连累 `types/index.d.ts:22` 的 `NotebookConf` | 无直接测试 |
| 设置与挂载 | `src/settings.ts` (185)、`main.ts`、`mobileSheet.ts`、`docInlineAttrs.ts` | 设置描述符构建、4 个 Vue 挂载点 | 描述符 2/3（`settings.ts:126-155`）逐字同构可表驱动；4 挂载点 4 种 provide/卸载记账写法 | `settings.test.ts` 断言类名/回退文案 |

### 分析中确认的缺陷（修复优先于一切重构）

- **BUG-1 批量编辑/删除传错参数**：`NotebookAttrStats.vue:301-303` `makeKey` 用空格拼接选中键，而 `batchEdit`（:445-447）/`batchDelete`（:469-471）用 `'\x00'` 解析。`indexOf('\x00')` 恒为 -1，实际传入 API 的属性名丢失最后一个字符、属性值为整个键串，批量操作全错。
- **BUG-2 运行时 ReferenceError**：`AddCustomRow.vue:239/339/341` 使用 `inferAttrType` 但未导入（`vite build` 不做类型检查故可构建）。无 Schema 命中时新增自定义属性即抛错。

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-101 | P0 | 缺陷修复：批量操作选中键 + `inferAttrType` 导入 | `NotebookAttrStats.vue`、`AddCustomRow.vue`、新建 `src/utils/selectionKey.ts` | 把 `makeKey`/解析提取为成对纯函数（`'\x00'` 分隔）并修复两处解析；补 `AddCustomRow.vue` 的 `inferAttrType` 导入 | 低 | - [x] `selectionKey` round-trip（含属性值带空格/中文场景）；- [x] 仿 `onDataChanged.test.ts` 的源文本断言钉住导入存在 | `docs/project-structure.md`：新增 util；`README.md`：无 | done |
| RF-102 | P0 | AV 同步引擎拆分与纯逻辑测试 | `useAvSync.ts`（939 → 811 行），新建 `src/utils/avSyncRegistry.ts`（64 行）、`src/utils/avSyncIndex.ts`（126 行） | 登记表序列化/归一化/派生映射合并、索引构建（列映射优先级：登记表 > 列名推断）原样搬移为 kernel-free 纯函数；引擎改为消费纯函数；flush/op 入口/生命周期/对账留在引擎不动 | 高（数据完整性关键路径） | - [x] `normalizeEntries` 脏数据防御（非对象/缺字段/非法映射）；- [x] `serializeEntries` 键排序稳定性；- [x] 派生映射合并幂等性；- [x] 索引构建：登记表优先、列名推断回退、游离行/主键列判定（fixture 参照 `renderAttributeView` 真实载荷） | `docs/project-structure.md`：新 util 模块；`README.md`：无 | done |
| RF-101b | P0 | 缺陷修复延伸：批量写属性数组调用 + 当前文档属性并入缺失（RF-102 验证时新发现，属 RF-101"修复批量操作"同一意图） | `useNotebookAttrStats.ts` | (a) `batchEditAttr`/`batchDeleteAttr` 把块 ID 数组传给 `setBlockAttrs`——内核契约 `SetBlockAttrsRequest.ID` 是单个 string（查证 `siyuan-note/kernel/apicontract/contracts.go:198`），数组绑定必失败，批量编辑/删除端到端从未可用；改为逐块并行写入。内核虽有 `batchSetBlockAttrs`（v3.6.5+）但高于 minAppVersion 3.5.7，故不采用。(b) `load()` 构造的 `docCustomMap` 传给只收 1 参的 `collectCustomAttrGroups` 被静默忽略——半途迁移；改用已测试的 `mergeCurrentDocAttrRows` | 中 | - [x] 源文本断言：逐块写入（`Promise.allSettled(bIds.map(...))`）、`mergeCurrentDocAttrRows` 接线；- [x] `mergeCurrentDocAttrRows` 语义已有 `attrStatsSql.test.ts` 覆盖 | `docs/project-structure.md`：无结构变化；`README.md`：无 | done |
| RF-103 | P1 | 类型控件家族收敛 | 9 个类型控件 + `AddCustomRow.vue` + `useValueSuggest.ts`，新建 `composables/useDropdown.ts`、`useInlineEdit.ts`、`useSuggestDropdown.ts`、`utils/dropdownNav.ts` | 6 份下拉开关/点击外部关闭收敛为 `useDropdown`；Text/Number 编辑态生命周期收敛为 `useInlineEdit`（`AttrRow` 键名编辑较简单且无 justEntered/editChange，不强行套用，保持原样）；过滤/新建判定/取模导航/onEnter 三段解析提取为纯函数；`AddCustomRow` 双联想状态机与 `useValueSuggest` 收敛到 `useSuggestDropdown` 通用核心 | 中（交互回归） | - [x] `filterOptionsByQuery`/`resolveFlatIndex`/`cycleIndex` 纯函数单测（8 cases）；- [x] `useInlineEdit` 提交/取消/失焦豁免语义单测（7 cases）；- [x] `useSuggestDropdown` 防抖/乱序守卫/导航/选中单测（8 cases） | `docs/project-structure.md`：新 composable/util；`README.md`：无 | done |
| RF-104 | P1 | 统计/数据库组件去重 | 新建 `components/BlockListDrilldown.vue`、`composables/jumpToBlock.ts`、`composables/useAvDatabaseCreation.ts`、`utils/avDatabaseJson.ts`、`utils/clipboard.ts`、`utils/siyuanId.ts`；改接 `AttrStats/AttrDatabase/NotebookAttrStats/NotebookDbStats/AttrTemplateGroups/AttrRow/useNotebookDbStats/attrStatsSql/notebookStatsSort/dom` | 下钻块列表抽共享组件（约 55 行×2）；`jumpToBlock` 27 行×2 收敛；`copyText`×3 与 `formatSiyuanTime`/`generateSiyuanId` 入 utils；`useNotebookDbStats` 排序改用已测试比较器；`AttrTemplateGroups` 内联 SQL 入 `attrStatsSql`（带字面量转义）、210 行建库编排抽为 `useAvDatabaseCreation` + 纯 `avDatabaseJson` | 中 | - [x] 排序比较器单测（compareLocale/compareNumber）；- [x] SQL 构建器新分支测试（模板筛选键解析/doc与box作用域/转义/回填查询，6 cases）；- [x] AV JSON 构建纯函数测试（主键列/列类型映射/选项池 1-14 调色板循环，6 cases） | `docs/project-structure.md`：新组件/composable/util；`README.md`：无 | done |
| RF-105 | P1 | ws-main 事件处理抽取 + 事件名常量统一 | `src/index.ts`（235→212 行）、新建 `composables/attrsChangedBus.ts`、`utils/wsMainEvents.ts`、改接 `useAttrPanel.ts`、`useBlockAttrs.ts` | 属性变更支（收集 changedIds → 150ms 防抖 → dispatch）抽到 `attrsChangedBus`（纯收集逻辑在 `utils/wsMainEvents`）；`spm:attrs-changed` 4 处裸字符串改用 `AV_SPM_ATTRS_CHANGED_EVENT` 常量；删 `mountSchemaManager`、`Dialog` 死导入；顺手清理 touched 文件的 3 处琐碎类型错误（未用导入 ×2、`BlockInfoByAttr` 索引签名） | 低-中 | - [x] 变更收集纯函数单测（op.id/op.blockID/脏载荷，3 cases）；- [x] `onDataChanged.test.ts` 保持通过 | `docs/project-structure.md`：模块归属更新；`README.md`：无 | done |
| RF-106 | P2 | API 层死代码清理 | `src/api.ts`、`src/types/api.d.ts`、`src/types/index.d.ts` | 删 `setCustomQueryRunner` 机制（`QueryRunner` 类型、模块变量、`sql()` 分支）、`getBlockContent`、10 个无引用接口、`NotebookConf`；同步更新 AGENTS.md 的 API 清单描述 | 低 | - [ ] 全仓 grep 断言无残留引用；- [ ] `npm test` + `npm run build` | `docs/project-structure.md`：文件职责更新；`README.md`：无；`AGENTS.md`：API 段落微调 | pending |
| RF-107 | P2 | settings 表驱动 + 挂载辅助统一 | `src/settings.ts`、`src/main.ts`、`src/mobileSheet.ts` | 开关类描述符（2/3）表驱动；4 个挂载点的 provide/卸载记账统一为 `mountVueApp(component, host, plugin?)` 辅助 | 低 | - [ ] `settings.test.ts` 平移后保持通过；- [ ] 各挂载点卸载路径人工核对清单 | `docs/project-structure.md`：挂载说明更新；`README.md`：无 | pending |

优先级说明：
- `P0`：价值和风险都最高，优先执行
- `P1`：价值或风险中等，放在 `P0` 之后
- `P2`：低风险清理项，最后执行

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-101 | 2026-10-25 | 2026-10-25 | `npm test`（181/181，新增 8）+ `npm run build` + 全 .vue 缺导入扫描（`.spm-verify/check-vue-imports.mjs`，CLEAN） | pass | 待最后阶段统一刷新 | 修复 `NotebookAttrStats` 批量编辑/删除 key 不匹配（空格拼接 vs NUL 解析）与 `AddCustomRow` 缺 `inferAttrType` 导入；新增 `utils/selectionKey.ts`、`tests/selectionKey.test.ts`（6 cases）、`tests/addCustomRow.test.ts`（2 cases）；扫描确认全仓无同类缺导入 |
| RF-102 | 2026-10-25 | 2026-10-25 | `npm test`（205/205，新增 24）+ `npm run build` + `npx tsc --noEmit`（三个涉及文件 0 报错） | pass | 待最后阶段统一刷新 | 引擎 939→811 行；纯逻辑（serialize/normalize/merge 映射、索引构建/seed/drop）移入 utils 并补 24 个单测；`tsc` 顺带暴露了一批**预先存在**的类型错误（`useNotebookAttrStats.ts`/`index.ts`/`autocomplete.ts` 等，非本次引入），其中两处升级为缺陷 → RF-101b |
| RF-101b | 2026-10-25 | 2026-10-25 | `npm test`（207/207，新增 2）+ `npm run build` | pass | 待最后阶段统一刷新 | 修复批量写属性数组调用（内核契约查证见待办表）与当前文档属性并入缺失；新增 `tests/useNotebookAttrStats.test.ts`（2 cases）；清理未用导入 `attrStatsError` |
| RF-103 | 2026-10-25 | 2026-10-25 | `npm test`（230/230，新增 23）+ `npm run build` + 缺导入扫描 CLEAN + 悬空引用 grep 验证 | pass | 待最后阶段统一刷新 | 组件合计 2202→1900 行（-302），新增共享模块 292 行（useDropdown/useInlineEdit/useSuggestDropdown/dropdownNav）；6 份下拉开关、2 份行内编辑生命周期、2 份联想状态机（AddCustomRow 双状态机 + useValueSuggest）各收敛为单一实现；`AttrRow` 键名编辑保持原样（不强行套用）；`eslint` 因仓库配置预先损坏无法运行（`vue/object-property-newline` 无效选项），已记录 |
| RF-104 | 2026-10-25 | 2026-10-25 | `npm test`（249/249，新增 19）+ `npm run build` + 缺导入扫描 CLEAN | pass | 待最后阶段统一刷新 | `AttrTemplateGroups` 583→365 行；`AttrStats`/`AttrDatabase` 70/57→45/44 行；建库编排（7 步 API 流程）入 `useAvDatabaseCreation`，AV JSON 构建为纯函数 `avDatabaseJson`（可单测）；模板筛选 SQL 入 `attrStatsSql`（补字面量转义，原为裸拼接）；下钻列表/跳转/复制/时间与 ID 生成全部去重；`useAvSync` 内同款回填 SQL（含自有 quoteSqlLiteral）未动——记录为后续项 |
| RF-105 | 2026-10-25 | 2026-10-25 | `npm test`（252/252，新增 3）+ `npm run build` + 缺导入扫描 CLEAN + `npx tsc --noEmit`（本轮新增模块 0 报错） | pass | 待最后阶段统一刷新 | `index.ts` 235→212 行；剩余 6 个 tsc 报错均为预先存在且在本次未触碰文件：`Setting.dialog` ×2（siyuan@1.1.0 类型定义落后于运行时，需按 AGENTS.md 版本鸿沟规则联动升级依赖，不宜顺手改）、`autocomplete.ts` 死变量、2 个测试文件未用符号 |
| RF-106 |  |  | `npm test` + `npm run build` |  |  |  |
| RF-107 |  |  | `npm test` + `npm run build` |  |  |  |

## 5. 决策与确认

- 用户批准的条目：RF-101、RF-102、RF-103、RF-104、RF-105（2026-10-25，"P0+P1"）
- 延后的条目：RF-106、RF-107（P2，未获批）
- 阻塞条目及原因：

## 6. 文档刷新

- `docs/project-structure.md`：已全量重写（2026-10-25）——补齐第一轮之后新增的全部 30+ 文件（AV 同步引擎、Schema 系统、数据库 Tab、8 个类型控件），标注第二轮重构产出的 15 个新模块，更新数据流图（attrsChangedBus/双向同步链路）、测试与验证章节（33 个测试文件 252 cases、tsc 遗留项说明）、重构历史。
- `README.md`：能力描述经核对与现状一致（场景五「批量重构」在本轮缺陷修复后才真正端到端可用，宣传无需改动）；新增「🧑‍💻 开发」章节（pnpm 命令、.env 说明、指向两份 docs 的链接）。
- 最终同步检查：`npm test` 252/252 通过、`npm run build` 产物校验通过、`.vue` 缺导入扫描 CLEAN、`npx tsc --noEmit` 本轮新模块 0 报错（遗留 6 项预先存在问题已记录）。

## 7. 下一步

1. ~~等待用户按条目 ID 批准执行范围。~~（已批准 P0+P1）
2. ~~确认后从 RF-101 开始逐项执行。~~（RF-101/101b/102/103/104/105 全部 done）
3. 未获批条目（P2）：RF-106（API 层死代码清理：`setCustomQueryRunner` 机制、`getBlockContent`、10 个死接口、`NotebookConf`）、RF-107（settings 表驱动 + 挂载辅助统一），可另行确认后执行。
4. 记录在案的后续事项：
   - `useAvSync.ts` 内与 `buildAvBackfillAttrsQuery` 同款的内联回填 SQL（含自有 `quoteSqlLiteral`）可改为复用 `attrStatsSql` 构建器；
   - `index.ts` 的 `Setting.dialog` 类型报错源于 siyuan@1.1.0 类型定义落后于运行时，需按 AGENTS.md 版本鸿沟规则联动升级 `siyuan` 依赖与 `minAppVersion`；
   - `utils/autocomplete.ts` 死变量 `isKeyCacheInitialized`、`tests/activeBlock.test.ts` / `tests/useTemplates.test.ts` 未用符号（tsc TS6133）；
   - eslint 配置损坏（`vue/object-property-newline` 无效选项 `allowMultiplePropertiesPerLine`），`npx eslint .` 无法运行，建议修复后纳入提交前检查；
   - 交互类回归（下拉/编辑态/统计下钻/建库）建议在思源真机过一遍冒烟清单（本轮为行为保持重构 + 全量单测，无浏览器层自动化）。
