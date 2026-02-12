# Smart Workflow Monitoring System

A full-stack workflow monitoring platform with role-based dashboards, real-time updates, time tracking, delay detection, and built-in team communication.

## About the Project
Smart Workflow Monitoring System (SWMS) helps teams plan, assign, track, and deliver work with visibility across roles. It provides Admin, Manager, and Employee dashboards with live updates, time tracking, and proactive alerts to improve productivity and delivery predictability.

## Stack
- Frontend: React + Vite + Tailwind CSS + Chart.js
- Backend: Node.js + Express + MongoDB + Socket.io
- Auth: JWT with role-based middleware

## Key Features
- Role-based dashboards (Admin / Manager / Employee)
- JWT authentication + protected routes
- Real-time updates via Socket.io
- Task time tracking (start/stop) + delay detection
- Project workflows + Kanban board
- Gantt timeline for project tasks
- Analytics (completion rate, delays, time spent)
- Task templates + recurring tasks
- Bulk task updates
- Global search + saved filters
- Capacity and availability tracking
- Performance scorecards
- Notification templates (Email + Slack)
- Separate in-app modules:
  - `Emails` (in-app mail inbox)
  - `Notifications` (in-app task alerts)
- Team discussion with file/link sharing + unread counters
- Reports export (CSV / PDF)
- Audit log for key actions

## What We Used
- Database: MongoDB (Mongoose ODM)
- Authentication: JWT
- Validation: Zod
- Real-time: Socket.io
- Charts: Chart.js (react-chartjs-2)
- Email: Nodemailer
- SMS: Twilio
- Slack: Webhook integration
- PDF export: PDFKit

## Modules Overview
- **Admin**: Project management, analytics, notification templates, digest sender, email logs
- **Manager**: Team overview, task assignment, Kanban, Gantt, templates/recurring, bulk updates, capacity/performance
- **Employee**: Task list with details, timer controls, completion tracking, capacity view

## Project Structure
- `client/` - React frontend
- `server/` - Express API + MongoDB models + Socket.io

## Quick Start

### 1. Backend
```bash
cd server
cp .env.example .env
npm install
npm run seed
npm run dev
```

Optional seeded in-app mails for all existing users:
```bash
npm run seed:mails
```

### 2. Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev
```

### 3. Monorepo (root)
```bash
npm install
npm run dev
```

## Default Accounts (seeded)
All passwords: `Password123!`
- Admin: `admin@swms.com`
- Manager Raju: `raju@swms.com`
- Manager Leena: `leena@swms.com`
- Raju Team (Employees):
  - `raju1@swms.com`
  - `raju2@swms.com`
  - `raju3@swms.com`
  - `raju4@swms.com`
  - `raju5@swms.com`
  - `raju6@swms.com`
  - `raju7@swms.com`
  - `raju8@swms.com`
  - `raju9@swms.com`
  - `raju10@swms.com`
- Leena Team (Employees):
  - `leena1@swms.com`
  - `leena2@swms.com`
  - `leena3@swms.com`
  - `leena4@swms.com`
  - `leena5@swms.com`
  - `leena6@swms.com`
  - `leena7@swms.com`
  - `leena8@swms.com`
  - `leena9@swms.com`

## Environment Variables (server/.env)
Required:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`

Optional notifications:
- `NOTIFY_ON_DELAY` (`true`/`false`)
- `NOTIFY_ON_COMPLETE` (`true`/`false`)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SLACK_WEBHOOK_URL`

## Deployment

### Frontend (Vercel)
- Build command: `npm run build`
- Output directory: `client/dist`
- Env: `VITE_API_URL` (e.g. Railway URL)

### Backend (Railway)
- Root directory: `server`
- Start command: `npm start`
- Core env: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`
- Optional notifications: `SMTP_*`, `TWILIO_*`, `SLACK_WEBHOOK_URL`, `NOTIFY_ON_DELAY`, `NOTIFY_ON_COMPLETE`

### MongoDB Atlas
- Create a cluster and user
- Set `MONGO_URI` in backend environment

## Notes
- Real-time updates use Socket.io events.
- Time tracking is timer-based per task (start/stop).
- Delay detection runs during task updates and completion checks.
- In-app inbox (`Emails`) and in-app alerts (`Notifications`) are separate views.

## Task Templates and Recurring (Example)
- Interval days: `7` -> create a new task every 7 days (weekly)
- Occurrences: `5` -> create it 5 times total
- Example dates (if started on Feb 9, 2026):
  - Feb 9, 2026
  - Feb 16, 2026
  - Feb 23, 2026
  - Mar 2, 2026
  - Mar 9, 2026
