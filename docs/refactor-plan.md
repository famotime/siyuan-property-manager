# 重构计划与执行演进

> **历史轮次**：
> - 2026-06-14 第一轮：统计模块拆分（RF-009/RF-010，已完成，产出 `DocCustomStats` / `NotebookAttrStats` 等）。
> - 2026-10-25 第二轮：AV 同步引擎解耦、Schema 类型系统收敛、组件去重与关键缺陷修复（RF-101 ~ RF-105，已全部完成）。
> - 2026-10-31 ~ 2026-11-14 第三轮：批量重命名多模式工具化、三 Tab 布局重构与悬浮引导体系（RF-108 ~ RF-109，已随 v1.1.0 交付）。

---

## 1. 项目快照

- 最新核验日期：2026-11-15
- 范围：`siyuan-property-manager` 全仓库
- 核心进展：
  - 第二轮 5 项关键重构（P0+P1）全部落地，缺陷彻底消除；
  - 第三轮交互与体验重构完成：三 Tab 职责清晰化、批量属性重命名工具化（`batchAttrRename.ts`）、模板对齐 `slides-*`、中英 Tooltips 全覆盖；
  - 文档库分层重组：工程文档常驻 `docs/` 根目录，调研与长文归入 `docs/reference/`。
- 测试基线：35 个测试文件，254/254 单元测试全部通过；`npm run build` 产物校验通过。

---

## 2. 重构与演进任务清单

| ID | 阶段 | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 状态 | 验证结果 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RF-101** | 第二轮 | P0 | 缺陷修复：批量操作选中键 + `inferAttrType` 导入 | `NotebookAttrStats.vue`、`AddCustomRow.vue`、`selectionKey.ts` | 提取 `selectionKey`（NUL 分隔成对解析）修复两处解析；补 `AddCustomRow.vue` 缺失的 `inferAttrType` 导入 | **done** | 测试 181/181 通过，缺导入扫描 CLEAN |
| **RF-101b** | 第二轮 | P0 | 缺陷修复延伸：批量写属性数组调用 + 当前文档属性并入缺失 | `useNotebookAttrStats.ts` | `setBlockAttrs` 数组参数改逐块写入；`docCustomMap` 改用 `mergeCurrentDocAttrRows` 接入 | **done** | 测试 207/207 通过 |
| **RF-102** | 第二轮 | P0 | AV 同步引擎拆分与纯逻辑单测 | `useAvSync.ts`、`avSyncRegistry.ts`、`avSyncIndex.ts` | 登记表归一化/合并与列索引映射纯逻辑下沉至 utils；补充 24 个内核无关单测 | **done** | 测试 205/205 通过，tsc 涉及文件 0 报错 |
| **RF-103** | 第二轮 | P1 | 类型控件家族收敛 | 9 个类型控件、`AddCustomRow`、`useDropdown`、`useInlineEdit`、`useSuggestDropdown`、`dropdownNav` | 下拉浮层、行内编辑生命周期、联想状态机收敛为共享 composables 与纯函数 | **done** | 测试 230/230 通过，代码精简 300+ 行 |
| **RF-104** | 第二轮 | P1 | 统计与数据库组件去重 | `BlockListDrilldown`、`jumpToBlock`、`useAvDatabaseCreation`、`avDatabaseJson` 等 | 下钻列表组件化；跳转编排收敛；建库编排与 AV JSON 构建解耦并补充单测 | **done** | 测试 249/249 通过 |
| **RF-105** | 第二轮 | P1 | ws-main 事件处理抽取与常量统一 | `index.ts`、`attrsChangedBus.ts`、`wsMainEvents.ts` | 抽取属性变更广播总线；统一使用 `AV_SPM_ATTRS_CHANGED_EVENT` 常量；清理死导入 | **done** | 测试 252/252 通过 |
| **RF-108** | 第三轮 | P1 | 批量属性重命名工具化与交互升级 | `NotebookAttrStats.vue`、`batchAttrRename.ts`、`useNotebookAttrStats.ts` | 弹窗样式重构；支持完整匹配、前缀与包含多模式替换；抽离 `batchAttrRename.ts` 纯计算与单测 | **done** | 单测 254/254 通过（新增 `batchAttrRename.test.ts`） |
| **RF-109** | 第三轮 | P1 | 三 Tab 职责重构与全流程悬浮引导 | `PropertyPanel.vue`、`AttrStats.vue`、`AttrSection.vue` 等 | 重构为「当前文档」、「笔记本」、「数据库」三 Tab 架构；DocCustomStats 归位文档、AttrTemplates 归位笔记本并缩进；全量补齐 Tooltips | **done** | 单测 254/254 全部通过（更新 `tabsLayout.test.ts`） |
| **RF-106** | 后续 | P2 | API 层死代码清理 | `src/api.ts`、`src/types/api.d.ts`、`src/types/index.d.ts` | 移除 `setCustomQueryRunner` 遗留机制、`getBlockContent` 及无引用接口 | **pending** | 待后续按需启动 |
| **RF-107** | 后续 | P2 | settings 表驱动与挂载辅助统一 | `src/settings.ts`、`src/main.ts`、`src/mobileSheet.ts` | 开关类描述符表驱动化；统一 Vue 实例挂载记账辅助 | **pending** | 待后续按需启动 |

---

## 3. 执行日志详细记录

### RF-101 ~ RF-105（第二轮基础重构：2026-10-25）
- **RF-101 / RF-101b**：
  - 修复 `NotebookAttrStats` 批量操作 key 拼接与解析失配问题（空格 vs `\x00`）；
  - 修复 `AddCustomRow.vue` 运行时 `ReferenceError: inferAttrType is not defined`（引入 `tests/addCustomRow.test.ts` 源码防漏检测）；
  - 查证思源内核 API 契约，将 `batchEditAttr`/`batchDeleteAttr` 的数组调用修正为逐块调用；
  - 修复文档属性统计与笔记本属性统计的并入逻辑。
- **RF-102**：
  - `useAvSync.ts` 单文件从 939 行降至 811 行；
  - 纯函数逻辑下沉至 `src/utils/avSyncRegistry.ts`（64 行）与 `src/utils/avSyncIndex.ts`（126 行），新增 24 项单测，实现列映射优先级与脏数据防御的可测性。
- **RF-103**：
  - 类型控件与编辑态生命周期收敛，新增 `useDropdown`、`useInlineEdit`、`useSuggestDropdown` 与 `dropdownNav`；
  - 控件家族减少约 302 行冗余逻辑，联想状态机与下拉循环导航统一。
- **RF-104**：
  - 提取 `BlockListDrilldown.vue`，消除下钻块列表 55 行×2 的重复模板；
  - 提取 `jumpToBlock.ts`、`useAvDatabaseCreation.ts`、`avDatabaseJson.ts` 与 `clipboard.ts`；
  - 统一 SQL 字面量转义，避免裸拼接。
- **RF-105**：
  - `index.ts` 精简至 212 行，提取 `attrsChangedBus.ts` 与 `wsMainEvents.ts`；
  - 清理未使用的死导入并统一事件名常量。

### RF-108 ~ RF-109（第三轮体验重构与工具化：2026-10-31 ~ 2026-11-14）
- **RF-108（批量属性重命名工具化）**：
  - 在笔记本属性面板新增单键重命名与批量属性名称替换功能；
  - 提炼纯逻辑模块 `src/utils/batchAttrRename.ts`，定义 `BatchRenameMode = 'exact' | 'prefix' | 'contains'`，精准计算预览与替换映射字典；
  - 补充 `tests/batchAttrRename.test.ts`（涵盖空串、大小写、边界情况等测试用例）；
  - 弹窗重构为带内边距、长列表滚动、受影响属性与块数统计的现代化卡片。
- **RF-109（三 Tab 架构与悬浮引导体系）**：
  - 侧栏主面板重构为「当前文档」(tabEdit)、「笔记本」(tabStats)、「数据库」(tabDatabase) 三大标签页；
  - 模块合理归位：「本篇文档属性块」移入当前文档面板底部并支持折叠；「自定义属性模板」迁移至笔记本面板并优化卡片缩进；
  - 接入全流程悬浮 Tooltips，中英文各 236 keys 严格对齐；
  - 更新 `tests/tabsLayout.test.ts`，全量测试集扩充至 254 cases 并保持 100% 通过。

---

## 4. 决策与后续建议

1. **已交付特性**：P0、P1 阶段以及第三轮交互重构的所有目标已全部交付，并在 v1.1.0 稳定运行。
2. **待启动条目（P2，低风险）**：
   - **RF-106**（API 层死代码清理）：清理 `src/api.ts` 中未引用的遗留函数及相关类型定义；
   - **RF-107**（settings 表驱动）：将设置项描述符表驱动化，统一各挂载点的生命周期记账。
3. **长期维护项**：
   - 关注思源宿主类型定义升级（联动提升 `minAppVersion` 与 `siyuan` 版本时消解 `Setting.dialog` 的 tsc 警告）；
   - 保持每轮新组件/纯函数均具备配套的 `node:test` 单元测试与缺导入校验。
