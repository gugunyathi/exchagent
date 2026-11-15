# Switchboard (AgentPages)

**Switchboard (AgentPages)** is a 2027 Agentic Yellow Pages platform, verified `.agent` identity registry, Ambient Reverse-RFP commerce network, Poppy Protocol v1.0 hub, and autonomous hiring & communications workspace built for both humans and external AI agents.

---

## Key Features

### 1. Agent Cards Directory (Personal & Business)
- **Personal Agent Cards**: LinkedIn-inspired verified human cards featuring portrait/avatar rings, NFC/QR handshake badges, human fallback numbers, skill tags, brief summaries, and a machine-readable `A2A / MCP-1.0 / JSON-LD` protocol footer.
- **Business Agent Cards**: Corporate cards displaying organization logos, verified company website links, enterprise guardrails, and institutional endpoints.
- **Interactive 3D Flip & Gesture Navigation**:
  - **Carousel & Grid Views**: 3D perspective card carousel and responsive grid layout.
  - **Gestures & Shortcuts**: Single-tap card to flip (`front` ↔ `back` telemetry/Poppy view), double-tap to launch a commercial **Pitch**, swipe left/right or click side cards/chevrons to browse.
  - **Full Keyboard Control**: `←` / `→` for carousel cards, `↑` / `↓` / `PageUp` / `PageDown` / `Home` / `End` for vertical scrolling, `Enter` / `Space` to flip, `P` to pitch, `D` to dial, and `Ctrl/Cmd + K` for the Command Palette.
  - **Zero Visible Scrollbars**: Edge-to-edge swipeable containers (`SwipeScrollArea`) supporting touch pan, pointer drag, mouse wheel, and directional indicator arrows where appropriate.

### 2. Promoted Status Circles & Interactive Reels
- **Floating Status Rail**: Promoted human and business agent circles float cleanly above the card stage without obscuring card details.
- **Reels / Stories Viewer**: Tapping any status circle opens a full-screen auto-advancing Reels experience with interactive sponsored commercial breaks inserted between reels, pause/resume controls, and instant deep links into Pitch or Card inspection.

### 3. Bilateral A2A Negotiation Arena & Reverse-RFP Network
- **Gemini-Powered Negotiation Engine**: Runs multi-turn Seller ↔ Buyer negotiations via `POST /api/a2a/negotiate` using `gemini-4-hydrogen` with structured JSON output and tool declarations (`check_margin_guardrail`, `book_calendar_meeting`), backed by a deterministic guardrail fallback when no API key is configured.
- **Reverse-RFP Broadcasting**: Broadcast RFPs simultaneously across the Switchboard Directory, Google Maps DOOH Billboards, BLE Proximity Beacons, and Apple CarPlay surfaces (`POST /api/rfp/broadcast`).
- **Multi-Surface Preview**: Inspect how pitches and cards render across Desktop, Mobile, CarPlay, and XR via `SurfaceSimulatorFrame`.

### 4. Poppy Protocol v1.0, Extensions & Autonomous Hiring OS
Full client and Express router implementation (`server/poppyRouter.ts` + `src/services/poppyProtocol.ts`) of **Poppy v1.0**:
- **Per-Entity Discovery**: Serves dynamic `poppy.json` manifests at `/.well-known/poppy.json`, `/u/:slug/.well-known/poppy.json`, `/companies/:slug/.well-known/poppy.json`, `/jobs/:id/.well-known/poppy.json`, and legacy `/poppy/0.4.json`.
- **OAuth & Discovery Standards**: Implements RFC 9728 Protected Resource Metadata (`/.well-known/oauth-protected-resource`), RFC 8414 Authorization Server Metadata (`/.well-known/oauth-authorization-server`), Client ID Metadata Document (`/agent.json`), JWKS (`/jwks.json`), and Browser Session Join tokens (§6).
- **Supported Poppy Extensions** (negotiated via `Poppy-Version` and `Poppy-Extensions` RFC 9651 headers):
  - `operations` (v3): HMAC-signed revisions with explicit Human-in-the-Loop (HITL) confirmation and **at-most-once idempotent execution**.
  - `disclosures` (v1): Highlighted compliance, allergen, or policy notices on messages.
  - `links` (v1): Structured reference URLs attached to agent replies.
  - `browser-control` (v1): Coordinated browser handoff status (`agent` vs `human`).
  - `mediated-sign-in` (v1): Transitional credential mediation status.
  - `ucp` (v1): Universal Commerce Protocol cart/checkout handoff references.
- **4-Role Autonomous Recruitment & Video Verification Studio**:
  - **Job Seeker**: Compliant Zero-Scraping LinkedIn URL wrapper + AI CV skill parser (`/api/recruitment/cv-parse`), explainable fit scoring (`/api/recruitment/match`), and **Blind Screening** anonymization toggle.
  - **Company Hiring**: Spawn per-job hiring agents with custom salary bands, required skills, and autonomy policies.
  - **Recruiter Agency**: Multi-party mediation console with estimated `12%` x402 escrowed placement fee tracking.
  - **Anti-Deepfake Video & Live Interview Studio**: Record webcam clips or upload candidate intro videos, run biometric/liveness & deepfake forensics (`/api/recruitment/verify-video`), attach AI & HR pre-screen evaluations (`/api/recruitment/prescreen`), host live interview sessions (`LiveInterviewRoomModal`), and schedule interviews with Google Calendar, Outlook, or downloadable `.ics` calendar exports.
- **Consent & Compliance**: Granular Poppy scope toggles, instant POPIA §11 global revocation, live `poppy.json` spec validator, Task Coverage (§9.1), and Agent Feedback (§9.3).

### 5. `.agent` Handle & Number Registry (`x402` + Auctions)
- **Sliding-Scale Handle Quoting** (`GET /api/names/search`): Quotes availability, human vs. bot `x402` USDC pricing, secondary market listings, and live English Auction rounds.
- **HTTP `402 Payment Required` Claims** (`POST /api/names/claim`): Supports `X-402-Payment-Token` settlement across Base USDC, Arc, Solana USDC, and PayPal Vault.
- **Civic Safety Lock**: Permanently reserves emergency shortcodes (`911`, `112`, `999`, `10111`, `10177`) with HTTP `403` protection.

### 6. Spatial Discovery Radar, Predictive Dialer & Omnichannel Comms
- **Spatial Maps Radar**: Interactive Google Maps view (`@vis.gl/react-google-maps`) showing nearby discoverable agents, geo-fenced passerby BLE incentives, and instant proximity matching (`POST /api/rfp/match`).
- **Predictive Voice & Chat Dialer**: Floating Dialer FAB opens a keypad with real-time predictive contact matching by phone digits, T9 patterns, shortcodes, or handles (`AgentDialerModal`), plus a `$0.00` Civic Priority `911` Emergency Dispatch mode with GPS lock and unit ETAs.
- **Omnichannel Mail & Calendar Hub**: Gemini-powered autonomous inbox triage (`POST /api/email/triage`) classifying pitches, filtering spam under POPIA rules, generating auto-replies, and booking calendar meetings.

### 7. Agent Skills Portal, Chrome Extension & Installable PWA
- **Machine-Readable Agent Onboarding**: Dedicated Agent Skills page UI alongside `/skills.md`, `/llms.txt`, `/api/skills`, `/api/skill.json` (OpenAPI 3.1), `/.well-known/agent.json`, and `/.well-known/agent-skills/index.json`.
- **Chrome Extension Generator**: Packages and downloads a ready-to-load Manifest V3 Switchboard Chrome Extension ZIP in-browser via `JSZip`.
- **Cross-Device Progressive Web App (PWA)**: Configured with `vite-plugin-pwa` (Workbox `NetworkFirst` API caching + `CacheFirst` fonts, standalone/window-controls-overlay display modes, home-screen shortcuts) and tailored OS/browser install instructions (`usePWAInstall.ts`) for iOS/iPadOS Safari, Android Chrome/Samsung/Firefox, macOS Safari, Windows/Linux Chrome/Edge/Firefox, and in-app browsers.

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Motion (`motion/react`) |
| **Backend** | Node.js, Express 4, `tsx` (integrated Vite dev middleware + production static server on port `3000`) |
| **AI & Agents** | `@google/genai` (`gemini-4-hydrogen` with Thinking & Function Calling + deterministic fallbacks) |
| **Data & Auth** | Firebase (`firebase` SDK, `firebase-blueprint.json`, `firestore.rules`) + local persisted store |
| **Maps & Geo** | `@vis.gl/react-google-maps` |
| **PWA & Packaging** | `vite-plugin-pwa` (Workbox), `jszip` |

---

## Project Structure

```text
.
├── server.ts                          # Express server, Vite middleware, Gemini A2A/RFP/Email/Voice/Names APIs
├── server/
│   └── poppyRouter.ts                 # Poppy v1.0 discovery, OAuth/JWKS, conversations, Ops v3 & recruitment APIs
├── src/
│   ├── App.tsx                        # Main shell, bottom/top nav, floating Speed-Dial FABs, modals
│   ├── components/
│   │   ├── AgentIdentityCard.tsx      # Personal & Business .agent cards (3D flip front/back)
│   │   ├── AgentCardCarousel.tsx      # 3-card perspective swipable carousel + keyboard & double-tap support
│   │   ├── PromotedStatusCircles.tsx  # Floating promoted agent story circles
│   │   ├── StatusReelsViewer.tsx      # Full-screen auto-advancing Reels + sponsored ad viewer
│   │   ├── DirectoryModule.tsx        # Carousel/Grid view switcher & search bar
│   │   ├── NegotiationArenaModule.tsx # Bilateral Gemini A2A negotiation & Reverse-RFP broadcaster
│   │   ├── PoppyRecruitmentModule.tsx # Poppy v1.0 Hub, Recruitment OS, Consent & Live JSON Validator
│   │   ├── VideoInterviewStudioPanel.tsx # Anti-deepfake video check, HR pre-screening & calendar scheduler
│   │   ├── LiveInterviewRoomModal.tsx # WebRTC-style live interview room modal
│   │   ├── RegistryMarketplaceModule.tsx # .agent handle search, auctions & secondary marketplace
│   │   ├── SpatialMapsDiscovery.tsx   # Google Maps radar & BLE/geofence passerby handshake
│   │   ├── OmnichannelCommsModule.tsx # Agentic email triage & calendar bookings
│   │   ├── AgentDialerModal.tsx       # Predictive number/T9/handle dialer & 911 SOS dispatch
│   │   ├── AgentSkillsPage.tsx        # Interactive external agent skill docs & protocol tester
│   │   ├── ChromeExtensionHub.tsx     # Manifest V3 Chrome Extension preview & ZIP exporter
│   │   ├── DeveloperLedgerModule.tsx  # Settlement audit ledger (PayPal Vault / x402) & currency tools
│   │   ├── SurfaceSimulatorFrame.tsx  # Desktop / Mobile / CarPlay / XR viewport simulator
│   │   ├── BurgerMenuDrawer.tsx       # Quick navigation drawer & PWA install access
│   │   ├── PWAInstallButton.tsx       # Adaptive OS/browser install prompt & offline status badge
│   │   └── SwipeScrollArea.tsx        # Scrollbar-free vertical/horizontal swipe + keyboard scroller
│   ├── services/
│   │   ├── poppyProtocol.ts           # Poppy v1.0 manifest builders, header parser & live validator
│   │   ├── paymentRails.ts            # Handle tier quoting & x402/PayPal payment helpers
│   │   ├── calendarAgentTool.ts       # Google/Outlook/ICS calendar link & file generators
│   │   └── gmailAgentBridge.ts        # Workspace/Gmail message bridge helpers
│   ├── hooks/
│   │   └── usePWAInstall.ts           # OS/browser environment detector & beforeinstallprompt manager
│   ├── store/
│   │   └── useSwitchboardStore.ts     # App state, Firestore sync & default seed hydration
│   ├── data/
│   │   └── seedData.ts                # Verified demo personas, businesses, jobs, RFPs & auctions
│   └── types/
│       └── firestore.ts               # Core TypeScript domain interfaces & currency formatters
├── firebase-blueprint.json            # Firestore entity schemas & collection definitions
├── firestore.rules                    # Security rules for Firestore collections
├── vite.config.ts                     # Vite, Tailwind CSS & VitePWA configuration
├── metadata.json                      # App manifest & capabilities declaration
├── package.json                       # Scripts & dependencies
└── .env.example                       # Environment variable template
```

---

## API & Protocol Endpoints

### Protocol Discovery & Agent Skills
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Server health & Gemini configuration status |
| `GET` | `/api/config/public` | Public client config (Maps key status, FX rate, app URL) |
| `GET` | `/.well-known/agent.json` | Switchboard AgentCard capability & endpoint manifest |
| `GET` | `/.well-known/agent-skills/index.json` | Agent Skills Discovery v0.2.0 JSON index |
| `GET` | `/skills.md` | Markdown skill guide for Gemini, Claude, GPT & MCP agents |
| `GET` | `/llms.txt` | Plain-text LLM crawler directory overview |
| `GET` | `/api/skills` | Structured JSON skill catalog |
| `GET` | `/api/skill.json` | OpenAPI `3.1.0` tool schema |

### Commerce, Identity, Spatial & Comms APIs
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/agents/directory` | Filter agents by `q`, `type` (`persona` \| `business`), and `discoverable` |
| `POST` | `/api/a2a/negotiate` | Run 4-turn bilateral Gemini A2A negotiation with margin guardrails |
| `POST` | `/api/rfp/broadcast` | Broadcast Reverse-RFP across Directory, DOOH & BLE channels |
| `POST` | `/api/rfp/match` | Evaluate spatial passerby geofence handshake |
| `GET` | `/api/names/search?q=<handle>` | Quote `.agent` handle pricing, civic protection & auction status |
| `POST` | `/api/names/claim` | Claim handle (returns HTTP `402` challenge unless settled via `x402`) |
| `POST` | `/api/names/bid` | Place English Auction bid on a handle |
| `POST` | `/api/email/triage` | Gemini autonomous inbox pitch classification, auto-reply & booking check |
| `POST` | `/api/voice/turn` | Conversational voice/chat dialer turn (`911`/`112`/`999` triggers `$0.00` SOS dispatch) |

### Poppy Protocol v1.0 & Recruitment APIs
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/.well-known/poppy.json` | Platform Poppy v1.0 discovery manifest |
| `GET` | `/u/:slug/.well-known/poppy.json` | Per-user personal agent Poppy manifest |
| `GET` | `/companies/:slug/.well-known/poppy.json` | Per-company agent Poppy manifest |
| `GET` | `/jobs/:id/.well-known/poppy.json` | Per-job hiring agent Poppy manifest |
| `GET` | `/poppy/0.4.json` | Legacy v0.4 compatibility manifest |
| `GET` | `/.well-known/oauth-protected-resource` | RFC 9728 protected resource metadata |
| `GET` | `/.well-known/oauth-authorization-server` | RFC 8414 OAuth authorization server metadata |
| `GET` | `/agent.json` & `/jwks.json` | OAuth Client ID Metadata Document (CIMD) & ES256 JWKS |
| `GET` | `/api/poppy/tasks` | Task Coverage manifest listing excluded tasks & alternatives (§9.1) |
| `POST` | `/api/poppy/feedback` | Submit capability requests / excluded task feedback (§9.3) |
| `POST` | `/api/poppy/conversations` | Open stateful Poppy conversation (`Poppy-Version`, `Poppy-Extensions`) |
| `POST` | `/api/poppy/conversations/:id/messages` | Append message with `operations`, `disclosures`, `links`, `ucp`, or `browser-control` |
| `GET` | `/api/poppy/conversations/:id/events` | Cursor-based event stream fetch |
| `POST` | `/api/poppy/conversations/:id/handoff` | Trigger / cancel (`.../handoff/cancel`) / close (`.../close`) handoff |
| `POST` | `/api/poppy/operations/propose` | Propose terms with HMAC-signed `revision` hash |
| `POST` | `/api/poppy/operations/execute` | Execute approved operation with at-most-once idempotency replay protection |
| `GET`/`POST` | `/api/poppy/browser-session` & `.../authorize` | Authorize and redeem short-lived Poppy browser join codes (§6) |
| `POST` | `/api/recruitment/cv-parse` | Parse user-submitted CV + LinkedIn reference into structured skills |
| `POST` | `/api/recruitment/match` | Score candidate fit with explainable factor breakdown & blind mode support |
| `POST` | `/api/recruitment/verify-video` | Analyze uploaded/recorded interview video for authenticity & liveness |
| `POST` | `/api/recruitment/prescreen` | Generate structured AI or HR pre-screening review on candidate video |

---

## Environment Variables

Create a local `.env` based on `.env.example`:

```bash
# Required for live Gemini 4 Hydrogen negotiation, triage, voice, CV & video AI calls
# (Deterministic guardrail fallbacks run automatically if unset)
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# Public origin URL for OAuth callbacks and Poppy self-referential manifests
APP_URL="http://localhost:3000"

# Optional Google Maps key for interactive Spatial Discovery map rendering
VITE_GOOGLE_MAPS_API_KEY=""

# Optional HMAC secret override for Poppy Operations v3 revision signatures
POPPY_HMAC_SECRET="switchboard-poppy-v1-ephemeral-secret"
```

---

## Getting Started

### Prerequisites
- Node.js `>= 20`
- npm (or compatible Node package manager)

### Install & Run Development Server
```bash
npm install
npm run dev
```
The full-stack Express + Vite server listens on **`http://localhost:3000`**.

### Type Check & Production Build
```bash
# Run TypeScript type check
npm run lint

# Build production client bundle & PWA service worker into dist/
npm run build

# Start production server
NODE_ENV=production npm start
```

---

## Firebase Schema & Compliance

`firebase-blueprint.json` and `firestore.rules` define persistence and access boundaries across seven core collections:
- `/agents/{agentId}` — Publicly readable `.agent` cards with owner-scoped guardrail and wallet updates.
- `/rfps/{rfpId}` — Reverse-RFP broadcasts (`OPEN` listings readable by authenticated sessions).
- `/negotiations/{sessionId}` — Bilateral A2A negotiation transcripts restricted to initiator/target owners.
- `/settlements/{txId}` — Enterprise audit ledger transactions (`paypal_vault`, `x402_base`, `x402_arc`, `x402_solana`).
- `/bookings/{bookingId}` — Autonomous interview & sign-off calendar bookings.
- `/agent_emails/{emailId}` — Triaged pitch and RFP inbox/outbox threads.
- `/voice_chat_sessions/{callId}` — Voice and chat dialer transcripts, including civic `911` priority dispatch logs.

**Compliance & Guardrails**:
- **Zero Automated Scraping**: LinkedIn URLs are user-supplied references layered onto user-consented CV input and Poppy discovery manifests.
- **POPIA Data Minimization & §11 Revocation**: Every negotiation and consent grant records minimization hashes and supports instant per-scope or global revocation.
- **Human-in-the-Loop (Operations v3)**: Sensitive actions (job applications, shortlisting, interview booking, fee settlement) enforce explicit revision-verified confirmation with idempotent replay protection.
