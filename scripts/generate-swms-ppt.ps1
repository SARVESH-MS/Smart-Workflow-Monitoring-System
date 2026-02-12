$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$docsDir = Join-Path $root "docs"
if (!(Test-Path $docsDir)) {
  New-Item -Path $docsDir -ItemType Directory | Out-Null
}

$outFile = Join-Path $docsDir "SWMS_Project_Presentation.pptx"

function Add-BulletSlide {
  param(
    $presentation,
    [string]$title,
    [string[]]$bullets
  )
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 2)
  $slide.Shapes.Title.TextFrame.TextRange.Text = $title
  $textRange = $slide.Shapes.Item(2).TextFrame.TextRange
  $textRange.Text = ($bullets -join "`r`n")
}

function Add-TitleSlide {
  param(
    $presentation,
    [string]$title,
    [string]$subtitle
  )
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 1)
  $slide.Shapes.Title.TextFrame.TextRange.Text = $title
  $slide.Shapes.Item(2).TextFrame.TextRange.Text = $subtitle
}

function Add-FlowChartSlide {
  param($presentation)

  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 11)
  $slide.Shapes.Title.TextFrame.TextRange.Text = "Workflow Flow Chart"

  $boxW = 230
  $boxH = 55
  $left = 60
  $top = 90
  $gap = 35

  $steps = @(
    "User Login",
    "JWT Authentication + Role Check",
    "Role Dashboard Loaded",
    "Task Assigned / Task Started",
    "Time Tracking + Status Updates",
    "Delay Detection Engine",
    "In-App Mail + Notifications",
    "Reports and Manager Decisions"
  )

  for ($i = 0; $i -lt $steps.Count; $i++) {
    $y = $top + ($i * ($boxH + $gap))
    $shape = $slide.Shapes.AddShape(5, $left, $y, $boxW, $boxH)
    $shape.TextFrame.TextRange.Text = $steps[$i]
    $shape.TextFrame.TextRange.Font.Size = 16
    $shape.Fill.ForeColor.RGB = 0x102A43
    $shape.Line.ForeColor.RGB = 0x3B82F6

    if ($i -lt $steps.Count - 1) {
      $arrowY = $y + $boxH
      $arrow = $slide.Shapes.AddShape(36, $left + 98, $arrowY + 4, 30, 20)
      $arrow.Fill.ForeColor.RGB = 0x60A5FA
      $arrow.Line.ForeColor.RGB = 0x60A5FA
    }
  }

  $note = $slide.Shapes.AddTextbox(1, 340, 170, 330, 230)
  $note.TextFrame.TextRange.Text = @"
Real-time loop:
- Task events update dashboards
- Delays trigger alerts
- Emails and notifications remain separate
- Managers get live visibility for intervention
"@
  $note.TextFrame.TextRange.Font.Size = 16
}

$ppt = $null
$presentation = $null

try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $ppt.Visible = -1
  $presentation = $ppt.Presentations.Add()

  Add-TitleSlide -presentation $presentation -title "Smart Workflow Monitoring System" -subtitle "Project Presentation"

  Add-BulletSlide -presentation $presentation -title "Problem Statement" -bullets @(
    "Fragmented tools reduce workflow visibility and accountability",
    "Managers cannot detect delays early across teams",
    "Task communication and reporting are disconnected",
    "Need one real-time platform for end-to-end delivery control"
  )

  Add-BulletSlide -presentation $presentation -title "Solution Overview" -bullets @(
    "Role-based dashboards for Admin, Manager, Employee",
    "Real-time task lifecycle tracking with Socket.io",
    "Timer-based time spent tracking per task",
    "Automated delay detection and alert delivery",
    "Separate in-app Email Inbox and in-app Notifications"
  )

  Add-BulletSlide -presentation $presentation -title "Technology Stack" -bullets @(
    "Frontend: React.js, Vite, Tailwind CSS",
    "Backend: Node.js, Express.js",
    "Database: MongoDB",
    "Authentication: JWT + role middleware",
    "Realtime: Socket.io",
    "Notifications: In-app, SMTP email, Slack, SMS"
  )

  Add-BulletSlide -presentation $presentation -title "Core Features" -bullets @(
    "Project and workflow management",
    "Task assignment, status updates, and deadline control",
    "Kanban board, Gantt timeline, recurring task templates",
    "Capacity and team performance modules",
    "Discussion forum with file/link sharing",
    "CSV/PDF reporting and analytics charts"
  )

  Add-FlowChartSlide -presentation $presentation

  Add-BulletSlide -presentation $presentation -title "Role: Admin" -bullets @(
    "Manage all projects and team workflows",
    "Assign managers and monitor organization-wide analytics",
    "Control notification templates and digest settings",
    "View completion, delay, and productivity metrics"
  )

  Add-BulletSlide -presentation $presentation -title "Role: Manager" -bullets @(
    "Assign tasks and edit employee deadlines",
    "Track team progress with Kanban and Gantt views",
    "Manage recurring templates and team capacity",
    "Receive separate mail and notification alerts"
  )

  Add-BulletSlide -presentation $presentation -title "Role: Employee" -bullets @(
    "View assigned tasks, details, and deadlines",
    "Start/stop timer for real-time time-spent tracking",
    "Update status: Todo, In Progress, Done",
    "Use team discussion and receive in-app communications"
  )

  Add-BulletSlide -presentation $presentation -title "Data Model" -bullets @(
    "Users: identity, role, manager mapping, notification preferences",
    "Projects: workflow stages, manager ownership, status",
    "Tasks: deadlines, status, timer data, stage progression",
    "EmailLog and Notification: in-app communications with read state",
    "ForumRoom and ForumMessage: team-scoped collaboration"
  )

  Add-BulletSlide -presentation $presentation -title "Security and Reliability" -bullets @(
    "JWT protected routes with role validation",
    "Password hashing via bcrypt",
    "Input validation using Zod",
    "Audit and delivery status tracking for notifications",
    "Centralized backend error handling"
  )

  Add-BulletSlide -presentation $presentation -title "Outcome and Value" -bullets @(
    "Improves productivity with real-time task visibility",
    "Reduces schedule risk via early delay detection",
    "Strengthens transparency across all roles",
    "Supports faster and more predictable project delivery"
  )

  Add-BulletSlide -presentation $presentation -title "Future Enhancements" -bullets @(
    "AI-based delay risk prediction",
    "Advanced workload balancing",
    "Approval workflows and escalation policies",
    "Broader enterprise integrations"
  )

  $presentation.SaveAs($outFile, 24)
  Write-Output "Created: $outFile"
}
finally {
  if ($presentation -ne $null) { $presentation.Close() }
  if ($ppt -ne $null) { $ppt.Quit() }
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt)
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
