import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type, FunctionDeclaration } from '@google/genai';
import { SEED_AGENTS, SEED_RFPS, SEED_AUCTIONS, SEED_CLAIMED_HANDLES, SEED_SECONDARY_LISTINGS } from './src/data/seedData';
import { quoteHandlePricing } from './src/services/paymentRails';
import { ZAR_PER_USD } from './src/types/firestore';
import { createPoppyRouter } from './server/poppyRouter';

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

  app.get('/api/config/public', (_req, res) => {
    const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({
      googleMapsApiKey: mapsKey,
      hasGoogleMapsKey: Boolean(mapsKey),
      zarPerUsd: ZAR_PER_USD,
      appUrl: process.env.APP_URL || '',
    });
  });

  // Protocol discovery endpoints
  app.get('/.well-known/agent.json', (_req, res) => {
    res.json({
      schema: 'https://switchboard.agent/schemas/agent-v1.json',
      name: 'Switchboard (AgentPages)',
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
        '- POST /api/email/triage — Autonomous Gemini email pitch triage & auto-reply',
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
      service: 'Switchboard (AgentPages)',
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
                      pitchSummary: { type: Type.STRING },
                    },
                    required: ['vendorHandle', 'bidZAR', 'matchScore', 'pitchSummary'],
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
        pitchSummary: `${c.displayName} auto-matched via ${broadcastChannels.join(' + ')} with ${16 - idx * 4}% instant savings.`,
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
      toAddress = 'pitch@ceo.woolworths.agent',
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
                  enum: ['QUALIFIED_PITCH', 'RFP_RESPONSE', 'SPAM_BLOCKED', 'MEETING_CONFIRMED'],
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
      aiClassification: isSpam ? 'SPAM_BLOCKED' : shouldBookMeeting ? 'MEETING_CONFIRMED' : 'QUALIFIED_PITCH',
      proposedPriceZAR: isSpam ? 0 : extractedPrice,
      shouldBookMeeting,
      replyBody: isSpam
        ? 'Blocked by POPIA anti-spam guardrail. Unverified bulk solicitation rejected automatically.'
        : shouldBookMeeting
        ? `POPIA verification passed. Your proposal (R${extractedPrice.toLocaleString('en-ZA')}) clears our executive threshold. Provisionally booked a 30-min Google Meet slot for tomorrow at 10:00 SAST — please confirm or counter-offer via x402.`
        : `Thank you for pitching ${toAddress}. Your inquiry is logged and queued for async review under our ${targetMinDiscountPct}% partner discount guardrail.`,
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Switchboard (AgentPages) running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
