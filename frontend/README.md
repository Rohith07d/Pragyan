# AegisMeet: Enterprise Frontend Application

> **Zero-Leak Privacy Meeting Intelligence & Enterprise Task Governance**  
> Built with **Next.js 16 (App Router)**, **React 19**, **Turbopack**, and **Tailwind CSS**.

---

## 🌟 Overview

The AegisMeet frontend provides a distraction-free, high-contrast grayscale interface designed for enterprise teams. It interacts with the local FastAPI privacy proxy engine to display anonymized meeting intelligence, delegated task tracking, and multi-user communications without ever receiving unredacted PII or audio transcripts.

---

## 🔑 Key Features

- **Strict Credential-Based Authentication (`/login`)**: Protected login with salted hash verification. Users must enter valid credentials to access their personalized workspace.
- **Symmetric Two-Party Messaging (`/messages`)**: Real-time direct messaging with deterministic channel keys (`dm-user1-user2`), eliminating cross-persona crosstalk.
- **Private AegisBot Streams**: User-isolated AI compliance assistant channels (`dm-aegisbot-${userSlug}`) with instant verification receipts.
- **Dynamic Meeting Intelligence (`/meetings/[id]`)**: Expansive three-perspective analysis:
  - **PM View**: Blockers, technical architecture risks, infrastructure dependencies, and mitigations.
  - **Group View**: Multi-point breakdown of core decisions, consensus points, and milestone commitments.
  - **Absentee View**: 5-minute catch-up summary for team members who missed the discussion.
- **Interactive Task Governance (`/tasks`)**: Live status toggling (`pending` ↔ `completed`) with strict user privacy scoping.
- **Cross-Client Live Sync**: Automatic 3-second background polling keeps chat threads and task updates synchronized across multiple open browser sessions.

---

## 🗺️ Application Routes

| Route | Type | Description |
| :--- | :--- | :--- |
| **`/`** | Static | Redirects authenticated users to `/dashboard` or guests to `/login` |
| **`/login`** | Static | Credential-protected login portal with secure JWT session handling |
| **`/dashboard`** | Static | Overview metrics, dynamic activity graphs, and priority action items |
| **`/tasks`** | Static | Personal and team action items table with instant status toggle |
| **`/meetings`** | Static | Registry of past and scheduled sessions with clickable detail links |
| **`/meetings/[id]`** | Dynamic | Deep-dive meeting intelligence view (PM, Group, Absentee, Deliverables) |
| **`/messages`** | Static | Isolated team channels (`#general`, `#meeting-briefs`) and 1-on-1 DMs |
| **`/projects`** | Static | Enterprise project portfolio and linked deliverables |
| **`/notifications`** | Static | Filterable security, bot, and task alert center |
| **`/settings`** | Static | User persona profile, department scope, and GitHub repository links |

---

## 🛠️ Environment Configuration

Create a `.env.local` file in the `frontend` directory:

```bash
# Local backend proxy (default)
NEXT_PUBLIC_PROXY_URL=http://localhost:8000
```

### Hybrid Cloud Deployment (Option 2: Cloudflare Tunnel + Vercel)

When deploying this frontend to **Vercel** while keeping the privacy proxy running locally:

1. **Start the local backend**:
   ```bash
   uvicorn proxy:app --host 127.0.0.1 --port 8000 --reload
   ```
2. **Launch Cloudflare Tunnel**:
   ```bash
   npx cloudflared tunnel --url http://localhost:8000
   ```
3. **Set Environment Variable in Vercel**:
   - Variable Name: `NEXT_PUBLIC_PROXY_URL`
   - Value: `https://<your-subdomain>.trycloudflare.com`
4. **Trigger Vercel Redeploy**:
   - Next.js embeds the tunnel URL into client-side API requests at build time.

---

## 🚀 Development & Build Commands

```bash
# Install dependencies
npm install

# Start local development server with Turbopack (http://localhost:3000)
npm run dev

# Run production build (verifies all 12 App Router routes)
npm run build

# Start production server
npm run start
```

---

## 🎨 Design System & Accessibility

- **Palette**: Strict monochrome grayscale (`#000000` darks, `#f4f5f7` backgrounds, `#ffffff` card surfaces).
- **Typography**: Clean sans-serif with tabular numeric figures for dates and metrics.
- **Icons**: Lucide React with consistent `strokeWidth={1.8}` to `2.2`.
- **States**: High-contrast hover feedback, disabled states, and responsive layout scaling.
