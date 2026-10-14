```html
<html><head></head><body><!--
  RP 侧边栏 MVU 面板外观（技能/卡版本见 creator_notes）

  R32（数值区 4 轴）：
    - 数值区由 3 轴扩到 4 轴：好感度 / 发情度（原「欲情」，变量路径同步改名）/ 高潮度 / 射精度（$426：交合中男性对象的射精累积进度，与高潮度双双临近 100 时下一轮同时高潮射精）。
    - 4 行共用同一个 grid，左列标签显式占位（状态 row1、性经验 row2–3、性癖 row4），逐行对齐不依赖自动排版。
    - 数值区整体缩放（行高 42→36px、字号 16.5→15.5px、条高 8→7px），多一行后卡高基本不变。  R31：
    - 芯片清洗加固（全角/半角包裹符号、项目符号、切分符、去重、纯符号丢弃）。
    - 芯片不得撑破列宽；标签行换行后必须把行推高，绝不能压住下一行
      （行高必须靠 grid-auto-rows: minmax(42px,auto) 自适应，禁用固定行高）。
  R26：
    - 档案列表高度下限抬到「一张完整展开卡」的高度（实测 687px → 取 820px），不再只露半张卡。
    - 性癖与身体四部位的书写规范在 update-rules.md 中重写（防重复挑取 + 色气示例）。
  R25（重大结构调整）：
    - **在场卡整体并入档案卡**，面板只保留「规则列表 + 角色档案」两段，不再有独立的在场卡模块。
    - 档案卡 22 字段，分三类：长期（跨轮保留）/ 临时（本轮有效，离场清空）/ 标记（在场）。
    - 档案列表由面板脚本按「在场」排序（在场置顶）并在在场状态跳变时展开/折叠一次。
    - 移除「位置」与「立绘」两个字段。

  R27：`$419` 由「生育状态」升级为「性经验」—— 主档位（处子 / 开苞 / 经验丰富）+ 累积经历标签
       （菊穴开发 / 子宫高潮 / 户外露出 / 怀孕中 …），青绿芯片类名由 .tag-fert 改 .tag-exp。
  R24：档案卡删除数值轴「堕落度」（$419 不再接进度条），改为繁育阶段标签「生育状态」——
       离散字符串（处子 / 开苞 / 经验丰富 / 怀孕中 / 孕后 …），走 .mvu-tags + paintTags 渲染成
       青绿芯片；无值时该行只剩抬头，不画空芯片。
  R23：性癖标签化 + 提交写法修正（成员增删 replace 整条数组、禁 insert/add 到索引、只提交变化字段）。
       R25 补充：性癖已去掉爱心图标，仅保留紫粉芯片。
  R22：三段折叠；R21：部位四字段与数值轴。
  R25 字体：面板内字号全局 +4px（基准 15 → 19px）。
-->
<div class="mvu-panel">
  <div class="mvu-head">
    <div>
      <div class="mvu-title">MVU 状态面板</div>
      <div class="mvu-sub">&#36;1</div>
    </div>
    <div class="mvu-counts">
      <span class="mvu-count">规则 <b>&#36;5</b></span>
      <span class="mvu-count">在场 <b>&#36;6</b></span>
      <span class="mvu-count">档案 <b>&#36;7</b></span>
    </div>
  </div>

  <details class="mvu-fold" open>
    <summary class="mvu-sec">
      <span class="mvu-caret"></span>
      <span class="mvu-num">1</span><span class="mvu-sec-title">规则列表</span>
      <span class="mvu-chip mvu-chip-warn">&#36;8 待生效</span>
      <span class="mvu-sp"></span>
      <button class="mvu-btn mvu-btn-add" data-mvu-act="add-rule" type="button">+ 新增</button>
      <span class="mvu-rule-line"></span>
    </summary>
    <div class="mvu-fold-body">
      <ul class="mvu-rules" data-mvu-list="/规则列表/条目" data-mvu-empty="暂无已写入的规则"><template>
        <li class="mvu-rule">
          <span class="mvu-rule-txt">&#36;201</span>
          <span class="mvu-rule-state mvu-state-&#36;202">&#36;202</span>
          <span class="mvu-rule-acts">
            <button class="mvu-btn mvu-btn-edit" data-mvu-act="edit-rule" data-key="&#36;201" type="button" title="修改规则">改</button>
            <button class="mvu-btn mvu-btn-toggle" data-mvu-act="toggle-rule" data-key="&#36;201" data-state="&#36;202" type="button" title="停用 / 启用">&#36;204</button>
            <button class="mvu-btn mvu-btn-del" data-mvu-act="del-rule" data-key="&#36;201" type="button" title="删除该规则">×</button>
          </span>
        </li>
      </template></ul>
      <ul class="mvu-pending" data-mvu-list="/规则列表/待生效" data-mvu-empty="暂无待生效变更"><template>
        <li class="mvu-rule mvu-rule-pending">
          <span class="mvu-rule-txt">&#36;203</span>
          <span class="mvu-rule-state mvu-state-pending">待生效</span>
        </li>
      </template></ul>
    </div>
  </details>

  <details class="mvu-fold" open>
    <summary class="mvu-sec">
      <span class="mvu-caret"></span>
      <span class="mvu-num">2</span><span class="mvu-sec-title">角色档案</span>
      <span class="mvu-dim">在场置顶 · 在场自动展开</span>
      <span class="mvu-rule-line"></span>
    </summary>
    <div class="mvu-fold-body">
      <div class="mvu-files" data-mvu-list="/档案卡" data-mvu-empty="尚无角色档案"><template>
        <details class="mvu-file">
          <summary class="mvu-file-head">
            <span class="mvu-caret"></span>
            <span class="mvu-name">&#36;401</span>
            <span class="mvu-dot &#36;411"></span>
            <span class="mvu-sp"></span>
            <span class="mvu-dim">&#36;412</span>
            <button class="mvu-btn mvu-btn-del" data-mvu-act="del-file" data-key="&#36;401" type="button" title="删除该档案">×</button>
          </summary>
          <div class="mvu-file-body">

            <!-- 大边框：顶部身份 / 左下标签 / 右下数值（竖分隔线，四行数值与三行标签逐行对齐，7:3） -->
            <div class="hdr-box">
              <div class="mvu-field">年龄 <span>&#36;402</span>，三围 <span>&#36;403(&#36;404)-&#36;405-&#36;406</span>，<span class="mvu-rel">&#36;409</span></div>
              <div class="sep"></div>
              <div class="hdr-split">
                <div class="tl tl-1"><span class="k">状态</span><div class="mvu-tags tag-stat" data-tags="&#36;425" data-hot="off"></div></div>
                <div class="axv axv-1">
                  <div class="ax"><span class="lb">好感度</span><span class="v mvu-ax-fav">&#36;418</span></div>
                  <div class="bar"><i class="mvu-ax-fav" style="width:&#36;418%"></i></div>
                </div>
                <div class="tl tl-2"><span class="k">性经验</span><div class="mvu-tags tag-exp" data-tags="&#36;419" data-hot="off"></div></div>
                <div class="axv axv-2">
                  <div class="ax"><span class="lb">发情度</span><span class="v mvu-ax-lust">&#36;423</span></div>
                  <div class="bar"><i class="mvu-ax-lust" style="width:&#36;423%"></i></div>
                </div>
                <div class="tl tl-3 tl-sep"><span class="k">性癖</span><div class="mvu-tags tag-fet" data-tags="&#36;413" data-hot="off"></div></div>
                <div class="axv axv-3">
                  <div class="ax"><span class="lb">高潮度</span><span class="v mvu-ax-peak">&#36;424</span></div>
                  <div class="bar"><i class="mvu-ax-peak" style="width:&#36;424%"></i></div>
                </div>
                <div class="axv axv-4">
                  <div class="ax"><span class="lb">射精度</span><span class="v mvu-ax-ejac">&#36;426</span></div>
                  <div class="bar"><i class="mvu-ax-ejac" style="width:&#36;426%"></i></div>
                </div>
                <i class="vline" aria-hidden="true"></i>
              </div>
            </div>

            <div class="mvu-field tmp">当前内心：<span>&#36;421</span></div>
            <div class="mvu-field">人物介绍：<span>&#36;407</span></div>
            <div class="mvu-field">当前着装：<span>&#36;408</span></div>
            <div class="mvu-field">最近交互：<span>&#36;410</span></div>
            <div class="mvu-bodyset">
              <div class="mvu-bodygrid">
                <div class="mvu-cell">🍒 <span class="lb">胸部</span> <span>&#36;414</span></div>
                <div class="mvu-cell">🍑 <span class="lb">臀部</span> <span>&#36;415</span></div>
                <div class="mvu-cell">🌸 <span class="lb">小穴</span> <span>&#36;416</span></div>
                <div class="mvu-cell">🌼 <span class="lb">菊穴</span> <span>&#36;417</span></div>
              </div>
            </div>

          </div>
        </details>
      </template></div>
    </div>
  </details>

  <div class="mvu-foot">&#36;4</div>
</div>

<style>
.mvu-panel {
  --mvu-line: rgba(120,190,255,.22);
  --mvu-line2: rgba(120,190,255,.12);
  --mvu-text: #E6F0FF;
  --mvu-dim: #A9C8E8;
  --mvu-mute: #6E8CB0;
  --mvu-cyan: #4FE3FF;
  --mvu-violet: #7C6BFF;
  --mvu-warn: #FAD778;
  --mvu-frame: rgba(126,224,200,.36);
  --mvu-frame-bg: rgba(126,224,200,.06);
  box-sizing: border-box;
  width: 100%;
  max-width: 576px;
  margin: 10px auto;
  padding: 14px;
  border-radius: 16px;
  color: var(--mvu-text);
  font-family: "Noto Sans SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif;
  font-size: 19px;            /* R25：原 15px +4px */
  line-height: 1.6;
  overflow-wrap: break-word;
  word-break: break-word;
  border: 1px solid var(--mvu-line);
  background: linear-gradient(155deg, #0B1A33 0%, #10265A 45%, #060B18 100%);
  box-shadow: 0 0 34px rgba(30,120,255,.2);
}
.mvu-panel * { box-sizing: border-box; }
.mvu-panel p { margin: 0; }

.mvu-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--mvu-line); }
.mvu-title { font-size: 21px; font-weight: 700; letter-spacing: .12em; color: #EAF1FF; text-shadow: 0 0 14px rgba(126,168,255,.35); }
.mvu-sub { display: none; margin-top: 2px; font-size: 17px; color: var(--mvu-mute); }
.mvu-counts { display: flex; flex-direction: row; align-items: center; gap: 6px; flex: 0 0 auto; }
.mvu-count { font-size: 17px; color: var(--mvu-mute); padding: 1px 8px; border: 1px solid var(--mvu-line); border-radius: 999px; background: rgba(120,190,255,.07); white-space: nowrap; }
.mvu-count b { color: var(--mvu-cyan); font-variant-numeric: tabular-nums; }

/* 段落折叠（规则列表 / 角色档案） */
.mvu-fold { margin: 12px 0 0; }
.mvu-sec { display: flex; align-items: center; gap: 7px; margin: 0; }
.mvu-fold > summary.mvu-sec { padding: 5px 7px; border-radius: 9px; background: rgba(255,255,255,.05); cursor: pointer; list-style: none; }
.mvu-fold > summary.mvu-sec::-webkit-details-marker { display: none; }
.mvu-fold > summary.mvu-sec::marker { content: none; }
.mvu-fold > summary.mvu-sec:hover { background: rgba(120,190,255,.1); }
.mvu-fold[open] > summary.mvu-sec { background: rgba(120,190,255,.13); }
.mvu-fold-body { padding: 8px 2px 2px; }
.mvu-caret { width: 0; height: 0; flex: none; border-left: 5px solid var(--mvu-cyan);
             border-top: 4px solid transparent; border-bottom: 4px solid transparent; transition: transform .16s ease; }
.mvu-fold[open] > summary.mvu-sec .mvu-caret { transform: rotate(90deg); }
.mvu-num { width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 17px; background: rgba(79,227,255,.16); color: var(--mvu-cyan); flex: none; }
.mvu-sec-title { font-size: 18px; font-weight: 600; letter-spacing: .08em; color: #CFE0FF; }
.mvu-rule-line { flex: 1 1 auto; height: 1px; background: linear-gradient(90deg, var(--mvu-line), transparent); }
.mvu-dim { font-size: 17px; color: var(--mvu-mute); }
.mvu-chip { padding: 0 7px; border-radius: 999px; font-size: 16px; border: 1px solid var(--mvu-line); color: var(--mvu-dim); }
.mvu-chip-warn { color: var(--mvu-warn); border-color: rgba(250,215,120,.4); background: rgba(250,215,120,.08); }
.mvu-sp { flex: 1; }

.mvu-rules, .mvu-pending { list-style: none; margin: 0 0 6px; padding: 0; }
.mvu-rule { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 6px 9px; margin-bottom: 5px; border: 1px solid var(--mvu-line); border-radius: 9px; background: rgba(255,255,255,.05); }
.mvu-rule-pending { border-color: rgba(250,215,120,.45); }
.mvu-rule-input { gap: 5px; border-color: rgba(79,227,255,.5); background: rgba(6,9,18,.7); }
.mvu-rule-txt { flex: 1 1 auto; min-width: 0; font-size: 18px; color: var(--mvu-text); }
.mvu-rule-acts { display: flex; gap: 4px; flex: none; align-items: baseline; }
.mvu-btn-edit, .mvu-btn-toggle { padding: 0 6px; }
.mvu-rule-state { flex: none; font-size: 17px; color: var(--mvu-mute); }
.mvu-state-生效 { color: var(--mvu-cyan); }
.mvu-state-停用 { color: var(--mvu-mute); }
.mvu-state-pending, .mvu-state-待生效 { color: var(--mvu-warn); }
.mvu-state-待删除 { color: var(--mvu-warn); }

/* 归档列表
   R26 高度控制：容器必须**至少装得下一张完整展开的档案卡**。
   实测（19px 基准字号 / 576px 宽）单张展开卡 ≈ 610–800px（长文本换行越多越高），
   故桌面宽度下限取 880px；面板变窄时文字换行变多、卡片更高，用下面的断点逐级抬起下限。
   上限 min(88vh, 1240px) 以免大屏上无限拉长。原值 360px 只能露出半张卡。 */
.mvu-files { max-height: max(880px, min(88vh, 1240px)); overflow-y: auto; padding: 7px; border: 1px solid var(--mvu-line2); border-radius: 10px; background: rgba(6,9,18,.55); }
.mvu-file { margin-bottom: 5px; border: 1px solid rgba(95,94,90,.55); border-radius: 11px; background: rgba(255,255,255,.045); overflow: hidden; }
.mvu-file-head { display: flex; align-items: center; gap: 6px; padding: 5px 7px; border-radius: 0; background: rgba(255,255,255,.05); cursor: pointer; list-style: none; }
.mvu-file-head::-webkit-details-marker { display: none; }
.mvu-file-head::marker { content: none; }
.mvu-file[open] > .mvu-file-head { background: rgba(120,190,255,.13); border-bottom: 1px solid var(--mvu-line2); }
.mvu-file[open] > .mvu-file-head .mvu-caret { transform: rotate(90deg); }
.mvu-file-body { padding: 8px 7px 7px; font-size: 17px; line-height: 1.7; color: var(--mvu-dim); }
.mvu-name { font-size: 18px; font-weight: 600; color: #EAF1FF; }
.mvu-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; display: inline-block; }
.mvu-dot-on { background: var(--mvu-cyan); box-shadow: 0 0 8px var(--mvu-cyan); }
.mvu-dot-off { border: 1px solid var(--mvu-mute); }
.mvu-rel { color: #FFD9A8; }

/* 字段框 */
.mvu-field {
  border: 1px solid var(--mvu-frame);
  background: var(--mvu-frame-bg);
  border-radius: 11px;
  padding: 4px 10px;
  font-size: 16.5px;          /* 原 12.5 +4 */
  line-height: 1.62;
  color: var(--mvu-dim);
  margin-bottom: 7px;
}
.mvu-field:last-child { margin-bottom: 0; }
.mvu-field > .lb { color: #C4DCF5; }

/* R25：临时字段用虚线描边 + 淡红底，与长期字段（实线薄荷青）区分；
   离场时由规则要求清空，不再残留 */
.mvu-field.tmp { border-style: dashed; border-color: rgba(255,138,155,.45); background: rgba(255,138,155,.05); }
.mvu-mind { color: #FFD9A8; font-style: italic; }
.mvu-mind > .lb { color: #FFD9A8; font-style: italic; }

/* R25：大边框三分 —— 顶部身份 / 左下标签 / 右下数值 */
.hdr-box { border: 1px solid var(--mvu-frame); background: var(--mvu-frame-bg);
  border-radius: 11px; padding: 8px 10px; margin-bottom: 7px; }
.sep { height: 1px; background: linear-gradient(90deg, rgba(120,190,255,.12), transparent); margin: 8px 0; }

/* 7 : 3 两列；中间竖分隔线；两区共享同一套行（行高 42px 起，内容更高时自动增高）。
   R31 提醒：**绝不要**把行高写死成 repeat(3, 42px) —— 标签换行时行内容会溢出到下一行，
   视觉上就是「状态芯片压住下面的行」。grid-auto-rows 的 auto 是防重叠的关键。 */
/* R27：标签区与数值区放进**同一个 grid**，逐行共享行高 —— 标签换行时右侧数值仍与左侧行对齐。
   旧做法是左右各一个 grid + repeat(3,42px)，标签一换行左区就自己变高、右区不跟随，逐行错位。 */
.hdr-split { display: grid; grid-template-columns: minmax(0, 7fr) 1px minmax(0, 3fr); grid-auto-rows: minmax(36px, auto); align-items: center; }
/* R32：数值区 4 行 —— 左列标签与右侧数值显式占行，禁用自动排版 */
.hdr-split > .tl-1 { grid-row: 1; }
.hdr-split > .tl-2 { grid-row: 2 / span 2; }
.hdr-split > .tl-3 { grid-row: 4; }
.hdr-split > .axv-1 { grid-row: 1; }
.hdr-split > .axv-2 { grid-row: 2; }
.hdr-split > .axv-3 { grid-row: 3; }
.hdr-split > .axv-4 { grid-row: 4; }
.hdr-split > .tl { grid-column: 1; min-width: 0; padding-right: 12px; }
.hdr-split > .axv { grid-column: 3; min-width: 0; padding-left: 12px; }
.hdr-split > .vline { grid-column: 2; grid-row: 1 / -1; align-self: stretch; background: rgba(120,190,255,.30); }

.tl { display: flex; align-items: center; gap: 8px; min-width: 0; }
/* 抬头固定宽保证行首对齐；R32：下方 4 行数值、左列 3 行标签，宽度仍取 58px（「性经验」三字） */
.tl .k { flex: none; width: 58px; font-size: 15.5px; color: var(--mvu-mute); letter-spacing: .06em; }

/* 数值：竖排三行，每行「抬头 + 数值 + 进度条」 */
.axv { display: flex; flex-direction: column; justify-content: center; height: 100%; min-width: 0; }
.ax { display: flex; align-items: baseline; justify-content: space-between; gap: 6px;
  font-size: 15.5px; color: var(--mvu-dim); margin-bottom: 3px; }
.ax .lb { color: #C4DCF5; }
.ax .v { font-variant-numeric: tabular-nums; font-weight: 700; }
.bar { height: 7px; border-radius: 999px; background: rgba(255,255,255,.09); overflow: hidden; }
.bar > i { display: block; height: 7px; border-radius: 999px; }
/* R21.1 铁律：数值 span 与进度条填充绝不能同色（同色字压同色底 → 数字隐形），
   故 .v 只染文字色，i 只染背景色，两条互斥规则分开写 */
.ax .v.mvu-ax-fav { color: #4FE3FF; }
.ax .v.mvu-ax-lust { color: #FF7BA8; }
.ax .v.mvu-ax-peak { color: #FF8A3D; }
.ax .v.mvu-ax-ejac { color: #B39DFF; }
.bar > i.mvu-ax-fav { background: #4FE3FF; }
.bar > i.mvu-ax-lust { background: #FF7BA8; }
.bar > i.mvu-ax-peak { background: #FF8A3D; }
.bar > i.mvu-ax-ejac { background: #B39DFF; }

/* 芯片：由 paintTags 依据 data-tags 生成 .mvu-tag */
/* R31：行内换行用 row-gap 明确留白；芯片自身不得撑破列宽（超长文本在芯片内折行）
   —— 真机症状是标签换行后压到下一行（「重叠」）。 */
.mvu-tags { display: flex; flex-wrap: wrap; gap: 5px 6px; align-items: center; align-content: center; min-width: 0; }
.mvu-tag { font-size: 15px; line-height: 1.6; padding: 1px 10px; border-radius: 999px; max-width: 100%;
  overflow-wrap: anywhere; word-break: break-word;
  border: 1px solid rgba(120,190,255,.28); background: rgba(120,190,255,.1); color: #BFD8F2; }
.mvu-tag-hot { border-color: rgba(255,123,168,.5); background: rgba(255,123,168,.14); color: #FFC4D8; }
/* R25：三类标签底色三色分开，一眼可分；性癖已去掉爱心图标 */
.tag-stat .mvu-tag { border-color: rgba(120,190,255,.38); background: rgba(120,190,255,.16); color: #CFE4FF; }
.tag-exp .mvu-tag { border-color: rgba(111,224,176,.46); background: rgba(111,224,176,.15); color: #C8F6E2; }
.tag-fet  .mvu-tag { border-color: rgba(216,180,255,.40); background: rgba(216,180,255,.16); color: #EFE3FF; }

/* 部位四格 */
.mvu-bodyset { border: 1px solid var(--mvu-frame); background: rgba(126,224,200,.05); border-radius: 11px; padding: 6px; margin-bottom: 7px; }
.mvu-bodyset:last-child { margin-bottom: 0; }
.mvu-bodygrid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.mvu-cell { border: 1px solid rgba(120,190,255,.14); background: rgba(255,255,255,.055); border-radius: 8px; padding: 4px 8px; font-size: 16.5px; line-height: 1.6; color: #D9C6F2; }
.mvu-cell > .lb { color: #EADCFF; font-weight: 600; }

.mvu-btn { flex: none; font: inherit; font-size: 17px; line-height: 1.5; color: var(--mvu-dim); background: rgba(120,190,255,.1); border: 1px solid var(--mvu-line); border-radius: 7px; padding: 1px 7px; cursor: pointer; transition: background .15s ease, color .15s ease, border-color .15s ease; }
.mvu-btn:hover { background: rgba(79,227,255,.2); color: #EAF1FF; border-color: rgba(79,227,255,.55); }
.mvu-btn-add { color: var(--mvu-cyan); border-color: rgba(79,227,255,.4); }
.mvu-btn-del { padding: 0 5px; font-size: 18px; line-height: 1.35; color: var(--mvu-mute); border-color: rgba(120,190,255,.22); }
.mvu-btn-del:hover { color: #FFCFD6; background: rgba(255,120,140,.18); border-color: rgba(255,140,160,.5); }
.mvu-input { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 18px; color: var(--mvu-text); background: rgba(6,9,18,.7); border: 1px solid rgba(79,227,255,.45); border-radius: 7px; padding: 3px 7px; }
.mvu-input::placeholder { color: var(--mvu-mute); }
.mvu-toast { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 99; padding: 6px 14px; border-radius: 999px; font-size: 18px; color: #EAF1FF; background: rgba(16,38,90,.95); border: 1px solid rgba(79,227,255,.5); box-shadow: 0 4px 20px rgba(0,0,0,.45); opacity: 0; pointer-events: none; transition: opacity .2s ease; }
.mvu-toast-on { opacity: 1; }

.mvu-foot { display: none; margin-top: 12px; padding-top: 8px; border-top: 1px dashed var(--mvu-line2); font-size: 17px; line-height: 1.55; color: var(--mvu-mute); }
.mvu-empty { padding: 9px 4px; font-size: 17px; font-style: italic; color: var(--mvu-mute); text-align: center; }
.mvu-files > .mvu-empty { text-align: center; }

/* 面板窄于 576px 上限时文字换行变多、单卡更高，逐级抬起下限，保证首卡仍完整 */
@media (max-width: 620px) {
  .mvu-files { max-height: max(950px, min(92vh, 1300px)); }
}

@media (max-width: 480px) {
  .mvu-panel { padding: 12px 11px 10px; font-size: 18.5px; }
  /* 身体四格变单列，单张卡再高一截 */
  .mvu-files { max-height: max(1020px, min(94vh, 1360px)); }
  .mvu-bodygrid { grid-template-columns: 1fr; }
  /* 窄屏改上下：三类标签在上、三条数值在下（order 把同类聚到一起） */
  .hdr-split { grid-template-columns: 1fr; grid-auto-rows: auto; }
  .hdr-split > .tl, .hdr-split > .axv { grid-row: auto; }
  .hdr-split > .tl { grid-column: 1; order: 1; padding-right: 0; }
  .hdr-split > .axv { grid-column: 1; order: 2; padding-left: 0; padding-top: 6px; }
  .hdr-split > .tl-sep { border-bottom: 1px solid rgba(120,190,255,.30); padding-bottom: 6px; }
  .hdr-split > .vline { display: none; }
}
</style>
<script data-dsh-frozen-mvu>
(function(){
const GLOBAL=[{"capture": 1, "keys": ["$meta", "幕"], "fallback": "未分幕"}, {"capture": 4, "keys": ["$meta", "说明"]}, {"capture": 5, "keys": ["计数", "规则"]}, {"capture": 6, "keys": ["计数", "在场"]}, {"capture": 7, "keys": ["计数", "档案"]}, {"capture": 8, "keys": ["计数", "待生效"]}];
const LIST={"/规则列表/条目": [{"capture": 201, "keys": ["文本"]}, {"capture": 202, "keys": ["状态"], "fallback": "生效"}, {"capture": 204, "keys": ["状态"], "cast": "toggleLabel"}], "/规则列表/待生效": [{"capture": 203, "keys": []}], "/档案卡": [{"capture": 401, "keys": ["名字"]}, {"capture": 402, "keys": ["年龄"], "fallback": "—"}, {"capture": 403, "keys": ["胸围"], "fallback": "—"}, {"capture": 404, "keys": ["罩杯"], "fallback": "—"}, {"capture": 405, "keys": ["腰围"], "fallback": "—"}, {"capture": 406, "keys": ["臀围"], "fallback": "—"}, {"capture": 407, "keys": ["人物介绍"], "fallback": "—"}, {"capture": 408, "keys": ["当前着装"], "fallback": "—"}, {"capture": 409, "keys": ["与你关系"], "fallback": "—"}, {"capture": 410, "keys": ["最近交互"], "fallback": "无"}, {"capture": 413, "keys": ["性癖"], "fallback": "—"}, {"capture": 414, "keys": ["胸部"], "fallback": "—"}, {"capture": 415, "keys": ["臀部"], "fallback": "—"}, {"capture": 416, "keys": ["小穴"], "fallback": "—"}, {"capture": 417, "keys": ["菊穴"], "fallback": "—"}, {"capture": 418, "keys": ["好感度"], "fallback": "0"}, {"capture": 419, "keys": ["性经验"], "fallback": ""}, {"capture": 421, "keys": ["当前内心"], "fallback": ""}, {"capture": 423, "keys": ["发情度"], "fallback": "0"}, {"capture": 424, "keys": ["高潮度"], "fallback": "0"}, {"capture": 426, "keys": ["射精度"], "fallback": "0"}, {"capture": 425, "keys": ["状态"], "cast": "joinList"}, {"capture": 411, "keys": ["在场"], "cast": "dotClass"}, {"capture": 412, "keys": ["在场"], "cast": "presenceText"}]};
const CASTS={"dotClass": {"true": "mvu-dot-on", "false": "mvu-dot-off"}, "presenceText": {"true": "在场", "false": "离场"}, "toggleLabel": {"生效": "停用", "停用": "启用", "待删除": "恢复"}};
const SYNONYMS={"名字": ["姓名", "名称", "角色名", "name"], "当前着装": ["着装", "穿着", "衣着", "服装", "衣物"], "当前内心": ["内心", "内心活动", "心理活动", "内心独白", "心声"], "发情度": ["欲情", "性欲", "欲求", "情欲", "兴奋度", "性兴奋"], "高潮度": ["高潮", "高潮进度", "绝顶", "累计高潮", "climax"], "射精度": ["射精", "射精进度", "射精度"], "好感度": ["好感", "亲密度", "羁绊", "affinity"], "性经验": ["性经历", "性经历标签", "性历", "经验", "繁育状态", "妊娠状态", "生育情况", "受孕状态", "贞操状态", "怀孕状态", "孕产状态"], "年龄": ["岁数", "年纪", "age"], "胸围": ["bust", "B"], "罩杯": ["cup", "罩杯尺寸", "C"], "腰围": ["waist", "W"], "臀围": ["hip", "H"], "人物介绍": ["外貌", "外观", "长相", "外貌描写", "样貌", "简介", "人物简介", "人物描述"], "与你关系": ["关系", "与你的关系", "和你的关系"], "最近交互": ["最近互动", "最近一次交互", "最新交互", "最近事件"], "性癖": ["癖好", "萌点", "性癖好", "fetish"], "胸部": ["胸", "乳房", "胸部状态"], "臀部": ["臀", "屁股", "臀部状态"], "小穴": ["阴道", "穴", "私处"], "菊穴": ["后穴", "肛门", "菊花"], "文本": ["规则", "内容", "规则文本", "rule"], "状态": ["规则状态", "state", "本轮状态", "境况"], "在场": ["是否在场", "present"]};
const FUNCS={surname:function(v){var s=str(v).trim();if(!s)return '';return s.charAt(0);},joinList:function(v){if(Array.isArray(v))return v.map(function(x){return str(x).trim();}).filter(Boolean).join('、');return str(v).trim();},relFromFiles:function(v){try{var fs=(CUR_STATE&&CUR_STATE['档案卡'])||[];var n=str(v||'');if(!n)return '';for(var i=0;i<fs.length;i++){var f=fs[i];if(f&&str(f['名字']||'')===n)return str(f['与你关系']||'');}}catch(e){}return '';}};
let LAST='';
let CUR_STATE=null;   // R22：本帧状态快照，供 relFromFiles 按名字反查 /档案卡
const SLOT=/[\x24]([1-9]\d*)/g;
const SLOT_TEST=/[\x24]([1-9]\d*)/;
function val(scope,keys){let v=scope;for(const k of keys){v=(v!=null&&Object.prototype.hasOwnProperty.call(v,k))?v[k]:undefined;}return v;}
function str(v){if(v==null)return '';if(typeof v==='boolean')return v?'true':'false';if(typeof v==='object')return JSON.stringify(v);return String(v);}
function castOf(v,b){if(!b.cast)return null;var f=FUNCS[b.cast];if(typeof f==='function')return f(v);const t=CASTS[b.cast]||{};return t[v===true?'true':v===false?'false':str(v)]||'';}
function lookupFactory(scope,bs){return function(n){for(const b of bs){if(b.capture!==n)continue;const raw=val(scope,b.keys||[]);const c=castOf(raw,b);if(c!==null)return c;const s=str(raw);if(s)return s;const alt=tryAlias(scope,b.keys||[]);if(alt!==undefined)return str(alt);return b.fallback||'';}return '';};}
function tryAlias(scope,keys){if(keys.length!==1)return undefined;const syn=SYNONYMS[keys[0]];if(!syn)return undefined;for(const k of syn){const v=val(scope,[k]);const s=str(v);if(s)return v;}return undefined;}
function isInList(node,stopAt){let e=node.nodeType===1?node:node.parentElement;while(e){if(e===stopAt)return false;if(e.hasAttribute&&e.hasAttribute('data-mvu-list'))return true;e=e.parentElement;}return false;}
function nodesWithSlot(root,stopAt){const nodes=[];if(root.nodeType===3){if(root.__mvuSrc===undefined)root.__mvuSrc=root.nodeValue;if(SLOT_TEST.test(root.__mvuSrc)&&!isInList(root,stopAt))nodes.push({node:root,src:root.__mvuSrc});return nodes;}if(root.nodeType!==1&&root.nodeType!==11&&root.nodeType!==9)return nodes;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())){const p=n.parentElement&&n.parentElement.tagName;if(p==='SCRIPT'||p==='STYLE')continue;if(n.__mvuSrc===undefined)n.__mvuSrc=n.nodeValue;if(SLOT_TEST.test(n.__mvuSrc)&&!isInList(n,stopAt))nodes.push({node:n,src:n.__mvuSrc});}return nodes;}
function replaceText(root,lookup){const stop=(root&&root.nodeType===1&&root.classList&&root.classList.contains('mvu-panel'))?root:null;const nodes=nodesWithSlot(root,stop);for(const it of nodes){it.node.nodeValue=it.src.replace(SLOT,function(_,id){return lookup(Number(id))||'';});}}
function elementsIn(scope){const out=[];if(scope.nodeType===1){out.push(scope);out.push.apply(out,[].slice.call(scope.querySelectorAll('*')));}else if(scope.nodeType===11||scope.nodeType===9){out.push.apply(out,[].slice.call(scope.querySelectorAll('*')));}return out;}
function replaceAttrs(scope,lookup){const stop=(scope&&scope.nodeType===1&&scope.classList&&scope.classList.contains('mvu-panel'))?scope:null;const els=elementsIn(scope);for(const el of els){if(isInList(el,stop))continue;for(const at of [].slice.call(el.attributes||[])){if(at.name.indexOf('data-mvu')===0)continue;if(at.__mvuSrc===undefined)at.__mvuSrc=at.value;if(SLOT_TEST.test(at.__mvuSrc))at.value=at.__mvuSrc.replace(SLOT,function(_,id){return lookup(Number(id))||'';});}}}
function hashHue(s){var h=2166136261;for(var i=0;i<s.length;i++){h=(h^s.charCodeAt(i))*16777619;h=h>>>0;}return h-360*Math.floor(h/360);}
function paintAvatars(panel){try{var pics=panel.querySelectorAll('.mvu-pic');for(var i=0;i<pics.length;i++){var el=pics[i];var t=(el.textContent||'').trim();if(!t||t==='立绘')continue;var hue=hashHue(t);el.style.color='hsl('+hue+',88%,74%)';el.style.border='1px solid hsla('+hue+',82%,64%,.5)';el.style.background='hsla('+hue+',72%,55%,.16)';el.style.boxShadow='0 0 12px hsla('+hue+',88%,62%,.3)';el.style.fontWeight='700';el.style.fontSize='20px';}}catch(e){}}
// R21：状态芯片。插槽只能注入文本（nodeValue 会转义 HTML），所以 /档案卡/状态 先由
// joinList 折成「A、B、C」写进 data-tags，再由本函数拆开生成真正的 <span class="mvu-tag">。
// 无状态时把整行 .mvu-field 隐藏，避免出现「状态」两个字的空框。
// R27 修复「芯片前后带括号/引号」：模型常把数组写成 ['戒备','余韵'] 或 [戒备, 余韵] 这类非标准形式，
// JSON.parse 会失败，而旧 fallback 只按「、,，」切分 → [ ] ' " 「」 全留在词首尾，显示成「['戒备'」。
// 对策：①失败时把单引号换成双引号再 parse 一次 ②仍失败才切分 ③无论哪条路径都剥首尾包裹符号。
// R31 加固（真机残留：状态显示成 ["羞耻" / "恼怒" / "紧绷"] 三个脏芯片）：
//   ①包裹符号补全 全角 ［］｛｝〔〕〈〉＜＞ + 半角 {} <> + 项目符号 ·•※#*- 与成对引号；
//   ②切分符补全 | ｜ / ／；③去重（同一芯片不重复出现，真机出现过两个「紧绷」）；
//   ④纯符号残留（「-」这类）直接丢弃；⑤对象元素取「文本/标签/名称/name/tag」字段，避免 [object Object]。
function cleanTag(s){var t=String(s==null?'':s);t=t.replace(/^[\s"'“”‘’「」『』【】〔〕［］{}｛｝《》〈〉<>＜＞()（）\[\]·•※#*_=~\-—]+/,'');t=t.replace(/[\s"'“”‘’「」『』【】〔〕［］{}｛｝《》〈〉<>＜＞()（）\[\]。，、；;：:!！?？~]+$/,'');t=t.replace(/^[^\s：:]{1,4}[：:]\s*/,'');return t.trim();}
function tagList(raw){raw=String(raw==null?'':raw).trim();var list=null;if(raw.charAt(0)==='['){try{var a=JSON.parse(raw);if(Array.isArray(a))list=a;}catch(e){list=null;}if(!list){try{var b=JSON.parse(raw.replace(/'/g,'"'));if(Array.isArray(b))list=b;}catch(e2){list=null;}}}if(!list){var pool=raw.replace(/[「」『』【】〔〕［］{}｛｝《》〈〉<>＜＞()（）\[\]"'“”‘’]/g,' ');list=pool.split(/[、,，;；|｜\/／\s]+/);}var out=[],seen={};for(var i=0;i<list.length;i++){var x=list[i];if(x&&typeof x==='object'){x=(Array.isArray(x)?x.join('、'):(x['文本']||x['标签']||x['名称']||x['name']||x['tag']||''));}var t=cleanTag(x);if(!t)continue;if(/^[^0-9A-Za-z\u4e00-\u9fff]+$/.test(t))continue;if(seen[t])continue;seen[t]=1;out.push(t);}return out;}
function paintTags(panel){try{var boxes=panel.querySelectorAll('.mvu-tags[data-tags]');for(var i=0;i<boxes.length;i++){var el=boxes[i];var raw=(el.getAttribute('data-tags')||'').trim();var list=tagList(raw);[].slice.call(el.querySelectorAll('.mvu-tag')).forEach(function(t){t.remove();});var hot=el.getAttribute('data-hot')!=='off';   // R23：性癖是并列清单，首个不加高亮
for(var j=0;j<list.length;j++){if(!list[j])continue;var s=document.createElement('span');s.className='mvu-tag'+((hot&&j===0)?' mvu-tag-hot':'');s.textContent=list[j];el.appendChild(s);}var box=el.closest?el.closest('.mvu-field'):null;if(box)box.style.display=list.length?'':'none';}}catch(e){}}
function ensureTemplates(panel){panel.querySelectorAll('[data-mvu-list]').forEach(function(c){if(!c._tpl){c._tpl=c.querySelector('template');}});}
function renderList(container,state){const path=container.getAttribute('data-mvu-list');const tpl=container._tpl;if(!tpl)return;const keys=path.split('/').filter(Boolean);let members=val(state,keys)||[];if(!Array.isArray(members))members=[members];const prevOpen=new Set();container.querySelectorAll('details[open]').forEach(function(d){const n=d.querySelector('[data-key]');const k=(n&&n.getAttribute('data-key'))||d.textContent.slice(0,40);prevOpen.add(k);});[].slice.call(container.children).forEach(function(c){if(c!==tpl&&c!==container._empty&&!c.classList.contains('mvu-rule-input'))c.remove();});const bs=LIST[path]||[];const frag=document.createDocumentFragment();members.forEach(function(m){const lookup=lookupFactory(m,bs);[].slice.call(tpl.content.cloneNode(true).childNodes).forEach(function(node){const cl=node.cloneNode(true);replaceText(cl,lookup);replaceAttrs(cl,lookup);if(cl.nodeType===1&&cl.tagName==='DETAILS'){const n=cl.querySelector('[data-key]');const k=(n&&n.getAttribute('data-key'))||cl.textContent.slice(0,40);if(prevOpen.has(k))cl.setAttribute('open','');}frag.appendChild(cl);});});if(!members.length){const hint=container.getAttribute('data-mvu-empty');if(hint){if(!container._empty){container._empty=document.createElement('div');container._empty.className='mvu-empty';container._empty.textContent=hint;}container.appendChild(container._empty);}}else if(container._empty){container._empty.remove();}container.appendChild(frag);}
function recount(state){const g=function(p){const k=p.split('/').filter(Boolean);const v=val(state,k);return Array.isArray(v)?v.length:(v==null?0:1);};const items=val(state,['规则列表','条目'])||[];const alive=Array.isArray(items)?items.filter(function(x){const s=str(val(x,['状态']));return s!=='停用'&&s!=='待删除';}).length:0;const pending=val(state,['规则列表','待生效'])||[];const files=val(state,['档案卡'])||[];const present=Array.isArray(files)?files.filter(function(x){return val(x,['在场'])===true;}).length:0;state['计数']=state['计数']||{};state['计数']['规则']=alive;state['计数']['在场']=present;state['计数']['档案']=g('/档案卡');state['计数']['待生效']=(Array.isArray(pending)?pending.length:0);}
// R25：档案列表按「在场」排序（在场置顶，同组内保持原顺序）。
// 只在渲染层排序，**不写回变量、不让模型参与** —— 否则每轮都要整条数组 replace，token 会暴涨。
function sortArchive(state){try{const arr=val(state,['档案卡']);if(!Array.isArray(arr))return;const rank=function(m){return (val(m,['在场'])===true)?0:1;};arr.sort(function(a,b){return rank(a)-rank(b);});}catch(e){}}
// R25：在场状态跳变时展开/折叠一次；状态没变则不干预，保留用户手动折叠。
// 用面板实例私有对象记住上一次的在场状态（不写进变量，零 token）。
function autoExpand(panel,state){try{const arr=val(state,['档案卡'])||[];const store=panel._auto||(panel._auto={});const files=panel.querySelectorAll('.mvu-files > details.mvu-file');for(var i=0;i<files.length;i++){const m=arr[i];if(!m)continue;const key=str(val(m,['名字']))||('#'+i);const present=(val(m,['在场'])===true);if(store[key]!==present){if(present)files[i].setAttribute('open','');else files[i].removeAttribute('open');store[key]=present;}}}catch(e){}}
// R16-C：规则文本镜像 /规则列表/法则（string）。
// 原因：DSH 的 tavern_read_variables 对「数组路径」只返回成员描述（path/type，不带 value），
// 前台模型读完 /规则列表/条目 只拿到 /条目/0、/条目/1… 的路径，必须再逐个读一遍才拿到原文
// —— 一条规则一次工具调用（真机一轮 4 次以上，token 随规则数线性增长）。
// 现改为把「生效规则的纯文本清单」派生写进 /规则列表/法则（字符串，一次 read 全量返回），
// 自读指令只读这一个路径：工具调用与 token 都降到常数级。
function rulesText(sd){
  try{
    var items=(sd&&sd['规则列表']&&sd['规则列表']['条目'])||[];var lines=[],seen={};
    for(var i=0;i<items.length;i++){
      var r=items[i];if(!r||typeof r!=='object')continue;
      var st=(r['状态']==null)?'生效':(''+r['状态']);
      if(st==='停用'||st==='待删除')continue;
      var t=(r['文本']!=null)?(''+r['文本']):((r['内容']!=null)?(''+r['内容']):'');
      t=t.replace(/\s+/g,' ').trim();
      if(!t||seen[t])continue;                 // 同文本只输出一次：镜像里绝不出现重复条目
      seen[t]=1;lines.push(t);
    }
    return lines.map(function(x,j){return (j+1)+'. '+x;}).join('\n');
  }catch(e){return '';}
}
function syncMirror(sd){
  try{
    if(!sd||typeof sd!=='object')return false;
    var rl=sd['规则列表'];if(!rl||typeof rl!=='object')return false;
    var next=rulesText(sd);
    if(Object.prototype.hasOwnProperty.call(rl,'法则')&&str(rl['法则'])===next)return false;  // 幂等：内容一致不写
    rl['法则']=next;return true;
  }catch(e){return false;}
}
// R16-A 修复（跨会话规则串味 + 世界书高频全量重写）：世界书写规则通道**整体移除**。
// v1.2 在每次 render() 里用 updateWorldbookWith 把「强制法则快照」写进卡绑定世界书的
// [rules_inject] 常量条目。真机诊断（session-89123680）证明该写入是**成功落地**的，于是：
//   1) 世界书是**按卡存盘**的共享资源：A 会话写进去的规则会作为常量条目注入 B 会话 —— 规则跨会话串味，
//      且新会话面板显示 0 条规则、模型却仍在执行旧规则；
//   2) 每次 render 都 getWorldbook + replaceWorldbook 全量替换 35KB（真机统计：世界书读 1571 次、写 776 次）；
//   3) 与 [rules_selfread]「变量是唯一权威」构成双信源，模型在两套规则间打转、反复重读。
// 规则现在只走「MVU 变量 + 每轮自读」一条通道。仅在面板启动时做**一次性定向清洗**：
// 把历史版本写脏的 [rules_inject] 清空并停用（干净则连写都不写）。
var WB_NEUTRAL='【已停用】本条目不承载任何法则，其内容一律忽略；规则以 MVU 变量 /规则列表/法则 为唯一权威。';
var WB_PURGED=false;
function wbApi(){try{if(typeof window.getWorldbook==='function'&&typeof window.updateWorldbookWith==='function')return [window.getWorldbook,window.updateWorldbookWith];if(window.parent&&typeof window.parent.getWorldbook==='function'&&typeof window.parent.updateWorldbookWith==='function')return [window.parent.getWorldbook,window.parent.updateWorldbookWith];}catch(e){}return null;}
function isInjectEntry(e){if(!e||typeof e!=='object')return false;var nm=((e.name!=null?e.name:(e.comment!=null?e.comment:''))+'');return nm.indexOf('rules_inject')>=0;}
function purgeRulesInject(){
  if(WB_PURGED)return;WB_PURGED=true;                        // 每个面板实例只跑一次
  try{
    var pair=wbApi();if(!pair)return;
    Promise.resolve(pair[0]('')).then(function(entries){
      if(!Array.isArray(entries))return null;
      var dirty=false;
      for(var i=0;i<entries.length;i++){var e=entries[i];if(!isInjectEntry(e))continue;if((e.content==null?'':e.content+'')!==WB_NEUTRAL)dirty=true;}
      if(!dirty)return null;                                  // 世界书干净：不写回，避免无谓的全量替换
      return pair[1]('',function(draft){
        for(var j=0;j<draft.length;j++){var e=draft[j];if(!isInjectEntry(e))continue;e.content=WB_NEUTRAL;e.enabled=false;e.constant=false;if(e.strategy&&typeof e.strategy==='object')e.strategy.type='normal';}
        return draft;
      });
    }).catch(function(){});
  }catch(e){}
}
function fingerprint(state){try{return JSON.stringify([state['计数'],(val(state,['规则列表','条目'])||[]).length,(val(state,['规则列表','待生效'])||[]).length,(val(state,['档案卡'])||[]).length,str(val(state,['$meta','幕']))]);}catch(e){return '';}}
function readState(){try{const api=mvuApi();const data=(api||Mvu).getMvuData({type:'message',message_id:'latest'});if(!data)return null;if(data.stat_data&&typeof data.stat_data==='object')return data.stat_data;const stem=stemKeys().filter(function(k){return k in data;});if(stem.length){const sd={};stem.forEach(function(k){sd[k]=data[k];});return sd;}return null;}catch(e){return null;}}
// R17-B：每个实例只渲染**自己的**面板根节点（旧实现一律 querySelector('.mvu-panel')，多实例时会互相画到对方身上）；
// R17-D：渲染前套一层短时抑制，别的写者即使把刚删的规则写回来，本实例 3 秒内也不会把它画出来（消除「一秒闪现」）。
function render(){try{var panel=renderRoot();if(!panel)return;const raw=readState();if(!raw)return;tombSeed(raw);const state=applySuppression(deepCopy(raw)||raw);recount(state);sortArchive(state);CUR_STATE=state;ensureTemplates(panel);panel.querySelectorAll('[data-mvu-list]').forEach(function(c){renderList(c,state);});const lookup=lookupFactory(state,GLOBAL);replaceAttrs(panel,lookup);replaceText(panel,lookup);paintAvatars(panel);paintTags(panel);autoExpand(panel,state);LAST=fingerprint(state);}catch(e){}}
// R13 修复：render() 必须对 readState() 的返回做深拷贝再 recount。
// 旧实现直接 recount(getMvuData() 的返回对象)，在原地写入 /计数，可能被 MVU 视为一次变量变更，
// 从而触发 VARIABLE_UPDATE_ENDED → render() → 再改名 → 自激循环。
// R10 编辑日志自愈：面板按钮的权威操作记入内存日志；轮询时发现快照被回滚（重新生成/重结算
// 以旧快照覆盖了用户改动）就自动重写回最新快照。日志随面板刷新清空（刷新面板即放弃权威恢复）。
// R13 修复（写入死循环）：旧实现对同一规则重放 [add X, del X] 时先 push 再 filter，净结果不变却把 changed 置真，
// 导致 heal() 每 1.5s 空转全量写回变量（真机：面板闪烁 / 变量 revision 抖动 / 模型反复重读 / 单轮 token 膨胀）；
// 且 toggle 的 else 分支会把已删规则 push 回来（复活）。现改为「del 意图优先 + 重放前后快照比对」。
// R16-B 修复（编辑 / 删除规则后隔几秒自己复制一条）：日志从「操作序列重放」改为「意图计划 + 收敛式对账」。
// v1.2 的 replayJournal 逐条重放 op。一旦快照被「重新生成 / 重新结算」回滚到操作前，
// `add 新文本` 与 `edit 旧文本→新文本` 会各自命中一次：先把新文本 push 一条，再把旧条目改名成新文本，
// 同一条规则于是出现两份（真机证据：卡绑定世界书快照里出现 1./2./3. 三条中两条完全相同）。
// 现在改成：先把日志折叠成声明式计划（最终该存在哪些规则、改名链、删除墓碑），再把任意快照**收敛**到该计划。
// ============ R18-A：写入必须走**本 frame 自己的** window.Mvu（跨会话串味的真正根因）============
// 曾经的现象（session-d90e93f8）：切换会话后旧会话的规则出现在新会话里，删除的规则反复回来，
// 点按钮时被删规则显示一秒又隐藏。当时推断「第二个写者是还活着的旧面板实例」，
// 于是 v1.4 做了 localStorage 单写者租约（R17）——**两个前提都被源码证伪**：
//   1) iframe 是 sandbox="allow-scripts"（无 allow-same-origin）+ srcdoc ⇒ **opaque origin**
//      （retained-message-frames.js:48）。window.top.localStorage 抛 SecurityError，
//      window.localStorage 是 frame-document.js:168 注入的**每实例私有内存对象** —— 锁谁都是自己。
//   2) 真正的通道不是「有两个写者」，而是**写错了目标**：helper-host.js:108-141 在父窗装了 Mvu getter，
//      按 __dshTavernSelectedSessionId 做 rank（本面板 priority=-0.5）返回 selected.frameWindow.Mvu。
//      旧用法的 `window.parent.Mvu || window.Mvu` 在切走会话后会解析到**当前选中会话**那个 frame，
//      于是旧面板把自己的规则写进了新开的会话。
// 结论：只用 window.Mvu（frame-document.js 的 helperShim 按本 frame 的 sessionId 安装，
// 含 getMvuData/replaceMvuData，内部走 window.updateVariablesWith，**不参与 rank**）。
// 而写到哪个 chat 由 props.sessionId（message-frame-lifecycle.js:435 强制注入 → chatForSession）决定，
// 一个面板只能写自己那个会话 ⇒ 隔离由平台保证，**不需要自研任何跨实例协调**。
var TICK_MS=1200;
var TIMER=null; var MY_ROOT=null;
function findRoot(){
  try{
    var s=document.currentScript;
    if(s){ var prev=s.previousElementSibling;
      if(prev&&prev.classList&&prev.classList.contains('mvu-panel'))return prev;   // 本面板脚本紧跟在自己的面板 div 之后
      var up=s.parentNode; while(up&&up.nodeType===1){ if(up.classList&&up.classList.contains('mvu-panel'))return up; up=up.parentNode; } }
  }catch(e){}
  try{return document.querySelector('.mvu-panel');}catch(e){return null;}
}
// 关键：根节点**只在还没有的时候**认领一次。自己的节点一旦脱离 DOM，本实例即视为「退休」，
// 绝不允许再去找别的实例的面板来用——否则退休实例会继续活着写数据（真机串味的根）。
function ownRoot(){ if(!MY_ROOT)MY_ROOT=findRoot(); return MY_ROOT||null; }
function renderRoot(){ if(MY_ROOT&&MY_ROOT.isConnected!==false)return MY_ROOT; if(!MY_ROOT)return ownRoot(); return null; }
// —— 下面两个是**宿主判定工具**，v1.5 起不再用于门控写入（隔离由平台按 sessionId 保证，
//    旧的租约门闩已被 R18 作废）。保留它们是为了防止将来有人重写「不可见就不写」时踩同一批坑：
//    · 只认 visibilityState==='hidden'：jsdom 等宿主把 visibilityState 报成 'prerender'、hidden 恒 true，
//      用 document.hidden 会把「正常可写」误判成隐藏，症状是按钮点了毫无动静且控制台无报错；
//    · 根节点被摘掉（isConnected===false）代表本实例已退休，任何情况下都不该再去抓别的实例的面板。
function domLive(){ var r=MY_ROOT; return !!(r&&r.isConnected!==false); }
// 只认 visibilityState==='hidden'：jsdom 等宿主默认把 visibilityState 报成 'prerender'，
// 用 document.hidden 判定会把「正常可写」误判成隐藏（写权限被自己关掉）。
function isVisible(){
  try{ var vs=document.visibilityState; if(vs==='hidden')return false; if(vs===undefined&&document.hidden===true)return false; }catch(e){}
  try{ var fe=window.frameElement; if(fe&&fe.offsetParent===null)return false; }catch(e){}
  return true;
}
// ============ R17-D：删除后的短时显示抑制（消除「一秒闪现」的观感）============
// 即使后端还有别的写者把已删规则写回来，本实例在 3 秒内也不会把它画出来。
var SUPPRESS={}; var SUPPRESS_MS=3000;
function suppress(t){ try{ SUPPRESS[str(t)]=Date.now(); }catch(e){} }
function unsuppress(t){ try{ delete SUPPRESS[str(t)]; }catch(e){} }
function applySuppression(sd){
  try{
    if(!sd||typeof sd!=='object')return sd;
    var now=Date.now();
    for(var k in SUPPRESS){ if(!Object.prototype.hasOwnProperty.call(SUPPRESS,k))continue; if(now-SUPPRESS[k]>SUPPRESS_MS)delete SUPPRESS[k]; }
    var rl=sd['规则列表']; if(!rl||!Array.isArray(rl['条目']))return sd;
    var src=rl['条目'],out=[],dropped=false;
    for(var i=0;i<src.length;i++){ var kk=ruleKey(src[i]); if(kk&&SUPPRESS[kk]){dropped=true;continue;} out.push(src[i]); }
    if(dropped)rl['条目']=out;
  }catch(e){}
  return sd;
}
// 收敛是幂等的（重复执行结果相同），所以回滚、重放、并发写入都不可能再产生副本或让已删规则复活。
var RULE_JOURNAL=[];var HEALING=false;
var INTENT_TTL_MS=600000;   // 面板操作的「权威期」：10 分钟内快照被回滚会自动恢复，之后交给变量快照自决
// 意图必须**先于写回**入账（mutate 在写之前就记），否则 mutate 内的对账会拿旧计划把用户刚做的改动纠回去。
function jr(op,a,b){RULE_JOURNAL.push({op:op,a:a,b:b,t:Date.now()});return RULE_JOURNAL.length-1;}
function undoIntent(id){if(id>=0&&id<RULE_JOURNAL.length)RULE_JOURNAL[id]=null;}   // 写回失败：撤回意图，不留幻影
function ruleKey(x){var t=val(x,['文本']);if(t==null||t==='')t=val(x,['内容']);if(t==null)return '';return str(t);}
function ruleByKey(items,key){for(var q=0;q<items.length;q++){if(ruleKey(items[q])===key)return items[q];}return null;}
function resolveChain(chain,t){var guard={};while(Object.prototype.hasOwnProperty.call(chain,t)&&chain[t]!==t){if(guard[t])break;guard[t]=1;t=chain[t];}return t;}
// ============ R29 双层墓碑：变量层 + 内存层，取并集 ============
// R28 把墓碑落到了变量 /规则列表/已作废（解决「刷新 / 面板重建后意图丢失」），但真机（2.zip /
// session-7855f31e）证明仍会被「重新生成正文」打穿 —— 源码根因：
//   round-history.js:regenBody() 对 Chat 施加 `storyTimeline.apply({kind:'turn.rollback'})`，
//   prepareRollbackIntent() 用 readChatRevision(beforeRevision) 把**整个 Chat**（含
//   messages[i].variables[swipeId]，也就是 MVU 的 stat_data）还原到上一轮 checkpoint。
//   ⇒ 变量层墓碑连同本轮所有变量改动一起被回滚，已删 / 已停用的规则随即复活。
// 面板 iframe 的内存**不在聊天状态里**，不受这次回滚影响，所以再加一层内存墓碑：
//   · 变量层（/规则列表/已作废）：跨刷新、跨面板重建 —— 内存没了它还在；
//   · 内存层（TOMB_MEM）：跨 turn.rollback —— 变量被回滚了它还在。
// 两层取**并集**，任何一层存活都能拦住复活；heal() 每次把并集回写变量层（内存层自愈到变量层）。
// 值约定：'删除' / '停用' = 作废；'' = 用户**显式解除**（启用 / 新增 / 改名后的新文），
//         此时必须压过「变量层被回滚带回来的旧值」，否则「启用后又重新生成」会被打回停用。
var TOMB_MEM={};
function tombMapRaw(sd){var out={};try{var rl=(sd&&sd['规则列表'])||{};var arr=Array.isArray(rl['已作废'])?rl['已作废']:[];for(var i=0;i<arr.length;i++){var o=arr[i];if(!o||typeof o!=='object')continue;var t=ruleKey(o);var a=str(o['动作']);if(t&&a)out[t]=a;}}catch(e){}return out;}
function tombMap(sd){var out=tombMapRaw(sd);for(var k in TOMB_MEM){if(!Object.prototype.hasOwnProperty.call(TOMB_MEM,k))continue;var v=TOMB_MEM[k];if(v==='')delete out[k];else if(v)out[k]=v;}return out;}
function tombSeed(sd){try{var m=tombMapRaw(sd);for(var k in m){if(!Object.prototype.hasOwnProperty.call(m,k))continue;if(TOMB_MEM[k]===undefined)TOMB_MEM[k]=m[k];}}catch(e){}}
function tombWrite(sd){   // 内存层 → 变量层；返回是否有净变化
  try{
    var rl=ensureRules(sd);var arr=Array.isArray(rl['已作废'])?rl['已作废']:[];
    var out=[],seen={},i;
    for(i=0;i<arr.length;i++){var o=arr[i];if(!o||typeof o!=='object')continue;var t=ruleKey(o);if(!t||seen[t])continue;seen[t]=1;var mv=TOMB_MEM[t];if(mv!==undefined)o['动作']=mv;if(mv!=='')out.push(o);}
    for(var k in TOMB_MEM){if(!Object.prototype.hasOwnProperty.call(TOMB_MEM,k))continue;if(seen[k]||TOMB_MEM[k]==='')continue;out.push({文本:k,动作:TOMB_MEM[k]});seen[k]=1;}
    var same=(out.length===arr.length);
    if(same)for(i=0;i<out.length;i++){if(str(out[i]['动作'])!==str(arr[i]['动作'])||ruleKey(out[i])!==ruleKey(arr[i])){same=false;break;}}
    rl['已作废']=out;
    return !same;
  }catch(e){return false;}
}
function tombstone(sd,text,act){var t=str(text);if(!t)return;TOMB_MEM[t]=act;var rl=ensureRules(sd);var arr=Array.isArray(rl['已作废'])?rl['已作废']:[];var hit=null;for(var i=0;i<arr.length;i++){var o=arr[i];if(o&&typeof o==='object'&&ruleKey(o)===t){hit=o;break;}}if(hit){hit['动作']=act;}else{arr.push({文本:t,动作:act});}rl['已作废']=arr;}
function untombstone(sd,text){var t=str(text);if(!t)return;TOMB_MEM[t]='';var rl=ensureRules(sd);var arr=Array.isArray(rl['已作废'])?rl['已作废']:[];rl['已作废']=arr.filter(function(o){return !(o&&typeof o==='object'&&ruleKey(o)===t);});}
// 把 {动作:'删除'|'停用'|'启用'|'修改'} 的外部意图（结算模型经 /pending 落地的自然语言指令）
// 折算成墓碑 / 状态覆盖，使「用自然语言删掉的规则」不会被面板的权威期重新拉回来。
function externalIntents(sd){
  var out={removed:{},states:{}};
  try{
    var rl=(sd&&sd['规则列表'])||{};var items=Array.isArray(rl['条目'])?rl['条目']:[];
    var pend=Array.isArray(sd&&sd['pending'])?sd['pending']:[];var wa=Array.isArray(rl['待生效'])?rl['待生效']:[];
    var byIdx=function(g){if(!/^[0-9]+$/.test(g))return '';var n=parseInt(g,10);return (n>=1&&n<=items.length)?ruleKey(items[n-1]):'';};
    for(var i=0;i<pend.length;i++){
      var p=pend[i];if(!p||typeof p!=='object')continue;
      var act=str(p['动作']);var raw=str(p['目标']);if(!raw)continue;
      var tgt=byIdx(raw)||raw;
      if(act==='删除'||act==='修改')out.removed[tgt]=1;
      else if(act==='停用')out.states[tgt]='停用';
      else if(act==='启用')out.states[tgt]='生效';
    }
    for(var k=0;k<wa.length;k++){var s=str(wa[k]);if(s.indexOf('删除规则：')===0)out.removed[s.slice(5)]=1;}
    // R28：面板按钮留下的持久化墓碑，与内存日志同等效力
    var tm=tombMap(sd);
    for(var tt in tm){if(!Object.prototype.hasOwnProperty.call(tm,tt))continue;
      if(tm[tt]==='删除')out.removed[tt]=1;else if(tm[tt]==='停用')out.states[tt]='停用';}
  }catch(e){}
  return out;
}
function journalPlan(sd){
  var order=[],byText={},chain={},removed={},delFiles={};
  function item(t){return byText[t]||null;}
  function put(t,state,at){var it=item(t);if(!it){it={origin:t,text:t,state:state,gone:false,at:at||0};order.push(it);byText[t]=it;}else{it.gone=false;if(at)it.at=at;}if(removed[t])delete removed[t];return it;}
  for(var k=0;k<RULE_JOURNAL.length;k++){
    var j=RULE_JOURNAL[k];if(!j)continue;
    var a=str(j.a),b=str(j.b);if(!a)continue;
    if(j.op==='add'){put(a,'生效',j.t);}
    else if(j.op==='edit'){
      var nb=b||a;chain[nb]=nb;if(a!==nb)chain[a]=nb;
      var it=item(a)||put(a,'生效',j.t);
      if(it){if(it.text!==nb)delete byText[it.text];it.text=nb;byText[nb]=it;it.at=j.t;if(removed[nb])delete removed[nb];}
    }else if(j.op==='toggle'){
      var it2=item(a)||put(a,'生效',j.t);if(it2){it2.state=b||'生效';it2.at=j.t;}
    }else if(j.op==='del'){
      removed[a]=1;var it3=item(a);if(it3)it3.gone=true;
      var rt=resolveChain(chain,a);if(rt&&rt!==a)removed[rt]=1;   // 改名目标一并作废，杜绝「改名链把已删规则复活」
    }else if(j.op==='delFile'){delFiles[a]=1;}
  }
  var ext=externalIntents(sd);
  for(var t in ext.removed){if(!Object.prototype.hasOwnProperty.call(ext.removed,t))continue;removed[t]=1;var itx=byText[t];if(itx)itx.gone=true;}
  for(var s in ext.states){if(!Object.prototype.hasOwnProperty.call(ext.states,s))continue;var its=byText[s];if(its){its.state=ext.states[s];its.gone=false;}}
  return {order:order,removed:removed,delFiles:delFiles,tomb:tombMap(sd),
    resolve:function(t){return resolveChain(chain,t);},
    stateOf:function(t){var it=byText[t];return it?(it.state||'生效'):'';}};
}
// 收敛式对账（R20 后只管**存在性**，不再管状态）：① 删除墓碑优先 ② 按改名链改写 ③ 同文本去重 ④ 补齐计划要求存在但快照缺失的条目
function reconcileRules(sd,plan){
  var rl=sd['规则列表'];if(!rl||typeof rl!=='object')rl=sd['规则列表']={};
  if(!Array.isArray(rl['条目']))rl['条目']=[];
  if(!Array.isArray(rl['待生效']))rl['待生效']=[];
  var snap=function(){try{return JSON.stringify([rl['条目'],rl['待生效'],sd['档案卡']||[]]);}catch(e){return '';}};
  var before=snap();
  var raw=tombMapRaw(sd);                                 // R29：变量层**原始**墓碑（未经内存层合并）
  var src=rl['条目'],out=[],seen={},i;
  for(i=0;i<src.length;i++){
    var r=src[i];if(!r||typeof r!=='object')continue;
    var t=ruleKey(r);if(!t)continue;                 // 无文本条目：丢弃，避免面板出现空壳
    if(plan.removed[t])continue;
    var tb=plan.tomb||{};
    if(tb[t]==='删除')continue;                      // R28：持久化墓碑 · 已删除
    var nt=plan.resolve(t);
    if(!nt||plan.removed[nt]||tb[nt]==='删除')continue;
    if(seen[nt])continue;                            // ④ 去重：同文本只保留首次出现的那条
    seen[nt]=1;
    if(nt!==t){r['文本']=nt;if(r['内容']!=null)r['内容']=nt;}
    // R28：墓碑记「停用」就强制停用。墓碑由用户点击产生、**持久化在变量里**，
    // 不像内存日志那样存在多份副本互相 ping-pong，所以这里可以安全地覆盖状态。
    if(tb[nt]==='停用'&&str(r['状态'])!=='停用')r['状态']='停用';
    // R29 反向：变量层还写着「停用」、但内存层记着用户**显式启用**过（TOMB_MEM===''）⇒
    // 说明是 turn.rollback 把变量回滚到了启用之前，这里把状态改回生效，否则「启用后重新生成」会被打回停用。
    if(raw[nt]&&TOMB_MEM[nt]===''&&str(r['状态'])==='停用')r['状态']='生效';
    // R20 治本（规则状态反复翻转）：**不再用内存日志覆盖已存条目的「状态」**。
    // 旧实现是 `r['状态']=plan.stateOf(nt)` —— 无条件把内存 RULE_JOURNAL 里的状态写回快照。
    // 真机（chat-mv2li4xg-clrkyw）证明它会把任何一次分歧放大成永久 ping-pong：
    //   两份并存的快照副本各有一份 journal，heal() 每 5s 各写一次，
    //   于是两条规则轮流「生效/停用」，最快 1 秒翻一次，后期退化成严格互斥——
    //   用户启用的规则在若干轮里根本不出现在注入区块中。
    // 「状态」的唯一写者应当是用户的点击（toggleRule）与结算写回；对账只管**存在性**：
    //   去重、改名链、删除墓碑，以及下面那段「快照里缺失的条目按日志补回」。
    out.push(r);
  }
  var now=Date.now();
  for(i=0;i<plan.order.length;i++){
    var p=plan.order[i];if(p.gone)continue;
    var ft=plan.resolve(p.text);if(!ft||plan.removed[ft]||seen[ft])continue;
    if((plan.tomb||{})[ft]==='删除')continue;        // R28：墓碑里的删除不因「补缺失」而复活
    if(p.at&&now-p.at>INTENT_TTL_MS)continue;        // 权威期已过：不再把这条补回来（自然语言删除得以生效）
    seen[ft]=1;out.push({文本:ft,状态:((plan.tomb||{})[ft]==='停用')?'停用':(p.state||'生效'),轮次:(sd['$meta']&&sd['$meta']['轮次'])||0});
  }
  rl['条目']=out;
  rl['待生效']=rl['待生效'].filter(function(x){var sx=str(x);if(plan.removed[sx])return false;if(sx.indexOf('删除规则：')===0&&plan.removed[sx.slice(5)])return false;return true;});
  if(Array.isArray(sd['档案卡'])){
    var kill=function(x){return !plan.delFiles[str(x&&x['名字'])];};
    sd['档案卡']=sd['档案卡'].filter(kill);
  }
  return snap()!==before;                            // ★ 只有净变化才返回 true，杜绝空转写回
}
var HEAL_MIN_MS=5000;var LAST_HEAL_AT=0;var LAST_HEAL_HASH='';
function heal(){
  if(HEALING)return;
  // R18-A：R17 的 reconcileLeadership() 门闩已移除 —— 它的介质（localStorage）在面板 iframe 里是私有内存对象，
  // 门闩恒为真，留着只是假象。是否跨会话污染由 mvuApi() 锁定自身 frame 来保证。
  var now=Date.now();
  if(now-LAST_HEAL_AT<HEAL_MIN_MS)return;                 // 节流：最小写回间隔
  var full=readFull();if(!full)return;
  var next=deepCopy(full);if(!next)return;
  repair(next);
  if(!next.stat_data||typeof next.stat_data!=='object')return;
  var changed=false;
  // R29：先把变量层墓碑吸进内存层（变量随时可能被 turn.rollback 回滚，吸进来才丢不掉）。
  // 写回变量层的 tombWrite 放在 reconcileRules **之后**：对账需要看到「变量层原始的已作废」，
  // 才能判断出「用户已显式启用、只是变量被回滚回停用」这种情况（tombAlive）。
  try{tombSeed(next.stat_data);}catch(e0){}
  // R16-B：对账改成幂等收敛，无净变化时不写回 ——
  // 因此不再需要「日志为空就早退」的一次性开关：历史遗留的重复条目与冻结的法则镜像每 5s 都会自愈一次。
  // R20：收敛范围收窄到存在性（去重/墓碑/改名/补缺失），**不再覆盖条目状态**，见 reconcileRules 注释。
  try{changed=reconcileRules(next.stat_data,journalPlan(next.stat_data));}catch(e){return;}
  // R29：内存层自愈回变量层（重新生成正文回滚掉变量后，5 秒内墓碑自动落回 stat_data）。
  try{if(tombWrite(next.stat_data))changed=true;}catch(e0){}
  if(syncMirror(next.stat_data))changed=true;             // 法则镜像始终跟随条目（含结算模型写入的规则）
  if(!changed)return;                                     // 幂等：无净变化不写，杜绝空转写回
  var hash='';try{hash=JSON.stringify([next.stat_data['规则列表'],next.stat_data['档案卡']]);}catch(e){}
  if(hash&&hash===LAST_HEAL_HASH)return;                  // 与上次写回内容一致：不重复写，避免 revision 抖动
  recount(next.stat_data);
  if(!next.schema||typeof next.schema!=='object')next.schema={};
  HEALING=true;LAST_HEAL_AT=now;LAST_HEAL_HASH=hash;
  // 不在写回后主动 render：写回本身会触发 VARIABLE_UPDATE_ENDED → render()；
  // 若事件通道不生效，下一轮 poll() 的 fingerprint 比对也会补上。
  writeFull(next).then(function(){HEALING=false;LAST_HEAL_AT=Date.now();},function(){HEALING=false;LAST_HEAL_HASH='';});
}
// R18-A：不再结算领导者身份（见 heal 注释）。每一拍：先自愈写回，再按 fingerprint 决定是否重渲染。
function tick(){try{try{heal();}catch(e1){}try{syncPrompts();}catch(e2){}const st=readState();if(!st)return;const fp=fingerprint(st);if(fp!==LAST)render();}catch(e){}}
// R18-A（跨会话串味的根）：**必须**用本 frame 自己的 window.Mvu，绝不能优先 window.parent.Mvu。
// window.parent.Mvu 是 helper-host 装在父窗上的 getter，会按 __dshTavernSelectedSessionId 做 rank
// （src/client/runtime/helper-host.js:112-115，本面板 priority=-0.5）：
//   切<｜hy_place▁holder▁no▁813｜>会话后，这个 getter 会解析到**当前选中会话**那个 frame 的 Mvu，
//   于是旧会话的面板把自己的规则写进了新会话 —— 这才是「切换会话规则同步」的真正通道。
// frame 自身的 window.Mvu（src/client/runtime/frame-document.js 由 helperShim 安装）
// 只绑定到自己的 sessionId，不参与 rank，因此不会漂。
function mvuApi(){try{if(window.Mvu&&window.Mvu.replaceMvuData)return window.Mvu;}catch(e){}return null;}
function deepCopy(o){try{return JSON.parse(JSON.stringify(o));}catch(e){return null;}}
function readFull(){const api=mvuApi();if(!api)return null;try{const d=api.getMvuData({type:'message',message_id:'latest'});return d&&typeof d==='object'?d:null;}catch(e){return null;}}
// R18-A：原来的 reconcileLeadership() 门闩已废 —— 它的介质不可用（见下方说明），留着只会误伤写入。
// localStorage 在面板 iframe 里是**每实例私有的内存对象**（sandbox 无 allow-same-origin ⇒ opaque origin，
// frame-document.js:168 注入 localStorage shim；window.top.localStorage 直接抛 SecurityError），
// 所以 R17 的租约不可能生效：每个实例都把自己认成 leader。并发治理改由「锁定自身 frame 的 Mvu」承担。
function writeFull(full){const api=mvuApi();if(!api)return Promise.resolve(false);try{return Promise.resolve(api.replaceMvuData(full,{type:'message',message_id:'latest'})).then(function(){return true;},function(){return false;});}catch(e){return Promise.resolve(false);}}
function stemKeys(){return ['$meta','计数','规则列表','档案卡','pending'];}
// ============ R19-A 路线 A：规则真值改走 chat.tavernScriptPrompts，在请求时注入 ============
// 为什么换介质：v1.5 让主模型自己调 tavern_read_variables 读变量，模型只读一次就省掉后续调用
// （真机证据：50 条日志里只有 1 次 tool/call）⇒ 用户改了规则，下一轮仍按旧规则演。
// 现在规则由**请求侧**注入，模型根本不需要「自觉去读」，从机制上消除滞后一轮。
// 介质事实（源码级，勿再凭印象改）：
//   · 存储 = chat.tavernScriptPrompts，per-chat，随会话切走天然隔离；
//   · 落盘 = scriptPromptFrameInputs() 取 position==='in_chat' 的条目，转成
//     kind:'foreground.guide' + required:true 的帧输入（required ⇒ 不会被预算裁剪）；
//   · 幂等 = mutateScriptPrompts() 用 Map.set(prompt.id) 覆盖，同 id 重复注入无副作用；
//   · once:false ⇒ consumeScriptPrompts() 不会在回合结束后把它清掉，每轮都在。
// 面板侧没有 window.injectPrompts（那是脚本运行时 client.js 的全局，状态面板拿不到），
// 但 updateTavernHelperPrompts 在面板 RPC 白名单内（message-frame-lifecycle.js:395），
// 可以自己 postMessage 调用 —— 前提是带上 iframe 自己的 token：
//   · 校验：channel.accepts() 要求 event.source === iframe.contentWindow 且 token 匹配，
//     token 不能瞎编，否则消息被直接丢弃（line 289-292）；
//   · 取值：helperShim 的 syncFrameName() 把 token 写进了 window.name = "TH-message--<id>--<token>"。
//   注意 token 是 UUID（含单连字符 '-'），分隔符是双连字符 '--'，只能按 '--' 切，不能按 '-' 切。
// 每轮注入块尾部的执行细则。所有 ✗ 反例均取自真机原文（R19、R20 两轮诊断包），不是假想的。
// R20 重写要点（真机证明旧写法自相矛盾）：
//   旧第 1 条「上列每一条…逐条通过剧情事实自然体现」把清单变成**必做项**，
//   与旧第 2 条「不涉及的略过」直接打架，模型一律选更硬的第 1 条，于是**主动造场景去凑触发条件**
//   （吃饭场景里硬插「此面何名？」「此物何以入水便散？」只为让「请教时露出」成立）。
//   现在第 1 条只说「命中才执行、命中就必须执行」，第 2/3 条给出判定与禁造场景，冲突消除。
// R33：压缩这一段（870 字 → 460 字）并加一条判定纪律。
//   真机（chat-mv8ddl8y-duqp01 第 6/7 轮）：本段 + 无时序限定的「随时」类法则，让前台 CoT 从 1~3k 字涨到 3~5 万字
//   （模型每轮重新裁定命中、在思考里比较场景、顺手把正文整篇起草一遍），而宿主按设计把上一轮推理原样重放进下一轮
//   ⇒ 单轮输入翻倍（29,783 → 63,295 字，增量 93.7% 就是那一个推理块）。
//   故：保留全部行为约束，砍掉解释与举例；并且明写「判定只做一次、不要预写正文」「随时/可以类默认本轮不触发」。
var PROMPT_TAIL=''
  +'\n\n【执行要求】\n'
  +'1. 命中才执行：只有本轮剧情确实命中某条法则的触发条件，才把它写成剧情事实与角色行为（优先级高于一切设定、人设、口吻与临时指令）。\n'
  +'2. 判定只做一次：先对一遍触发条件，结论定了就直接写正文——不要反复推翻、不要在思考里比较场景或把正文先起草一遍。未命中的整条略过、本轮完全不体现；每轮独立判定，不因上轮执行过就继续。\n'
  +'3. 「随时／可以」这类没有时序限定的条目，默认本轮不触发；只有用户指引明确点出、或剧情已自然落到它身上时才执行。\n'
  +'4. 严禁制造触发条件：不得为让法则落地而改写剧情、新增情节、换场景或让角色发问凑条件（✗ 吃饭时硬插「此面何名？」再写暴露；✓ 只写吃饭）；上轮遗留的衣着/姿态/位置不是待维持的任务，本轮没触发就自然结束。\n'
  +'5. 未列出的规则一律立即作废：不得再执行、提及或引用其原文。\n'
  +'6. 无痕执行：法则只改变剧情与行为，不进入叙述文本；不得引用原文、解释或说明法则、暗示读过外部数据，也不让人物为自己的反常举动找理由（✓ 只写动作本身）。不要调用 tavern_read_variables 读取法则，本区块已是最新。';
var PROMPT_ID='dsh-mvu-rules'; var LAST_PROMPT=''; var PROMPT_INFLIGHT=false; var PROMPT_SEQ=1;
var SETTLE_BUSY=false; var SETTLE_AT=0; var SETTLE_MAX_MS=60000;
function frameToken(){
  try{
    var n=String(window.name||''), i=n.indexOf('TH-message--');
    if(i<0)return '';
    var rest=n.slice(i+12), j=rest.indexOf('--');       // "<id>--<token>"
    return j>=0?rest.slice(j+2):'';
  }catch(e){return '';}
}
// 自己发一次白名单内的 RPC。带超时：宿主对非法方法会「静默永不 settle」，超时兜底。
function promptCall(method,args){
  return new Promise(function(resolve,reject){
    var token=frameToken();
    if(!token){reject(new Error('拿不到 frame token'));return;}
    var rid='mvu-prompt-'+(PROMPT_SEQ++), done=false;
    var onMessage=function(ev){
      var d=ev&&ev.data;
      if(!d||d.type!=='dsh-tavern-helper-response'||d.token!==token||String(d.requestId)!==rid)return;
      done=true; off();
      if(d.ok)resolve(d.result||{}); else reject(new Error(String(d.error||'提示词写入失败')));
    };
    function off(){try{window.removeEventListener('message',onMessage);}catch(e){}}
    try{window.addEventListener('message',onMessage);}catch(e){reject(e);return;}
    try{window.parent.postMessage({type:'dsh-tavern-helper-call',token:token,requestId:rid,method:method,args:args||{}},'*');}
    catch(e){off();reject(e);return;}
    try{window.setTimeout(function(){if(!done){done=true;off();reject(new Error('提示词写入超时'));}},8000);}catch(e){}
  });
}
function promptText(laws){
  var lines=String(laws||'').split('\n').filter(function(s){return s.trim();});
  // R20：不再写「共 N 条」——编号列表 + 条数会被模型读成待办清单（真机第 5/6/7 轮即因此逐条硬凑）。
  // 改成明示「编号只是标识，不代表本轮都要用到」。
  var head=lines.length
    ? '【本局强制法则（每轮注入，为最新值）】\n以下 '+lines.length+' 条是本局当前生效的强制法则（编号只作标识，不代表本轮都要用到；是否执行看各自的触发条件本轮是否命中）：\n'+lines.join('\n')
    : '【本局强制法则（每轮注入，为最新值）】\n本轮没有任何强制法则，按人设与剧情正常演出即可。';
  // R33：没有法则时只回一句，不再追加《执行要求》（那段只在真的有法则要判定时才有意义）。
  if(!lines.length)return head;
  return head+PROMPT_TAIL;
}
// R30：**注入前先按并集墓碑过一遍**。真机（4.zip / chat-mv7czkyj-wbfpw3）：
// 重新生成正文会 roll back stat_data，面板 iframe 又是新的（LAST_PROMPT 为空），
// 于是 start() 一上来就把回滚后的旧 /规则列表/法则 原样注入回去 ⇒「重新生成的注入还是老的」。
// 变量层还没被 heal 修好没关系 —— 这里**纯本地**按墓碑过滤后再生成镜像文本，
// 墓碑在内存层还活着，注入就绝不可能是旧的。
function lawsForPrompt(sd){
  try{
    var c=deepCopy(sd);
    if(!c||!c['规则列表'])return str(((sd||{})['规则列表']||{})['法则']);
    var tm=tombMap(sd),items=Array.isArray(c['规则列表']['条目'])?c['规则列表']['条目']:[];
    var out=[],i;
    for(i=0;i<items.length;i++){
      var r=items[i];if(!r||typeof r!=='object')continue;
      var t=ruleKey(r);if(!t)continue;
      if(tm[t])continue;                                // 已作废（删除/停用）：绝不注入
      out.push(r);
    }
    c['规则列表']['条目']=out;
    return rulesText(c);
  }catch(e){return str(((sd||{})['规则列表']||{})['法则']);}
}
// R30：提示词写入失败必须**可见**。真机（4.zip）里最新的第 6 轮完全没有注入块，
// 而宿主侧 08:20:02 之后再没有任何 updateTavernHelperPrompts 记录 —— 说明失败发生在
// 面板本地（拿不到 frame token / 超时 / stale）而不是宿主。这类失败以前是静默的，
// 现在一律 console.warn（会出现在诊断包的 display.frames[].console 里），下次就能直接读到原因。
var PROMPT_ERR=''; var PROMPT_ERR_AT=0;
function promptFail(where,err){
  PROMPT_ERR=where+': '+(err&&err.message?err.message:String(err));
  PROMPT_ERR_AT=Date.now();
  try{console.warn('[mvu] 提示词注入失败 → '+PROMPT_ERR);}catch(e){}
}
// 注入必须避开 MVU 结算事务：updatePrompts 在事务进行中会把写入并入结算草稿，
// 而我们拿不到结算的 eventId ⇒ assertTransactionEvent() 直接抛
// 「脚本异步写入未携带当前 MVU 结算事件身份，已拒绝」（tavern-script-host-adapter.js:136-144）。
// 失败不置位 LAST_PROMPT ⇒ 下一轮 tick(1.2s) 自动重试。
function syncPrompts(){
  if(PROMPT_INFLIGHT)return Promise.resolve(false);
  if(SETTLE_BUSY && Date.now()-SETTLE_AT<SETTLE_MAX_MS)return Promise.resolve(false);
  SETTLE_BUSY=false;                                   // 事务结束事件丢了也不能永久卡死
  var st=readState(); if(!st)return Promise.resolve(false);
  var laws=lawsForPrompt(st);
  // R30 心跳重发：stale / 超时等失败后，即使 laws 与 LAST_PROMPT 相同也每 6s 重发一次。
  // 真机出现过「remove 成功后再也注入不回来」——注入介质 chat.tavernScriptPrompts 是持久的，
  // 一旦漏掉一次就一直缺着，必须有兜底重发。
  var force=!!(PROMPT_ERR&&Date.now()-PROMPT_ERR_AT>6000);
  if(laws===LAST_PROMPT&&!force)return Promise.resolve(false);
  PROMPT_INFLIGHT=true;
  // R30：**永不下线**。真机（4.zip）就是因为 laws 变空时发了 remove，把持久提示词删掉；
  // 之后面板再也没能重新注入（宿主侧 08:20:02 之后零记录）⇒ 最新一轮完全没有法则区块，
  // 而 [rules_selfread] 那套「区块不存在就自读变量」的兜底也没触发 ⇒ 规则彻底失效。
  // 改成「空法则也注入一条明示的本轮无法则区块」：区块恒在，内容每轮刷新，
  // 配合区块里「未列出的规则一律立即作废」，空清单同样能正确作废全部旧规则。
  var op={kind:'inject',prompts:[{id:PROMPT_ID,content:promptText(laws),position:'in_chat',role:'system',depth:0,should_scan:false}],once:false};
  return promptCall('updateTavernHelperPrompts',{operation:op}).then(function(r){
    if(r&&r.stale)throw new Error('stale-target 聊天已变化，提示词未保存');
    LAST_PROMPT=laws;PROMPT_ERR='';
    return true;
  },function(err){ promptFail('updateTavernHelperPrompts',err); return false; })
   .then(function(ok){PROMPT_INFLIGHT=false;return ok;});
}
function repair(full){if(!full||typeof full!=='object')return full;const bad=stemKeys().filter(function(k){return k in full&&!(full.stat_data&&k in full.stat_data);});if(!bad.length)return full;if(!full.stat_data||typeof full.stat_data!=='object')full.stat_data={};bad.forEach(function(k){full.stat_data[k]=full[k];delete full[k];});return full;}
// R17-C：每次尝试都**重新读一次最新快照**再套用变更函数，而不是复用上一次的内存副本 ——
// 面板写回与结算模型写回是并发的，拿旧副本整体覆盖会把并发方的改动一起抹掉（lost update）。
function buildNext(fn){
  const full=readFull();if(!full)return null;
  const next=deepCopy(full);if(!next)return null;
  repair(next);
  if(!next.stat_data||typeof next.stat_data!=='object')next.stat_data={};
  try{fn(next.stat_data,next);}catch(e){return null;}
  try{reconcileRules(next.stat_data,journalPlan(next.stat_data));}catch(e){}
  syncMirror(next.stat_data);recount(next.stat_data);
  if(!next.schema||typeof next.schema!=='object')next.schema={};
  return next;
}
function mutate(fn,intent){
  let id=-1;
  if(intent&&intent.length)id=jr(intent[0],intent[1],intent[2]);
  const attempt=function(i){
    const next=buildNext(fn);
    if(!next){if(id>=0)undoIntent(id);return Promise.resolve(false);}
    return writeFull(next).then(function(ok){
      if(ok)return true;
      if(i<1)return attempt(i+1);                        // 失败（多为租约被抢占 / 并发冲突）：拿最新快照重试一次
      if(id>=0)undoIntent(id);
      return false;
    },function(){ if(i<1)return attempt(i+1); if(id>=0)undoIntent(id); return false; });
  };
  return attempt(0);
}
function toast(msg){let el=document.querySelector('.mvu-toast');if(!el){el=document.createElement('div');el.className='mvu-toast';document.body.appendChild(el);}el.textContent=msg;el.classList.add('mvu-toast-on');clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove('mvu-toast-on');},2600);}
function ensureRules(sd){sd['规则列表']=sd['规则列表']||{};sd['规则列表']['条目']=sd['规则列表']['条目']||[];sd['规则列表']['待生效']=sd['规则列表']['待生效']||[];sd['规则列表']['已作废']=sd['规则列表']['已作废']||[];return sd['规则列表'];}
function ruleByText(items,text){return ruleByKey(items,str(text));}
function panelRoot(){return renderRoot();}
function addRule(text){unsuppress(text);mutate(function(sd){const rl=ensureRules(sd);untombstone(sd,text);rl['条目'].push({文本:text,状态:'生效',轮次:(sd['$meta']&&sd['$meta']['轮次'])||0});},['add',text,'']).then(function(ok){if(ok){toast('规则已实时生效');setTimeout(render,120);}else{toast('写入失败：无写回通道或状态未初始化');}});}
// R28：旧文进墓碑（否则下一轮模型按正文把旧文重新提取回来，修改就被「重置」了）；新文解除墓碑。
function commitEdit(oldText,newText){unsuppress(newText);suppress(oldText);mutate(function(sd){const rl=ensureRules(sd);const it=ruleByText(rl['条目'],oldText);if(it){it['文本']=newText;it['内容']=newText;}else{rl['条目'].push({文本:newText,状态:'生效',轮次:(sd['$meta']&&sd['$meta']['轮次'])||0});}if(str(oldText)!==str(newText))tombstone(sd,oldText,'删除');untombstone(sd,newText);},['edit',oldText,newText]).then(function(ok){if(ok){toast('已保存修改');setTimeout(render,120);}else{toast('写入失败');}});}
// R28：停用**不再 suppress**。suppress 只把条目藏 3 秒（SUPPRESS_MS=3000），过期就又冒出来，
// 观感正是「先隐藏一会、过几秒又显示」。模板本就按状态渲染停用条目（灰化 + 划线），直接改状态即可。
function toggleRule(text){var cur=readState();var it0=cur&&ruleByText(((cur['规则列表']||{})['条目'])||[],text);var s0=it0?str(it0['状态']):'';var ns=(s0==='停用'||s0==='待删除')?'生效':'停用';unsuppress(text);mutate(function(sd){const rl=ensureRules(sd);const it=ruleByText(rl['条目'],text);if(it)it['状态']=ns;if(ns==='停用')tombstone(sd,text,'停用');else untombstone(sd,text);},['toggle',text,ns]).then(function(ok){if(ok){toast('已切换规则状态');setTimeout(render,120);}else{toast('写入失败');}});}
// R28：删除同时写墓碑。只靠内存日志的话，重新生成正文后日志没了，模型会按正文把这条重新提取回来。
function delRule(text){suppress(text);mutate(function(sd){const rl=ensureRules(sd);rl['条目']=rl['条目'].filter(function(x){return ruleKey(x)!==str(text);});rl['待生效']=rl['待生效'].filter(function(x){return str(x)!==text&&str(x)!==('删除规则：'+text);});tombstone(sd,text,'删除');},['del',text,'']).then(function(ok){if(ok){toast('已删除规则');setTimeout(render,120);}else{toast('写入失败');}});}
function delFile(name){mutate(function(sd){sd['档案卡']=(sd['档案卡']||[]).filter(function(x){return (x&&(x['名字']||''))!==name;});},['delFile',name,'']).then(function(ok){if(ok){toast('已删除档案');setTimeout(render,120);}else{toast('写入失败');}});}
function editRule(text){const host=(panelRoot()||document).querySelector('[data-mvu-list="/规则列表/条目"]');if(!host)return;const bar=document.createElement('div');bar.className='mvu-rule mvu-rule-input';const safe=String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');bar.innerHTML='<input class="mvu-input" value="'+safe+'" placeholder="修改规则原文，回车确认" /><button class="mvu-btn mvu-btn-add" type="button">保存</button><button class="mvu-btn" type="button">取消</button>';host.insertBefore(bar,host.firstChild);const inp=bar.querySelector('input');const ok=function(){const v=(inp.value||'').trim();if(!v){toast('规则内容不能为空');return;}bar.remove();commitEdit(text,v);};inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();ok();}});bar.children[1].addEventListener('click',ok);bar.children[2].addEventListener('click',function(){bar.remove();});inp.focus();inp.select();}
function askRule(){const bar=document.createElement('div');bar.className='mvu-rule mvu-rule-input';bar.innerHTML='<input class="mvu-input" placeholder="输入规则原文，回车确认" /><button class="mvu-btn mvu-btn-add" type="button">加入</button><button class="mvu-btn" type="button">取消</button>';const host=(panelRoot()||document).querySelector('[data-mvu-list="/规则列表/条目"]');if(!host)return;host.insertBefore(bar,host.firstChild);const inp=bar.querySelector('input');const ok=function(){const v=(inp.value||'').trim();if(!v){toast('规则内容不能为空');return;}bar.remove();addRule(v);};inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();ok();}});bar.children[1].addEventListener('click',ok);bar.children[2].addEventListener('click',function(){bar.remove();});inp.focus();}
function bindInteractions(panel){if(panel._mvuBound)return;panel._mvuBound=true;panel.addEventListener('click',function(e){const btn=e.target.closest&&e.target.closest('[data-mvu-act]');if(!btn)return;if(btn.closest('summary'))e.preventDefault();const act=btn.getAttribute('data-mvu-act');const key=btn.getAttribute('data-key')||'';if(act==='add-rule'){e.preventDefault();askRule();}else if(act==='edit-rule'){e.preventDefault();editRule(key);}else if(act==='toggle-rule'){e.preventDefault();toggleRule(key);}else if(act==='del-rule'){e.preventDefault();e.stopPropagation();delRule(key);}else if(act==='del-file'){e.preventDefault();e.stopPropagation();delFile(key);}});}
async function start(){
  // R30：面板是 persistent 侧边栏帧，宿主在「status-stale」时会重建它（client.js:4779 的
  // data-dsh-tavern-status-refresh）—— 重建后 TOMB_MEM 与 LAST_PROMPT 都归零。
  // 这里留一条启动日志（会进诊断包 display.frames[].console），下次直接就能看出
  // 帧是否被重建、token 是否拿得到。
  try{console.info('[mvu] 面板启动 token='+(frameToken()||'缺失')+' name='+String(window.name||''));}catch(e){}
  try{await waitGlobalInitialized('Mvu');}catch(e){}try{MY_ROOT=MY_ROOT||findRoot();}catch(e){}const events=new Set([Mvu.events.VARIABLE_INITIALIZED,Mvu.events.VARIABLE_UPDATE_ENDED].concat(Object.values(tavern_events)));events.forEach(function(e){eventOn(e,render);});render();const p=panelRoot();if(p)bindInteractions(p);purgeRulesInject();try{eventOn(Mvu.events.VARIABLE_UPDATE_STARTED,function(){SETTLE_BUSY=true;SETTLE_AT=Date.now();});eventOn(Mvu.events.VARIABLE_UPDATE_ENDED,function(){SETTLE_BUSY=false;});}catch(e0){}try{syncPrompts();}catch(e0){}try{if(TIMER)clearInterval(TIMER);}catch(e){}TIMER=setInterval(tick,TICK_MS);try{window.addEventListener('pagehide',function(){try{clearInterval(TIMER);}catch(e3){}});}catch(e){}document.addEventListener('visibilitychange',function(){if(!document.hidden)render();});window.addEventListener('focus',render);}
try{MY_ROOT=findRoot();}catch(e){}   // 同步捕获自己的根节点：此刻 document.currentScript 仍然有效
start().catch(function(error){console.error('MVU 面板渲染失败',error);});
})();
</script>
</body></html>
```