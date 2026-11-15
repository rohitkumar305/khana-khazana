# Product Requirements Document (PRD): Khana-Khajana

**Project Title:** Khana-Khajana  
**Punchline:** *"Intelligent Seating, Seamless Service — Where Classical AI Meets Culinary Hospitality."*  
**Course Alignment:** CSE276: Artificial Intelligence Foundations  
**Architecture:** Full-Stack Hybrid AI System (React + Node.js/Express + Python AI Engine + NeonDB + NVIDIA Nemotron NIM)

---

## 1. Executive Summary & Product Description

**Khana-Khajana** is an AI-powered Restaurant Table Allocation and Service Planner designed to eliminate dining room bottlenecks, optimize seating capacity, and coordinate floor staff during peak dining hours. 

Unlike traditional static reservation systems, Khana-Khajana acts as an autonomous floor manager. It formulates table allocation as a state-space search problem, enforces hospitality rules via symbolic logic, estimates table turnover under uncertainty using Bayesian inference, simulates cooperative waiter and host agents, compares symbolic AI against statistical machine learning, and provides a hallucination-free Maître D' chatbot grounded in live database state via NVIDIA Nemotron.

---

## 2. System Architecture & Real-Time Data Sync

Khana-Khajana employs a decoupled three-tier architecture with **NeonDB (Serverless PostgreSQL)** acting as the single source of truth synchronized in real time across the React frontend, Node.js/Express API gateway, and Python AI engine.

```text
+-----------------------+       WebSockets / SSE        +-----------------------+
|    React Frontend     | <===========================> |  Node.js + Express    |
|  (Live Floor Map, XAI |        REST API (JSON)        |   (API Gateway, Auth, |
|  Dashboard, Chat UI)  | ----------------------------> |   Real-Time Broker)   |
+-----------------------+                               +-----------+-----------+
                                                                    |
                                                 SQL / LISTEN-NOTIFY| (Real-Time Sync)
                                                                    v
+-----------------------+       REST / FastAPI          +-----------------------+
|   Python AI Engine    | <---------------------------> |        NeonDB         |
| (Search, KR, MAS, ML, |       psycopg / asyncpg       | (Serverless Postgres: |
|  FAISS + Nemotron)    | ----------------------------> |  Tables, Queue, Logs) |
+-----------------------+                               +-----------------------+
```

### Real-Time Synchronization Workflow (NeonDB)
1. **State Persistence:** All table statuses (`EMPTY`, `OCCUPIED`, `BILLING`, `DIRTY`), waiting queues, waiter locations, and AI decision audit logs are stored in **NeonDB**.
2. **Database Event Triggers (`LISTEN/NOTIFY`):** PostgreSQL triggers fire whenever a table status or queue entry updates in NeonDB.
3. **Node.js/Express Real-Time Broker:** Express listens to NeonDB notifications via `pg` / `@neondatabase/serverless` and pushes instant state diffs to connected **React** clients over **Socket.io / Server-Sent Events (SSE)**.
4. **Python AI Re-indexing & Simulation Sync:** Whenever floor state changes, Node.js invokes the **Python FastAPI** microservice to re-run $A^*$ table allocation, step the Multi-Agent simulation, and update the in-memory **FAISS** vector index for the NVIDIA Nemotron RAG assistant.

---

## 3. Core AI Concepts & Mathematical Formulations (CSE276 Mapping)

### 3.1 Unit I: State-Space Search & Optimization
* **Problem Formulation:**
  * **State ($S$):** Mapping of tables to parties $S = \{(T_1, P_i), (T_2, \emptyset), \dots, (T_n, P_j)\}$ plus remaining waiting queue $Q$.
  * **Initial State ($S_0$):** Current floor occupancy snapshot fetched from NeonDB.
  * **Goal State ($S_G$):** Every party in $Q$ is assigned a valid table configuration satisfying capacity, accessibility, and zone constraints.
* **Implemented Algorithms:** Breadth-First Search (BFS), Depth-First Search (DFS), Hill Climbing, and **$A^*$ Search**.
* **$A^*$ Evaluation & Heuristic Formulas:**
  $$f(n) = g(n) + h(n)$$
  * **Path Cost $g(n)$:** Cumulative expected wait time (in minutes) for already-assigned parties:
    $$g(n) = \sum_{i \in \text{Seated}} W_i$$
  * **Admissible Heuristic $h(n)$:** Penalizes wasted seat capacity and remaining unseated parties:
    $$h(n) = \sum_{(T, P) \in n} (\text{Capacity}(T) - \text{Size}(P)) + \alpha \cdot |Q_{\text{unseated}}|$$
    *(where $\alpha$ is the minimum baseline wait penalty per unseated party).*

---

### 3.2 Unit II: Knowledge Representation & Reasoning Under Uncertainty
* **Frames:** Structured schemas for `TableFrame` (`id, capacity, zone, is_accessible, status, course_stage, elapsed_mins`) and `PartyFrame` (`id, size, is_vip, needs_wheelchair, preferred_zone`).
* **Production Rules (Forward Chaining):**
  * $R_1$: `IF party.needs_wheelchair == True THEN filter(table.is_accessible == True)`
  * $R_2$: `IF party.size > 4 AND no_single_table_available THEN merge_adjacent(T_a, T_b)`
  * $R_3$: `IF party.is_vip == True AND wait_time > 10 THEN trigger_complimentary_starter()`
* **Bayesian Table Turnover Estimation:** Calculates the posterior probability that an occupied table becomes free within $\Delta t = 10$ minutes given its current dining stage $E \in \{\text{Starters}, \text{MainCourse}, \text{Dessert}, \text{Billing}\}$:
  $$P(\text{Free}_{10} \mid E) = \frac{P(E \mid \text{Free}_{10}) \cdot P(\text{Free}_{10})}{P(E)}$$
  where:
  $$P(E) = P(E \mid \text{Free}_{10})P(\text{Free}_{10}) + P(E \mid \neg\text{Free}_{10})P(\neg\text{Free}_{10})$$

---

### 3.3 Unit III: Intelligent Agents & Multi-Agent System (MAS)
* **PEAS Specification:**
  * **Performance Measure:** Minimize average guest wait time, maximize seat utilization %, zero rule violations, maximize guest satisfaction.
  * **Environment:** Partially observable, dynamic, stochastic, multi-agent restaurant floor.
  * **Actuators:** Assign table, merge tables, dispatch waiter task, update table status.
  * **Sensors:** NeonDB table occupancy state, POS billing triggers, incoming walk-in/reservation queue.
* **Agent Architectures:**
  * **Host Agent (Goal-Based):** Continuously monitors $Q$ and dispatches high-priority table clearing or seating goals.
  * **Waiter Agents (Utility-Based):** Selects the next floor action $a \in \{\text{Greet}, \text{ServeOrder}, \text{DeliverBill}, \text{ClearTable}\}$ maximizing expected utility $U(a)$:
    $$U(a) = w_1 \cdot \text{Urgency}(a) + w_2 \cdot \text{VIP\_Bonus}(a) - w_3 \cdot \text{Distance}(a)$$

---

### 3.4 Unit IV: Evolution of AI — Symbolic vs. Statistical ML Comparator
* **Symbolic Baseline:** Deterministic rule-based dining duration estimate ($D_{\text{sym}} = 45 + 5 \times \text{Size}$ minutes).
* **Statistical Machine Learning:** Supervised Regressor (Random Forest / Gradient Boosting via `scikit-learn`) trained on historical dining logs (`party_size, day_of_week, peak_hour, ordered_drinks, courses_count`) to predict dining duration $\hat{D}_{\text{ML}}$.
* **Evaluation Metric (Mean Absolute Error):**
  $$\text{MAE} = \frac{1}{N} \sum_{k=1}^{N} |D_{\text{actual}, k} - \hat{D}_k|$$

---

### 3.5 Unit V & VI: Grounded GenAI Assistant & Responsible AI (XAI)
* **RAG Architecture:** Static policies (`restaurant_policies.md`) + live NeonDB floor JSON are embedded via `sentence-transformers/all-MiniLM-L6-v2` into **FAISS**.
* **NVIDIA NIM Inference:** Queries are routed to **NVIDIA Nemotron** (`nvidia/llama-3.1-nemotron-70b-instruct`) via LangChain with `temperature = 0.1` and strict context-grounding prompts to eliminate hallucinations.
* **Explainable AI (XAI) & Fairness Audit:**
  * Every seating decision generates a human-readable trace linking $A^*$ cost, triggered rules, and Bayesian probability.
  * **Demographic/VIP Fairness Metric (Wait-Time Parity):**
    $$\Delta W_{\text{fairness}} = \left| \bar{W}_{\text{VIP}} - \bar{W}_{\text{Regular}} \right| \le \tau_{\text{max}}$$
    Ensures regular and accessibility-requiring guests do not suffer starvation when VIP parties arrive.

---

## 4. Complete Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | **React 18 (Vite)**, Tailwind CSS, Lucide Icons, Recharts / Plotly | Interactive 2D restaurant floor map, real-time queue manager, algorithm benchmark charts, XAI inspector, and Maître D' chat widget. |
| **Backend Gateway** | **Node.js**, **Express.js**, **Socket.io** | REST API orchestration, WebSocket real-time state broadcasting, and NeonDB event listener. |
| **Database** | **NeonDB** (Serverless PostgreSQL) | Stores tables, reservations, party queue, waiter states, historical dining records, and XAI audit logs. |
| **AI Microservice** | **Python 3.11+**, **FastAPI**, **Uvicorn** | Exposes endpoints for Search algorithms, Bayesian KR engine, Mesa Multi-Agent simulation, ML predictions, and RAG queries. |
| **AI / ML / GenAI** | `scikit-learn`, `mesa`, `networkx`, `faiss-cpu`, `langchain-nvidia-ai-endpoints` | Executes classical search, agent simulation, ML regression, vector retrieval, and **NVIDIA Nemotron API** inference. |

---

## 5. Project Directory Structure

```text
khana-khajana/
├── frontend/                         # React + Vite Client Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── FloorMap.jsx          # Live visual grid of tables, statuses & merged tables
│   │   │   ├── QueuePanel.jsx        # Add incoming walk-ins / VIP / wheelchair parties
│   │   │   ├── SearchBenchmark.jsx   # BFS vs DFS vs Hill Climbing vs A* comparison charts
│   │   │   ├── AgentSimView.jsx      # Real-time Host & Utility-based Waiter agent logs
│   │   │   ├── MLComparator.jsx      # Symbolic Rules vs Supervised ML MAE dashboard
│   │   │   ├── XaiFairnessModal.jsx  # Decision explainability trace & fairness audit
│   │   │   └── MaitreDChat.jsx       # Grounded NVIDIA Nemotron RAG assistant UI
│   │   ├── hooks/
│   │   │   └── useRealtimeFloor.js   # Socket.io hook syncing live NeonDB updates
│   │   └── App.jsx
│   └── package.json
│
├── backend-node/                     # Node.js + Express Real-Time API Gateway
│   ├── src/
│   │   ├── db/
│   │   │   ├── neonClient.js         # NeonDB connection pool & LISTEN/NOTIFY subscriber
│   │   │   └── schema.sql            # PostgreSQL tables, triggers & seed data
│   │   ├── routes/
│   │   │   ├── floorRoutes.js        # CRUD for tables, parties & simulation triggers
│   │   │   └── aiProxyRoutes.js      # Bridges React requests to Python FastAPI & logs to NeonDB
│   │   ├── sockets/
│   │   │   └── floorSocket.js        # Broadcasts NeonDB changes to React in real time
│   │   └── server.js
│   └── package.json
│
├── ai-engine-python/                 # Python FastAPI AI & Simulation Microservice
│   ├── app/
│   │   ├── main.py                   # FastAPI endpoints (/search, /simulate, /predict, /chat)
│   │   ├── db_sync.py                # Asyncpg connector to read/write live state in NeonDB
│   │   ├── unit1_search.py           # BFS, DFS, Hill Climbing & A* Table Search
│   │   ├── unit2_knowledge.py        # Frames, Production Rules & Bayes' Theorem engine
│   │   ├── unit3_agents.py           # PEAS Environment, Host & Utility Waiter Agents
│   │   ├── unit4_ml_compare.py       # Scikit-Learn duration predictor vs Symbolic baseline
│   │   ├── unit5_rag_nemotron.py     # FAISS + LangChain + NVIDIA Nemotron NIM integration
│   │   └── unit5_xai_fairness.py     # Decision trace builder & VIP starvation audit
│   ├── data/
│   │   ├── restaurant_policies.md    # Grounding knowledge base for RAG
│   │   └── historical_dining.csv     # Synthetic training dataset (500+ records)
│   └── requirements.txt
│
└── README.md
```

---

## 6. Core Database Schema (`NeonDB` PostgreSQL)

```sql
-- Tables on the restaurant floor
CREATE TABLE restaurant_tables (
    table_id VARCHAR(10) PRIMARY KEY,
    capacity INT NOT NULL,
    zone VARCHAR(30) NOT NULL,
    is_accessible BOOLEAN DEFAULT FALSE,
    adjacent_to VARCHAR(10),
    status VARCHAR(20) DEFAULT 'EMPTY', -- EMPTY, OCCUPIED, BILLING, DIRTY
    current_course VARCHAR(20) DEFAULT 'NONE',
    elapsed_mins INT DEFAULT 0,
    assigned_party_id INT NULL
);

-- Incoming customer parties
CREATE TABLE waiting_parties (
    party_id SERIAL PRIMARY KEY,
    party_name VARCHAR(50) NOT NULL,
    party_size INT NOT NULL,
    is_vip BOOLEAN DEFAULT FALSE,
    needs_wheelchair BOOLEAN DEFAULT FALSE,
    preferred_zone VARCHAR(30) DEFAULT 'ANY',
    wait_mins INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'WAITING' -- WAITING, SEATED, COMPLETED
);

-- XAI & Allocation Audit Logs
CREATE TABLE ai_decision_logs (
    log_id SERIAL PRIMARY KEY,
    algorithm_used VARCHAR(30),
    party_id INT,
    assigned_tables VARCHAR(50),
    heuristic_score FLOAT,
    bayesian_prob FLOAT,
    triggered_rules TEXT,
    xai_explanation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Real-Time Notification Trigger for Node.js & Python Sync
CREATE OR REPLACE FUNCTION notify_floor_change() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('floor_updates', json_build_object(
        'table', TG_TABLE_NAME,
        'action', TG_OP
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tables_sync AFTER INSERT OR UPDATE OR DELETE ON restaurant_tables
FOR EACH ROW EXECUTE FUNCTION notify_floor_change();

CREATE TRIGGER trg_parties_sync AFTER INSERT OR UPDATE OR DELETE ON waiting_parties
FOR EACH ROW EXECUTE FUNCTION notify_floor_change();
```

---

## 7. Functional Requirements & User Stories

1. **FR-01 (Live Floor & Queue Management):** Staff can add incoming parties (specifying group size, VIP status, wheelchair needs, and zone preference) in React; changes persist immediately to NeonDB and reflect across all open clients via WebSockets.
2. **FR-02 (Multi-Algorithm Search Benchmarking):** Users can click **"Optimize Seating"** to execute BFS, DFS, Hill Climbing, and $A^*$ simultaneously on the current floor state and view a side-by-side comparison of *Nodes Expanded*, *Execution Time (ms)*, and *Seat Utilization %*.
3. **FR-03 (Bayesian & Rule-Based Pre-Allocation):** When no empty table fits a party, the system evaluates Production Rules and Bayes' Theorem to pre-assign tables in the `BILLING` stage if $P(\text{Free}_{10} \mid \text{Billing}) \ge 0.75$.
4. **FR-04 (Multi-Agent Simulation Stepper):** Users can advance simulation ticks (`+1 min` or `Auto-Play`) to observe the Goal-Based Host Agent dispatching tasks and Utility-Based Waiter Agents dynamically prioritizing table clearing and order service.
5. **FR-05 (Symbolic vs. ML Duration Analysis):** The dashboard displays predicted table turnover times comparing static Symbolic formulas against the trained `scikit-learn` model alongside live MAE metrics.
6. **FR-06 (Grounded Nemotron Maître D' Chat):** Users can query natural-language questions (e.g., *"When will an accessible table for 5 be ready?"*). The Python service syncs NeonDB state into FAISS and queries NVIDIA Nemotron with strict grounding guardrails.
7. **FR-07 (XAI & Fairness Inspector):** Clicking any seated party reveals its full decision justification and displays a real-time Fairness Alert if regular guest wait times exceed the threshold relative to VIP guests.