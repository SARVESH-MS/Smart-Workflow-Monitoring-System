$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$docsDir = Join-Path $root "docs"
$shotsDir = Join-Path $docsDir "screenshots"
if (!(Test-Path $docsDir)) { New-Item -Path $docsDir -ItemType Directory | Out-Null }
if (!(Test-Path $shotsDir)) { New-Item -Path $shotsDir -ItemType Directory | Out-Null }

$outFile = Join-Path $docsDir "SWMS_Project_Presentation_10_Slides.pptx"

function Add-TitleSlide {
  param($presentation, [string]$title, [string]$subtitle)
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 1)
  $slide.Shapes.Title.TextFrame.TextRange.Text = $title
  $slide.Shapes.Item(2).TextFrame.TextRange.Text = $subtitle
}

function Add-BulletSlide {
  param($presentation, [string]$title, [string[]]$bullets)
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 2)
  $slide.Shapes.Title.TextFrame.TextRange.Text = $title
  $slide.Shapes.Item(2).TextFrame.TextRange.Text = ($bullets -join "`r`n")
}

function Add-ScreenshotSlide {
  param($presentation, [string]$title, [string]$imagePath, [string]$placeholder)
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 11)
  $slide.Shapes.Title.TextFrame.TextRange.Text = $title

  if (Test-Path $imagePath) {
    $slide.Shapes.AddPicture($imagePath, 0, -1, 60, 95, 1210, 600) | Out-Null
  }
  else {
    $box = $slide.Shapes.AddShape(1, 90, 140, 1140, 480)
    $box.Fill.ForeColor.RGB = 0x0F172A
    $box.Line.ForeColor.RGB = 0x60A5FA
    $box.TextFrame.TextRange.Text = "Screenshot Placeholder`r`n$placeholder`r`n`r`nPut image file at:`r`n$imagePath"
    $box.TextFrame.TextRange.Font.Size = 24
  }
}

function Add-FlowChartSlide {
  param($presentation)
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 11)
  $slide.Shapes.Title.TextFrame.TextRange.Text = "System Flow Chart"

  $steps = @(
    "Login",
    "JWT + Role Validation",
    "Dashboard Access",
    "Task Assign / Start Timer",
    "Task Progress Update",
    "Delay Detection",
    "In-App Mail + Notifications",
    "Reports / Manager Action"
  )

  $x = 70
  $y = 95
  $w = 280
  $h = 52
  $g = 22
  for ($i = 0; $i -lt $steps.Count; $i++) {
    $shape = $slide.Shapes.AddShape(5, $x, $y + ($i * ($h + $g)), $w, $h)
    $shape.TextFrame.TextRange.Text = $steps[$i]
    $shape.TextFrame.TextRange.Font.Size = 15
    $shape.Fill.ForeColor.RGB = 0x1E293B
    $shape.Line.ForeColor.RGB = 0x3B82F6
    if ($i -lt $steps.Count - 1) {
      $arr = $slide.Shapes.AddShape(36, $x + 125, $y + ($i * ($h + $g)) + $h + 2, 30, 15)
      $arr.Fill.ForeColor.RGB = 0x60A5FA
      $arr.Line.ForeColor.RGB = 0x60A5FA
    }
  }

  $legend = $slide.Shapes.AddTextbox(1, 400, 160, 800, 320)
  $legend.TextFrame.TextRange.Text = @"
Key flow:
- Manager assigns task
- Employee executes with timer
- Delay/completion events trigger alerts
- Separate in-app modules:
  * Emails (in-app mail inbox)
  * Notifications (task alerts)
- Analytics support decisions
"@
  $legend.TextFrame.TextRange.Font.Size = 22
}

$ppt = $null
$pres = $null
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $ppt.Visible = -1
  $pres = $ppt.Presentations.Add()

  Add-TitleSlide $pres "Smart Workflow Monitoring System" "10-Slide Project Presentation"

  Add-BulletSlide $pres "Problem and Solution" @(
    "Problem: fragmented tracking, delayed visibility, weak accountability",
    "Solution: unified role-based platform with real-time workflow control",
    "Focus: productivity, transparency, and delivery efficiency"
  )

  Add-BulletSlide $pres "Architecture" @(
    "Frontend: React + Vite + Tailwind CSS",
    "Backend: Node.js + Express APIs",
    "Database: MongoDB",
    "Realtime: Socket.io",
    "Security: JWT auth + role middleware"
  )

  Add-FlowChartSlide $pres

  Add-ScreenshotSlide $pres "Login Screen" (Join-Path $shotsDir "01-login.png") "Login page"
  Add-ScreenshotSlide $pres "Admin Dashboard" (Join-Path $shotsDir "02-admin.png") "Admin dashboard overview"
  Add-ScreenshotSlide $pres "Manager Dashboard" (Join-Path $shotsDir "03-manager.png") "Manager dashboard with assignments"
  Add-ScreenshotSlide $pres "Employee Dashboard" (Join-Path $shotsDir "04-employee.png") "Employee task and timer view"
  Add-ScreenshotSlide $pres "Communication Modules" (Join-Path $shotsDir "05-communication.png") "In-app Emails / Notifications / Team Discussion"

  Add-BulletSlide $pres "Conclusion" @(
    "Integrated workflow monitoring across all roles",
    "Real-time delay detection with actionable communication",
    "Time tracking and analytics improve planning quality",
    "Extensible foundation for enterprise workflow automation"
  )

  $pres.SaveAs($outFile, 24)
  Write-Output "Created: $outFile"
}
finally {
  if ($pres -ne $null) { $pres.Close() }
  if ($ppt -ne $null) { $ppt.Quit() }
  if ($pres -ne $null) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) }
  if ($ppt -ne $null) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
