# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Free Fire Solo Championship management platform. Players pay R$2.00 to enter each match ("queda"), earn points and prizes based on placement/kills, and track standings on a leaderboard. An admin manages the tournament through a panel and/or an AI agent (Gemini).

**Stack:**
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- Backend: FastAPI + SQLAlchemy ORM + SQLite (dev) / PostgreSQL (production via Railway)
- AI: Google Gemini 2.5 Flash (OCR scoreboard images, natural-language admin agent)
- Payments: Cora Bank mTLS PIX API

## Commands

### Frontend
```bash
npm run dev       # dev server at http://localhost:5173
npm run build     # tsc -b && vite build → dist/
npm run lint      # eslint on all files
npm run preview   # serve dist/ locally
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

## Architecture

### Frontend (`src/`)

`App.tsx` is the single-page shell — it owns session state (`currentUser` from `localStorage`) and renders one of three tabs: `leaderboard`, `player_portal`, or `admin`. All API calls are centralised in `src/services/api.ts`.

**Authentication:** No JWT. After login the full `Jogador` object is written to `localStorage['currentUser']`. Every protected API call sends `x-user-id: <id>` as a plain header — the backend resolves the user from that ID.

**Component responsibilities:**
- `AuthPortal` — login/register form
- `PlayerPortal` — player dashboard (balance, match subscription, room info, match history)
- `AdminPanel` — admin dashboard (approve deposits, register results, OCR upload, room management, player management, AI agent chat)
- `AdminAgentChat` — chat interface to the Gemini agent endpoint
- `Leaderboard` — public standings table
- `PixDeposito` — Cora PIX QR code generation and polling

### Backend (`backend/`)

**`main.py`** is a single-file FastAPI app containing models, Pydantic schemas, route handlers, and AI agent tooling.

**Database models:** `JogadorModel`, `QuedaModel` (per-match scores), `InscricaoQuedaModel` (enrollments), `InfoSalaModel` (room ID/password), `DepositoRequisicaoModel` (pending deposits).

**Scoring engine:**
- Points = placement points (`{1:12, 2:9, 3:8, 4:7, 5:6, 6:5, 7:4, 8:3, 9:2, 10:1}`) + number of kills
- Prize money credited immediately on result registration: 1st=R$20, 2nd=R$10, 3rd=R$7, 4th=R$5, 5th–10th=R$1.50
- Leaderboard sorts by `ganhos_reais` first, then `total_pontos`, then `total_abates`

**Admin seeding:** On startup `seed_admin()` creates (if absent) the admin user with `nick=fideles` / `password=13032020`. The first registered user also gets `is_admin=True`.

**AI Agent (`POST /agente/comando`):** Uses Gemini function-calling with seven tools that write directly to the DB (create players, release rooms, register results in bulk, list players, get standings). Requires `GEMINI_API_KEY` env var.

**OCR (`POST /quedas/{n}/processar-ocr`):** Sends a screenshot of the Free Fire end-game scoreboard to Gemini 2.5 Flash and returns structured placement/kills data matched against registered player nicks (case-insensitive).

**`cora_pix.py`** is an isolated `APIRouter` mounted at `/pix`. It reads mTLS credentials from `CORA_CERT_B64` / `CORA_KEY_B64` (base64-encoded PEM), obtains OAuth2 tokens, and creates Cora v2 invoices for PIX QR codes.

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_API_URL` | Frontend | Backend base URL (falls back to `http://localhost:8000`) |
| `DATABASE_URL` | Backend | Postgres connection string (falls back to SQLite `campeonato_freefire.db`) |
| `GEMINI_API_KEY` | Backend | Google AI key for OCR and agent |
| `CORA_CLIENT_ID` | Backend | Cora Bank OAuth client ID |
| `CORA_CERT_B64` | Backend | Base64-encoded Cora mTLS certificate |
| `CORA_KEY_B64` | Backend | Base64-encoded Cora mTLS private key |
| `BACKEND_URL` | Backend | Public URL used for PIX webhook registration |

The backend also loads `.env` files automatically (checked in `.`, `backend/`, `../`, `../../`).

## Key Conventions

- **No test suite exists.** Validate backend changes via `http://localhost:8000/docs`.
- **Tailwind v4** — utility classes are configured via CSS (`src/index.css`) using `@theme` variables, not `tailwind.config.js`. Custom design tokens (e.g. `bg-body-bg`, `text-primary`, `bg-panel-bg`) are defined there.
- **Portuguese naming throughout** — variables, DB columns, API routes, and UI copy follow Brazilian Portuguese (`jogador`, `queda`, `saldo`, `abates`, `colocacao`). Match this when extending.
- **Admin guard** — backend checks `is_admin` on the resolved `JogadorModel`. Frontend also hides admin UI, but the real gate is server-side.
- **Postgres compatibility** — `DATABASE_URL` starting with `postgres://` is rewritten to `postgresql+pg8000://`. SSL hostname verification is disabled for pg8000 connections.
- **Deployment** — Frontend is deployed to Vercel (`dist/`). Backend runs on Railway via `Procfile` (`uvicorn main:app --host 0.0.0.0 --port $PORT`).
