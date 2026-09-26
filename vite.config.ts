/* eslint-disable node/prefer-global/process */
import fs from "node:fs"
import path, { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import fg from "fast-glob"
import minimist from "minimist"
import livereload from "rollup-plugin-livereload"
import {
  defineConfig,
  loadEnv,
} from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"
import zipPack from "vite-plugin-zip-pack"

const pluginInfo = require("./plugin.json")

/**
 * 自动同步插件产物至思源工作空间目录，并清理残留 .cjs 碎片文件
 */
function syncToSiyuanPlugin(targetDir: string) {
  return {
    name: "sync-to-siyuan",
    closeBundle() {
      if (!targetDir || !fs.existsSync(path.dirname(targetDir))) {
        return
      }
      try {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }
        // 清理目标目录中的所有遗留 .cjs 文件，杜绝模块加载冲突
        const files = fs.readdirSync(targetDir)
        for (const file of files) {
          if (file.endsWith(".cjs")) {
            fs.unlinkSync(path.join(targetDir, file))
          }
        }
        // 复制 dist 下所有最新产物至思源工作空间插件目录
        if (fs.existsSync("./dist")) {
          const distFiles = fs.readdirSync("./dist")
          for (const file of distFiles) {
            const srcPath = path.join("./dist", file)
            const destPath = path.join(targetDir, file)
            fs.cpSync(srcPath, destPath, {
              recursive: true,
              force: true,
            })
          }
          console.log(`\n[Sync] 成功将最新单文件插件同步至思源插件目录:\n${targetDir}`)
        }
      } catch (err) {
        console.warn("\n[Sync] 同步插件至思源目录时出现警告:", err)
      }
    },
  }
}

export default defineConfig(({
  mode,
}) => {
  const env = loadEnv(mode, process.cwd())
  const {
    VITE_SIYUAN_WORKSPACE_PATH,
  } = env

  const siyuanWorkspacePath = VITE_SIYUAN_WORKSPACE_PATH
  let devDistDir = ""
  if (siyuanWorkspacePath) {
    devDistDir = `${siyuanWorkspacePath}/data/plugins/${pluginInfo.name}`
  }

  const args = minimist(process.argv.slice(2))
  const isWatch = args.watch || args.w || false
  const distDir = "./dist"

  return {
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },

    plugins: [
      vue(),
      viteStaticCopy({
        targets: [
          {
            src: "./README*.md",
            dest: "./",
          },
          {
            src: "./icon.*",
            dest: "./",
          },
          {
            src: "./preview.*",
            dest: "./",
          },
          {
            src: "./plugin.json",
            dest: "./",
          },
          {
            src: "./src/i18n/**",
            dest: "./i18n/",
          },
        ],
      }),
      syncToSiyuanPlugin(devDistDir),
    ],

    define: {
      "process.env.DEV_MODE": `"${isWatch}"`,
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    },

    build: {
      outDir: distDir,
      emptyOutDir: true,
      sourcemap: false,
      minify: !isWatch,

      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        fileName: () => "index.js",
        formats: ["cjs"],
      },
      rollupOptions: {
        plugins: [
          ...(isWatch
            ? [
                livereload(devDistDir || distDir),
                {
                  name: "watch-external",
                  async buildStart() {
                    const files = await fg([
                      "src/i18n/*.json",
                      "./README*.md",
                      "./plugin.json",
                    ])
                    for (const file of files) {
                      this.addWatchFile(file)
                    }
                  },
                },
              ]
            : [
                zipPack({
                  inDir: "./dist",
                  outDir: "./",
                  outFileName: "package.zip",
                }),
              ]),
        ],

        external: ["siyuan", "process"],

        output: {
          entryFileNames: "index.js",
          inlineDynamicImports: true,
          exports: "auto",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith(".css")) {
              return "index.css"
            }
            return assetInfo.name || "index.css"
          },
        },
      },
    },
  }
})
