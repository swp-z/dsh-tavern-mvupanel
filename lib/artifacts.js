/**
 * MVU 面板 · 转换引擎（纯函数，无 IO）
 *
 * 目标：把「MVU 卡片转换器」这个离线 exe 的转换动作，变成 Tavern 插件里的一段程序。
 * 产物与技能 rp-mvu-v3.1 的 build_card.py **逐字段同构**，额外做了两处 token 优化：
 *   1) 新增 promptOnly 正则 `dsh-mvu-hide-initvar`：开场里的 <initvar> 底稿不再进模型上下文；
 *   2) `[rules_selfread]` 兜底条目默认不写（面板的注入主通道生效时它纯属重复前言）。
 *
 * 转换本身不调用任何模型：初始化零 token、零 API 成本。
 */
import { createHash } from 'node:crypto'

export const MVU_CONVERSION_KEY = 'dsh_mvu_conversion'
/**
 * 记账标识：本插件写 MANAGED_BY；读的时候把老插件 dsh-mvu-panel 写的 'mvu-panel'
 * 也算「自己写的」，这样老插件已经派生好的 MVU 卡不用重写就能平滑接管。
 */
export const MANAGED_BY = 'dsh-tavern-mvupanel'
export const LEGACY_MANAGED_BY = 'mvu-panel'
export const MVU_MARKER = '<mvu-status/>'
export const PANEL_SKILL_VERSION = 'v3.1'
/** 面板修订号：R35（按卡头像 / 单卡上传：只内嵌本卡自己的角色图；R34 起档案卡可带头像）。 */
export const PANEL_REVISION = 'R38'
export const SCRIPT_IDS = {
  view: 'dsh-mvu-status-view',
  hide: 'dsh-mvu-hide-marker',
  initvarHide: 'dsh-mvu-hide-initvar',
}
export const ENTRY = {
  initvar: '[initvar]状态初值',
  update: '[mvu_update]状态更新规则',
  selfread: '[rules_selfread]规则自读指令',
  rulesInject: '[rules_inject]规则注入（占位）',
}
export const MANAGED_ENTRY_PATTERN = /^\s*\[(?:initvar|mvu_update|rules_selfread|rules_inject)\]/i
const FLAT_MIRROR_KEYS = [
  'name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example',
  'creatorcomment', 'creator_notes', 'alternate_greetings', 'tags', 'character_book',
]

const MARKER_TAIL = /\n*<mvu-status\s*\/>\s*$/i
const INITVAR_BLOCK = /\n*<initvar>[\s\S]*?<\/initvar>\s*/i
const ALL_INITVAR_BLOCKS = /<initvar>[\s\S]*?<\/initvar>/gi

export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex')

export function toPathBindings(items) {
  return (Array.isArray(items) ? items : []).map(item => {
    const out = { capture: item.capture, path: '/' + (item.keys || []).join('/') }
    if (item.fallback !== undefined && item.fallback !== null) out.fallback = item.fallback
    if (item.cast) out.cast = item.cast
    return out
  })
}

/** 生成注入用的世界书条目（对齐 buildMvuArtifacts.entries）。 */
function buildEntries({ initialState, updateRules, selfreadText, includeSelfread, nextId }) {
  const entries = [{
    keys: [],
    comment: ENTRY.initvar,
    enabled: false,
    constant: false,
    insertion_order: 100,
    content: JSON.stringify(initialState, null, 2),
    extensions: {},
    id: nextId,
  }, {
    keys: [],
    comment: ENTRY.update,
    enabled: true,
    constant: true,
    insertion_order: 100,
    content: updateRules.trim() + '\n\n依据本轮已经发生的正文事实和当前变量快照，用 mvu_submit_update 提交。路径相对于 stat_data；无变化提交空 operations。',
    extensions: {},
    id: nextId + 1,
  }, {
    // 与技能对齐的中性占位（enabled=false → 永远不进提示词，0 token）：
    // 面板启动时的定向清洗需要一个靶子，旧卡里也可能残留同名脏条目。
    keys: [],
    comment: ENTRY.rulesInject,
    enabled: false,
    constant: false,
    insertion_order: 101,
    content: '【已停用】本条目不承载任何法则，其内容一律忽略；规则以面板注入的强制法则区块（或兜底自读指令读取的 MVU 变量 /规则列表/法则）为唯一权威。',
    extensions: {},
    id: nextId + 2,
  }]
  if (includeSelfread && selfreadText) {
    entries.push({
      keys: [],
      comment: ENTRY.selfread,
      enabled: true,
      constant: true,
      insertion_order: 102,
      content: selfreadText.trim(),
      extensions: {},
      id: nextId + 3,
    })
  }
  return entries
}

function stripOpening(text) {
  return String(text || '').replace(ALL_INITVAR_BLOCKS, '').replace(MARKER_TAIL, '').replace(/\s+$/, '')
}

function injectOpening(text, state) {
  const body = stripOpening(text)
  const initvar = '<initvar>\n' + JSON.stringify(state, null, 2) + '\n</initvar>'
  return body + '\n\n' + initvar + '\n\n' + MVU_MARKER
}

function openingTexts(data) {
  return [typeof data.first_mes === 'string' ? data.first_mes : '', ...(Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [])]
}

/** 上次初始化留下的每个开场初值（刷新时保留，避免覆盖用户养出来的状态）。 */
function previousOpeningStates(data) {
  const previous = data?.extensions?.[MVU_CONVERSION_KEY]
  if (!previous) return null
  const states = Array.isArray(previous.openingStates) ? previous.openingStates : []
  return states.length ? states : null
}

/**
 * 状态迁移：以新结构为骨架，保留旧值里仍然存在的路径。
 * R24→R25 靠它丢掉已取消的 /在场卡 顶层分支，同时不丢已积累的规则与档案。
 */
function migrateState(previous, template) {
  const next = structuredClone(template)
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return next
  for (const key of Object.keys(previous)) {
    if (!Object.hasOwn(next, key)) continue
    const prior = previous[key]
    const base = next[key]
    const bothPlain = prior && typeof prior === 'object' && !Array.isArray(prior) && base && typeof base === 'object' && !Array.isArray(base)
    next[key] = bothPlain ? migrateState(prior, base) : structuredClone(prior)
  }
  return next
}

export function detect(data) {
  const conversion = data?.extensions?.[MVU_CONVERSION_KEY]
  const scripts = Array.isArray(data?.extensions?.regex_scripts) ? data.extensions.regex_scripts : []
  const entries = Array.isArray(data?.character_book?.entries) ? data.character_book.entries : []
  const greetings = openingTexts(data).join('\n')
  const ids = scripts.map(script => script && script.id)
  const managedBy = conversion && typeof conversion.managedBy === 'string' ? conversion.managedBy : null
  const panelRevision = conversion && typeof conversion.panelRevision === 'string' ? conversion.panelRevision : null
  // 记账里记下的面板设置：巡检时用来判断「已是最新」是否真的等价
  const panelRuleProfile = conversion && typeof conversion.ruleProfile === 'string' ? conversion.ruleProfile : null
  const panelHideInitvar = conversion ? conversion.hideInitvar !== false : null
  const panelSelfread = conversion ? conversion.selfread === true : null
  const exeStyle = Boolean(conversion && conversion.definition?.appearance?.listBindings && ids.includes(SCRIPT_IDS.view))
  return {
    managedBy,
    panelRevision,
    panelRuleProfile,
    panelHideInitvar,
    panelSelfread,
    conversion: conversion || null,
    isOurs: managedBy === MANAGED_BY || managedBy === LEGACY_MANAGED_BY,
    isConverted: Boolean(conversion) || ids.includes(SCRIPT_IDS.view) || entries.some(entry => MANAGED_ENTRY_PATTERN.test(String(entry?.comment || ''))),
    isExeStyle: exeStyle,
    isNativeStyle: Boolean(conversion) && !exeStyle,
    hasViewScript: ids.includes(SCRIPT_IDS.view),
    hasHideScript: ids.includes(SCRIPT_IDS.hide),
    hasInitvarHide: ids.includes(SCRIPT_IDS.initvarHide),
    hasMarker: greetings.includes(MVU_MARKER),
    hasInitvar: /<initvar>/i.test(greetings),
    entryComments: entries.map(entry => String(entry?.comment || '')).filter(comment => MANAGED_ENTRY_PATTERN.test(comment) || comment === ENTRY.rulesInject),
    updateRuleChars: entries.filter(entry => /^\s*\[mvu_update\]/i.test(String(entry?.comment || ''))).reduce((sum, entry) => sum + String(entry.content || '').length, 0),
  }
}

/**
 * 注入面板产物。data 是 SillyTavern 卡的数据体（raw.data 或裸卡的 data），就地修改并返回报告。
 * 幂等：重复转换只会刷新产物，不会堆叠。
 */
/**
 * R33：世界书去重（纯省 token，不动内容）。
 *
 * 真机（chat-mv8ddl8y-duqp01）：卡里 3 条常驻条目共 5,713 字，与人物卡 description/personality 逐行重复，
 * 却因为 constant=true 每轮都进前台、后台结算也各带一份 ⇒ 每请求白烧约 5.6k 字。
 *
 * 判定刻意保守，只停用同时满足下面全部的条目：
 *   - 不是本插件托管的那几条（[initvar] / [mvu_update] / [rules_inject]）；
 *   - 当前是「常驻且启用」的（非常驻条目本来就不会每轮进上下文，不值得动）；
 *   - 正文 ≥200 字，且 ≥80% 的「实质行」（去空白后 ≥10 字的行，至少 3 行）能在人物卡字段里逐行找到。
 * 只改 enabled=false：内容、关键词、排序都不动，随时可以在卡片工作台改回来或重新导入。
 */
export function pruneDuplicateEntries(data) {
  const book = data && data.character_book
  const entries = book && Array.isArray(book.entries) ? book.entries : []
  const corpus = [data?.description, data?.personality, data?.scenario, data?.mes_example, data?.system_prompt, data?.first_mes]
    .filter(text => typeof text === 'string' && text.trim()).join('\n')
  const changed = []
  let savedChars = 0
  for (const entry of entries) {
    if (!entry || typeof entry.content !== 'string') continue
    if (MANAGED_ENTRY_PATTERN.test(String(entry.comment || ''))) continue
    if (entry.enabled === false || entry.constant !== true) continue
    const content = entry.content.trim()
    if (content.length < 200) continue
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length >= 10)
    if (lines.length < 3) continue
    const hits = lines.filter(line => corpus.includes(line)).length
    if (hits / lines.length < 0.8) continue
    entry.enabled = false
    changed.push({ id: entry.id, comment: String(entry.comment || ''), chars: content.length, ratio: Math.round((hits / lines.length) * 100) })
    savedChars += content.length
  }
  return { changed, savedChars }
}
export function convert(data, options) {
  const {
    panelMarkdown, appearanceHtml, appearanceSourceHtml, bindingsDoc, stateSchema, updateRules,
    selfreadText = '', includeSelfread = false, hideInitvar = true,
    sourcePath = '', sourceRevision = '', requestHash = '', ruleProfile = 'full',
    derivedFrom = '', notesStamp = '',
    stampNotes = false,
    dedupeWorldbook = true,
  } = options
  if (!data || typeof data !== 'object') throw new Error('卡片数据体必须是对象')
  if (typeof panelMarkdown !== 'string' || !panelMarkdown.trim()) throw new Error('缺少面板 replaceString 资源')
  if (typeof appearanceHtml !== 'string' || !appearanceHtml.trim()) throw new Error('缺少外观 HTML 资源')
  // replaceString 用 &#36;n（ST 的 replacementFor 会把裸 $1 当捕获组），
  // 而 frozenAppearance/definition 存的是「源 HTML」裸 $n（renderFrozenAppearance 只认 /\$([1-9]\d?)/）。
  const sourceHtml = typeof appearanceSourceHtml === 'string' && appearanceSourceHtml.trim() ? appearanceSourceHtml : appearanceHtml.replace(/&#36;/g, '$')

  const previous = data.extensions?.[MVU_CONVERSION_KEY]
  const initialState = migrateState(previous && previous.initialState, stateSchema.initialState)
  const keepStates = previousOpeningStates(data)
  const greetingCount = openingTexts(data).length
  const openingStates = Array.from({ length: greetingCount }, (_, index) => {
    const kept = keepStates && keepStates[index]
    return kept && typeof kept === 'object' ? migrateState(kept, initialState) : structuredClone(initialState)
  })

  // 1) 显示/隐藏正则
  const extensions = data.extensions && typeof data.extensions === 'object' ? data.extensions : (data.extensions = {})
  const scripts = Array.isArray(extensions.regex_scripts) ? extensions.regex_scripts : (extensions.regex_scripts = [])
  const managedIds = Object.values(SCRIPT_IDS)
  const kept = scripts.filter(script => !script || !managedIds.includes(script.id))
  kept.push({
    id: SCRIPT_IDS.view,
    scriptName: 'MVU 状态视图',
    findRegex: '/<mvu-status\\s*\\/>/g',
    replaceString: panelMarkdown,
    placement: [2],
    disabled: false,
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: true,
  }, {
    id: SCRIPT_IDS.hide,
    scriptName: '隐藏模型历史中的状态入口',
    findRegex: '/\\n*<mvu-status\\s*\\/>/g',
    replaceString: '',
    placement: [2],
    disabled: false,
    markdownOnly: false,
    promptOnly: true,
    runOnEdit: true,
  })
  if (hideInitvar) {
    kept.push({
      id: SCRIPT_IDS.initvarHide,
      scriptName: '隐藏模型历史中的变量初值',
      findRegex: '/\\n*<initvar>[\\s\\S]*?<\\/initvar>/g',
      replaceString: '',
      placement: [2],
      disabled: false,
      markdownOnly: false,
      promptOnly: true,
      runOnEdit: true,
    })
  }
  extensions.regex_scripts = kept

  // 2) 世界书条目（初值 / 结算规则 / 可选前台兜底）
  const book = data.character_book && typeof data.character_book === 'object' ? data.character_book : (data.character_book = {})
  const entries = Array.isArray(book.entries) ? book.entries : (book.entries = [])
  const preserved = entries.filter(entry => !MANAGED_ENTRY_PATTERN.test(String(entry?.comment || '')))
  // id 只按「别人写的条目」取号，保证重复转换时自己的条目 id 稳定（幂等）
  const numericIds = preserved.map(entry => Number(entry?.id)).filter(Number.isSafeInteger)
  const nextId = (numericIds.length ? Math.max(...numericIds) : 0) + 1
  const added = buildEntries({ initialState, updateRules, selfreadText, includeSelfread, nextId })
  book.entries = preserved.concat(added)
  // R33：顺手停用与人物卡字段逐行重复的常驻条目（纯省 token；可用开关关掉）
  const pruned = dedupeWorldbook === false ? { changed: [], savedChars: 0 } : pruneDuplicateEntries(data)

  // 3) 开场：底稿 + 面板入口
  data.first_mes = injectOpening(data.first_mes, openingStates[0])
  if (Array.isArray(data.alternate_greetings)) {
    data.alternate_greetings = data.alternate_greetings.map((text, index) => injectOpening(text, openingStates[index + 1] ?? initialState))
  }

  // 4) 转换记账（结构与技能逐字段对齐，另加 managedBy/ruleProfile 便于插件识别）
  const bindings = toPathBindings(bindingsDoc.global)
  const listBindings = {}
  for (const [path, items] of Object.entries(bindingsDoc.listBinding || {})) listBindings[path] = toPathBindings(items)
  const appearance = { html: sourceHtml, bindings, listBindings }
  const definition = {
    version: 1,
    sourcePath,
    sourceRevision,
    initialState: structuredClone(initialState),
    openingStates,
    updateRules,
    displayFields: [],
    sourceFields: [],
    inventory: [],
    mappings: [],
    fields: stateSchema.fields || [],
    elementSchema: stateSchema.elementSchema || {},
    consistency: stateSchema.consistency || [],
    appearance,
  }
  extensions[MVU_CONVERSION_KEY] = {
    version: 1,
    managedBy: MANAGED_BY,
    panelVersion: PANEL_SKILL_VERSION,
    panelRevision: PANEL_REVISION,
    ruleProfile,
    hideInitvar: hideInitvar === true,
    selfread: includeSelfread === true,
    sourcePath,
    sourceRevision,
    requestHash,
    // 双存模型：派生卡指回原卡（原卡不动）
    derivedFrom: derivedFrom || null,
    definition,
    definitionRevision: sha256(JSON.stringify(definition)),
    appearance,
    frozenAppearance: {
      version: 1,
      sourcePath: null,
      sourceDigest: sha256(sourceHtml),
      html: sourceHtml,
      htmlDigest: sha256(sourceHtml),
      bindings,
      listBindings,
      casts: bindingsDoc.casts || {},
      generated: true,
    },
    openingStates,
    initialState: structuredClone(initialState),
    updateRules,
    displayFields: [],
    cleanup: [],
    outputDigest: sha256(panelMarkdown + '||' + updateRules),
  }

  const stamp = notesStamp || (stampNotes ? '[MVU] 本卡已注入面板（插件 ' + PANEL_SKILL_VERSION + '）。' : '')
  if (stamp) {
    const notes = String(data.creator_notes || '')
      .split('\n')
      .filter(line => !line.includes('[MVU] 本卡'))
      .join('\n')
      .replace(/\s+$/, '')
    data.creator_notes = (notes ? notes + '\n' : '') + stamp
  }

  return {
    initialState,
    openingStates,
    scripts: extensions.regex_scripts.length,
    entries: added.length,
    worldbookDedupe: pruned,
    updateRuleChars: updateRules.trim().length,
  }
}

/** 移除本插件注入的全部产物，回到转换前的卡（只动我们自己写的东西）。 */
export function strip(data) {
  const report = { scripts: 0, entries: 0, greetings: 0, conversion: false }
  const extensions = data?.extensions
  const conversion = extensions?.[MVU_CONVERSION_KEY]
  const ours = conversion?.managedBy === MANAGED_BY || conversion?.managedBy === LEGACY_MANAGED_BY
  const managedIds = Object.values(SCRIPT_IDS)
  if (extensions && Array.isArray(extensions.regex_scripts)) {
    const kept = extensions.regex_scripts.filter(script => !script || !managedIds.includes(script.id))
    report.scripts = extensions.regex_scripts.length - kept.length
    extensions.regex_scripts = kept
  }
  // 世界书条目：只清理「我们写进去的那三条」——用 managedBy 认领，避免误删别家转换的条目
  if (ours && Array.isArray(data?.character_book?.entries)) {
    const kept = data.character_book.entries.filter(entry => !MANAGED_ENTRY_PATTERN.test(String(entry?.comment || '')))
    report.entries = data.character_book.entries.length - kept.length
    data.character_book.entries = kept
  }
  const stripText = text => {
    const next = stripOpening(text)
    if (next !== String(text || '')) report.greetings += 1
    return next
  }
  if (typeof data?.first_mes === 'string') data.first_mes = stripText(data.first_mes)
  if (Array.isArray(data?.alternate_greetings)) data.alternate_greetings = data.alternate_greetings.map(stripText)
  if (ours) {
    delete extensions[MVU_CONVERSION_KEY]
    report.conversion = true
  }
  return report
}

/**
 * 「源卡」摘要：先摘掉本插件注入的产物再算哈希，因此重复转换结果稳定
 * （直接用文件字节当 sourceRevision 会在第二次转换时变化，破坏幂等）。
 */
export function sourceDigest(data) {
  const clone = structuredClone(data)
  strip(clone)
  // 归一化：转换过程可能新建了空容器（例如原本没有 character_book 的卡），
  // 只按「空则删除」的固定规则修剪，保证两次转换得到同一个摘要。
  if (clone.character_book && Array.isArray(clone.character_book.entries) && clone.character_book.entries.length === 0) delete clone.character_book
  if (clone.extensions) {
    if (Array.isArray(clone.extensions.regex_scripts) && clone.extensions.regex_scripts.length === 0) delete clone.extensions.regex_scripts
    if (Object.keys(clone.extensions).length === 0) delete clone.extensions
  }
  return sha256(JSON.stringify(clone))
}

/** 工作区/裸卡外壳的顶层平铺镜像同步（只更新本来就存在的键，不新增字段）。 */
export function syncFlatMirror(wrapper) {
  const raw = wrapper?.raw
  if (!raw || typeof raw !== 'object' || !raw.data || typeof raw.data !== 'object') return []
  const touched = []
  for (const key of FLAT_MIRROR_KEYS) {
    if (!Object.hasOwn(raw, key)) continue
    const value = raw.data[key]
    const mirrorKey = key === 'character_book' ? 'character_book' : key
    if (value === undefined) continue
    if (JSON.stringify(raw[mirrorKey]) !== JSON.stringify(value)) {
      raw[mirrorKey] = structuredClone(value)
      touched.push(mirrorKey)
    }
  }
  return touched
}

/** 每轮 token 估算：把「注入后卡里会进入模型上下文的东西」逐项算出来。 */
export function tokenReport(data, { updateRules = '', selfreadText = '', hideInitvar = true } = {}) {
  const greeting = openingTexts(data).join('\n')
  const initvarBlocks = greeting.match(ALL_INITVAR_BLOCKS) || []
  const initvarChars = initvarBlocks.reduce((sum, block) => sum + block.length, 0)
  const perTurnChars = {
    updateRules: updateRules.trim().length,
    selfread: data?.character_book?.entries?.some(entry => /^\s*\[rules_selfread\]/i.test(String(entry?.comment || ''))) ? selfreadText.trim().length : 0,
    initvar: hideInitvar ? 0 : initvarChars,
    marker: 0,
    panelHtml: 0,
  }
  return {
    chars: perTurnChars,
    initvarChars,
    estimateTokens: charCount => Math.round(charCount * 0.7),
    note: '面板 HTML / <mvu-status/> / <initvar> 都不进模型上下文；[mvu_update] 只喂后台结算，[rules_selfread] 进前台常量。',
  }
}
