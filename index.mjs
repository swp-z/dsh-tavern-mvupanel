/**
 * dsh-tavern-mvupanel —— Tavern「MVU 面板」插件 · 宿主半（R32 新模型）
 *
 * 新模型（任务 1 起）：**只在插件页导入**。
 *   导入（可批量）→ 纯程序转换 → 落地成「原名 mvu版.json」一张卡 → 台账记账。
 *   插件**不再监视目录、不再判断**原生按钮导入的卡：那些卡一字节都不碰。
 *   由来：原生选择器里没有插件接口（行内按钮 / 合并同源卡 / 开局 API 都没有），
 *   所以把「导入 + 转换」整体搬到插件页，原生窗口只负责显示和开局。
 *
 * 接口用法（《DSH Tavern 插件开发：接口参考》第 2 版）：
 *   - 宿主半用 ctx.tavern.handle() 暴露操作，浏览器半用 tavernUi.callHost() 调回来；
 *   - 单次 callHost 参数上限 256 KB，所以大文件分块传输（CHUNK_BYTES = 72 KB）；
 *   - 设置存插件自己的 options.json；定时器用 ctx.effect 注册清理。
 *
 * 明确保留的接口外依赖（文档《暂时没有的》：没有开放卡片读写 / 转换接口）：
 *   读写 <tavern data>/resources/cards/*.json 与 originals/cards/*，全部集中在 lib/import.mjs 与
 *   lib/cardfile.js；将来 Tavern 开放卡片接口时只需替换这两个文件。
 */
import fs from 'node:fs'
import { PANEL_REVISION } from './lib/artifacts.js'
import { DERIVED_SUFFIX, cardsDir, pluginRoot } from './lib/cardfile.js'
import {
  CHUNK_BYTES, MAX_UPLOAD_BYTES, adoptAndSurvey, cardPathOf, deleteLegacySource, deleteManaged,
  avatarDir, avatarSync, avatarClear, importUpload, readCardOrganization, exportManaged, logEvent, readLedger, readLogTail, recentEvents, refreshManaged, moveCardsToGroup,
} from './lib/import.mjs'
import { sweepLegacy, avatarRootDir } from './lib/avatars.js'
import { DEFAULT_OPTIONS, functionalSignature, loadOptions, normalizeOptions, saveOptions } from './lib/options.mjs'

export const name = 'dsh-tavern-mvupanel'
/** 转换与导入都是纯文件操作；桥接在 apply 里按需注入，Tavern 服务缺失也不影响导入。 */
export const inject = []

const HANDLE = 'dsh-tavern-mvupanel'
/** 定时巡检：两件轻活 —— 修订落后就刷新、自己管的卡产物被改掉就补回 */
const MANAGE_INTERVAL_MS = Math.max(2000, Number(process.env.DSH_MVU_PANEL_INTERVAL_MS) || 5000)
const CHUNKS_PER_UPLOAD = Math.ceil(MAX_UPLOAD_BYTES / CHUNK_BYTES) + 8
/** 「图片上传」一次最多几张（每张另有 avatarMaxKB 上限） */
const MAX_AVATAR_FILES = 24

export function apply(ctx, config = {}) {
  let options = loadOptions(config)
  let signature = functionalSignature(options)
  const uploads = new Map()
  const seen = new Map()
  let applying = false

  const log = (level, message, detail) => {
    try {
      const logger = ctx.logger || console
      const fn = typeof logger[level] === 'function' ? logger[level] : logger.info
      if (typeof fn === 'function') fn.call(logger, `${name}: ${message}`)
    } catch { /* 日志失败不影响功能 */ }
    logEvent(level, 'host', { message, ...(detail && typeof detail === 'object' ? detail : {}) })
  }

  function statusPayload(extra = {}) {
    const ledger = readLedger()
    const survey = adoptAndSurvey()
    return {
      plugin: name,
      revision: PANEL_REVISION,
      suffix: DERIVED_SUFFIX,
      options,
      cardsDir: cardsDir(),
      pluginRoot: pluginRoot(),
      ledgerCount: Object.keys(ledger.cards || {}).length,
      groups: readCardOrganization().groups,
      adopted: survey.adopted,
      managed: survey.managed,
      legacy: survey.legacy,
      events: recentEvents(60),
      limits: { chunkBytes: CHUNK_BYTES, maxUploadBytes: MAX_UPLOAD_BYTES },
      // 客户端 v8 起靠 row.cover 画宫格封面：旧宿主没有这个字段，用它判断「宿主半还没重启」
      coverReady: true,
      ...extra,
    }
  }

  /** 巡检：修订落后必刷；开着「只监视自己管理的卡」时，产物被改掉也补回来。 */
  function manageTick(reason) {
    if (applying || options.enabled === false) return
    applying = true
    try {
      const ledger = readLedger()
      for (const entry of Object.values(ledger.cards || {})) {
        const file = cardPathOf(entry)
        if (!fs.existsSync(file)) { seen.delete(entry.key); continue }
        let stat
        try { stat = fs.statSync(file) } catch { continue }
        const marker = `${stat.mtimeMs}:${stat.size}`
        const staleRevision = entry.revision !== PANEL_REVISION
        const changed = seen.get(entry.key) !== marker
        if (!staleRevision && !changed) continue
        if (!staleRevision && changed) {
          // 文件被改过：产物还完整就什么都不做（避免每次手改都整卡重写）
          try {
            const text = fs.readFileSync(file, 'utf8')
            if (text.includes('"managedBy": "dsh-tavern-mvupanel"') && text.includes(`"panelRevision": "${PANEL_REVISION}"`)) {
              seen.set(entry.key, marker)
              continue
            }
          } catch { /* 读不动就走刷新 */ }
        }
        const result = refreshManaged(entry, options)
        log('info', `产物${staleRevision ? '随修订升级刷新' : '已补回'}：${entry.key}`, { reason, ok: result.ok, error: result.error || '' })
        try {
          const next = fs.statSync(file)
          seen.set(entry.key, `${next.mtimeMs}:${next.size}`)
        } catch { /* 忽略 */ }
      }
    } catch (error) {
      log('warn', '巡检失败', { error: String(error && error.message || error) })
    } finally {
      applying = false
    }
  }

  // ── 启动：收养旧产物 + 对齐修订 ──────────────────────────────────────────
  // 「图片上传」承诺不留底：先把上次异常退出残留的临时图片清掉
  try { sweepLegacy() } catch { /* 清不掉不影响启动 */ }
  const boot = adoptAndSurvey()
  log('info', `已就绪（模型 R32）：卡片目录 ${cardsDir()} · 台账 ${Object.keys(readLedger().cards || {}).length} 张 · 新收养 ${boot.adopted} 张 · 遗留 ${boot.legacy.length} 张`)
  manageTick('startup')

  const timer = setInterval(() => manageTick('tick'), MANAGE_INTERVAL_MS)

  // ── 浏览器半的桥（第 2 版接口：ctx.tavern.handle ↔ tavernUi.callHost）──────
  if (typeof ctx.inject === 'function') {
    ctx.inject(['tavern'], tavernCtx => {
      const tavern = tavernCtx.tavern
      if (!tavern) return
      const apiVersion = Number(tavern.apiVersion)
      if (Number.isFinite(apiVersion) && apiVersion < 2) {
        log('warn', `Tavern 插件接口版本 ${apiVersion} < 2，不注册导入桥（文件层面的转换仍可用）`)
        return
      }
      const register = (handleName, handler) => tavern.handle(`${HANDLE}/${handleName}`, handler)
      try {
        register('status', async () => statusPayload())

        register('set-options', async args => {
          const patch = args && typeof args === 'object' && args.patch && typeof args.patch === 'object' ? args.patch : (args || {})
          options = saveOptions({ ...options, ...patch })
          signature = functionalSignature(options)
          log('info', `设置已更新：${signature}`)
          manageTick('options')
          return statusPayload()
        })

        // 分块上传：begin → chunk* → end（单次 callHost 参数上限 256 KB）
        register('import-begin', async args => {
          const id = String(args && args.id || '')
          const fileName = String(args && args.fileName || '')
          const size = Number(args && args.size) || 0
          if (!id) throw new Error('缺少上传 id')
          if (options.enabled === false) throw new Error('插件已在设置里关闭')
          if (size > MAX_UPLOAD_BYTES) throw new Error(`文件 ${fileName} 超过 16 MB 上限`)
          uploads.set(id, { fileName, chunks: [], size, received: 0, at: Date.now() })
          return { ok: true, id, chunkBytes: CHUNK_BYTES }
        })

        register('import-chunk', async args => {
          const id = String(args && args.id || '')
          const upload = uploads.get(id)
          if (!upload) throw new Error('上传会话已失效，请重新选择文件')
          const index = Number(args && args.index)
          if (!Number.isInteger(index) || index < 0 || index > CHUNKS_PER_UPLOAD) throw new Error('分块序号无效')
          const data = String(args && args.data || '')
          if (data.length > CHUNK_BYTES * 2) throw new Error('分块过大')
          upload.chunks[index] = data
          upload.received = (upload.received || 0) + data.length
          return { ok: true, received: upload.received }
        })

        register('import-end', async args => {
          const id = String(args && args.id || '')
          const upload = uploads.get(id)
          if (!upload) throw new Error('上传会话已失效，请重新选择文件')
          uploads.delete(id)
          const joined = upload.chunks.filter(chunk => typeof chunk === 'string').join('')
          const bytes = Buffer.from(joined, 'base64')
          if (!bytes.length) return { ok: false, error: '收到的文件是空的' }
          if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: '文件超过 16 MB 上限' }
          const result = importUpload({ fileName: upload.fileName, bytes }, options)
          if (!result.ok) log('warn', `导入失败：${upload.fileName}`, { error: result.error })
          return { ...result, status: statusPayload() }
        })

        register('import-cancel', async args => {
          uploads.delete(String(args && args.id || ''))
          return { ok: true }
        })

        register('refresh', async args => {
          const key = String(args && args.key || '')
          const entry = readLedger().cards[key]
          if (!entry) return { ok: false, error: '台账里没有这张卡：' + key }
          const result = refreshManaged(entry, options)
          return { ...result, status: statusPayload() }
        })

        register('export', async args => {
          const key = String(args && args.key || '')
          const entry = readLedger().cards[key]
          if (!entry) return { ok: false, error: '台账里没有这张卡：' + key }
          return exportManaged(entry)
        })

        register('remove', async args => {
          const key = String(args && args.key || '')
          const entry = readLedger().cards[key]
          if (!entry) return { ok: false, error: '台账里没有这张卡：' + key }
          const result = deleteManaged(entry)
          return { ...result, status: statusPayload() }
        })

        register('refresh-file', async args => {
          const file = String(args && args.file || '')
          if (!file) return { ok: false, error: '缺少文件名' }
          const basename = file.split('/').pop()
          const stem = basename.replace(/\.json$/i, '')
          const known = Object.values(readLedger().cards || {}).find(entry => entry.path === 'cards/' + basename || entry.key === stem)
          const entry = known || { key: stem, stem, path: 'cards/' + basename, at: Date.now() }
          const result = refreshManaged(entry, options)
          return { ...result, status: statusPayload() }
        })
        register('cleanup-source', async args => {
          const stem = String(args && args.stem || '')
          if (!stem) return { ok: false, error: '缺少源卡名' }
          const result = deleteLegacySource(stem)
          return { ...result, status: statusPayload() }
        })


        // 按卡头像（R36）：图片在本地目录，卡里只写相对 URL —— 图片/同步/清空三个动作
        register('avatar-dir', async args => {
        	if (options.enabled === false) throw new Error('插件已在设置里关闭')
        	const result = avatarDir(String(args && args.key || ''), options)
        	if (!result.ok) throw new Error(result.error || '打开图片目录失败')
        	log('info', '已打开图片目录：' + result.dir, { files: result.files })
        	return { ...result, status: statusPayload() }
        })

        register('avatar-sync', async args => {
        	if (options.enabled === false) throw new Error('插件已在设置里关闭')
        	const result = avatarSync(String(args && args.key || ''), options)
        	if (!result.ok) throw new Error(result.error || '同步失败')
        	log('info', '已同步头像：' + String(args && args.key || ''), { names: result.names, skipped: result.skipped })
        	return { ...result, status: statusPayload() }
        })

        register('avatar-clear', async args => {
        	if (options.enabled === false) throw new Error('插件已在设置里关闭')
        	const result = avatarClear(String(args && args.key || ''), options)
        	if (!result.ok) throw new Error(result.error || '清空失败')
        	log('info', '已清空头像引用：' + String(args && args.key || ''), {})
        	return { ...result, status: statusPayload() }
        })

        // 批量管理：移动分组（写 Tavern 的 card-organization.json，与人物卡库同一份）
        register('organize-move', async args => {
        	const result = moveCardsToGroup(args && args.paths, args && args.group, { createGroup: args && args.createGroup === true })
        	if (!result.ok) throw new Error(result.error || '移动分组失败')
        	log('info', '移动分组：' + result.moved + ' 张 → ' + (result.group || '未分组'), { group: result.group })
        	return { ...result, status: statusPayload() }
        })

        // 图片目录监听（R36）：某张卡的目录里有变化（新增/覆盖/删除/改名）→ 去抖 1.2s 后只同步那一张卡
        try {
        	const root = avatarRootDir(options)
        	fs.mkdirSync(root, { recursive: true })
        	let pending = new Set()
        	let timer = null
        	const watcher = fs.watch(root, { recursive: true }, (event, name) => {
        		const stem = String(name || '').split(/[\\/]/)[0]
        		if (!stem) return
        		pending.add(stem)
        		if (timer) clearTimeout(timer)
        		timer = setTimeout(() => {
        			const list = [...pending]
        			pending = new Set()
        			timer = null
        			for (const one of list) {
        				try {
        					const result = avatarSync(one, options)
        					if (result.ok) log('info', '图片目录有变动，已自动同步：' + one, { names: result.names, changed: result.changed })
        					else log('warn', '自动同步跳过：' + one, { error: result.error })
        				} catch (error) {
        					log('warn', '自动同步失败：' + one, { error: String(error && error.message || error) })
        				}
        			}
        		}, 1200)
        	})
        	log('info', '图片目录监听已启动：' + root)
        	if (typeof ctx.effect === 'function') ctx.effect(() => () => { try { watcher.close() } catch { /* 忽略 */ } })
        } catch (error) {
        	log('warn', '图片目录监听没起来（可以手动点「同步」）', { error: String(error && error.message || error) })
        }

        register('log-tail', async args => ({ lines: readLogTail(Number(args && args.limit) || 200) }))

        log('info', `导入桥已注册：${HANDLE}/{status,set-options,import-begin,import-chunk,import-end,avatar-dir,avatar-sync,avatar-clear,refresh,refresh-file,export,remove,cleanup-source,log-tail}`)
      } catch (error) {
        log('warn', `注册导入桥失败：${String(error && error.message || error)}`)
      }
    })
  } else {
    log('warn', '当前 Runtime 没有 ctx.inject，跳过导入桥（文件层面的转换仍可用）')
  }

  // ── 卸载时释放（文档要求：定时器、连接用 ctx.effect 注册清理）──────────────
  const dispose = () => {
    clearInterval(timer)
    uploads.clear()
    log('info', '已停止：定时巡检与上传缓冲已释放')
  }
  if (typeof ctx.effect === 'function') ctx.effect(() => dispose)
  else if (typeof ctx.on === 'function') ctx.on('dispose', dispose)
}

export { DEFAULT_OPTIONS, normalizeOptions }
