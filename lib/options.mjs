/**
 * 插件设置：存在插件自己的 options.json（文档《插件存档数据》一节：插件自己的设置、
 * 跨局共享的东西用 DSH 的设置区或插件自己的存储）。
 *
 * 用文件而不是 DSH 内部设置包，好处：插件不 import 任何 @deepseek-ai/*，
 * 放进 data/plugins/ 后不依赖模块解析；用户也能直接编辑这个文件。
 *
 * R32：选项随新模型调整 —— 去掉「导入即自动派生」「skip-converted / adopt-native」
 * （插件不再扫描 cards/），改成「只监视自己管理的卡」「覆盖已存在的 MVU 卡」。
 */
import fs from 'node:fs'
import path from 'node:path'
import { pluginRoot } from './cardfile.js'

// R36：头像改成「按卡本地图片目录 + 面板按 URL 引用」：只留 avatarRoot（一级图片目录，空 = <tavern data>/avatar-images）。
// 旧的 avatars / avatarDir / avatarMaxKB / avatarUpload 已删除（图片不再内嵌进卡，也没有上传开关）。
export const OPTIONS_FILE = 'options.json'

export const DEFAULT_OPTIONS = {
  enabled: true,
  watchManaged: true,
  overwriteManaged: false,
  ruleProfile: 'full',
  selfread: false,
  hideInitvar: true,
  dedupeWorldbook: true,
  avatarRoot: '',
}

export function optionsPath() {
  return process.env.DSH_MVU_PANEL_OPTIONS || path.join(pluginRoot(), OPTIONS_FILE)
}

export function normalizeOptions(value) {
  const raw = value && typeof value === 'object' ? value : {}
  return {
    enabled: raw.enabled !== false,
    watchManaged: raw.watchManaged !== false,
    overwriteManaged: raw.overwriteManaged === true,
    ruleProfile: raw.ruleProfile === 'lite' ? 'lite' : 'full',
    selfread: raw.selfread === true,
    hideInitvar: raw.hideInitvar !== false,
    dedupeWorldbook: raw.dedupeWorldbook !== false,
    avatarRoot: typeof raw.avatarRoot === 'string' ? raw.avatarRoot.trim() : '',
  }
}

/** 只有这几项变化才需要重写 MVU 卡；文件里的其他字段（例如说明）随意改不触发重算。 */
export function functionalSignature(value) {
  return JSON.stringify(normalizeOptions(value))
}

function readFileOptions() {
  try {
    return JSON.parse(fs.readFileSync(optionsPath(), 'utf8'))
  } catch {
    return null
  }
}

/** 文件优先：用户改过的 options.json 覆盖启动配置；文件不存在时按默认值建出来。 */
export function loadOptions(config = {}) {
  const file = readFileOptions()
  const merged = normalizeOptions({ ...DEFAULT_OPTIONS, ...(config && typeof config === 'object' ? config : {}), ...(file || {}) })
  if (!file) {
    try {
      fs.writeFileSync(optionsPath(), JSON.stringify(merged, null, 2) + '\n', 'utf8')
    } catch { /* 建不出来就只用内存值 */ }
  }
  return merged
}

export function saveOptions(options) {
  const value = normalizeOptions(options)
  try {
    fs.writeFileSync(optionsPath(), JSON.stringify(value, null, 2) + '\n', 'utf8')
  } catch { /* 写不动不致命 */ }
  return value
}
