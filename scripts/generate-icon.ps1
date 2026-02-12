param()

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot "icon.png"
$buildDir = Join-Path $projectRoot "build"
$outputPath = Join-Path $buildDir "icon.ico"

if (-not (Test-Path $sourcePath)) {
  throw "Icon source not found: $sourcePath"
}

New-Item -ItemType Directory -Path $buildDir -Force | Out-Null

$source = [System.Drawing.Image]::FromFile($sourcePath)
$canvasSize = 256
$bitmap = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$scale = [Math]::Min($canvasSize / $source.Width, $canvasSize / $source.Height)
$drawWidth = [int][Math]::Round($source.Width * $scale)
$drawHeight = [int][Math]::Round($source.Height * $scale)
$drawX = [int][Math]::Floor(($canvasSize - $drawWidth) / 2)
$drawY = [int][Math]::Floor(($canvasSize - $drawHeight) / 2)

$graphics.DrawImage($source, $drawX, $drawY, $drawWidth, $drawHeight)

$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.File]::Open($outputPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()

$icon.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$source.Dispose()

Write-Output "[prepare:icon] Generated $outputPath"
