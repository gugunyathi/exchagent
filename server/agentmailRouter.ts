import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

const AGENTMAIL_API_BASE = 'https://api.agentmail.to/v0';
const INBOX_EMAIL = 'exchagent@agentmail.to';

export function createAgentMailRouter() {
  const router = express.Router();

  // Get Inbox status and messages
  router.get('/api/agentmail/inbox', async (_req: Request, res: Response) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    if (!apiKey) {
      // Fallback mock inbox if API key is not configured in environment yet
      return res.json({
        configured: false,
        inbox: INBOX_EMAIL,
        messages: [
          {
            id: 'msg_mock_01',
            thread_id: 'thread_01',
            from: 'partnerships@woolworths.co.za',
            to: INBOX_EMAIL,
            subject: 'A2A Partnership & x402 Escrow Inquiry',
            snippet: 'We would like to synchronize our procurement desk with your Switchboard agent handle...',
            text: 'Hello exchagent,\n\nWe would like to synchronize our procurement desk with your Switchboard agent handle for automated vendor settlements and cold-chain tenders across Sandton. Please confirm your available discount tier.\n\nBest regards,\nWoolworths Holdings',
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
            unread: true,
          },
          {
            id: 'msg_mock_02',
            thread_id: 'thread_02',
            from: 'dispatch@mtn.co.za',
            to: INBOX_EMAIL,
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
      const response = await fetch(`${AGENTMAIL_API_BASE}/inboxes/${encodeURIComponent(INBOX_EMAIL)}/messages`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: 'agentmail_api_error',
          details: errorText,
          inbox: INBOX_EMAIL,
        });
      }

      const data = await response.json() as any;
      return res.json({
        configured: true,
        inbox: INBOX_EMAIL,
        messages: data.messages || data.data || data || [],
      });
    } catch (err) {
      console.warn('AgentMail fetch inbox failed:', err);
      return res.status(500).json({
        error: 'agentmail_network_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Send message from exchagent@agentmail.to
  router.post('/api/agentmail/send', async (req: Request, res: Response) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const { to, subject, text, html } = req.body || {};

    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, text' });
    }

    if (!apiKey) {
      // Simulate sending when key is not configured
      return res.json({
        success: true,
        simulated: true,
        message: {
          id: `msg_sent_${Date.now()}`,
          from: INBOX_EMAIL,
          to,
          subject,
          text,
          timestamp: new Date().toISOString(),
        },
      });
    }

    try {
      const response = await fetch(`${AGENTMAIL_API_BASE}/inboxes/${encodeURIComponent(INBOX_EMAIL)}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject,
          text,
          html: html || `<p>${text.replace(/\n/g, '<br/>')}</p>`,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: 'agentmail_send_error',
          details: errText,
        });
      }

      const result = await response.json();
      return res.json({ success: true, message: result });
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
