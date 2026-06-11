# 项目结构

思源笔记插件（Block Property Manager / 块属性管理器），在右侧栏 Dock 面板和文档内联区域实时展示并编辑当前聚焦块的属性。

## 技术栈

- Vue 3 + TypeScript + Vite
- 输出格式：CJS（`siyuan` 和 `process` 外部化）
- 测试：Node.js 内置 test runner + tsx

## 目录结构

```
src/
├── index.ts                    # 插件入口，Plugin 子类，注册 Dock 和生命周期
├── main.ts                     # Vue 应用挂载/卸载（WeakMap 防重复挂载）
├── docInlineAttrs.ts           # MutationObserver 驱动的文档内联属性面板管理
├── api.ts                      # 思源内核 API 封装（getBlockAttrs/setBlockAttrs/sql/getBlockInfo/getBlockKramdown）
├── settings.ts                 # 插件设置（属性统计日志开关）
├── index.scss                  # 全部组件样式（spm- 前缀，BEM 风格）
│
├── composables/                # Vue 组合式函数
│   ├── useCurrentBlock.ts      # 监听编辑器事件，跟踪当前聚焦块（模块级单例）
│   ├── useBlockAttrs.ts        # 属性 CRUD + 乐观更新 + chainWrite 串行化 + 跨实例同步
│   ├── useAttrPanel.ts         # 属性面板共享逻辑（i18n/rowRefs/事件处理/跨实例同步）
│   ├── useAttrStats.ts         # 属性统计查询（SQL）+ 批量编辑/删除
│   ├── attrStatsSql.ts         # 纯函数：SQL 查询构建器和数据转换
│   └── useTemplates.ts         # 自定义属性模板 CRUD（localStorage 持久化）
│
├── components/                 # Vue 单文件组件
│   ├── PropertyPanel.vue       # Dock 面板主组件（编辑/统计双 Tab）
│   ├── DocInlineAttrs.vue      # 文档内联属性面板（标题与正文之间）
│   ├── AttrSection.vue         # 可折叠分组（状态持久化到 localStorage）
│   ├── AttrRow.vue             # 单行属性（展示态 ↔ 编辑态切换，blur 即保存）
│   ├── AddCustomRow.vue        # 自定义属性新增行
│   ├── AttrStats.vue           # 属性统计面板（文档块列表 + 笔记本属性分布）
│   └── AttrTemplates.vue       # 自定义属性模板管理（卡片式 UI）
│
├── constants/
│   └── attrs.ts                # 属性分类规则（readonly/always-show/custom-prefix）+ 验证函数
│
├── utils/
│   ├── dom.ts                  # DOM 工具：findBlockIdFromEvent、isMultiline、shortBlockId、formatTimestamp
│   ├── blockJump.ts            # 块跳转：CSS 选择器构建、滚动定位
│   ├── currentBlockState.ts    # 纯函数：当前块状态转换
│   ├── docInlineAttrs.ts       # 纯函数：内联属性面板挂载计划解析
│   └── logger.ts               # 条件日志（属性统计诊断）
│
├── types/
│   ├── index.d.ts              # 全局类型声明（BlockId、Block、Notebook 等）
│   ├── api.d.ts                # API 响应类型
│   └── vue-shim.d.ts           # Vue SFC 类型声明
│
└── i18n/
    ├── zh_CN.json              # 简体中文翻译（64 keys）
    └── en_US.json              # 英文翻译（64 keys）

tests/
├── attrStatsSql.test.ts        # SQL 查询构建器测试（13 cases）
├── attrs.test.ts               # 属性分类函数测试（7 cases）
├── blockJump.test.ts           # 块跳转工具测试（3 cases）
├── currentBlockState.test.ts   # 块状态转换测试（3 cases）
├── docInlineAttrs.test.ts      # 内联属性挂载计划测试（4 cases）
├── dom.test.ts                 # DOM 工具测试（11 cases）
├── logger.test.ts              # 条件日志测试（2 cases）
└── settings.test.ts            # 设置测试（2 cases）
```

## 核心数据流

```
编辑器点击/切换 → useCurrentBlock（事件监听 + 去抖）
                → currentBlockId 变化
                → useBlockAttrs（API 拉取 + 乐观更新）
                → internalAttrs / customAttrs（计算属性）
                → PropertyPanel / DocInlineAttrs（渲染）

属性修改 → writeAttr（乐观更新本地 + setBlockAttrs API）
        → spm:attrs-changed 事件
        → 其他 useBlockAttrs 实例 reload()
```

## 测试

```bash
npm test              # 运行全部测试（47 cases）
```

测试框架：Node.js 内置 `node:test`，运行器：`tsx --test`。
