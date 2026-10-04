<template>
  <AttrSection
    :title="t('templateGrouping')"
    storage-key="stats-template-groups"
    :default-open="false"
  >
    <div v-if="templates.length === 0" class="spm-stats__empty">
      {{ t('templatesEmpty') }}
    </div>
    <div v-else class="spm-template-groups">
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="spm-template-groups__card"
      >
        <!-- 模板头部 -->
        <div class="spm-template-groups__card-header">
          <span class="spm-template-groups__card-title">{{ tpl.name }}</span>
          <span class="spm-template-groups__card-badge">
            {{ tpl.attrs.length }}{{ t('addProperty').replace(t('addProperty'), '') }}
          </span>
          <button
            class="spm-template-groups__filter-btn"
            type="button"
            @click="toggleFilter(tpl)"
          >
            {{ t('filterBlocks') }}
          </button>
        </div>

        <!-- 模板属性只读列表与排序 -->
        <div class="spm-template-groups__attrs-list">
          <div
            v-for="(attr, index) in tpl.attrs"
            :key="attr.key"
            class="spm-template-groups__attr-item"
          >
            <span class="spm-template-groups__attr-key" :title="attr.key">
              {{ attr.key.startsWith(CUSTOM_KEY_PREFIX) ? attr.key.slice(CUSTOM_KEY_PREFIX.length) : attr.key }}
            </span>
            <span class="spm-template-groups__attr-val" :title="attr.value || '·'">
              {{ attr.value || '·' }}
            </span>
            <!-- 排序按钮 -->
            <div class="spm-template-groups__sort-actions">
              <button
                class="spm-template-groups__sort-btn"
                type="button"
                :disabled="index === 0"
                @click="moveAttr(tpl.id, index, -1)"
                :title="t('moveUp')"
              >
                <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
              <button
                class="spm-template-groups__sort-btn"
                type="button"
                :disabled="index === tpl.attrs.length - 1"
                @click="moveAttr(tpl.id, index, 1)"
                :title="t('moveDown')"
              >
                <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 筛选结果展示区 -->
        <div
          v-if="activeFilterTplId === tpl.id"
          class="spm-template-groups__filter-area"
        >
          <!-- 筛选控制栏 -->
          <div class="spm-template-groups__control-bar">
            <!-- 范围选择 -->
            <div class="spm-template-groups__range-select">
              <span class="spm-template-groups__label">{{ t('searchRange') }}:</span>
              <select
                v-model="searchScope"
                class="spm-stats__select"
                @change="runFilter(tpl)"
              >
                <option value="notebook">{{ t('currentNotebook') }}</option>
                <option value="doc">{{ t('currentDocOnly') }}</option>
              </select>
            </div>
            <!-- 全选框 -->
            <label v-if="filteredBlocks.length > 0" class="spm-template-groups__select-all">
              <input
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate="isPartiallySelected"
                @change="toggleSelectAll"
              >
              <span>{{ t('selectAll') }}</span>
            </label>
          </div>

          <!-- 加载中 -->
          <div v-if="filterLoading" class="spm-stats__empty">
            {{ t('loading') }}
          </div>

          <!-- 筛选结果为空 -->
          <div v-else-if="filteredBlocks.length === 0" class="spm-stats__empty">
            {{ t('noMatchedBlocks') }}
          </div>

          <!-- 筛选列表 -->
          <div v-else class="spm-template-groups__block-list">
            <div
              v-for="block in filteredBlocks"
              :key="block.id"
              class="spm-template-groups__block-item"
              @click="jumpToBlock(block)"
            >
              <div class="spm-template-groups__block-head">
                <input
                  type="checkbox"
                  class="spm-template-groups__block-checkbox"
                  :checked="selectedBlockIds.has(block.id)"
                  @change.stop="toggleSelectBlock(block.id)"
                >
                <span class="spm-stats__block-type">{{ block.type }}</span>
                <code class="spm-stats__block-id">{{ shortBlockId(block.id) }}</code>
              </div>
              <div class="spm-template-groups__block-content" :title="block.content">
                {{ block.content || t('emptyBlockContent') }}
              </div>
              <div class="spm-template-groups__block-path" :title="block.hpath">
                {{ block.hpath }}
              </div>
            </div>

            <!-- 创建数据库按钮 -->
            <div class="spm-template-groups__action-bar">
              <button
                class="spm-template-groups__db-btn"
                type="button"
                :disabled="selectedBlockIds.size === 0 || creatingDb"
                @click="createDatabaseFromSelection(tpl)"
              >
                {{ creatingDb ? t('savingHint') : t('createDatabase') }} ({{ selectedBlockIds.size }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AttrSection>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, ref, watch } from 'vue'
import { showMessage } from 'siyuan'
import { useTemplates } from '@/composables/useTemplates'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { getBlockInfo, sql, insertBlock, addAttributeViewBlocks, batchSetAttributeViewBlockAttrs, putFile, getFile } from '@/api'
import { shortBlockId } from '@/utils/dom'
import { highlightBlock, isDocOpened, scrollOpenedDocToBlock } from '@/utils/blockJump'
import AttrSection from './AttrSection.vue'

const props = defineProps<{
  rootId: string | null
  blockId: string | null
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

const { templates } = useTemplates()

const activeFilterTplId = ref<string | null>(null)
const filterLoading = ref(false)
const searchScope = ref<'notebook' | 'doc'>('notebook')

interface FilteredBlock {
  id: string
  content: string
  hpath: string
  type: string
}

const filteredBlocks = ref<FilteredBlock[]>([])
const selectedBlockIds = ref<Set<string>>(new Set())
const creatingDb = ref(false)

// 当前定位到的 boxID 和 docBlockID
const currentBoxId = ref<string | null>(null)
const currentDocBlockId = ref<string | null>(null)

// 监听 props 变化，解析出笔记本 ID 和当前文档 ID
watch(
  () => props.rootId || props.blockId,
  async (seedId) => {
    if (!seedId) return
    try {
      const info = await getBlockInfo(seedId)
      if (info) {
        currentBoxId.value = info.box || null
        currentDocBlockId.value = info.rootID || null
      }
    } catch {
      // 忽略解析错误
    }
  },
  { immediate: true }
)


// 全选状态计算
const isAllSelected = computed(() => {
  if (filteredBlocks.value.length === 0) return false
  return filteredBlocks.value.every((b) => selectedBlockIds.value.has(b.id))
})

const isPartiallySelected = computed(() => {
  if (filteredBlocks.value.length === 0) return false
  const selectedCount = filteredBlocks.value.filter((b) => selectedBlockIds.value.has(b.id)).length
  return selectedCount > 0 && selectedCount < filteredBlocks.value.length
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    filteredBlocks.value.forEach((b) => selectedBlockIds.value.delete(b.id))
  } else {
    filteredBlocks.value.forEach((b) => selectedBlockIds.value.add(b.id))
  }
}

function toggleSelectBlock(id: string) {
  if (selectedBlockIds.value.has(id)) {
    selectedBlockIds.value.delete(id)
  } else {
    selectedBlockIds.value.add(id)
  }
}

// 属性排序函数（支持永久保存）
function moveAttr(tplId: string, index: number, direction: number) {
  const tpl = templates.value.find((t) => t.id === tplId)
  if (!tpl) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= tpl.attrs.length) return

  // 交换数组元素
  const temp = tpl.attrs[index]
  tpl.attrs[index] = tpl.attrs[targetIndex]
  tpl.attrs[targetIndex] = temp
}

// 触发筛选面板显示/隐藏
function toggleFilter(tpl: any) {
  if (activeFilterTplId.value === tpl.id) {
    activeFilterTplId.value = null
    filteredBlocks.value = []
    selectedBlockIds.value.clear()
  } else {
    activeFilterTplId.value = tpl.id
    runFilter(tpl)
  }
}

// 执行 SQL 筛选匹配的块
async function runFilter(tpl: any) {
  if (!tpl || tpl.attrs.length === 0) {
    filteredBlocks.value = []
    selectedBlockIds.value.clear()
    return
  }

  filterLoading.value = true
  filteredBlocks.value = []
  selectedBlockIds.value.clear()
  try {
    const effectiveAttrs = tpl.attrs.filter((a: any) => a.key && (a.value !== '' || tpl.attrs.length === 1))
    const keys = (effectiveAttrs.length > 0 ? effectiveAttrs : tpl.attrs).map((a: any) => {
      const k = a.key || ''
      return k.startsWith(CUSTOM_KEY_PREFIX) ? k : `${CUSTOM_KEY_PREFIX}${k}`
    })
    const keysSqlString = keys.map((k: string) => `'${k}'`).join(',')
    const keysCount = keys.length

    let scopeFilter = ''
    if (searchScope.value === 'doc') {
      if (!currentDocBlockId.value) {
        throw new Error(t('currentDocIdMissing'))
      }
      scopeFilter = `b.root_id = '${currentDocBlockId.value}'`
    } else {
      if (!currentBoxId.value) {
        throw new Error(t('currentNotebookIdMissing'))
      }
      scopeFilter = `b.box = '${currentBoxId.value}'`
    }

    const query = `
      SELECT b.id, b.content, b.hpath, b.type
      FROM blocks AS b
      JOIN (
          SELECT block_id
          FROM attributes
          WHERE name IN (${keysSqlString})
          GROUP BY block_id
          HAVING count(distinct name) = ${keysCount}
      ) AS t ON b.id = t.block_id
      WHERE ${scopeFilter}
      ORDER BY b.updated DESC
      LIMIT 100
    `

    const rawRows = await sql(query)
    if (Array.isArray(rawRows)) {
      filteredBlocks.value = rawRows.map((row: any) => ({
        id: row.id,
        content: row.content,
        hpath: row.hpath,
        type: row.type || 'p',
      }))
      // 默认全选
      filteredBlocks.value.forEach((b) => selectedBlockIds.value.add(b.id))
    }
  } catch (err: any) {
    showMessage(err.message || t('filterFailed'), 5000, 'error')
  } finally {
    filterLoading.value = false
  }
}

// 块跳转逻辑
async function jumpToBlock(block: FilteredBlock) {
  const isOpened = isDocOpened(block.id)
  if (isOpened) {
    scrollOpenedDocToBlock(block.id)
    highlightBlock(block.id)
  } else {
    // 强制跳转
    await window.siyuan.blockPanels.showBlock({
      id: block.id,
    })
  }
}

// 生成符合思源标准风格的 ID (格式: YYYYMMDDHHmmss-random)
function generateSiyuanId(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${yyyy}${MM}${dd}${hh}${mm}${ss}`
  const randomStr = Math.random().toString(36).slice(2, 9)
  return `${timestamp}-${randomStr}`
}

/**
 * 构建含模板属性列的 AV JSON（spec=4）。
 * - 第一列固定为 block 主键列
 * - attrKeys 中每个属性名对应一个 text 文本列
 * 返回序列化后的 JSON 字符串，以及「属性全名 → keyID」映射（用于后续回填值）。
 */
function buildAvJsonWithAttrs(
  avID: string,
  attrKeys: string[],
  dbName?: string,
): { json: string; keyIdMap: Record<string, string> } {
  const blockKeyId = generateSiyuanId()
  const viewId = generateSiyuanId()
  const tblId = generateSiyuanId()

  // 将每个属性 key 规范化为 custom- 前缀形式
  const normalizedKeys = attrKeys.map(k =>
    k.startsWith(CUSTOM_KEY_PREFIX) ? k : `${CUSTOM_KEY_PREFIX}${k}`,
  )

  // 为每个属性生成 ID 并建立映射
  const keyIdMap: Record<string, string> = {}
  const attrKeyValues = normalizedKeys.map(fullKey => {
    const id = generateSiyuanId()
    keyIdMap[fullKey] = id
    // 显示名：去掉 custom- 前缀
    const displayName = fullKey.startsWith(CUSTOM_KEY_PREFIX)
      ? fullKey.slice(CUSTOM_KEY_PREFIX.length)
      : fullKey
    return {
      key: {
        id,
        // 修改：使用包含 custom- 前缀的 fullKey 作为列名称，以便让该列能与思源块的自定义属性实现原生关联
        name: fullKey,
        type: 'text',
        icon: '',
        desc: '',
        numberFormat: '',
        template: '',
      },
    }
  })

  // 所有列（主键 + 文本列）
  const allColumns = [
    { id: blockKeyId, wrap: false, hidden: false, pin: false, width: '' },
    ...normalizedKeys.map(k => ({ id: keyIdMap[k], wrap: false, hidden: false, pin: false, width: '' })),
  ]

  const avData = {
    spec: 4,
    id: avID,
    name: dbName || '',
    keyValues: [
      {
        key: {
          id: blockKeyId,
          name: t('avPrimaryKey'),
          type: 'block',
          icon: '',
          desc: '',
          numberFormat: '',
          template: '',
        },
      },
      ...attrKeyValues,
    ],
    keyIDs: null,
    viewID: viewId,
    views: [{
      id: viewId,
      icon: '',
      name: t('avTableView'),
      hideAttrViewName: false,
      desc: '',
      pageSize: 50,
      type: 'table',
      table: {
        spec: 0,
        id: tblId,
        showIcon: true,
        wrapField: false,
        columns: allColumns,
        rowIds: null,
      },
    }],
  }
  return { json: JSON.stringify(avData), keyIdMap }
}

// 创建思源原生属性视图数据库，含模板属性列，并回填已有属性值
async function createDatabaseFromSelection(tpl: any) {
  if (selectedBlockIds.value.size === 0) return
  creatingDb.value = true

  const selectedBlocks = filteredBlocks.value.filter(b => selectedBlockIds.value.has(b.id))

  try {
    const previousID = props.blockId || undefined
    const parentID = props.blockId ? undefined : (props.rootId || undefined)

    if (!previousID && !parentID) {
      throw new Error(t('insertContextMissing'))
    }

    // ── 步骤 1：提取模板属性 key（规范化为 custom- 前缀）──
    const attrKeys: string[] = (tpl.attrs ?? []).map((a: any) => {
      const k: string = a.key || ''
      return k.startsWith(CUSTOM_KEY_PREFIX) ? k : `${CUSTOM_KEY_PREFIX}${k}`
    })

    // ── 步骤 2：生成 avID 并构建含属性列的 AV JSON ──
    const avID = generateSiyuanId()
    const { json: avJson, keyIdMap } = buildAvJsonWithAttrs(avID, attrKeys, tpl.name)
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

    // ── 步骤 4：等待内核完成新块的索引与挂载（300ms） ──
    await new Promise<void>(resolve => setTimeout(resolve, 300))

    // ── 步骤 5：批量绑定选中的块（让内核生成行记录并写入磁盘） ──
    const srcs = selectedBlocks.map((b) => ({ id: b.id, isDetached: false }))
    await addAttributeViewBlocks({ avID, srcs })

    // 等待内核将行关联关系完全写入磁盘配置文件（200ms）
    await new Promise<void>(resolve => setTimeout(resolve, 200))

    // ── 步骤 6：从最新的磁盘 JSON 中读取主键对应的“行记录 ID (blockID)” ──
    // 属性视图在绑定块后，会为每一行随机生成行记录 ID。在回填非主键列的值时，必须传入行记录 ID 才能跟主键行对齐
    const blockIdToRowIdMap: Record<string, string> = {}
    const latestAvJson = await getFile(`/data/storage/av/${avID}.json`)
    if (latestAvJson && Array.isArray(latestAvJson.keyValues)) {
      const primaryCol = latestAvJson.keyValues.find(
        (kv: any) => kv.key && kv.key.type === 'block',
      )
      if (primaryCol && Array.isArray(primaryCol.values)) {
        for (const val of primaryCol.values) {
          if (val.blockID && val.block && val.block.id) {
            blockIdToRowIdMap[val.block.id] = val.blockID
          }
        }
      }
    }

    // ── 步骤 7：查询已有属性值，结合正确的行记录 ID 进行批量回填 ──
    if (attrKeys.length > 0 && selectedBlocks.length > 0) {
      const blockIdSql = selectedBlocks.map(b => `'${b.id}'`).join(',')
      const attrKeySql = attrKeys.map(k => `'${k}'`).join(',')
      const attrRows = await sql(
        `SELECT block_id, name, value FROM attributes WHERE block_id IN (${blockIdSql}) AND name IN (${attrKeySql})`,
      )

      if (Array.isArray(attrRows) && attrRows.length > 0) {
        const batchValues: Array<{ keyID: string; itemID: string; value: { text: { content: string } } }> = []
        for (const row of attrRows) {
          const keyID = keyIdMap[row.name as string]
          // 通过映射表，获取对应的数据库行记录 ID (blockID)，若不存在则 fallback 到真实的 block_id
          const itemID = blockIdToRowIdMap[row.block_id as string] || (row.block_id as string)
          if (keyID && row.value != null) {
            batchValues.push({
              keyID,
              itemID,
              value: { text: { content: String(row.value) } },
            })
          }
        }
        if (batchValues.length > 0) {
          await batchSetAttributeViewBlockAttrs({ avID, values: batchValues })
        }
      }
    }

    // 重置并折叠筛选区
    activeFilterTplId.value = null
    filteredBlocks.value = []
    selectedBlockIds.value.clear()
  } catch (err: any) {
    console.error('[spm] create database failed:', err)
    showMessage(err.message || t('createDatabaseFailed'), 5000, 'error')
  } finally {
    creatingDb.value = false
  }
}
</script>
