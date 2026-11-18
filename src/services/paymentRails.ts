import { PaymentRail, zarToUsd } from '../types/firestore';
import { formatUsdPrice } from '../lib/fx';
import { PROTECTED_EMERGENCY_NUMBERS } from '../data/seedData';

export type HandleEntityType = 'personal' | 'business';
export type HandleBillingCycle = 'monthly' | 'annual';

export interface HandlePricingQuote {
  normalizedHandle: string;
  baseName: string;
  charLength: number;
  isNumeric: boolean;
  isSystemRandom: boolean;
  isProtectedCivic: boolean;
  isAuctionRequired: boolean;
  isSeparateDomainPurchase: boolean;
  entityType: HandleEntityType;
  billingCycle: HandleBillingCycle | 'one_time' | 'free';
  auctionReason?: string;
  monthlyUSD: number;
  annualUSD: number;
  oneTimeDomainUSD: number;
  humanPriceUSD: number;
  botX402PriceUSD: number;
  tierLabel: string;
  billingNote: string;
}

export const ENTERPRISE_BRAND_AUCTIONS = new Set([
  'coke',
  'nike',
  'apple',
  'google',
  'woolworths',
  'mtn',
  'vodacom',
  'tesla',
  'paypal',
  'stripe',
  'openai',
]);

export function generateRandomAgentHandle(entityType: HandleEntityType = 'personal'): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const prefix = entityType === 'business' ? 'businessagent' : 'personalagent';
  return `${prefix}${num}.agent`;
}

export function isSystemRandomHandle(rawInput: string): boolean {
  const clean = rawInput
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\.agent$/, '');
  return /^(personalagent|businessagent)\d{4,8}$/.test(clean);
}

export function quoteHandlePricing(
  rawInput: string,
  options?: {
    entityType?: HandleEntityType;
    billingCycle?: HandleBillingCycle;
  }
): HandlePricingQuote {
  const entityType: HandleEntityType = options?.entityType === 'business' ? 'business' : 'personal';
  const billingCycle: HandleBillingCycle = options?.billingCycle === 'annual' ? 'annual' : 'monthly';

  const baseMonthlyUSD = entityType === 'business' ? 10 : 2;
  const baseAnnualUSD = entityType === 'business' ? 100 : 20;
  const activeSubPriceUSD = billingCycle === 'annual' ? baseAnnualUSD : baseMonthlyUSD;
  const activeSubPeriodLabel = billingCycle === 'annual' ? '/yr' : '/mo';

  const cleaned = rawInput
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\.agent$/, '')
    .replace(/[^a-z0-9.-]/g, '');

  const baseName = cleaned || (entityType === 'business' ? 'businessagent1761' : 'personalagent1643');
  const normalizedHandle = `${baseName}.agent`;
  const charLength = baseName.length;
  const isNumeric = /^\d+$/.test(baseName);
  const numVal = isNumeric ? parseInt(baseName, 10) : NaN;

  if (PROTECTED_EMERGENCY_NUMBERS.has(baseName) || PROTECTED_EMERGENCY_NUMBERS.has(normalizedHandle)) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isSystemRandom: false,
      isProtectedCivic: true,
      isAuctionRequired: false,
      isSeparateDomainPurchase: false,
      entityType,
      billingCycle: 'free',
      auctionReason: 'Protected Civic & Emergency Number (Locked from Commercial Registration)',
      monthlyUSD: 0,
      annualUSD: 0,
      oneTimeDomainUSD: 0,
      humanPriceUSD: 0,
      botX402PriceUSD: 0,
      tierLabel: 'Civic / Emergency Protected',
      billingNote: 'Permanently reserved for civic emergency routing.',
    };
  }

  if (isSystemRandomHandle(baseName)) {
    const isBizHandle = baseName.startsWith('businessagent');
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric: false,
      isSystemRandom: true,
      isProtectedCivic: false,
      isAuctionRequired: false,
      isSeparateDomainPurchase: false,
      entityType: isBizHandle ? 'business' : 'personal',
      billingCycle: 'free',
      monthlyUSD: 0,
      annualUSD: 0,
      oneTimeDomainUSD: 0,
      humanPriceUSD: 0,
      botX402PriceUSD: 0,
      tierLabel: isBizHandle
        ? 'Free System Business Handle (e.g. businessagent1761)'
        : 'Free System Personal Handle (e.g. personalagent1643)',
      billingNote: 'Free system-assigned handle ($0). Upgrade to a custom name anytime.',
    };
  }

  if (ENTERPRISE_BRAND_AUCTIONS.has(baseName)) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isSystemRandom: false,
      isProtectedCivic: false,
      isAuctionRequired: true,
      isSeparateDomainPurchase: true,
      entityType,
      billingCycle: 'one_time',
      auctionReason: 'Unique Enterprise Brand Name — Separate Auction Domain Purchase',
      monthlyUSD: baseMonthlyUSD,
      annualUSD: baseAnnualUSD,
      oneTimeDomainUSD: 1500,
      humanPriceUSD: 1500,
      botX402PriceUSD: 1500,
      tierLabel: 'Unique Brand Auction (Separate Domain Purchase)',
      billingNote: 'One-time domain auction purchase (separate from recurring handle plans).',
    };
  }

  if (isNumeric && ((numVal >= 1 && numVal <= 100) || baseName === '007')) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isSystemRandom: false,
      isProtectedCivic: false,
      isAuctionRequired: true,
      isSeparateDomainPurchase: true,
      entityType,
      billingCycle: 'one_time',
      auctionReason: 'Unique Iconic Shortcode (1–100 / 007) — Separate Auction Domain Purchase',
      monthlyUSD: baseMonthlyUSD,
      annualUSD: baseAnnualUSD,
      oneTimeDomainUSD: 800,
      humanPriceUSD: 800,
      botX402PriceUSD: 800,
      tierLabel: 'Unique Shortcode Auction (Separate Domain Purchase)',
      billingNote: 'One-time domain auction purchase (separate from recurring handle plans).',
    };
  }

  if (charLength <= 1) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isSystemRandom: false,
      isProtectedCivic: false,
      isAuctionRequired: false,
      isSeparateDomainPurchase: true,
      entityType,
      billingCycle: 'one_time',
      monthlyUSD: baseMonthlyUSD,
      annualUSD: baseAnnualUSD,
      oneTimeDomainUSD: 1000,
      humanPriceUSD: 1000,
      botX402PriceUSD: 1000,
      tierLabel: '1-Character Unique Domain (Separate Purchase)',
      billingNote: 'One-time unique domain name purchase, separate from standard subscriptions.',
    };
  }

  if (charLength === 2) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isSystemRandom: false,
      isProtectedCivic: false,
      isAuctionRequired: false,
      isSeparateDomainPurchase: true,
      entityType,
      billingCycle: 'one_time',
      monthlyUSD: baseMonthlyUSD,
      annualUSD: baseAnnualUSD,
      oneTimeDomainUSD: 500,
      humanPriceUSD: 500,
      botX402PriceUSD: 500,
      tierLabel: '2-Character Unique Domain (Separate Purchase)',
      billingNote: 'One-time unique domain name purchase, separate from standard subscriptions.',
    };
  }

  if (charLength === 3) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isSystemRandom: false,
      isProtectedCivic: false,
      isAuctionRequired: false,
      isSeparateDomainPurchase: true,
      entityType,
      billingCycle: 'one_time',
      monthlyUSD: baseMonthlyUSD,
      annualUSD: baseAnnualUSD,
      oneTimeDomainUSD: 200,
      humanPriceUSD: 200,
      botX402PriceUSD: 200,
      tierLabel: '3-Character Unique Domain (Separate Purchase)',
      billingNote: 'One-time unique domain name purchase, separate from standard subscriptions.',
    };
  }

  if (charLength === 4) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isSystemRandom: false,
      isProtectedCivic: false,
      isAuctionRequired: false,
      isSeparateDomainPurchase: true,
      entityType,
      billingCycle: 'one_time',
      monthlyUSD: baseMonthlyUSD,
      annualUSD: baseAnnualUSD,
      oneTimeDomainUSD: 50,
      humanPriceUSD: 50,
      botX402PriceUSD: 50,
      tierLabel: '4-Character Unique Domain (Separate Purchase)',
      billingNote: 'One-time unique domain name purchase, separate from standard subscriptions.',
    };
  }

  return {
    normalizedHandle,
    baseName,
    charLength,
    isNumeric,
    isSystemRandom: false,
    isProtectedCivic: false,
    isAuctionRequired: false,
    isSeparateDomainPurchase: false,
    entityType,
    billingCycle,
    monthlyUSD: baseMonthlyUSD,
    annualUSD: baseAnnualUSD,
    oneTimeDomainUSD: 0,
    humanPriceUSD: activeSubPriceUSD,
    botX402PriceUSD: activeSubPriceUSD,
    tierLabel:
      entityType === 'business'
        ? `Business Custom Name ($10/mo or $100/yr)`
        : `Personal Custom Name ($2/mo or $20/yr)`,
    billingNote:
      entityType === 'business'
        ? `Base business registration: $${activeSubPriceUSD}${activeSubPeriodLabel} (or free random businessagentXXXX.agent).`
        : `Minimum personal registration: $${activeSubPriceUSD}${activeSubPeriodLabel} (or free random personalagentXXXX.agent).`,
  };
}

export interface X402Challenge {
  status: 402;
  protocol: 'x402';
  amountUSD: number;
  amountZAR: number;
  rail: PaymentRail;
  payToAddress: string;
  nonce: string;
  expiresAt: string;
}

export function createX402Challenge(amountZAR: number, rail: PaymentRail): X402Challenge {
  const amountUSD = zarToUsd(amountZAR);
  const addrMap: Record<PaymentRail, string> = {
    x402_base: '0x8F2aSwitchboardBaseUSDC9104E',
    x402_arc: 'arc1qswitchboardsettlement008a',
    x402_solana: 'SwB8x402SolanaEscrow9pQ4kL',
    paypal_vault: 'VAULT_AUTONOMOUS_DELEGATE',
  };
  return {
    status: 402,
    protocol: 'x402',
    amountUSD,
    amountZAR,
    rail,
    payToAddress: addrMap[rail],
    nonce: `x402_${Math.random().toString(36).slice(2, 10)}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

export function executeSimulatedSettlement(
  rail: PaymentRail,
  amountZAR: number
): { txHash: string; x402Token?: string; receiptNote: string } {
  const randHex = Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  if (rail === 'paypal_vault') {
    return {
      txHash: `PAYPAL_VAULT_ORD_${randHex.slice(0, 10).toUpperCase()}`,
      receiptNote: `PayPal Orders v2 Vault Delegate captured ${formatUsdPrice(zarToUsd(amountZAR))}`,
    };
  }
  if (rail === 'x402_solana') {
    return {
      txHash: `5xSol${randHex.slice(0, 18)}`,
      x402Token: `X-402-Payment-Token: solana:${randHex}`,
      receiptNote: `Solana USDC x402 atomic settlement verified`,
    };
  }
  if (rail === 'x402_arc') {
    return {
      txHash: `arc_tx_${randHex.slice(0, 18)}`,
      x402Token: `X-402-Payment-Token: arc:${randHex}`,
      receiptNote: `Arc Network x402 settlement finalized`,
    };
  }
  return {
    txHash: `0x${randHex}`,
    x402Token: `X-402-Payment-Token: base-usdc:${randHex}`,
    receiptNote: `Base L2 USDC x402 payment verified`,
  };
}
