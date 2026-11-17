import { PaymentRail, zarToUsd } from '../types/firestore';
import { formatUsdPrice } from '../lib/fx';
import { PROTECTED_EMERGENCY_NUMBERS } from '../data/seedData';

export interface HandlePricingQuote {
  normalizedHandle: string;
  baseName: string;
  charLength: number;
  isNumeric: boolean;
  isProtectedCivic: boolean;
  isAuctionRequired: boolean;
  auctionReason?: string;
  humanPriceUSD: number;
  botX402PriceUSD: number;
  tierLabel: string;
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

export function quoteHandlePricing(rawInput: string): HandlePricingQuote {
  const cleaned = rawInput
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\.agent$/, '')
    .replace(/[^a-z0-9.-]/g, '');

  const baseName = cleaned || 'myagent';
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
      isProtectedCivic: true,
      isAuctionRequired: false,
      auctionReason: 'Protected Civic & Emergency Number (Locked from Commercial Registration)',
      humanPriceUSD: 0,
      botX402PriceUSD: 0,
      tierLabel: 'Civic / Emergency Protected',
    };
  }

  if (ENTERPRISE_BRAND_AUCTIONS.has(baseName)) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isProtectedCivic: false,
      isAuctionRequired: true,
      auctionReason: 'Reserved Enterprise Brand Namespace — English Auction Pool',
      humanPriceUSD: 1500,
      botX402PriceUSD: 1500,
      tierLabel: 'Enterprise Brand Auction',
    };
  }

  if (isNumeric && ((numVal >= 1 && numVal <= 100) || baseName === '007')) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isProtectedCivic: false,
      isAuctionRequired: true,
      auctionReason: 'Iconic Shortcode (1–100 / 007) — English Auction Pool',
      humanPriceUSD: 800,
      botX402PriceUSD: 800,
      tierLabel: 'Iconic Number Auction',
    };
  }

  if (charLength <= 1) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isProtectedCivic: false,
      isAuctionRequired: false,
      humanPriceUSD: 1000,
      botX402PriceUSD: 1000,
      tierLabel: '1-Character Ultra Premium',
    };
  }
  if (charLength === 2) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isProtectedCivic: false,
      isAuctionRequired: false,
      humanPriceUSD: 500,
      botX402PriceUSD: 500,
      tierLabel: '2-Character Sovereign Tier',
    };
  }
  if (charLength === 3) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isProtectedCivic: false,
      isAuctionRequired: false,
      humanPriceUSD: 200,
      botX402PriceUSD: 200,
      tierLabel: '3-Character Executive Tier',
    };
  }
  if (charLength === 4) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isProtectedCivic: false,
      isAuctionRequired: false,
      humanPriceUSD: 50,
      botX402PriceUSD: 50,
      tierLabel: '4-Character Studio Tier',
    };
  }
  if (charLength <= 6) {
    return {
      normalizedHandle,
      baseName,
      charLength,
      isNumeric,
      isProtectedCivic: false,
      isAuctionRequired: false,
      humanPriceUSD: 10,
      botX402PriceUSD: 10,
      tierLabel: '5–6 Character Growth Tier',
    };
  }

  return {
    normalizedHandle,
    baseName,
    charLength,
    isNumeric,
    isProtectedCivic: false,
    isAuctionRequired: false,
    humanPriceUSD: 0,
    botX402PriceUSD: 0.2,
    tierLabel: '7+ Chars (Free Human / US$0.20 USDC x402 Bot)',
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
