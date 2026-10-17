/**
 * dsh-tavern-mvupanel —— Tavern「MVU 面板」插件 · 浏览器半（客户端 v5 / 模型 R32）
 *
 * 按《插件开发：接口参考》第 2 版写：Tavern 用 window.__ModuleLoader__.load 加载，
 * id 与 package.json 的 name 一致；inject ['tavernUi','slots']；React 用 require('react') 取；
 * 数据与操作全部走 tavernUi.callHost()（宿主半用 ctx.tavern.handle 注册）。
 *
 * v19：图标 13px → 16px（描边 1.7），按钮高度 24px → 22px、圆角 7px，让图标撑满按钮。
 * v18：卡片按钮高度 20px → 24px（图标仍 13px，上下留白更舒展）。
 * v17：图 / 同 / 清 / 删 四个按钮也换成内联 SVG（图片框、双向循环、橡皮擦、垃圾桶），卡片按钮栏全是图标。
 * v16：导出按钮换成内联 SVG 下载图标（托盘箭头，13px，跟随 currentColor；按钮内部改 flex 居中）。
 * v15：低密度也把卡名叠在封面底部（不再在图片下方占一行）；卡片按钮改成方形圆角、flex 均分自动铺满
 *     按钮行；导出按钮的字改成下载箭头「↓」。
 * v14：导入按钮从第一行挪到第二行、紧贴翻页左侧；第一行只留搜索 / 分组 / 统计 / 列 × 行。
 * v13：工具栏改成固定两行 —— 第一行 搜索 / 分组 / 统计 / 列 × 行；第二行 全选本页 / 移到分组 /
 *     移到分组 / 更新 / 删除所选 / 完成，翻页固定在最右。
 * v12：批量条补齐原生那套 ——「移到分组…」（写 card-organization.json，可新建分组）、「更新」（重扫图片，
 *     产物已是最新修订只换引用）、「完成」（清空选择）；按钮常驻，无选中时灰。宿主半 avatarSync 同改版本判断。
 * v11：顶部那段长说明收进「说明」按钮（openOverlay 弹窗，老版本退回 alert）；导入记录移到宫格下方；
 *     高密度把卡名叠在封面底部（渐变条 + 单行省略）。
 * v10：封面改用人物卡库那张原图 —— 直接请求 Tavern 的 /api/dsh-tavern/card-image?path=cards/<卡>.json
 *     （读 originals/cards/<同名>.png），失败再退到插件头像目录里同步过的图，都没有才显示「无图」。
 * v9：密度改成自选「列 × 行」（列 / 行各 2–6，每页格数 = 列 × 行，选择记在本机 localStorage）。
 *     列 ≥ 6 自动高密度：只留封面与图 / 出 / 删；列 ≤ 5 低密度：卡名 + 全部五个按钮。
 *     另加一条提示：status 里没有 coverReady 说明宿主半还没重启，封面画不出来。
 * v8：卡片区改成封面向的宫格（与 Tavern 原生宫格同一套体验：搜索 + 分组筛选 + 全选本页 + 批量删除 +
 *     密度切换）。每格图片下方一条按钮栏：按钮只写一个字、各自一个彩色圆形图标；高密度只留图片与「导出」，
 *     低密度显示全部（图 / 同 / 清 / 出 / 删）与卡名。封面 URL 来自宿主半 status 的 row.cover。
 * v5：列表只留「导出 / 删除」两个行内按钮（去掉 ⋯ 展开、复制卡名、行内刷新、清理源卡）；
  * v6：新增「图片上传（按卡 · 单卡）」——只内嵌这张卡自己的角色图；上传的图片文件转换后立即删除（不留底）；该模式下导入限制为单卡。
 *     导入记录全部成功后 6 秒自动收起（有失败则保留）；卡片列表默认 15 条一页并支持批量删除。
 * v4 起：插件页自带导入（可多选 PNG/JSON），导入即转换，只落地「原名 mvu版.json」一张卡；
 *     大文件按 72 KB 分块上传（callHost 单次参数上限 256 KB）。
 * v3 的教训保留：DSH 设置壳的 section 一旦渲染抛错会被判 crash 并整格退休，所以所有可能抛错的
 *     地方都包住，出错时页面显示文本并自报宿主日志。
 */
window.__ModuleLoader__.load({
	id: "dsh-tavern-mvupanel",
	factory: (require) => {
		const React = require("react");
		const h = React.createElement;
		const PLUGIN = "dsh-tavern-mvupanel";
		const CLIENT_TAG = "客户端 v19";
		/** 宫格圆按钮的配色：一个动作一个色 */
		const DOT = { pic: "#3b82f6", sync: "#22a06b", clear: "#d98324", export: "#7c5cff", remove: "#d64545" };

		/** 卡片按钮图标：统一 13px、白色描边（跟随按钮 currentColor） */
		const iconSvg = (parts, width) => h("svg", {
			width: "16", height: "16", viewBox: "0 0 18 18", fill: "none",
			stroke: "currentColor", strokeWidth: width || 1.7, strokeLinecap: "round", strokeLinejoin: "round",
			"aria-hidden": "true", focusable: "false",
		}, parts);

		/** 图：图片框（矩形 + 太阳 + 山） */
		const IconPicture = () => iconSvg([
			h("rect", { key: "frame", x: 2.6, y: 3.8, width: 12.8, height: 10.4, rx: 1.8 }),
			h("circle", { key: "sun", cx: 6.4, cy: 7.4, r: 1.2 }),
			h("path", { key: "hill", d: "M3.4 12.6l3.6-3.4 2.6 2.4 1.9-1.7 2.9 2.7" }),
		]);

		/** 同：双向循环箭头 */
		const IconSync = () => iconSvg([
			h("path", { key: "arcTop", d: "M14 7.2A5.2 5.2 0 0 0 4.9 5" }),
			h("path", { key: "headTop", d: "M4.9 5V2.6M4.9 5h2.4" }),
			h("path", { key: "arcBottom", d: "M4 10.8A5.2 5.2 0 0 0 13.1 13" }),
			h("path", { key: "headBottom", d: "M13.1 13v2.4M13.1 13h-2.4" }),
		]);

		/** 清：橡皮擦（擦掉引用，不是删文件） */
		const IconClear = () => iconSvg([
			h("path", { key: "body", d: "M3.6 10.4 9 5a1.9 1.9 0 0 1 2.7 0l2.6 2.6a1.9 1.9 0 0 1 0 2.7l-4.6 4.6H5.4z" }),
			h("path", { key: "line", d: "M9.6 14.9h4.8" }),
		]);

		/** 删：垃圾桶 */
		const IconTrash = () => iconSvg([
			h("path", { key: "lid", d: "M3.4 5.4h11.2" }),
			h("path", { key: "handle", d: "M6.9 5.4V3.6h4.2v1.8" }),
			h("path", { key: "body", d: "M4.9 5.4 5.7 14.6h6.6l.8-9.2" }),
			h("path", { key: "bars", d: "M7.8 8v4M10.2 8v4" }),
		]);

		/** 导出按钮的图标：托盘箭头 */
		const DownloadIcon = () => iconSvg([
			h("path", { key: "stem", d: "M9 3.2v7.6" }),
			h("path", { key: "head", d: "M5.9 8.1 9 11.2l3.1-3.1" }),
			h("path", { key: "base", d: "M4.2 14.4h9.6" }),
		], 1.7);
		/** 宫格行列：用户自选，每页格数 = 列 × 行；列 ≥ 4 自动高密度 */
		const GRID_COLS = [2, 3, 4, 5, 6];
		const GRID_ROWS = [2, 3, 4, 5, 6];
		const GRID_KEY = "dsh-mvupanel/grid";
		const GRID_FALLBACK = { cols: 5, rows: 3 };

		function readGridPref() {
			try {
				const raw = JSON.parse(localStorage.getItem(GRID_KEY) || "null") || {};
				const cols = GRID_COLS.includes(Number(raw.cols)) ? Number(raw.cols) : GRID_FALLBACK.cols;
				const rows = GRID_ROWS.includes(Number(raw.rows)) ? Number(raw.rows) : GRID_FALLBACK.rows;
				return { cols, rows };
			} catch (error) { return Object.assign({}, GRID_FALLBACK); }
		}

		function saveGridPref(next) {
			try { localStorage.setItem(GRID_KEY, JSON.stringify(next)); } catch (error) { /* 本地存储不可用也不影响用 */ }
		}
		const MAX_UPLOAD = 16 * 1024 * 1024;

		const SWITCHES = [
			["enabled", "启用插件页导入", "开 = 可以在这里导入角色卡并生成 MVU 卡；关 = 只读展示，不导入、不刷新"],
			["watchManaged", "只监视自己管理的卡", "开 = 自己管的 MVU 卡被外部改掉产物时自动补回；关 = 完全不自动重写"],
			["overwriteManaged", "覆盖已存在的 MVU 卡", "开 = 导入同名卡时直接覆盖已有「X mvu版.json」；关 = 拒绝覆盖并提示（更安全）"],
			["hideInitvar", "隐藏开场初值（省 token）", "用 promptOnly 正则把 <initvar> 挡在模型上下文之外，初始化仍照常发生"],
			["selfread", "前台兜底自读指令", "面板注入失效时的后备通道；常驻前台，每轮多约 545 字符，默认关"],
			["dedupeWorldbook", "世界书去重（省 token）", "停用与人物卡 description / personality 逐行重复的常驻世界书条目：内容与触发词都不动，只把 enabled 置为关，每轮省下它们的字数"],
		];

		const S = {
			section: { display: "flex", flexDirection: "column", gap: "14px", width: "100%", maxWidth: "880px", boxSizing: "border-box" },
			heading: { margin: 0, fontSize: "15px", fontWeight: 600 },
			intro: { margin: 0, fontSize: "13px", lineHeight: "20px", opacity: 0.75 },
			list: { display: "flex", flexDirection: "column", gap: "2px", borderRadius: "12px", overflow: "hidden" },
			row: { display: "flex", gap: "10px", alignItems: "flex-start", padding: "9px 12px" },
			label: { fontSize: "13px", lineHeight: "19px" },
			sub: { fontSize: "12px", lineHeight: "18px", opacity: 0.62 },
			note: { fontSize: "12px", lineHeight: "18px", opacity: 0.8 },
			error: { fontSize: "12px", lineHeight: "18px", color: "var(--dsw-alias-state-error-primary)" },
			report: { margin: 0, padding: "10px 12px", borderRadius: "10px", background: "var(--dsw-alias-bg-layer-1)", fontSize: "12px", lineHeight: "18px", whiteSpace: "pre-wrap", maxHeight: "240px", overflow: "auto" },
			segment: { display: "flex", gap: "6px" },
			seg: { flex: "1 1 0", padding: "8px 10px", borderRadius: "8px", border: "1px solid transparent", background: "var(--dsw-alias-bg-layer-1)", fontSize: "13px", cursor: "pointer" },
			segActive: { borderColor: "var(--dsw-alias-border-l2)", fontWeight: 600 },
			cardRow: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderTop: "1px solid var(--dsw-alias-border-l2)" },
			grid: { display: "grid", gap: "8px", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" },
			bar: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "2px 0" },
			gridDense: { gap: "5px" },
			mini: { padding: "2px 3px", borderRadius: "6px", border: "1px solid rgba(128,160,255,.35)", background: "#1b2434", color: "#e8eefc", fontSize: "12px", colorScheme: "dark" },
			tile: { display: "flex", flexDirection: "column", gap: "4px", padding: "5px", borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", cursor: "pointer", overflow: "hidden", boxSizing: "border-box" },
			tileOn: { borderColor: "#4f8cff", boxShadow: "inset 0 0 0 1px #4f8cff" },
			tilePic: { position: "relative", width: "100%", aspectRatio: "3 / 4", borderRadius: "7px", overflow: "hidden", background: "rgba(128,150,190,.14)", display: "flex", alignItems: "center", justifyContent: "center" },
			tileImg: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" },
			tileEmpty: { fontSize: "11px", opacity: 0.5 },
			tileName: { fontSize: "12px", lineHeight: "16px", overflow: "hidden", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
			tileBar: { display: "flex", gap: "3px", justifyContent: "center", flexWrap: "wrap" },
			dot: { flex: "1 1 0", minWidth: 0, height: "22px", padding: 0, borderRadius: "7px", border: "none", color: "#fff", fontSize: "11px", lineHeight: 1, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" },
			dotBusy: { opacity: 0.4, cursor: "default" },
			pick: { position: "absolute", top: "4px", left: "4px", width: "16px", height: "16px", borderRadius: "50%", border: "1px solid rgba(255,255,255,.7)", background: "rgba(20,26,38,.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", lineHeight: 1, color: "#fff", fontWeight: 700 },
			pickOn: { background: "#4f8cff", borderColor: "#4f8cff" },
			flag: { position: "absolute", top: "6px", right: "6px", width: "8px", height: "8px", borderRadius: "50%", boxShadow: "0 0 0 1px rgba(0,0,0,.25)" },
			tileCaption: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 5px 3px", fontSize: "11px", lineHeight: "14px", color: "#fff", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,0))" },
			helpWrap: { position: "fixed", inset: 0, background: "rgba(8,12,20,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 9999, boxSizing: "border-box" },
			helpCard: { width: "min(660px, 92vw)", maxHeight: "80vh", overflow: "auto", background: "var(--dsw-alias-bg-layer-1, #12161f)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "14px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 18px 50px rgba(0,0,0,.45)" },
			helpBody: { fontSize: "13px", lineHeight: "21px", opacity: 0.86 },
			cardName: { flex: "1 1 auto", fontSize: "13px", lineHeight: "18px", minWidth: 0, overflowWrap: "anywhere" },
			cardPath: { display: "block", fontSize: "11px", opacity: 0.6, overflowWrap: "anywhere" },
			badge: { fontSize: "11px", padding: "2px 8px", borderRadius: "999px", background: "var(--dsw-alias-bg-layer-1)", opacity: 0.85, whiteSpace: "nowrap" },
			badgeReady: { fontSize: "11px", padding: "2px 8px", borderRadius: "999px", whiteSpace: "nowrap", color: "#0b6b4f", background: "rgba(46,204,150,.18)", border: "1px solid rgba(46,204,150,.45)" },
			badgeWarn: { fontSize: "11px", padding: "2px 8px", borderRadius: "999px", whiteSpace: "nowrap", color: "#8a5b00", background: "rgba(250,215,120,.2)", border: "1px solid rgba(250,215,120,.5)" },
			btn: { fontSize: "12px", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", cursor: "pointer", whiteSpace: "nowrap" },
			btnPrimary: { fontSize: "13px", padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", cursor: "pointer", fontWeight: 600 },
			btnBusy: { opacity: 0.5, cursor: "default" },
			btnSmall: { fontSize: "11px", padding: "4px 10px", borderRadius: "7px", border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", cursor: "pointer", whiteSpace: "nowrap" },
			group: { display: "flex", flexDirection: "column", gap: "6px" },
		};

		const message = error => (error && error.message ? error.message : String(error));

		function createScope(ctx) {
			const state = { value: {}, error: "" };
			const listeners = new Set();
			const emit = () => { for (const fn of Array.from(listeners)) { try { fn(); } catch (e) { /* 单个订阅者出错不影响其他 */ } } };
			const call = (name, args) => {
				const ui = ctx.tavernUi;
				if (!ui || typeof ui.callHost !== "function") throw new Error("当前 Tavern 没有 tavernUi.callHost（需要插件接口第 2 版）");
				return ui.callHost(PLUGIN + "/" + name, args);
			};
			const applyPayload = payload => {
				if (!payload || typeof payload !== "object") throw new Error("宿主半没有返回状态");
				state.value = Object.assign({}, payload, payload.options || {});
				state.error = "";
				emit();
			};
			return {
				ui: ctx.tavernUi,
				getSnapshot: () => ({ value: state.value, error: state.error }),
				subscribe(listener) {
					listeners.add(listener);
					void this.refresh();
					return () => { listeners.delete(listener); };
				},
				async refresh() {
					try { applyPayload(await call("status", {})); }
					catch (error) { state.error = message(error); emit(); }
				},
				async set(key, next) { applyPayload(await call("set-options", { patch: { [key]: next } })); },
				call,
				applyPayload,
				async probe(tag) {
					try { await call("set-options", { patch: {}, probe: tag }); } catch (error) { /* 探针失败无所谓 */ }
				},
			};
		}

		/** 绝不抛的取快照：壳里的 section 一旦抛错会被判为 crash 并整格退休。 */
		const safeSnapshot = scope => {
			try {
				if (scope && typeof scope.getSnapshot === "function") return scope.getSnapshot() || { value: {} };
			} catch (error) {
				return { value: {}, error: "读取状态失败：" + message(error) };
			}
			return { value: {} };
		};

		/** FileReader.readAsDataURL 取 base64（避免 btoa 在大文件上爆栈）。 */
		function sliceToBase64(blob) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onerror = () => reject(new Error("读取文件失败"));
				reader.onload = () => {
					const text = String(reader.result || "");
					const comma = text.indexOf(",");
					resolve(comma >= 0 ? text.slice(comma + 1) : "");
				};
				reader.readAsDataURL(blob);
			});
		}

		function base64ToBlob(base64, type) {
			const binary = atob(base64);
			const bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
			return new Blob([bytes], { type: type || "application/json" });
		}

		function Switch(props) {
			const { switchKey, label, detail, value, busy, onChange } = props;
			return h("label", {
				style: S.row,
				key: switchKey,
				onMouseEnter: event => { event.currentTarget.style.background = "var(--dsw-alias-bg-layer-1)"; },
				onMouseLeave: event => { event.currentTarget.style.background = "transparent"; },
			},
				h("input", {
					type: "checkbox", style: { marginTop: "2px" }, checked: value !== false, disabled: busy,
					onChange: event => onChange(event.target.checked),
				}),
				h("span", null,
					h("span", { style: S.label }, label),
					h("div", { style: S.sub }, detail),
				),
			);
		}

		const HELP_TEXT = [
			"导入：点第一行右侧的「导入（可多选）」选文件，导入即转换，只落地一张「原名 mvu版.json」；用 Tavern 原生按钮导入的卡插件不碰。全部成功后导入记录 6 秒自动收起，有失败会留着。",
			"封面：宫格封面取人物卡库那张原图（originals/cards/<同名>.png），没有原图时用这张卡图片目录里同步过的图，都没有才显示「无图」。",
			"图片目录：点「图」打开这张卡自己的图片目录，文件名 = 角色名（例：沈心怡.jpg）；带变体写 沈心怡-水衣.泳装.比基尼.jpg，点号分隔的同义词命中任一即用。放好图点「同」立即生效；图片不进卡，只写路径。",
			"方形按钮（自动铺满一行，全是图标）：图片框 = 打开这张卡的图片目录；循环箭头 = 重扫目录并生效；橡皮擦 = 只清卡里的头像引用；下载箭头 = 导出 .json；垃圾桶 = 删除这张 MVU 卡（不留底）。",
			"宫格：工具栏「列 × 行」各 2–6 可选，每页格数 = 列 × 行，选择记在本机。列 ≥ 6 自动高密度（只留封面与图 / 出 / 删，卡名叠在封面底部），列 ≤ 5 低密度（卡名在图片下方 + 全部按钮）。点格子即选中。",
			"批量：勾选后，「移到分组…」把所选卡移到某个分组（还能新建分组，写的是人物卡库同一份整理文件）；「更新」重扫图片目录、产物已是最新修订就只换引用；「删除所选」批量删除（不留底）；「完成」清空选择。",
			"开局：到左侧「选择人物卡 · 开始游玩」里点那张卡。",
		].join("\n");

		function HelpPanel(props) {
			const close = props && typeof props.close === "function" ? props.close : () => {};
			return h("div", { style: S.helpWrap },
				h("div", { style: S.helpCard },
					h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
						h("h2", { style: S.heading }, "MVU 面板 · 使用说明"),
						h("span", { style: { flex: "1" } }),
						h("button", { type: "button", style: S.btnSmall, onClick: () => close() }, "关闭")),
					h("div", { style: S.helpBody }, HELP_TEXT.split("\n").map((line, index) => h("p", { key: index, style: { margin: "0 0 8px" } }, line))),
					h("div", { style: { display: "flex", justifyContent: "flex-end" } },
						h("button", { type: "button", style: S.btnPrimary, onClick: () => close() }, "知道了")),
				),
			);
		}

		function MvuPanelSection(props) {
			const scope = props && props.scope ? props.scope : activeScope;
			const [snapshot, setSnapshot] = React.useState(() => safeSnapshot(scope));
			const [busy, setBusy] = React.useState("");
			const [note, setNote] = React.useState("");
			const [failed, setFailed] = React.useState(false);
			const [results, setResults] = React.useState([]);
			const [progress, setProgress] = React.useState("");
			const [selected, setSelected] = React.useState([]);
			const [page, setPage] = React.useState(0);
			const [orgQuery, setOrgQuery] = React.useState("");
			const [orgFilter, setOrgFilter] = React.useState("*");
			const [grid, setGrid] = React.useState(() => readGridPref());
			const setGridSize = patch => setGrid(current => {
				const next = Object.assign({}, current, patch);
				saveGridPref(next);
				return next;
			});
			const inputRef = React.useRef(null);
			const hideTimer = React.useRef(null);

			React.useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

			React.useEffect(() => {
				if (!scope || typeof scope.subscribe !== "function") return undefined;
				try {
					return scope.subscribe(() => { try { setSnapshot(safeSnapshot(scope)); } catch (error) { /* 忽略 */ } });
				} catch (error) {
					setFailed(true);
					setNote("订阅宿主半状态失败：" + message(error));
					return undefined;
				}
			}, [scope]);

			try {
				const value = snapshot && snapshot.value ? snapshot.value : {};
				const managed = (Array.isArray(value.managed) ? value.managed : []).filter(row => !row.missing);
				const legacy = Array.isArray(value.legacy) ? value.legacy : [];
				const events = Array.isArray(value.events) ? value.events : [];
				const profile = value.ruleProfile === "lite" ? "lite" : "full";

				const groups = Array.isArray(value.groups) ? value.groups : [];
				const needle = String(orgQuery || "").trim().toLocaleLowerCase();
				const visibleRows = managed.filter(row => {
					if (needle && !(((row.name || "") + " " + (row.file || "") + " " + (row.path || "")).toLocaleLowerCase().includes(needle))) return false;
					if (!orgFilter || orgFilter === "*") return true;
					if (orgFilter === "favorites") return row.starred === true;
					if (orgFilter === "group:") return !row.group;
					return row.group === orgFilter.slice(6);
				});
				// 列 × 行 = 每页格数；列多了格子窄，自动走高密度（只封面 + 图 / 出 / 删），宽了用低密度（卡名 + 全部按钮）
				const cols = grid.cols;
				const rows = grid.rows;
				const dense = cols >= 6;
				const pageSize = cols * rows;
				const showBars = managed.length > 0 || selected.length > 0;
				const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize));
				const safePage = Math.min(page, pageCount - 1);
				const pageRows = visibleRows.slice(safePage * pageSize, safePage * pageSize + pageSize);
				const allPageSelected = pageRows.length > 0 && pageRows.every(row => selected.includes(row.key));

				const run = async (key, work) => {
					setBusy(key);
					setNote("");
					try {
						await work();
						setFailed(false);
					} catch (error) {
						setFailed(true);
						setNote(message(error));
					} finally {
						setBusy("");
					}
				};

				async function uploadOne(file) {
					const id = "u" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
					try {
						const begun = await scope.call("import-begin", { id, fileName: file.name, size: file.size });
						const chunkBytes = (begun && begun.chunkBytes) || 72 * 1024;
						const total = Math.max(1, Math.ceil(file.size / chunkBytes));
						for (let index = 0; index < total; index += 1) {
							const blob = file.slice(index * chunkBytes, Math.min(file.size, (index + 1) * chunkBytes));
							const data = await sliceToBase64(blob);
							await scope.call("import-chunk", { id, index, data });
							setProgress(file.name + "：" + Math.round(((index + 1) / total) * 100) + "%");
						}
						const done = await scope.call("import-end", { id });
						if (done && done.status) scope.applyPayload(done.status);
						return {
							file: file.name,
							ok: Boolean(done && done.ok !== false),
							message: done && done.ok !== false
								? "已生成 " + done.file + "（" + Math.round((done.bytes || 0) / 1024) + " KB）"
								: String((done && done.error) || "导入失败"),
						};
					} catch (error) {
						try { await scope.call("import-cancel", { id }); } catch (ignored) { /* 忽略 */ }
						return { file: file.name, ok: false, message: message(error) };
					}
				}

				async function importFiles(fileList) {
					let files = Array.from(fileList || []);
					if (!files.length) { setNote("没有选中文件"); return; }
					setResults([]);
					setNote("开始导入 " + files.length + " 个文件…");
					let failed = 0;
					for (const file of files) {
						if (file.size > MAX_UPLOAD) {
							setResults(previous => previous.concat([{ file: file.name, ok: false, message: "超过 16 MB 上限" }]));
							failed += 1;
							continue;
						}
						const one = await uploadOne(file);
						if (one.ok !== true) failed += 1;
						setResults(previous => previous.concat([one]));
						setProgress("");
					}
					setNote("导入完成：" + files.length + " 个文件" + (failed ? "（" + failed + " 个未导入）" : ""));
					if (hideTimer.current) clearTimeout(hideTimer.current);
					// 全部成功 → 6 秒后自动收起记录；有失败就一直留着，免得错误一闪而过
					if (!failed) hideTimer.current = setTimeout(() => { setResults([]); setProgress(""); setNote(""); }, 6000);
				}

				async function openAvatarDir(row) {
					await run("avdir:" + row.key, async () => {
						const done = await scope.call("avatar-dir", { key: row.key });
						if (done && done.status) scope.applyPayload(done.status);
						if (done && done.ok === false) throw new Error(done.error || "打开图片目录失败");
						setNote("图片目录：" + done.dir + (done.opened ? "（已在资源管理器打开）" : "") + "　已有 " + (done.files || 0) + " 张");
					});
				}

				async function syncAvatars(row) {
					await run("avsync:" + row.key, async () => {
						const done = await scope.call("avatar-sync", { key: row.key });
						if (done && done.status) scope.applyPayload(done.status);
						if (done && done.ok === false) throw new Error(done.error || "同步失败");
						const names = Array.isArray(done && done.names) ? done.names : [];
						const skipped = Array.isArray(done && done.skipped) ? done.skipped : [];
						setNote("已同步 " + names.length + " 个角色（" + names.join("、") + "）" + (skipped.length ? "；跳过：" + skipped.join("；") : ""));
					});
				}

				async function clearAvatars(row) {
					await run("avclear:" + row.key, async () => {
						const done = await scope.call("avatar-clear", { key: row.key });
						if (done && done.status) scope.applyPayload(done.status);
						if (done && done.ok === false) throw new Error(done.error || "清空失败");
						setNote("已清空这张卡的头像引用（图片文件夹没动：" + (done.dir || "") + "）");
					});
				}

				async function exportRow(row) {
					await run("export:" + row.key, async () => {
						const done = await scope.call("export", { key: row.key });
						if (done && done.ok === false) throw new Error(done.error || "导出失败");
						if (done && done.base64) {
							const url = URL.createObjectURL(base64ToBlob(done.base64));
							const link = document.createElement("a");
							link.href = url;
							link.download = done.file || (row.key + ".json");
							document.body.appendChild(link);
							link.click();
							link.remove();
							setTimeout(() => URL.revokeObjectURL(url), 5000);
							setNote("已导出：" + (done.file || row.key) + "（" + Math.round((done.bytes || 0) / 1024) + " KB）");
							return;
						}
						setNote(done && done.path ? "卡片较大，已导出到：" + done.path : "已导出：" + (done && done.file ? done.file : row.key));
					});
				}

				async function removeRow(row) {
					await run("remove:" + row.key, async () => {
						const done = await scope.call("remove", { key: row.key });
						if (done && done.status) scope.applyPayload(done.status);
						if (done && done.ok === false) throw new Error(done.error || "删除失败");
						setSelected(current => current.filter(key => key !== row.key));
						setNote("已删除（未留底）：" + row.file);
					});
				}

				function toggleSelect(key) {
					setSelected(current => (current.includes(key) ? current.filter(item => item !== key) : current.concat([key])));
				}

				function togglePage() {
					const pageKeys = pageRows.map(row => row.key);
					if (allPageSelected) setSelected(current => current.filter(key => !pageKeys.includes(key)));
					else setSelected(current => Array.from(new Set(current.concat(pageKeys))));
				}

				async function removeSelected() {
					const keys = selected.slice();
					if (!keys.length) return;
					try {
						if (typeof window !== "undefined" && typeof window.confirm === "function"
							&& !window.confirm("删除所选 " + keys.length + " 张 MVU 卡？\n\n不保留留底；导入时的原始卡仍在插件 backups/imported/ 里。")) return;
					} catch (error) { /* 没有 confirm 就直接删 */ }
					await run("batch", async () => {
						let ok = 0;
						const failedKeys = [];
						for (const key of keys) {
							const done = await scope.call("remove", { key });
							if (done && done.status) scope.applyPayload(done.status);
							if (done && done.ok === false) failedKeys.push(key + "：" + (done.error || "失败"));
							else ok += 1;
						}
						setSelected([]);
						setNote("已删除 " + ok + " 张" + (failedKeys.length ? "；失败 " + failedKeys.join("；") : "（未留底）"));
					});
				}

				/** 批量：把所选卡移到分组（写 Tavern 的 card-organization.json，与人物卡库同一份） */
				async function moveSelectedToGroup(value) {
					const keys = selected.slice();
					if (!keys.length) return;
					const rows = managed.filter(row => keys.includes(row.key));
					const paths = rows.map(row => row.path).filter(Boolean);
					if (!paths.length) { setNote("没有可移动的卡"); return; }
					let group = "";
					let createGroup = false;
					if (value === "\u0000new") {
						let name = "";
						try { name = window.prompt("新建分组名称（1–80 字）", "") || ""; } catch (error) { name = ""; }
						name = String(name).trim();
						if (!name) { setNote("没有新建分组"); return; }
						group = name;
						createGroup = true;
					} else if (value !== "\u0000none") {
						group = String(value);
					}
					await run("group", async () => {
						const done = await scope.call("organize-move", { paths, group, createGroup });
						if (done && done.status) scope.applyPayload(done.status);
						if (done && done.ok === false) throw new Error(done.error || "移动分组失败");
						setNote("已移动 " + paths.length + " 张到「" + (group || "未分组") + "」" + (createGroup ? "（新建分组）" : ""));
					});
				}

				/** 批量：更新所选卡 —— 重扫图片目录；产物已是最新修订就只换引用 */
				async function updateSelected() {
					const keys = selected.slice();
					if (!keys.length) return;
					const rows = managed.filter(row => keys.includes(row.key));
					await run("update-selected", async () => {
						let ok = 0;
						let rewrote = 0;
						const failed = [];
						for (const row of rows) {
							let result = null;
							try {
								result = await scope.call("avatar-sync", { key: row.key });
								if (result && result.status) scope.applyPayload(result.status);
							} catch (error) {
								failed.push(row.file + "：" + message(error));
								continue;
							}
							if (result && result.ok === false) failed.push(row.file + "：" + (result.error || "更新失败"));
							else { ok += 1; if (result && result.rewrote) rewrote += 1; }
						}
						setNote("已更新 " + ok + " 张（重写产物 " + rewrote + " 张）" + (failed.length ? "；失败 " + failed.join("；") : ""));
					});
				}

				/** 圆按钮：只写一个字，一个动作一个颜色；忙碌时变「…」并禁用 */
				const dotButton = (id, char, color, title, handler, busyId) => {
					const working = busy === busyId;
					return h("button", {
						type: "button", key: id,
						style: Object.assign({}, S.dot, { background: color }, working ? S.dotBusy : {}),
						disabled: working,
						title, "aria-label": title,
						onClick: event => { event.stopPropagation(); void handler(); },
					}, working ? "…" : char);
				};

				/** 一格：封面 + 状态点 + 勾选角标 + 按钮栏（高密度只留图 / 出 / 删） */
				const cardTile = row => {
					const picked = selected.includes(row.key);
					const ready = Boolean(row.intact) && !row.stale;
					// 封面：优先用人物卡库那张（Tavern 的 card-image 路由，读 originals/cards/<同名>.png），
					// 原图缺失时退到插件头像目录里同步过的图
					const cardCover = row.path ? "/api/dsh-tavern/card-image?path=" + encodeURIComponent(row.path) : "";
					const pictures = [cardCover, row.cover || ""].filter(Boolean);
					const head = (row.name || "未命名") + "　修订 " + (row.revision || "旧") + "\n" + row.path;
					const avatarNote = Array.isArray(row.avatars) && row.avatars.length
						? "\n已引用头像：" + row.avatars.join("、")
						: "\n还没有头像图：点「图」打开目录放图，再点「同」";
					return h("div", {
						key: row.key,
						style: Object.assign({}, S.tile, picked ? S.tileOn : {}),
						role: "button", tabIndex: 0, title: head + avatarNote,
						onClick: () => toggleSelect(row.key),
						onKeyDown: event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSelect(row.key); } },
					},
						h("div", { style: S.tilePic },
							h("span", { style: S.tileEmpty }, "无图"),
							pictures.length
								? h("img", {
									src: pictures[0], alt: "", loading: "lazy", draggable: false, style: S.tileImg,
									"data-step": "0",
									onError: event => {
										const img = event.currentTarget;
										const step = Number(img.getAttribute("data-step") || "0") + 1;
										if (pictures[step]) {
											img.setAttribute("data-step", String(step));
											img.src = pictures[step];
											return;
										}
										img.style.visibility = "hidden";
									},
								})
								: null,
							h("span", { style: Object.assign({}, S.pick, picked ? S.pickOn : {}) }, picked ? "✓" : ""),
							h("span", {
								style: Object.assign({}, S.flag, { background: ready ? "#2ecc98" : "#e8b13a" }),
								title: ready ? "产物就绪" : (row.stale ? "修订落后，待刷新" : "产物不完整"),
							}),
							h("span", { style: S.tileCaption }, row.name || row.file),
						),
						h("div", { style: S.tileBar },
							dotButton("pic", IconPicture(), DOT.pic, "打开这张卡的图片目录（文件名 = 角色名；变体用 名字-水衣.泳装.比基尼.jpg，点号分隔同义词）", () => openAvatarDir(row), "avdir:" + row.key),
							dense ? null : dotButton("sync", IconSync(), DOT.sync, "重扫这张卡的图片目录：新增 / 覆盖 / 改名 / 删除都会反映到面板（图片不进卡，只写路径）", () => syncAvatars(row), "avsync:" + row.key),
							dense ? null : dotButton("clear", IconClear(), DOT.clear, "只清掉卡里的头像引用，不动你的图片文件夹", () => clearAvatars(row), "avclear:" + row.key),
							dotButton("export", DownloadIcon(), DOT.export, "导出这张 MVU 卡（.json，可直接在 Tavern 里再导入）", () => exportRow(row), "export:" + row.key),
							dotButton("remove", IconTrash(), DOT.remove, "删除这张 MVU 卡（不留底）", () => removeRow(row), "remove:" + row.key),
						),
					);
				};

				/** 说明弹窗：优先用 Tavern 的整页浮层，老版本退回原生 alert */
				const openHelp = () => {
					const ui = scope && scope.ui ? scope.ui : null;
					try {
						if (ui && typeof ui.openOverlay === "function") {
							ui.openOverlay({ render: ({ close }) => h(HelpPanel, { close }) });
							return;
						}
					} catch (error) { /* 退回下面的原生提示 */ }
					try { window.alert(HELP_TEXT); } catch (error) { /* 忽略 */ }
				};

				const children = [
					h("div", { key: "head", style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
						h("h2", { style: Object.assign({}, S.heading, { flex: "1 1 auto" }) }, "MVU 面板 · " + CLIENT_TAG + " · 模型 " + (value.revision || "—")),
						h("button", { type: "button", style: S.btnSmall, title: "导入 / 封面 / 圆按钮 / 宫格行列的说明", onClick: () => openHelp() }, "说明")),
					

					h("div", { style: S.group, key: "import" },
						/* 第一行（固定）：搜索 / 分组 / 统计 / 宫格控制 / 导入 */
						showBars ? h("div", { key: "barTop", style: S.bar },
							h("input", {
								type: "search", value: orgQuery, placeholder: "搜索卡名 / 文件名", "aria-label": "搜索 MVU 卡",
								style: { flex: "0 1 150px", minWidth: "110px", padding: "3px 7px", borderRadius: "7px", border: "1px solid rgba(128,160,255,.35)", background: "#1b2434", color: "#e8eefc", fontSize: "12px", colorScheme: "dark" },
								onChange: event => { setOrgQuery(event.target.value); setPage(0); },
							}),
							h("select", {
								value: orgFilter, "aria-label": "按分组筛选",
								style: { flex: "0 1 132px", padding: "3px 6px", borderRadius: "7px", border: "1px solid rgba(128,160,255,.35)", background: "#1b2434", color: "#e8eefc", fontSize: "12px", colorScheme: "dark" },
								onChange: event => { setOrgFilter(event.target.value); setPage(0); },
							}, [h("option", { key: "*", value: "*" }, "全部分组"), h("option", { key: "fav", value: "favorites" }, "收藏"), h("option", { key: "ungrouped", value: "group:" }, "未分组")].concat(groups.map(groupName => h("option", { key: groupName, value: "group:" + groupName }, groupName)))),
							h("span", { style: S.sub }, (visibleRows.length === managed.length ? "共 " + managed.length + " 张" : "筛出 " + visibleRows.length + " / " + managed.length + " 张")),
							h("label", { style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", opacity: 0.85 }, title: "每页格数 = 列 × 行；列 ≥ 6 自动用高密度（只留封面与图 / 出 / 删），列 ≤ 5 用低密度（卡名 + 全部按钮）" },
								"列",
								h("select", {
									value: cols, "aria-label": "每行列数", style: S.mini,
									onChange: event => { setGridSize({ cols: Number(event.target.value) }); setPage(0); },
								}, GRID_COLS.map(item => h("option", { key: item, value: item }, item))),
								"行",
								h("select", {
									value: rows, "aria-label": "每页行数", style: S.mini,
									onChange: event => { setGridSize({ rows: Number(event.target.value) }); setPage(0); },
								}, GRID_ROWS.map(item => h("option", { key: item, value: item }, item))),
								h("span", { style: S.sub }, (dense ? "高密度" : "低密度") + " · " + pageSize + " 格/页")),
						) : null,

						h("div", { key: "barBottom", style: S.bar },
							h("label", { style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", opacity: 0.85 } },
								h("input", { type: "checkbox", checked: allPageSelected, disabled: !pageRows.length, onChange: togglePage }),
								"全选本页"),
							h("select", {
								value: "", "aria-label": "把所选卡移到分组",
								title: "把所选卡移到分组（写 Tavern 的 card-organization.json，与人物卡库同一份）",
								disabled: !selected.length || busy === "group",
								style: Object.assign({}, S.mini, { maxWidth: "124px" }, !selected.length || busy === "group" ? S.btnBusy : {}),
								onChange: event => {
									const picked = event.target.value;
									event.target.value = "";
									if (picked) void moveSelectedToGroup(picked);
								},
							}, [
								h("option", { key: "placeholder", value: "" }, busy === "group" ? "移动中…" : "移到分组…"),
								h("option", { key: "none", value: "\u0000none" }, "未分组"),
							].concat(
								groups.map(name => h("option", { key: name, value: name }, name)),
								[h("option", { key: "new", value: "\u0000new" }, "新建分组…")],
							)),
							h("button", {
								type: "button", title: "重扫所选卡的图片目录；产物已是最新修订就只换引用，不重写整卡",
								style: Object.assign({}, S.btnSmall, selected.length && busy !== "update-selected" ? {} : S.btnBusy),
								disabled: !selected.length || busy === "update-selected",
								onClick: () => void updateSelected(),
							}, busy === "update-selected" ? "更新中…" : "更新"),
							h("button", {
								type: "button", style: Object.assign({}, S.btnSmall, selected.length && busy !== "batch" ? {} : S.btnBusy),
								disabled: !selected.length || busy === "batch",
								onClick: () => void removeSelected(),
							}, busy === "batch" ? "删除中…" : "删除所选" + (selected.length ? "（" + selected.length + "）" : "")),
							selected.length ? h("button", {
								type: "button", style: S.btnSmall, title: "清空选择，退出批量操作",
								onClick: () => setSelected([]),
							}, "完成") : null,
							h("span", { style: { flex: "1" } }),
							h("input", {
								key: "file", ref: inputRef, type: "file", accept: ".png,.json", multiple: true,
								style: { display: "none" },
								onChange: event => {
									// 先把 File 对象拷出来再清空 input：留 FileList 引用会被 value='' 一起清掉
									const picked = Array.prototype.slice.call(event.target.files || []);
									event.target.value = "";
									if (!picked.length) { setNote("没有选中文件"); return; }
									void run("import", () => importFiles(picked));
								},
							}),
							h("button", {
								type: "button", key: "pick",
								style: Object.assign({}, S.btnPrimary, busy === "import" ? S.btnBusy : {}),
								disabled: busy === "import" || value.enabled === false,
								onClick: () => { if (inputRef.current) inputRef.current.click(); },
							}, busy === "import" ? "导入中…" : "导入（可多选）"),
							value.enabled === false ? h("span", { style: S.sub }, "插件已在设置里关闭") : null,
							progress ? h("span", { style: S.sub }, progress) : null,
							h("button", { type: "button", style: Object.assign({}, S.btnSmall, safePage > 0 ? {} : S.btnBusy), disabled: safePage <= 0, onClick: () => setPage(Math.max(0, safePage - 1)) }, "上一页"),
							h("span", { style: S.sub }, (safePage + 1) + " / " + pageCount),
							h("button", { type: "button", style: Object.assign({}, S.btnSmall, safePage < pageCount - 1 ? {} : S.btnBusy), disabled: safePage >= pageCount - 1, onClick: () => setPage(Math.min(pageCount - 1, safePage + 1)) }, "下一页"),
						),

						h("div", {
							style: Object.assign({}, S.grid, { gridTemplateColumns: "repeat(" + cols + ", minmax(0, 1fr))" }, dense ? S.gridDense : {}),
							key: "cards",
						}, pageRows.length === 0
							? h("div", { style: S.row }, h("span", { style: S.cardName }, (managed.length ? "没有匹配的卡：清掉搜索词或分组筛选试试" : "还没有 MVU 卡：点上面的按钮导入一张 —— 导入即转换，只留「原名 mvu版.json」这一张")))
							: pageRows.map(row => cardTile(row))),

						results.length ? h("div", { key: "results", style: S.group },
							h("div", { style: S.label }, "导入记录（" + results.length + "）"),
							h("div", { style: S.list }, results.map((item, index) => h("div", { style: S.row, key: index },
								h("span", { style: item.ok ? S.badgeReady : S.badgeWarn }, item.ok ? "已转换" : "未导入"),
								h("span", { style: S.cardName }, h("b", null, item.file), h("span", { style: S.cardPath }, item.message)),
							))),
						) : null,
					),

					h("div", { style: S.list, key: "list" }, SWITCHES.map(([switchKey, label, detail]) => Switch({
						switchKey, label, detail,
						value: value[switchKey],
						busy: busy === switchKey,
						onChange: next => void run(switchKey, () => scope.set(switchKey, next)),
					}))),

					h("div", { key: "profile" },
						h("div", { style: S.label }, "后台结算规则档位"),
						h("div", { style: S.sub }, "只喂后台结算模型，不占前台 token。精简档保留全部契约、删掉解释与举例。"),
						h("div", { style: S.segment },
							[["full", "完整档"], ["lite", "精简档"]].map(([key, label]) =>
								h("button", {
									key, type: "button",
									style: Object.assign({}, S.seg, profile === key ? S.segActive : {}),
									disabled: busy === "ruleProfile",
									onClick: () => void run("ruleProfile", () => scope.set("ruleProfile", key)),
								}, label)),
						),
					),

					legacy.length ? h("div", { key: "legacy" },
						h("div", { style: S.label }, "遗留产物（老插件 / 早先转换的卡，" + legacy.length + "）"),
						h("div", { style: S.list }, legacy.map(item => h("div", { style: S.cardRow, key: item.file },
							h("span", { style: S.badge }, item.revision || "未知修订"),
							h("span", { style: S.cardName }, h("b", null, item.name), h("span", { style: S.cardPath }, item.file)),
							h("button", {
								type: "button", style: S.btnSmall,
								onClick: () => void run("refresh-file:" + item.file, async () => {
									const done = await scope.call("refresh-file", { file: item.file });
									if (done && done.status) scope.applyPayload(done.status);
									if (done && done.ok === false) throw new Error(done.error || "刷新失败");
									setNote("已刷新并纳入管理：" + item.file);
								}),
							}, "纳入管理"),
						))),
					) : null,

					h("div", { key: "events" },
						h("div", { style: S.label }, "最近日志（诊断用）"),
						h("pre", { style: S.report }, events.length
							? events.slice(-30).map(item => item.at + "  " + item.level + "  " + item.event + "  " + JSON.stringify(Object.assign({}, item, { at: undefined, level: undefined, event: undefined }))).join("\n")
							: "（还没有日志）"),
					),

					h("div", { key: "actions", style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
						h("button", {
							type: "button",
							style: Object.assign({}, S.btn, busy === "refresh" ? S.btnBusy : {}),
							disabled: busy === "refresh",
							onClick: () => void run("refresh", async () => { await scope.refresh(); setNote("已重新读取状态"); }),
						}, "重新读取状态"),
						h("button", {
							type: "button",
							style: S.btn,
							onClick: () => void run("log", async () => {
								const tail = await scope.call("log-tail", { limit: 200 });
								const lines = Array.isArray(tail && tail.lines) ? tail.lines : [];
								try { await navigator.clipboard.writeText(lines.join("\n")); setNote("已复制日志 " + lines.length + " 行"); }
								catch (error) { setNote("日志 " + lines.length + " 行（剪贴板不可用：" + message(error) + "）"); }
							}),
						}, "复制日志"),
					),

					h("div", { key: "where" },
						h("div", { style: S.label }, "文件位置"),
						h("div", { style: S.sub }, String(value.cardsDir || "") + "　·　台账 " + String(value.ledgerCount || 0) + " 张　·　日志与留底在插件目录 logs/ 与 backups/"),
					),
				];
				if (snapshot && snapshot.error) children.push(h("div", { style: S.error, key: "scopeError" }, snapshot.error));
				if (note !== "") children.push(h("div", { style: failed ? S.error : S.note, key: "note" }, note));
				return h("div", { style: S.section }, children);
			} catch (error) {
				try { if (scope && typeof scope.probe === "function") void scope.probe("render-error: " + message(error)); } catch (e) { /* 忽略 */ }
				return h("div", { style: S.section },
					h("h2", { style: S.heading, key: "heading" }, "MVU 面板 · " + CLIENT_TAG),
					h("p", { style: S.error, key: "crash" }, "面板渲染出错：" + message(error)),
				);
			}
		}

		let activeScope = null;

		function apply(ctx) {
			const ui = ctx.tavernUi;
			if (!ui) return;
			// 用到第 2 版接口（callHost / registerPanel）前先看版本号，老版本直接不注册
			if (Number(ui.apiVersion) < 2) return;
			const scope = createScope(ctx);
			activeScope = scope;

			// 侧栏面板（Tavern 自己的 registerPanel）
			try {
				ui.registerPanel({
					id: "mvu-panel",
					title: "MVU 面板",
					render: ({ gameId }) => h(MvuPanelSection, { scope, key: gameId || "none" }),
				});
			} catch (error) { /* 面板注册失败不影响游戏 */ }

			// DSH 设置区一节：照 dsh-ops-control 的可用写法（插件级 inject 已声明 'slots'）
			try {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "mvu-panel",
					order: 18,
					label: () => "MVU 面板",
					inject: () => ({ scope }),
				}, () => h(MvuPanelSection, { scope })));
			} catch (error) { try { void scope.probe("register-error: " + message(error)); } catch (e) { /* 忽略 */ } }
		}

		return { name: PLUGIN, inject: ["tavernUi", "slots"], apply };
	},
});
