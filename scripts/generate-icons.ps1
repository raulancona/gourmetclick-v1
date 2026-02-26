Add-Type -AssemblyName System.Drawing

function Create-Icon {
  param([int]$size)

  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $dark = [System.Drawing.Color]::FromArgb(255, 9, 9, 11)
  $gold = [System.Drawing.Color]::FromArgb(255, 212, 175, 55)
  $goldDim = [System.Drawing.Color]::FromArgb(77, 212, 175, 55)
  $goldMid = [System.Drawing.Color]::FromArgb(127, 212, 175, 55)

  # Rounded background
  $bg = New-Object System.Drawing.SolidBrush($dark)
  $r = [int]($size * 0.22)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, ($r * 2), ($r * 2), 180, 90)
  $path.AddArc(($size - $r * 2), 0, ($r * 2), ($r * 2), 270, 90)
  $path.AddArc(($size - $r * 2), ($size - $r * 2), ($r * 2), ($r * 2), 0, 90)
  $path.AddArc(0, ($size - $r * 2), ($r * 2), ($r * 2), 90, 90)
  $path.CloseFigure()
  $g.FillPath($bg, $path)

  # Decorative border
  $borderPen = New-Object System.Drawing.Pen($goldDim, [float]($size * 0.031))
  $bi = [int]($size * 0.063)
  $bR = [int]($size * 0.156)
  $borderPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $borderPath.AddArc($bi, $bi, ($bR * 2), ($bR * 2), 180, 90)
  $borderPath.AddArc(($size - $bi - $bR * 2), $bi, ($bR * 2), ($bR * 2), 270, 90)
  $borderPath.AddArc(($size - $bi - $bR * 2), ($size - $bi - $bR * 2), ($bR * 2), ($bR * 2), 0, 90)
  $borderPath.AddArc($bi, ($size - $bi - $bR * 2), ($bR * 2), ($bR * 2), 90, 90)
  $borderPath.CloseFigure()
  $g.DrawPath($borderPen, $borderPath)

  $cx = [int]($size / 2)
  $cy = [int]($size * 0.563)
  $plateR = [int]($size * 0.234)
  $innerR = [int]($size * 0.156)
  $lw = [float]($size * 0.047)

  # Outer plate circle
  $platePen = New-Object System.Drawing.Pen($gold, $lw)
  $g.DrawEllipse($platePen, ($cx - $plateR), ($cy - $plateR), ($plateR * 2), ($plateR * 2))

  # Inner plate circle
  $innerPen = New-Object System.Drawing.Pen($goldMid, [float]($lw * 0.4))
  $g.DrawEllipse($innerPen, ($cx - $innerR), ($cy - $innerR), ($innerR * 2), ($innerR * 2))

  # Cloche arc (top half = 180 degrees starting from left = 180deg)
  $clochePen = New-Object System.Drawing.Pen($gold, $lw)
  $clochePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $clochePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($clochePen, ($cx - $plateR), ($cy - $plateR), ($plateR * 2), ($plateR * 2), 180, 180)

  # Handle stem
  $handlePen = New-Object System.Drawing.Pen($gold, $lw)
  $handlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $handlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($handlePen, $cx, ($cy - $plateR), $cx, ($cy - $plateR - [int]($size * 0.063)))

  $g.Dispose()
  return $bmp
}

foreach ($s in @(192, 512)) {
  $icon = Create-Icon -size $s
  $outPath = Join-Path (Get-Location) "public\pwa-icon-$s.png"
  $icon.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $icon.Dispose()
  Write-Host "Generated: pwa-icon-$s.png"
}

# Generate favicon 32x32
$fav = Create-Icon -size 32
$favPath = Join-Path (Get-Location) "public\favicon.ico"
$fav.Save($favPath, [System.Drawing.Imaging.ImageFormat]::Png)
$fav.Dispose()
Write-Host "Generated: favicon.ico"

# Also 48x48 for apple touch
$apple = Create-Icon -size 180
$applePath = Join-Path (Get-Location) "public\apple-touch-icon.png"
$apple.Save($applePath, [System.Drawing.Imaging.ImageFormat]::Png)
$apple.Dispose()
Write-Host "Generated: apple-touch-icon.png"

Write-Host "All icons generated!"
