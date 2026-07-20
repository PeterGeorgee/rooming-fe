# CampKin Frontend

React and TypeScript organizer interface for the CampKin API.

## Requirements

- Node.js 20+
- The CampKin backend running locally

## Configure

Copy `.env.example` to `.env`. The default connects to:

```text
VITE_API_URL=http://localhost:8080/api
```

## Install and run

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production build

```powershell
npm run build
```

## Main capabilities

- Camp and room setup
- CSV and Excel camper uploads
- Gender and roommate-preference review
- Room and discussion-group assignments
- Search, statistics, manual moves, and PDF exports
