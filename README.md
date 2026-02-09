# Smart Workflow Monitoring System

A full-stack workflow monitoring platform with role-based dashboards, real-time updates, time tracking, and delay detection.

## About the Project
Smart Workflow Monitoring System (SWMS) helps teams plan, assign, track, and deliver work with visibility across roles. It provides Admin, Manager, and Employee dashboards with live updates, time tracking, and alerts to reduce delays and improve delivery efficiency.

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
- Capacity & availability tracking
- Performance scorecards
- Notification templates (Email + Slack)
- Email/SMS notifications + in-app email inbox
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
- **Admin**: Project creation/management, analytics, notification templates, digest sender, email logs
- **Manager**: Team overview, task assignment, Kanban, Gantt, templates/recurring, bulk updates
- **Employee**: Task list with details, time tracking, completion, capacity/availability

## Project Structure
- `client/` – React frontend
- `server/` – Express API + MongoDB models + Socket.io

## Quick Start

### 1) Backend

```bash
cd server
cp .env.example .env
npm install
npm run seed  ### To reset the data base in MongoDB
npm run dev
```

### 2) Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

## Default Accounts (seeded)
All passwords: `Password123!`
- Admin: admin@swms.com
- Manager Raju: raju@swms.com
- Manager Leena: leena@swms.com
- Raju Team (Employees):
  - raju1@swms.com
  - raju2@swms.com
  - raju3@swms.com
  - raju4@swms.com
  - raju5@swms.com
  - raju6@swms.com
  - raju7@swms.com
  - raju8@swms.com
  - raju9@swms.com
  - raju10@swms.com
- Leena Team (Employees):
  - leena1@swms.com
  - leena2@swms.com
  - leena3@swms.com
  - leena4@swms.com
  - leena5@swms.com
  - leena6@swms.com
  - leena7@swms.com
  - leena8@swms.com
  - leena9@swms.com

## Deployment

### Frontend (Vercel)
- Build command: `npm run build`
- Output directory: `client/dist`
- Env: `VITE_API_URL` (e.g. Railway URL)

### Backend (Railway)
- Root directory: `server`
- Start command: `npm start`
- Env: `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`
 - Optional notifications: `SMTP_*`, `TWILIO_*`, `NOTIFY_ON_DELAY`

### MongoDB Atlas
- Create a cluster and user
- Set `MONGO_URI` in Railway

## Notes
- Real-time updates via Socket.io
- Time tracking with start/stop timer per task
- Delay detection runs on task updates and deadline checks
- Email/SMS notifications configurable via `.env.notifications.example`

### Task Templates & Recurring
Interval days: 7 → create a new task every 7 days (weekly).
Occurrences: 5 → create it 5 times total.
So with today as Feb 9, 2026, it would create tasks on:

Feb 9, 2026
Feb 16, 2026
Feb 23, 2026
Mar 2, 2026
Mar 9, 2026
