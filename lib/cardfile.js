/**
 * 卡片文件读写（宿主半与命令行共用）
 *
 *   R32 新模型（任务 1 起）：插件页导入 → 转换 → 只留一张卡
 *     MVU 卡    cards/X mvu版.json   插件生成/刷新/删除（内容 = 导入的卡 + 面板产物）
 *     （不再有「原卡 + 派生副本」一对；导入前的字节留在插件 backups/imported/ 里）
 *   台账 managed.json 记录自己管的卡；原生按钮导入的卡插件一律不碰。
 *
 * Tavern 的 cards/*.json 有两种形状，读写都要保持原样：
 *   1) 工作区包装 {kind, version, raw, meta}
 *   2) 裸卡 {spec, spec_version, data}
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { PANEL_REVISION, convert, detect, sha256, sourceDigest, strip, syncFlatMirror } from './artifacts.js'

/**
 * 派生卡文件名后缀（R32：改成「原名 + mvu版」）。
 * 目的：插件导入的卡与「原生按钮导入的同名卡」永不撞名，也不会覆盖用户自己的卡。
 */
export const DERIVED_SUFFIX = ' mvu版'
const WORKSPACE_KIND = 'dsh-tavern-character-workspace'

import { refsForCard, injectAvatarRefs, refsDigest } from './avatars.js'

export function pluginRoot() {
  // <tavern data>/plugins/dsh-tavern-mvupanel/lib/cardfile.js -> …/lib -> 插件根 -> plugins -> <tavern data>
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  return path.resolve(here, '..')
}

export function tavernDataDir() {
  return path.resolve(pluginRoot(), '..', '..')
}

export function cardsDir() {
  // 默认 <tavern data>/resources/cards；环境变量覆盖只为自检与多 profile 场景
  return process.env.DSH_MVU_PANEL_CARDS_DIR || path.join(tavernDataDir(), 'resources', 'cards')
}

export function assetsDir() {
  return path.join(pluginRoot(), 'assets')
}

export function readAssets() {
  const dir = assetsDir()
  const read = name => fs.readFileSync(path.join(dir, name), 'utf8')
  return {
    panelMarkdown: read('panel.md'),
    appearanceHtml: read('appearance.html'),
    appearanceSourceHtml: read('appearance.html').replace(/&#36;/g, '$'),
    bindingsDoc: JSON.parse(read('bindings.json')),
    stateSchema: JSON.parse(read('state.schema.json')),
    updateRules: read('update-rules.md'),
    updateRulesLite: fs.existsSync(path.join(dir, 'update-rules-lite.md')) ? read('update-rules-lite.md') : null,
    selfreadText: fs.existsSync(path.join(dir, 'rules-selfread.md')) ? read('rules-selfread.md') : '',
  }
}

/** 读取一张卡：返回包装体、data 引用与原文。 */
export function loadCard(file) {
  const text = fs.readFileSync(file, 'utf8')
  const wrapper = JSON.parse(text)
  const isWorkspace = Boolean(wrapper && wrapper.raw && wrapper.raw.data && typeof wrapper.raw.data === 'object')
  const data = isWorkspace ? wrapper.raw.data : wrapper.data
  if (!data || typeof data !== 'object') throw new Error('无法定位卡片数据体: ' + file)
  return {
    wrapper,
    isWorkspace,
    data,
    name: typeof data.name === 'string' ? data.name : path.basename(file, '.json'),
    originalText: text,
    hadTrailingNewline: /\n$/.test(text),
  }
}

export function saveCard(file, loaded) {
  syncFlatMirror(loaded.wrapper)
  const text = JSON.stringify(loaded.wrapper, null, 2) + (loaded.hadTrailingNewline ? '\n' : '')
  fs.writeFileSync(file, text, 'utf8')
  return text.length
}

export function backup(file, loaded) {
  const dir = process.env.DSH_MVU_PANEL_BACKUP_DIR || path.join(pluginRoot(), 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const target = path.join(dir, path.basename(file, '.json') + '.' + stamp + '.json')
  if (!fs.existsSync(target)) fs.writeFileSync(target, loaded.originalText, 'utf8')
  return target
}

/** 删除前留底（派生卡不进回收站，改名放进 removed/）。 */
export function archiveRemoved(file, loaded) {
  const dir = path.join(process.env.DSH_MVU_PANEL_BACKUP_DIR || path.join(pluginRoot(), 'backups'), 'removed')
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const target = path.join(dir, path.basename(file, '.json') + '.' + stamp + '.json')
  if (!fs.existsSync(target)) fs.writeFileSync(target, loaded.originalText, 'utf8')
  return target
}

export function listCards() {
  const dir = cardsDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(name => name.toLowerCase().endsWith('.json')).map(name => path.join(dir, name))
}

export function relative(file) {
  const dir = cardsDir()
  const name = path.basename(file)
  return fs.existsSync(dir) ? path.join('cards', name).replace(/\\/g, '/') : name.replace(/\\/g, '/')
}

export function derivedPathFor(sourceFile, suffix = DERIVED_SUFFIX) {
  const dir = path.dirname(sourceFile)
  const stem = path.basename(sourceFile, '.json')
  return path.join(dir, stem + suffix + '.json')
}

export function isDerivedFile(file, suffix = DERIVED_SUFFIX) {
  return path.basename(file, '.json').endsWith(suffix)
}

/** 派生卡记录：优先看卡内记账，其次看文件名后缀（兼容手工改名）。 */
export function derivedFromOf(file) {
  try {
    const loaded = loadCard(file)
    const record = loaded.data?.extensions?.dsh_mvu_conversion
    if (record && typeof record.derivedFrom === 'string' && record.derivedFrom) return record.derivedFrom
    const meta = loaded.wrapper?.meta
    if (meta && typeof meta.mvuPanel?.derivedFrom === 'string' && meta.mvuPanel.derivedFrom) return meta.mvuPanel.derivedFrom
  } catch { /* 读不动就当没有 */ }
  return ''
}

export function listDerivedCards() {
  // 只认「有 derivedFrom 记账」的文件：文件名带 MVU版本 但属于别家转换的卡（如 DSH 原生托管的副本）绝不当作派生卡，
  // 否则孤儿清理会把用户既有的人物卡删掉。
  return listCards().filter(file => derivedFromOf(file) !== '')
}

export function listSourceCards() {
  const derived = new Set(listDerivedCards())
  return listCards().filter(file => !derived.has(file))
}

/** 把「就地转换」的旧原卡还原成干净内容（幂等；没有本插件产物就直接跳过）。 */
export function repairInPlace(file, options = {}) {
  const loaded = loadCard(file)
  const state = detect(loaded.data)
  // 只认领自己写的产物：DSH 原生托管 / 别家转换的卡一律不碰
  if (!state.isOurs) return { file, path: relative(file), action: 'skip', reason: '原卡没有本插件的产物（或属于别家转换），不动', state }
  if (!options.dryRun) backup(file, loaded)
  const report = strip(loaded.data)
  if (!options.dryRun) saveCard(file, loaded)
  return { file, path: relative(file), action: 'repair', name: loaded.name, report }
}

/** 干净内容：把可能存在的面板产物先摘掉，派生卡永远从「原卡内容」生成。 */
function cleanData(data) {
  const clone = structuredClone(data)
  strip(clone)
  return clone
}

function workspaceFor(source, derivedFile, data, sourcePath) {
  const raw = source.isWorkspace ? structuredClone(source.wrapper.raw) : { ...(structuredClone(source.wrapper)) }
  delete raw.raw
  raw.data = data
  const previousMeta = (() => {
    try { return JSON.parse(fs.readFileSync(derivedFile, 'utf8')).meta } catch { return undefined }
  })()
  const now = Date.now()
  const meta = {
    id: previousMeta?.id || randomUUID(),
    importedAt: previousMeta?.importedAt || now,
    updatedAt: now,
    revisionHistory: previousMeta?.revisionHistory || [],
    mvuPanel: { plugin: 'dsh-tavern-mvupanel', derivedFrom: sourcePath, revision: PANEL_REVISION, generatedAt: now },
  }
  return { kind: WORKSPACE_KIND, version: 1, raw, meta }
}

/**
 * 生成/刷新派生 MVU 卡。原卡一个字节都不改。
 * onlyIfNeeded=true 时：派生卡存在、修订与设置一致、且源卡没变，就跳过。
 */
export function deriveCard(sourceFile, options = {}) {
  const assets = options.assets || readAssets()
  const source = loadCard(sourceFile)
  const sourceState = detect(source.data)
  const sourcePath = relative(sourceFile)
  const derivedFile = options.derivedFile || derivedPathFor(sourceFile, options.suffix || DERIVED_SUFFIX)
  const existing = fs.existsSync(derivedFile) ? loadCard(derivedFile) : null
  // R36：按卡头像 —— 只引用这张卡自己的图片目录（卡里存相对 URL，图片不进卡）
  const avatarInfo = refsForCard(path.basename(derivedFile, '.json'), options)
  const sourceRevision = sourceDigest(cleanData(source.data)) + '|av:' + refsDigest(avatarInfo.refs)
  const want = {
    ruleProfile: options.ruleProfile === 'lite' ? 'lite' : 'full',
    hideInitvar: options.hideInitvar !== false,
    selfread: options.selfread === true,
    revision: PANEL_REVISION,
    sourceRevision,
  }

  if (sourceState.isNativeStyle && options.policy !== 'adopt-native') {
    return { sourceFile, file: sourceFile, path: sourcePath, derivedFile, derivedPath: relative(derivedFile), action: 'skip', reason: '这张卡是 DSH 原生托管面板转换的，不派生（policy=skip-native）', state: sourceState }
  }
  // skip-converted：exe / 别家转换过的原卡一律不动（对比测试时保留原样）
  if (options.policy === 'skip-converted' && sourceState.isConverted && !sourceState.isOurs) {
    return { sourceFile, file: sourceFile, path: sourcePath, derivedFile, derivedPath: relative(derivedFile), action: 'skip', reason: '原卡已带 MVU 产物，按 skip-converted 不派生', state: sourceState }
  }

  const existingState = existing ? detect(existing.data) : null
  if (options.onlyIfNeeded === true && existing && existingState?.isOurs) {
    const record = existing.data.extensions.dsh_mvu_conversion
    const have = {
      ruleProfile: record.ruleProfile === 'lite' ? 'lite' : 'full',
      hideInitvar: record.hideInitvar !== false,
      selfread: record.selfread === true,
      revision: record.panelRevision || '',
      sourceRevision: record.sourceRevision || '',
    }
    if (JSON.stringify(want) === JSON.stringify(have)) {
      return { sourceFile, file: sourceFile, path: sourcePath, derivedFile, derivedPath: relative(derivedFile), action: 'skip', reason: 'MVU 卡已是最新（' + PANEL_REVISION + ' / ' + have.ruleProfile + '）', state: existingState }
    }
  }

  const data = cleanData(source.data)
  const report = convert(data, {
    panelMarkdown: injectAvatarRefs(assets.panelMarkdown, avatarInfo.refs),
    appearanceHtml: assets.appearanceHtml,
    appearanceSourceHtml: assets.appearanceSourceHtml,
    bindingsDoc: assets.bindingsDoc,
    stateSchema: assets.stateSchema,
    updateRules: options.ruleProfile === 'lite' && assets.updateRulesLite ? assets.updateRulesLite : assets.updateRules,
    selfreadText: assets.selfreadText,
    includeSelfread: options.selfread === true,
    hideInitvar: options.hideInitvar !== false,
    sourcePath: sourcePath,
    sourceRevision,
    requestHash: sha256(sourceFile),
    ruleProfile: want.ruleProfile,
    derivedFrom: sourcePath,
    notesStamp: options.notesStamp === false ? '' : `[MVU] 本卡由 MVU 面板插件从 ${sourcePath} 自动生成（修订 ${PANEL_REVISION}），请勿手工编辑；改原卡即可。`,
  })
  const wrapper = workspaceFor(source, derivedFile, data, sourcePath)
  const text = JSON.stringify(wrapper, null, 2) + (source.hadTrailingNewline ? '\n' : '\n')
  if (options.dryRun !== true) fs.writeFileSync(derivedFile, text, 'utf8')
  return {
    sourceFile,
    file: derivedFile,
    path: sourcePath,
    derivedFile,
    derivedPath: relative(derivedFile),
    action: existing ? 'refresh' : 'derive',
    name: source.name,
    report,
    bytes: text.length,
  }
}

/** 删除派生卡（先留底到 backups/removed/）。 */
export function removeDerived(derivedFile, options = {}) {
  if (!fs.existsSync(derivedFile)) return { file: derivedFile, action: 'skip', reason: '派生卡不存在' }
  const loaded = loadCard(derivedFile)
  if (!options.dryRun) archiveRemoved(derivedFile, loaded)
  if (!options.dryRun) fs.rmSync(derivedFile)
  return { file: derivedFile, path: relative(derivedFile), action: 'remove', name: loaded.name }
}

/** 双存视角的目录扫描（不写盘）。 */
export function scan(options = {}) {
  const assets = options.assets || readAssets()
  const rows = []
  const derivedFiles = listDerivedCards()
  const derivedPaths = new Map(derivedFiles.map(file => [derivedFromOf(file) || path.basename(file).replace(DERIVED_SUFFIX + '.json', '.json'), file]))

  for (const file of listCards()) {
    try {
      const loaded = loadCard(file)
      const state = detect(loaded.data)
      const entries = loaded.data.character_book?.entries || []
      const greeting = [loaded.data.first_mes, ...(loaded.data.alternate_greetings || [])].join('\n')
      const row = {
        path: relative(file),
        name: loaded.name,
        role: derivedFiles.includes(file) ? 'derived' : 'source',
        status: state.isOurs
          ? (state.panelRevision === PANEL_REVISION ? 'panel' : 'stale')
          : state.isNativeStyle ? 'native' : state.isExeStyle ? 'exe' : state.isConverted ? 'other' : 'clean',
        revision: state.panelRevision,
        panel: state.hasViewScript,
        initvarHidden: state.hasInitvarHide,
        initvar: state.hasInitvar,
        updateRules: entries.filter(entry => /^\s*\[mvu_update\]/i.test(String(entry?.comment || ''))).reduce((sum, entry) => sum + String(entry.content || '').length, 0),
        selfread: entries.filter(entry => /^\s*\[rules_selfread\]/i.test(String(entry?.comment || ''))).reduce((sum, entry) => sum + String(entry.content || '').length, 0),
        initvarChars: (greeting.match(/<initvar>[\s\S]*?<\/initvar>/gi) || []).reduce((sum, block) => sum + block.length, 0),
      }
      if (row.role === 'source') {
        const mine = derivedPaths.get(row.path)
        row.derivedPath = mine ? relative(mine) : relative(derivedPathFor(file))
        row.derived = Boolean(mine && fs.existsSync(mine))
      } else {
        row.derivedFrom = derivedFromOf(file)
      }
      rows.push(row)
    } catch (error) {
      rows.push({ path: relative(file), name: path.basename(file), role: 'source', status: 'error', error: String(error && error.message || error) })
    }
  }
  return rows
}

export function formatScan(rows) {
  const label = {
    panel: '已注入面板',
    stale: '待刷新（旧修订）',
    native: 'DSH 原生转换（不接管）',
    exe: 'exe 转换产物',
    other: '其他 MVU 产物',
    clean: '干净原卡',
    error: '读取失败',
  }
  const lines = ['卡片目录扫描（双存视角）：', '']
  const sources = rows.filter(row => row.role === 'source')
  for (const row of sources) {
    if (row.status === 'error') { lines.push(`  ! ${row.path} :: ${row.error}`); continue }
    const derived = row.derived ? `MVU 卡 ✓ ${row.derivedPath}` : 'MVU 卡 ✗（未生成）'
    lines.push(`  原卡 ${row.path}　[${label[row.status] || row.status}]　${derived}`)
  }
  const derived = rows.filter(row => row.role === 'derived')
  if (derived.length) {
    lines.push('')
    for (const row of derived) {
      lines.push(`  MVU 卡 ${row.path}　[${label[row.status] || row.status}${row.revision ? ' ' + row.revision : ''}]　后台规则 ${row.updateRules} 字符${row.selfread ? `　前台兜底 ${row.selfread} 字符` : ''}${row.initvar ? `　（每轮 initvar ${row.initvarChars} 字符）` : ''}　源 ${row.derivedFrom || '未记录'}`)
    }
  }
  if (rows.length === 0) lines.push('  （卡片目录为空）')
  return lines.join('\n')
}

export { sourceDigest }
