param([string]$ExePath)
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($ExePath)
if ($icon -ne $null) {
  $bmp = New-Object System.Drawing.Bitmap $icon.Width, $icon.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawIcon($icon, 0, 0)
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  [Convert]::ToBase64String($ms.ToArray())
  $ms.Dispose()
  $g.Dispose()
  $bmp.Dispose()
  $icon.Dispose()
} else {
  Write-Output ''
}
