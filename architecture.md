# AegisMeet: Architecture & System Blueprint

**AGENT DIRECTIVE:** This file is the absolute source of truth. If business logic, data schemas, or structural patterns change during development, you MUST update `architecture.md` BEFORE modifying any executable code.

## 1. System Blueprint (The North Star)
**Mission:** 
Build an air-gapped, privacy-focused AI meeting assistant. The system must automate meeting administration (summaries, task delegation) via cloud LLMs without ever leaking sensitive PII (names, organizations) to external servers.

**Core Logic:**
1. **Intake:** Headless Playwright bot captures live meeting captions.
2. **Masking (The Core):** Local FastAPI proxy detects PII via Microsoft Presidio, generates tokens (e.g., `[PERSON_1]`), and stores the mapping in ephemeral RAM.
3. **Reasoning:** Sanitized, masked text is sent to Featherless AI (Llama 3 70B) to extract actionable tasks and persona-based summaries (PM, Group, Absentee).
4. **Re-hydration & Routing:** The proxy restores real PII locally, saves tasks to a local SQLite database, and dispatches targeted summaries via Webhooks.

**Data-First Schema:**
LLM Output JSON Schema (Enforced via System Prompt):
{
  "pm_view": "string (high-level blockers/risks)",
  "group_view": "string (decisions and milestones)",
  "absent_view": "string (concise catch-up)",
  "tasks": [
    {
      "assignee": "string (tokenized, e.g., [PERSON_1])",
      "task": "string (action item description)",
      "deadline": "string"
    }
  ]
}

Ephemeral PII RAM Dictionary: 
{"[PERSON_1]": "Mayank Sachdeva", "[ORG_1]": "Acme Corp"}

## 2. Tech Stack & Frameworks
*   **Backend (Proxy Engine):** Python 3, FastAPI, Uvicorn.
*   **Frontend (UI Dashboard):** Next.js (App Router), React, Tailwind CSS, Axios.
*   **AI & NLP Pipeline:** Microsoft Presidio (Anonymizer/Analyzer), spaCy (`en_core_web_lg`), Featherless AI API.
*   **Browser Automation:** Playwright.
*   **Database:** SQLite (strictly for long-term task tracking, NO transcripts saved).
*   **External Integrations:** Discord/Slack Webhooks (Mocked enterprise communication).

## 3. System Limitations & Boundaries
*   **Zero-Leak Enforcement:** NEVER send unmasked raw text to the Featherless AI API. All external HTTP requests containing transcript data MUST pass through the Presidio masking engine first.
*   **Ephemeral State Wiping:** The PII RAM dictionary must be aggressively wiped immediately after the Webhook dispatch is complete. Do not persist identities in the SQLite database.
*   **Authentication Ban:** DO NOT implement user authentication, SSO, JWTs, or complex OAuth flows. Assume a single-tenant local execution environment for the hackathon.
*   **Edge Case Recovery:** If the LLM hallucinates or drops a bracketed token, the re-hydration loop must safely skip the missing key without crashing the FastAPI server.

## 4. Repository Map & Delegation
*   `architecture.md`: This file (The Layer 1 Source of Truth).
*   `/backend/proxy.py`: The core FastAPI application, Presidio masking logic, SQLite DB connections, and Webhook dispatch routing.
*   `/backend/bot.py`: Playwright headless DOM scraping script.
*   `/backend/tasks.db`: Local SQLite database powering the Task Tracking Dashboard.
*   `/frontend/`: Next.js workspace containing the dual-pane UI (Intercepted Cloud Payload vs. Re-hydrated Local View).

## 5. Telemetry, Audit Logs & Run Orchestration
*   `/api/audit-logs`: Exposes real-time verification logs verifying zero unmasked entity leakage in outbound cloud packets, payload character counts, and confirmation of RAM wiping.
*   `/api/webhooks/feed`: In-memory log of dispatched webhook payloads enabling live inspection on the Next.js UI when third-party endpoints are mocked.
*   `run.sh`: Unified root startup script to concurrently boot FastAPI proxy (port 8000) and Next.js frontend (port 3000).
