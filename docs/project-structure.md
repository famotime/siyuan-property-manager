# 项目结构

思源笔记插件「属性管家」(Property Manager)：在右侧 Dock 面板、文档内联区域与移动端抽屉三处展示并编辑当前聚焦块的属性；提供类型化 Schema、属性模板、多维统计下钻、批量重命名与重构、以及属性 ⇄ 数据库（Attribute View）双向同步。

## 技术栈

- Vue 3 + TypeScript + Vite
- 输出格式：CJS（`siyuan` 与 `process` 外部化）
- 测试：Node.js 内置 test runner + tsx（纯函数/组合式函数单测 + 关键防重断言，40 个测试文件 / 279 cases）
- 包管理：pnpm（`preinstall` 钩子强制）

## 文档目录分层

仓库文档存放于 `docs/` 目录，分为两层：
- **`docs/` 根目录**：工程开发、重构规划与核心特性实施计划（`project-structure.md`、`refactor-plan.md`、`属性与数据库双向同步方案与实施计划.md`、`P0阶段：类型化基建与交互补齐详细方案与实施计划.md` 等）；
- **`docs/reference/` 子目录**：归档前期的深度竞品调研、底层机制分析、学术与科普长文（详见 [docs/README.md](README.md)）。

## 代码目录拓扑

```
src/
├── index.ts                    # 插件入口：onload 12 步初始化、ws-main 分发、onDataChanged 覆盖、设置与 Dock
├── main.ts                     # Vue 挂载/卸载（WeakMap 防重入）、Schema 管理器与批量重构对话框（openMountableDialog 公共脚手架）
├── docInlineAttrs.ts           # 副作用层：MutationObserver 驱动的文档内联面板挂载（纯逻辑在 utils/docInlineAttrs）
├── mobileSheet.ts              # 移动端底部抽屉挂载（预设能力，frontends 未启用 mobile）
├── api.ts                      # 思源内核 API 封装（仅实际使用的接口；SQL 转义复用 utils/sqlLiteral）
├── settings.ts                 # 运行时设置 + 设置项描述符构建（开关项经 createSwitchDescriptor 工厂）
├── index.scss / scss/types.scss # 全部组件样式（spm- 前缀 BEM）
│
├── composables/                # 组合式函数与状态模块
│   ├── useCurrentBlock.ts      # 当前聚焦块单例（事件监听 + rAF 去抖；纯状态机在 utils/currentBlockState）
│   ├── useBlockAttrs.ts        # 属性 CRUD：乐观更新 + chainWrite 串行化 + 跨实例事件
│   ├── useAttrPanel.ts         # Dock/内联面板共享逻辑（i18n/行 refs/事件处理/跨实例同步监听）
│   ├── attrsChangedBus.ts      # ws-main 事务 → 按块 ID 防抖 150ms → 广播 spm:attrs-changed
│   ├── useAttrSchema.ts        # 类型化 Schema 单例（增删改查 + 300ms 防抖持久化）
│   ├── useAvSync.ts            # 属性⇄数据库双向同步引擎（约 840 行；纯逻辑已下沉 utils/avSync*）
│   ├── useAvDatabaseCreation.ts# 按模板建库编排：putFile AV JSON → 插块 → 绑定 → 回填 → 登记
│   ├── jumpToBlock.ts          # 统计下钻跳转编排（AttrStats/AttrDatabase 共用）
│   ├── useDropdown.ts          # 下拉浮层开关 + 点击外部关闭（6 个类型控件共用）
│   ├── useInlineEdit.ts        # 行内编辑生命周期：进入/提交/取消/失焦豁免（Text/Number 共用）
│   ├── useSuggestDropdown.ts   # 输入联想通用状态机：防抖拉取 + 乱序守卫 + 高亮导航 + 选中
│   ├── useValueSuggest.ts      # 历史值联想（useSuggestDropdown 的薄包装）
│   ├── useTemplates.ts         # 属性模板单例（localStorage 迁移 + 防抖持久化）
│   ├── useMobileSheet.ts       # 移动端抽屉状态
│   ├── attrStatsSql.ts         # 纯 SQL 构建器：统计/下钻/模板筛选/建库回填（字面量转义复用 utils/sqlLiteral，全部带 LIMIT）
│   ├── useSharedStats.ts       # 统计共享类型 + runStatsSql 执行器
│   ├── useDocCustomStats.ts    # 文档级自定义属性块统计
│   ├── useNotebookAttrStats.ts # 笔记本级属性分布统计 + 批量编辑/重命名/删除（逐块写入）
│   └── useNotebookDbStats.ts   # 笔记本数据库资产板（渲染统计 + 绑定块懒加载 + 排序）
│
├── components/                 # Vue 单文件组件
│   ├── PropertyPanel.vue       # Dock 面板主组件（当前文档、笔记本、数据库三 Tab 架构，常驻外层切换）
│   ├── DocInlineAttrs.vue      # 文档内联属性面板（标题与正文之间，自适应排版）
│   ├── AttrSection.vue         # 可折叠分组（localStorage 持久化，支持悬浮说明与卡片动作）
│   ├── AttrRow.vue             # 单行属性：键名重命名 + v-if 分发到 AttrType* 控件
│   ├── AddCustomRow.vue        # 新增自定义属性行（键名/属性值双联想，基于 useSuggestDropdown）
│   ├── AutocompleteDropdown.vue# 联想浮层渲染（条目归一化 string | {value,label,display}）
│   ├── BlockListDrilldown.vue  # 统计下钻块列表共享组件（加载态/空态/复制/跳转）
│   ├── AttrStats.vue           # 笔记本 Tab 壳：AttrTemplates（模板管理） + NotebookAttrStats（笔记本属性统计）
│   ├── DocCustomStats.vue      # 本篇文档属性块大纲面板（位于当前文档 Tab 底部，支持折叠与下钻）
│   ├── NotebookAttrStats.vue   # 笔记本级统计：单键重命名/多模式批量替换/批量编辑删除/值下钻
│   ├── AttrDatabase.vue        # 数据库 Tab 壳：AttrTemplateGroups + NotebookDbStats
│   ├── AttrTemplateGroups.vue  # 按模板筛选块并一键建库（编排已下沉 useAvDatabaseCreation）
│   ├── NotebookDbStats.vue     # 数据库卡片：同步开关/手动对账/绑定块下钻/插入视图
│   ├── AttrTemplates.vue       # 自定义属性模板 CRUD 与应用（位于笔记本 Tab，支持缩进与预览）
│   ├── SchemaManager.vue       # Schema 管理对话框（类型/选项池/重命名改写/恢复预设）
│   ├── mobile/MobileBottomSheet.vue # 移动端抽屉（复用 PropertyPanel）
│   └── types/                  # AttrType* 值编辑控件（由 AttrRow 分发）
│       ├── AttrTypeText.vue    #     文本（多行 textarea + 外链识别 + 历史值联想）
│       ├── AttrTypeNumber.vue  #     数字（展示态按 numberFormat 格式化）
│       ├── AttrTypeSelect.vue  #     单选（胶囊 + 搜索 + 快速新建 + 历史值）
│       ├── AttrTypeMultiSelect.vue # 多选（标签集 + 搜索 + 快速新建）
│       ├── AttrTypeDate.vue    #     日期（今天/明天/昨天快捷 + date input）
│       ├── AttrTypeCheckbox.vue#     布尔
│       ├── AttrTypeBlockRef.vue#     块关联（全库搜索 + 悬浮摘要 + 跳转）
│       └── AttrTypeMenu.vue    #     类型选择器（非值编辑器）
│
├── constants/
│   ├── attrs.ts                # 属性键分类（custom- 前缀/只读/常显）+ 校验
│   ├── schema.ts               # 类型元数据 + 22 个预设 Schema
│   ├── avSync.ts               # AV 同步常量：op 名/保留键/防抖与预算参数/事件名
│   └── presetTemplates.ts      # 即现演示（slides-*）模板预设（区别于 schema.ts）
│
├── utils/                      # 纯函数（kernel-free，绝大部分有单测）
│   ├── batchAttrRename.ts      # 属性键批量重命名与多模式替换（exact/prefix/contains，预览与改写映射计算）
│   ├── sqlLiteral.ts           # SQL 字面量转义唯一实现（escapeSqlLiteral / sqlLiteral，全仓库共用）
│   ├── dom.ts                  # DOM/格式化：findBlockIdFromEvent、escapeHtml、shortBlockId、formatTimestamp、formatSiyuanTime
│   ├── activeBlock.ts          # 无聚焦时回退到当前文档
│   ├── currentBlockState.ts    # 当前块状态转换纯函数
│   ├── blockJump.ts            # 块跳转：选择器构建、滚动定位、高亮闪烁
│   ├── blockOrder.ts           # 文档块排序/解析
│   ├── autocomplete.ts         # 键名/属性值联想（SQL 缓存）
│   ├── schemaParser.ts         # 键名-标签解析、选项输入解析
│   ├── typeInference.ts        # 类型启发式推断（值格式 → 键名后缀）
│   ├── valueFormat.ts          # 展示格式化（number/currency/percent/日期变体）
│   ├── selectionKey.ts         # 批量操作选中键（NUL 分隔，拼接/解析成对）
│   ├── notebookStatsSort.ts    # 属性组排序 + compareLocale/compareNumber 比较器
│   ├── attrStatsFilter.ts      # 统计过滤 + 屏蔽规则解析（compileRegexPatterns、parseIgnorePatternLines）
│   ├── dropdownNav.ts          # 下拉导航纯逻辑：过滤/新建判定/循环索引/三段索引解析
│   ├── clipboard.ts            # 剪贴板复制（静默失败）
│   ├── siyuanId.ts             # 思源风格 ID 生成（YYYYMMDDHHmmss-random）
│   ├── wsMainEvents.ts         # ws-main 事务 → 变更块 ID 集合
│   ├── avValueCodec.ts         # IAL 字符串 ⇄ AV 单元格值
│   ├── avSyncOps.ts            # AV op 分类/提取
│   ├── avSyncRegistry.ts       # 同步登记表序列化/归一化/派生映射合并
│   ├── avSyncIndex.ts          # AV 索引构建/增量维护（列映射优先级、游离行判定）
│   ├── avDatabaseJson.ts       # 建库 AV JSON（spec=4）纯构建
│   ├── docInlineAttrs.ts       # 内联面板挂载计划纯函数
│   └── logger.ts               # 条件日志
│
├── types/
│   ├── index.d.ts              # 全局类型（BlockId/Block/Notebook 等）
│   ├── schema.d.ts             # AttrType/AttrOption/AttrSchemaItem
│   ├── avSync.d.ts             # AV 同步类型（登记表/索引/事件）
│   ├── api.d.ts                # API 响应类型（仅插件实际引用的 2 个；其余由 siyuan 包全局声明提供）
│   └── vue-shim.d.ts           # Vue SFC 声明
│
└── i18n/
    ├── zh_CN.json              # 简体中文（236 keys）
    └── en_US.json              # 英文（与 zh_CN 同步，236 keys）

tests/                          # node:test 套件（40 个文件，279 cases）
├── 纯函数测试                   # attrStatsSql / avValueCodec / avSyncOps / avSyncRegistry / avSyncIndex /
│                               # avDatabaseJson / dropdownNav / notebookStatsSort / selectionKey / siyuanId /
│                               # dom / blockJump / blockOrder / typeInference / schemaParser / autocomplete /
│                               # valueFormat / attrStatsFilter / ignorePatternParse / sqlLiteral /
│                               # currentBlockState / activeBlock / wsMainEvents / batchAttrRename …
├── 组合式函数测试               # useAttrSchema / useTemplates / useInlineEdit / useSuggestDropdown /
│                               # useNotebookAttrStats（批量写入回归）
└── 源文本断言测试               # onDataChanged（防重启不变量）/ addCustomRow（缺导入回归）/ settings /
                                # releaseMetadata / tabsLayout / docInlineAttrs / logger
```

## 面板布局与数据流架构

```
App.vue → PropertyPanel.vue（顶部常驻 Tab 栏 + 完整 Tooltip 说明）
             ├─ header: title + 当前块类型徽标与 ID + open SchemaManager
             ├─ Tab 1: 当前文档 (tabEdit)
             │    ├─ AttrSection (internal)      → AttrRow* (只读/内置属性)
             │    ├─ AttrSection (custom)        → AttrRow* (自定义属性编辑/删除/重命名) + AddCustomRow
             │    └─ DocCustomStats              → 本篇文档全部自定义属性块大纲与下钻 (折叠)
             ├─ Tab 2: 笔记本 (tabStats)
             │    ├─ AttrTemplates               → 自定义属性模板 CRUD、导入导出与应用
             │    └─ NotebookAttrStats           → 笔记本级属性统计、值下钻、单键重命名与批量模式替换
             └─ Tab 3: 数据库 (tabDatabase)
                  ├─ AttrTemplateGroups          → 按模板属性智能筛选笔记块并一键生成原生数据库
                  └─ NotebookDbStats             → 笔记本数据库资产看板 (双向同步/对账/插入视图)
```

## 核心数据流

```
编辑器点击/切换 → useCurrentBlock（事件 + rAF 去抖，resolveInitialBlock 兜底）
                → currentBlockId 变化
                → useBlockAttrs（getBlockAttrs + loadToken 乱序守卫）
                → internalAttrs / customAttrs
                → PropertyPanel / DocInlineAttrs / MobileSheet 渲染

属性修改 → writeAttr（乐观更新 + chainWrite 串行）
        → dispatch spm:attrs-changed（AV_SPM_ATTRS_CHANGED_EVENT）
        → 其他面板实例 reload

ws-main 事务 → index.ts onWsMain
            ├─ handleAvSyncOps（AV op → 双向同步引擎）
            └─ dispatchAttrsChangedFromTxs（attrsChangedBus：按块 ID 防抖 150ms 广播）

双向同步（useAvSync）：
  AV 单元格 op → flushCells → 回声令牌登记 → getBlockAttrs 比对 → setBlockAttrs（只写差异）
  属性变更 op → flushAttrs → 回声令牌检查 → encodeIalToAvCell → batchSetAttributeViewBlockAttrs
  行插入 → 绑定时回填（属性胜）；结构性 op → 索引失效重建

批量属性重命名（NotebookAttrStats + batchAttrRename）：
  用户选择模式（exact / prefix / contains）并输入新名称
  → batchAttrRename 纯逻辑实时计算受影响的属性清单与对应的新属性键
  → 跨块执行 batchRenameAttrKey / batchReplaceAttrKeyPrefix 逐块更新
```

## 测试与验证

```bash
pnpm test       # 全部测试（40 个测试文件，279 cases 全部通过）
pnpm build      # vite 构建 + package.zip 产物校验
```

- 测试框架：Node.js 内置 `node:test`，运行器 `tsx --test`，无浏览器/DOM 依赖。
- `npx tsc --noEmit` 可做静态检查；已知遗留：`Setting.dialog` 与 `resizeCallback` 等签名（siyuan@1.1.0 类型落后于运行时，待联动升级）及少量 unused 符号告警，均不在重构涉改文件中。
- `vite build` 不做类型检查（esbuild），.vue 内「使用未导入」缺陷靠 `tests/addCustomRow.test.ts` 源文本断言与代码评审防护。

## 重构与演进历史

- **2026-06-14（第一轮重构）**：统计模块拆分（RF-009/010），产出 `DocCustomStats` / `NotebookAttrStats` / `useNotebookAttrStats` 等。
- **2026-10-25（第二轮重构，`docs/refactor-plan.md`）**：
  - 缺陷修复（RF-101/RF-101b）：批量操作选中键 NUL 解析修复、`AddCustomRow` 缺失 `inferAttrType` 导入修复、`setBlockAttrs` 数组调用改逐块写入、`mergeCurrentDocAttrRows` 接入；
  - AV 同步引擎解耦（RF-102）：核心纯逻辑拆分至 `avSyncRegistry` 与 `avSyncIndex`，新增 24 个单测；
  - 类型控件家族收敛（RF-103）：提取 `useDropdown`、`useInlineEdit`、`useSuggestDropdown` 与 `dropdownNav`，收敛重复代码；
  - 统计与建库组件去重（RF-104）：提取 `BlockListDrilldown`、`jumpToBlock`、`useAvDatabaseCreation` 与 `avDatabaseJson`；
  - 事件处理解耦（RF-105）：`attrsChangedBus` 与 `wsMainEvents` 抽象，统一事件常量。
- **2026-10-31 ~ 2026-11-14（交互重构与批量工具化，v1.1.0）**：
  - **三 Tab 职责重构**：将原编辑/统计/数据库重新规划为「当前文档」、「笔记本」、「数据库」三个常驻 Tab，Tab 栏常驻外层支持随时切换；
  - **模块归位与大纲下钻**：将「本篇文档属性块」`DocCustomStats` 移入当前文档 Tab 底部并支持折叠；将「自定义属性模板」`AttrTemplates` 移入笔记本 Tab 并支持 8px 12px 缩进显示；
  - **批量属性重命名与多模式替换**：重构弹窗交互，支持完整匹配、前缀替换与任意局部文本替换（如 `slide` ➜ `slides`），抽离纯函数 `batchAttrRename.ts` 并补齐单测；
  - **预设模板规范化**：内置演示模板全面对齐 `siyuan-live-slides` 即现演示插件（`slides-*`）；
  - **悬浮引导与无感对齐**：为所有 Tab 与核心操作提供中英双语 Tooltip 悬浮提示，优化内联属性条对齐与行高抖动；
  - **文档结构体系化**：将大型调研报告与科普指南统一归档至 `docs/reference/` 子目录，根目录聚焦工程活跃文档。
- **2026-11-16（第四轮重构，`docs/refactor-plan.md` RF-110 ~ RF-114）**：边缘模块残余重复与死代码治理，全部行为不变：
  - **SQL 转义统一（RF-110）**：新增 `utils/sqlLiteral.ts` 作为 `'` → `''` 转义唯一实现，替换 `useAvSync` / `attrStatsSql` / `SchemaManager` / `api` 四处重复；顺带修复 `getBlockRefInfo` 未转义的 id 拼接；
  - **屏蔽规则纯逻辑下沉（RF-111）**：`NotebookAttrStats` 对话框内 20 行逐行正则校验抽为 `attrStatsFilter.parseIgnorePatternLines`；`escapeHtml` 下沉至 `utils/dom.ts`；
  - **API 死代码清理（RF-112）**：删除零引用的 `setCustomQueryRunner` 机制与 `getBlockContent`，`api.d.ts` 收敛至 2 个实际引用接口（`types/index.d.ts` 为 vendored 声明，维持不动）；
  - **Dialog 脚手架去重（RF-113）**：`main.ts` 抽取 `openMountableDialog` 公共流程，Schema 管理器与批量重构对话框改为薄壳；
  - **设置开关工厂（RF-114）**：两个结构相同的 `b3-switch` 描述符收敛为 `createSwitchDescriptor`。
