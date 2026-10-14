## 亮点

- **设置页导入**（可多选 PNG / JSON）→ 纯程序生成可直接开局的 MVU 卡，**零模型调用**。
- **初始化零 token**：`<initvar>` 用 `promptOnly` 正则挡在模型上下文之外；面板 HTML 与 `<mvu-status/>` 同样不进上下文。
- **与原生导入彻底隔离**：不扫描 `cards/`，原生按钮导入的卡一字节都不碰。
- **面板 R32**：档案卡 23 字段；数值区 4 轴（好感度 / 发情度 / 高潮度 / 射精度）；
  性经验 7 类词表 +「事件→标签」判据；身体四字段腔道归属硬映射（肛交只写菊穴）。
- **列表**：15 条/页、全选本页、批量删除（不留底）、导出（`.json` 下载）、删除。
- **日志与诊断**：`logs/mvupanel-<日期>.jsonl` + 面板里的「复制日志」。

## 安装

把本仓库文件夹放进 `<tavern data>/plugins/dsh-tavern-mvupanel/`，重启一次 DSH，
然后打开 设置 → **MVU 面板**。不需要 npm、不需要 bundle 补丁。

## 自检

```bash
node test/run.mjs      # 23 项，不需要 Tavern，不联网
```

## 说明

- 需要 DSH Tavern **2.5.0+**（插件接口第 2 版）；已在 DSH 0.1.5-rc.2 / Tavern 2.6.0 上验证。
- 唯一越出插件接口的部分是**人物卡文件读写**（Tavern 尚未开放卡片接口），见 [PERMISSIONS.md](PERMISSIONS.md)。
- 插件页无法「一键开局」：接口没有开局 API，开局仍在原生「选择人物卡 · 开始游玩」里点那张卡。

**Full Changelog**: https://github.com/swp-z/dsh-tavern-mvupanel/commits/v1.0.0