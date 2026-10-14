/**
 * 导入链路 + 台账 + 日志（任务 1 新模型：插件页导入 → 只留「原名 + mvu版」一张卡）
 *
 * 与老模型（目录监视 → 为每张落进 cards/ 的卡派生副本）彻底隔离：
 *   - 插件**不再扫描、不再判断**原生导入的卡，一字节都不碰；
 *   - 只有从这里导入的卡才会被转换、被刷新、被删除；
 *   - 台账 managed.json 记录「自己管的那几张」，插件重启/升级后照旧认得。
 *
 * 明确保留的接口外依赖（文档《暂时没有的》：没有开放「转换人物卡」「写卡片文件」这类接口）：
 *   读写 <tavern data>/resources/cards/*.json 与 <tavern data>/originals/cards/*，全部集中在本文件
 *   （转换本身复用 lib/artifacts.js 的纯函数，写入复用 lib/cardfile.js 的 loadCard/saveCard 之外的最小 IO）。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { MANAGED_BY, LEGACY_MANAGED_BY, PANEL_REVISION, convert, sha256, sourceDigest, syncFlatMirror } from './artifacts.js'
import { DERIVED_SUFFIX, backup, cardsDir, deriveCard, loadCard, pluginRoot, readAssets } from './cardfile.js'

export const LEDGER_FILE = 'managed.json'
/** 单次 callHost 参数上限 256 KB（接口文档），分块留足余量 */
export const CHUNK_BYTES = 72 * 1024
export const MAX_UPLOAD_BYTES = 16 * 1024 * 1024

export function dataRoot() { return path.resolve(pluginRoot(), '..', '..') }
export function originalsDir() { return process.env.DSH_MVU_PANEL_ORIGINALS_DIR || path.join(dataRoot(), 'originals', 'cards') }
export function ledgerPath() { return path.join(pluginRoot(), LEDGER_FILE) }
export function logDir() { return path.join(pluginRoot(), 'logs') }
export function stagingDir() { return path.join(pluginRoot(), '.staging') }
export function backupsDir() { return process.env.DSH_MVU_PANEL_BACKUP_DIR || path.join(pluginRoot(), 'backups') }

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* 建不出来由后续写入报错 */ }
  return dir
}

function stamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
}

/** 先写临时文件再改名：列表正在读取时不会读到半个 JSON。 */
export function atomicWrite(file, text) {
  ensureDir(path.dirname(file))
  const temp = file + '.tmp-' + process.pid + '-' + Math.random().toString(36).slice(2, 8)
  fs.writeFileSync(temp, text, 'utf8')
  fs.renameSync(temp, file)
  return text.length
}

// ── 日志：内存环形 + 按天 JSONL（插件目录内，最多 7 天 / 单日 2 MB）───────────
const RING = []
const RING_LIMIT = 200
const DAY_LIMIT = 2 * 1024 * 1024
const KEEP_DAYS = 7

function logFile(day = new Date().toISOString().slice(0, 10)) {
  return path.join(logDir(), 'mvupanel-' + day + '.jsonl')
}

function pruneLogs() {
  try {
    const files = fs.readdirSync(logDir()).filter(name => /^mvupanel-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)).sort()
    for (const name of files.slice(0, Math.max(0, files.length - KEEP_DAYS))) {
      try { fs.rmSync(path.join(logDir(), name), { force: true }) } catch { /* 忽略 */ }
    }
  } catch { /* 目录还不存在 */ }
}

export function logEvent(level, event, detail = {}) {
  const entry = { at: new Date().toISOString(), level, event, ...detail }
  RING.push(entry)
  if (RING.length > RING_LIMIT) RING.splice(0, RING.length - RING_LIMIT)
  try {
    ensureDir(logDir())
    if (!fs.existsSync(logDir())) return entry
    const file = logFile()
    try {
      const size = fs.statSync(file).size
      if (size > DAY_LIMIT) return entry
    } catch { /* 新文件 */ }
    fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8')
    if (RING.length === 1) pruneLogs()
  } catch { /* 日志失败不影响功能 */ }
  return entry
}

export function recentEvents(limit = 60) {
  return RING.slice(-Math.max(1, Math.min(200, limit)))
}

export function readLogTail(limit = 200) {
  try {
    const lines = fs.readFileSync(logFile(), 'utf8').split('\n').filter(Boolean)
    return lines.slice(-Math.max(1, Math.min(1000, limit)))
  } catch {
    return []
  }
}

// ── 台账 ────────────────────────────────────────────────────────────────────
export function readLedger() {
  try {
    const value = JSON.parse(fs.readFileSync(ledgerPath(), 'utf8'))
    const cards = value && typeof value.cards === 'object' && value.cards ? value.cards : {}
    return { version: 1, cards }
  } catch {
    return { version: 1, cards: {} }
  }
}

export function writeLedger(value) {
  try {
    atomicWrite(ledgerPath(), JSON.stringify({ version: 1, cards: value.cards || {} }, null, 2) + '\n')
  } catch (error) {
    logEvent('warn', 'ledger-write-failed', { error: String(error && error.message || error) })
  }
  return readLedger()
}

export function upsertManaged(record) {
  const ledger = readLedger()
  ledger.cards[record.key] = { ...(ledger.cards[record.key] || {}), ...record }
  writeLedger(ledger)
  return ledger.cards[record.key]
}

export function dropManaged(key) {
  const ledger = readLedger()
  const removed = ledger.cards[key] || null
  delete ledger.cards[key]
  writeLedger(ledger)
  return removed
}

// ── 卡片名 / 文件名 ──────────────────────────────────────────────────────────
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export function safeStem(value) {
  let name = String(value == null ? '' : value).trim().replace(/[\u0000-\u001f]/g, '')
  name = name.replace(/[\\/:*?"<>|]/g, '_').replace(/\.+$/, '').trim()
  if (name.startsWith('.')) name = '_' + name.replace(/^\.+/, '')
  if (!name) name = '未命名人物卡'
  if (RESERVED.test(name)) name = '_' + name
  return name.slice(0, 120)
}

/** 从卡片 JSON 文本里取出卡名（工作区包装与裸卡都支持）。 */
export function cardNameOf(text) {
  try {
    const wrapper = JSON.parse(text)
    const data = wrapper && wrapper.raw && wrapper.raw.data && typeof wrapper.raw.data === 'object' ? wrapper.raw.data : wrapper?.data
    if (data && typeof data.name === 'string' && data.name.trim()) return data.name.trim()
  } catch { /* 交给调用方报错 */ }
  return ''
}

/**
 * PNG 卡片 → 卡片 JSON 文本（tEXt/iTXt/zTXt 里的 chara / ccv3）。
 * 与 Tavern 自己的 pngCardPayload 一致：chara 里放的是 base64(JSON)。
 */
export function cardTextFromPng(buffer, fileName = '') {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!Buffer.isBuffer(buffer) || buffer.length <= signature.length || !buffer.subarray(0, signature.length).equals(signature)) {
    throw new Error('不是有效的 PNG 文件：' + fileName)
  }
  const found = {}
  let offset = signature.length
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > buffer.length) throw new Error('PNG 数据损坏：' + fileName)
    if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      try {
        const chunk = readTextChunk(type, buffer.subarray(dataStart, dataEnd))
        if (chunk && (chunk.keyword === 'chara' || chunk.keyword === 'ccv3')) found[chunk.keyword] = chunk.text
      } catch { /* 单个块坏了继续找 */ }
    }
    if (type === 'IEND') break
    offset = dataEnd + 4
  }
  const raw = found.chara || found.ccv3
  if (!raw) throw new Error('PNG 里没有 chara / ccv3 卡片数据：' + fileName)
  const trimmed = raw.trim()
  const text = trimmed.startsWith('{') || trimmed.startsWith('[')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8')
  if (!cardNameOf(text)) throw new Error('PNG 里的卡片数据不是有效的卡片 JSON：' + fileName)
  return text
}

function readTextChunk(type, data) {
  const zero = data.indexOf(0)
  if (zero < 0) return null
  const keyword = data.toString('ascii', 0, zero)
  if (type === 'tEXt') return { keyword, text: data.toString('latin1', zero + 1) }
  if (type === 'zTXt') {
    const compressed = data.subarray(zero + 2)
    return { keyword, text: zlib.inflateSync(compressed).toString('utf8') }
  }
  // iTXt: keyword\0 compressionFlag(1) compressionMethod(1) languageTag\0 translatedKeyword\0 text
  const compressionFlag = data[zero + 1]
  let cursor = zero + 3
  const langEnd = data.indexOf(0, cursor)
  if (langEnd < 0) return null
  cursor = langEnd + 1
  const translatedEnd = data.indexOf(0, cursor)
  if (translatedEnd < 0) return null
  cursor = translatedEnd + 1
  const body = data.subarray(cursor)
  return { keyword, text: compressionFlag === 1 ? zlib.inflateSync(body).toString('utf8') : body.toString('utf8') }
}

// ── 导入 ────────────────────────────────────────────────────────────────────
function optionsForConvert(options) {
  return {
    assets: readAssets(),
    ruleProfile: options.ruleProfile === 'lite' ? 'lite' : 'full',
    selfread: options.selfread === true,
    hideInitvar: options.hideInitvar !== false,
    suffix: DERIVED_SUFFIX,
    dedupeWorldbook: options.dedupeWorldbook !== false,
  }
}

function patchRecord(file, patch = {}) {
  const { notes, meta, ...recordPatch } = patch
  const loaded = loadCard(file)
  const record = loaded.data.extensions?.dsh_mvu_conversion
  if (record && Object.keys(recordPatch).length) Object.assign(record, recordPatch)
  if (notes !== undefined) {
    const kept = String(loaded.data.creator_notes || '')
      .split('\n')
      .filter(line => !line.includes('[MVU] 本卡'))
      .join('\n')
      .replace(/\s+$/, '')
    loaded.data.creator_notes = (kept ? kept + '\n' : '') + notes
  }
  if (loaded.wrapper.meta && typeof loaded.wrapper.meta === 'object') {
    loaded.wrapper.meta.mvuPanel = { ...(loaded.wrapper.meta.mvuPanel || {}), ...(meta || {}) }
  }
  atomicWrite(file, JSON.stringify(loaded.wrapper, null, 2) + '\n')
  return loaded
}

/**
 * 导入一个上传的文件：解析 → 留底 → 转换 → 落成「原名 + mvu版」一张卡 → 记账。
 * 不写任何临时卡片（暂存文件在插件目录内，Tavern 看不见）。
 */
export function importUpload({ fileName, bytes }, options = {}) {
  const raw = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || '')
  if (!raw.length) return { ok: false, error: '文件是空的' }
  if (raw.length > MAX_UPLOAD_BYTES) return { ok: false, error: '文件超过 16 MB 上限' }
  const isPng = /\.png$/i.test(String(fileName || '')) || raw.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  let cardText
  try {
    cardText = isPng ? cardTextFromPng(raw, fileName) : raw.toString('utf8')
  } catch (error) {
    return { ok: false, error: String(error && error.message || error) }
  }
  const shownName = cardNameOf(cardText)
  if (!shownName) return { ok: false, error: '不是有效的人物卡 JSON（找不到 name）' }
  // 与 Tavern 自己的导入一致：文件名决定卡片文件名，卡片里的 name 只作为兜底
  const fileStem = safeStem(String(fileName || '').replace(/\.[^.]+$/, ''))
  let stem = fileStem && fileStem !== '未命名人物卡' ? fileStem : safeStem(shownName)
  if (stem.endsWith(DERIVED_SUFFIX.trim()) && !cardText.includes('"' + stem + '"')) {
    // 卡名本身以「mvu版」结尾：避免叠成「… mvu版 mvu版」
    stem = stem.slice(0, -DERIVED_SUFFIX.trim().length).trim() || stem
  }
  const derivedName = stem + DERIVED_SUFFIX + '.json'
  const target = path.join(cardsDir(), derivedName)
  if (fs.existsSync(target) && options.overwriteManaged !== true) {
    return { ok: false, skippable: true, error: '已存在同名 MVU 卡「' + derivedName + '」，未覆盖（可在列表里删掉再导入，或打开「覆盖已存在的 MVU 卡」）' }
  }

  const when = stamp()
  const backupTarget = ensureDir(path.join(backupsDir(), 'imported'))
  try {
    fs.writeFileSync(path.join(backupTarget, stem + '.' + when + (isPng ? '.png' : '.json')), raw)
    fs.writeFileSync(path.join(backupTarget, stem + '.' + when + '.before-mvu.json'), cardText, 'utf8')
  } catch (error) {
    logEvent('warn', 'backup-failed', { stem, error: String(error && error.message || error) })
  }

  const temp = path.join(ensureDir(stagingDir()), stem + '.' + when + '.json')
  let result
  try {
    fs.writeFileSync(temp, cardText, 'utf8')
    result = deriveCard(temp, {
      ...optionsForConvert(options),
      derivedFile: target,
      onlyIfNeeded: false,
      notesStamp: '[MVU] 本卡由 MVU 面板插件导入并转换（修订 ' + PANEL_REVISION + '）；改卡请直接用卡片工作台，改完点插件页的「刷新产物」。',
    })
  } catch (error) {
    try { fs.rmSync(temp, { force: true }) } catch { /* 忽略 */ }
    const message = String(error && error.message || error)
    logEvent('error', 'import-failed', { stem, error: message })
    return { ok: false, error: '转换失败：' + message }
  }
  try { fs.rmSync(temp, { force: true }) } catch { /* 忽略 */ }

  // 原版（缩略图 + 「恢复原版」用）：与 Tavern 自己的导入一致，按同 stem 放在 originals/cards
  try {
    const original = path.join(ensureDir(originalsDir()), stem + DERIVED_SUFFIX + (isPng ? '.png' : '.json'))
    fs.writeFileSync(original, isPng ? raw : cardText, isPng ? undefined : 'utf8')
  } catch (error) {
    logEvent('warn', 'original-write-failed', { stem, error: String(error && error.message || error) })
  }

  patchRecord(target, {
    notes: '[MVU] 本卡由 MVU 面板插件导入并转换（修订 ' + PANEL_REVISION + '）；改卡请直接用卡片工作台，改完点插件页的「刷新产物」。',
    meta: { derivedFrom: null, importedFrom: String(fileName || '') },
    derivedFrom: null,
    sourcePath: 'imported/' + String(fileName || ''),
    importedFrom: String(fileName || ''),
    importedAt: Date.now(),
  })

  const record = upsertManaged({
    key: stem + DERIVED_SUFFIX,
    stem,
    path: 'cards/' + derivedName,
    name: shownName,
    revision: PANEL_REVISION,
    sourceDigest: sha256(cardText),
    importedFrom: String(fileName || ''),
    kind: isPng ? 'png' : 'json',
    at: Date.now(),
    adopted: false,
  })
  logEvent('info', 'import-ok', { stem, file: derivedName, bytes: result.bytes, kind: isPng ? 'png' : 'json' })
  return { ok: true, key: record.key, file: derivedName, path: record.path, name: shownName, bytes: result.bytes, kind: isPng ? 'png' : 'json' }
}

// ── 刷新 / 删除 / 收养 / 清点 ────────────────────────────────────────────────
export function cardPathOf(entry) {
  return path.join(cardsDir(), path.basename(String(entry.path || entry.stem + DERIVED_SUFFIX + '.json')))
}

/** 就地重写产物（只动本插件写的东西：正则脚本、世界书条目、开场初值块、记账）。 */
export function convertFile(file, options = {}) {
  const assets = options.assets || readAssets()
  const loaded = loadCard(file)
  backup(file, loaded)
  const report = convert(loaded.data, {
    panelMarkdown: assets.panelMarkdown,
    appearanceHtml: assets.appearanceHtml,
    appearanceSourceHtml: assets.appearanceSourceHtml,
    bindingsDoc: assets.bindingsDoc,
    stateSchema: assets.stateSchema,
    updateRules: options.ruleProfile === 'lite' && assets.updateRulesLite ? assets.updateRulesLite : assets.updateRules,
    selfreadText: assets.selfreadText,
    includeSelfread: options.selfread === true,
    hideInitvar: options.hideInitvar !== false,
    sourcePath: options.sourcePath || loaded.data?.extensions?.dsh_mvu_conversion?.sourcePath || '',
    sourceRevision: sourceDigest(loaded.data),
    requestHash: '',
    ruleProfile: options.ruleProfile === 'lite' ? 'lite' : 'full',
    derivedFrom: options.derivedFrom || null,
    notesStamp: '',
    dedupeWorldbook: options.dedupeWorldbook !== false,
  })
  if (report.worldbookDedupe && report.worldbookDedupe.changed.length) {
    logEvent('info', 'worldbook-dedupe', {
      file: path.basename(file),
      count: report.worldbookDedupe.changed.length,
      savedChars: report.worldbookDedupe.savedChars,
      entries: report.worldbookDedupe.changed.map(item => item.comment || String(item.id)),
    })
  }  syncFlatMirror(loaded.wrapper)
  atomicWrite(file, JSON.stringify(loaded.wrapper, null, 2) + '\n')
  return report
}

/** 重新注入产物（改过卡、换过修订、产物被别处清掉都走这里）。原卡其余内容不动。 */
export function refreshManaged(entry, options = {}) {
  const file = cardPathOf(entry)
  if (!fs.existsSync(file)) {
    logEvent('warn', 'refresh-missing', { file: path.basename(file) })
    return { ok: false, error: '卡片文件不存在：' + path.basename(file) }
  }
  try {
    const report = convertFile(file, optionsForConvert(options))
    const record = upsertManaged({ ...entry, revision: PANEL_REVISION, at: Date.now() })
    logEvent('info', 'refresh-ok', { file: path.basename(file), updateRules: report.updateRuleChars, entries: report.entries, scripts: report.scripts })
    return { ok: true, file: path.basename(file), report, key: record.key }
  } catch (error) {
    const message = String(error && error.message || error)
    logEvent('error', 'refresh-failed', { file: path.basename(file), error: message })
    return { ok: false, error: message }
  }
}

/** 删除自己管的卡。默认**不留底**（R32 起按用户要求）；传 backup: true 才写 backups/removed/。 */
export function deleteManaged(entry, options = {}) {
  const file = cardPathOf(entry)
  const stem = String(entry.stem || '')
  try {
    if (fs.existsSync(file)) {
      if (options.backup === true) {
        const when = stamp()
        const dir = ensureDir(path.join(backupsDir(), 'removed'))
        fs.writeFileSync(path.join(dir, path.basename(file, '.json') + '.' + when + '.json'), fs.readFileSync(file))
      }
      fs.rmSync(file)
    }
    for (const ext of ['.png', '.json']) {
      const original = path.join(originalsDir(), stem + DERIVED_SUFFIX + ext)
      if (fs.existsSync(original)) fs.rmSync(original)
    }
    dropManaged(entry.key || stem + DERIVED_SUFFIX)
    logEvent('info', 'delete-ok', { stem })
    return { ok: true, stem }
  } catch (error) {
    const message = String(error && error.message || error)
    logEvent('error', 'delete-failed', { stem, error: message })
    return { ok: false, error: message }
  }
}

/** 导出一张自己管的卡：小卡把 base64 交给浏览器下载，大卡写到插件 exports/ 并回报路径。 */
export function exportManaged(entry, options = {}) {
  const file = cardPathOf(entry)
  if (!fs.existsSync(file)) return { ok: false, error: '卡片文件不存在：' + path.basename(file) }
  try {
    const bytes = fs.readFileSync(file)
    const base64 = bytes.toString('base64')
    // handle 返回值上限 4 MB（接口文档）；base64 会膨胀 4/3，留出余量
    const limit = Number(options.limit) || 3_500_000
    if (base64.length <= limit) {
      logEvent('info', 'export-ok', { file: path.basename(file), bytes: bytes.length })
      return { ok: true, file: path.basename(file), bytes: bytes.length, base64 }
    }
    const target = path.join(ensureDir(path.join(pluginRoot(), 'exports')), path.basename(file))
    fs.writeFileSync(target, bytes)
    logEvent('info', 'export-file', { file: path.basename(file), bytes: bytes.length, path: target })
    return { ok: true, file: path.basename(file), bytes: bytes.length, path: target, tooBig: true }
  } catch (error) {
    const message = String(error && error.message || error)
    logEvent('error', 'export-failed', { file: path.basename(file), error: message })
    return { ok: false, error: message }
  }
}

/** 显式清理「遗留源卡」：只在调用方明确点名时执行，先留底。 */
export function deleteLegacySource(stem) {
  const file = path.join(cardsDir(), safeStem(stem) + '.json')
  if (!fs.existsSync(file)) return { ok: false, error: '源卡不存在：' + path.basename(file) }
  try {
    const when = stamp()
    const dir = ensureDir(path.join(backupsDir(), 'removed'))
    fs.writeFileSync(path.join(dir, path.basename(file, '.json') + '.' + when + '.json'), fs.readFileSync(file))
    fs.rmSync(file)
    for (const ext of ['.png', '.json']) {
      const original = path.join(originalsDir(), safeStem(stem) + ext)
      if (fs.existsSync(original)) fs.rmSync(original)
    }
    logEvent('info', 'cleanup-source-ok', { stem })
    return { ok: true, stem }
  } catch (error) {
    const message = String(error && error.message || error)
    logEvent('error', 'cleanup-source-failed', { stem, error: message })
    return { ok: false, error: message }
  }
}

function recordOf(file) {
  try {
    const loaded = loadCard(file)
    const record = loaded.data?.extensions?.dsh_mvu_conversion
    return {
      file,
      name: loaded.name,
      managedBy: record && typeof record.managedBy === 'string' ? record.managedBy : '',
      revision: record && typeof record.panelRevision === 'string' ? record.panelRevision : '',
      derivedFrom: record && typeof record.derivedFrom === 'string' ? record.derivedFrom : '',
      fields: record?.definition?.elementSchema?.['/档案卡']?.fields ? Object.keys(record.definition.elementSchema['/档案卡'].fields).length : 0,
    }
  } catch (error) {
    return { file, name: path.basename(file, '.json'), managedBy: '', revision: '', derivedFrom: '', error: String(error && error.message || error) }
  }
}

function listCardFiles() {
  const dir = cardsDir()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(name => name.toLowerCase().endsWith('.json')).map(name => path.join(dir, name)).sort()
}

/**
 * 一次收养：把「本插件产物、但不在台账里」的卡登记进台账（升级/重装后认得旧卡），
 * 并把老插件留下的产物单列成 legacy（只展示，不自动改）。
 */
export function adoptAndSurvey() {
  // 卡片被外部删掉（例如在原生卡片库里删了）→ 直接从台账里移除，不在插件页留「缺失」行
  for (const [key, entry] of Object.entries(readLedger().cards || {})) {
    if (!fs.existsSync(cardPathOf(entry))) {
      dropManaged(key)
      logEvent('info', 'forget-missing', { key })
    }
  }
  const ledger = readLedger()
  const adopted = []
  const managed = []
  const legacy = []
  for (const file of listCardFiles()) {
    const info = recordOf(file)
    if (info.managedBy === MANAGED_BY) {
      const key = path.basename(file, '.json')
      if (!ledger.cards[key]) {
        const entry = upsertManaged({ key, stem: key.replace(new RegExp(DERIVED_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), ''), path: 'cards/' + path.basename(file), name: info.name, revision: info.revision, at: Date.now(), adopted: true })
        adopted.push(entry)
      }
      managed.push({ key, file: path.basename(file), name: info.name, revision: info.revision, fields: info.fields, path: 'cards/' + path.basename(file) })
    } else if (info.managedBy === LEGACY_MANAGED_BY) {
      legacy.push({ file: path.basename(file), name: info.name, revision: info.revision, kind: 'old-plugin', path: 'cards/' + path.basename(file) })
    }
  }
  const fresh = readLedger()
  const rows = Object.values(fresh.cards).map(entry => {
    const file = cardPathOf(entry)
    const exists = fs.existsSync(file)
    const info = exists ? recordOf(file) : null
    return {
      key: entry.key,
      stem: entry.stem,
      file: path.basename(file),
      path: entry.path,
      name: info?.name || entry.name || entry.stem,
      revision: info?.revision || '',
      fields: info?.fields || 0,
      missing: !exists,
      stale: Boolean(info) && info.revision !== PANEL_REVISION,
      intact: Boolean(info) && info.managedBy === MANAGED_BY,
      adopted: entry.adopted === true,
      derivedFrom: info?.derivedFrom || '',
      at: entry.at || 0,
    }
  }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'))
  if (adopted.length) logEvent('info', 'adopt', { count: adopted.length, keys: adopted.map(item => item.key) })
  return { managed: rows, legacy, adopted: adopted.length }
}
