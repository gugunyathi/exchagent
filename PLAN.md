# Implementation Plan: Universal x402 Payment Protocol & Revenue Engine

1. **Domain Types & Catalog Models (`src/types/firestore.ts`)**:
   - [x] Define `X402PayableCategory`, `X402SkuCatalogItem`, `X402PaymentReceipt`, `X402AccountEntitlement`, `AdCampaignDoc`, and `X402ChallengePayload` interfaces.
   - [x] Export canonical monetization catalog constants (`FREE_MATCH_LIMIT = 10`, match packs, sponsored ad boosts, `.agent` domain registrations, dedicated `@agentmail.to` email plans, priority RFP broadcasts, Event Autopilot Pro, video verification packs, and A2A API credits).

2. **Durable Backend x402 Store & Protocol Router (`server/dbStore.ts`, `server/x402Router.ts`, `server/poppyRouter.ts`, `server/agentmailRouter.ts`, `server.ts`)**:
   - [x] Extend `SwitchzDatabaseState` in `server/dbStore.ts` with `x402Receipts`, `x402Entitlements`, and `adCampaigns` persisted atomically to `.data/switchz-db.json`.
   - [x] Create `server/x402Router.ts` implementing `GET /api/x402/catalog`, `POST /api/x402/challenge`, `POST /api/x402/settle`, `POST /api/x402/wallet/topup`, `GET /api/x402/receipts`, `GET /api/ads`, `POST /api/ads/create`, and `POST /api/ads/:id/event`.
   - [x] Enforce HTTP `402 Payment Required` on matches above 10 free matches (`POST /api/recruitment/linkedin-quickstart`, `POST /api/agents/autonomous-match`), domain claims & buyouts (`POST /api/names/claim`, `POST /api/names/buyout`), sponsored ads (`POST /api/ads/create`), priority RFPs (`POST /api/rfp/broadcast`), and extra AgentMail inboxes & bulk email packs (`POST /api/agentmail/inboxes`, `POST /api/agentmail/send`).

3. **Frontend x402 Client, Global Checkout Modal & Store Integration (`src/lib/x402Client.ts`, `src/store/useSwitchboardStore.ts`, `src/components/X402PaymentModal.tsx`)**:
   - [x] Implement `src/lib/x402Client.ts` for challenge creation, signature/token generation, 402 interception, and autonomous agent auto-pay within guardrails.
   - [x] Build `X402PaymentModal.tsx` allowing humans or autonomous agents to authorize any x402 challenge (Base USDC, Arc, Solana, PayPal Vault, or Autonomous Agent Wallet) with live FX conversion and verifiable receipts.
   - [x] Wire x402 state, entitlement quota (`freeMatchesRemaining`, `bonusMatchCredits`, `unlimitedMatches`), ad campaigns, and gated actions in `useSwitchboardStore.ts`.

4. **Revenue Surfaces & UI Upgrades (`src/components/X402RevenueHub.tsx`, `src/components/DeveloperLedgerModule.tsx`, `src/components/IntentProfilePage.tsx`, `src/components/RegistryMarketplaceModule.tsx`, `src/components/PostStatusModal.tsx`, `src/components/AgentMailInboxModule.tsx`, `src/components/QuickJobAgentModal.tsx`, `src/components/BurgerMenuDrawer.tsx`, `src/App.tsx`)**:
   - [x] Create `X402RevenueHub.tsx` as a dedicated Revenue, Match Quota, Ads Manager & x402 Wallet console (accessible from Menu Drawer `Ledger & x402` and `Audit Ledger`).
   - [x] Connect `10 Free Matches` metering & 1-click x402 upgrade across QuickJobAgent and Intent & Match.
   - [x] Connect Sponsored Ad x402 checkout in `PostStatusModal.tsx` and real x402 settlement in `RegistryMarketplaceModule.tsx` & `AgentMailInboxModule.tsx`.

5. **Firestore Blueprint, Security Rules & End-to-End Verification (`firebase-blueprint.json`, `firestore.rules`, `README.md`)**:
   - [x] Update `firebase-blueprint.json` and `firestore.rules` with `x402_receipts`, `ad_campaigns`, and `x402_entitlements`, lint with `@firebase/eslint-plugin-security-rules`, and deploy rules via `DeployRules`.
   - [x] Run `compile_applet`, `lint_applet`, restart dev server, and run `curl` verification across all x402 endpoints (`402` challenge -> settle -> receipt -> quota unlock), plus deliver a comprehensive Day-1 Production & Revenue Readiness Assessment.
