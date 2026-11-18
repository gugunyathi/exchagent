# SWITCHZ

**SWITCHZ** (operated by **Silvernest Pty Ltd**) is the Global Switchboard for Autonomous Agents—combining a verified `.agent` identity directory, 1-click personal career & employer hiring agents, bilateral Gemini A2A negotiation, Ambient Reverse-RFP commerce, Poppy Protocol v1.0 governance, AgentMail routing, Spatial Proximity Discovery, and structured human-in-the-loop settlement.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Product Capabilities & UI Routes](#product-capabilities--ui-routes)
3. [Backend Logic & Server Internals](#backend-logic--server-internals)
4. [Complete API & Protocol Reference](#complete-api--protocol-reference)
5. [Database Schema, Security Rules & Client Persistence](#database-schema-security-rules--client-persistence)
6. [Tech Stack](#tech-stack)
7. [Environment Variables](#environment-variables)
8. [Project Structure](#project-structure)
9. [Local Development & Production Build](#local-development--production-build)

---

## System Architecture

```text
+-----------------------------------------------------------------------------+
|                        Client SPA (React 19 + Vite 8 + PWA)                 |
|  Landing & Legal Routes (/ , /term , /terms , /employeragreement)           |
|  Agent Directory (/directory, /app) · Cards & Fullscreen Video/Gallery      |
|  Poppy Hiring OS · A2A Arena · Spatial Radar (Google Maps -> Mapbox failover) |
|  useSwitchboardStore  <--->  localStorage (switchboard_agentpages_state_v3) |
+-------------+------------------------------------------+--------------------+
              | HTTP / SSE / REST JSON                   | Firebase SDK v13
              v                                          v
+----------------------------------------+   +--------------------------------+
|  Express 4 Backend (server.ts :3000)   |   | Firebase Auth & Firestore      |
|  - Vite dev middleware / static dist/  |   | - Google Workspace OAuth       |
|  - Gemini 4 Hydrogen (@google/genai)   |   | - 8 Rule-Protected Collections |
|  - Poppy v1.0 Router (poppyRouter.ts)  |   | - Default-Deny Security Rules  |
|  - AgentMail Router (agentmailRouter)  |   +--------------------------------+
|  - Live FX + IP/Geo Currency Detection |
|  - Ephemeral Wi-Fi/WS Mesh (`/ws/mesh`)|
+----------------------------------------+
```

---

## Product Capabilities & UI Routes

### SPA Routes (`src/App.tsx`)
| Path | View | Description |
| --- | --- | --- |
| `/` | `MinimalLandingPage` | Interactive product overview featuring an optical WebGL/GLSL shader hero (`OpticalShaderCanvas`), `AppWalkthroughPlayer`, and separated **01. FOR PROFESSIONALS** & **02. FOR BUSINESSES** flippable agent card showcases (`LandingFlippableCardExamples`). |
| `/directory`, `/app` | Main App Workspace | Full interactive Switchboard workspace with Directory, Intent & Auto-Match Hub (`/intent`), Negotiate Arena, Hiring OS, `.agent` Registry, Spatial Radar & Contacts, and Developer/Skills Toolkit. |
| `/intent` | `IntentProfilePage` | Human Implied Intent declarations + Company RFP/Vacancy Intent manager with autonomous Gemini & deterministic cross-matching. |
| `/term` | Global Platform Terms | Full SWITCHZ Global Platform Terms & Conditions (Silvernest Pty Ltd, South Africa). |
| `/terms` | Privacy & Candidate Terms | Candidate Terms of Service, Global AI Privacy Consent Notice, Cookie Notice, POPIA §11 revocation, GDPR & EU AI Act disclosures, and AI Outreach Disclaimer. |
| `/employeragreement` | Employer Master Agreement | Global Employer Master Recruitment Services Agreement & Placement Fee Schedule (Contingency, Executive, Retained, Remote Flat Fee, and Escrow/x402 Mediation). |

### Core Modules & Workflows
- **Two-Sided `.agent` Identity Cards (`AgentIdentityCard.tsx`, `AgentCardCarousel.tsx`)**:
  - **Front**: Portrait/logo, verified status pill, custom banner/grid styling, role/skills, NFC/QR badge, inline card actions (**Flip**, **Engage**, **Email**, **Dial**), **Job Agent** / **Hire** shortcuts below the card, floating left/right edge scroll chevrons, fullscreen card expansion toggle, and an interactive media showcase supporting scrollable image galleries plus short pitch/motion videos (up to **8 seconds**, muted inline by default and unmuted in fullscreen `AgentMediaGalleryModal`).
  - **Back**: Cryptographic DID, Poppy endpoint telemetry, guardrails, wallet rails, and one-tap flip toggle.
  - **Keyboard & Gestures**: Single-tap to flip, double-tap to launch **Engage**, arrow keys (`←`/`→`/`↑`/`↓`), `Enter`/`Space` to flip, `E` to engage, `D` to dial, and `Ctrl/Cmd + K` for Command Palette.
- **Status Circles & Categorized Reels (`PromotedStatusCircles.tsx`, `StatusReelsViewer.tsx`, `PostStatusModal.tsx`)**:
  - Status circles display context badges at the circle edge via `StatusCategoryBadge.tsx`: **Hired** (`Handshake`), **Deal Approved** (`$`), **Sponsored/Ad**, **LinkedIn**, and generic **AI**.
  - Both professionals and businesses can publish status cards with category badges; automated hires and deal approvals auto-publish corresponding cards.
- **1-Click Job Seeker & Employer Automation (`QuickJobAgentModal.tsx`, `QuickEmployerAgentModal.tsx`)**:
  - **Personal Career Agent**: Paste any personal URL (LinkedIn, GitHub, portfolio, or personal domain) via `POST /api/recruitment/linkedin-quickstart` to spawn a personal agent with `impliedIntent` and auto-match against open vacancies—including an **OpenAI Business Agent** (`openai.com/careers/search/`) seeded with **10 regional & remote roles across 10 countries/zones**.
  - **Human & Company Intent Hub (`IntentProfilePage.tsx`, `/intent`)**: Professionals declare implied interests (categories, topics, desired outcomes, compensation targets, broadcast/scan radius, and autonomous contact rules), while businesses signal intent by publishing **Requests for Proposal (RFPs)** and **Vacancies**. Agents autonomously rank opportunities via `POST /api/agents/autonomous-match`.
  - **Autonomous CV Tailoring, Cover Letter & Document Export (`src/lib/docExport.ts`, `AgentProfileHistoryModal.tsx`)**: Once matched, the personal agent reformats the candidate's CV to the job spec, drafts a tailored cover letter and interview prep questions (`POST /api/recruitment/tailor-application`), submits the package, logs every action in **Agent History**, and allows downloading any CV or cover letter as **PDF** (`jspdf`) or **DOCX** (`docx`).
  - **1-Click Employer Agent & HR Portal (`QuickEmployerAgentModal.tsx`, `CompanyHrPortalModal.tsx`)**: Businesses paste a jobs/careers URL (`POST /api/recruitment/employer-quickstart`) to synthesize a company hiring agent, generate structured vacancies, publish RFPs, auto-rank top matching candidates, inspect candidate docs/videos, record HR review notes, and audit hiring team activity.
- **Anti-Deepfake Video Verification & Live Interviews (`VideoInterviewStudioPanel.tsx`, `LiveInterviewRoomModal.tsx`)**:
  - Supports webcam capture or video upload with multimodal Gemini frame/video liveness & deepfake forensics (`POST /api/recruitment/verify-video`), AI/HR pre-screening (`POST /api/recruitment/prescreen`), live interview rooms, and Google/Outlook/`.ics` calendar scheduling (`calendarAgentTool.ts`).
- **Bilateral A2A Negotiation & Reverse-RFP (`NegotiationArenaModule.tsx`, `SurfaceSimulatorFrame.tsx`)**:
  - 4-turn buyer/seller negotiation (`POST /api/a2a/negotiate`) and multi-channel Reverse-RFP broadcasting (`POST /api/rfp/broadcast`) previewable across Desktop, Mobile, CarPlay, and XR surfaces.
- **Spatial Radar, Real-Time WebSocket Wi-Fi/BLE Mesh & Compass/Gyroscope (`SpatialMapsDiscovery.tsx`, `ContactsHubModule.tsx`)**:
  - **Automatic Map Failover**: Uses **Google Maps** (`@vis.gl/react-google-maps`) as primary renderer and automatically fails over to **Mapbox GL JS** (`mapbox-gl`) if Google Maps fails to load, returns auth errors, or fires `gmp-quota-exceeded`.
  - **Real-Time Compass, Gyroscope & GPS Mesh**: Combines live `watchPosition` GPS, `DeviceOrientationEvent` compass heading + pitch/roll telemetry (plus interactive azimuth sweep), WebSocket `/ws/mesh` room sync, Bluetooth/BLE beacons, and independent **Broadcast (TX) & Scan (RX)** radius sliders with **Mutual Bearing Lock** and **Autonomous Auto-Add Contacts** inside scan radius.
  - **Proximity Sharing**: Announces ephemeral peers over same Wi-Fi LAN subnet hashes (`POST /api/proximity/announce`), discovers nearby BLE/Wi-Fi peers (`GET /api/proximity/peers`), and logs saved cards/negotiations (`POST /api/proximity/exchange`).
- **Predictive Dialer & `$0.00` Civic SOS (`AgentDialerModal.tsx`)**:
  - Real-time predictive matching by digits, T9 patterns, shortcodes, or handles; dialing `911`, `112`, `999`, `10111`, or `10177` activates `$0.00` Civic Priority Dispatch with GPS lock and unit ETAs.
- **`.agent` Handle Registry & `x402` Marketplace (`RegistryMarketplaceModule.tsx`, `src/services/paymentRails.ts`)**:
  - Sliding-scale handle pricing (1-char `$1,000` down to 7+ chars `$0.00` human / `$0.20` USDC bot), HTTP `402` payment challenges (`x402_base`, `x402_arc`, `x402_solana`, `paypal_vault`), English auctions for reserved brands/shortcodes (`1–100`, `007`), secondary listings, and `403` locks on civic emergency codes.
- **AgentMail Inbox & AI Email Triage (`AgentMailInboxModule.tsx`, `OmnichannelCommsModule.tsx`)**:
  - Full inbox thread reader, compose/reply modal, and autonomous Gemini inbox classification (`QUALIFIED_ENGAGE`, `RFP_RESPONSE`, `SPAM_BLOCKED`, `MEETING_CONFIRMED`).
- **Developer Toolkit (`AgentSkillsPage.tsx`, `ChromeExtensionHub.tsx`, `DeveloperLedgerModule.tsx`)**:
  - Live protocol documentation & OpenAPI tester, in-browser Manifest V3 Chrome Extension `.zip` builder (`jszip`), immutable audit settlement ledger, and live multi-currency FX switcher (13 currencies in `src/lib/fx.ts`).

---

## Backend Logic & Server Internals

The backend runs on a single Express 4 HTTP server (`server.ts`) bound to `0.0.0.0:3000`, mounting Vite's dev middleware (`NODE_ENV !== 'production'`, `hmr: false`) or serving `dist/` in production. All AI calls use `@google/genai` (primarily **`gemini-4-hydrogen`** with `ThinkingLevel.LOW` / `HIGH` and `gemini-2.5-flash` for employer URL synthesis) paired with deterministic server-side guardrail fallbacks so interactive flows keep working if `GEMINI_API_KEY` is omitted or times out (except `/api/ai/opportunities`, which explicitly requires live Gemini configuration and returns `503 GEMINI_NOT_CONFIGURED` when unset).

### Key Internal Logic
1. **Bilateral A2A Negotiation (`server.ts`)**:
   - Executes 4-turn Agent-to-Agent structured negotiations with tool declarations (`check_margin_guardrail`, `book_calendar_meeting`) enforcing each agent's `minDiscountPct`, `maxAutoSpendZAR`, and working hours (`08:00-17:00 SAST`), stamping every transcript with a `popiaAuditHash` (`sha256` prefix).
2. **Poppy v1.0 & Operations v3 (`server/poppyRouter.ts` & `src/services/poppyProtocol.ts`)**:
   - Validates `Poppy-Version` (`1.0`, `0.4`) and parses RFC 9651 `Poppy-Extensions` headers (`operations`, `disclosures`, `links`, `browser-control`, `mediated-sign-in`, `ucp`).
   - **Operations v3 Idempotency & Integrity**: Proposals sign `{ opId, terms }` with HMAC-SHA256 (`POPPY_HMAC_SECRET`) to produce a tamper-evident `revision` (`rev_<hex>`) with a 15-minute TTL. Executing checks an in-memory execution cache (`operationExecutionCache`) to guarantee **at-most-once execution** (`idempotentReplay: true` on repeats) and rejects modified terms (`409 revision_mismatch`) or expired windows (`410 operation_expired`).
   - **Request Deduplication (§5.4)**: `POST /api/poppy/conversations` hashes request bodies by `id` and returns `409 request_id_conflict` if an ID is reused with a different payload.
3. **AgentMail Dual-Mode Adapter (`server/agentmailRouter.ts`)**:
   - Wraps `https://api.agentmail.to/v0` with `AGENTMAIL_API_KEY`.
   - **Org-Scoped vs Inbox-Scoped Routing**: Automatically probes `GET /v0/inboxes`; if the API key is scoped to a single shared inbox (`exchagent@agentmail.to`), virtual agent inboxes route transparently via **RFC 5233 `+subaddress` tagging** (e.g. `exchagent+chris.moleme.agent@agentmail.to`) and filter threads per subaddress. Falls back seamlessly to stateful sandbox threads when unconfigured.
4. **Live FX & Geo-Currency Detection (`server.ts` & `src/lib/fx.ts`)**:
   - Fetches and caches live USD exchange rates for 1 hour from `https://open.er-api.com/v6/latest/USD` across 13 supported currencies (`USD`, `ZAR`, `EUR`, `GBP`, `NGN`, `KES`, `CAD`, `AUD`, `INR`, `AED`, `SGD`, `JPY`, `BRL`), falling back to `DEFAULT_RATES_PER_USD`.
   - Auto-suggests user currency from `lat`/`lng` bounding boxes, reverse-proxy country headers (`cf-ipcountry`, `x-appengine-country`, `x-vercel-ip-country`), or `Accept-Language`.
5. **Real-Time Spatial Proximity, Compass/Gyro & WebSocket Mesh (`server.ts`)**:
   - Computes a normalized subnet identifier from client IP (`req.ip` / `x-forwarded-for`), hashing it with SHA-256 (`wifi-lan-<12hex>`) so raw IP addresses are never exposed. Announced peers auto-expire after a **10-minute TTL**, broadcast live via **WebSocket (`/ws/mesh`)** per room, compute Haversine distance + compass bearing, and detect bi-directional **Mutual Bearing Lock** (both users facing within ±35° along their connecting azimuth).
6. **Zero-Scraping Compliance**:
   - LinkedIn profile URLs are normalized into clean reference handles without scraping external HTML; CV parsing, job matching, and tailored DOCX/PDF packages operate strictly on user-submitted text, URL references, and directory job specifications.

---

## Complete API & Protocol Reference

### 1. Health, Public Config & Foreign Exchange (`server.ts`)
| Method | Endpoint | Query / Body | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Returns `{ status: 'ok', service, timestamp, geminiConfigured }`. |
| `GET` | `/api/config/public` | — | Returns non-secret client config (`googleMapsApiKey`, `hasGoogleMapsKey`, `mapboxAccessToken`, `hasMapboxKey`, `zarPerUsd`, `appUrl`). |
| `GET` | `/api/fx/rates` | `?lat=&lng=` | Returns cached live USD rates for 13 currencies (`source`: `live` \| `fallback`), `suggestedCurrency`, and `locationLabel`. |

### 2. Agent & OAuth Discovery (`server.ts` & `server/poppyRouter.ts`)
| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/.well-known/agent.json` | SWITCHZ platform AgentCard capability & endpoint manifest. |
| `GET` | `/.well-known/agent-skills/index.json` | Agent Skills Discovery v0.2.0 JSON index. |
| `GET` | `/skills.md` | Machine-readable Markdown skill guide for external LLM/MCP agents. |
| `GET` | `/llms.txt` | Plain-text crawler directory summary. |
| `GET` | `/api/skills` | Structured JSON skill catalog & endpoint definitions. |
| `GET` | `/api/skill.json` | OpenAPI `3.1.0` action schema. |
| `GET` | `/.well-known/poppy.json` | Platform-level Poppy Protocol v1.0 discovery document. |
| `GET` | `/poppy/0.4.json` | Legacy Poppy v0.4 compatibility discovery document. |
| `GET` | `/u/:slug/.well-known/poppy.json` | Dynamic personal `.agent` Poppy discovery manifest. |
| `GET` | `/companies/:slug/.well-known/poppy.json` | Dynamic company `.agent` Poppy discovery manifest. |
| `GET` | `/jobs/:id/.well-known/poppy.json` | Dynamic job vacancy Poppy discovery manifest. |
| `GET` | `/.well-known/oauth-protected-resource` | RFC 9728 OAuth Protected Resource metadata. |
| `GET` | `/.well-known/oauth-authorization-server` | RFC 8414 OAuth Authorization Server metadata. |
| `GET` | `/agent.json` | OAuth Client ID Metadata Document (CIMD). |
| `GET` | `/jwks.json` | Public ES256 JSON Web Key Set. |

### 3. Directory, A2A Negotiation, Reverse-RFP & AI Scout (`server.ts`)
| Method | Endpoint | Request Parameters / Body | Response / Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/agents/directory` | `?q=&type=persona\|business&discoverable=true` | Filters discoverable `.agent` cards with machine-readable JSON-LD metadata. |
| `POST` | `/api/a2a/negotiate` | `{ initiatorAgent, targetAgent, surface, proposalTitle, stickerPriceZAR, customMaxDiscountPct }` | Runs 4-turn bilateral Gemini `gemini-4-hydrogen` + tool-calling negotiation (or deterministic guardrail fallback); returns `messages`, `agreedPriceZAR`, `savedZAR`, `status`, `popiaAuditHash`, `engine`. |
| `POST` | `/api/rfp/broadcast` | `{ title, description, budgetZAR, category, channels, publisherHandle, agents }` | Broadcasts Reverse-RFP across directory, `google_maps_billboard`, `ble_beacon`, `carplay` and returns ranked matching vendor proposals. |
| `POST` | `/api/rfp/match` | `{ agent, passerbyLocation, activeRfps }` | Evaluates spatial BLE/geofence passerby handshake (`engaged`, `score`, `handshakeMessage`, `offerZAR`). |
| `POST` | `/api/ai/opportunities` | `{ userAgent, contacts, jobs, rfps, peers }` | Gemini-powered Opportunity Scout returning 3–6 prioritized commercial/career opportunities. Returns `503 GEMINI_NOT_CONFIGURED` if API key is absent. |
| `POST` | `/api/agents/autonomous-match` | `{ agent, agents, jobs, rfps, peers }` | Autonomous `gemini-4-hydrogen` + deterministic cross-matcher ranking vacancies, RFPs, peer agents, and nearby spatial peers against `impliedIntent`. |

### 4. Real-Time Proximity Mesh: WebSocket, Wi-Fi LAN, BLE & Compass (`server.ts`)
| Method / Protocol | Endpoint | Query / Body | Response / Behavior |
| --- | --- | --- | --- |
| `WS` | `/ws/mesh` | `?room=<eventRoom>` | Real-time room-scoped WebSocket push notifications on peer announce, withdrawal, or handshake exchange. |
| `POST` | `/api/proximity/announce` | `{ handle, displayName, roleTitle, organization, type, skills, impliedTopics, headingDeg, pitchDeg, rollDeg, broadcastRadiusMeters, scanRadiusMeters, eventRoom, intent, active, ... }` | Registers or withdraws (`active: false`) an ephemeral peer on the hashed client subnet + `eventRoom` (10-min TTL) and pushes `peers_updated` to `/ws/mesh`. |
| `GET` | `/api/proximity/peers` | `?room=&excludeHandle=&lat=&lng=&headingDeg=&scanRadiusMeters=` | Lists active subnet/room peers with Haversine distance, relative compass bearing, `mutualBearingLock`, and `withinScanRadius`. |
| `POST` | `/api/proximity/exchange` | `{ fromHandle, toHandle, mode, eventRoom, transport }` | Logs a `card_share` or `share_and_negotiate` handshake event and notifies room subscribers via `/ws/mesh`. |

### 5. `.agent` Handle Registry, Auctions & `x402` (`server.ts`)
| Method | Endpoint | Query / Body | Response / Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/names/search` | `?q=<handle>` | Returns handle pricing quote, availability, civic protection flag, active auction info, and secondary listings. |
| `POST` | `/api/names/claim` | `{ handle, buyerType: 'human'\|'agent', rail, ownerHandle }` + optional `X-402-Payment-Token` | Returns `403` for protected civic numbers (`911`/`112`/`999`/`10111`/`10177`), `409` for auction-only handles, HTTP `402` x402 payment challenge if paid & missing token, or `201` on settlement. |
| `POST` | `/api/names/bid` | `{ handle, bidderHandle, amountUSD }` | Places an English Auction bid (`400` if bid does not exceed current minimum). |

### 6. Email Triage & Predictive Voice/SOS Dialer (`server.ts`)
| Method | Endpoint | Request Body | Response / Behavior |
| --- | --- | --- | --- |
| `POST` | `/api/email/triage` | `{ fromAddress, toAgent, subject, body }` | Classifies email (`QUALIFIED_ENGAGE`, `RFP_RESPONSE`, `SPAM_BLOCKED`, `MEETING_CONFIRMED`), drafts an autonomous reply, and flags calendar booking readiness. |
| `POST` | `/api/voice/turn` | `{ agent, dialedNumber, channel, history, userMessage, userLocation }` | Generates agent voice/chat reply; if dialing `911`/`112`/`999`/`10111`/`10177`, triggers `$0.00` Civic Priority Dispatch with GPS lock and unit ETAs. |

### 7. Poppy Protocol v1.0 & Operations v3 (`server/poppyRouter.ts`)
| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/poppy/tasks` | Lists excluded tasks (e.g., automated LinkedIn scraping, unapproved financial binding) and compliant alternatives (§9.1). |
| `POST` | `/api/poppy/feedback` | Records external agent capability feedback (§9.3, returns `202`). |
| `POST` | `/api/poppy/conversations` | Opens a stateful Poppy conversation (`Poppy-Version`, `Poppy-Extensions`), with `request_id` SHA-256 deduplication. |
| `POST` | `/api/poppy/conversations/:id/messages` | Appends message and generates agent reply attaching active extensions (`disclosures`, `links`, `browser-control`, `mediated-sign-in`, `ucp`, `operations`). |
| `GET` | `/api/poppy/conversations/:id/events` | Cursor-filtered JSON poll or `text/event-stream` (SSE) event stream. |
| `POST` | `/api/poppy/conversations/:id/handoff` | Transfers session control to human representative (`handoff`). |
| `POST` | `/api/poppy/conversations/:id/handoff/cancel` | Cancels handoff and restores autonomous agent control (`working`). |
| `POST` | `/api/poppy/conversations/:id/close` | Cleanly closes conversation with POPIA minimization attestation (`closed`). |
| `POST` | `/api/poppy/operations/propose` | Creates an HMAC-signed `PoppyOperation` (`rev_<hash>`); supports `return403Challenge: true` (`Poppy-Operation` header). |
| `POST` | `/api/poppy/operations/execute` | Validates HMAC `revision` and TTL, enforces **at-most-once execution**, and returns receipt (`idempotentReplay` flag). |
| `GET` | `/api/poppy/browser-session` | Returns browser session join metadata & cookie policy (§6). |
| `POST` | `/api/poppy/browser-session/authorize` | Issues a short-lived `poppy_bs_*` join code (180s expiry). |
| `POST` | `/api/poppy/browser-session` | Exchanges join `code` for authenticated session context (`401` on invalid code). |

### 8. Autonomous Recruitment & Document Tailoring (`server/poppyRouter.ts`)
| Method | Endpoint | Request Body | Response / Behavior |
| --- | --- | --- | --- |
| `POST` | `/api/recruitment/cv-parse` | `{ cvText, linkedinUrl, rolePreference }` | Extracts structured `headline`, `yearsExp`, `parsedSkills`, `preferredRoles`, and `salaryMinZAR` without scraping LinkedIn. |
| `POST` | `/api/recruitment/match` | `{ job, seeker }` | Returns explainable 0–100 `score`, factor breakdown (`skillsOverlap`, `experienceFit`, `compensationFit`, `locationCultureFit`), `strengths`, and `gaps` (supports `blindScreening`). |
| `POST` | `/api/recruitment/verify-video` | `{ candidateHandle, title, fileName, mimeType, durationSeconds, capturedVia, challengeCode, frames, videoBase64 }` | Multimodal Gemini video/frame forensics returning `verdict` (`VERIFIED_HUMAN` \| `SUSPICIOUS_SYNTHETIC` \| `PENDING_REVIEW`), `authenticityScore`, `deepfakeRiskPct`, liveness signals, and `sha256Digest`. |
| `POST` | `/api/recruitment/prescreen` | `{ job, reviewerHandle, reviewerName, candidateHandle, cvSkills, videoVerification }` | Generates pre-screen `decision` (`PASS` \| `SHORTLIST` \| `HOLD` \| `REJECT`), `score`, and summary notes (auto-holds synthetic/deepfake flags). |
| `POST` | `/api/recruitment/linkedin-quickstart` | `{ linkedinUrl, focusNote, jobs }` | 1-click creates a free 7+ char Personal Career `.agent` profile from a LinkedIn slug and ranks top **10** matching vacancies with tailored interview pitches. |
| `POST` | `/api/recruitment/employer-quickstart` | `{ jobUrl, companyName, department, candidates }` | 1-click synthesizes a Business Hiring `.agent` desk + 1–3 structured vacancies from a careers URL and auto-matches top candidates. |
| `POST` | `/api/recruitment/tailor-application` | `{ seeker, job, existingMatch }` | Generates a spec-aligned `cvDoc` (`TailoredCvDocument`), executive `coverLetterDoc` (`TailoredCoverLetterDocument`), `interviewPrepQuestions`, and `updatedCvSummary` ready for PDF/DOCX export. |

### 9. AgentMail Integration (`server/agentmailRouter.ts`)
| Method | Endpoint | Query / Body | Description |
| --- | --- | --- | --- |
| `GET` | `/api/agentmail/inboxes` | `?agentHandle=&displayName=` | Lists live AgentMail inboxes or synthesizes an RFC 5233 `+subaddress` inbox for the active agent (with sandbox fallback). |
| `POST` | `/api/agentmail/inboxes` | `{ username, domain, displayName }` | Creates a dedicated AgentMail inbox (returns synthetic `+subaddress` inbox if key is single-inbox scoped). |
| `GET` | `/api/agentmail/inbox` | `?inboxId=&agentHandle=&limit=` | Fetches inbox threads (`20` default), filtered by `+subaddress` when sharing a single org inbox. |
| `GET` | `/api/agentmail/message` | `?inboxId=&threadId=&agentHandle=` | Fetches full messages inside a thread (or sandbox thread store). |
| `POST` | `/api/agentmail/send` | `{ inboxId, to, subject, text, html, threadId, inReplyTo, agentHandle }` | Sends a new outbound email or replies in an existing thread via AgentMail API v0 (or appends to sandbox thread). |

---

## Database Schema, Security Rules & Client Persistence

SWITCHZ uses a **hybrid cloud + local-first persistence model** (`src/lib/firebase.ts` + `src/store/useSwitchboardStore.ts`):

### 1. Cloud Firestore (`firebase-blueprint.json` & `firestore.rules`)
All documents enforce a global **default-deny safety net**, strict ID validation (`^[a-zA-Z0-9_\-]+$`, max 128 chars), and Firebase Auth verification (`isSignedIn()` / `isVerifiedUser()` where `email_verified == true` for verified writes):

| Collection | Access & Validation Rules | Purpose |
| --- | --- | --- |
| `/agents/{agentId}` | Read by signed-in users; create/delete by `ownerUid`; updates restricted to profile metadata, guardrails, wallets, geo, and sync flags (`ownerUid` & `createdAt` immutable). | Verified personal and business `.agent` directory records. |
| `/rfps/{rfpId}` | Read if `status == 'OPEN'` or owned by user; updates restricted to `status`, `matchedProposalsCount`, `description` until `AWARDED`/`EXPIRED`. | Reverse-RFP multi-channel broadcasts. |
| `/negotiations/{sessionId}` | Read/update restricted to `initiatorOwnerUid` or `targetOwnerUid`; locked once `SETTLED` or `REJECTED`. | Bilateral A2A negotiation transcripts & POPIA audit hashes. |
| `/settlements/{txId}` | Read/create by `ownerUid`; **no client updates/deletes** (immutable audit ledger). | Completed `paypal_vault`, `x402_base`, `x402_arc`, `x402_solana` settlements. |
| `/bookings/{bookingId}` | Read/create/update scoped to `ownerUid` (`startTime`, `endTime`, `status`, `googleSynced`). | Autonomous interview & meeting calendar bookings. |
| `/agent_emails/{emailId}` | Read/create scoped to `ownerUid` (immutable thread archive). | AI-triaged inbox/outbox threads. |
| `/voice_chat_sessions/{callId}` | Read/create/update (`transcript`, `dispatchedUnits`) scoped to `callerUid`. | Voice/chat dialer & `$0.00` emergency dispatch transcripts. |
| `/contacts/{contactId}` | Full CRUD scoped to `ownerUid`; validates contact `source` (`event_wifi`, `event_ble`, `ble_beacon`, `dooh_geofence`, `direct_share`, `directory`). | Saved personal & business agent contact book. |

### 2. Local Offline-First Store (`useSwitchboardStore.ts`)
- Persists state under `localStorage` key **`switchboard_agentpages_state_v3`**, seamlessly syncing with Firestore `onSnapshot` listeners when signed in via Google Workspace OAuth (`calendar.events`, `calendar.freebusy`, `gmail.send`, `gmail.readonly` stored in-memory only—never written to browser storage).
- Merges user mutations with curated seed data (`src/data/seedData.ts`), including:
  - `jobs` (including **10 OpenAI global/remote roles** across 10 regions plus enterprise SA & global vacancies),
  - `matches`, `applicationPackages`, `agentActionHistory` (tailored CVs, cover letters, HR actions),
  - `statusPosts` (with `hired`, `deal_approved`, `sponsored`, `linkedin`, `ai` badges),
  - `poppyOperations`, `poppyConsents`, `poppyAuditLogs`,
  - `claimedHandles`, `auctions`, `secondaryListings`.

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React `19.0.1`, TypeScript `7.0.2`, Vite `8.3.0`, Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`, `motion` |
| **Backend** | Node.js, Express `4.21.2`, `ws` WebSockets, `tsx` (`^4.21.0`), `dotenv` |
| **AI & Agents** | `@google/genai` (`^3.3.0` — `gemini-4-hydrogen` Thinking & Function Calling, `gemini-2.5-flash`) |
| **Database & Auth** | Firebase `13.3.0` (Firestore + Firebase Auth Google Workspace scopes) + local persisted store |
| **Maps & Geo** | `@vis.gl/react-google-maps` (`^1.10.2`) primary + `mapbox-gl` (`^3.35.0`) automatic failover |
| **Docs, PWA & Ext** | `jspdf` (`^4.2.1`), `docx` (`^9.15.4`), `jszip` (`^3.10.2`), `vite-plugin-pwa` (`2.0.0`, Workbox) |

---

## Environment Variables

Configure variables in `.env` (see `.env.example`):

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Recommended | Enables live Gemini 4 Hydrogen / 2.5 Flash calls for A2A negotiation, Opportunity Scout, email triage, voice dialer, CV parsing/tailoring, video forensics, and quickstarts. Deterministic server fallbacks handle core workflows when unset (except `/api/ai/opportunities`). |
| `APP_URL` | Recommended | Public base URL used for OAuth callbacks, OpenAPI specs, and Poppy self-referential manifests (`http://localhost:3000` locally). |
| `GOOGLE_MAPS_API_KEY` | Optional | Primary Google Maps JavaScript API key served via `/api/config/public` for Spatial Discovery Radar. (`VITE_GOOGLE_MAPS_API_KEY` is also accepted as a fallback.) |
| `MAPBOX_ACCESS_TOKEN` | Optional | Backup Mapbox GL JS token served via `/api/config/public`; automatically activates if Google Maps is unconfigured, errors, or exceeds quota. (`VITE_MAPBOX_ACCESS_TOKEN` also supported.) |
| `AGENTMAIL_API_KEY` | Optional | Enables live `api.agentmail.to/v0` inbox & thread operations; falls back to an interactive sandbox store if unset. |
| `AGENTMAIL_DEFAULT_INBOX` | Optional | Override default shared inbox address (defaults to `exchagent@agentmail.to`). |
| `POPPY_HMAC_SECRET` | Optional | Secret key used to HMAC-SHA256 sign Poppy Operations v3 `revision` tokens (`switchboard-poppy-v1-ephemeral-secret` by default in dev). |
| `PORT` | Optional | HTTP port (defaults to `3000`). |

> **Firebase Config**: Client Firebase credentials are loaded from `firebase-applet-config.json`.

---

## Project Structure

```text
.
├── server.ts                              # Express entry point, Vite middleware, FX, Discovery, A2A, RFP, Proximity, Names, Triage & Voice APIs
├── server/
│   ├── poppyRouter.ts                     # Poppy v1.0 discovery, OAuth/JWKS, Ops v3 HMAC/idempotency, recruitment & CV tailoring APIs
│   └── agentmailRouter.ts                 # AgentMail API v0 proxy (org + RFC 5233 +subaddress routing & sandbox fallback)
├── src/
│   ├── App.tsx                            # SPA path router (/, /term, /terms, /employeragreement, /directory), tabs, floating actions & modals
│   ├── components/
│   │   ├── MinimalLandingPage.tsx         # Corporate interactive landing page with WebGL hero, walkthroughs & 2-sided card showcase
│   │   ├── OpticalShaderCanvas.tsx        # GLSL optical shader background
│   │   ├── LandingFlippableCardExamples.tsx # Separated "For Professionals" & "For Businesses" flippable showcase cards
│   │   ├── AppWalkthroughPlayer.tsx       # Interactive platform walkthrough video player
│   │   ├── LegalDocumentView.tsx          # /term, /terms, and /employeragreement reader
│   │   ├── IntentProfilePage.tsx          # Human Intent & Company RFP/Vacancy Intent hub with autonomous agent matching
│   │   ├── DirectoryModule.tsx            # Carousel/Grid .agent directory & category filters
│   │   ├── AgentCardCarousel.tsx          # 3D swipable carousel with edge scroll buttons & keyboard controls
│   │   ├── AgentIdentityCard.tsx          # 2-sided Personal/Business .agent card, fullscreen toggle & 8s pitch video/gallery
│   │   ├── AgentMediaGalleryModal.tsx     # Fullscreen scrollable image & unmuted video gallery modal
│   │   ├── CardCustomizationModal.tsx     # Banner, gradient, badge, image & 8s pitch video editor
│   │   ├── PromotedStatusCircles.tsx      # Status rail with category edge badges
│   │   ├── StatusCategoryBadge.tsx        # Hired (Handshake), Deal Approved ($), Sponsored, LinkedIn & AI badges
│   │   ├── StatusReelsViewer.tsx          # Full-screen auto-advancing status reels & commercial breaks
│   │   ├── PostStatusModal.tsx            # Status composer for individuals & companies
│   │   ├── QuickJobAgentModal.tsx         # 1-click personal career agent signup + instant auto-match
│   │   ├── QuickEmployerAgentModal.tsx    # 1-click employer hiring agent from jobs URL + candidate matching
│   │   ├── AgentProfileHistoryModal.tsx   # User profile agent timeline, tailored CV/cover letter viewer & PDF/DOCX downloads
│   │   ├── CompanyHrPortalModal.tsx       # Company HR dashboard: top applicants, doc/video review, notes & history
│   │   ├── PoppyRecruitmentModule.tsx     # Poppy v1.0 Hub, 4-role recruitment studio, consent revocation & JSON validator
│   │   ├── VideoInterviewStudioPanel.tsx  # Webcam/upload anti-deepfake liveness verification & HR pre-screening
│   │   ├── LiveInterviewRoomModal.tsx     # Live interview room modal
│   │   ├── NegotiationArenaModule.tsx     # Bilateral Gemini A2A negotiation & Reverse-RFP broadcaster
│   │   ├── RegistryMarketplaceModule.tsx  # .agent handle search, English auctions & x402 claims
│   │   ├── SpatialMapsDiscovery.tsx       # Google Maps -> Mapbox failover radar, Wi-Fi/BLE proximity & job matching
│   │   ├── ContactsHubModule.tsx          # Saved contacts book with source filters & notes
│   │   ├── OmnichannelCommsModule.tsx     # Gemini inbox triage & autonomous calendar bookings
│   │   ├── AgentMailInboxModule.tsx       # Live AgentMail thread reader & composer
│   │   ├── AgentDialerModal.tsx           # Predictive number/T9/handle dialer & $0.00 911/112/999 dispatch
│   │   ├── AgentSkillsPage.tsx            # External agent skill docs & protocol explorer
│   │   ├── ChromeExtensionHub.tsx         # Manifest V3 Chrome Extension preview & ZIP exporter
│   │   ├── DeveloperLedgerModule.tsx      # Settlement audit ledger & multi-currency selector
│   │   ├── SurfaceSimulatorFrame.tsx      # Desktop / Mobile / CarPlay / XR viewport simulator
│   │   ├── BurgerMenuDrawer.tsx           # Quick navigation drawer & legal links
│   │   ├── PWAInstallButton.tsx           # Adaptive OS/browser PWA install prompt & offline badge
│   │   └── SwipeScrollArea.tsx            # Touch/wheel/keyboard scroller
│   ├── services/
│   │   ├── poppyProtocol.ts               # Poppy v1.0 manifest builders, RFC 9651 header parser & validator
│   │   ├── recruitmentMatcher.ts          # Weighted candidate <-> job match scorer & bulk auto-matcher
│   │   ├── paymentRails.ts                # Handle tier quoting & x402/PayPal settlement helpers
│   │   ├── calendarAgentTool.ts           # Google/Outlook/.ics calendar export utilities
│   │   └── gmailAgentBridge.ts            # Gmail REST API bridge helper
│   ├── lib/
│   │   ├── firebase.ts                    # Firebase App, Auth, Workspace OAuth token handling & Firestore init
│   │   ├── fx.ts                          # 13-currency FX catalog, formatting & geo/timezone currency detector
│   │   ├── docExport.ts                   # ATS-clean PDF (jspdf) & DOCX (docx) exporters for tailored CVs & cover letters
│   │   ├── agentImages.ts                 # Verified visual media presets
│   │   ├── theme.tsx                      # Light/dark theme provider
│   │   └── toast.tsx                      # Notification toast bus
│   ├── store/
│   │   └── useSwitchboardStore.ts         # Unified state, Firestore real-time sync & localStorage persistence
│   ├── data/
│   │   ├── seedData.ts                    # Verified agents, 10-region OpenAI roles, RFPs, auctions & status posts
│   │   └── legalDocuments.ts              # Unified SWITCHZ legal suite (Terms, Privacy/POPIA/GDPR, Employer Fee Agreement)
│   └── types/
│       └── firestore.ts                   # TypeScript domain interfaces & currency conversion helpers
├── firebase-blueprint.json                # JSON schema for the 8 Firestore collections
├── firestore.rules                        # Production Firestore security rules
├── firebase-applet-config.json            # Firebase client config
├── vite.config.ts                         # Vite, Tailwind CSS v4 & VitePWA Workbox configuration
├── metadata.json                          # SWITCHZ platform manifest & capabilities
├── package.json                           # Scripts & dependencies
└── .env.example                           # Environment template
```

---

## Local Development & Production Build

### Prerequisites
- **Node.js** `>= 20`
- **npm**

### Commands
```bash
# Install dependencies
npm install

# Start full-stack Express + Vite development server on http://localhost:3000
npm run dev

# Run TypeScript type check
npm run lint

# Build production client bundle & PWA service worker into dist/
npm run build

# Run production server (serves dist/ alongside API routes)
NODE_ENV=production npm start
```
