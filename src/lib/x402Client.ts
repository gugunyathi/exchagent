import {
  AdCampaignDoc,
  PaymentRail,
  X402AccountEntitlement,
  X402ChallengePayload,
  X402PaymentReceipt,
  X402SkuCatalogItem,
} from '../types/firestore';
import { getOrCreateDeviceId } from './passkeyAuth';

export interface X402QuotaSnapshot {
  freeLimit: number;
  freeUsed: number;
  freeRemaining: number;
  bonusCredits: number;
  totalRemaining: number | 'unlimited';
  unlimitedActive: boolean;
}

export interface X402RevenueSummary {
  totalReceipts: number;
  totalVolumeUSD: number;
  byCategory: Record<string, { count: number; totalUSD: number }>;
  humanPaidUSD: number;
  agentPaidUSD: number;
  activeAdCampaigns: number;
  totalAdImpressions: number;
  totalAdClicks: number;
}

export interface X402CatalogResponse {
  protocol: 'x402';
  version: string;
  catalog: X402SkuCatalogItem[];
  entitlement: X402AccountEntitlement;
  quota: X402QuotaSnapshot;
  summary: X402RevenueSummary;
  activeAds: AdCampaignDoc[];
  recentReceipts: X402PaymentReceipt[];
}

export interface X402SettleResult {
  settled: boolean;
  receipt: X402PaymentReceipt;
  x402Token: string;
  entitlement: X402AccountEntitlement;
  quota: X402QuotaSnapshot;
  adCampaign?: AdCampaignDoc | null;
  summary: X402RevenueSummary;
}

type ChallengeBridge = (
  challenge: X402ChallengePayload
) => Promise<X402SettleResult | null>;

let activeChallengeBridge: ChallengeBridge | null = null;

export function registerX402ChallengeBridge(fn: ChallengeBridge | null) {
  activeChallengeBridge = fn;
}

export async function fetchX402Catalog(ownerUid?: string): Promise<X402CatalogResponse | null> {
  try {
    const deviceId = getOrCreateDeviceId();
    const qs = new URLSearchParams({ deviceId });
    if (ownerUid) qs.set('ownerUid', ownerUid);
    const res = await fetch(`/api/x402/catalog?${qs.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as X402CatalogResponse;
  } catch {
    return null;
  }
}

export async function requestX402Challenge(params: {
  sku?: string;
  category?: string;
  title?: string;
  description?: string;
  amountUSD?: number;
  metadata?: Record<string, string | number | boolean>;
}): Promise<X402ChallengePayload> {
  const res = await fetch('/api/x402/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data?.challenge) {
    throw new Error(data?.error || 'Failed to create HTTP 402 payment challenge.');
  }
  return data.challenge as X402ChallengePayload;
}

export async function settleX402Challenge(params: {
  challenge?: X402ChallengePayload;
  sku?: string;
  category?: string;
  title?: string;
  amountUSD?: number;
  rail: PaymentRail;
  payerType: 'human' | 'agent';
  payerHandle: string;
  payerName?: string;
  ownerUid?: string;
  useWalletBalance?: boolean;
  metadata?: Record<string, string | number | boolean>;
}): Promise<X402SettleResult> {
  const deviceId = getOrCreateDeviceId();
  const res = await fetch('/api/x402/settle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentId: params.challenge?.paymentId,
      nonce: params.challenge?.nonce,
      hmacChallenge: params.challenge?.hmacChallenge,
      sku: params.challenge?.sku || params.sku,
      category: params.challenge?.category || params.category,
      title: params.challenge?.title || params.title,
      amountUSD: params.challenge?.amountUSD ?? params.amountUSD,
      rail: params.rail,
      payerType: params.payerType,
      payerHandle: params.payerHandle,
      payerName: params.payerName,
      ownerUid: params.ownerUid,
      deviceId,
      useWalletBalance: params.useWalletBalance,
      metadata: {
        ...(params.challenge?.metadata || {}),
        ...(params.metadata || {}),
      },
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.settled) {
    throw new Error(data?.error || 'x402 settlement declined.');
  }
  return data as X402SettleResult;
}

export async function topUpX402Wallet(params: {
  ownerUid?: string;
  amountUSD?: number;
  rail?: PaymentRail;
  payerHandle?: string;
  autoPayEnabled?: boolean;
  maxAutoPayPerCallUSD?: number;
}): Promise<{
  ok: boolean;
  entitlement: X402AccountEntitlement;
  quota: X402QuotaSnapshot;
  receipt?: X402PaymentReceipt;
}> {
  const deviceId = getOrCreateDeviceId();
  const res = await fetch('/api/x402/wallet/topup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, deviceId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to update x402 wallet settings.');
  }
  return data;
}

/**
 * Executes a fetch request that may return HTTP 402 Payment Required.
 * If 402 is returned with an x402 challenge:
 *   1. Attempts Agent Auto-Pay via pre-funded USDC wallet if `autoPayEntitlement` allows it.
 *   2. Otherwise opens the registered global X402PaymentModal via `registerX402ChallengeBridge`.
 *   3. Retries the original HTTP call cleanly with `X-402-Payment-Token` attached.
 */
export async function x402FetchWithAutoPay(
  url: string,
  init: RequestInit,
  options?: {
    entitlement?: X402AccountEntitlement | null;
    payerHandle?: string;
    ownerUid?: string;
    onSettled?: (result: X402SettleResult) => void;
    bypassModal?: boolean;
  }
): Promise<Response> {
  const firstRes = await fetch(url, init);
  if (firstRes.status !== 402) return firstRes;

  const clone = firstRes.clone();
  let body: { challenge?: X402ChallengePayload; error?: string } = {};
  try {
    body = await clone.json();
  } catch {
    return firstRes;
  }

  const challenge = body?.challenge;
  if (!challenge) return firstRes;

  const ent = options?.entitlement;
  if (
    ent &&
    ent.autoPayEnabled &&
    challenge.amountUSD <= ent.maxAutoPayPerCallUSD &&
    ent.walletBalanceUSD >= challenge.amountUSD
  ) {
    try {
      const settled = await settleX402Challenge({
        challenge,
        rail: 'x402_base',
        payerType: 'agent',
        payerHandle: options?.payerHandle || 'alex.founder.agent',
        ownerUid: options?.ownerUid || ent.ownerUid,
        useWalletBalance: true,
      });
      options?.onSettled?.(settled);
      const retryHeaders = new Headers(init.headers || {});
      retryHeaders.set('X-402-Payment-Token', settled.x402Token);
      return await fetch(url, { ...init, headers: retryHeaders });
    } catch {
      // fall through to manual checkout modal
    }
  }

  if (options?.bypassModal || !activeChallengeBridge) {
    return firstRes;
  }

  const manualResult = await activeChallengeBridge(challenge);
  if (!manualResult) {
    return firstRes;
  }

  options?.onSettled?.(manualResult);
  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set('X-402-Payment-Token', manualResult.x402Token);
  return await fetch(url, { ...init, headers: retryHeaders });
}
