# 权限与运行边界

这个插件会读写人物卡文件，所以把每一条能力写清楚：它做什么、什么时候发生、失败会怎样。

## 依赖

**运行时零依赖，零构建步骤。** 宿主半只 import Node 内置模块：`node:fs`、`node:path`、`node:zlib`（PNG 里
`zTXt` 卡片数据解压）、`node:crypto`（摘要）。没有 `dependencies`，没有 `peerDependencies`，没有原生模块，
没有打包产物——`index.mjs` 就是可以直接读的源码。

两半各按需取 DSH / Tavern 的服务：

| 半 | 服务 | 用途 |
| --- | --- | --- |
| 宿主 | `ctx.inject(['tavern'])` → `ctx.tavern.handle` | 给浏览器半提供命令（状态、导入分块、导出、删除…）；Tavern 缺了或不支持接口第 2 版时自动退化为「只有文件层面的转换仍可用」 |
| 宿主 | `ctx.effect` / `ctx.logger` | 释放定时器、写宿主日志 |
| 浏览器 | `ctx.tavernUi`（`callHost` / `registerPanel`） | 插件页与侧栏面板 |
| 浏览器 | `ctx.slots` | 往 DSH 设置区注册一节（`settings.section`） |

浏览器半在 `apply` 开头检查 `tavernUi.apiVersion`，低于 2 直接不注册。

## 文件访问

**读：**

| 位置 | 用途 | 时机 |
| --- | --- | --- |
| `<tavern data>/resources/cards/*.json` | 找到自己台账里那张卡，检查产物是否完整 | 打开/刷新状态、定时巡检（默认 5 秒）、导入、导出、删除 |
| `<tavern data>/originals/cards/<卡名>.png`（或 `.json`） | 只读判定缩略图是否存在（不读字节） | 打开面板时 |

**写：**

| 位置 | 用途 | 时机 |
| --- | --- | --- |
| `<tavern data>/resources/cards/<原名> mvu版.json` | 导入时生成；巡检发现产物丢失时补回 | **只在你点「导入」或产物确实缺失时**；写入用临时文件 + 改名，避免读到半个 JSON |
| `<tavern data>/originals/cards/<原名> mvu版.png`（或 `.json`） | 放原版文件，卡片缩略图与 Tavern 的「恢复原版」都靠它 | 导入时 |
| 插件目录 `options.json` / `managed.json` | 设置与台账 | 改设置、导入/删除时 |
| 插件目录 `logs/` | 排查日志（按天、单日 2 MB、保留 7 天） | 每次动作 |
| 插件目录 `backups/imported/` | 导入时的原始文件（你上传的那一份） | 仅导入时 |
| 插件目录 `exports/` | 只有卡片大到超过单次返回上限（约 3.5 MB）时，才把导出结果写到这里 | 仅在你点「导出」时 |
| 插件目录 `.staging/` | 转换用的临时文件，写完立刻删除 | 导入期间 |

**不写**：Tavern 的程序目录、会话与对话数据、世界书 / 预设 / 剧本、工作台草稿、卡片库索引。

**删**（只在你点「删除」/批量删除时）：`resources/cards/<原名> mvu版.json` 与对应的
`originals/cards/<原名> mvu版.*`。默认**不留底**（这是刻意的：导入时的原始文件已在
`backups/imported/`）。删除「遗留源卡」那个入口会先留底到 `backups/removed/`。

## 网络

**没有任何网络请求。** 插件不联网、不下载、不上传、不检查更新。

## 命令与子进程

**没有。** 宿主半不 spawn 任何进程，不调用 shell。

## 凭据

**不读不写任何凭据。** 插件不需要 API Key，不碰 DSH 的凭据服务，日志里也不会出现密钥。

## 模型调用与费用

**零调用。** 转换是纯字符串与 JSON 处理，不请求任何模型，也不使用 DSH 的 `llm` 服务。
生成出来的卡在游玩时才会跑 Tavern 自己的后台结算（那是 Tavern 的行为，不是本插件的）。

## 可执行产物

**没有。** 仓库里只有 `.mjs` / `.js` / `.json` / `.md` / `.html` 文本资源，`assets/` 下也只有文本。

## 已知的接口外依赖（重要）

Tavern 的插件接口（第 2 版）目前**没有开放人物卡读写**（文档《暂时没有的》一节），而本插件的功能就是
「把导入的卡转换成 MVU 卡」，所以它必须直接读写卡片文件。为此：

- 这段 IO 全部集中在 `lib/import.mjs` 与 `lib/cardfile.js` 两个文件里，`index.mjs` 不含任何文件格式细节；
- 将来 Tavern 开放卡片读写接口，只需替换这两个文件；
- Tavern 若改变了卡片文件的存放位置或格式，这一部分需要跟着更新——这是本插件最可能失效的地方，
  也是它唯一越出接口的部分。

## 除此之外只用文档列出的东西

浏览器半只用 `tavernUi` 的 `callHost` / `registerPanel` 与 DSH 自带的 `slots`；宿主半只用
`ctx.tavern.handle` / `ctx.inject` / `ctx.effect` / `ctx.logger`。用到的都是接口文档写明的服务与用法，
没有改 Tavern 程序文件，没有打补丁。