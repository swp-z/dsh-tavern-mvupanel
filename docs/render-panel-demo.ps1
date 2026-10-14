# 从 assets/appearance.html 渲染出 README 用的面板效果图。
#
# 用法（在仓库根目录）：
#   pwsh -File docs/render-panel-demo.ps1
#   pwsh -File docs/render-panel-demo.ps1 -Chrome "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
#
# 产出：
#   docs/panel-demo.html      静态示例页（可直接用浏览器打开）
#   docs/screenshot-panel.png 示例页截图（裁到内容框）
#
# 说明：
#   - appearance.html 里的 $NNN 是真面板的插槽，示例渲染时换成固定示例值，敏感字段一律 **；
#   - 真面板由脚本按数据实例化 <template> 并展开 details，静态页要手动实体化；
#   - 替换插槽必须按 key 长度倒序，否则 "$4" 会把 "$4xx" 一起吃掉。

param(
  [string]$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$enc = New-Object System.Text.UTF8Encoding($false)
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path $Chrome)) { $Chrome = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' }

$t = [System.IO.File]::ReadAllText((Join-Path $root 'assets\appearance.html'))

# 1) 待生效列表：示例里留空态
$t = [regex]::Replace($t, '<ul class="mvu-pending"[\s\S]*?</ul>', '<ul class="mvu-pending"><li class="mvu-empty">暂无待生效变更</li></ul>', 1)

# 2) 三个芯片容器（真面板由 paintTags 生成）
$t = $t.Replace('data-tags="&#36;425" data-hot="off"></div>', '><span class="mvu-tag">戒备</span><span class="mvu-tag">余韵</span></div>')
$t = $t.Replace('data-tags="&#36;419" data-hot="off"></div>', '><span class="mvu-tag">经验丰富</span><span class="mvu-tag">**</span><span class="mvu-tag">**</span></div>')
$t = $t.Replace('data-tags="&#36;413" data-hot="off"></div>', '><span class="mvu-tag">**</span><span class="mvu-tag">**</span><span class="mvu-tag">**</span></div>')

# 3) 插槽 → 示例值
$map = @{
  '1'='第一幕 · 教室'; '4'='示例渲染'; '5'='1'; '6'='1'; '7'='1'; '8'='0'
  '201'='在场者不得主动离席'; '202'='生效'; '203'='**'; '204'='停用'
  '401'='**'; '402'='19'; '403'='80'; '404'='B'; '405'='58'; '406'='84'
  '407'='**'; '408'='**'; '409'='**'; '410'='**'; '411'='mvu-dot-on'; '412'='在场'
  '414'='**'; '415'='**'; '416'='**'; '417'='**'
  '418'='62'; '421'='**'; '423'='46'; '424'='12'; '426'='0'
}
foreach ($k in ($map.Keys | Sort-Object -Property Length -Descending)) { $t = $t.Replace('&#36;' + $k, [string]$map[$k]) }
$left = [regex]::Matches($t, '&#36;\d+')
if ($left.Count -gt 0) { throw ('未替换插槽：' + (($left | ForEach-Object { $_.Value } | Sort-Object -Unique) -join ',')) }

# 4) 字段名脱敏 + 展开折叠 + 实体化模板
$t = $t.Replace('<span class="lb">小穴</span>', '<span class="lb">**</span>').Replace('<span class="lb">菊穴</span>', '<span class="lb">**</span>')
$t = $t.Replace('<details class="mvu-file">', '<details class="mvu-file" open>').Replace('<template>', '').Replace('</template>', '')

$page = "<!doctype html>`n<html lang=`"zh-CN`">`n<head>`n<meta charset=`"utf-8`">`n<title>MVU 状态面板 · 示例渲染</title>`n<style>html,body{margin:0;padding:0;background:#0b1220}body{padding:14px 14px 18px}</style>`n</head>`n<body>`n$t`n</body>`n</html>`n"
$demo = Join-Path $PSScriptRoot 'panel-demo.html'
[System.IO.File]::WriteAllText($demo, $page, $enc)
Write-Host "示例页: $demo"

# 5) 无头渲染（--no-sandbox + 超时保护）
$shotRaw = Join-Path $env:TEMP ('mvupanel-' + [guid]::NewGuid().ToString('N') + '.png')
$prof = Join-Path $env:TEMP ('mvupanel-prof-' + [guid]::NewGuid().ToString('N'))
$chromeArgs = @(
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  "--user-data-dir=$prof", '--hide-scrollbars', '--force-device-scale-factor=1.5',
  '--window-size=780,1900', '--virtual-time-budget=4000', "--screenshot=$shotRaw",
  ('file:///' + ($demo -replace '\\', '/'))
)
$p = Start-Process -FilePath $Chrome -ArgumentList $chromeArgs -PassThru -WindowStyle Hidden
$p | Wait-Process -Timeout 75 -ErrorAction SilentlyContinue
if (-not $p.HasExited) { $p | Stop-Process -Force }
Start-Sleep -Milliseconds 400
if (-not (Test-Path $shotRaw)) { throw '渲染失败：没有产出 PNG' }

# 6) 裁到内容框（页面背景 #0b1220）
$img = [System.Drawing.Bitmap]::FromFile($shotRaw)
$W = $img.Width; $H = $img.Height
$minX = $W; $minY = $H; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $H; $y += 2) {
  for ($x = 0; $x -lt $W; $x += 2) {
    $c = $img.GetPixel($x, $y)
    if ([Math]::Abs([int]$c.R - 11) -gt 8 -or [Math]::Abs([int]$c.G - 18) -gt 8 -or [Math]::Abs([int]$c.B - 32) -gt 8) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$m = 14
$x0 = [Math]::Max(0, $minX - $m); $y0 = [Math]::Max(0, $minY - $m)
$w = [Math]::Min($W - $x0, ($maxX - $minX) + 2 * $m); $h = [Math]::Min($H - $y0, ($maxY - $minY) + 2 * $m)
$crop = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)), (New-Object System.Drawing.Rectangle($x0, $y0, $w, $h)), [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose(); $img.Dispose()
$out = Join-Path $PSScriptRoot 'screenshot-panel.png'
$crop.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
Remove-Item $shotRaw, $prof -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "截图: $out  (${w}x${h})"
