// lib/avatars.js — 角色头像（按卡本地图片目录；R36）
//
// 与 R34/R35 的根本区别：**图片不再内嵌进卡片**。
//   卡里只存「相对 URL」：/api/dsh-tavern/plugin-assets/dsh-tavern-mvupanel/avatars/<卡>/<文件>
//   面板 iframe 用 <img src> 直接加载（该路由按请求读盘，换图不用重启；不透明源也能取）。
//   ⇒ 卡体积不随图片增长；用户在文件夹里加/换/删图，点「同步」即生效。
//
// 目录约定：
//   一级根目录：options.avatarRoot，默认 <tavern data>/avatar-images（宿主数据根下，同盘 → 硬链接零空间）
//   每卡二级目录：<root>/<卡 stem>/
//   对外发布目录：<插件>/assets/avatars/<卡 stem>/（硬链接优先，跨盘回退复制；多余链接会被清掉）
//
// 文件名 → 角色名 / 变体：
//   "莉莉丝.jpg"      → 名字「莉莉丝」，无变体
//   "莉莉丝-泳装.jpg"  → 名字「莉莉丝」，变体「泳装」（- _ — 空格 都算分隔，取最后一段）
//
// 面板端：assets/panel.md 里常驻头像能力（空表 + 判空全隐藏），唯一写入点 injectAvatarRefs()。
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

// 自带路径解析（不从 cardfile.js 导入，避免循环依赖；两处环境都能用）：
//   正式位置 = <plugin>/lib/avatars.js → pluginRoot = ..；tavernData = ../..
//   试点位置 = 素材库目录 → 用环境变量指到真插件与宿主数据根
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
export function pluginRoot() { return process.env.DSH_MVU_PANEL_PLUGIN_ROOT || path.resolve(HERE, '..') }
export function tavernDataDir() { return process.env.DSH_MVU_PANEL_DATA_DIR || path.resolve(pluginRoot(), '..', '..') }

export const PLUGIN_NAME = 'dsh-tavern-mvupanel'
export const ASSETS_SUBDIR = 'avatars'
export const AVATAR_PUBLIC_PREFIX = '/api/dsh-tavern/plugin-assets/' + PLUGIN_NAME + '/' + ASSETS_SUBDIR + '/'
const AV_MARK = 'window.__mvuAvatars='
const IMG_RE = /\.(jpe?g|png|webp|gif|avif)$/i
const SEPARATORS = /[-_—–\s\u3000]+/u

/** 一级根目录（空串 = 默认放在宿主数据根下）。 */
export function avatarRootDir(options = {}) {
  const custom = String(options.avatarRoot || '').trim()
  return custom ? path.resolve(custom) : path.join(tavernDataDir(), 'avatar-images')
}

/** 路径段清洗：去掉 Windows 非法字符与开头的点（宿主路由拒绝含 \\ / : 或以 . 开头的段）。 */
export function safeSegment(value) {
  const text = String(value == null ? '' : value)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '_')
    .trim()
    .slice(0, 120)
  return text || 'card'
}

export function cardDirOf(root, stem) { return path.join(root, safeSegment(stem)) }
export function publishDirOf(stem) { return path.join(pluginRoot(), 'assets', ASSETS_SUBDIR, safeSegment(stem)) }

/** 对外 URL（根相对，按段编码）。 */
export function publicUrl(stem, file) {
  return AVATAR_PUBLIC_PREFIX + encodeURIComponent(safeSegment(stem)) + '/' + encodeURIComponent(String(file))
}

const VARIANTS_SPLIT = /[.．·,，|/、]+/u

/** 变体名 → 同义词列表：「水衣.泳装.比基尼」→ ['水衣','泳装','比基尼']（命中任意一项即匹配）。 */
export function variantTokens(variant) {
  return String(variant || '').split(VARIANTS_SPLIT).map(item => item.trim()).filter(Boolean)
}

/** 文件名 → { name, variant, tokens, file }；不是图片返回 null。 */
export function parseImageName(fileName) {
  const base = path.basename(String(fileName || ''))
  if (!IMG_RE.test(base)) return null
  const stem = base.replace(/\.[^.]+$/, '').trim()
  if (!stem) return null
  const parts = stem.split(SEPARATORS).filter(Boolean)
  if (parts.length >= 2) {
    const variant = parts[parts.length - 1]
    const name = stem.slice(0, stem.lastIndexOf(variant)).replace(SEPARATORS, ' ').trim()
    if (name && variant) return { name, variant, tokens: variantTokens(variant), file: base }
  }
  return { name: stem, variant: '', tokens: [], file: base }
}

export function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }) } catch { /* 由后续调用报错 */ }
  return dir
}

/** 扫一张卡的目录：返回 { refs, files, skipped }，refs = { 名字: { 变体: 相对URL } }。 */
export function scanCardDir(root, stem) {
  const dir = cardDirOf(root, stem)
  const refs = {}
  const files = []
  const skipped = []
  let names = []
  try { names = fs.readdirSync(dir) } catch { return { dir, refs, files, skipped: ['目录不存在'] } }
  for (const name of names.sort()) {
    if (name.startsWith('.')) continue
    const parsed = parseImageName(name)
    if (!parsed) { skipped.push(name + '(不是图片)'); continue }
    let stat
    try { stat = fs.statSync(path.join(dir, name)) } catch { skipped.push(name + '(读不到)'); continue }
    if (!stat.isFile()) { skipped.push(name + '(不是文件)'); continue }
    refs[parsed.name] = refs[parsed.name] || {}
    refs[parsed.name][parsed.variant] = publicUrl(stem, name)
    files.push(name)
  }
  return { dir, refs, files, skipped }
}

function sameFile(a, b) {
  try { const sa = fs.statSync(a), sb = fs.statSync(b); return sa.ino === sb.ino && sa.dev === sb.dev } catch { return false }
}

/** 把这一卡的图发布到 <插件>/assets/avatars/<卡>/（硬链接优先，跨盘复制；不再需要的链接清掉）。 */
export function publishCardImages(root, stem, files) {
  const from = cardDirOf(root, stem)
  const to = publishDirOf(stem)
  const report = { dir: to, linked: 0, copied: 0, pruned: 0, failed: [] }
  if (!files.length) {
    try { if (fs.existsSync(to)) { fs.rmSync(to, { recursive: true, force: true }); report.pruned = -1 } } catch { /* 忽略 */ }
    return report
  }
  ensureDir(to)
  const want = new Set(files.map(name => safeSegment(name)))
  for (const name of files) {
    const source = path.join(from, name)
    const target = path.join(to, safeSegment(name))
    try {
      if (fs.existsSync(target) && sameFile(source, target)) continue
      if (fs.existsSync(target)) fs.rmSync(target, { force: true })
      try { fs.linkSync(source, target); report.linked += 1 } catch { fs.copyFileSync(source, target); report.copied += 1 }
    } catch (error) {
      report.failed.push(name + '：' + String(error && error.message || error))
    }
  }
  // 清掉已经不在目录里的旧链接（用户删图后同步）
  try {
    for (const name of fs.readdirSync(to)) {
      if (!want.has(name)) { fs.rmSync(path.join(to, name), { force: true }); report.pruned += 1 }
    }
  } catch { /* 忽略 */ }
  return report
}

/** 从面板 HTML 里取回引用表（兼容 R34/R35 的 data URL 形状）。 */
export function extractAvatarRefs(panelMarkdown) {
  const text = String(panelMarkdown || '')
  const mark = text.indexOf(AV_MARK)
  if (mark < 0) return {}
  const start = text.indexOf('{', mark)
  if (start < 0) return {}
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const ch = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          const raw = JSON.parse(text.slice(start, index + 1))
          const out = {}
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            for (const [name, value] of Object.entries(raw)) {
              if (typeof value === 'string') out[name] = { '': value }
              else if (value && typeof value === 'object') {
                const variants = {}
                for (const [variant, url] of Object.entries(value)) if (typeof url === 'string') variants[variant] = url
                out[name] = variants
              }
            }
          }
          return out
        } catch { return {} }
      }
    }
  }
  return {}
}

/** 唯一写入点：把面板里的 window.__mvuAvatars 换成给定引用表。 */
export function injectAvatarRefs(panelMarkdown, refs) {
  let text = String(panelMarkdown || '')
  const map = refs && typeof refs === 'object' ? refs : {}
  const json = JSON.stringify(map)
  if (/\$\$|\$&|\$\d|\$<|\$`|\$'/.test(json)) throw new Error('头像引用里出现会被正则替换改写的 $ 序列')
  const literal = AV_MARK + json + ';'
  const mark = text.indexOf(AV_MARK)
  if (mark < 0) throw new Error('面板资产里找不到 window.__mvuAvatars 写入点（assets/panel.md 未烘焙头像能力？）')
  const start = text.indexOf('{', mark)
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const ch = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        let end = index + 1
        if (text[end] === ';') end += 1
        return text.slice(0, mark) + literal + text.slice(end)
      }
    }
  }
  throw new Error('面板资产里的 window.__mvuAvatars 不是完整对象')
}

/** 用资源管理打开这张卡的图片目录（宿主侧 spawn；失败返回 false，调用方改给路径让用户自己开）。 */
export function openDir(dir) {
  try { ensureDir(dir) } catch { return { ok: false, error: '目录建不出来' } }
  if (process.platform !== 'win32') return { ok: false, error: '只在 Windows 下自动打开' }
  try {
    const child = spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' })
    child.unref()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error && error.message || error) }
  }
}

/** 清掉 R34/R35 遗留的上传临时目录（那时图片会临时落盘再内嵌）。 */
export function sweepLegacy() {
  try { fs.rmSync(path.join(pluginRoot(), 'avatar-tmp'), { recursive: true, force: true }); return true } catch { return false }
}

/** 引用表的摘要（用于「有没有变化要不要重转」）。 */
export function refsDigest(refs) {
  return JSON.stringify(refs && typeof refs === 'object' ? refs : {})
}


/** 兼容旧调用：从卡数据里取回引用表。 */
export function panelMapOf(data) {
  try {
    const scripts = data && data.extensions && Array.isArray(data.extensions.regex_scripts) ? data.extensions.regex_scripts : []
    const view = scripts.find(item => item && item.id === 'dsh-mvu-status-view')
    return view ? extractAvatarRefs(view.replaceString) : {}
  } catch { return {} }
}

/** 兼容旧名：清掉 R34/R35 遗留的上传临时目录。 */
export const sweepAvatarTemp = sweepLegacy

/** 扫目录 + 发布 + 返回引用表（转换路径统一入口）。 */
export function refsForCard(stem, options = {}) {
  const root = avatarRootDir(options)
  const scan = scanCardDir(root, stem)
  const report = publishCardImages(root, stem, scan.files)
  return { root, dir: scan.dir, refs: scan.refs, files: scan.files, skipped: scan.skipped, report }
}
