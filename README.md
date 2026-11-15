# Khana-Khazana — Autonomous Fine-Dining & Table Allocation Platform

[![Tests](https://img.shields.io/badge/Tests-19%2F19%20Passing-059669?style=for-the-badge)](backend/engine/aiEngine.test.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-111827?style=for-the-badge&logo=typescript)](tsconfig.json)
[![Database](https://img.shields.io/badge/Database-NeonDB%20PostgreSQL-059669?style=for-the-badge&logo=postgresql)](backend/db/schema.sql)
[![LLM](https://img.shields.io/badge/Groq-openai%2Fgpt--oss--120b-DC2626?style=for-the-badge)](backend/engine/ragGrounding.ts)
[![Presentation](https://img.shields.io/badge/Presentation-7--Page%20PPT-111827?style=for-the-badge)](khana-khazana.ppt)

> **Domain:** Autonomous Dual-Portal Hospitality & AI Operations System  
> **Course Alignment:** Artificial Intelligence Foundations (**CSE276** — State-Space Search, Knowledge Rules, Bayesian Inference, Multi-Agent Systems, ML Duration Forecasting & Grounded RAG)  
> **Architecture:** Unified Customer Portal + Admin Command backed by ACID NeonDB PostgreSQL & Groq Cloud

---

## Quick Links for Evaluators & Teammates

- **Project Presentation File (7 Slides):** [`khana-khazana.ppt`](khana-khazana.ppt)
- **Interactive Web Presentation Deck:** `/deck` (7 point-to-point slides with Stage View & All-7-Cards Grid View)
- **Teacher Algorithm Scenario Walkthroughs:** `/admin/scenarios` ([`frontend/src/engine/scenarioComparison.ts`](frontend/src/engine/scenarioComparison.ts))
- **PostgreSQL Schema:** [`backend/db/schema.sql`](backend/db/schema.sql)
- **AI Core Engine & Unit Tests:** [`backend/engine/aiEngine.ts`](backend/engine/aiEngine.ts) · [`backend/engine/aiEngine.test.ts`](backend/engine/aiEngine.test.ts)

---

## 1. Project Introduction

**Khana-Khazana** (*"Where Culinary Heritage Meets Autonomous Intelligence"*) is a production-ready, dual-portal restaurant orchestration platform built to automate fine-dining seating, in-table QR ordering, kitchen ingredient protection, and multi-agent floor service.

Rather than relying on manual host stand guesswork or static spreadsheets, Khana-Khazana synchronizes guest actions (bookings, QR check-in passes, table orders, concierge Q&A) with live Admin Command telemetry across a single **NeonDB PostgreSQL** database and **Groq (`openai/gpt-oss-120b`)** grounded reasoning engine.

---

## 2. Problem Statement

Traditional high-volume restaurants suffer from four recurring operational failures:

- **Capacity Waste & Oversized Assignments:** Seating a 2-guest couple at a 6-seat VIP booth strands 67% of table capacity during peak dinner service.
- **Accessibility & Large-Group Failures:** Manual floor plans fail to isolate step-free wheelchair tables or dynamically merge adjacent 4-tops when parties of 5–8 arrive.
- **Mid-Service Kitchen Stockouts:** Guests place orders without checking real-time recipe ingredient levels, resulting in delayed dish cancellations 15 minutes into service.
- **VIP Starvation & Unfair Queue Skipping:** Ad-hoc priority overrides leave wheelchair or long-waiting regular guests stranded past fairness thresholds.

---

## 3. Project Objectives

1. **Implement & Benchmark Search Algorithms:** Compare uninformed search (**BFS**, **DFS**), greedy local search (**Hill Climbing**), and **Weighted A\*** (`f(n) = w₂·Wait + w₁·Waste`) across identical restaurant scenarios.
2. **Enforce Deterministic Hospitality Rules (`R1–R4`):** Guarantee step-free accessibility filtering, automatic table merging (`T3+T4`, `T5+T6`, `T8+T9`), complimentary VIP perks at `≥ 10m` wait, and queue fairness parity (`≤ 8.0m` delta).
3. **Predict Table Turnover Probabilistically & via ML:** Combine live **Bayesian Course Inference** (`P(Free₁₀ | Course)`) with **Gradient-Boosted ML Duration Regression** (`3.8m MAE` vs `9.4m` symbolic linear heuristics).
4. **Prevent Overselling with Atomic SQL Pantry Locks:** Validate exact gram/milligram/unit recipes inside PostgreSQL transactions before accepting QR table orders.
5. **Eliminate LLM Hallucinations:** Ground **Groq (`openai/gpt-oss-120b`)** strictly in indexed policy chunks (`POL-01..05`) and live NeonDB floor/kitchen telemetry with verbatim refusal on unverified claims.

---

## 4. Key Features

### Customer Portal
- **Smart Table Booking (`/book`):** Real-time slot overlap detection (`±90m`), future-only time validation, projected A* assignment preview, instant QR pass code generation, and reservation cancellation.
- **In-Dining QR Menu (`/table/:tableId/menu`):** Switchable across tables `T1–T10`, dynamically hydrated 8-dish menu from NeonDB, dietary/allergen tags, atomic stock verification (`409 Conflict` with safe dish substitutes if short), and live 4-stage order tracker (`Order Received → Preparing → Waiter En Route → Served`).
- **AI Concierge (`/concierge`):** Grounded Groq assistant answering seating, accessibility, operating hours, allergen, and live stock questions with explicit citations (`[restaurant_policies.md]`, `[live_floor_db]`).
- **Interactive 7-Page Presentation (`/deck`):** Point-to-point architecture deck with Slide Stage View, All-7-Cards Overview, keyboard navigation (`← / →`, `1–7`), and live interactive probes.

### Admin Command
- **Floor Command (`/admin/dashboard`):** Live SVG & grid telemetry of `T1–T10`, table status controls (`Free`, `Occupied`, `Paying`, `Dirty`), reservation cancellation, fairness parity KPIs, and **Reset Floor**.
- **AI Search & ML Lab (`/admin/algorithms`):** Real-time A* heuristic weight sliders (`w₁` Waste vs `w₂` Wait), search node benchmarks, Bayesian course curves, and Symbolic vs. ML duration comparisons.
- **Teacher Algorithm Scenarios (`/admin/scenarios`):** Worked step-by-step scenario demos (*Accessible Party of 7*, *Couple Oversized Trap*, *VIP Rush & Bayes Pre-Alloc*, *Duration Forecasting*).
- **Multi-Agent & Inventory (`/admin/agents`):** Goal-based `Host-01` + Utility-based waiters (`W1 Arjun`, `W2 Kavya`, `W3 Rohan`), custom numeric pantry stock controls, kitchen order advancement, and explainable XAI audit ledger.
- **Grounded Maître D' (`/admin/assistant`):** Live policy + NeonDB JSON RAG inspector for floor managers.

---

## 5. Technology Stack

### Frontend (`frontend/`)
- **Framework:** React 19 + TypeScript + Vite 8
- **Styling & Motion:** Tailwind CSS v4 + Motion (`motion/react`)
- **Icons:** Lucide React
- **Visuals:** Custom SVG architectural floor layouts, QR pass generator, and local culinary photography (`frontend/public/images/`)

### Backend (`backend/`)
- **Server & Serverless:** Node.js + Express 4 (`backend/server.ts` for local/full-stack, `backend/vercelHandler.ts` bundled to `api/index.js` via `esbuild` for Vercel)
- **Database:** NeonDB PostgreSQL (`pg` connection pool + SQL transactions)
- **AI Engine & Search:** TypeScript implementations of Weighted A\*, BFS/DFS/Hill Climbing comparisons, Forward-Chaining Rules `R1–R4`, Bayesian Inference, ML Regression, Multi-Agent Utility, and RAG Context Builder
- **LLM API:** Groq Cloud Chat Completions (`https://api.groq.com/openai/v1/chat/completions`, model `openai/gpt-oss-120b`, `temperature: 0.1`)
- **Testing:** Node built-in test runner via `tsx --test`

---

## 6. System Architecture

```mermaid
flowchart TD
    subgraph Frontend["Frontend — React 19 + Vite + Tailwind (/frontend)"]
        CP["Customer Portal (/, /book, /table/:id/menu, /concierge, /deck)"]
        AC["Admin Command (/admin/dashboard, /algorithms, /scenarios, /agents, /assistant)"]
        CTX["Shared RestaurantContext (HTTP Client + Error Surfacing)"]
    end

    subgraph Backend["Backend — Express API & Vercel Serverless (/backend)"]
        API["REST API Router (/api/*)"]
        WF["Workflows A & B (Slot Overlap + Atomic Stock Check)"]
        ENG["AI Engine (A*, Bayes, ML, Multi-Agent, Fairness)"]
        RAG["Grounded RAG Context Builder (POL-01..05 + Live DB)"]
    end

    subgraph External["Persistence & External Intelligence"]
        DB[("NeonDB PostgreSQL (9 ACID Tables)")]
        GROQ["Groq Cloud API (openai/gpt-oss-120b)"]
    end

    CP --> CTX
    AC --> CTX
    CTX -->|REST JSON| API
    API --> WF
    API --> ENG
    API --> RAG
    WF -->|SQL Transactions| DB
    ENG --> DB
    RAG --> DB
    RAG -->|JSON Grounded Completion| GROQ
```

---

## 7. Database Schema (`backend/db/schema.sql`)

All state is persisted transactionally across **9 PostgreSQL tables** in NeonDB:

1. **`restaurant_tables`**: Table ID (`T1–T10`), label, capacity (`2–6`), zone (`Window`, `Main Hall`, `VIP Lounge`), `is_accessible`, `is_vip_booth`, `combinable_with`, live `status` (`Free`, `Occupied`, `Paying`, `Dirty`), `current_course` (`None`, `Appetizer`, `Mains`, `Dessert`, `Billing`), `elapsed_mins`, assigned party metadata, and `active_booking_id`.
2. **`waiting_queue`**: Party ID, name, size, `is_vip`, `needs_wheelchair`, `preferred_zone`, `dietary_notes`, `wait_mins`, `status` (`WAITING`, `SEATED`), and `booking_id`.
3. **`reservations`**: `booking_id` (PK), guest contact details, `date_time` ISO slot, `party_size`, accessibility/VIP flags, `status` (`CONFIRMED`, `CHECKED_IN`, `SEATED`, `COMPLETED`, `CANCELLED`), `assigned_table_ids` (`JSONB`), `qr_pass_code`, `triggered_rules`, `bayesian_confidence_pct`, and `f_score`.
4. **`ingredients`**: 10 tracked kitchen items (`Black Truffle Shavings`, `Fresh Malai Paneer`, `Roasted Malabar Cashews`, `Kashmiri Saffron Strands`, etc.) with `unit` (`g`, `mg`, `ml`, `pcs`), non-negative `stock`, and `par_level`.
5. **`menu_dishes`**: 8 unified culinary dishes with category, price (`₹240–₹590`), `prep_mins`, `dietary_tags`, `recipe` gram/unit mapping (`JSONB`), and `substitute_dish_ids`.
6. **`kitchen_orders`**: `order_id` (PK), `table_id` (FK), `booking_id`, itemized `items` (`JSONB`), `total_amount`, `prep_time_mins`, 4-stage `status` (`Order Received`, `Preparing`, `Waiter En Route`, `Served`), and `dispatched_agent_id`.
7. **`waiter_agents`**: Staff roster (`W1 · Arjun`, `W2 · Kavya`, `W3 · Rohan`, `Host-01 · Concierge`), zone, `current_action`, `target_table_id`, `energy_pct`, `utility_score`, `utility_breakdown`, and `tasks_completed`.
8. **`agent_events`**: Timestamped live execution ticks and dispatch logs synced on check-ins, orders, and simulation steps.
9. **`xai_audit_logs`**: Auditable decision history storing party size, assigned tables, algorithm name, `f_score`, `bayesian_prob`, triggered rules, and human-readable justification.

---

## 8. AI Search Algorithms & Mathematical Models

### Weighted A\* Cost Function
Evaluates candidate single or merged table configurations $n$:

$$f(n) = w_2 \cdot \text{ExpectedWait}(n) + w_1 \cdot \text{WastedSeats}(n) + \text{ZonePenalty}(n) + \text{MergePenalty}(n)$$

- **BFS & DFS Benchmarks:** BFS pops first capacity-valid options (often wasting seats across wrong zones); DFS plunges down unpruned branches; Hill Climbing stalls in greedy local optima when single tables max out below party size or short waits yield higher utilization.
- **Weighted A\* Optimality:** Admissibly balances seat waste and guest wait delay while honoring forward-chaining rules:
  - **Rule R1 (Accessibility):** Filters candidates strictly to `isAccessible == true` (`T2, T3, T4, T7, T9, T10`) for wheelchair parties.
  - **Rule R2 (Combinable Merge):** Dynamically pairs adjacent tables (`T3+T4`, `T5+T6`, `T8+T9`) when single tables cannot fit the party.
  - **Rule R3 / R4 (VIP & Fairness Guardrail):** Awards complimentary starters at `≥ 10m` VIP wait while enforcing $|\text{avg}(W_{\text{VIP}}) - \text{avg}(W_{\text{Reg}})| \le 8.0\text{ min}$.

### Bayesian Turnover & ML Duration Forecasting
Updates release probability within 10 minutes from observed course evidence $E$:

$$P(\text{Free}_{10} \mid E) = \frac{P(E \mid \text{Free}_{10}) \cdot P(\text{Free}_{10})}{P(E)}$$

Tables in `Billing` cross the **75% pre-allocation threshold** (`88%+`), unlocking seamless turnaround scheduling. Multi-feature ML duration modeling corrects linear symbolic heuristics (`D = 45 + 5 × Size`, `9.4m MAE`) down to **`3.8m MAE`** by accounting for weekend peaks, dining zone, and drink orders.

---

## 9. Multi-Agent Architecture

- **`Host-01` (Goal-Based Agent):** Executes slot conflict validation, A\* check-in seat matching, and `+30 min` alternative slot recovery.
- **`W1–W3` (Utility-Based Waiters):** Score floor service assignments per zone using:

$$U(a) = \text{Urgency} + \text{VIPBonus} - \text{DistancePenalty} - \text{LoadPenalty}$$

- **Atomic Inventory Coordination:** QR dish submissions lock inventory inside SQL transactions (`UPDATE ingredients SET stock = stock - $amount WHERE id = $1 AND stock >= $amount`), committing kitchen tickets only if every ingredient succeeds or rolling back cleanly with `409 Conflict`.

---

## 10. Grounded RAG Architecture (`backend/engine/ragGrounding.ts`)

1. **Static Knowledge Chunks (`POL-01` to `POL-05`):** Operating hours (`11:30 AM – 11:30 PM`), zones (`Window`, `Main Hall`, `VIP Lounge`), wheelchair & merge rules, verified menu allergens, and facility boundaries.
2. **Real-Time Floor Injection:** Injects live `T1–T10` occupancy, active queue, full 8-dish catalog, and exact gram/unit pantry stock levels into every request.
3. **Strict Hallucination Guardrail:** Prompts **Groq (`openai/gpt-oss-120b`, temperature `0.1`, JSON output)** to answer solely from verified context or return verbatim:
   > *"I cannot verify that information from our current restaurant knowledge base or live floor data."*

---

## 11. REST API Reference (`backend/app.ts`)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Verifies NeonDB connectivity, latency, and Groq API configuration |
| `/api/floor/state` | `GET` | Hydrates complete snapshot (tables, queue, reservations, menu, pantry, orders, agents, logs) |
| `/api/bookings/validate` | `POST` | Validates future slot + `±90m` conflicts; locks table(s) & writes booking + XAI log in NeonDB |
| `/api/reservations/:bookingId/cancel` | `POST` | Cancels active booking and frees any held queue/table assignments |
| `/api/bookings/check-in` | `POST` | Runs A\* allocation on guest arrival and marks tables `Occupied` |
| `/api/orders/validate-ingredients` | `POST` | Atomic SQL stock verification & deduction, kitchen ticket creation, and waiter dispatch |
| `/api/orders/:orderId/advance` | `PATCH` | Advances ticket through `Order Received → Preparing → Waiter En Route → Served` |
| `/api/ingredients/:id` | `PATCH` | Updates pantry stock count directly in PostgreSQL |
| `/api/tables/:id` | `PATCH` | Updates table status/course and completes linked bookings when freed |
| `/api/simulation/tick` | `POST` | Steps multi-agent discrete simulation, advances courses/orders, and persists step |
| `/api/floor/reset` | `POST` | Resets operational tables cleanly (`10 Free` tables, `8` dishes, `10` pantry items) |
| `/api/ai/allocate-table` | `POST` | Standalone weighted A\* table evaluation endpoint |
| `/api/groq/chat` · `/api/maitre-d` | `POST` | Grounded Groq `openai/gpt-oss-120b` RAG endpoint |

---

## 12. Environment Configuration

Copy `.env.example` to `.env` in the repository root and configure your keys:

```env
# Required: NeonDB PostgreSQL connection string
DATABASE_URL="postgresql://neondb_owner:PASSWORD@HOST/neondb?sslmode=require&channel_binding=require"

# Required for AI Concierge & Grounded Maître D'
GROQ_API_KEY="YOUR_GROQ_API_KEY"

# Optional: Leave empty when frontend and backend share the same origin
VITE_API_BASE_URL=""
```

---

## 13. Running Locally & Production Deployment

### Install Dependencies
```bash
npm install
```

### Run Development Server (Unified Frontend + Backend on Port `3000`)
```bash
npm run dev
```
Access the app at `http://localhost:3000`.

### Build for Production (Vite Client + Vercel Serverless `api/index.js`)
```bash
npm run build
```

### Type-Check
```bash
npm run lint
```

### Vercel Deployment Notes
- Set `DATABASE_URL` and `GROQ_API_KEY` in **Vercel → Settings → Environment Variables**.
- `vercel.json` automatically routes `/api/*` requests to the bundled serverless function `api/index.js` while serving static dish photography from `/images/*` and the SPA bundle from `dist/`.

---

## 14. Running Automated Tests

Execute all **19 unit tests** covering A\* rules (`R1–R4`), Bayesian turnover, Workflows A & B, atomic stock deductions, floor map helpers, teacher scenarios, RAG grounding, and the 7-slide presentation deck:

```bash
npm test
```
*(Runs `tsx --test backend/engine/aiEngine.test.ts` — and you can include `frontend/src/data/presentationSlides.test.ts` via `npx tsx --test backend/engine/aiEngine.test.ts frontend/src/data/presentationSlides.test.ts`.)*

---

## 15. Future Scope

- Direct **Email / SMS Webhook Dispatch** (Resend / Twilio) for external reservation QR confirmation delivery.
- **Kitchen Display System (KDS) Hardware Sync** via WebSockets or Server-Sent Events for multi-station kitchen monitors.
- **Reinforcement Learning Waiter Routing** trained on live historical turnaround and order prep logs.
- **Interactive 3D WebGL Dining Floor Twin** synced directly to real-time NeonDB seat states.
