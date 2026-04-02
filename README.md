# Smart Workflow Monitoring System

Smart Workflow Monitoring System (SWMS) is a full-stack team operations platform for assigning work, tracking delivery, reviewing proof submissions, monitoring deadlines, and keeping managers, employees, and admins in sync through role-based dashboards.

## Highlights

- Role-based dashboards for `Admin`, `Manager`, and `Employee`
- Email/password login plus Google sign-in
- Live task updates with Socket.io
- Task timers, time spent tracking, and delay visibility
- Manager task operations with filters, bulk actions, and proof review
- Employee daily progress updates with evidence links or uploaded files
- Proof history, submission review, and manager recheck actions
- Runtime verification worker for submitted links and `.zip` project proofs
- Manager Gantt timeline based on assigned date, current date, and deadline
- Analytics, reports, notification center, inbox, and team discussion

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Chart.js
- Axios
- Socket.io Client

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- Socket.io
- Zod
- Multer
- Nodemailer
- Twilio
- PDFKit
- Playwright Core

## Main Modules

### Admin

- User approval and registration flow
- Project oversight
- Reports and analytics
- Notification templates and digest tools
- Session/login activity monitoring

### Manager

- Team overview and task assignment
- Global task search and saved filters
- Bulk status actions
- Kanban board
- Gantt timeline
- Task templates and recurring tasks
- Capacity and performance views
- Proof review and proof recheck

### Employee

- Current task workspace
- Start, stop, and complete controls
- Daily progress submission
- Evidence uploads and links
- Proof history view
- Personal task tracking and reports

## Proof Submission and Verification

SWMS supports richer proof validation than a simple link field.

- Employees can submit:
  - links
  - screenshots
  - documents such as `pdf`, `doc`, `docx`, `txt`, `csv`
  - images
  - archive/project files such as `.zip`
- Managers can:
  - review the latest proof summary
  - open proof history
  - recheck a specific submission
- The backend compares submissions across the full task history, not only recent days.
- A runtime verification worker can:
  - inspect live URLs
  - unpack submitted `.zip` projects
  - install dependencies with safer settings
  - attempt build/start checks
  - open the app in a browser
  - run role-based verification scenarios when test credentials are configured

## Project Structure

```text
client/   React + Vite frontend
server/   Express API, MongoDB models, workers, and services
```

## Quick Start

```bash
cd server
npm install
npm run dev
```

```bash
cd client
npm install
npm run dev
```

## Environment Variables

### Client

In `client/.env`:

- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID`

### Server

In `server/.env`:

- `PORT`
- `MONGO_TARGET`
- `MONGO_URI_LOCAL`
- `MONGO_URI_ATLAS`
- `JWT_SECRET`
- `CLIENT_URL`
- `REQUEST_BODY_LIMIT`
- `AUTH_RATE_LIMIT_WINDOW_MS`
- `AUTH_RATE_LIMIT_MAX`
- `MONGO_AUTO_INDEX`
- `MONGO_MAX_POOL_SIZE`
- `MONGO_SERVER_SELECTION_TIMEOUT_MS`
- `GOOGLE_CLIENT_ID`
- `COMPANY_ID`
- `NOTIFY_ON_DELAY`
- `NOTIFY_ON_COMPLETE`
- `SLACK_WEBHOOK_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM`

## Runtime Verification Worker

To process queued runtime verification jobs:

```bash
cd server
npm run verify-worker
```

Optional worker-related environment variables:

- `PLAYWRIGHT_BROWSER_PATH`
- `RUNTIME_VERIFIER_POLL_MS`
- `VERIFIER_ADMIN_EMAIL`
- `VERIFIER_ADMIN_PASSWORD`
- `VERIFIER_MANAGER_EMAIL`
- `VERIFIER_MANAGER_PASSWORD`
- `VERIFIER_EMPLOYEE_EMAIL`
- `VERIFIER_EMPLOYEE_PASSWORD`

The role-based verifier accounts let the worker log into submitted apps and check dashboard flows in the browser.

## Available Scripts

### Server

- `npm run dev` - start API in watch mode
- `npm start` - start API
- `npm run verify-worker` - start runtime verification worker
- `npm run seed` - seed core data
- `npm run seed:mails` - seed inbox mails
- `npm run seed:ids` - sync SWMS IDs

### Client

- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint

## Default Seeded Accounts

Password for all seeded accounts:

```text
Password123!
```

### Admin

- `sarvesh.cs23@bitsathy.ac.in`

### Managers

- `ms.sarveshsarvesh.2006@gmail.com` (Raju)
- `ms.sarveshyawana@gmail.com` (Leena)

### Raju Team

- `sarveshsarvesh2006at@gmail.com` (RajuTeam1)
- `sarvesh.at.2306@gmail.com` (Sarvesh MS)
- `raju3@swms.com`
- `raju4@swms.com`
- `raju5@swms.com`
- `raju6@swms.com`
- `raju7@swms.com`
- `raju8@swms.com`
- `raju9@swms.com`
- `raju10@swms.com`

### Leena Team

- `leena1@swms.com`
- `leena2@swms.com`
- `leena3@swms.com`
- `leena4@swms.com`
- `leena5@swms.com`
- `leena6@swms.com`
- `leena7@swms.com`
- `leena8@swms.com`
- `leena9@swms.com`

## Deployment Notes

### Frontend

- Build command: `npm run build`
- Output directory: `client/dist`
- Main env: `VITE_API_URL`

### Backend

- Root directory: `server`
- Start command: `npm start`
- Main envs: `MONGO_URI_LOCAL` or `MONGO_URI_ATLAS`, `JWT_SECRET`, `CLIENT_URL`

## Notes

- `client/dist` and `server/uploads` are ignored from Git.
- Google sign-in is hidden until `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` are configured.
- Runtime verification is strongest when the verifier worker is running and role test credentials are set.
