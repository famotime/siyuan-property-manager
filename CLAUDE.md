# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

思源笔记插件（Block Property Manager / 块属性管理器），在右侧栏 Dock 面板中实时展示并编辑当前聚焦块的属性。基于 Vue 3 + TypeScript + Vite 构建。

## 常用命令

```bash
npm install                  # 安装依赖
npm run dev                  # 开发模式（热重载，需在 .env 设置 VITE_SIYUAN_WORKSPACE_PATH）
npm run build                # 生产构建，输出到 dist/，自动生成 package.zip
npm run release              # 交互式版本发布（更新 plugin.json/package.json 版本号 → git tag → push）
npm run release:patch        # 直接 patch 版本发布
npm run release:minor        # 直接 minor 版本发布
npm run release:major        # 直接 major 版本发布
```

**开发环境配置**：复制 `.env.example` 为 `.env`，将 `VITE_SIYUAN_WORKSPACE_PATH` 设为思源工作空间路径，`npm run dev` 会将构建产物直接输出到 `data/plugins/siyuan-property-manager/`。

**Lint**：使用 `@antfu/eslint-config`，配置见 `eslint.config.mjs`。关键规则：2 空格缩进、单引号、Vue 模板在前 script 在后、对象属性换行（multiline 需逐行写）。注意配置中引用了 `./src/utils/eslint/i18n-validate-keys.mjs` 但该文件尚未创建。

## 架构

### 插件生命周期

```
src/index.ts  (Plugin 子类)
  └─ onload() → this.addDock() → dock.init() 调用 mountPanel()
     └─ src/main.ts  mountPanel(host) → createApp(App).provide('plugin', ...).mount(host)
  └─ dock.destroy() → unmountPanel(host) → app.unmount()
```

插件实例通过 Vue `provide/inject` 向所有子组件注入（key = `'plugin'`），组件内通过 `inject<Plugin>('plugin')` 获取。这是访问 i18n、eventBus 等插件能力的唯一通道。

### 数据流（核心三件套）

1. **`useCurrentBlock(plugin)`** (`src/composables/useCurrentBlock.ts`)
   - 监听 `click-editorcontent` / `switch-protyle` / `loaded-protyle-static` / `destroy-protyle` 四个事件
   - 通过 `findBlockIdFromEvent()` 从 DOM 事件中解析块 ID（优先 `[data-node-id]`，其次 `.protyle-title`，最后 rootID）
   - 用 `requestAnimationFrame` 去抖，模块级单例（多个 dock 实例共享同一个响应式引用）

2. **`useBlockAttrs(blockIdRef)`** (`src/composables/useBlockAttrs.ts`)
   - 响应 blockIdRef 变化，调用 `/api/attr/getBlockAttrs` 拉取属性
   - 使用 `loadToken` 单调递增防止旧请求覆盖新数据
   - 乐观更新：先写本地缓存，失败时回滚
   - 同一 key 的写入通过 `chainWrite()` 串行化（Promise 链），防止乱序覆盖

3. **属性分类规则** (`src/constants/attrs.ts`)
   - `custom-` 前缀 → 自定义属性（可编辑、可删除）
   - 其余 → 内部属性，其中 `READONLY_INTERNAL_KEYS`（id/type/updated/created/box/path 等）只读
   - `ALWAYS_SHOW_INTERNAL_KEYS`（name/alias/memo/bookmark/title/tags）即使服务端未返回也以空行渲染

### 组件结构

```
App.vue → PropertyPanel.vue (主面板)
             ├─ AttrSection.vue (可折叠分组，状态持久化到 localStorage)
             │    └─ AttrRow.vue (单行：展示态 ↔ 编辑态切换，blur 即保存)
             └─ AddCustomRow.vue (自定义属性新增行)
```

### API 层

`src/api.ts` 是从 siyuan 插件模板复制的全量 Kernel API 封装。**当前插件实际只用到 `getBlockAttrs` 和 `setBlockAttrs` 两个函数**（从 `@/api` 导入），其余函数（notebook、filetree、block CRUD 等）暂未使用。

### 类型定义

- `src/types/index.d.ts` — 全局类型（BlockId、Block、BlockType 等），基于 frostime 模板，挂载到全局作用域无需 import
- `src/types/api.d.ts` — API 响应类型
- `src/types/vue-shim.d.ts` — Vue SFC 类型声明

### 样式

`src/index.scss` 包含所有组件样式。CSS 类名使用 `spm-` 前缀（siyuan-property-manager 缩写），BEM 风格。面板自带思源主题适配组件（`src/components/SiyuanTheme/` 下的 SyButton、SyInput 等）但当前未在主流程中使用。

### i18n

翻译文件在 `src/i18n/{zh_CN,en_US}.json`，通过思源插件内置的 `this.i18n` 机制加载。组件内通过 `plugin.i18n[key]` 取值。`plugin.json` 中的 `displayName` 和 `description` 也需同步维护多语言。

## 开发注意事项

- Vite 构建为 CJS 格式（`lib.formats: ['cjs']`），`siyuan` 和 `process` 被 externalize 不打入 bundle
- 生产构建自动打包 `package.zip`（`vite-plugin-zip-pack`），开发模式使用 `livereload` 热更新
- `tsconfig.json` 中 `strict: false`，`@/*` 路径别名映射到 `./src/*`
- `release.js` 会同时更新 `plugin.json` 和 `package.json` 的版本号，创建 git tag 并推送
- `plugin-sample-vite-vue/` - 官方思源插件开发样板项目
- `developer_docs/` - 思源插件开发 API 参考文档