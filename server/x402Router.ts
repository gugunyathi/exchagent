import express, { Request, Response } from 'express';
import {
  X402PayableCategory,
  X402_REVENUE_CATALOG,
} from '../src/types/firestore';
import {
  createX402ChallengeRecord,
  getDbState,
  getMatchQuotaSnapshot,
  getOrCreateEntitlement,
  listX402RevenueSummary,
  saveNow,
  saveSoon,
  settleX402Payment,
  verifyX402ReceiptToken,
} from './dbStore';

export function createX402Router() {
  const router = express.Router();

  // Full monetization catalog, live quota & revenue summary
  router.get('/api/x402/catalog', (req: Request, res: Response) => {
    const ownerUid = String(req.query.ownerUid || '').trim() || undefined;
    const deviceId = String(req.query.deviceId || '').trim() || undefined;
    const ent = getOrCreateEntitlement(ownerUid, deviceId);
    const quota = getMatchQuotaSnapshot(ent);
    const db = getDbState();
    const summary = listX402RevenueSummary();

    return res.json({
      protocol: 'x402',
      version: '1.0',
      catalog: X402_REVENUE_CATALOG,
      entitlement: ent,
      quota,
      summary,
      activeAds: db.adCampaigns.filter((a) => a.status === 'ACTIVE').slice(0, 40),
      recentReceipts: db.x402Receipts.slice(0, 40),
    });
  });

  // Issue an HTTP 402 Payment Required challenge (used by humans & agents)
  router.post('/api/x402/challenge', (req: Request, res: Response) => {
    const {
      sku,
      category = 'matches_pack',
      title,
      description,
      amountUSD,
      metadata,
    } = req.body || {};

    const catalogItem = sku
      ? X402_REVENUE_CATALOG.find((item) => item.sku === String(sku))
      : undefined;

    const resolvedUsd =
      typeof amountUSD === 'number' && amountUSD > 0
        ? amountUSD
        : catalogItem?.priceUSD || 4.99;

    const challenge = createX402ChallengeRecord({
      sku: catalogItem?.sku || (sku ? String(sku) : undefined),
      category: (catalogItem?.category || category || 'matches_pack') as X402PayableCategory,
      title: String(title || catalogItem?.title || 'SWITCHZ x402 Service'),
      description: String(description || catalogItem?.description || ''),
      amountUSD: resolvedUsd,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    });

    return res
      .status(402)
      .set('X-Payment-Required', `x402 amount="${challenge.amountUSD}" currency="USDC"`)
      .set('X-402-Payment-Id', challenge.paymentId)
      .json({
        error: 'Payment Required (x402 Protocol)',
        challenge,
      });
  });

  // Verify & settle an x402 payment (human PayPal/USDC or autonomous agent wallet)
  router.post('/api/x402/settle', (req: Request, res: Response) => {
    const {
      paymentId,
      nonce,
      hmacChallenge,
      sku,
      category,
      title,
      amountUSD,
      rail = 'x402_base',
      payerType = 'human',
      payerHandle = 'alex.founder.agent',
      payerName,
      ownerUid,
      deviceId,
      useWalletBalance = false,
      txHash,
      metadata,
    } = req.body || {};

    const validRails = new Set(['paypal_vault', 'x402_base', 'x402_arc', 'x402_solana']);
    const cleanRail = validRails.has(String(rail))
      ? (String(rail) as 'paypal_vault' | 'x402_base' | 'x402_arc' | 'x402_solana')
      : 'x402_base';

    const outcome = settleX402Payment({
      paymentId: paymentId ? String(paymentId) : undefined,
      nonce: nonce ? String(nonce) : undefined,
      hmacChallenge: hmacChallenge ? String(hmacChallenge) : undefined,
      sku: sku ? String(sku) : undefined,
      category: category as X402PayableCategory | undefined,
      title: title ? String(title) : undefined,
      amountUSD: typeof amountUSD === 'number' ? amountUSD : undefined,
      rail: cleanRail,
      payerType: payerType === 'agent' ? 'agent' : 'human',
      payerHandle: String(payerHandle || 'alex.founder.agent'),
      payerName: payerName ? String(payerName) : undefined,
      ownerUid: ownerUid ? String(ownerUid) : undefined,
      deviceId: deviceId ? String(deviceId) : undefined,
      useWalletBalance: Boolean(useWalletBalance),
      txHash: txHash ? String(txHash) : undefined,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    });

    if (!outcome.ok || !outcome.receipt || !outcome.entitlement) {
      return res.status(402).json({
        settled: false,
        error: outcome.error || 'Unable to verify x402 payment proof.',
      });
    }

    return res
      .status(200)
      .set('X-402-Payment-Receipt', outcome.receipt.x402Token)
      .json({
        settled: true,
        receipt: outcome.receipt,
        x402Token: outcome.receipt.x402Token,
        entitlement: outcome.entitlement,
        quota: getMatchQuotaSnapshot(outcome.entitlement),
        adCampaign: outcome.adCampaign || null,
        summary: listX402RevenueSummary(),
      });
  });

  // Top-up x402 wallet & configure autonomous agent spending limits
  router.post('/api/x402/wallet/topup', (req: Request, res: Response) => {
    const {
      ownerUid,
      deviceId,
      amountUSD = 0,
      rail = 'x402_base',
      payerHandle = 'alex.founder.agent',
      autoPayEnabled,
      maxAutoPayPerCallUSD,
    } = req.body || {};

    const ent = getOrCreateEntitlement(
      ownerUid ? String(ownerUid) : undefined,
      deviceId ? String(deviceId) : undefined
    );

    if (typeof autoPayEnabled === 'boolean') {
      ent.autoPayEnabled = autoPayEnabled;
    }
    if (typeof maxAutoPayPerCallUSD === 'number' && maxAutoPayPerCallUSD >= 1) {
      ent.maxAutoPayPerCallUSD = Math.min(5000, Number(maxAutoPayPerCallUSD.toFixed(2)));
    }

    if (typeof amountUSD === 'number' && amountUSD > 0) {
      const outcome = settleX402Payment({
        sku: 'wallet_topup',
        category: 'wallet_topup',
        title: `x402 Wallet Top-Up ($${amountUSD.toFixed(2)} USDC)`,
        amountUSD,
        rail:
          rail === 'paypal_vault' || rail === 'x402_arc' || rail === 'x402_solana'
            ? rail
            : 'x402_base',
        payerType: 'human',
        payerHandle: String(payerHandle),
        ownerUid: ownerUid ? String(ownerUid) : undefined,
        deviceId: deviceId ? String(deviceId) : undefined,
      });
      if (!outcome.ok) {
        return res.status(400).json({ error: outcome.error });
      }
      return res.json({
        ok: true,
        entitlement: outcome.entitlement,
        quota: getMatchQuotaSnapshot(outcome.entitlement!),
        receipt: outcome.receipt,
      });
    }

    ent.updatedAt = new Date().toISOString();
    saveNow();
    return res.json({
      ok: true,
      entitlement: ent,
      quota: getMatchQuotaSnapshot(ent),
    });
  });

  router.get('/api/x402/receipts', (req: Request, res: Response) => {
    const ownerUid = String(req.query.ownerUid || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const db = getDbState();
    const filtered = ownerUid
      ? db.x402Receipts.filter((r) => r.ownerUid === ownerUid)
      : db.x402Receipts;
    return res.json({
      count: filtered.length,
      receipts: filtered.slice(0, limit),
      summary: listX402RevenueSummary(),
    });
  });

  // Sponsored Ads listing, x402-gated campaign creation & impression/click tracking
  router.get('/api/ads', (_req: Request, res: Response) => {
    const db = getDbState();
    return res.json({
      count: db.adCampaigns.length,
      campaigns: db.adCampaigns,
    });
  });

  router.post('/api/ads/create', (req: Request, res: Response) => {
    const {
      sku = 'ad_status_boost_7d',
      agentId = '',
      agentHandle = 'alex.founder.agent',
      sponsorName = 'SWITCHZ Sponsor',
      headline = 'Featured Sponsor Promotion',
      body = 'Promoted via SWITCHZ x402 Ad Network.',
      ctaLabel = 'Engage Offer',
      targetUrl,
      ownerUid,
      deviceId,
    } = req.body || {};

    const x402Token = String(req.headers['x-402-payment-token'] || '');
    const verifiedReceipt = verifyX402ReceiptToken(x402Token);

    if (!verifiedReceipt) {
      const catalogItem =
        X402_REVENUE_CATALOG.find((s) => s.sku === String(sku)) ||
        X402_REVENUE_CATALOG.find((s) => s.sku === 'ad_status_boost_7d')!;
      const challenge = createX402ChallengeRecord({
        sku: catalogItem.sku,
        category: 'ad_boost',
        title: `${catalogItem.title} · ${sponsorName}`,
        description: `Sponsor placement for ${agentHandle}: ${headline}`,
        amountUSD: catalogItem.priceUSD,
        metadata: {
          agentId: String(agentId),
          agentHandle: String(agentHandle),
          sponsorName: String(sponsorName),
          headline: String(headline),
          body: String(body),
          ctaLabel: String(ctaLabel),
          ...(targetUrl ? { targetUrl: String(targetUrl) } : {}),
        },
      });
      return res
        .status(402)
        .set('X-Payment-Required', `x402 amount="${challenge.amountUSD}" currency="USDC"`)
        .json({
          error: 'Payment Required (x402 Sponsored Ad Placement)',
          challenge,
        });
    }

    const db = getDbState();
    const existingCampaign = db.adCampaigns.find((c) => c.receiptId === verifiedReceipt.id);
    if (existingCampaign) {
      return res.status(201).json({ campaign: existingCampaign, receipt: verifiedReceipt });
    }

    const nowIso = new Date().toISOString();
    const campaign = {
      id: `ad_${Date.now()}`,
      ownerUid: String(ownerUid || verifiedReceipt.ownerUid),
      agentId: String(agentId),
      agentHandle: String(agentHandle),
      sponsorName: String(sponsorName),
      placement: (sku === 'ad_directory_featured_7d'
        ? 'directory_featured'
        : sku === 'ad_radar_beacon_7d'
        ? 'radar_beacon'
        : 'status_circle') as 'status_circle' | 'directory_featured' | 'radar_beacon',
      headline: String(headline),
      body: String(body),
      ctaLabel: String(ctaLabel),
      targetUrl: targetUrl ? String(targetUrl) : undefined,
      budgetUSD: verifiedReceipt.amountUSD,
      impressions: 1,
      clicks: 0,
      receiptId: verifiedReceipt.id,
      txHash: verifiedReceipt.txHash,
      status: 'ACTIVE' as const,
      startsAt: nowIso,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    db.adCampaigns = [campaign, ...db.adCampaigns];
    saveNow();
    return res.status(201).json({ campaign, receipt: verifiedReceipt, deviceId });
  });

  router.post('/api/ads/:id/event', (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const event = String(req.body?.event || 'impression');
    const db = getDbState();
    const found = db.adCampaigns.find((c) => c.id === id);
    if (!found) return res.status(404).json({ error: 'Ad campaign not found.' });
    if (event === 'click') found.clicks += 1;
    else if (event === 'pause') found.status = 'PAUSED';
    else if (event === 'resume') found.status = 'ACTIVE';
    else found.impressions += 1;
    saveSoon();
    return res.json({ campaign: found });
  });

  return router;
}
