/**
 * 「按模板建库」编排：从选中块创建思源原生属性视图数据库并回填属性值。
 *
 * 从 `AttrTemplateGroups.vue` 抽出的 7 步流程（内核依据见
 * `docs/属性与数据库双向同步方案与实施计划.md`）：
 * putFile AV JSON → insertBlock → 等待索引 → addAttributeViewBlocks →
 * SQL 查已有属性 → batchSet 回填 → 登记同步注册表。
 * 纯 JSON 构建在 `@/utils/avDatabaseJson`（有单元测试）。
 */

import { addAttributeViewBlocks, batchSetAttributeViewBlockAttrs, insertBlock, putFile, sql } from '@/api'
import { buildAvBackfillAttrsQuery } from '@/composables/attrStatsSql'
import { useAttrSchema } from '@/composables/useAttrSchema'
import { useAvSync } from '@/composables/useAvSync'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { buildAvJsonWithAttrs } from '@/utils/avDatabaseJson'
import { encodeIalToAvCell } from '@/utils/avValueCodec'
import { avSyncWarn } from '@/utils/logger'
import { generateSiyuanId } from '@/utils/siyuanId'

export interface CreateAvDatabaseOptions {
  templateName: string
  templateAttrs: Array<{ key?: string | null }>
  blocks: Array<{ id: string }>
  /** 插入锚点：二选一，同 insertBlock 语义。 */
  previousID?: string
  parentID?: string
  /** 组件注入的 i18n 函数（保持本模块无 UI 依赖）。 */
  t: (key: string) => string
}

/** 行记录 ID 由调用方自带，内核会原样采用（`kernel/model/attribute_view.go:6115-6131`）。 */
export async function createAvDatabaseFromBlocks(options: CreateAvDatabaseOptions): Promise<string> {
  const { templateName, templateAttrs, blocks, previousID, parentID, t } = options

  // ── 步骤 1：提取模板属性 key（规范化为 custom- 前缀）──
  const attrKeys: string[] = templateAttrs.map((a) => {
    const k: string = a.key || ''
    return k.startsWith(CUSTOM_KEY_PREFIX) ? k : `${CUSTOM_KEY_PREFIX}${k}`
  })

  // ── 步骤 2：生成 avID 并构建含属性列的 AV JSON ──
  const { resolveAttrType, getSchema } = useAttrSchema()
  const avID = generateSiyuanId()
  const { json: avJson, keyIdMap, columnTypeMap } = buildAvJsonWithAttrs(avID, attrKeys, {
    dbName: templateName,
    primaryKeyName: t('avPrimaryKey'),
    tableViewName: t('avTableView'),
    resolveType: fullKey => resolveAttrType(fullKey, ''),
    getOptions: fullKey => getSchema(fullKey)?.options ?? [],
  })
  const putOk = await putFile(`/data/storage/av/${avID}.json`, avJson)
  if (!putOk) {
    throw new Error(t('writeAttributeViewFailed'))
  }

  // ── 步骤 3：插入 NodeAttributeView 块 ──
  // 先插入块以便让思源内核感知此 avID 并在内存中建立索引映射
  const insertResult = await insertBlock({
    dataType: 'dom',
    data: `<div data-type="NodeAttributeView" data-av-id="${avID}" data-av-type="table"></div>`,
    previousID,
    parentID,
  })
  if (!insertResult) {
    throw new Error(t('insertDatabaseBlockFailed'))
  }

  // ── 步骤 4/5：批量绑定选中的块 ──
  // 以「失败短重试」替代原先固定 300ms 休眠（SM-111）：内核完成新块索引前
  // addAttributeViewBlocks 可能失败，快路径立即成功，慢路径按 200ms 退避重试
  const srcs = blocks.map(b => ({
    id: b.id,
    isDetached: false,
    itemID: generateSiyuanId(),
  }))

  const MAX_BIND_ATTEMPTS = 5
  const BIND_RETRY_DELAY_MS = 200
  let bindOk = false
  let bindError: unknown = null
  for (let attempt = 1; attempt <= MAX_BIND_ATTEMPTS && !bindOk; attempt++) {
    try {
      await addAttributeViewBlocks({ avID, srcs })
      bindOk = true
    }
    catch (err) {
      bindError = err
      if (attempt < MAX_BIND_ATTEMPTS)
        await new Promise<void>(resolve => setTimeout(resolve, BIND_RETRY_DELAY_MS))
    }
  }
  if (!bindOk) {
    throw bindError instanceof Error
      ? bindError
      : new Error(t('bindAttributeViewBlocksFailed'))
  }

  const rowIdByBlock: Record<string, string> = {}
  for (const src of srcs)
    rowIdByBlock[src.id] = src.itemID

  // ── 步骤 6：查询已有属性值并按列类型回填 ──
  if (attrKeys.length > 0 && blocks.length > 0) {
    const attrRows = await sql(buildAvBackfillAttrsQuery(blocks.map(b => b.id), attrKeys))

    if (Array.isArray(attrRows) && attrRows.length > 0) {
      const batchValues: Array<{ keyID: string, itemID: string, value: Record<string, unknown> }> = []
      for (const row of attrRows) {
        const attrKey = row.name as string
        const keyID = keyIdMap[attrKey]
        const itemID = rowIdByBlock[row.block_id as string]
        // 映射缺失时跳过，绝不拿块 ID 冒充行记录 ID
        if (!keyID || !itemID) {
          avSyncWarn('建表回填跳过：缺少列或行映射', { attrKey, blockID: row.block_id })
          continue
        }
        if (row.value == null)
          continue
        const cell = encodeIalToAvCell(columnTypeMap[attrKey] || 'text', String(row.value))
        if (!cell)
          continue
        batchValues.push({ keyID, itemID, value: cell })
      }
      if (batchValues.length > 0) {
        await batchSetAttributeViewBlockAttrs({ avID, values: batchValues })
      }
    }
  }

  // ── 步骤 7：登记到双向同步注册表（默认开启，可在数据库卡片上关闭）──
  const mapping: Record<string, string> = {}
  for (const attrKey of Object.keys(keyIdMap))
    mapping[keyIdMap[attrKey]] = attrKey
  useAvSync().registerDatabase(avID, templateName, mapping)

  return avID
}
