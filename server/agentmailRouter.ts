import express, { Request, Response } from 'express';
import {
  createX402ChallengeRecord,
  getOrCreateEntitlement,
  saveSoon,
  verifyX402ReceiptToken,
} from './dbStore';

const AGENTMAIL_API_BASE = 'https://api.agentmail.to/v0';
const DEFAULT_INBOX_EMAIL = 'exchagent@agentmail.to';

interface RawAgentMailMessage {
  id?: string;
  message_id?: string;
  thread_id?: string;
  from?: unknown;
  to?: unknown;
  cc?: unknown;
  subject?: string;
  preview?: string;
  snippet?: string;
  text?: string;
  extracted_text?: string;
  html?: string;
  extracted_html?: string;
  timestamp?: string;
  created_at?: string;
  labels?: string[];
  unread?: boolean;
}

interface RawAgentMailInbox {
  inbox_id?: string;
  email?: string;
  pod_id?: string;
  display_name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

function formatAddressField(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map((item) => formatAddressField(item)).filter(Boolean).join(', ');
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const email = typeof obj.email === 'string' ? obj.email : typeof obj.address === 'string' ? obj.address : '';
    const name = typeof obj.name === 'string' ? obj.name : '';
    if (name && email) return `${name} <${email}>`;
    return email || name || '';
  }
  return String(val);
}

function normalizeMessage(msg: RawAgentMailMessage, fallbackInbox: string) {
  const id = msg.message_id || msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = msg.created_at || msg.timestamp || new Date().toISOString();
  const labels = Array.isArray(msg.labels) ? msg.labels : [];
  const text = msg.text || msg.extracted_text || msg.preview || msg.snippet || '';
  const html = msg.html || msg.extracted_html;
  const snippet = msg.preview || msg.snippet || text.slice(0, 140);

  return {
    id,
    message_id: id,
    thread_id: msg.thread_id,
    from: formatAddressField(msg.from) || 'unknown@sender',
    to: formatAddressField(msg.to) || fallbackInbox,
    subject: msg.subject || '(No Subject)',
    snippet,
    text,
    html,
    timestamp,
    labels,
    unread: typeof msg.unread === 'boolean' ? msg.unread : labels.includes('unread'),
  };
}

function normalizeInbox(raw: RawAgentMailInbox) {
  const email = raw.email || raw.inbox_id || '';
  const inboxId = raw.inbox_id || email;
  return {
    inbox_id: inboxId,
    email: email.includes('@') ? email : `${inboxId}@agentmail.to`,
    display_name: raw.display_name || inboxId,
    pod_id: raw.pod_id,
    status: raw.status || 'active',
    created_at: raw.created_at,
  };
}

function sanitizeAgentUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.agent$/i, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 48);
}

function resolveTransportInbox(requestedInbox: string): {
  transportInbox: string;
  subaddressTag: string | null;
} {
  const lower = requestedInbox.trim().toLowerCase();
  const plusMatch = lower.match(/^exchagent\+([^@]+)@agentmail\.to$/i);
  if (plusMatch) {
    return {
      transportInbox: DEFAULT_INBOX_EMAIL,
      subaddressTag: plusMatch[1],
    };
  }
  if (!lower.endsWith('@agentmail.to')) {
    return {
      transportInbox: DEFAULT_INBOX_EMAIL,
      subaddressTag: null,
    };
  }
  return {
    transportInbox: lower,
    subaddressTag: null,
  };
}

export function createAgentMailRouter() {
  const router = express.Router();

  // List available AgentMail inboxes (supports both org-scoped and inbox-scoped API keys)
  router.get('/api/agentmail/inboxes', async (_req: Request, res: Response) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) {
      return res.json({
        configured: false,
        scope: 'sandbox',
        canCreateDedicatedInboxes: false,
        defaultInbox: DEFAULT_INBOX_EMAIL,
        inboxes: [
          {
            inbox_id: DEFAULT_INBOX_EMAIL,
            email: DEFAULT_INBOX_EMAIL,
            display_name: 'Switchboard Exchange Agent',
            status: 'active',
          },
        ],
      });
    }

    try {
      const response = await fetch(`${AGENTMAIL_API_BASE}/inboxes?limit=50`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 403 || response.status === 401) {
        // Key is inbox-scoped to exchagent@agentmail.to (does not carry org-wide inbox_read)
        return res.json({
          configured: true,
          scope: 'inbox_scoped',
          canCreateDedicatedInboxes: false,
          defaultInbox: DEFAULT_INBOX_EMAIL,
          count: 1,
          inboxes: [
            {
              inbox_id: DEFAULT_INBOX_EMAIL,
              email: DEFAULT_INBOX_EMAIL,
              display_name: 'Switchboard Exchange Agent (Primary)',
              status: 'active',
            },
          ],
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: 'agentmail_inboxes_error',
          details: errorText,
          configured: true,
        });
      }

      const data = (await response.json()) as { inboxes?: RawAgentMailInbox[]; data?: RawAgentMailInbox[] };
      const rawList = Array.isArray(data?.inboxes)
        ? data.inboxes
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? (data as RawAgentMailInbox[])
        : [];
      const inboxes = rawList.map(normalizeInbox);

      return res.json({
        configured: true,
        scope: 'organization',
        canCreateDedicatedInboxes: true,
        defaultInbox: DEFAULT_INBOX_EMAIL,
        count: inboxes.length,
        inboxes,
      });
    } catch (err) {
      return res.status(500).json({
        error: 'agentmail_network_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Provision a live @agentmail.to inbox (1st subaddressed inbox free, extra/dedicated requires x402)
  router.post('/api/agentmail/inboxes', async (req: Request, res: Response) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const { username, handle, displayName, ownerUid, deviceId, requestDedicated = false } = req.body || {};

    const cleanUsername = sanitizeAgentUsername(String(username || handle || ''));
    if (!cleanUsername) {
      return res.status(400).json({ error: 'A valid username or agent handle is required.' });
    }

    const ent = getOrCreateEntitlement(
      ownerUid ? String(ownerUid) : undefined,
      deviceId ? String(deviceId) : undefined
    );
    const x402Token = String(req.headers['x-402-payment-token'] || '');
    const verifiedReceipt = verifyX402ReceiptToken(x402Token);
    const inboxLimit = ent.inboxesIncludedFree + ent.bonusInboxes;
    const needsPaidInbox = Boolean(requestDedicated) || ent.inboxesUsed >= inboxLimit;

    if (needsPaidInbox && !verifiedReceipt) {
      const challenge = createX402ChallengeRecord({
        sku: 'email_dedicated_inbox',
        category: 'email_inbox',
        title: `Dedicated @agentmail.to Inbox (${cleanUsername})`,
        description: `Includes 1 free routed inbox (${ent.inboxesUsed}/${inboxLimit} used). Settle $4.00/mo via x402 to provision an additional dedicated agent inbox.`,
        amountUSD: 4.0,
        metadata: { username: cleanUsername, requestDedicated: Boolean(requestDedicated) },
      });
      return res
        .status(402)
        .set('X-Payment-Required', `x402 amount="${challenge.amountUSD}" currency="USDC"`)
        .json({
          error: 'Free inbox allowance used. x402 payment required for additional or dedicated @agentmail.to inbox.',
          protocol: 'x402',
          challenge,
        });
    }

    ent.inboxesUsed += 1;
    ent.updatedAt = new Date().toISOString();
    saveSoon();

    if (!apiKey) {
      const simulatedEmail = `exchagent+${cleanUsername}@agentmail.to`;
      return res.json({
        configured: false,
        simulated: true,
        provisioningMode: 'subaddress_routed',
        routedVia: DEFAULT_INBOX_EMAIL,
        inboxesUsed: ent.inboxesUsed,
        inboxLimit: ent.inboxesIncludedFree + ent.bonusInboxes,
        inbox: {
          inbox_id: simulatedEmail,
          email: simulatedEmail,
          display_name: String(displayName || cleanUsername),
          status: 'active',
        },
      });
    }

    try {
      const createResp = await fetch(`${AGENTMAIL_API_BASE}/inboxes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: cleanUsername,
          display_name: String(displayName || `${cleanUsername} Agent`),
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (createResp.ok) {
        const created = (await createResp.json()) as RawAgentMailInbox;
        return res.json({
          configured: true,
          created: true,
          provisioningMode: 'dedicated_inbox',
          inbox: normalizeInbox(created),
        });
      }

      if (createResp.status === 403 || createResp.status === 401) {
        // Key is inbox-scoped to exchagent@agentmail.to — assign RFC 5233 sub-address routed cleanly through exchagent@agentmail.to
        const routedEmail = `exchagent+${cleanUsername}@agentmail.to`;
        return res.json({
          configured: true,
          created: true,
          provisioningMode: 'subaddress_routed',
          routedVia: DEFAULT_INBOX_EMAIL,
          inbox: {
            inbox_id: routedEmail,
            email: routedEmail,
            display_name: String(displayName || `${cleanUsername} Agent`),
            status: 'active',
          },
        });
      }

      const errText = await createResp.text();

      if (createResp.status === 409 || createResp.status === 400) {
        const listResp = await fetch(`${AGENTMAIL_API_BASE}/inboxes?limit=50`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (listResp.ok) {
          const listData = (await listResp.json()) as { inboxes?: RawAgentMailInbox[] };
          const existing = (listData.inboxes || []).find((ib) => {
            const addr = (ib.email || ib.inbox_id || '').toLowerCase();
            return addr === `${cleanUsername}@agentmail.to` || addr.startsWith(`${cleanUsername}@`);
          });
          if (existing) {
            return res.json({
              configured: true,
              created: false,
              existing: true,
              provisioningMode: 'dedicated_inbox',
              inbox: normalizeInbox(existing),
            });
          }
        }

        if (createResp.status === 409) {
          const altUsername = `${cleanUsername}-${Math.floor(100 + Math.random() * 900)}`;
          const retryResp = await fetch(`${AGENTMAIL_API_BASE}/inboxes`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              username: altUsername,
              display_name: String(displayName || `${cleanUsername} Agent`),
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (retryResp.ok) {
            const retried = (await retryResp.json()) as RawAgentMailInbox;
            return res.json({
              configured: true,
              created: true,
              provisioningMode: 'dedicated_inbox',
              inbox: normalizeInbox(retried),
            });
          }
        }
      }

      return res.status(createResp.status).json({
        error: 'agentmail_create_inbox_error',
        details: errText,
      });
    } catch (err) {
      return res.status(500).json({
        error: 'agentmail_network_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // List messages for an inbox (or sub-addressed agent mailbox routed via exchagent@agentmail.to)
  router.get('/api/agentmail/inbox', async (req: Request, res: Response) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxParam = String(req.query.inbox || DEFAULT_INBOX_EMAIL).trim() || DEFAULT_INBOX_EMAIL;
    const { transportInbox, subaddressTag } = resolveTransportInbox(inboxParam);

    if (!apiKey) {
      return res.json({
        configured: false,
        inbox: inboxParam,
        routedVia: subaddressTag ? DEFAULT_INBOX_EMAIL : undefined,
        messages: [
          {
            id: 'msg_mock_01',
            thread_id: 'thread_01',
            from: 'partnerships@woolworths.co.za',
            to: inboxParam,
            subject: 'A2A Partnership & x402 Escrow Inquiry',
            snippet: 'We would like to synchronize our procurement desk with your Switchboard agent handle...',
            text: 'Hello,\n\nWe would like to synchronize our procurement desk with your Switchboard agent handle for automated vendor settlements and cold-chain tenders across Sandton. Please confirm your available discount tier.\n\nBest regards,\nWoolworths Holdings',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            unread: true,
          },
          {
            id: 'msg_mock_02',
            thread_id: 'thread_02',
            from: 'dispatch@mtn.co.za',
            to: inboxParam,
            subject: 'Solar Tower Backup RFP Tender',
            snippet: 'Requesting autonomous bid on 5G backhaul tower solar battery backup...',
            text: 'Greetings,\n\nMTN Enterprise is requesting an automated proposal for 5G solar backup in Randburg. Budget R280,000.\n\nMTN Procurement Desk',
            timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
            unread: false,
          },
        ],
      });
    }

    try {
      const response = await fetch(
        `${AGENTMAIL_API_BASE}/inboxes/${encodeURIComponent(transportInbox)}/messages?limit=30`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: 'agentmail_api_error',
          details: errorText,
          inbox: inboxParam,
        });
      }

      const data = (await response.json()) as {
        messages?: RawAgentMailMessage[];
        data?: RawAgentMailMessage[];
        count?: number;
      };
      const rawMessages = Array.isArray(data.messages)
        ? data.messages
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
        ? (data as unknown as RawAgentMailMessage[])
        : [];

      const allNormalized = rawMessages.map((m) => normalizeMessage(m, transportInbox));
      const messages = subaddressTag
        ? allNormalized.filter(
            (m) =>
              m.to.toLowerCase().includes(inboxParam.toLowerCase()) ||
              m.subject.toLowerCase().includes(subaddressTag) ||
              m.text.toLowerCase().includes(inboxParam.toLowerCase())
          )
        : allNormalized;

      return res.json({
        configured: true,
        inbox: inboxParam,
        routedVia: subaddressTag ? transportInbox : undefined,
        totalParentCount: allNormalized.length,
        count: messages.length,
        messages,
      });
    } catch (err) {
      console.warn('AgentMail fetch inbox failed:', err);
      return res.status(500).json({
        error: 'agentmail_network_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Get full message body/details
  router.get('/api/agentmail/message', async (req: Request, res: Response) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxParam = String(req.query.inbox || DEFAULT_INBOX_EMAIL).trim() || DEFAULT_INBOX_EMAIL;
    const { transportInbox } = resolveTransportInbox(inboxParam);
    const messageId = String(req.query.messageId || '').trim();

    if (!messageId) {
      return res.status(400).json({ error: 'messageId query parameter is required.' });
    }
    if (!apiKey) {
      return res.status(404).json({ error: 'AGENTMAIL_API_KEY not configured' });
    }

    try {
      const response = await fetch(
        `${AGENTMAIL_API_BASE}/inboxes/${encodeURIComponent(transportInbox)}/messages/${encodeURIComponent(
          messageId
        )}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: 'agentmail_message_error', details: errorText });
      }

      const raw = (await response.json()) as RawAgentMailMessage;
      return res.json({
        configured: true,
        inbox: inboxParam,
        message: normalizeMessage(raw, inboxParam),
      });
    } catch (err) {
      return res.status(500).json({
        error: 'agentmail_network_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Send or reply via AgentMail v0 (25 free outbound sends included, then x402 outreach pack)
  router.post('/api/agentmail/send', async (req: Request, res: Response) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const { inbox, fromInbox, to, subject, text, html, replyToMessageId, ownerUid, deviceId } = req.body || {};
    const activeInbox = String(inbox || fromInbox || DEFAULT_INBOX_EMAIL).trim() || DEFAULT_INBOX_EMAIL;
    const { transportInbox, subaddressTag } = resolveTransportInbox(activeInbox);

    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, text' });
    }

    const ent = getOrCreateEntitlement(
      ownerUid ? String(ownerUid) : undefined,
      deviceId ? String(deviceId) : undefined
    );
    const x402Token = String(req.headers['x-402-payment-token'] || '');
    const verifiedReceipt = verifyX402ReceiptToken(x402Token);

    if (ent.outboundEmailCredits <= 0 && !verifiedReceipt) {
      const challenge = createX402ChallengeRecord({
        sku: 'email_outreach_500',
        category: 'email_inbox',
        title: '500 Autonomous AgentMail Outreach Credits',
        description: 'All free outbound email credits used. Settle $9.00 via x402 to unlock 500 autonomous email dispatches.',
        amountUSD: 9.0,
        metadata: { to: String(to), inbox: activeInbox },
      });
      return res
        .status(402)
        .set('X-Payment-Required', `x402 amount="${challenge.amountUSD}" currency="USDC"`)
        .json({
          error: 'Outbound AgentMail credit quota exhausted. x402 settlement required.',
          protocol: 'x402',
          outboundCreditsRemaining: 0,
          challenge,
        });
    }

    if (ent.outboundEmailCredits > 0) {
      ent.outboundEmailCredits -= 1;
      ent.updatedAt = new Date().toISOString();
      saveSoon();
    }

    if (!apiKey) {
      return res.json({
        success: true,
        simulated: true,
        inbox: activeInbox,
        outboundCreditsRemaining: ent.outboundEmailCredits,
        message: {
          id: `msg_sent_${Date.now()}`,
          from: activeInbox,
          to,
          subject,
          text,
          timestamp: new Date().toISOString(),
        },
      });
    }

    try {
      const endpoint = replyToMessageId
        ? `${AGENTMAIL_API_BASE}/inboxes/${encodeURIComponent(transportInbox)}/messages/${encodeURIComponent(
            String(replyToMessageId)
          )}/reply`
        : `${AGENTMAIL_API_BASE}/inboxes/${encodeURIComponent(transportInbox)}/messages/send`;

      const payload: Record<string, unknown> = replyToMessageId
        ? {
            to,
            text,
            html: html || `<p>${String(text).replace(/\n/g, '<br/>')}</p>`,
          }
        : {
            to,
            subject,
            text,
            html: html || `<p>${String(text).replace(/\n/g, '<br/>')}</p>`,
          };

      if (subaddressTag) {
        payload.reply_to = activeInbox;
        payload.headers = { 'X-Switchboard-Agent': activeInbox };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(9000),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: 'agentmail_send_error',
          details: errText,
          endpoint,
        });
      }

      const result = await response.json();
      return res.json({
        success: true,
        inbox: activeInbox,
        routedVia: subaddressTag ? transportInbox : undefined,
        message: result,
      });
    } catch (err) {
      console.warn('AgentMail send message failed:', err);
      return res.status(500).json({
        error: 'agentmail_network_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
