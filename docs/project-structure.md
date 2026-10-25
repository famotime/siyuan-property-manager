# 项目结构

思源笔记插件「属性管家」(Property Manager)：在右侧 Dock 面板、文档内联区域与移动端抽屉三处展示并编辑当前聚焦块的属性；提供类型化 Schema、属性模板、多维统计下钻、批量重构与属性 ⇄ 数据库（Attribute View）双向同步。

## 技术栈

- Vue 3 + TypeScript + Vite
- 输出格式：CJS（`siyuan` 与 `process` 外部化）
- 测试：Node.js 内置 test runner + tsx（纯函数/组合式函数单测 + 少量源文本断言）
- 包管理：pnpm（`preinstall` 钩子强制）

## 目录结构

```
src/
├── index.ts                    # 插件入口：onload 12 步初始化、ws-main 分发、onDataChanged 覆盖、设置与 Dock
├── main.ts                     # Vue 挂载/卸载（WeakMap 防重入）与 Schema 管理器对话框
├── docInlineAttrs.ts           # 副作用层：MutationObserver 驱动的文档内联面板挂载（纯逻辑在 utils/docInlineAttrs）
├── mobileSheet.ts              # 移动端底部抽屉挂载（预设能力，frontends 未启用 mobile）
├── api.ts                      # 思源内核 API 封装（仅实际使用的接口）
├── settings.ts                 # 运行时设置 + 设置项描述符构建（openSetting）
├── index.scss / scss/types.scss # 全部组件样式（spm- 前缀 BEM）
│
├── composables/                # 组合式函数与状态模块
│   ├── useCurrentBlock.ts      # 当前聚焦块单例（事件监听 + rAF 去抖；纯状态机在 utils/currentBlockState）
│   ├── useBlockAttrs.ts        # 属性 CRUD：乐观更新 + chainWrite 串行化 + 跨实例事件
│   ├── useAttrPanel.ts         # Dock/内联面板共享逻辑（i18n/行 refs/事件处理/跨实例同步监听）
│   ├── attrsChangedBus.ts      # ws-main 事务 → 按块 ID 防抖 150ms → 广播 spm:attrs-changed
│   ├── useAttrSchema.ts        # 类型化 Schema 单例（增删改查 + 300ms 防抖持久化）
│   ├── useAvSync.ts            # 属性⇄数据库双向同步引擎（811 行；纯逻辑已下沉 utils/avSync*）
│   ├── useAvDatabaseCreation.ts# 按模板建库编排：putFile AV JSON → 插块 → 绑定 → 回填 → 登记
│   ├── jumpToBlock.ts          # 统计下钻跳转编排（AttrStats/AttrDatabase 共用）
│   ├── useDropdown.ts          # 下拉浮层开关 + 点击外部关闭（6 个类型控件共用）
│   ├── useInlineEdit.ts        # 行内编辑生命周期：进入/提交/取消/失焦豁免（Text/Number 共用）
│   ├── useSuggestDropdown.ts   # 输入联想通用状态机：防抖拉取 + 乱序守卫 + 高亮导航 + 选中
│   ├── useValueSuggest.ts      # 历史值联想（useSuggestDropdown 的薄包装）
│   ├── useTemplates.ts         # 属性模板单例（localStorage 迁移 + 防抖持久化）
│   ├── useMobileSheet.ts       # 移动端抽屉状态
│   ├── attrStatsSql.ts         # 纯 SQL 构建器：统计/下钻/模板筛选/建库回填（全部带字面量转义与 LIMIT）
│   ├── useSharedStats.ts       # 统计共享类型 + runStatsSql 执行器
│   ├── useDocCustomStats.ts    # 文档级自定义属性块统计
│   ├── useNotebookAttrStats.ts # 笔记本级属性分布统计 + 批量编辑/删除（逐块写入）
│   └── useNotebookDbStats.ts   # 笔记本数据库资产板（渲染统计 + 绑定块懒加载 + 排序）
│
├── components/                 # Vue 单文件组件
│   ├── PropertyPanel.vue       # Dock 面板主组件（编辑/统计/数据库三 Tab）
│   ├── DocInlineAttrs.vue      # 文档内联属性面板（标题与正文之间）
│   ├── AttrSection.vue         # 可折叠分组（localStorage 持久化）
│   ├── AttrRow.vue             # 单行属性：键名重命名 + v-if 分发到 AttrType* 控件
│   ├── AddCustomRow.vue        # 新增自定义属性行（键名/属性值双联想，基于 useSuggestDropdown）
│   ├── AutocompleteDropdown.vue# 联想浮层渲染（条目归一化 string | {value,label,display}）
│   ├── BlockListDrilldown.vue  # 统计下钻块列表共享组件（加载态/空态/复制/跳转）
│   ├── AttrStats.vue           # 统计 Tab 壳：DocCustomStats + NotebookAttrStats
│   ├── DocCustomStats.vue      # 文档块级属性统计面板
│   ├── NotebookAttrStats.vue   # 笔记本级统计：批量选择/行内编辑/值下钻/批量编辑删除
│   ├── AttrDatabase.vue        # 数据库 Tab 壳：AttrTemplateGroups + NotebookDbStats
│   ├── AttrTemplateGroups.vue  # 按模板筛选块并一键建库（编排已下沉 useAvDatabaseCreation）
│   ├── NotebookDbStats.vue     # 数据库卡片：同步开关/手动对账/绑定块下钻/插入视图
│   ├── AttrTemplates.vue       # 编辑 Tab 的模板 CRUD 与应用
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
│   └── presetTemplates.ts      # Slidev 模板预设（区别于 schema.ts）
│
├── utils/                      # 纯函数（kernel-free，绝大部分有单测）
│   ├── dom.ts                  # DOM/格式化：findBlockIdFromEvent、shortBlockId、formatTimestamp、formatSiyuanTime
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
│   ├── attrStatsFilter.ts      # 统计过滤
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
│   ├── api.d.ts                # API 响应类型
│   └── vue-shim.d.ts           # Vue SFC 声明
│
└── i18n/
    ├── zh_CN.json              # 简体中文（209 keys）
    └── en_US.json              # 英文（与 zh_CN 同步）

tests/                          # node:test 套件（33 个文件，252 cases）
├── 纯函数测试                   # attrStatsSql / avValueCodec / avSyncOps / avSyncRegistry / avSyncIndex /
│                               # avDatabaseJson / dropdownNav / notebookStatsSort / selectionKey / siyuanId /
│                               # dom / blockJump / blockOrder / typeInference / schemaParser / autocomplete /
│                               # valueFormat / attrStatsFilter / currentBlockState / activeBlock / wsMainEvents …
├── 组合式函数测试               # useAttrSchema / useTemplates / useInlineEdit / useSuggestDropdown /
│                               # useNotebookAttrStats（批量写入回归）
└── 源文本断言测试               # onDataChanged（防重启不变量）/ addCustomRow（缺导入回归）/ settings /
                                # releaseMetadata / tabsLayout / docInlineAttrs / logger
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
```

## 测试与验证

```bash
pnpm test       # 全部测试（252 cases）
pnpm build      # vite 构建 + package.zip 产物校验
```

- 测试框架：Node.js 内置 `node:test`，运行器 `tsx --test`，无浏览器/DOM 依赖。
- `npx tsc --noEmit` 可做静态检查；已知遗留：`Setting.dialog`（siyuan@1.1.0 类型落后于运行时）、`autocomplete.ts` 死变量、2 个测试文件未用符号。
- `vite build` 不做类型检查（esbuild），.vue 内「使用未导入」缺陷靠 `tests/addCustomRow.test.ts` 源文本断言与代码评审防护。

## 重构历史

- 2026-06-14（第一轮）：统计模块拆分（RF-009/010），产出 DocCustomStats / NotebookAttrStats / useNotebookAttrStats 等。
- 2026-10-25（第二轮，`docs/refactor-plan.md`）：缺陷修复（批量操作选中键、`setBlockAttrs` 数组调用、`inferAttrType` 缺导入、`docCustomMap` 被忽略）；AV 同步引擎拆分（纯逻辑入 `avSyncRegistry`/`avSyncIndex`）；类型控件家族收敛（`useDropdown`/`useInlineEdit`/`useSuggestDropdown`/`dropdownNav`）；统计与数据库组件去重（`BlockListDrilldown`/`jumpToBlock`/`useAvDatabaseCreation`/`avDatabaseJson`/SQL 收敛）；ws-main 事件处理抽取与事件名常量统一。
