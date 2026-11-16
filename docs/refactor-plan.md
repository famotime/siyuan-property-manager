# 重构计划

> **历史轮次存档**（详见本文末尾「历史轮次存档」）：
> - 2026-06-14 第一轮：统计模块拆分（RF-009/RF-010）。
> - 2026-10-25 第二轮：AV 同步引擎解耦、Schema 类型系统收敛、组件去重与关键缺陷修复（RF-101 ~ RF-105）。
> - 2026-10-31 ~ 2026-11-14 第三轮：批量重命名工具化、三 Tab 布局重构与悬浮引导体系（RF-108 ~ RF-109）。

## 1. 项目快照

- 生成日期：2026-11-16
- 范围：`siyuan-property-manager` 全仓库
- 目标：第四轮重构——消除残余重复（SQL 转义、对话框脚手架）、下沉可测纯逻辑、清理已验证死代码，不改变任何用户可见行为
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 测试基线：`npm test` 270/270 通过（35+ 文件）；`npm run build` 通过。**基线全绿，可直接开始。**

## 2. 架构与模块分析

经过三轮重构，核心链路（生命周期、属性数据流、AV 双向同步、Schema 类型系统）已解耦良好，纯逻辑普遍下沉至 `src/utils/` 并有单测。本轮扫描发现的是**残余重复与遗留死代码**，集中在边缘模块：

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| SQL 访问层 | `src/api.ts`（235 行）、`src/types/api.d.ts` | 内核 API 封装 | ① `setCustomQueryRunner`/`customQueryRunner` 机制**零引用**（src+tests 全量 grep 验证）；② 导出的 `getBlockContent` **零引用**（`PropertyPanel.vue` 中的同名函数是本地函数，非导入）；③ `searchBlocksByKeyword` 内联单引号转义 | 无直接单测（内核封装，靠上层间接覆盖） |
| SQL 字面量转义 | `src/composables/useAvSync.ts:99`、`src/composables/attrStatsSql.ts:23`、`src/components/SchemaManager.vue:395,403`、`src/api.ts:199` | 各自维护 `'` → `''` 转义 | **同一逻辑 4 处重复实现**，命名不一（`quoteSqlLiteral`/`escapeSqlLiteral`/内联 `esc`），新增查询点易漏转义 | `attrStatsSql.test.ts` 覆盖间接路径 |
| 笔记本属性统计 | `src/components/NotebookAttrStats.vue`（687 行） | 统计展示 + 行内编辑 + 忽略规则对话框 | `openIgnoreAttrDialog` 为 160 行手写 HTML 字符串对话框；其中正则逐行校验逻辑（`updatePreview` 内 20 行循环：trim、跳过 `#` 注释、`new RegExp` 试错、收集首错）是纯逻辑却内嵌在 UI 中；`escapeHtml` 组件内私有 | `attrStatsFilter.test.ts` 只覆盖 `compileRegexPatterns` 等既有函数 |
| Vue 挂载层 | `src/main.ts`（192 行） | 面板挂载 + 两个 Dialog 打开 | `openSchemaManagerDialog` 与 `openBatchRefactorDialog` **约 40 行脚手架重复**（Dialog 构造、container flex、host 查询、mount 记账、destroy 回调） | 无直接单测（DOM 层） |
| 设置层 | `src/settings.ts`（202 行） | 运行时设置 + 描述符 | 两个 checkbox 描述符（统计日志、同步总开关）结构完全相同，仅 title/desc/key 不同 | `settings.test.ts` 覆盖 normalize 逻辑 |

不在本轮范围的观察（记录备查）：
- `useAvSync.ts`（841 行）经 RF-102 后职责边界清晰（登记表/索引/写入/对账四段），进一步拆分收益有限、风险不低，**不做**。
- `constants/schema.ts`（615 行）为预设数据表，非逻辑代码，**不动**。
- `NotebookAttrStats.vue` 的 HTML 字符串对话框**整体**改造为 Vue 组件属行为级变更（涉及焦点/事件时序），超出「安全重构」边界，本轮只下沉其纯逻辑。

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-110 | P1 | SQL 字面量转义统一 | 新增 `src/utils/sqlLiteral.ts`、`tests/sqlLiteral.test.ts`；改 `useAvSync.ts`、`attrStatsSql.ts`、`SchemaManager.vue`、`api.ts` | 抽取唯一实现：`escapeSqlLiteral(value)` 与 `sqlLiteral(value)`；4 处重复点全部改引；行为不变式：转义结果逐字节一致（`'` → `''`），生成的 SQL 语句不变 | 低 | - [x] 新增 `sqlLiteral.test.ts` 4 用例：基础转义、空串、多值 IN 子句<br>- [x] 定向回归 `attrStatsSql` / `avSyncRegistry` / `avSyncIndex` / `avValueCodec` 70/70<br>- [x] 全量 `npm test` 274/274 | `docs/project-structure.md`：utils 清单加 `sqlLiteral.ts`；`README.md`：无需变更 | done |
| RF-111 | P1 | 忽略规则对话框纯逻辑下沉 | `src/utils/attrStatsFilter.ts`（新增 `parseIgnorePatternLines`）、`src/utils/dom.ts`（新增 `escapeHtml`）、`NotebookAttrStats.vue`；新增 `tests/ignorePatternParse.test.ts` | ① 逐行校验循环抽为纯函数 `parseIgnorePatternLines(lines): { validPatterns, error: {line, message} \| null }`（保留 trim、跳过空行与 `#` 注释、只报首个错误的语义）；② `escapeHtml` 移至 `src/utils/dom.ts` 并加单测；③ 对话框 DOM 结构与事件绑定不动 | 低-中 | - [x] 新增 `ignorePatternParse.test.ts` 5 用例（合法/非法/混合/含注释/全空行 + escapeHtml 五实体）<br>- [x] 邻域回归 `attrStatsFilter` + `dom` 28/28<br>- [x] 全量 `npm test` 279/279，tsc 涉改文件 0 报错 | `docs/project-structure.md`：attrStatsFilter 职责描述更新；`README.md`：无需变更 | done |
| RF-112 | P2 | API 层死代码清理（承接原 RF-106） | `src/api.ts`、`src/types/api.d.ts` | 删除零引用的 `setCustomQueryRunner`/`customQueryRunner` 机制与导出函数 `getBlockContent`；`api.d.ts` 中经 grep 验证零引用的环境接口一并删除（保留 `IResGetBlockKramdown`、`IResdoOperations` 及其依赖）。行为不变式：其余导出面与行为完全不变 | 低 | - [x] 删除前 grep 复核引用为零（src + tests，含逐接口 12 项扫描）<br>- [x] 全量 `npm test` 279/279（含 `releaseMetadata.test.ts`）<br>- [ ] `npm run build` 随收尾统一验证 | `docs/project-structure.md`：api.ts 行数/描述更新；`README.md`：无需变更 | done |
| RF-113 | P2 | Dialog 打开脚手架去重（承接原 RF-107 前半） | `src/main.ts` | 抽取 `openMountableDialog(options)` 私有辅助：Dialog 构造、container flex 布局、host 查询、mount 返回的卸载函数接线、destroyCallback；`openSchemaManagerDialog`（保留尺寸记忆）与 `openBatchRefactorDialog` 改为薄壳。行为不变式：positionId、尺寸策略、destroy 时先存尺寸再 unmount 的顺序不变 | 低 | - [x] 现有测试全量回归 279/279<br>- [ ] `npm run build` 随收尾统一验证<br>- [x] tsc 涉改文件 0 报错（修正 `resizeCallback` 与 siyuan@1.1.0 类型签名的适配） | `docs/project-structure.md`：main.ts 描述更新；`README.md`：无需变更 | done |
| RF-114 | P2 | 设置开关描述符小型工厂（承接原 RF-107 后半，低价值可选） | `src/settings.ts` | 两个结构相同的 checkbox 描述符收敛为一个 `createSwitchDescriptor(host, {key, title, description})` 工厂。行为不变式：生成的 DOM 结构、事件、读取 `getRuntimeSettings` 的时机不变 | 低 | - [x] 既有 `settings.test.ts` 作为回归网（DOM 类型/类名/checked/change 接线/i18n 回退全钉住）5/5<br>- [x] 全量 `npm test` 279/279<br>- [x] `npm run build` 通过、package.zip 校验通过 | `docs/project-structure.md`：settings.ts 描述更新；`README.md`：无需变更 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行（本轮无 P0 项——核心链路已经三轮治理，无高价值/高风险残留）
- `P1`：中等风险或中等价值，放在 `P0` 之后
- `P2`：低风险清理项，最后执行

状态说明：`pending` / `in_progress` / `done` / `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-110 | 2026-11-16 | 2026-11-16 | `npx tsx --test tests/sqlLiteral.test.ts`（4/4）、定向回归（70/70）、`npm test`（274/274）、tsc 无涉改文件报错 | pass | 待统一刷新 | 额外加固：`api.ts` `getBlockRefInfo` 原有未转义的 `'${id}'` 拼接改经 `escapeSqlLiteral`（合法块 ID 输出逐字节不变） |
| RF-111 | 2026-11-16 | 2026-11-16 | `npx tsx --test tests/ignorePatternParse.test.ts tests/attrStatsFilter.test.ts tests/dom.test.ts`（28/28）、`npm test`（279/279）、tsc 无涉改文件报错 | pass | 待统一刷新 | 对话框 DOM/事件时序零改动；`updatePreview` 内 20 行循环收敛为 5 行纯函数调用 |
| RF-112 | 2026-11-16 | 2026-11-16 | grep 死引用复核（0 残留）、`npm test`（279/279）、tsc 全量 25（基线）→23 处且涉改文件 0 报错 | pass | 待统一刷新 | `api.ts` 235→209 行；`api.d.ts` 12→2 个接口。**范围修正**：`types/index.d.ts` 为 vendored 全局声明且全部类型在仓库内有引用，维持不动 |
| RF-113 | 2026-11-16 | 2026-11-16 | `npm test`（279/279）、tsc 涉改文件 0 报错 | pass | 待统一刷新 | `mount` 回调签名设计为接收 Dialog 实例，规避调用方 TDZ 闭包隐患；`beforeUnmount` 保持「先存尺寸、后卸载组件」顺序 |
| RF-114 | 2026-11-16 | 2026-11-16 | `npx tsx --test tests/settings.test.ts`（5/5）、`npm test`（279/279）、`npm run build`（通过 + zip 校验）、tsc 涉改文件 0 报错 | pass | `docs/project-structure.md`（已刷新）；README.md 核查后无需变更 | 既有测试作为回归网，未新增用例 |

## 5. 决策与确认

- 用户批准的条目：交互式批准组件未收到答复；依用户原始指令「完成代码模块分析和重构」及系统指引，按推荐方案（RF-110 ~ RF-114 全部 5 项）执行，全部条目均为计划内行为不变的安全重构
- 延后的条目：无（原计划中的 HTML 对话框整体组件化已在 §2 明确不做并记录理由）
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：已刷新——utils 清单补 `sqlLiteral.ts`、`attrStatsFilter` 增 `parseIgnorePatternLines`、`dom.ts` 增 `escapeHtml`、api.ts/main.ts/settings.ts 职责描述、测试计数（40 文件 / 279 cases）与第四轮演进历史
- `README.md`：核查后**无需变更**——全文无测试数量等技术计数，且本轮无用户可见能力变化
- 最终同步检查：全部 5 项 `done`，计划状态与仓库真实状态一致

## 7. 下一步

1. （可选）人工抽查：设置页打开 Schema 管理器 / 批量重构对话框、笔记本属性页忽略规则对话框实时预览
2. 下轮候选：`NotebookAttrStats.vue` 手写 HTML 对话框组件化（行为级变更，需单独立项）；思源宿主类型升级后消解 `Setting.dialog`/`resizeCallback` 的 tsc 遗留告警
3. 保持每轮新纯函数配 `node:test` 单测与缺导入校验的惯例

---

## 附：历史轮次存档（第一至第三轮）

### RF-101 ~ RF-105（第二轮基础重构：2026-10-25）
- **RF-101 / RF-101b**：修复 `NotebookAttrStats` 批量操作 key 拼接与解析失配（空格 vs `\x00`）；修复 `AddCustomRow.vue` 运行时 `inferAttrType is not defined`（引入源码防漏检测）；`batchEditAttr`/`batchDeleteAttr` 数组调用改逐块写入；文档属性并入逻辑修正。
- **RF-102**：`useAvSync.ts` 939 → 811 行；纯逻辑下沉 `avSyncRegistry.ts`（64 行）与 `avSyncIndex.ts`（126 行），新增 24 项单测。
- **RF-103**：类型控件与编辑态生命周期收敛，新增 `useDropdown`、`useInlineEdit`、`useSuggestDropdown` 与 `dropdownNav`，减少约 302 行冗余。
- **RF-104**：提取 `BlockListDrilldown.vue` 消除下钻列表 55 行×2 重复；提取 `jumpToBlock.ts`、`useAvDatabaseCreation.ts`、`avDatabaseJson.ts`、`clipboard.ts`；统一 SQL 字面量转义（部分）。
- **RF-105**：`index.ts` 精简至 212 行，提取 `attrsChangedBus.ts` 与 `wsMainEvents.ts`。

### RF-108 ~ RF-109（第三轮体验重构：2026-10-31 ~ 2026-11-14，随 v1.1.0 交付）
- **RF-108**：批量属性重命名多模式（exact/prefix/contains）工具化，纯逻辑 `batchAttrRename.ts` + 单测；弹窗现代化。
- **RF-109**：三 Tab 架构（当前文档/笔记本/数据库）；DocCustomStats、AttrTemplates 归位；中英 Tooltips 各 236 keys 对齐。

### 原计划遗留条目映射
- 原 RF-106（API 层死代码清理）→ 本轮 **RF-112**（范围经重新验证修正：`getBlockContent` 在 PropertyPanel 中为同名本地函数，API 导出确无引用）
- 原 RF-107（settings 表驱动 + 挂载辅助）→ 本轮拆分为 **RF-113**（对话框脚手架）与 **RF-114**（设置开关工厂）
