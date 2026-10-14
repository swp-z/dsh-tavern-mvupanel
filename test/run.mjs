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
const longText = [
  '她叫自检角色卡，是一名安静的女学生，个子不高，头发及肩。',
  '喜欢在窗边看书，午休时常常一个人去天台吹风，不太爱说话。',
  '说话声音很轻，很少主动开口，被问到才会慢慢回答。',
  '对熟悉的人会露出放松的表情，偶尔也会开一点小玩笑。',
  '遇到陌生人会先观察再靠近，习惯把头发别到耳后。',
  '校服总是穿得很整齐，鞋带系得一丝不苟。',
  '上课时会认真记笔记，字迹很小但很工整。',
  '午饭常带便当，会在天台边吃边看远处。',
  '被老师点名时会先愣一下，再小声回答。',
  '放学后通常直接回家，很少参加集体活动。',
].join('\n')
// 故意放一条「常驻 + 与 description 逐行重复」的世界书条目：R33 起转换时应把它停用（省 token）
const duplicateEntry = { id: 1, comment: '人物设定（重复）', constant: true, enabled: true, content: longText }

const card = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  data: {
    name: cardName,
    description: longText,
    personality: '安静',
    scenario: '屋里',
    first_mes: '你回来了。',
    alternate_greetings: [],
    mes_example: '',
    tags: [],
    creator_notes: '',
    extensions: {},
    character_book: { entries: [duplicateEntry] },
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
  check('修订号为 R33', record.panelRevision === 'R33', record.panelRevision)
  check('档案卡 23 字段', fields.length === 23, fields.length)
  check('含 射精度 与 发情度', fields.includes('射精度') && fields.includes('发情度'))
  check('三条具名正则', wrapper.raw.data.extensions.regex_scripts.map(item => item.id).join(',') === 'dsh-mvu-status-view,dsh-mvu-hide-marker,dsh-mvu-hide-initvar')
  check('三条具名世界书条目（并保留卡片原有条目）', ['[initvar]状态初值', '[mvu_update]状态更新规则', '[rules_inject]规则注入（占位）'].every(name => wrapper.raw.data.character_book.entries.some(item => item.comment === name)))
  check('开场含 <initvar> 与面板入口', wrapper.raw.data.first_mes.includes('<initvar>') && wrapper.raw.data.first_mes.includes('<mvu-status/>'))
  check('重复的常驻条目被自动停用', wrapper.raw.data.character_book.entries.find(item => item.comment === '人物设定（重复）').enabled === false)
  const arts = await import('file://' + path.join(PLUGIN, 'lib', 'artifacts.js').replace(/\\/g, '/'))
  const pruned = arts.pruneDuplicateEntries({
    description: longText,
    character_book: { entries: [
      { id: 1, comment: '重复', constant: true, enabled: true, content: longText },
      { id: 2, comment: '非常驻', constant: false, enabled: true, content: longText },
      { id: 3, comment: '短', constant: true, enabled: true, content: '很短' },
      { id: 4, comment: '独立内容', constant: true, enabled: true, content: '这一条与人物卡字段完全不同，逐行都找不到对应。\n所以它必须保持启用，不能被误停。\n用来验证判定的保守程度。' },
    ] },
  })
  check('去重：逐行重复的常驻条目被停用', pruned.changed.length === 1 && pruned.changed[0].id === 1, pruned.changed)
  check('去重：省下 200 字以上', pruned.savedChars >= 200, pruned.savedChars)
  const panelText = fs.readFileSync(path.join(PLUGIN, 'assets', 'panel.md'), 'utf8')
  const tailMatch = /var PROMPT_TAIL=''([\s\S]*?)';/.exec(panelText)
  check('《执行要求》已压缩到 700 字以内', Boolean(tailMatch) && tailMatch[1].length < 700, tailMatch && tailMatch[1].length)
  check('注入块含判定纪律（只做一次 / 随时类默认不触发）', panelText.includes('判定只做一次') && panelText.includes('默认本轮不触发'))
  check('没有法则时不追加《执行要求》', panelText.includes('if(!lines.length)return head;'))
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