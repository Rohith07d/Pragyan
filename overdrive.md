# AegisMeet

## 1. Team Details

**Team Name / ID:** Overdrive

**Team Lead:** Mayank Sachdeva

**Team Members:**

- Mayank Sachdeva |
- D Rohith | 
- Bachu Sai Sanjeet |
- Sambhav Chordia | 
- R.Pranav sai | 

**Repo Link (Optional): https://github.com/Rohith07d/Pragyan

**Demo Link (Optional): https://drive.google.com/drive/folders/1RnLTbnke1aCWC6nG3ZB52pnDoeopTC4v?usp=sharing

---

## 2. Problem Statement

The AI Co-worker
Problem Statement
People spend a significant amount of time on repetitive tasks that happen around their everyday work.
Meetings are a common example. A discussion may contain important decisions, tasks, deadlines, and responsibilities, but turning that conversation into something actionable often requires additional manual effort.
After a meeting, someone may need to:
Understand and summarize what was discussed
Identify the key decisions
Determine what needs to be done next
Identify who is responsible for each task
Track deadlines and commitments
Communicate the outcomes to others
Prepare follow-up or status updates
As the number of meetings and tasks increases, this administrative work can become time-consuming and information can easily be missed.
Challenge
Design and build an AI-powered co-worker that can reduce repetitive work and help people turn everyday information into meaningful actions.
Teams are free to decide what tasks their AI co-worker should perform and how it should perform them.
How you solve the problem is up to you.

---

## 3. TL;DR

**Problem:** Enterprises ban AI bots due to privacy risks, leaving teams with manual notes and lost task delegation.

**Solution:** Local proxy masks PII, extracts tasks via cloud LLM, generates personalized views, and routes to webhooks/SQLite.

**Who benefits:** PMs (risk views), individuals (task delegation), and absent employees (catch-up summaries) in secure teams.

---

## 4. Scope of the Project

**What are you building?**

We are building an air-gapped meeting assistant. A local Python proxy masks PII before sending text to Featherless AI. The LLM extracts tasks and generates personalized views (PM, group, absentee). The proxy re-hydrates data locally, saves tasks to an SQLite dashboard, and routes role-specific summaries via webhook.

**How does it solve the problem statement?**

It fully automates administrative overhead—delegating responsibilities, tracking deadlines, and crafting personalized follow-ups for different stakeholders—while actively solving the data privacy barriers that prevent enterprises from adopting AI.

**Key features you're building for this hackathon:**

- Headless Playwright bot for automated meeting caption extraction.
- Local Presidio proxy that masks PII into unique tokens before cloud reasoning.
- Persona-based prompt engineering to extract PM, group, and absentee summaries.
- Local SQLite database powering a Task Tracking Dashboard for extracted actions.
- Automated webhook dispatch to push personalized delegated tasks to group chats.

**What are you deliberately NOT doing? (Optional)**

We are deliberately skipping user authentication (SSO) and Google Calendar integrations to focus entirely on the core zero-leak privacy engine and task extraction.

---

## 5. Why an Agentic Approach?

**What does your agent decide or do on its own?**

The intake agent navigates meeting lobbies to stream text. The reasoning agent autonomously structures different summary versions (risks vs. general minutes) of the exact same facts based on audience. The proxy agent then independently routes these personalized insights to the correct webhook channels and SQLite tables.

**Why wouldn't a fixed script, if-else rules, or a simple chatbot be enough?**

Spoken dialogue is chaotic. Rule-based scripts cannot isolate tasks, map pronouns to deadlines, or re-write the same meeting facts into a high-level PM summary versus a granular absentee catch-up. A chatbot requires manual prompting and copy-pasting, which increases administrative work rather than reducing it.

---

## 6. Who It's For & What Changes

**Who or what is this for?**

Regulated enterprise teams, project managers, and absent employees seeking automated, persona-specific meeting intelligence.

**The world today, without your solution:**

Teams either ban AI summarizers—forcing staff into hours of manual note-taking and chasing action items—or rogue employees upload unredacted company trade secrets to public third-party servers. When meetings end, absent employees are left reading irrelevant, overly dense transcripts instead of targeted catch-ups.

**The world with your solution, fully built and scaled to production:**

Enterprises deploy autonomous local bots across all internal meetings. Every employee receives precise, personalized summaries and tracked action items directly to their communication apps. Legal teams guarantee that zero proprietary project names or client identities ever leave the local network.

**What your hackathon build actually delivers today:**

A working prototype: Playwright captures captions, Presidio masks PII locally, Featherless AI generates PM/Group/Absentee views and extracts tasks. The proxy re-hydrates names, saves tasks to a local SQLite dashboard, and fires the personalized summaries to a webhook mimicking a company group chat.

**Before vs. After**

| What Changes | Today | With Our Current Build | At Production Scale |
|--------------|-------|------------------------|---------------------|
| Meeting Intake | Manual notes or paid bot | Local headless bot captures text | Distributed background bot fleet |
| Task Tracking | Manual spreadsheets | Local SQLite Task Dashboard | 2-way sync with Jira/Asana APIs |
| Communication | One generic email sent to all | Persona-based (PM/Absentee) generation | Direct Teams 1:1 API integration |
| Data Privacy | Sent raw to cloud APIs | Masked locally before cloud call | Fully zero-leak verified on-prem |

---

## 7. Architecture & Agents

**How is your system put together?**

Playwright streams captions to a local FastAPI backend. Presidio swaps sensitive entities for memory-mapped tokens. Sanitized text hits Featherless AI to generate multiple persona views and task lists. The proxy re-hydrates the JSON locally, persists tasks in SQLite, and dispatches views to Next.js and Discord/Slack webhooks.

### 7.1 Agents

- **Intake Agent:** Joins Google Meet calls headlessly and streams live caption text. Uses Playwright automation without an LLM to remain fast and deterministic. Talks to Google Meet DOM and Local Proxy API.
- **Privacy Proxy Agent:** Scans transcripts for PII, builds RAM token maps, and handles bidirectional redaction and re-hydration. Uses Microsoft Presidio with spaCy en_core_web_lg for fast local NER. Talks to Intake, LLM, Webhooks, and SQLite.
- **Reasoning Agent:** Analyzes sanitized transcripts to generate structured PM risks, absentee catch-ups, and individual task delegations. Uses Meta-Llama-3-70B-Instruct on Featherless AI. Talks to Local Proxy API.

### 7.2 Services, APIs, Databases & Memory

- **Featherless AI API (external service):** Serverless OpenAI-compatible endpoint providing access to open-weight LLMs. Used by Reasoning Agent.
- **Local Proxy Server (FastAPI service):** Orchestrates intake, masking logic, and routing. Used by Next.js Dashboard.
- **Local SQLite Database (database):** Persists re-hydrated action items to power the Task Tracking Dashboard across meetings. Used by Local Proxy Server.
- **Discord/Slack Webhook (API, mocked):** Simulates a company WhatsApp/Teams group to receive absentee and task summaries. Used by Local Proxy Server.

**How does your system remember things (memory & state)?**

PII token maps (`{PERSON_1: Mayank}`) are strictly ephemeral in RAM and wiped after the meeting. Action items are persisted long-term in local SQLite for the Task Dashboard, ensuring ongoing tracking without retaining the raw meeting transcripts.

### 7.3 Example Walkthrough

**Example input:** Google Meet transcript: "Mayank noted the API risk. Sambhav agreed to build the UI by tomorrow."

1. Intake Agent captures live captions and posts raw text to the local proxy (uses: Playwright).
2. Privacy Proxy Agent maps Mayank and Sambhav to {PERSON_1} and {PERSON_2} in local RAM (uses: Presidio).
3. Privacy Proxy Agent sends masked text to cloud reasoning API.
4. Reasoning Agent generates a PM Risk View ({PERSON_1} noted API risk) and Task Array ({PERSON_2} build UI) (uses: Featherless AI).
5. Privacy Proxy Agent re-hydrates tokens locally, restoring Mayank and Sambhav into the JSON outputs.
6. Privacy Proxy Agent saves Sambhav's task and deadline to the persistent Task Tracking Dashboard (uses: SQLite).
7. Privacy Proxy Agent dispatches the PM view and Task list to the simulated company group chat (uses: Webhook).

**Final output:** Persona-specific summaries and delegated tasks distributed via webhook, with action items logged in the local dashboard.

**Anything special about how your workflow runs? (Optional)**

The reasoning agent is prompted to output a strict JSON schema containing separate keys for `pm_view`, `absent_view`, `group_view`, and `tasks`. This allows the local Python proxy to easily parse the single response and route different text strings to entirely different Webhooks/UI components simultaneously.

---

## 8. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend / Interface | Next.js 16 (App Router), React 19, Tailwind CSS, Lucide Icons |
| Backend | Python 3.13, FastAPI, Uvicorn, APScheduler |
| Agent Framework | Custom Python asynchronous pipeline with Playwright automation |
| Database / Storage | SQLite3 (`tasks.db`) + Ephemeral In-memory RAM dictionary (PII Tokens) |
| Hosting | Local privacy proxy, Cloudflare / ngrok tunnel, Vercel frontend |
| Security / NLP | Microsoft Presidio (`en_core_web_lg`), PyJWT, Featherless AI |

---

## 9. What to Expect From Our Current Build

**Working & Fully Implemented:**

- Headless Playwright bot joining Google Meet URLs, capturing live captions, and automatically leaving when verbal conclusion triggers (*"ending the meeting"*, *"wrap up"*, *"conclude"*) are detected.
- Local entity masking via Microsoft Presidio (`en_core_web_lg`) and RAM dictionary mapping with 100 phonetic variants per attendee.
- Persona-based prompt engineering returning structured JSON from Featherless AI (Qwen-2.5-72B / Llama-3-70B).
- Re-hydration of sanitized summaries back to full plaintext locally with immediate RAM wiping.
- Multi-page Next.js enterprise UI with JWT authentication, dashboard analytics, meeting registry, and interactive action items.
- Strict two-party isolated messaging (`dm-user1-user2`) and private user-scoped AegisBot streams.
- Complete 50-test automated regression suite with 100% passing rate.

**Communication Integration:**

- Real-time internal messaging synchronized across users via SQLite and live polling, complemented by automated webhook dispatch to Discord/Slack.

**What we'd most like to be judged on:**

Our zero-leak hybrid proxy architecture and persona-based routing. We want judges to inspect network logs to verify that identities never leave localhost, while still effectively reducing administrative burden by automating specialized summaries (PM vs. Absentee) and tracking tasks in SQLite.

---

## 10. Future Scope

### Idea 1

**Name:** Cross-Meeting Contradiction Engine

**What it is:** A local RAG (Retrieval-Augmented Generation) pipeline that stores decisions across multiple meetings and flags contradictions.

**Why it matters:** Prevents teams from accidentally overriding past architectural or business decisions made weeks prior.

**How we'd build it:** Integrate ChromaDB locally to embed all re-hydrated decisions. During a new meeting, query the vector DB with current discussion topics and pass context to the Reasoning Agent.

**Done when:** The PM summary actively alerts users if a newly agreed-upon timeline contradicts a deadline from a previous meeting.

### Idea 2

**Name:** Automated Workload & Calendar Sync

**What it is:** Bidirectional integration with enterprise project management APIs (Jira/Asana) and Google Calendar.

**Why it matters:** Moves task tracking from a standalone SQLite dashboard directly into the tools where employees already work and manage their time.

**How we'd build it:** Implement Google Cloud OAuth 2.0 and Atlassian API tokens to automatically map assigned task tickets to specific employee accounts and block out calendar focus time.

**Done when:** The AI delegates a task during a meeting, and a Jira ticket instantly appears in the assigned employee's sprint board.

### Idea 3 (Optional)

**Name:** Local Faster-Whisper Audio Pipeline

**What it is:** Direct audio capture and local CPU/GPU speech-to-text transcription directly within the headless bot container.

**Why it matters:** Eliminates dependency on meeting platforms having captions enabled or accessible in the DOM.

**How we'd build it:** Integrate PyAudio virtual audio capture with Faster-Whisper's lightweight int8 quantized model in the Python bot.

**Done when:** Bot joins meeting with closed captions disabled and still generates complete transcripts locally.

---

## 11. Additional Notes (Optional)

This project demonstrates that enterprise AI adoption does not require choosing between state-of-the-art cloud intelligence and rigorous data compliance. By decoupling reasoning from data visibility through an air-gapped local proxy, sensitive organizations can safely automate repetitive meeting administration today on commodity developer hardware.
