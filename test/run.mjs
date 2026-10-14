/**
 * 自检：不需要 Tavern、不需要真实人物卡、不联网。
 *
 * 跑法：  node test/run.mjs
 * 退出码：0 = 全部通过；1 = 有失败（明细打在 stdout 的 JSON 里）。
 *
 * 覆盖：导入（JSON）、重名保护、覆盖导入、产物结构（R32 面板 / 23 字段 / 具名正则 / 三条世界书条目）、
 *       导出（base64 往返 + 超大走文件）、台账、删除、卡片被外部删掉后的台账清理。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN = path.resolve(ROOT, '..')
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-tavern-mvupanel-test-'))

process.env.DSH_MVU_PANEL_CARDS_DIR = path.join(work, 'cards')
process.env.DSH_MVU_PANEL_ORIGINALS_DIR = path.join(work, 'originals')
process.env.DSH_MVU_PANEL_BACKUP_DIR = path.join(work, 'backups')
process.env.DSH_MVU_PANEL_OPTIONS = path.join(work, 'options.json')
fs.mkdirSync(process.env.DSH_MVU_PANEL_CARDS_DIR, { recursive: true })

const lib = await import('file://' + path.join(PLUGIN, 'lib', 'import.mjs').replace(/\\/g, '/'))
const { importUpload, exportManaged, deleteManaged, readLedger, adoptAndSurvey } = lib

const checks = []
const check = (name, ok, extra) => checks.push({ name, ok: Boolean(ok), ...(extra === undefined ? {} : { extra }) })

const cardName = '自检角色卡'
const card = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: cardName,
    description: '自检用人物卡。',
    personality: '安静',
    scenario: '屋里',
    first_mes: '你回来了。',
    alternate_greetings: [],
    mes_example: '',
    tags: [],
    creator_notes: '',
    extensions: {},
    character_book: { entries: [] },
  },
}
const bytes = Buffer.from(JSON.stringify(card, null, 2), 'utf8')
const target = path.join(process.env.DSH_MVU_PANEL_CARDS_DIR, cardName + ' mvu版.json')

// 1) 导入
const first = importUpload({ fileName: cardName + '.json', bytes }, { ruleProfile: 'full' })
check('导入成功', first.ok === true, first)
check('落地文件名 = 原名 + 「 mvu版」', path.basename(target) === cardName + ' mvu版.json')
check('卡片文件已生成', fs.existsSync(target))

// 2) 产物结构
if (fs.existsSync(target)) {
  const wrapper = JSON.parse(fs.readFileSync(target, 'utf8'))
  const record = wrapper.raw.data.extensions.dsh_mvu_conversion
  const fields = Object.keys(record.definition.elementSchema['/档案卡'].fields)
  check('记账 managedBy 指向本插件', record.managedBy === 'dsh-tavern-mvupanel', record.managedBy)
  check('修订号为 R32', record.panelRevision === 'R32', record.panelRevision)
  check('档案卡 23 字段', fields.length === 23, fields.length)
  check('含 射精度 与 发情度', fields.includes('射精度') && fields.includes('发情度'))
  check('三条具名正则', wrapper.raw.data.extensions.regex_scripts.map(item => item.id).join(',') === 'dsh-mvu-status-view,dsh-mvu-hide-marker,dsh-mvu-hide-initvar')
  check('三条世界书条目', wrapper.raw.data.character_book.entries.map(item => item.comment).join('|') === '[initvar]状态初值|[mvu_update]状态更新规则|[rules_inject]规则注入（占位）')
  check('开场含 <initvar> 与面板入口', wrapper.raw.data.first_mes.includes('<initvar>') && wrapper.raw.data.first_mes.includes('<mvu-status/>'))
  check('规则含腔道归属硬映射', String(wrapper.raw.data.character_book.entries.find(item => /mvu_update/.test(item.comment)).content).includes('腔道归属硬映射'))
}

// 3) 重名保护 / 覆盖导入
const again = importUpload({ fileName: cardName + '.json', bytes }, { ruleProfile: 'full' })
check('重名默认拒绝覆盖', again.ok === false && again.skippable === true)
const overwrite = importUpload({ fileName: cardName + '.json', bytes }, { ruleProfile: 'full', overwriteManaged: true })
check('打开覆盖后可以覆盖', overwrite.ok === true)

// 4) 台账
const ledger = readLedger()
const key = cardName + ' mvu版'
check('台账记录了这张卡', Boolean(ledger.cards[key]), Object.keys(ledger.cards))

// 5) 导出
const entry = ledger.cards[key]
const small = exportManaged(entry)
check('导出走 base64', small.ok === true && typeof small.base64 === 'string')
check('导出内容与卡片逐字节一致', Buffer.from(small.base64 || '', 'base64').equals(fs.readFileSync(target)))
const big = exportManaged(entry, { limit: 64 })
check('超上限时改写文件并回报路径', big.ok === true && big.tooBig === true && fs.existsSync(big.path))
if (big.path) fs.rmSync(big.path, { force: true })

// 6) 删除
const removed = deleteManaged(entry)
check('删除成功', removed.ok === true)
check('卡片文件已删除', !fs.existsSync(target))
check('台账已清空', Object.keys(readLedger().cards).length === 0)

// 7) 卡片被外部删掉 → 台账自动清理
importUpload({ fileName: cardName + '.json', bytes }, { ruleProfile: 'full' })
check('重新导入后台账有一张', Object.keys(readLedger().cards).length === 1)
fs.rmSync(target)
const survey = adoptAndSurvey()
check('文件消失后台账自动移除', Object.keys(readLedger().cards).length === 0, survey.managed.length)
check('列表里不再出现这张卡', survey.managed.length === 0)

// 清理本次运行产生的日志 / 台账 / 暂存
for (const rel of ['logs', '.staging', 'exports', 'backups']) fs.rmSync(path.join(PLUGIN, rel), { recursive: true, force: true })
fs.rmSync(path.join(PLUGIN, 'managed.json'), { force: true })
fs.rmSync(work, { recursive: true, force: true })

const failed = checks.filter(item => !item.ok)
console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2))
process.exit(failed.length ? 1 : 0)