# 重构计划

## 1. 项目快照

- 生成日期：2026-06-11
- 范围：siyuan-property-manager 全仓库
- 目标：消除死代码和重复逻辑，提升可测试性，补齐关键模块测试覆盖
- 文档刷新目标：`docs/project-structure.md`、`README.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| API 层 | `src/api.ts` (52 行) | 封装思源内核 API（仅实际使用的接口） | 已清理 | 无测试 |
| 属性面板逻辑 | `PropertyPanel.vue` + `DocInlineAttrs.vue` + `useAttrPanel.ts` | Dock 面板和文档内联属性编辑 | 已提取共享 composable | 无测试 |
| 属性数据层 | `useBlockAttrs.ts` | 属性 CRUD + 乐观更新 + 跨实例同步 | 无明显问题 | 无测试 |
| DOM 工具 | `utils/dom.ts` | 块 ID 解析、时间戳格式化等 | 无明显问题 | **11 个测试** |
| 属性统计 | `AttrStats.vue` | 文档块统计 + 笔记本属性分布 + 批量操作 | 死代码已移除 | 无测试 |
| 属性常量 | `constants/attrs.ts` | 属性分类规则 + 验证函数 | 无明显问题 | **7 个测试** |
| 模板管理 | `useTemplates.ts` + `AttrTemplates.vue` | 自定义属性模板 CRUD | 硬编码已修复为 i18n | 无测试 |
| 内联属性管理 | `docInlineAttrs.ts` | MutationObserver 驱动的动态挂载 | 未使用函数已清理 | 已有 4 个测试 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 提取属性面板共享逻辑 | `PropertyPanel.vue`, `DocInlineAttrs.vue`, `composables/useAttrPanel.ts` | 提取共享 composable | 中 | - [x] 共享 composable 导出所有原接口；- [x] PropertyPanel 行为不变；- [x] DocInlineAttrs 行为不变；- [x] `npm run build` 通过 | `docs/project-structure.md`：新增 `useAttrPanel.ts` | done |
| RF-002 | P0 | 清理 api.ts 死代码 | `src/api.ts` | 486 行 → 52 行，仅保留 5 个使用的函数 | 低 | - [x] `npm run build` 通过；- [x] 全局搜索确认无遗漏引用 | `docs/project-structure.md`：API 层描述更新 | done |
| RF-003 | P1 | 删除未使用的 SiyuanTheme 组件 | `src/components/SiyuanTheme/` (6 个 .vue 文件) | 移除全部未引用的模板遗留组件 | 低 | - [x] 全局搜索确认无引用；- [x] `npm run build` 通过 | 无 | done |
| RF-004 | P1 | 补充 dom.ts 单元测试 | `src/utils/dom.ts`, `tests/dom.test.ts` | 11 个测试覆盖 formatTimestamp、parseCreatedFromId、shortBlockId、isMultiline | 低 | - [x] 新测试全部通过；- [x] 原有测试不回归 | 无 | done |
| RF-005 | P1 | 补充 attrs.ts 常量函数测试 | `src/constants/attrs.ts`, `tests/attrs.test.ts` | 7 个测试覆盖 isCustomKey、isReadonlyKey、isValidCustomSuffix | 低 | - [x] 新测试全部通过 | 无 | done |
| RF-006 | P1 | 移除 AttrStats.vue 死代码 | `src/components/AttrStats.vue` | 删除未调用的 `jumpToDoc` 函数 | 低 | - [x] `npm run build` 通过 | 无 | done |
| RF-007 | P2 | 修复 useTemplates 硬编码中文 | `useTemplates.ts`, `AttrTemplates.vue`, i18n JSON | `addTemplate` 接受名称参数，i18n key `templateDefaultName` | 低 | - [x] `npm run build` 通过 | i18n 新增 key | done |
| RF-008 | P2 | 修复缺失的 eslint 插件引用 | `eslint.config.mjs` | 移除不存在的 `i18n-validate-keys.mjs` 引用 | 低 | - [x] `npm run build` 通过 | 无 | done |

附带修复：
- `docInlineAttrs.ts`：移除未使用的 `unmountHost` 函数
- `tsconfig.json`：`include` 新增 `tests/**/*.ts` 以支持测试文件的全局类型解析
- `package.json`：测试 runner 从 `ts-node/esm` 切换为 `tsx`（修复 Windows 兼容性）

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-06-11 | 2026-06-11 | `npm run build` + `npm test` | pass (29/29) | — | 新建 `useAttrPanel.ts`，PropertyPanel 和 DocInlineAttrs 各减约 60 行 |
| RF-002 | 2026-06-11 | 2026-06-11 | `npm run build` + `npm test` | pass (29/29) | — | api.ts 486→52 行 |
| RF-003 | 2026-06-11 | 2026-06-11 | `npm run build` | pass | — | 删除 6 个未使用组件 |
| RF-004 | 2026-06-11 | 2026-06-11 | `npm test` | pass (47/47) | — | 11 个新测试；同时修复 tsconfig 和 test runner |
| RF-005 | 2026-06-11 | 2026-06-11 | `npm test` | pass (47/47) | — | 7 个新测试 |
| RF-006 | 2026-06-11 | 2026-06-11 | `npm run build` | pass | — | 删除 jumpToDoc |
| RF-007 | 2026-06-11 | 2026-06-11 | `npm run build` | pass | — | 新增 i18n key `templateDefaultName` |
| RF-008 | 2026-06-11 | 2026-06-11 | `npm run build` + `npm test` | pass (47/47) | — | 移除未使用的 import |

## 5. 决策与确认

- 用户批准的条目：全部（RF-001 ~ RF-008）
- 延后的条目：—
- 阻塞条目及原因：—

## 6. 文档刷新

- `docs/project-structure.md`：待刷新
- `README.md`：待刷新
- 最终同步检查：—

## 7. 下一步

1. 刷新 `docs/project-structure.md`
2. 刷新 `README.md`
3. 提交所有变更
