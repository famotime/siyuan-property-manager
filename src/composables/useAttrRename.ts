/**
 * 属性重命名的四方统一协调器（SM-101）。
 *
 * 属性键重命名牵涉四处状态，任何一处遗漏都会留下不一致：
 * 1. 块数据（`custom-<old>` → `custom-<new>`，可选——通常按笔记本批量改写，
 *    面板行内重命名只改当前块、不走这里）
 * 2. Schema 类型配置（`useAttrSchema`）
 * 3. 属性模板（`useTemplates`）
 * 4. AV 双向同步登记表 mapping（`useAvSync`）
 *
 * 历史上 4 个入口（面板行内重命名、SchemaManager、笔记本统计、批量重构工作台）
 * 各自编排，其中面板行内重命名与 SchemaManager 漏掉了 templates/registry：
 * 登记表 mapping 仍指向旧键时，AV 单元格编辑会把旧键写回块（「复活」已改名
 * 属性），模板应用也会重建旧键。现全部收敛到本函数。
 *
 * 执行顺序：块数据改写最先执行（失败即中断、三处元数据不动，保持可重试）；
 * 元数据迁移随后依次执行（均为廉价的内存/本地操作）。
 */

import { useAttrSchema } from '@/composables/useAttrSchema'
import { useAvSync } from '@/composables/useAvSync'
import { useTemplates } from '@/composables/useTemplates'

export interface RenameEverywhereResult {
  /** 改写成功的块数（未请求改写时为 0）。 */
  blocksRewritten: number
  /** Schema 类型配置是否发生迁移。 */
  schemaRenamed: boolean
  /** 模板中被改写的属性条目数。 */
  templatesRenamed: number
  /** 登记表 mapping 中被改写的列数。 */
  registryRenamed: number
}

export async function renameAttrKeyEverywhere(
  oldKey: string,
  newKey: string,
  opts: {
    /**
     * 块数据改写（最先执行）。返回改写块数；抛出异常时整体中断、元数据不动。
     * 不提供时仅迁移三处元数据（例如面板行内重命名：块由调用方先行改写）。
     */
    rewriteBlocks?: () => Promise<number>
    /** Schema 迁移时携带的新显示备注（透传给 `renameSchema`）。 */
    schemaLabel?: string
  } = {},
): Promise<RenameEverywhereResult> {
  let blocksRewritten = 0
  if (opts.rewriteBlocks)
    blocksRewritten = await opts.rewriteBlocks()

  const schemaRenamed = useAttrSchema().renameSchema(oldKey, newKey, opts.schemaLabel)
  const templatesRenamed = useTemplates().renameAttrKeyInTemplates(oldKey, newKey)
  const registryRenamed = useAvSync().renameAttrKeyInAvSync(oldKey, newKey)

  return {
    blocksRewritten,
    schemaRenamed,
    templatesRenamed,
    registryRenamed,
  }
}
