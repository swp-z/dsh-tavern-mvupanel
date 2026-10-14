/**
 * dsh-tavern-mvupanel —— Tavern「MVU 面板」插件 · 浏览器半（客户端 v5 / 模型 R32）
 *
 * 按《插件开发：接口参考》第 2 版写：Tavern 用 window.__ModuleLoader__.load 加载，
 * id 与 package.json 的 name 一致；inject ['tavernUi','slots']；React 用 require('react') 取；
 * 数据与操作全部走 tavernUi.callHost()（宿主半用 ctx.tavern.handle 注册）。
 *
 * v5：列表只留「导出 / 删除」两个行内按钮（去掉 ⋯ 展开、复制卡名、行内刷新、清理源卡）；
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
		const CLIENT_TAG = "客户端 v5";
		const PAGE_SIZE = 15;
		const MAX_UPLOAD = 16 * 1024 * 1024;

		const SWITCHES = [
			["enabled", "启用插件页导入", "开 = 可以在这里导入角色卡并生成 MVU 卡；关 = 只读展示，不导入、不刷新"],
			["watchManaged", "只监视自己管理的卡", "开 = 自己管的 MVU 卡被外部改掉产物时自动补回；关 = 完全不自动重写"],
			["overwriteManaged", "覆盖已存在的 MVU 卡", "开 = 导入同名卡时直接覆盖已有「X mvu版.json」；关 = 拒绝覆盖并提示（更安全）"],
			["hideInitvar", "隐藏开场初值（省 token）", "用 promptOnly 正则把 <initvar> 挡在模型上下文之外，初始化仍照常发生"],
			["selfread", "前台兜底自读指令", "面板注入失效时的后备通道；常驻前台，每轮多约 545 字符，默认关"],
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

				const pageCount = Math.max(1, Math.ceil(managed.length / PAGE_SIZE));
				const safePage = Math.min(page, pageCount - 1);
				const pageRows = managed.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
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
					const files = Array.from(fileList || []);
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

				const children = [
					h("h2", { style: S.heading, key: "heading" }, "MVU 面板 · " + CLIENT_TAG + " · 模型 " + (value.revision || "—")),
					h("p", { style: S.intro, key: "intro" }, "在这里导入角色卡（可多选 PNG / JSON）：导入即转换，落地成一张「原名 mvu版.json」的卡；原生按钮导入的卡插件不碰。开局请到左侧「选择人物卡 · 开始游玩」里点那张卡。"),

					h("div", { style: S.group, key: "import" },
						h("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
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
							}, busy === "import" ? "导入中…" : (results.length ? "继续导入" : "导入角色卡（可多选 PNG / JSON）")),
							value.enabled === false ? h("span", { style: S.sub }, "插件已在设置里关闭") : null,
						),
						progress ? h("div", { style: S.sub }, progress) : null,
						results.length ? h("div", { style: S.list, key: "results" }, results.map((item, index) => h("div", { style: S.row, key: index },
							h("span", { style: item.ok ? S.badgeReady : S.badgeWarn }, item.ok ? "已转换" : "未导入"),
							h("span", { style: S.cardName }, h("b", null, item.file), h("span", { style: S.cardPath }, item.message)),
						))) : null,

						managed.length || selected.length ? h("div", {
							key: "cardbar",
							style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "2px 0" },
						},
							h("label", { style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", opacity: 0.85 } },
								h("input", { type: "checkbox", checked: allPageSelected, disabled: !pageRows.length, onChange: togglePage }),
								"全选本页"),
							h("span", { style: S.sub }, "共 " + managed.length + " 张"),
							h("span", { style: { flex: "1" } }),
							h("button", {
								type: "button", style: Object.assign({}, S.btnSmall, selected.length && busy !== "batch" ? {} : S.btnBusy),
								disabled: !selected.length || busy === "batch",
								onClick: () => void removeSelected(),
							}, busy === "batch" ? "删除中…" : "删除所选" + (selected.length ? "（" + selected.length + "）" : "")),
							h("button", { type: "button", style: Object.assign({}, S.btnSmall, safePage > 0 ? {} : S.btnBusy), disabled: safePage <= 0, onClick: () => setPage(Math.max(0, safePage - 1)) }, "上一页"),
							h("span", { style: S.sub }, (safePage + 1) + " / " + pageCount),
							h("button", { type: "button", style: Object.assign({}, S.btnSmall, safePage < pageCount - 1 ? {} : S.btnBusy), disabled: safePage >= pageCount - 1, onClick: () => setPage(Math.min(pageCount - 1, safePage + 1)) }, "下一页"),
						) : null,

						h("div", { style: S.list, key: "cards" }, pageRows.length === 0
							? h("div", { style: S.row }, h("span", { style: S.cardName }, "还没有 MVU 卡：点上面的按钮导入一张 —— 导入即转换，只留「原名 mvu版.json」这一张"))
							: pageRows.map(row => h("div", { style: S.cardRow, key: row.key },
								h("input", {
									type: "checkbox", style: { marginTop: "1px" },
									checked: selected.includes(row.key),
									onChange: () => toggleSelect(row.key),
								}),
								h("span", { style: row.stale || !row.intact ? S.badge : S.badgeReady }, row.stale ? "待刷新" : (row.intact ? "✓ 就绪" : "产物不完整")),
								h("span", { style: S.cardName, title: (row.name || "未命名") + "　修订 " + (row.revision || "旧") + "　" + row.path },
									h("b", null, row.file)),
								h("button", {
									type: "button", style: Object.assign({}, S.btnSmall, busy === "export:" + row.key ? S.btnBusy : {}),
									disabled: busy === "export:" + row.key,
									title: "导出这张 MVU 卡（.json，可直接在 Tavern 里再导入）",
									onClick: () => void exportRow(row),
								}, busy === "export:" + row.key ? "导出中…" : "导出"),
								h("button", {
									type: "button", style: Object.assign({}, S.btnSmall, busy === "remove:" + row.key ? S.btnBusy : {}),
									disabled: busy === "remove:" + row.key,
									title: "删除这张 MVU 卡（不留底）",
									onClick: () => void removeRow(row),
								}, busy === "remove:" + row.key ? "删除中…" : "删除"),
							))),
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
