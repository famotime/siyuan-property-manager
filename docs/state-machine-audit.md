# 隐式状态机审计与修复计划

> 审计日期：2026-11-17。方法：通读全部核心状态代码（`src/index.ts`、三大 composable 引擎、
> 全部 UI 编排组件与工具层），逐台识别隐式状态机（状态载体、状态空间、转移路径），
> 再按严重度定位隐藏问题。修复条目编号 `SM-xxx`，状态在本文维护（`pending` / `in_progress` / `done` / `deferred`）。
>
> 测试基线：`npm test` 277/277 通过（39 文件）；`npm run build` 通过。

## 1. 隐式状态机清单（12 组）

| 层 | 状态机 | 状态载体 | 位置 |
| --- | --- | --- | --- |
| 内核事件入口 | 块变更防抖广播 | `timers: Map<blockId, timer>`，150ms 尾沿防抖 | `src/composables/attrsChangedBus.ts` |
| 内核事件入口 | ws-main 分流 | `detail.cmd === 'transactions'` | `src/index.ts` |
| AV 同步引擎 | 索引生命周期 | `indices` + `building` Map + `stale` + `builtAt`（TTL 5min） | `src/composables/useAvSync.ts` |
| AV 同步引擎 | 回声令牌 | `echoTokens`（TTL 2s，值匹配消费） | 同上 |
| AV 同步引擎 | 待冲刷队列 | `pendingCells`/`pendingAttrs` + 120ms 防抖 → drain → 预算熔断 → 链式写回 | 同上 |
| AV 同步引擎 | 写入熔断 | 局部 `budget = 200`，耗尽 `break` | 同上 |
| AV 同步引擎 | 状态面板 | `status: Record<avID, idle\|syncing\|done\|error>` | 同上 |
| AV 同步引擎 | 登记表持久化 | `entries` + `entriesJson` 基线 + 300ms 防抖 | 同上 |
| 块属性数据层 | 加载守卫/写链/乐观更新 | `loadToken` 单调守卫；`inflight` 按 key 串行；乐观写 + 回滚 + 空串即删 | `src/composables/useBlockAttrs.ts` |
| 当前块追踪 | 三元组 + 握手 | `{blockId, blockKind, rootId}`（唯一接近显式：`nextCurrentBlockState`）+ `bound`/rAF 队列/`pendingJumpBlockId`/`editorClickHandled` | `src/composables/useCurrentBlock.ts` |
| UI 控件级 | 行保存态 / 行内编辑 / 联想浮层 / 下拉 | `idle→saving→success→idle/error`（值变化驱动）；`editing+draft+justEntered`；`open+seq`；`open+外部点击` | `AttrRow.vue`、`useInlineEdit.ts`、`useSuggestDropdown.ts`、`useDropdown.ts` |
| 持久化单例 | schema / templates / settings | `isLoaded` + `lastSavedXxxJson` 基线 + 300ms 防抖（settings 立即） | `useAttrSchema.ts`、`useTemplates.ts`、`settings.ts` |
| 生命周期 | doc-inline 挂载 / dock / mobile sheet | `mounts` Map + 全局 MutationObserver + 80ms 防抖；WeakMap；二态 | `src/docInlineAttrs.ts`、`src/main.ts`、`src/mobileSheet.ts` |
| 一次性编排 | 建库 7 步 / 批量重命名四方协调 / 分片写入 / 跳转握手 | 300ms sleep 充当同步屏障；四入口各自编排；25/批；乐观 set + pending token 轮询 | `useAvDatabaseCreation.ts`、`NotebookAttrStats.vue` 等 |

## 2. 问题清单与修复条目

状态说明：`pending` / `in_progress` / `done` / `deferred`。

| ID | 优先级 | 问题 | 根因位置 | 修复方案 | 状态 |
| --- | --- | --- | --- | --- | --- |
| SM-101 | P1 | 属性重命名四方协调不完整：面板行内重命名与 SchemaManager 重命名缺 `renameAttrKeyInAvSync`/`renameAttrKeyInTemplates`，登记表 mapping 失效 → AV 编辑复活旧键、模板应用重建旧键 | `useAttrPanel.ts:103`、`SchemaManager.vue:483` | 新增统一协调器 `renameAttrKeyEverywhere(oldKey, newKey, {rewriteBlocks?})`（块数据改写最先执行，全失败即中断保护；随后 schema → templates → registry），4 个入口全部接入 | done |
| SM-102 | P1 | `resolveBoxId` 缓存永不随文档切换失效 → 切换笔记本后批量编辑写错笔记本 | `NotebookAttrStats.vue:254` | 监听 rootId/blockId 变化重置缓存 | done |
| SM-103 | P1 | `flushCells`/`flushAttrs` 为可并发波次：上一波 await 索引期间新事件可启动下一波，写回入链顺序取决于耗时而非到达序 → 旧值覆盖新值（LWW 破坏）；且 budget 耗尽 `break` 时剩余项已 drain，永久丢弃 | `useAvSync.ts:315/386` | 冲刷 single-flight 串行化（运行中则回灌重排下一波）；溢出项回灌 pending 队列而非丢弃；规划逻辑抽为 kernel-free 纯函数 `src/utils/avSyncFlush.ts` 并补单测 | done |
| SM-104 | P1 | 三个统计 composable（notebook-attr / doc-custom / notebook-db）无乱序守卫，快速切换文档时旧响应覆盖新数据、loading 被先完成者提前置 false | `useNotebookAttrStats.ts:26` 等 | 与 `useBlockAttrs` 的 loadToken 模式对齐（单调 token 守卫 + 统一错误清空语义） | done |
| SM-105 | P1 | 多端持久化竞态：300ms 防抖保存窗口内 `onDataChanged` 广播触发 reload，远端 JSON 整体覆盖内存态并刷新基线 → 本地未保存编辑被静默丢弃 | `useAttrSchema.ts:57`、`useTemplates.ts:88`、`useAvSync.ts:596` | 三个单例加 dirty 门闩：mutator 置脏、保存成功清脏；reload 检测到脏则跳过本轮覆盖（本地优先，保存后的广播自然对齐） | done |
| SM-106 | P2 | `useCurrentBlock` 模块单例无引用计数：任一消费者卸载即全局 unbind；`pendingJumpBlockId` 无 TTL/取消、unbind 不清理 → 陈旧跳转在后续无关 switch-protyle 上执行；`onSwitchProtyle` 跳转路径依赖两帧 rAF 注册顺序 | `useCurrentBlock.ts:32/96/214` | bind/unbind 引用计数；unbind 清理 `pendingJumpBlockId`；跳转路径一步 scheduleUpdate 消除 rAF 顺序依赖 | done |
| SM-107 | P2 | `useBlockAttrs` 本地状态与「最新写」错位：早失败写的回滚覆盖晚写乐观值；旧空串写成功后的本地 delete 吞掉晚写乐观值；`renameCustom` 链挂 oldKey 而后续编辑链挂 newKey，跨键交错 | `useBlockAttrs.ts:104/186` | 写链改按块（targetId）串行；回滚/删除/重命名回滚加「本地值仍是本次乐观值」条件守卫；守卫逻辑抽为纯函数 `src/utils/attrLocalState.ts` + 单测 | done |
| SM-108 | P2 | AttrRow 保存态机用「值变化」驱动 success：保存失败时乐观更新先触发 success 闪现再转 error；若调用方绕过同值守卫，markSaving 后无复位路径（卡 saving） | `AttrRow.vue:271` | success 改由 onSave 完成驱动（`markSuccess`），移除值变化 watch；任何不抛出的保存路径都有终态 | done |
| SM-109 | P2 | 同步状态面板失真：flush 路径吞掉写失败（error 态不可达）；`flushCells` 用 `queued[0].avID` 单库归因，但队列可跨多库 | `useAvSync.ts:369` | `writeIalDiffs`/`writeAvCells` 返回 `{written/keys, failed}`；按 avID 归因 written/skipped/failed 并逐库 setStatus | done |
| SM-110 | P2 | `onunload` 不取消 schema/templates 的防抖保存定时器，卸载后 300ms 仍可能 `plugin.saveData` | `index.ts:80` | 新增 `disposeSchemas()`/`disposeTemplates()` 并在 onunload 调用 | done |
| SM-111 | P2 | 建库第 4 步以固定 300ms sleep 充当内核索引就绪屏障，慢环境可能绑定失败 | `useAvDatabaseCreation.ts:70` | 改为 `addAttributeViewBlocks` 失败短重试（5 × 200ms），快路径不再固定等待 | done |
| SM-112 | P2 | `writeIalDiffs` 成功后立即 dispatch `spm:attrs-changed`，内核事务广播 150ms 后 attrsChangedBus 再 dispatch 一次 → 每次同步写回触发两轮面板 reload | `useAvSync.ts:277` | 移除 writeIalDiffs 内的重复 dispatch，统一由事务广播链路派发 | done |
| SM-113 | P2 | attrsChangedBus 纯尾沿防抖：对同一块的持续写入（间隔 < 150ms）不断重置定时器，面板刷新可被无限推迟 | `attrsChangedBus.ts:16` | 改 leading + trailing：首个变更立即派发，静默期结束后补发最终态 | done |
| SM-114 | P2 | doc-inline 观察器监听 `document.body` 全子树 childList，击键/滚动均触发刷新；每次刷新对每个 protyle `getComputedStyle×8` 并无条件重写样式 | `docInlineAttrs.ts:75/123` | MutationRecord 相关性预过滤（wysiwyg 内部内容变更不调度）；样式签名比对，未变化不写 | done |
| SM-115 | P2 | `loadBindingBlocks` 的 loading 哨兵守卫条件写反：loading 态二次点击会重复请求 | `useNotebookDbStats.ts:173` | 守卫改为「任意已缓存状态（含 loading）即返回」 | done |
| SM-116 | P2 | `suggestCustomValues` 的 SQL 直接拼接属性名，外部/历史含引号键会使查询失败（被 catch 吞掉，联想静默为空），与 `sqlLiteral` 统一转义规范不一致 | `autocomplete.ts:247` | 改经 `sqlLiteral` 转义 | done |
| SM-117 | P2 | 下钻缓存 `valueBlocksCache`/`expandedValueKeys` 在统计重载后不失效，批量编辑后展示旧数据 | `NotebookAttrStats.vue:492` | 统计重载时清空下钻缓存与展开态 | done |
| SM-118 | P2 | 批量块写入（25/批 allSettled）失败静默：仅折算进成功计数，无失败反馈 | `useNotebookAttrStats.ts:109` | 返回 `{ok, failed}` 聚合，调用方在 failed > 0 时提示部分失败 | done |
| SM-119 | P3 | 模式切换瞬间 drain 后才检查方向，反向 pending 被静默丢弃 | `useAvSync.ts:320/391` | 行为本身符合单向模式语义（该方向本不应传播），仅补注释说明，不改代码 | done |
| SM-120 | P3 | `saveSettings` await saveData 期间到达的广播会触发 `loadSettings` 从磁盘读到旧值，短暂覆盖刚写入的运行时设置（自愈但存在闪变） | `index.ts:135/150` | loadSettings 等待在途保存完成后再读盘 | done |
| SM-121 | P3 | AttrTemplates 仍保留两套内联下拉状态机（150ms blur 定时器），与已收敛的 `useSuggestDropdown`/`useDropdown` 重复 | `AttrTemplates.vue:474/524` | 迁移需重排列表编辑交互（逐输入框实例化 composable），行为级改动风险高，**推迟为独立任务** | deferred |
| SM-122 | P3 | AttrSection 折叠态同 storageKey 在 dock/inline/mobile 实例间互不同步（各自持 ref，仅挂载时读 localStorage） | `AttrSection.vue:32` | 折叠态收敛为模块级共享 store + localStorage 写穿 | done |
| SM-123 | P3 | `editorClickHandled` 微任务旗标与事件派发时序经复核为正确（capture 先于冒泡、事件派发同步完成、rAF 复查窗口足够），仅记录结论不改代码 | `useCurrentBlock.ts:73` | 无需修改 | done |

## 3. 执行日志

> 验证基线：修复前 `npm test` 277/277；修复后 **294/294**（新增 17 项单测），
> `npm run build` 与 package.zip 校验通过，tsc 涉改文件 0 报错
> （全量 14 处为存量基线）。eslint 无门禁（仓库存量 415+ 处），仅要求新增文件干净。

| ID | 日期 | 提交 | 验证 | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 文档落盘 | 2026-11-17 | 68f0311 | 基线 277/277 | pass | 12 组状态机清单 + SM-101~SM-123 修复计划 |
| SM-103/109/112/119 | 2026-11-17 | 175e5b3 | `avSyncFlush.test.ts` 7/7、全量 284/284 | pass | 冲刷单飞串行 + 溢出回灌 + 逐库状态归因；规划层抽为 kernel-free 纯函数 |
| SM-101 | 2026-11-17 | b12172b | 全量 284/284、tsc 涉改 0 报错 | pass | renameAttrKeyEverywhere 统一四方协调，4 入口接入 |
| SM-102/104/115/117 | 2026-11-17 | e99c677 | 全量 284/284 | pass | 统计 composable 乱序守卫；boxId 缓存随文档切换失效；下钻缓存清理 |
| SM-105/110/120 | 2026-11-17 | 98d61a9 | `persistenceDirtyGate.test.ts` 2/2、全量 286/286 | pass | 三个持久化单例 dirty 门闩；disposeSchemas/disposeTemplates；loadSettings 等待在途保存 |
| SM-107 | 2026-11-17 | e00ffd5 | `attrLocalState.test.ts` 4/4、全量 290/290 | pass | 写链按块串行；「最新写」条件回滚/条件删除 |
| SM-108/122 | 2026-11-17 | c964417 | 全量 290/290 | pass | AttrRow 保存终态由保存完成驱动；AttrSection 折叠态跨实例共享 |
| SM-106 | 2026-11-17 | 6202e8a | 全量 290/290 | pass | 引用计数绑定；pendingJump 清理；rAF 顺序一步到位 |
| SM-114 | 2026-11-17 | 6ab9c6a | `docInlineAttrs.test.ts` 5/5、全量 291/291 | pass | MutationRecord 相关性预过滤；标题样式签名跳过 |
| SM-111/113/116/118 | 2026-11-17 | 63df75e | `attrsChangedBus.test.ts` 3/3、全量 294/294 | pass | 广播 leading+trailing；批量写 {ok, failed} 聚合；建库失败短重试；联想 SQL 转义 |
| 状态刷新 | 2026-11-17 | e36a33f | 全量 294/294、build 通过 | pass | 全部条目收口：22 done、1 deferred（SM-121）、1 审计结论（SM-123） |
| 遗留收敛 | 2026-11-17 | （待提交） | 全量 294/294、build 通过 | pass | 补齐 flushAttrs 溢出回灌；四方改写全失败中断保护；useCurrentBlock 引用计数下溢防御；模板定时器卸载清理 |

## 4. 审计中确认健康的设计（无需改动）

- `useSuggestDropdown` 的 seq 乱序守卫、`useInlineEdit` 的 200ms 失焦豁免、`useDropdown` 的 nextTick 延迟挂监听——三个控件状态机语义自洽。
- `useBlockAttrs` 的 loadToken、`chainWrite` 的 settle 自清理、`nextCurrentBlockState` 纯转移函数——模式良好，本次仅推广复用。
- avSync 的环路防护体系（echo token、budget、kernel-managed 键黑名单、AV 写不产生 op）设计有效，问题集中在冲刷并发与状态归因，不在环路上。
- `avSyncOps`/`avSyncIndex`/`avValueCodec`/`avSyncRegistry`/`batchRefactor` 纯函数抽取 + 单测是本仓库的测试样板，本次修复沿用该模式。
