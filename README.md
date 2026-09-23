# DeepEval-Based LLM & RAG Evaluation Framework

**A full-stack evaluation platform that scores LLM and RAG outputs on faithfulness, relevancy, bias, toxicity, PII leakage, and hallucination — with an LLM-as-judge for custom criteria and an LLM that generates its own test data.**

React UI → Express API gateway → Python/FastAPI DeepEval microservice → Groq / OpenAI.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&labelColor=20232a)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![DeepEval](https://img.shields.io/badge/DeepEval-4.x-6E56CF)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)

---

## Table of Contents

1. [🎯 What is this?](#-what-is-this)
2. [✨ Key Features](#-key-features)
3. [🏗️ Architecture](#️-architecture)
4. [🔄 How it works](#-how-it-works)
5. [🤖 Where GenAI is used](#-where-genai-is-used)
6. [🧪 Test Case Generation](#-test-case-generation)
7. [📊 Example](#-example)
8. [📤 Export Options](#-export-options)
9. [🛠️ Tech Stack](#️-tech-stack)
10. [🚀 Getting Started](#-getting-started)
11. [📁 Project Structure](#-project-structure)
12. [🔐 Security / LLM Safety](#-security--llm-safety)
13. [🔮 Future Enhancements](#-future-enhancements)

---

## 🎯 What is this?

Shipping an LLM or RAG feature is easy. Knowing whether its answers are actually **faithful to the source data, relevant, unbiased, and safe** is the hard part. This project is a self-hosted evaluation framework built on top of [DeepEval](https://github.com/confident-ai/deepeval) that lets a team:

- Score a single LLM/RAG response against 9 built-in quality & safety metrics.
- Batch-evaluate hundreds of rows from an Excel dataset in one pass and export a shareable report.
- Score multi-turn conversations, not just single Q&A pairs.
- Define their own scoring criteria in plain English (no metric code required) via LLM-as-judge (G-Eval).
- **Generate synthetic test data automatically** from raw source documents instead of hand-writing test cases.

It's built as three independently runnable services — a React frontend, an Express API gateway, and a Python evaluation microservice — so the DeepEval/LLM logic stays isolated from the UI and API layer.

## ✨ Key Features

| Module | What it does |
|---|---|
| 📊 **Single Evaluation** | Run one or more of 9 DeepEval metrics against a single query/output/context and see the score, pass/fail verdict, and the model's reasoning. |
| 📁 **Batch Evaluation** | Upload an Excel file, pick a metric per row (or let it default), evaluate every row, and export the results as an HTML or Excel report. |
| 💬 **Multi-Turn Evaluation** | Build a multi-turn conversation and score it with conversational DeepEval metrics (e.g. conversation completeness). |
| ✨ **Golden Dataset Generator** | Paste in raw source documents and let an LLM synthesize query / expected-answer / context test cases — no manual test-writing. |
| 🧩 **Custom Metrics (G-Eval)** | Define your own evaluation criteria in natural language (e.g. "correctness", "fairness") and let an LLM judge outputs against it, with a tunable pass threshold. |
| 🛡️ **Built-in Safety Metrics** | PII leakage, bias, toxicity, and hallucination detection are first-class metrics — the evaluation itself is the safety tooling. |
| 📤 **Report Export** | Every batch run can be exported as a styled HTML report (with charts) or a multi-sheet Excel workbook. |
| 🎛️ **Feature Flags** | Every module (single-turn, multi-turn, custom metrics, batch eval, golden dataset) can be toggled on/off per environment, and individual metrics can be disabled server-side. |

## 🏗️ Architecture

```
┌──────────────────────┐      ┌───────────────────────┐      ┌──────────────────────────┐      ┌───────────────┐
│  Frontend             │      │  Backend               │      │  DeepEval Service         │      │  LLM Provider  │
│  React + Vite         │ ───► │  Express + TypeScript   │ ───► │  FastAPI + Python + DeepEval│ ───► │  Groq / OpenAI │
│  :5174                │      │  :3001 (PORT)          │      │  :8000                    │      │                │
└──────────────────────┘      └───────────────────────┘      └──────────────────────────┘      └───────────────┘
```

- **Frontend** — a tab-based SPA (5 tabs, one per feature above), gated by feature flags fetched from the backend at load time.
- **Backend** — a stateless API gateway. It validates requests, parses/generates Excel files, builds HTML/Excel reports, and proxies every evaluation call to the Python service. It never talks to Groq/OpenAI directly, so LLM API keys never need to live in Node.
- **DeepEval Service** — the only layer that imports `deepeval` and calls an LLM. It owns metric construction, scoring, custom G-Eval, and synthetic test-case generation.

## 🔄 How it works

Single evaluation request, end to end:

1. User fills out a form (metric, query, output, context, expected output) in the React app.
2. Client-side validation checks the fields required for the chosen metric before it's even sent.
3. The frontend POSTs to the Express backend's `/api/eval-only`.
4. Express re-validates, then forwards the request to the DeepEval FastAPI service.
5. FastAPI selects a Groq or OpenAI model, builds a DeepEval `LLMTestCase`, and runs the requested `deepeval.metrics.*` metric(s).
6. The score, verdict, and explanation flow back up through Express to the UI.

Scoring uses a **hybrid strictness approach** rather than raw LLM output: metrics run with DeepEval's natural LLM judgment (`strict_mode=False`), then get custom post-processing on top — e.g. faithfulness scores are capped if the answer mentions entities absent from the source context, and answer-relevancy checks enforce definitional language for "What is X?" style questions. This keeps scores explainable while reducing false positives from an overly lenient judge.

Batch and multi-turn evaluation follow the same backend → DeepEval mechanics, just with a different payload shape (a parsed Excel dataset, or an ordered list of conversation turns).

## 🤖 Where GenAI is used

This project uses an LLM (Groq or OpenAI) in **three distinct roles**, not just one:

1. **LLM-as-judge for built-in metrics** — Faithfulness, Answer Relevancy, Contextual Precision/Recall, PII Leakage, Bias, Toxicity, and Hallucination are all evaluated by prompting an LLM to reason step-by-step about the response and return a score + explanation (DeepEval's standard approach), not by classic NLP heuristics.
2. **LLM-as-judge for custom criteria (G-Eval)** — the Custom Metrics module lets a user write their own natural-language grading criteria (e.g. "penalize any answer that omits a required disclaimer"). Under the hood this drives DeepEval's `GEval` metric, a chain-of-thought LLM judge scored against user-defined evaluation steps.
3. **LLM-as-generator for synthetic test data** — the Golden Dataset Generator feeds raw source documents into DeepEval's `Synthesizer`, which uses an LLM to *author* new query / expected-answer / context triples grounded in that source text — the reverse of judging: here the LLM produces the eval inputs, not the verdict.

## 🧪 Test Case Generation

Building a good eval dataset by hand is slow. The **Golden Dataset Generator** closes that gap:

1. Paste one or more source documents (policy text, knowledge-base articles, product docs, etc.) into the UI.
2. Choose how many "goldens" (test cases) to generate per document.
3. The backend calls DeepEval's `Synthesizer.generate_goldens_from_contexts()`, which uses the configured LLM to synthesize realistic queries and expected answers grounded in each document.
4. The result — `query`, `expected_output`, `context` — is downloadable as an Excel file, pre-formatted with the exact columns the Batch Evaluation module expects (plus blank `output` and `Metrics` columns).
5. Fill in the `output` column with your system's real responses (and optionally a metric per row), then re-upload that same file straight into **Batch Evaluation**.

This turns "write test cases → run the system → grade it" into a generate → run → upload → grade loop, instead of a fully manual dataset-authoring exercise. Two ready-made sample datasets are included in [`datasets/`](datasets/) if you want to try Batch Evaluation without generating your own.

## 📊 Example

Single evaluation via the API directly:

```bash
curl -X POST http://localhost:3001/api/eval-only \
  -H "Content-Type: application/json" \
  -d '{
    "metric": "faithfulness",
    "query": "What is Salesforce?",
    "output": "Salesforce is a cloud CRM platform",
    "context": ["Salesforce is a customer relationship management cloud platform"],
    "provider": "groq"
  }'
```

```json
{
  "metric": "faithfulness",
  "score": 0.85,
  "verdict": "FAITHFUL",
  "explanation": "The claim is directly supported by the provided context...",
  "output": "Salesforce is a cloud CRM platform",
  "query": "What is Salesforce?",
  "context": ["Salesforce is a customer relationship management cloud platform"]
}
```

A full, importable request collection for every endpoint (single, batch, multi-turn, custom metrics, golden dataset) is included at [`Testleaf LLM Evaluation Framework - Full API Collection.postman_collection.json`](<Testleaf LLM Evaluation Framework - Full API Collection.postman_collection.json>) — import it into Postman to try the API without writing any code.

## 📤 Export Options

| Output | From | Format |
|---|---|---|
| Single-metric result | Single Evaluation tab | On-screen score, verdict, explanation |
| Batch report | Batch Evaluation → Generate Report | Styled **HTML** report with charts, and/or a multi-sheet **Excel** workbook (Summary, Results, Data) |
| Golden dataset | Golden Dataset Generator | **Excel** file pre-formatted for direct re-upload into Batch Evaluation |

## 🛠️ Tech Stack

**Frontend** — React 18, TypeScript 5, Vite 5, Axios, SheetJS (`xlsx`) for client-side Excel export.

**Backend** — Node.js, Express 4, TypeScript 5 (ESM), Multer (file upload), ExcelJS + SheetJS (report generation), Axios (proxying to the DeepEval service).

**DeepEval Service** — Python 3.10+, FastAPI 0.115, Uvicorn, Pydantic 2, [`deepeval`](https://github.com/confident-ai/deepeval) ≥4.0.7 (metrics, `GEval`, `Synthesizer`, `ConversationalTestCase`).

**LLM Providers** — Groq (Llama, Mixtral, Gemma, Qwen models, via an OpenAI-SDK-compatible wrapper) and OpenAI (GPT models), selected per-environment via `EVAL_MODEL`.

## 🚀 Getting Started

Requires Node.js, Python 3.10+, and an API key for Groq and/or OpenAI.

```bash
# 1. Install JS dependencies (frontend + backend)
npm run setup:workspaces

# 2. Install Python dependencies for the DeepEval sidecar
cd llm-eval-providers && pip install -r requirements.txt && cd ..

# 3. Configure environment variables (see below), then start all three services:

# Terminal 1 — DeepEval service (port 8000)
cd llm-eval-providers
python deepeval_server.py

# Terminal 2 — Backend API (port from PORT, default 3001)
cd backend
npm run dev

# Terminal 3 — Frontend (Vite dev server, port 5174)
cd frontend
npm run dev
```

Interactive DeepEval API docs (Swagger UI) are available at `http://localhost:8000/docs` once the sidecar is running.

<details>
<summary><strong>Environment variables</strong></summary>

Populate a `.env` at the repo root (read by the backend) and `llm-eval-providers/.env` (read by the Python sidecar).

**Root `.env` (backend):**

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | Controls stack-trace exposure in error responses |
| `DEEPEVAL_URL` | `http://localhost:8000/eval` | DeepEval service base URL for single-turn eval (and its siblings: `DEEPEVAL_MULTITURN_URL`, `DEEPEVAL_GENERATE_GOLDENS_URL`, `DEEPEVAL_CUSTOM_GEVAL_URL`, etc.) |
| `ENABLE_SINGLE_TURN` / `ENABLE_MULTI_TURN` / `ENABLE_CUSTOM_METRICS` / `ENABLE_BATCH_EVAL` / `ENABLE_GOLDEN_DATASET` | `true` | Per-module feature flags — set to `false` to disable a tab/endpoint entirely |
| `DISABLED_METRICS` | — | Comma-separated metric names to hide and reject (e.g. `bias,pii_leakage`) |

**`llm-eval-providers/.env` (DeepEval sidecar):**

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | DeepEval service port |
| `EVAL_MODEL` | `llama-3.3-70b-versatile` | Model name — determines Groq vs OpenAI routing |
| `GROQ_API_KEY` / `OPENAI_API_KEY` | — | API key for the selected provider |
| `IDK_HANDLING` | `count` | `yes` / `no` / `count` — how ambiguous faithfulness claims are scored |
| `LOG_DIR` / `LOG_LEVEL` / `LOG_RETENTION_HOURS` | `logs` / `INFO` / `168` | Hourly log file rotation |
| `*_THRESHOLD`, `*_VERDICT_HIGH`, `*_VERDICT_LOW` | metric-specific hardcoded defaults | Per-metric pass/fail thresholds and verdict-band cutoffs (all overridable without touching code) |
| `CUSTOM_GEVAL_<NAME>_CRITERIA` / `_EVALUATION_PARAMS` / `_THRESHOLD` / `_VERDICT_HIGH` / `_VERDICT_LOW` | preset-specific | Configure or add Custom G-Eval presets (ships with `correctness` and `fairness`) purely via env vars |

</details>

<details>
<summary><strong>API reference (summary)</strong></summary>

**Backend (Express, `/api`)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/health`, `/api/status`, `/api/health` | Health/status checks and feature-flag map |
| GET | `/api/config/metrics` | List enabled single/multi-turn metrics |
| POST | `/api/eval-only` | Single-turn evaluation (or `metric: "all"`) |
| POST | `/api/eval-multiturn` | Multi-turn conversation evaluation |
| GET | `/api/custom-metrics`, `/api/custom-metrics/config` | List/inspect Custom G-Eval presets |
| POST | `/api/custom-metrics/geval` | Run a Custom G-Eval evaluation |
| POST | `/api/batch/generate-goldens` | Synthesize a golden dataset from source documents |
| POST | `/api/batch/upload-excel` | Upload and parse an `.xlsx`/`.xls` dataset |
| POST | `/api/batch/evaluate` | Evaluate every row of a dataset |
| POST | `/api/batch/generate-report` | Export batch results as HTML/Excel |

**DeepEval Service (FastAPI, port 8000)**

| Method | Path | Purpose |
|---|---|---|
| POST | `/eval` | Single-turn metric scoring |
| POST | `/eval/multiturn` | Conversational metric scoring |
| POST | `/custom-metrics/geval` | G-Eval scoring against custom criteria |
| POST | `/generate-goldens` | LLM-driven synthetic test-case generation |
| GET | `/metrics`, `/health` | Supported metrics list, health check |

</details>

## 📁 Project Structure

```
.
├── package.json                          # Root workspace scripts
├── .env                                  # Root env (PORT for the backend)
├── datasets/                             # Sample .xlsx datasets for demoing Batch Evaluation
├── *.postman_collection.json             # Importable Postman collections covering every endpoint
│
├── backend/                              # Express + TypeScript API gateway
│   └── src/
│       ├── index.ts                      # App bootstrap, /health, /api/status, error handling
│       ├── config/env.ts                 # Env vars, feature flags, disabled-metrics list
│       ├── routes/
│       │   ├── evalRoutes.ts             # Single/multi-turn/batch/golden-dataset routes
│       │   └── customMetricsRoutes.ts    # Custom G-Eval routes (kept separate by design)
│       └── services/
│           ├── evalClient.ts             # Proxies evaluation requests to the DeepEval service
│           ├── excelService.ts           # Parses uploaded .xlsx/.xls files
│           └── reportService.ts          # Generates HTML / Excel evaluation reports
│
├── frontend/                             # React + TypeScript + Vite SPA
│   └── src/
│       ├── App.tsx                       # Feature-flag-driven tab switcher
│       ├── pages/                        # LLMEvalPage, BatchEvalPage, MultiTurnEvalPage,
│       │                                 #   GoldenDatasetPage, CustomMetricsPage
│       ├── components/
│       │   ├── LLMEval/                  # Single-evaluation form, response panel, validation
│       │   ├── BatchEval/                # Excel upload, preview, metric selector, results,
│       │   │                             #   report generator, GoldenDatasetGenerator
│       │   ├── MultiTurnEval/            # Conversation builder + results panel
│       │   └── CustomMetrics/            # G-Eval criteria/threshold editor
│       └── services/                     # Axios API clients
│
└── llm-eval-providers/                   # Python DeepEval sidecar
    ├── deepeval_server.py                # FastAPI app: all metrics, G-Eval, Synthesizer, multi-turn
    ├── requirements.txt
    └── .env                              # EVAL_MODEL, API keys, thresholds, G-Eval presets
```

## 🔐 Security / LLM Safety

This is a self-hosted evaluation tool, and its security posture reflects that — worth being upfront about for anyone extending it:

- **PII, bias, toxicity, and hallucination detection are first-class metrics** — the app's actual "LLM safety" value is letting you *measure* whether a model's output leaks PII, is biased, is toxic, or hallucinates, rather than acting as an infrastructure-level content filter.
- **API keys never reach the browser.** The frontend only ever talks to the Express backend; only the Python DeepEval service holds `GROQ_API_KEY`/`OPENAI_API_KEY`, read server-side from `.env`.
- **Feature flags act as coarse access control** — each module (single-turn, multi-turn, custom metrics, batch eval, golden dataset) can be disabled per environment, and individual metrics can be hidden/rejected via `DISABLED_METRICS`.
- **Upload hardening** — the batch-upload endpoint restricts file types to `.xlsx`/`.xls` via Multer's file filter, and deletes the temp file after parsing regardless of success or failure.
- **What's missing today**: no request authentication, no rate limiting, and CORS is wide open (no origin allowlist). This is fine for local/internal use but would need to be closed off before exposing the service beyond a trusted network — see Future Enhancements.

## 🔮 Future Enhancements

- API authentication (API keys or SSO) and rate limiting on the Express gateway.
- CORS origin allowlist instead of the current open policy.
- Additional multi-turn metrics — the registry already supports adding more (conversation relevancy, knowledge retention, role adherence); only `conversation_completeness` is wired up today.
- Automated test suite for the backend, frontend, and DeepEval service (none currently exists).
- Wire the per-request `provider` field through end-to-end so provider selection isn't solely driven by the sidecar's `EVAL_MODEL` env var.
- CI pipeline to lint/build/test all three services on push.
