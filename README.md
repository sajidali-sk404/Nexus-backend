# Nexus Platform — Backend API

> **Investor & Entrepreneur Collaboration Platform**
> Full-stack internship project | Deadline: 25 May 2026

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.18-black?logo=express)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://mongodb.com)
[![JWT](https://img.shields.io/badge/Auth-JWT-orange)](https://jwt.io)
[![Stripe](https://img.shields.io/badge/Payments-Stripe_Sandbox-blueviolet?logo=stripe)](https://stripe.com)

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Models](#database-models)
- [Middleware](#middleware)
- [Testing with Postman](#testing-with-postman)
- [Deployment](#deployment)
- [Frontend Integration](#frontend-integration)

---

## Overview

Nexus is a full-stack collaboration platform that connects **investors** and **entrepreneurs**. This repository contains the complete **backend API** built with Node.js, Express, and MongoDB.

The backend powers:
- Role-based user authentication (JWT)
- Meeting scheduling with conflict detection
- Document upload and e-signature
- Payment simulation (Stripe sandbox)
- WebRTC video call signaling (Socket.IO)
- Security hardening (Helmet, bcrypt, input validation)

**Frontend Repo:** [Nexus GitHub Repo](https://github.com/your-username/nexus)
**Live Frontend:** [nexus-iota-five.vercel.app](https://nexus-iota-five.vercel.app/login)
**Live Backend:** [nexus-backend.onrender.com](https://nexus-backend.onrender.com)

---

## Features

### Week 1 — Auth & Profiles
- JWT-based authentication (register, login, change password)
- Role-based access: `investor` vs `entrepreneur`
- Full user profile management (bio, startup info, investment preferences)
- 2FA mock: 6-digit OTP generation and verification
- Password hashing with bcrypt (salt rounds: 12)

### Week 2 — Collaboration & Documents
- Meeting scheduling with **conflict detection** (no double booking)
- Accept / reject / cancel meetings with reason
- Document upload (PDF, Word, images up to 10MB)
- Document sharing with per-user permissions (`view`, `sign`, `edit`)
- E-signature: base64 signature image linked to documents
- Version tracking and status flow for documents

### Week 3 — Payments & Security
- Stripe sandbox: deposit, withdraw, transfer
- Wallet balance via MongoDB aggregation
- Full transaction history with pagination and filters
- Helmet for HTTP security headers
- express-validator for input sanitization
- Role-based route authorization

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4.18 |
| Database | MongoDB (Mongoose 8) |
| Authentication | JSON Web Tokens (jsonwebtoken) |
| Password Hashing | bcryptjs |
| File Upload | Multer |
| Payments | Stripe SDK (sandbox) |
| Real-time | Socket.IO 4 |
| Security | Helmet, express-validator |
| Dev Tools | Nodemon, dotenv |

---

## Project Structure

```
nexus-backend/
│
├── models/
│   ├── User.js             # User schema (investor + entrepreneur fields)
│   ├── Meeting.js          # Meeting schema + conflict detection
│   ├── Document.js         # Document schema + e-signature
│   └── Transaction.js      # Payment transaction schema
│
├── middleware/
│   ├── authMiddleware.js   # JWT verification → attaches req.user
│   └── roleCheck.js        # Role-based + owner access control
│
├── routes/
│   ├── auth.js             # /api/auth — register, login, OTP, password
│   ├── users.js            # /api/users — profiles, search, discovery
│   ├── meetings.js         # /api/meetings — schedule, respond, cancel
│   ├── docs.js             # /api/docs — upload, share, sign, delete
│   └── payments.js         # /api/payments — deposit, withdraw, transfer
│
├── uploads/
│   └── documents/          # Uploaded files stored here (local)
│
├── server.js               # Express app + MongoDB connection
├── .env.example            # Environment variables template
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free) — [cloud.mongodb.com](https://cloud.mongodb.com)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/nexus-backend.git
cd nexus-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Fill in your values (see [Environment Variables](#environment-variables) below).

### 4. Start the Server

```bash
# Development (auto-restart on file change)
npm run dev

# Production
npm start
```

### 5. Verify It's Running

```
GET http://localhost:5000/api/health

Response: { "status": "✅ Nexus backend running", "timestamp": "..." }
```

---

## Environment Variables

Create a `.env` file in the root. All variables below are required:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB Atlas
# Get from: cloud.mongodb.com → Connect → Drivers → Node.js
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/nexus

# JWT
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_long_random_secret_here
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Stripe Sandbox (optional — mock mode works without it)
# Get from: dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
```

> **Note:** Never commit your `.env` file. It is listed in `.gitignore`.

---

## API Reference

Base URL: `http://localhost:5000`
All protected routes require: `Authorization: Bearer <token>`

---

### 🔐 Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | ❌ | Register new user (investor or entrepreneur) |
| POST | `/login` | ❌ | Login and receive JWT token |
| GET | `/me` | ✅ | Get currently logged-in user |
| POST | `/send-otp` | ✅ | Generate 6-digit OTP (check server console) |
| POST | `/verify-otp` | ✅ | Verify OTP to enable 2FA |
| POST | `/change-password` | ✅ | Change account password |

**Register Request Body:**
```json
{
  "name": "Ali Hassan",
  "email": "ali@example.com",
  "password": "password123",
  "role": "entrepreneur"
}
```

**Login Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "_id": "...", "name": "Ali Hassan", "role": "entrepreneur" }
}
```

---

### 👤 Users — `/api/users`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/` | ✅ | Any | List all users (paginated, searchable) |
| GET | `/investors` | ✅ | Entrepreneur | List all investors |
| GET | `/entrepreneurs` | ✅ | Investor | List all entrepreneurs |
| GET | `/:id` | ✅ | Any | Get single user profile |
| PUT | `/:id` | ✅ | Owner | Update own profile |
| DELETE | `/:id` | ✅ | Owner | Deactivate own account |

**Query Parameters for `GET /`:**
```
?search=ali          → search by name, bio, startup
?role=investor       → filter by role
?industry=fintech    → filter by industry
?page=1&limit=10     → pagination
```

---

### 📅 Meetings — `/api/meetings`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | ✅ | Schedule a meeting (conflict-checked) |
| GET | `/` | ✅ | Get all my meetings |
| GET | `/:id` | ✅ | Get single meeting |
| PUT | `/:id/respond` | ✅ | Accept or reject (attendee only) |
| PUT | `/:id/cancel` | ✅ | Cancel meeting (organizer only) |
| PUT | `/:id/notes` | ✅ | Add post-meeting notes |

**Schedule Meeting Body:**
```json
{
  "title": "Pitch Meeting — PayEase",
  "attendeeId": "64f2a...",
  "date": "2026-05-20",
  "startTime": "14:00",
  "endTime": "15:00",
  "type": "video",
  "description": "Series A discussion",
  "agenda": ["Company overview", "Financials", "Funding ask"]
}
```

**Conflict Response (409):**
```json
{
  "success": false,
  "message": "You already have a meeting during this time slot."
}
```

---

### 📄 Documents — `/api/docs`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/upload` | ✅ | Upload document (multipart/form-data) |
| GET | `/` | ✅ | Get all my documents |
| GET | `/:id` | ✅ | Get single document |
| POST | `/:id/share` | ✅ | Share with another user |
| POST | `/:id/sign` | ✅ | E-sign with base64 image |
| DELETE | `/:id` | ✅ | Delete document (owner only) |

**Upload Form Fields:**
```
document          → file (PDF/Word/image, max 10MB)
title             → string
category          → pitch-deck | nda | term-sheet | agreement | report | other
description       → string
requiresSignature → true | false
tags              → comma-separated string (e.g. "fintech,series-a")
```

**Sign Body:**
```json
{
  "signatureImage": "data:image/png;base64,iVBORw0KGgo..."
}
```

---

### 💳 Payments — `/api/payments`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/balance` | ✅ | Get current wallet balance |
| POST | `/deposit` | ✅ | Add funds (Stripe or mock) |
| POST | `/withdraw` | ✅ | Withdraw funds |
| POST | `/transfer` | ✅ | Transfer to another user |
| GET | `/history` | ✅ | Transaction history (paginated) |
| GET | `/:id` | ✅ | Single transaction details |

**Deposit Body:**
```json
{
  "amount": 10000,
  "currency": "usd",
  "paymentMethod": "mock"
}
```

**History Query Parameters:**
```
?type=deposit        → filter by type (deposit/withdrawal/transfer)
?status=completed    → filter by status
?page=1&limit=20     → pagination
```

---

## Database Models

### User
| Field | Type | Description |
|---|---|---|
| `name`, `email`, `password` | String | Core auth fields |
| `role` | `investor` / `entrepreneur` | Determines dashboard and permissions |
| `bio`, `profilePic`, `location` | String | Common profile fields |
| `startupName`, `startupStage`, `industry` | String | Entrepreneur-specific |
| `investmentFocus`, `minInvestment`, `maxInvestment` | Mixed | Investor-specific |
| `twoFactorOTP`, `twoFactorExpiry` | String/Date | 2FA fields |
| `isActive` | Boolean | Soft delete flag |

### Meeting
| Field | Type | Description |
|---|---|---|
| `organizer`, `attendee` | ObjectId → User | Participants |
| `date`, `startTime`, `endTime` | Date/String | Schedule |
| `status` | `pending/accepted/rejected/cancelled/completed` | Meeting state |
| `roomId` | String (UUID) | Video call room identifier |
| `rejectionReason`, `notes` | String | Optional details |

### Document
| Field | Type | Description |
|---|---|---|
| `uploadedBy` | ObjectId → User | Owner |
| `fileUrl`, `fileType`, `fileSize` | String/Number | File info |
| `category` | `pitch-deck/nda/term-sheet/...` | Document type |
| `sharedWith` | Array of `{user, permission}` | Access control |
| `signatures` | Array of `{signedBy, signatureImage, signedAt}` | E-signatures |
| `status` | `draft/pending-signature/signed/archived` | Document state |

### Transaction
| Field | Type | Description |
|---|---|---|
| `from`, `to` | ObjectId → User | Sender / Receiver (null for deposits) |
| `amount`, `currency` | Number/String | Payment amount |
| `type` | `deposit/withdrawal/transfer/investment/refund` | Transaction type |
| `status` | `pending/completed/failed/cancelled/refunded` | Payment state |
| `stripePaymentIntentId` | String | Stripe reference (sandbox) |
| `netAmount` | Number | Auto-calculated: amount − fee |

---

## Middleware

### `protect` — JWT Authentication
```js
// Attach to any route that requires login
router.get('/profile', protect, handler);
```
Verifies the Bearer token, fetches the user from DB, and attaches them to `req.user`.

### `roleCheck` — Role Authorization
```js
// Allow only investors
router.get('/entrepreneurs', protect, roleCheck('investor'), handler);

// Allow both roles
router.get('/meetings', protect, roleCheck('investor', 'entrepreneur'), handler);
```

### `ownerCheck` — Resource Ownership
```js
// Only allow users to edit their own profile
router.put('/users/:id', protect, ownerCheck, handler);
```
Compares `req.user._id` with the `:id` route parameter.

---

## Testing with Postman

A complete Postman collection is included with **40+ pre-built requests**.

### Import Steps
1. Open Postman → click **Import**
2. Select `Nexus_API.postman_collection.json`
3. Set collection variable `baseUrl` = `http://localhost:5000`
4. Run **Register** or **Login** → token is auto-saved
5. All other requests work automatically

### Test Flow (recommended order)
```
1. Register Entrepreneur     → token auto-saved
2. Register Investor         → copy investor ID
3. Login as Entrepreneur     → token refreshed
4. Update Profile
5. Schedule Meeting          → meetingId auto-saved
6. Login as Investor → Accept Meeting
7. Upload Document           → docId auto-saved
8. Share Document for Signing
9. Login as Entrepreneur → Sign Document
10. Deposit Money            → transactionId auto-saved
11. Transfer to Investor
12. Check Balance + History
```

---

## Deployment

### Backend → Render (Free Tier)

1. Push backend to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set **Build Command:** `npm install`
5. Set **Start Command:** `npm start`
6. Add all environment variables from `.env` in the dashboard
7. Deploy → get your URL: `https://nexus-backend.onrender.com`

### Frontend → Vercel

1. Update frontend API base URL to your Render URL
2. Push frontend to GitHub
3. Go to [vercel.com](https://vercel.com) → Import project
4. Auto-deploys on every push

---

## Frontend Integration

Update your frontend to point to the backend:

```js
// src/config/api.js
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const api = {
  auth: {
    register: `${API_BASE}/api/auth/register`,
    login:    `${API_BASE}/api/auth/login`,
    me:       `${API_BASE}/api/auth/me`,
  },
  users:    `${API_BASE}/api/users`,
  meetings: `${API_BASE}/api/meetings`,
  docs:     `${API_BASE}/api/docs`,
  payments: `${API_BASE}/api/payments`,
};
```

**Store the JWT token after login:**
```js
const res = await fetch(api.auth.login, { method: 'POST', body: JSON.stringify(creds) });
const data = await res.json();
localStorage.setItem('nexus_token', data.token);
```

**Send token with every protected request:**
```js
const token = localStorage.getItem('nexus_token');
fetch(api.meetings, {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## Contributing

This project is built as part of the Nexus internship program.

**Branch naming:**
```
feature/meeting-scheduling
fix/auth-token-expiry
chore/update-dependencies
```

**Commit format:**
```
feat(routes): add meeting conflict detection
fix(auth): handle expired JWT gracefully
chore(models): add indexes to Transaction
```

---

## Useful Links

| Resource | Link |
|---|---|
| MongoDB Atlas | https://cloud.mongodb.com |
| Stripe Dashboard | https://dashboard.stripe.com/test/apikeys |
| Stripe Test Cards | https://stripe.com/docs/testing#cards |
| JWT Debugger | https://jwt.io |
| Render Deployment | https://render.com |
| Postman Download | https://postman.com/downloads |
| Socket.IO Docs | https://socket.io/docs/v4 |

---

## License

This project is built for the Nexus internship program.