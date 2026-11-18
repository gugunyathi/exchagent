import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type, FunctionDeclaration } from '@google/genai';
import {
  SEED_AGENTS,
  SEED_RFPS,
  SEED_AUCTIONS,
  SEED_CLAIMED_HANDLES,
  SEED_SECONDARY_LISTINGS,
  SEED_JOBS,
  SEED_EVENT_PEERS,
} from './src/data/seedData';
import { quoteHandlePricing } from './src/services/paymentRails';
import {
  ZAR_PER_USD,
  ProximityPeerDoc,
  AutonomousMatchItem,
} from './src/types/firestore';
import {
  CURRENCY_CATALOG,
  DEFAULT_RATES_PER_USD,
  LocalCurrencyCode,
  detectCurrencyFromCoords,
  detectCurrencyFromCountryCode,
} from './src/lib/fx';
import { createPoppyRouter } from './server/poppyRouter';
import { createAgentMailRouter } from './server/agentmailRouter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const negotiateTools: FunctionDeclaration[] = [
  {
    name: 'check_margin_guardrail',
    description: 'Verify whether a proposed price meets the buyer maxAutoSpendZAR and seller minDiscountPct guardrails.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        proposedPriceZAR: { type: Type.NUMBER, description: 'Proposed deal price in ZAR' },
        stickerPriceZAR: { type: Type.NUMBER, description: 'Original sticker price in ZAR' },
        maxAutoSpendZAR: { type: Type.NUMBER, description: 'Buyer maximum autonomous spend limit in ZAR' },
      },
      required: ['proposedPriceZAR', 'stickerPriceZAR', 'maxAutoSpendZAR'],
    },
  },
  {
    name: 'book_calendar_meeting',
    description: 'Schedule a follow-up sign-off meeting when a negotiation reaches acceptance.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Meeting title' },
        dealValueZAR: { type: Type.NUMBER, description: 'Agreed deal value in ZAR' },
      },
      required: ['title', 'dealValueZAR'],
    },
  },
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  // Health & Public non-secret config
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'switchboard-agentpages',
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  let fxCache: {
    rates: Record<LocalCurrencyCode, number>;
    updatedAt: number;
    source: 'live' | 'reference';
  } = {
    rates: { ...DEFAULT_RATES_PER_USD },
    updatedAt: 0,
    source: 'reference',
  };

  async function refreshFxRates(): Promise<typeof fxCache> {
    const now = Date.now();
    if (fxCache.source === 'live' && now - fxCache.updatedAt < 60 * 60 * 1000) {
      return fxCache;
    }
    try {
      const resp = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(3500),
      });
      if (resp.ok) {
        const json = (await resp.json()) as {
          result?: string;
          rates?: Record<string, number>;
        };
        if (json?.rates && typeof json.rates === 'object') {
          const merged = { ...DEFAULT_RATES_PER_USD };
          for (const code of Object.keys(CURRENCY_CATALOG) as LocalCurrencyCode[]) {
            const val = json.rates[code];
            if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
              merged[code] = val;
            }
          }
          fxCache = {
            rates: merged,
            updatedAt: now,
            source: 'live',
          };
          return fxCache;
        }
      }
    } catch {
      // Fallback gracefully to reference rates if offline or upstream unavailable
    }
    if (fxCache.updatedAt === 0) {
      fxCache = { ...fxCache, updatedAt: now };
    }
    return fxCache;
  }

  app.get('/api/fx/rates', async (req, res) => {
    const snapshot = await refreshFxRates();

    const latParam = Number(req.query.lat);
    const lngParam = Number(req.query.lng);
    let geoHit: { currency: LocalCurrencyCode; locationLabel: string } | null = null;
    let geoMatched = false;

    if (Number.isFinite(latParam) && Number.isFinite(lngParam) && req.query.lat !== undefined && req.query.lng !== undefined) {
      geoHit = detectCurrencyFromCoords(latParam, lngParam);
      if (geoHit) geoMatched = true;
    }

    if (!geoHit) {
      const headerCountry =
        (req.headers['x-appengine-country'] as string | undefined) ||
        (req.headers['cf-ipcountry'] as string | undefined) ||
        (req.headers['x-vercel-ip-country'] as string | undefined) ||
        (req.headers['x-country-code'] as string | undefined);
      if (headerCountry && headerCountry !== 'ZZ') {
        geoHit = detectCurrencyFromCountryCode(headerCountry);
        if (geoHit) geoMatched = true;
      }
    }

    if (!geoHit) {
      const acceptLang = String(req.headers['accept-language'] || '');
      const firstTag = acceptLang.split(',')[0]?.split(';')[0]?.trim() || '';
      const subParts = firstTag.split('-');
      if (subParts.length >= 2) {
        geoHit = detectCurrencyFromCountryCode(subParts[subParts.length - 1]);
      }
    }

    res.json({
      base: 'USD',
      rates: snapshot.rates,
      source: snapshot.source,
      updatedAt: new Date(snapshot.updatedAt).toISOString(),
      suggestedCurrency: geoHit?.currency || 'USD',
      suggestedLocationLabel: geoHit?.locationLabel || 'United States',
      geoMatched,
    });
  });

  app.get('/api/config/public', (_req, res) => {
    const mapsKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.MAPS_API_KEY ||
      '';
    const mapboxToken =
      process.env.VITE_MAPBOX_ACCESS_TOKEN ||
      process.env.VITE_MAPBOX_API_KEY ||
      process.env.MAPBOX_ACCESS_TOKEN ||
      process.env.MAPBOX_API_KEY ||
      process.env.MAPBOX_TOKEN ||
      process.env.MAPBOX_PUBLIC_TOKEN ||
      '';
    res.json({
      googleMapsApiKey: mapsKey,
      hasGoogleMapsKey: Boolean(mapsKey),
      mapboxAccessToken: mapboxToken,
      hasMapboxKey: Boolean(mapboxToken),
      zarPerUsd: fxCache.rates.ZAR || ZAR_PER_USD,
      appUrl: process.env.APP_URL || '',
    });
  });

  // Protocol discovery endpoints
  app.get('/.well-known/agent.json', (_req, res) => {
    res.json({
      schema: 'https://switchboard.agent/schemas/agent-v1.json',
      name: 'SWITCHZ (Silvernest Pty Ltd)',
      handle: 'directory.switchboard.agent',
      capabilities: [
        'a2a-negotiation',
        'reverse-rfp',
        'x402-settlement',
        'paypal-vault',
        'calendar-scheduling',
        'agentic-email',
        'poppy-protocol-v1',
        'operations-v3-hitl',
        'autonomous-recruitment',
      ],
      endpoints: {
        skillsMarkdown: '/skills.md',
        skillsCatalog: '/api/skills',
        poppyDiscovery: '/.well-known/poppy.json',
        poppyConversations: '/api/poppy/conversations',
        poppyOperations: '/api/poppy/operations/execute',
        poppyTasks: '/api/poppy/tasks',
        recruitmentCvParse: '/api/recruitment/cv-parse',
        recruitmentMatch: '/api/recruitment/match',
        directory: '/api/agents/directory',
        negotiate: '/api/a2a/negotiate',
        rfpBroadcast: '/api/rfp/broadcast',
        rfpMatch: '/api/rfp/match',
        namesSearch: '/api/names/search',
        namesClaim: '/api/names/claim',
        emailTriage: '/api/email/triage',
        voiceTurn: '/api/voice/turn',
        openapi: '/api/skill.json',
      },
      popiaCompliant: true,
    });
  });

  // Mount Poppy v1.0 Protocol + Extensions + Autonomous Recruitment Router
  app.use(createPoppyRouter());

  // Mount AgentMail Inbox & Messaging Router (exchagent@agentmail.to)
  app.use(createAgentMailRouter());

  app.get('/llms.txt', (_req, res) => {
    res.type('text/plain').send(
      [
        '# Switchboard (AgentPages) — Agentic Yellow Pages & Reverse-RFP Network',
        '> Machine-readable directory for verified .agent handles, bilateral A2A negotiation, and x402/PayPal settlement.',
        '',
        '## Agent Skill Instructions',
        '- GET /skills.md — Full markdown skill specification for external AI agents',
        '- GET /api/skills — Structured JSON catalog of all Switchboard skills',
        '',
        '## Endpoints',
        '- GET /api/agents/directory — Query verified business and persona agents',
        '- POST /api/a2a/negotiate — Run bilateral Gemini A2A negotiation loop',
        '- POST /api/rfp/broadcast — Publish a reverse-RFP to directory, DOOH billboards, and BLE beacons',
        '- GET /api/names/search?q=<handle> — Check .agent handle pricing, civic protection, and auction status',
        '- POST /api/email/triage — Autonomous Gemini email engage triage & auto-reply',
        '- POST /api/voice/turn — Voice/chat agent dialer including 911 civic priority dispatch',
        '- GET /api/skill.json — OpenAPI 3.1 tool schema for Claude, Gemini, and GPT agents',
      ].join('\n')
    );
  });

  app.get('/skills.md', (_req, res) => {
    res.type('text/markdown').send(
      [
        '---',
        'name: switchboard-agentpages',
        'version: 2027.1.0',
        'protocol: A2A / MCP-1.0 / HTTP-402 (x402)',
        '---',
        '',
        '# Switchboard (AgentPages) External Agent Skill Guide',
        '',
        'External AI agents (Gemini, Claude, GPT, OpenClaw, or custom MCP clients) can interact with Switchboard via the endpoints below:',
        '',
        '## 1. Lookup Verified Personal & Business Agents (`directory.lookup`)',
        '- `GET /api/agents/directory?q=<query>&type=persona|business&discoverable=true`',
        '- Returns DID (`did:linkedin:...` or `did:web:...`), voice line, `@switchboard.agent` email, MCP interact endpoint, and spending guardrails.',
        '',
        '## 2. Run Bilateral A2A Commercial Negotiation (`a2a.negotiate`)',
        '- `POST /api/a2a/negotiate`',
        '- Body: `{ "initiatorHandle": "chris.moleme.agent", "targetHandle": "ceo.woolworths.agent", "proposalTitle": "...", "stickerPriceZAR": 95000 }`',
        '',
        '## 3. Publish Reverse-RFP Across Directory, DOOH & BLE (`rfp.broadcast`)',
        '- `POST /api/rfp/broadcast`',
        '- Body: `{ "title": "...", "description": "...", "budgetZAR": 165000, "broadcastChannels": ["directory", "google_maps_billboard", "ble_beacon"] }`',
        '',
        '## 4. Quote & Claim `.agent` Handles with x402 (`names.search`, `names.claim`)',
        '- `GET /api/names/search?q=007`',
        '- `POST /api/names/claim` (returns `402 Payment Required` with USDC x402 instructions for bot/short-handle tiers; `403` for protected civic numbers `911`, `112`, `999`, `10111`).',
        '',
        '## 5. Spatial Passerby Geofence Match (`spatial.passerby_match`)',
        '- `POST /api/rfp/match` with `{ "userHandle": "...", "targetHandle": "...", "locationLabel": "...", "distanceMeters": 28 }`',
        '',
        '## 6. Autonomous Email Triage & Voice / 911 SOS (`comms.email_triage`, `voice.dial_or_sos`)',
        '- `POST /api/email/triage`',
        '- `POST /api/voice/turn` (dial `"911"` for `$0.00` Civic Priority Emergency Dispatch).',
      ].join('\n')
    );
  });

  app.get('/api/skills', (_req, res) => {
    res.json({
      service: 'SWITCHZ',
      operator: 'Silvernest Pty Ltd',
      version: '2027.1.0',
      discovery: {
        skillsMarkdown: '/skills.md',
        openapi: '/api/skill.json',
        agentCard: '/.well-known/agent.json',
        poppyManifest: '/.well-known/poppy.json',
        agentSkillsIndex: '/.well-known/agent-skills/index.json',
        oauthProtectedResource: '/.well-known/oauth-protected-resource',
        oauthAuthServer: '/.well-known/oauth-authorization-server',
        llmsTxt: '/llms.txt',
      },
      skills: [
        {
          id: 'directory.lookup',
          method: 'GET',
          path: '/api/agents/directory',
          query: ['q', 'type', 'discoverable'],
        },
        {
          id: 'a2a.negotiate',
          method: 'POST',
          path: '/api/a2a/negotiate',
          requiredBody: ['targetHandle', 'proposalTitle', 'stickerPriceZAR'],
        },
        {
          id: 'rfp.broadcast',
          method: 'POST',
          path: '/api/rfp/broadcast',
          requiredBody: ['title', 'budgetZAR'],
        },
        {
          id: 'names.search',
          method: 'GET',
          path: '/api/names/search',
          query: ['q'],
        },
        {
          id: 'names.claim',
          method: 'POST',
          path: '/api/names/claim',
          requiredBody: ['handle'],
          paymentProtocol: 'x402',
        },
        {
          id: 'spatial.passerby_match',
          method: 'POST',
          path: '/api/rfp/match',
          requiredBody: ['targetHandle', 'distanceMeters'],
        },
        {
          id: 'comms.email_triage',
          method: 'POST',
          path: '/api/email/triage',
          requiredBody: ['toAddress', 'subject', 'body'],
        },
        {
          id: 'voice.dial_or_sos',
          method: 'POST',
          path: '/api/voice/turn',
          requiredBody: ['targetHandle', 'userMessage'],
        },
      ],
    });
  });

  app.get('/api/skill.json', (_req, res) => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'Switchboard (AgentPages) A2A Protocol API',
        version: '2027.1.0',
        description:
          'Agentic Yellow Pages directory, bilateral A2A negotiation engine, Reverse-RFP broadcaster, .agent identity registry, and x402 / PayPal Vault settlement API.',
      },
      paths: {
        '/api/agents/directory': {
          get: {
            summary: 'List and filter verified .agent profiles',
            parameters: [
              { name: 'type', in: 'query', schema: { type: 'string', enum: ['persona', 'business'] } },
              { name: 'q', in: 'query', schema: { type: 'string' } },
              { name: 'discoverable', in: 'query', schema: { type: 'boolean' } },
            ],
            responses: { '200': { description: 'Array of verified AgentDoc profiles' } },
          },
        },
        '/api/a2a/negotiate': {
          post: {
            summary: 'Execute Gemini-powered bilateral A2A negotiation turn',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      initiatorHandle: { type: 'string' },
                      targetHandle: { type: 'string' },
                      proposalTitle: { type: 'string' },
                      stickerPriceZAR: { type: 'number' },
                      surface: { type: 'string' },
                    },
                    required: ['targetHandle', 'proposalTitle', 'stickerPriceZAR'],
                  },
                },
              },
            },
            responses: { '200': { description: 'Structured A2A negotiation transcript & agreed offer' } },
          },
        },
        '/api/rfp/broadcast': {
          post: {
            summary: 'Broadcast reverse-RFP across directory, DOOH billboards, BLE beacons, and CarPlay',
            responses: { '200': { description: 'Broadcast confirmation with matched agent proposals' } },
          },
        },
        '/api/names/search': {
          get: {
            summary: 'Search .agent handle or shortcode availability, sliding-scale pricing, and auction status',
            parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'HandlePricingQuote & registry status' } },
          },
        },
        '/api/names/claim': {
          post: {
            summary: 'Claim available .agent handle (supports HTTP 402 x402 payment header)',
            responses: {
              '200': { description: 'Handle claimed' },
              '402': { description: 'x402 Payment Required challenge for bot/premium tiers' },
            },
          },
        },
      },
    });
  });

  // Directory endpoint
  app.get('/api/agents/directory', (req, res) => {
    const type = String(req.query.type || '');
    const q = String(req.query.q || '').toLowerCase();
    const discoverable = req.query.discoverable === 'true';

    const filtered = SEED_AGENTS.filter((a) => {
      if (type && a.type !== type) return false;
      if (discoverable && !a.discoverableByPassersby) return false;
      if (
        q &&
        !a.handle.toLowerCase().includes(q) &&
        !a.displayName.toLowerCase().includes(q) &&
        !a.organization.toLowerCase().includes(q) &&
        !a.skills.some((s) => s.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });

    res.json({ count: filtered.length, agents: filtered });
  });

  // Bilateral A2A Negotiation via Gemini 4 Hydrogen + Function Calling
  app.post('/api/a2a/negotiate', async (req, res) => {
    const {
      initiatorHandle = 'alex.founder.agent',
      targetHandle = 'ceo.woolworths.agent',
      proposalTitle = 'Enterprise AI & Cold-Chain Telemetry Deployment',
      stickerPriceZAR = 120000,
      surface = 'desktop',
      targetMaxSpendZAR = 450000,
      targetMinDiscountPct = 14,
    } = req.body || {};

    const startTime = Date.now();
    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = [
          `Simulate a realistic 4-turn bilateral Agent-to-Agent (A2A) commercial negotiation on Switchboard.`,
          `Seller/Initiator: ${initiatorHandle}`,
          `Buyer/Target: ${targetHandle}`,
          `Surface: ${surface}`,
          `Proposal: "${proposalTitle}"`,
          `Sticker Price: R${stickerPriceZAR} ZAR`,
          `Buyer Guardrails: maxAutoSpendZAR = R${targetMaxSpendZAR}, minDiscountPct = ${targetMinDiscountPct}%.`,
          `Enforce POPIA consent verification and negotiate fairly so the final agreedPriceZAR satisfies minDiscountPct where reasonable.`,
          `Return strictly JSON matching the schema with 4 messages (offer, counter_offer, counter_offer, accept or reject).`,
        ].join('\n');

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            tools: [{ functionDeclarations: negotiateTools }],
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                finalStatus: { type: Type.STRING, enum: ['OFFER_ACCEPTED', 'REJECTED'] },
                agreedPriceZAR: { type: Type.NUMBER },
                popiaConsentVerified: { type: Type.BOOLEAN },
                calendarMeetingTitle: { type: Type.STRING },
                messages: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sender: { type: Type.STRING },
                      senderRole: { type: Type.STRING, enum: ['seller', 'buyer'] },
                      type: { type: Type.STRING, enum: ['offer', 'counter_offer', 'accept', 'reject'] },
                      priceZAR: { type: Type.NUMBER },
                      rationale: { type: Type.STRING },
                      toolCall: { type: Type.STRING },
                    },
                    required: ['sender', 'senderRole', 'type', 'priceZAR', 'rationale'],
                  },
                },
              },
              required: ['finalStatus', 'agreedPriceZAR', 'popiaConsentVerified', 'messages'],
            },
          },
        });

        const parsed = JSON.parse((response.text || '{}').trim());
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          const now = Date.now();
          const messages = parsed.messages.map((m: Record<string, unknown>, i: number) => ({
            ...m,
            timestamp: new Date(now + i * 1800).toISOString(),
          }));
          return res.json({
            engine: 'gemini-4-hydrogen',
            latencyMs: Date.now() - startTime,
            finalStatus: parsed.finalStatus || 'OFFER_ACCEPTED',
            agreedPriceZAR: parsed.agreedPriceZAR || Math.round(stickerPriceZAR * (1 - targetMinDiscountPct / 100)),
            popiaAuditHash: `popia_sha256_${Math.random().toString(36).slice(2, 12)}`,
            calendarMeetingTitle: parsed.calendarMeetingTitle || `${proposalTitle} — SLA Kickoff`,
            messages,
          });
        }
      } catch (err) {
        console.warn('Gemini A2A fallback activated:', err instanceof Error ? err.message : err);
      }
    }

    // Deterministic high-speed fallback if key missing or quota reached
    const discountPct = Math.max(targetMinDiscountPct, 12);
    const round1 = Math.round(stickerPriceZAR);
    const round2 = Math.round(stickerPriceZAR * (1 - (discountPct + 6) / 100));
    const round3 = Math.round(stickerPriceZAR * (1 - (discountPct + 1.5) / 100));
    const finalStatus = round3 <= targetMaxSpendZAR ? 'OFFER_ACCEPTED' : 'REJECTED';
    const now = Date.now();

    return res.json({
      engine: 'switchboard-guardrail-engine',
      latencyMs: Date.now() - startTime,
      finalStatus,
      agreedPriceZAR: round3,
      popiaAuditHash: `popia_sha256_${Math.random().toString(36).slice(2, 12)}`,
      calendarMeetingTitle: `${proposalTitle} — Contract & Settlement Sign-Off`,
      messages: [
        {
          sender: initiatorHandle,
          senderRole: 'seller',
          type: 'offer',
          priceZAR: round1,
          rationale: `POPIA data minimization token attached. Opening commercial proposal for "${proposalTitle}".`,
          timestamp: new Date(now).toISOString(),
        },
        {
          sender: targetHandle,
          senderRole: 'buyer',
          type: 'counter_offer',
          priceZAR: round2,
          rationale: `Guardrail check requires >=${discountPct}% discount and automated PayPal Vault / x402 settlement.`,
          toolCall: `check_margin_guardrail(proposed=${round2}, minDiscountPct=${discountPct})`,
          timestamp: new Date(now + 1200).toISOString(),
        },
        {
          sender: initiatorHandle,
          senderRole: 'seller',
          type: 'counter_offer',
          priceZAR: round3,
          rationale: `Conceding ${(discountPct + 1.5).toFixed(1)}% off sticker with 48h Sandton deployment SLA & x402 Base escrow.`,
          timestamp: new Date(now + 2400).toISOString(),
        },
        {
          sender: targetHandle,
          senderRole: 'buyer',
          type: finalStatus === 'OFFER_ACCEPTED' ? 'accept' : 'reject',
          priceZAR: round3,
          rationale:
            finalStatus === 'OFFER_ACCEPTED'
              ? `Offer R${round3.toLocaleString('en-ZA')} satisfies maxAutoSpendZAR (R${targetMaxSpendZAR.toLocaleString('en-ZA')}). Triggering settlement & calendar booking.`
              : `Offer R${round3.toLocaleString('en-ZA')} exceeds maxAutoSpendZAR ceiling (R${targetMaxSpendZAR.toLocaleString('en-ZA')}). Escalating to human owner.`,
          toolCall:
            finalStatus === 'OFFER_ACCEPTED'
              ? `book_calendar_meeting(dealValueZAR=${round3})`
              : undefined,
          timestamp: new Date(now + 3600).toISOString(),
        },
      ],
    });
  });

  // Reverse-RFP Broadcast + Auto-Match
  app.post('/api/rfp/broadcast', async (req, res) => {
    const {
      title = 'Autonomous Solar Micro-Grid RFP',
      description = 'Need battery backup and smart telemetry across Johannesburg.',
      budgetZAR = 180000,
      category = 'Clean Energy & Telecom',
      broadcastChannels = ['directory', 'google_maps_billboard', 'ble_beacon'],
    } = req.body || {};

    const ai = getGeminiClient();
    const candidates = SEED_AGENTS.filter((a) => a.handle !== '911.emergency.agent').slice(0, 3);

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Evaluate this Reverse-RFP and generate 3 competitive vendor agent bids in JSON:\nTitle: ${title}\nBudget: R${budgetZAR}\nCategory: ${category}\nDescription: ${description}\nVendors: ${candidates.map((c) => c.handle).join(', ')}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                proposals: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      vendorHandle: { type: Type.STRING },
                      bidZAR: { type: Type.NUMBER },
                      matchScore: { type: Type.NUMBER },
                      engageSummary: { type: Type.STRING },
                    },
                    required: ['vendorHandle', 'bidZAR', 'matchScore', 'engageSummary'],
                  },
                },
              },
              required: ['proposals'],
            },
          },
        });
        const parsed = JSON.parse((response.text || '{}').trim());
        if (Array.isArray(parsed.proposals) && parsed.proposals.length > 0) {
          return res.json({
            engine: 'gemini-4-hydrogen',
            broadcastChannels,
            proposals: parsed.proposals,
          });
        }
      } catch (err) {
        console.warn('RFP broadcast Gemini fallback:', err instanceof Error ? err.message : err);
      }
    }

    return res.json({
      engine: 'switchboard-rfp-matcher',
      broadcastChannels,
      proposals: candidates.map((c, idx) => ({
        vendorHandle: c.handle,
        bidZAR: Math.round(budgetZAR * (0.84 + idx * 0.04)),
        matchScore: 95 - idx * 4,
        engageSummary: `${c.displayName} auto-matched via ${broadcastChannels.join(' + ')} with ${16 - idx * 4}% instant savings.`,
      })),
    });
  });

  // Passerby Spatial Handshake Evaluator
  app.post('/api/rfp/match', async (req, res) => {
    const { userHandle = 'alex.founder.agent', targetHandle, locationLabel, distanceMeters } = req.body || {};
    const agent = SEED_AGENTS.find((a) => a.handle === targetHandle);
    const incentive = agent?.passerbyIncentive || 'Instant 15% Passerby Flash Offer via x402 Base';
    const ai = getGeminiClient();

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `In 1 concise sentence (max 22 words), explain the ambient spatial handshake when ${userHandle} walks within ${distanceMeters}m of ${targetHandle} at ${locationLabel} with incentive: "${incentive}".`,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
        });
        if (response.text) {
          return res.json({ summary: response.text.trim(), matchScore: 94, incentive });
        }
      } catch {
        // fallback below
      }
    }

    return res.json({
      summary: `${userHandle} locked onto ${targetHandle} (${distanceMeters}m BLE/Geofence at ${locationLabel}) — ${incentive}.`,
      matchScore: 94,
      incentive,
    });
  });

  // Same Wi-Fi LAN, Bluetooth/BLE & Bi-Directional Compass/Gyro Proximity Event Mesh Registry
  interface StoredProximityPeer extends ProximityPeerDoc {
    expiresAtMs: number;
  }
  const activeProximityPeers = new Map<string, StoredProximityPeer>();
  const meshRoomSockets = new Map<string, Set<WebSocket>>();
  const proximityExchangeLogs: Array<{
    id: string;
    fromHandle: string;
    toHandle: string;
    roomCode: string;
    transport: string;
    mode: 'card_share' | 'share_and_negotiate';
    timestamp: string;
  }> = [];

  function extractClientSubnetTag(req: express.Request): string {
    const rawForwarded = String(req.headers['x-forwarded-for'] || '');
    const clientIp =
      (rawForwarded.split(',')[0] || '').trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      '127.0.0.1';
    const normalized = clientIp.replace('::ffff:', '');
    const parts = normalized.split('.');
    const prefix = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}` : normalized.slice(0, 16);
    const digest = crypto.createHash('sha256').update(prefix).digest('hex').slice(0, 6);
    return `wifi-lan-${digest}`;
  }

  function pruneExpiredPeers() {
    const now = Date.now();
    for (const [key, peer] of activeProximityPeers.entries()) {
      if (peer.expiresAtMs <= now) {
        activeProximityPeers.delete(key);
      }
    }
  }

  function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  function computeBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => ((r * 180) / Math.PI + 360) % 360;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const dLam = toRad(lng2 - lng1);
    const y = Math.sin(dLam) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
    return Math.round(toDeg(Math.atan2(y, x)));
  }

  function angularDiffDeg(a: number, b: number): number {
    const d = Math.abs(((a - b + 540) % 360) - 180);
    return d;
  }

  function broadcastToMeshRoom(roomCode: string, payload: unknown) {
    const sockets = meshRoomSockets.get(roomCode.toLowerCase());
    if (!sockets || sockets.size === 0) return;
    const raw = JSON.stringify(payload);
    for (const sock of sockets) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(raw);
      }
    }
  }

  function enrichPeerWithSpatialGeometry(
    peer: ProximityPeerDoc,
    callerLat?: number,
    callerLng?: number,
    callerHeading?: number
  ): ProximityPeerDoc {
    let distanceMeters = peer.distanceMeters;
    let relativeBearingDeg = peer.relativeBearingDeg;
    let mutualBearingLock = false;

    if (
      typeof callerLat === 'number' &&
      typeof callerLng === 'number' &&
      typeof peer.lat === 'number' &&
      typeof peer.lng === 'number' &&
      (Math.abs(callerLat - peer.lat) > 0.00001 || Math.abs(callerLng - peer.lng) > 0.00001)
    ) {
      const geoDist = haversineMeters(callerLat, callerLng, peer.lat, peer.lng);
      distanceMeters = geoDist;
      relativeBearingDeg = computeBearingDeg(callerLat, callerLng, peer.lat, peer.lng);
      const bearingPeerToCaller = computeBearingDeg(peer.lat, peer.lng, callerLat, callerLng);

      if (typeof callerHeading === 'number' && typeof peer.headingDeg === 'number') {
        const callerFacingPeer = angularDiffDeg(callerHeading, relativeBearingDeg) <= 48;
        const peerFacingCaller = angularDiffDeg(peer.headingDeg, bearingPeerToCaller) <= 48;
        mutualBearingLock = callerFacingPeer && peerFacingCaller;
      }
    } else if (typeof callerHeading === 'number' && typeof peer.headingDeg === 'number') {
      // Fallback bi-directional facing calculation on relative room coordinates
      const oppositeHeading = (callerHeading + 180) % 360;
      mutualBearingLock = angularDiffDeg(peer.headingDeg, oppositeHeading) <= 45;
      relativeBearingDeg = relativeBearingDeg ?? ((peer.headingDeg + 180) % 360);
    }

    return {
      ...peer,
      distanceMeters,
      relativeBearingDeg,
      mutualBearingLock,
    };
  }

  app.post('/api/proximity/announce', (req, res) => {
    pruneExpiredPeers();
    const body = req.body || {};
    const handle = String(body.handle || '').trim();
    if (!handle) {
      return res.status(400).json({ error: 'handle is required to broadcast in proximity mesh.' });
    }

    const roomCode = String(body.roomCode || 'sandton-summit-2026').trim().toLowerCase();
    const key = `${roomCode}::${handle.toLowerCase()}`;

    if (body.active === false) {
      activeProximityPeers.delete(key);
      broadcastToMeshRoom(roomCode, { type: 'peer_removed', handle, roomCode });
      return res.json({ status: 'STOPPED', handle, roomCode });
    }

    const subnetTag = extractClientSubnetTag(req);
    const peer: StoredProximityPeer = {
      id: String(body.id || `peer_live_${crypto.randomBytes(4).toString('hex')}`),
      handle,
      ownerUid: body.ownerUid ? String(body.ownerUid) : undefined,
      displayName: String(body.displayName || handle),
      roleTitle: String(body.roleTitle || 'Agent Card'),
      organization: String(body.organization || 'Independent'),
      type: body.type === 'business' ? 'business' : 'persona',
      verified: body.verified !== false,
      intent: body.intent || 'networking',
      skills: Array.isArray(body.skills) ? body.skills.slice(0, 8).map(String) : [],
      impliedTopics: Array.isArray(body.impliedTopics) ? body.impliedTopics.slice(0, 12).map(String) : undefined,
      summary: body.summary ? String(body.summary) : undefined,
      imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
      brandLogoCode: body.brandLogoCode ? String(body.brandLogoCode) : undefined,
      brandColor: body.brandColor ? String(body.brandColor) : undefined,
      cardStyle: body.cardStyle && typeof body.cardStyle === 'object' ? body.cardStyle : undefined,
      voiceNumber: body.voiceNumber ? String(body.voiceNumber) : undefined,
      agentEmail: body.agentEmail ? String(body.agentEmail) : undefined,
      locationLabel: String(body.locationLabel || `Event Room · ${roomCode}`),
      distanceMeters: Number.isFinite(Number(body.distanceMeters)) ? Number(body.distanceMeters) : 8,
      transport: body.transport || 'same_wifi',
      roomCode,
      subnetTag,
      sameWifi: true,
      lat: Number.isFinite(Number(body.lat)) ? Number(body.lat) : undefined,
      lng: Number.isFinite(Number(body.lng)) ? Number(body.lng) : undefined,
      headingDeg: Number.isFinite(Number(body.headingDeg)) ? ((Number(body.headingDeg) % 360) + 360) % 360 : undefined,
      pitchDeg: Number.isFinite(Number(body.pitchDeg)) ? Number(body.pitchDeg) : undefined,
      rollDeg: Number.isFinite(Number(body.rollDeg)) ? Number(body.rollDeg) : undefined,
      broadcastRadiusMeters: Number.isFinite(Number(body.broadcastRadiusMeters)) ? Number(body.broadcastRadiusMeters) : 120,
      scanRadiusMeters: Number.isFinite(Number(body.scanRadiusMeters)) ? Number(body.scanRadiusMeters) : 150,
      incentive: body.incentive ? String(body.incentive) : undefined,
      matchedScore: 95,
      lastSeenAt: new Date().toISOString(),
      expiresAtMs: Date.now() + 10 * 60 * 1000,
    };

    activeProximityPeers.set(key, peer);
    const { expiresAtMs: _ignore, ...publicPeer } = peer;
    broadcastToMeshRoom(roomCode, { type: 'peer_upsert', peer: publicPeer });
    return res.json({
      status: 'BROADCASTING',
      subnetTag,
      peer: publicPeer,
      activeRoomCount: activeProximityPeers.size,
    });
  });

  app.get('/api/proximity/peers', (req, res) => {
    pruneExpiredPeers();
    const roomCode = String(req.query.room || 'sandton-summit-2026').trim().toLowerCase();
    const callerHandle = String(req.query.selfHandle || '').trim().toLowerCase();
    const includeBeacons = req.query.includeBeacons !== 'false';
    const callerSubnet = extractClientSubnetTag(req);
    const callerLat = Number.isFinite(Number(req.query.lat)) ? Number(req.query.lat) : undefined;
    const callerLng = Number.isFinite(Number(req.query.lng)) ? Number(req.query.lng) : undefined;
    const callerHeading = Number.isFinite(Number(req.query.heading)) ? Number(req.query.heading) : undefined;

    const livePeers: ProximityPeerDoc[] = [];
    for (const stored of activeProximityPeers.values()) {
      const matchesRoom = stored.roomCode === roomCode;
      const matchesSubnet = stored.subnetTag === callerSubnet;
      if (!matchesRoom && !matchesSubnet) continue;
      if (callerHandle && stored.handle.toLowerCase() === callerHandle) continue;
      const { expiresAtMs: _ignore, ...publicPeer } = stored;
      livePeers.push(
        enrichPeerWithSpatialGeometry(
          {
            ...publicPeer,
            sameWifi: matchesSubnet,
          },
          callerLat,
          callerLng,
          callerHeading
        )
      );
    }

    const seedPeers = includeBeacons
      ? SEED_EVENT_PEERS.filter((sp) => {
          if (callerHandle && sp.handle.toLowerCase() === callerHandle) return false;
          if (livePeers.some((lp) => lp.handle.toLowerCase() === sp.handle.toLowerCase())) return false;
          return roomCode === 'sandton-summit-2026' || roomCode === 'auto-wifi' || sp.roomCode === roomCode;
        }).map((sp) =>
          enrichPeerWithSpatialGeometry(
            {
              ...sp,
              roomCode: roomCode === 'auto-wifi' ? sp.roomCode : roomCode,
            },
            callerLat,
            callerLng,
            callerHeading
          )
        )
      : [];

    const combined = [...livePeers, ...seedPeers];
    res.json({
      roomCode,
      callerSubnet,
      count: combined.length,
      peers: combined,
    });
  });

  app.post('/api/proximity/exchange', (req, res) => {
    const {
      fromHandle = 'alex.founder.agent',
      toHandle,
      roomCode = 'sandton-summit-2026',
      transport = 'same_wifi',
      mode = 'card_share',
    } = req.body || {};

    if (!toHandle) {
      return res.status(400).json({ error: 'toHandle is required for proximity card exchange.' });
    }

    const record = {
      id: `exch_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      fromHandle: String(fromHandle),
      toHandle: String(toHandle),
      roomCode: String(roomCode),
      transport: String(transport),
      mode: mode === 'share_and_negotiate' ? ('share_and_negotiate' as const) : ('card_share' as const),
      timestamp: new Date().toISOString(),
    };
    proximityExchangeLogs.unshift(record);
    if (proximityExchangeLogs.length > 100) proximityExchangeLogs.length = 100;

    return res.json({
      status: 'EXCHANGED',
      record,
      message:
        record.mode === 'share_and_negotiate'
          ? `Card exchanged with ${record.toHandle} via ${record.transport} — A2A negotiation pre-loaded.`
          : `Shared your .agent card with ${record.toHandle} via ${record.transport}.`,
    });
  });

  // Smart AI Opportunity Scout across user's Personal Contacts, Jobs & RFPs (Strict Gemini API)
  app.post('/api/ai/opportunities', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        code: 'GEMINI_NOT_CONFIGURED',
        error:
          'GEMINI_API_KEY is not configured in server secrets. Add GEMINI_API_KEY to enable the Smart AI Opportunity Scout.',
      });
    }

    const { userAgent, contacts = [], jobs = SEED_JOBS, rfps = SEED_RFPS, recentPeers = [] } = req.body || {};
    if (!userAgent || !userAgent.handle) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'userAgent with handle is required.',
      });
    }

    try {
      const compactContacts = (Array.isArray(contacts) ? contacts : []).slice(0, 20).map((c: Record<string, unknown>) => ({
        id: c.id,
        handle: c.handle,
        displayName: c.displayName,
        organization: c.organization,
        roleTitle: c.roleTitle,
        type: c.type,
        skills: c.skills,
        source: c.source,
        sharedAtLocation: c.sharedAtLocation,
        notes: c.notes,
        maxAutoSpendZAR: (c.guardrails as Record<string, unknown> | undefined)?.maxAutoSpendZAR,
      }));

      const compactJobs = (Array.isArray(jobs) ? jobs : []).slice(0, 12).map((j: Record<string, unknown>) => ({
        id: j.id,
        title: j.title,
        companyName: j.companyName,
        companyAgentHandle: j.companyAgentHandle,
        remoteMode: j.remoteMode,
        salaryRangeZAR: j.salaryRangeZAR,
        requiredSkills: j.requiredSkills,
        location: j.location,
      }));

      const compactRfps = (Array.isArray(rfps) ? rfps : []).slice(0, 10).map((r: Record<string, unknown>) => ({
        id: r.id,
        title: r.title,
        publisherHandle: r.publisherHandle,
        budgetZAR: r.budgetZAR,
        category: r.category,
      }));

      const compactPeers = (Array.isArray(recentPeers) ? recentPeers : []).slice(0, 10).map((p: Record<string, unknown>) => ({
        handle: p.handle,
        displayName: p.displayName,
        intent: p.intent,
        incentive: p.incentive,
        locationLabel: p.locationLabel,
      }));

      const prompt = [
        `You are the autonomous Switchboard Opportunity Scout AI advising the human owner of ${userAgent.handle}.`,
        `Active User Agent:`,
        JSON.stringify({
          handle: userAgent.handle,
          displayName: userAgent.displayName,
          roleTitle: userAgent.roleTitle,
          organization: userAgent.organization,
          skills: userAgent.skills,
          cvSummary: userAgent.cvSummary,
          guardrails: userAgent.guardrails,
        }),
        `Personal Contacts (shared agent/business cards):`,
        JSON.stringify(compactContacts),
        `Open Jobs:`,
        JSON.stringify(compactJobs),
        `Active Reverse-RFPs:`,
        JSON.stringify(compactRfps),
        `Recent Nearby Event Peers:`,
        JSON.stringify(compactPeers),
        `Analyze all contacts, notes, shared locations, open jobs, RFPs, and event peers. Identify 3 to 5 concrete, actionable opportunities where the user's agent can immediately negotiate a deal, apply/pitch for a job, close a vendor discount, or form a partnership.`,
        `For every opportunity:`,
        `- targetHandle MUST match a handle from contacts, jobs, rfps, or event peers.`,
        `- If it relates to an item in Personal Contacts, include its contactId.`,
        `- If it relates to an open job, include its jobId.`,
        `- recommendedDealZAR MUST be a realistic positive ZAR value grounded in the contact guardrails, job salary, or RFP budget.`,
        `- suggestedProposalTitle MUST be concise and ready to launch directly into A2A Negotiation.`,
        `- Never fabricate metrics outside the provided data.`,
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              opportunities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    category: {
                      type: Type.STRING,
                      enum: ['job_match', 'b2b_deal', 'partnership', 'service_pitch', 'event_followup'],
                    },
                    contactId: { type: Type.STRING },
                    jobId: { type: Type.STRING },
                    targetHandle: { type: Type.STRING },
                    targetName: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                    suggestedProposalTitle: { type: Type.STRING },
                    recommendedDealZAR: { type: Type.NUMBER },
                    confidencePct: { type: Type.NUMBER },
                    negotiationAngle: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'title',
                    'category',
                    'targetHandle',
                    'targetName',
                    'summary',
                    'rationale',
                    'suggestedProposalTitle',
                    'recommendedDealZAR',
                    'confidencePct',
                    'negotiationAngle',
                  ],
                },
              },
            },
            required: ['summary', 'opportunities'],
          },
        },
      });

      const rawText = (response.text || '{}').trim();
      const parsed = JSON.parse(rawText) as {
        summary?: string;
        opportunities?: Array<Record<string, unknown>>;
      };

      if (!Array.isArray(parsed.opportunities)) {
        return res.status(502).json({
          code: 'GEMINI_INVALID_OUTPUT',
          error: 'Gemini returned an unexpected schema for opportunities. Please retry.',
        });
      }

      return res.json({
        engine: 'gemini-4-hydrogen',
        generatedAt: new Date().toISOString(),
        summary: parsed.summary || 'Ranked opportunities ready for agent negotiation.',
        opportunities: parsed.opportunities,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upstream Gemini request failed.';
      const status = msg.includes('429') || msg.toLowerCase().includes('quota') ? 429 : 502;
      return res.status(status).json({
        code: status === 429 ? 'GEMINI_RATE_LIMITED' : 'GEMINI_UPSTREAM_ERROR',
        error: msg,
      });
    }
  });

  // Unified Autonomous Intent & Mutual Opportunity Matcher (Personal & Company Agents)
  app.post('/api/agents/autonomous-match', async (req, res) => {
    const {
      sourceAgent,
      agents = SEED_AGENTS,
      jobs = SEED_JOBS,
      rfps = SEED_RFPS,
      peers = SEED_EVENT_PEERS,
    } = req.body || {};

    if (!sourceAgent || !sourceAgent.handle) {
      return res.status(400).json({ error: 'sourceAgent with handle is required.' });
    }

    const sourceTokens: string[] = Array.from(
      new Set<string>(
        [
          ...(Array.isArray(sourceAgent.skills) ? sourceAgent.skills : []),
          ...(Array.isArray(sourceAgent.impliedIntent?.topics) ? sourceAgent.impliedIntent.topics : []),
          ...(Array.isArray(sourceAgent.cvSummary?.parsedSkills) ? sourceAgent.cvSummary.parsedSkills : []),
          ...(Array.isArray(sourceAgent.cvSummary?.preferredRoles) ? sourceAgent.cvSummary.preferredRoles : []),
          String(sourceAgent.roleTitle || ''),
          String(sourceAgent.impliedIntent?.headline || ''),
        ]
          .flatMap((t) => String(t).split(/[,/|·]+/))
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length >= 2)
      )
    );

    const computeKeywordOverlap = (targetTexts: string[]): string[] => {
      const hay = targetTexts.join(' ').toLowerCase();
      return sourceTokens.filter((tok) => hay.includes(tok)).slice(0, 6);
    };

    const deterministicMatches: AutonomousMatchItem[] = [];
    const nowIso = new Date().toISOString();

    if (sourceAgent.type === 'persona') {
      // Match open Vacancies
      for (const job of Array.isArray(jobs) ? jobs : []) {
        if (job.status && job.status !== 'OPEN') continue;
        const matched = computeKeywordOverlap([
          job.title || '',
          job.description || '',
          ...(Array.isArray(job.requiredSkills) ? job.requiredSkills : []),
        ]);
        const minSalary = Number(sourceAgent.impliedIntent?.targetBudgetMinZAR || sourceAgent.cvSummary?.salaryMinZAR || 0);
        const salaryMax = Number(job.salaryRangeZAR?.max || 0);
        const salaryFitBonus = minSalary === 0 || salaryMax >= minSalary ? 10 : 0;
        const score = Math.min(98, 68 + matched.length * 8 + salaryFitBonus);
        deterministicMatches.push({
          id: `auto_job_${job.id}`,
          kind: 'job',
          score,
          title: job.title,
          subtitle: `${job.companyName} · ${job.remoteMode} · ${job.location}`,
          targetHandle: job.companyAgentHandle,
          targetName: job.companyName,
          rationale:
            matched.length > 0
              ? `Matches your implied intent topics (${matched.slice(0, 3).join(', ')}) with ${job.remoteMode} delivery.`
              : `Open employer mandate at ${job.companyName} aligned with your career agent profile.`,
          matchedKeywords: matched.length > 0 ? matched : (job.requiredSkills || []).slice(0, 3),
          valueZAR: salaryMax || undefined,
          recommendedAction: 'apply',
          jobId: job.id,
          createdAt: nowIso,
        });
      }

      // Match open Reverse-RFPs
      for (const rfp of Array.isArray(rfps) ? rfps : []) {
        if (rfp.status && rfp.status !== 'OPEN') continue;
        const matched = computeKeywordOverlap([rfp.title || '', rfp.description || '', rfp.category || '']);
        const score = Math.min(97, 66 + matched.length * 9 + (sourceAgent.impliedIntent?.categories?.includes('commercial_deal') ? 8 : 0));
        deterministicMatches.push({
          id: `auto_rfp_${rfp.id}`,
          kind: 'rfp',
          score,
          title: rfp.title,
          subtitle: `Open RFP by ${rfp.publisherHandle} · ${rfp.category}`,
          targetHandle: rfp.publisherHandle,
          targetName: rfp.publisherHandle,
          rationale:
            matched.length > 0
              ? `Live RFP matching your intent keywords (${matched.slice(0, 3).join(', ')}). Ready to submit A2A proposal.`
              : `Open commercial RFP seeking vendor/specialist bids within R${Number(rfp.budgetZAR || 0).toLocaleString('en-ZA')}.`,
          matchedKeywords: matched.length > 0 ? matched : [rfp.category || 'RFP'],
          valueZAR: Number(rfp.budgetZAR || 0) || undefined,
          recommendedAction: 'pitch_rfp',
          rfpId: rfp.id,
          createdAt: nowIso,
        });
      }
    } else {
      // Business Agent: match personal talent agents & vendor/partner agents
      for (const peerAgent of Array.isArray(agents) ? agents : []) {
        if (peerAgent.handle === sourceAgent.handle || peerAgent.handle === '911.emergency.agent') continue;
        const matched = computeKeywordOverlap([
          peerAgent.roleTitle || '',
          peerAgent.summary || '',
          peerAgent.impliedIntent?.headline || '',
          ...(Array.isArray(peerAgent.skills) ? peerAgent.skills : []),
          ...(Array.isArray(peerAgent.impliedIntent?.topics) ? peerAgent.impliedIntent.topics : []),
        ]);
        const isSeeker = peerAgent.type === 'persona';
        const score = Math.min(98, 69 + matched.length * 8 + (isSeeker ? 6 : 3));
        deterministicMatches.push({
          id: `auto_agent_${peerAgent.id}`,
          kind: 'agent',
          score,
          title: `${peerAgent.displayName} (${peerAgent.roleTitle})`,
          subtitle: `${peerAgent.organization} · ${peerAgent.handle}`,
          targetHandle: peerAgent.handle,
          targetName: peerAgent.displayName,
          rationale:
            matched.length > 0
              ? `Mutual intent alignment across ${matched.slice(0, 3).join(', ')} — ready for ${isSeeker ? 'interview invite' : 'commercial A2A deal'}.`
              : `${isSeeker ? 'Verified specialist' : 'Verified partner'} in ${peerAgent.organization} aligned with your active RFPs & vacancies.`,
          matchedKeywords: matched.length > 0 ? matched : (peerAgent.skills || []).slice(0, 3),
          valueZAR: peerAgent.cvSummary?.salaryMinZAR || peerAgent.guardrails?.maxAutoSpendZAR,
          recommendedAction: isSeeker ? 'invite_candidate' : 'engage',
          createdAt: nowIso,
        });
      }
    }

    // Also include live proximity peers from events / radar
    for (const peer of Array.isArray(peers) ? peers : []) {
      if (peer.handle === sourceAgent.handle) continue;
      const matched = computeKeywordOverlap([
        peer.roleTitle || '',
        peer.summary || '',
        ...(Array.isArray(peer.skills) ? peer.skills : []),
        ...(Array.isArray(peer.impliedTopics) ? peer.impliedTopics : []),
      ]);
      const score = Math.min(
        98,
        72 + matched.length * 7 + (peer.mutualBearingLock ? 10 : 0) + (peer.distanceMeters <= 40 ? 6 : 0)
      );
      deterministicMatches.push({
        id: `auto_peer_${peer.id}`,
        kind: 'proximity_peer',
        score,
        title: `${peer.displayName} · Nearby (${peer.distanceMeters}m)`,
        subtitle: `${peer.locationLabel} · ${peer.transport.replace('_', ' ').toUpperCase()}`,
        targetHandle: peer.handle,
        targetName: peer.displayName,
        rationale: peer.mutualBearingLock
          ? `Mutual compass bearing lock at ${peer.distanceMeters}m! High-intent ${peer.intent} match.`
          : `Detected ${peer.distanceMeters}m away at ${peer.locationLabel}${matched.length ? ` matching ${matched.slice(0, 2).join(', ')}` : ''}.`,
        matchedKeywords: matched.length > 0 ? matched : (peer.skills || []).slice(0, 3),
        distanceMeters: peer.distanceMeters,
        bearingDeg: peer.relativeBearingDeg ?? peer.headingDeg,
        mutualFacing: Boolean(peer.mutualBearingLock),
        recommendedAction: 'add_contact',
        createdAt: nowIso,
      });
    }

    const sortedDeterministic = deterministicMatches.sort((a, b) => b.score - a.score).slice(0, 12);

    const ai = getGeminiClient();
    if (ai && sortedDeterministic.length > 0) {
      try {
        const prompt = [
          `You are the SWITCHZ Autonomous Intent Synthesis Engine.`,
          `Source Agent: ${sourceAgent.displayName} (@${sourceAgent.handle}, type=${sourceAgent.type})`,
          `Implied Intent Headline: "${sourceAgent.impliedIntent?.headline || sourceAgent.roleTitle}"`,
          `Topics/Skills: ${sourceTokens.join(', ')}`,
          `Candidate Top Matches JSON:\n${JSON.stringify(
            sortedDeterministic.slice(0, 8).map((m) => ({
              id: m.id,
              kind: m.kind,
              title: m.title,
              targetHandle: m.targetHandle,
              score: m.score,
              matchedKeywords: m.matchedKeywords,
            }))
          )}`,
          `Return a crisp 1-sentence executive summary of these autonomous matches AND optionally refine rationales (using the exact same ids).`,
        ].join('\n\n');

        const aiResp = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  executiveSummary: { type: Type.STRING },
                  refined: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        rationale: { type: Type.STRING },
                        score: { type: Type.NUMBER },
                      },
                      required: ['id', 'rationale'],
                    },
                  },
                },
                required: ['executiveSummary', 'refined'],
              },
            },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gemini match timeout')), 6500)),
        ]);

        const parsed = JSON.parse((aiResp.text || '{}').trim()) as {
          executiveSummary?: string;
          refined?: Array<{ id: string; rationale: string; score?: number }>;
        };
        const refinedMap = new Map((parsed.refined || []).map((r) => [r.id, r]));
        const merged = sortedDeterministic
          .map((item) => {
            const ref = refinedMap.get(item.id);
            if (!ref) return item;
            return {
              ...item,
              rationale: ref.rationale || item.rationale,
              score: typeof ref.score === 'number' ? Math.min(99, Math.max(60, Math.round(ref.score))) : item.score,
            };
          })
          .sort((a, b) => b.score - a.score);

        return res.json({
          engine: 'gemini-4-hydrogen',
          generatedAt: nowIso,
          executiveSummary:
            parsed.executiveSummary ||
            `Matched ${merged.length} autonomous opportunities aligned with ${sourceAgent.displayName}'s implied intent.`,
          matches: merged,
        });
      } catch (err) {
        console.warn('Autonomous match Gemini fallback:', err instanceof Error ? err.message : err);
      }
    }

    return res.json({
      engine: 'switchz-autonomous-intent-matcher',
      generatedAt: nowIso,
      executiveSummary: `Matched ${sortedDeterministic.length} vacancies, RFPs, agents & proximity peers aligned with ${sourceAgent.displayName}'s implied intent.`,
      matches: sortedDeterministic,
    });
  });

  // Part 2: .agent Handle & Number Registry API
  app.get('/api/names/search', (req, res) => {
    const q = String(req.query.q || '');
    if (!q.trim()) {
      return res.status(400).json({ error: 'Query parameter q is required.' });
    }
    const quote = quoteHandlePricing(q);
    const claimed = SEED_CLAIMED_HANDLES.find((h) => h.handle === quote.normalizedHandle);
    const auction = SEED_AUCTIONS.find((a) => a.handle === quote.normalizedHandle);
    const listing = SEED_SECONDARY_LISTINGS.find((l) => l.handle === quote.normalizedHandle);

    res.json({
      quote,
      availability: quote.isProtectedCivic
        ? 'PROTECTED_CIVIC'
        : auction
        ? 'IN_AUCTION'
        : listing
        ? 'SECONDARY_MARKET'
        : claimed
        ? 'CLAIMED'
        : 'AVAILABLE',
      claimedRecord: claimed || null,
      auctionRecord: auction || null,
      secondaryListing: listing || null,
    });
  });

  app.post('/api/names/claim', (req, res) => {
    const { handle, buyerType = 'human' } = req.body || {};
    if (!handle) return res.status(400).json({ error: 'handle is required' });
    const quote = quoteHandlePricing(handle);

    if (quote.isProtectedCivic) {
      return res.status(403).json({
        error: 'Civic/Emergency shortcodes (911, 999, 112, 10111, 10177) are permanently locked.',
      });
    }
    if (quote.isAuctionRequired) {
      return res.status(409).json({
        error: `${quote.normalizedHandle} requires English Auction bidding.`,
        auctionRequired: true,
      });
    }

    const requiredUSD = buyerType === 'bot' ? quote.botX402PriceUSD : quote.humanPriceUSD;
    const x402Header = req.headers['x-402-payment-token'];

    if (requiredUSD > 0 && !x402Header) {
      return res.status(402).json({
        error: 'Payment Required (x402 Protocol)',
        protocol: 'x402',
        amountUSD: requiredUSD,
        amountZAR: Math.round(requiredUSD * ZAR_PER_USD),
        accepts: ['Base USDC', 'Arc', 'Solana USDC', 'PayPal Vault'],
        hint: 'Include X-402-Payment-Token header or settle via Switchboard UI.',
      });
    }

    return res.json({
      status: 'CLAIMED',
      handle: quote.normalizedHandle,
      tierLabel: quote.tierLabel,
      paidUSD: requiredUSD,
      claimedAt: new Date().toISOString(),
    });
  });

  app.post('/api/names/bid', (req, res) => {
    const { handle, amountUSD, bidderHandle = 'alex.founder.agent' } = req.body || {};
    if (!handle || typeof amountUSD !== 'number') {
      return res.status(400).json({ error: 'handle and numeric amountUSD required' });
    }
    res.json({
      status: 'BID_ACCEPTED',
      handle,
      amountUSD,
      bidderHandle,
      timestamp: new Date().toISOString(),
    });
  });

  // Part 3: Agentic Email Autonomous Triage
  app.post('/api/email/triage', async (req, res) => {
    const {
      fromAddress = 'vendor@solargrid.co.za',
      toAddress = 'engage@ceo.woolworths.agent',
      subject = 'Proposal: Solar Micro-Grid Quote',
      body = '',
      targetMinDiscountPct = 14,
      minExecMeetingValueZAR = 25000,
    } = req.body || {};

    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [
            `You are the autonomous Switchboard inbox agent for ${toAddress}.`,
            `Incoming Email From: ${fromAddress}`,
            `Subject: ${subject}`,
            `Body: ${body}`,
            `Guardrails: POPIA consent check required; minimum discount ${targetMinDiscountPct}%; executive calendar booking only if proposed value >= R${minExecMeetingValueZAR}.`,
            `Classify the email, extract any proposedPriceZAR (0 if none), decide whether to auto-book a meeting, and write a crisp professional auto-reply.`,
          ].join('\n'),
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                aiClassification: {
                  type: Type.STRING,
                  enum: ['QUALIFIED_ENGAGE', 'RFP_RESPONSE', 'SPAM_BLOCKED', 'MEETING_CONFIRMED'],
                },
                proposedPriceZAR: { type: Type.NUMBER },
                shouldBookMeeting: { type: Type.BOOLEAN },
                replyBody: { type: Type.STRING },
              },
              required: ['aiClassification', 'proposedPriceZAR', 'shouldBookMeeting', 'replyBody'],
            },
          },
        });
        const parsed = JSON.parse((response.text || '{}').trim());
        if (parsed.replyBody) {
          return res.json({
            engine: 'gemini-4-hydrogen',
            ...parsed,
          });
        }
      } catch (err) {
        console.warn('Email triage Gemini fallback:', err instanceof Error ? err.message : err);
      }
    }

    const lower = `${subject} ${body}`.toLowerCase();
    const isSpam = lower.includes('crypto giveaway') || lower.includes('unsubscribe now') || body.trim().length < 15;
    const priceMatch = body.match(/r\s?([\d,]+)/i);
    const extractedPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 45000;
    const shouldBookMeeting = !isSpam && extractedPrice >= minExecMeetingValueZAR;

    return res.json({
      engine: 'switchboard-mail-triage',
      aiClassification: isSpam ? 'SPAM_BLOCKED' : shouldBookMeeting ? 'MEETING_CONFIRMED' : 'QUALIFIED_ENGAGE',
      proposedPriceZAR: isSpam ? 0 : extractedPrice,
      shouldBookMeeting,
      replyBody: isSpam
        ? 'Blocked by POPIA anti-spam guardrail. Unverified bulk solicitation rejected automatically.'
        : shouldBookMeeting
        ? `POPIA verification passed. Your proposal (R${extractedPrice.toLocaleString('en-ZA')}) clears our executive threshold. Provisionally booked a 30-min Google Meet slot for tomorrow at 10:00 SAST — please confirm or counter-offer via x402.`
        : `Thank you for engaging ${toAddress}. Your inquiry is logged and queued for async review under our ${targetMinDiscountPct}% partner discount guardrail.`,
    });
  });

  // Part 3: Gemini Voice & Chat Dialer Turn (including 911 Civic Emergency Priority)
  app.post('/api/voice/turn', async (req, res) => {
    const {
      targetHandle = 'alex.founder.agent',
      dialedNumber = '+27-87-AGENT-007',
      userMessage = 'Hello',
      isEmergency = false,
      gpsCoords = { lat: -26.0594, lng: 27.9583 },
      history = [],
    } = req.body || {};

    const ai = getGeminiClient();

    if (isEmergency || dialedNumber === '911' || dialedNumber === '112' || dialedNumber === '999') {
      const simulatedUnits = [
        {
          id: 'unit_ems_1',
          unitType: 'Ambulance',
          callsign: 'Netcare-911 Alpha-4',
          etaMinutes: 4,
          lat: gpsCoords.lat + 0.008,
          lng: gpsCoords.lng - 0.006,
          status: 'EN_ROUTE',
        },
        {
          id: 'unit_jmpd_2',
          unitType: 'Metro Police',
          callsign: 'JMPD Sandton Unit-12',
          etaMinutes: 3,
          lat: gpsCoords.lat - 0.005,
          lng: gpsCoords.lng + 0.007,
          status: 'DISPATCHED',
        },
      ];

      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `You are the Switchboard 911 Civic Emergency Dispatch Coordinator (911.emergency.agent). Caller GPS: ${gpsCoords.lat}, ${gpsCoords.lng}. Caller says: "${userMessage}". Prior turns: ${JSON.stringify(history.slice(-4))}. Respond calmly in 2 short, clear sentences: confirm exact GPS lock, advise immediate safety action, and confirm responder unit dispatch (Ambulance ETA 4m, Metro Police ETA 3m).`,
            config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
          });
          if (response.text) {
            return res.json({
              reply: response.text.trim(),
              isEmergency: true,
              feeUSD: 0,
              dispatchedUnits: simulatedUnits,
            });
          }
        } catch {
          // fallback below
        }
      }

      return res.json({
        reply: `911 Emergency Dispatch connected ($0.00 Civic Priority). GPS locked at ${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)} — stay where it is safe, keep this line or silent text open, and confirm if anyone is injured. Netcare-911 Alpha-4 (ETA 4 min) and JMPD Unit-12 (ETA 3 min) are dispatched.`,
        isEmergency: true,
        feeUSD: 0,
        dispatchedUnits: simulatedUnits,
      });
    }

    const agent = SEED_AGENTS.find((a) => a.handle === targetHandle || a.shortcode === dialedNumber || a.voiceNumber === dialedNumber);

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `You are ${agent?.displayName || targetHandle} (${agent?.roleTitle || 'Switchboard Agent'}). Guardrails: maxAutoSpendZAR R${agent?.guardrails.maxAutoSpendZAR ?? 85000}, minDiscount ${agent?.guardrails.minDiscountPct ?? 10}%. Caller said: "${userMessage}". Reply concisely in 1-2 spoken sentences ready for voice synthesis.`,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
        });
        if (response.text) {
          return res.json({
            reply: response.text.trim(),
            isEmergency: false,
            feeUSD: 0,
          });
        }
      } catch {
        // fallback below
      }
    }

    return res.json({
      reply: `${agent?.displayName || targetHandle} received your request. We can proceed within our ${agent?.guardrails.minDiscountPct ?? 10}% partner discount guardrail and settle via PayPal Vault or x402 Base — would you like me to lock a calendar slot?`,
      isEmergency: false,
      feeUSD: 0,
    });
  });

  // Vite dev middleware or static prod build
  if (process.env.NODE_ENV !== 'production') {
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay extends HTMLElement {}
`);
    });

    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/mesh' });

  wss.on('connection', (ws, req) => {
    let joinedRoom = 'sandton-summit-2026';
    try {
      const url = new URL(req.url || '/ws/mesh', 'http://localhost');
      joinedRoom = (url.searchParams.get('room') || 'sandton-summit-2026').trim().toLowerCase();
    } catch {
      joinedRoom = 'sandton-summit-2026';
    }

    if (!meshRoomSockets.has(joinedRoom)) {
      meshRoomSockets.set(joinedRoom, new Set());
    }
    meshRoomSockets.get(joinedRoom)!.add(ws);

    // Push immediate room snapshot on join
    pruneExpiredPeers();
    const snapshotPeers: ProximityPeerDoc[] = [];
    for (const stored of activeProximityPeers.values()) {
      if (stored.roomCode === joinedRoom) {
        const { expiresAtMs: _ignore, ...pub } = stored;
        snapshotPeers.push(pub);
      }
    }
    ws.send(JSON.stringify({ type: 'room_snapshot', roomCode: joinedRoom, peers: snapshotPeers }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          roomCode?: string;
          handle?: string;
          headingDeg?: number;
          pitchDeg?: number;
          rollDeg?: number;
          lat?: number;
          lng?: number;
          broadcastRadiusMeters?: number;
          scanRadiusMeters?: number;
          impliedTopics?: string[];
        };
        const targetRoom = (msg.roomCode || joinedRoom).trim().toLowerCase();
        if (msg.type === 'orientation_update' && msg.handle) {
          const key = `${targetRoom}::${msg.handle.toLowerCase()}`;
          const existing = activeProximityPeers.get(key);
          if (existing) {
            if (typeof msg.headingDeg === 'number') existing.headingDeg = ((msg.headingDeg % 360) + 360) % 360;
            if (typeof msg.pitchDeg === 'number') existing.pitchDeg = msg.pitchDeg;
            if (typeof msg.rollDeg === 'number') existing.rollDeg = msg.rollDeg;
            if (typeof msg.lat === 'number') existing.lat = msg.lat;
            if (typeof msg.lng === 'number') existing.lng = msg.lng;
            if (typeof msg.broadcastRadiusMeters === 'number') existing.broadcastRadiusMeters = msg.broadcastRadiusMeters;
            if (typeof msg.scanRadiusMeters === 'number') existing.scanRadiusMeters = msg.scanRadiusMeters;
            if (Array.isArray(msg.impliedTopics)) existing.impliedTopics = msg.impliedTopics;
            existing.lastSeenAt = new Date().toISOString();
            existing.expiresAtMs = Date.now() + 10 * 60 * 1000;
            const { expiresAtMs: _ignore, ...pub } = existing;
            broadcastToMeshRoom(targetRoom, { type: 'peer_upsert', peer: pub });
          }
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      const set = meshRoomSockets.get(joinedRoom);
      if (set) {
        set.delete(ws);
        if (set.size === 0) meshRoomSockets.delete(joinedRoom);
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SWITCHZ running on http://0.0.0.0:${PORT} (WebSocket mesh: /ws/mesh)`);
  });
}

startServer();
