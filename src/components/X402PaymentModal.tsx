import React, { useEffect, useState } from 'react';
import {
  X,
  Zap,
  ShieldCheck,
  Wallet,
  Bot,
  User,
  CheckCircle2,
  Copy,
  Loader2,
  CreditCard,
} from 'lucide-react';
import {
  CurrencyMode,
  PaymentRail,
  X402AccountEntitlement,
  X402ChallengePayload,
} from '../types/firestore';
import { formatCurrencyFromUsd, LocalCurrencyCode } from '../lib/fx';
import { emitToast } from '../lib/toast';

interface X402PaymentModalProps {
  challenge: X402ChallengePayload | null;
  entitlement: X402AccountEntitlement;
  settling: boolean;
  currency: CurrencyMode;
  fxRates: Record<LocalCurrencyCode, number>;
  defaultAgentHandle: string;
  onSettle: (opts: {
    rail: PaymentRail;
    payerType: 'human' | 'agent';
    payerHandle?: string;
    useWalletBalance?: boolean;
  }) => Promise<unknown>;
  onCancel: () => void;
  onEnableAutoPay?: (enabled: boolean, maxUsd: number) => Promise<unknown>;
}

const RAIL_OPTIONS: Array<{
  id: PaymentRail;
  label: string;
  sublabel: string;
  networkTag: string;
}> = [
  { id: 'x402_base', label: 'Base USDC', sublabel: 'Instant L2 x402 ($0.001 gas)', networkTag: 'Coinbase x402' },
  { id: 'x402_arc', label: 'Arc USDC', sublabel: 'Sub-second finality', networkTag: 'Arc Protocol' },
  { id: 'x402_solana', label: 'Solana USDC', sublabel: '400ms SPL transfer', networkTag: 'Solana SPL' },
  { id: 'paypal_vault', label: 'PayPal Vault', sublabel: 'Card / Bank via Vault', networkTag: 'USD Fiat' },
];

export const X402PaymentModal: React.FC<X402PaymentModalProps> = ({
  challenge,
  entitlement,
  settling,
  currency,
  fxRates,
  defaultAgentHandle,
  onSettle,
  onCancel,
  onEnableAutoPay,
}) => {
  const [payerType, setPayerType] = useState<'human' | 'agent'>('human');
  const [selectedRail, setSelectedRail] = useState<PaymentRail>('x402_base');
  const [useWalletBalance, setUseWalletBalance] = useState<boolean>(
    () => (entitlement?.walletBalanceUSD || 0) >= (challenge?.amountUSD || 0)
  );
  const [enableAutoPayToggle, setEnableAutoPayToggle] = useState<boolean>(false);

  useEffect(() => {
    if (!challenge) return;
    setUseWalletBalance(entitlement.walletBalanceUSD >= challenge.amountUSD);
  }, [challenge, entitlement.walletBalanceUSD]);

  useEffect(() => {
    if (!challenge) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !settling) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [challenge, onCancel, settling]);

  if (!challenge) return null;

  const canPayFromWallet = entitlement.walletBalanceUSD >= challenge.amountUSD;
  const displayAmount = formatCurrencyFromUsd(
    challenge.amountUSD,
    currency === 'USD' ? 'USD' : currency,
    fxRates
  );

  const payToAddress =
    selectedRail === 'x402_arc'
      ? challenge.payToAddresses.arc
      : selectedRail === 'x402_solana'
      ? challenge.payToAddresses.solana
      : selectedRail === 'paypal_vault'
      ? challenge.payToAddresses.paypalVault
      : challenge.payToAddresses.base;

  const handleConfirm = async () => {
    if (enableAutoPayToggle && !entitlement.autoPayEnabled && onEnableAutoPay) {
      try {
        await onEnableAutoPay(true, Math.max(25, challenge.amountUSD));
      } catch {
        // non-blocking
      }
    }
    await onSettle({
      rail: selectedRail,
      payerType,
      payerHandle: defaultAgentHandle,
      useWalletBalance: useWalletBalance && canPayFromWallet,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-zinc-950/70 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => !settling && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-700 dark:text-amber-300 font-semibold">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>HTTP 402 · X402 PAYMENT REQUIRED</span>
            </div>
            <h3 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 mt-1 leading-snug">
              {challenge.title}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
              {challenge.description}
            </p>
          </div>
          <button
            type="button"
            disabled={settling}
            onClick={onCancel}
            className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
            aria-label="Cancel payment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Price Summary Strip */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Settlement Amount
              </p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-display font-bold font-mono tabular-nums text-zinc-950 dark:text-zinc-50">
                  ${challenge.amountUSD.toFixed(2)} USDC
                </span>
                {currency !== 'USD' && (
                  <span className="text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                    ({displayAmount})
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                ID: {challenge.paymentId.slice(0, 14)}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                HMAC Signed
              </p>
            </div>
          </div>

          {/* Payer Identity Switch: Human vs Autonomous Agent */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
              Paying As
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayerType('human')}
                className={`min-h-[42px] px-3 rounded-xl border text-left flex items-center gap-2 transition-colors ${
                  payerType === 'human'
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white'
                    : 'bg-zinc-50 dark:bg-zinc-900/70 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-white/10'
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">Human Account</p>
                  <p className="text-[10px] opacity-75 truncate">One-tap approval</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPayerType('agent')}
                className={`min-h-[42px] px-3 rounded-xl border text-left flex items-center gap-2 transition-colors ${
                  payerType === 'agent'
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white'
                    : 'bg-zinc-50 dark:bg-zinc-900/70 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-white/10'
                }`}
              >
                <Bot className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">Agent Wallet</p>
                  <p className="text-[10px] opacity-75 truncate">{defaultAgentHandle}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Pre-Funded Wallet Balance Debit Toggle */}
          <div className="rounded-xl border border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900/60 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Wallet className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                  Use x402 Wallet Balance (${entitlement.walletBalanceUSD.toFixed(2)} USDC)
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                  {canPayFromWallet
                    ? 'Instant zero-fee internal settlement'
                    : `Insufficient wallet balance — settle directly via selected rail below`}
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={useWalletBalance && canPayFromWallet}
              disabled={!canPayFromWallet}
              onChange={(e) => setUseWalletBalance(e.target.checked)}
              className="w-4 h-4 accent-zinc-950 dark:accent-sky-400 cursor-pointer shrink-0"
            />
          </div>

          {/* Settlement Rail Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
              Settlement Rail
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RAIL_OPTIONS.map((rail) => {
                const active = selectedRail === rail.id;
                return (
                  <button
                    key={rail.id}
                    type="button"
                    onClick={() => setSelectedRail(rail.id)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-sky-600 dark:border-sky-400 bg-sky-50 dark:bg-sky-950/30'
                        : 'border-zinc-300 dark:border-white/10 bg-white dark:bg-zinc-900/50 hover:border-zinc-400 dark:hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
                        {rail.id === 'paypal_vault' ? (
                          <CreditCard className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        {rail.label}
                      </span>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                      {rail.sublabel}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destination & Nonce */}
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
            <span className="truncate">PayTo: {payToAddress}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(payToAddress).catch(() => {});
                emitToast('Copied x402 destination address', 'info');
              }}
              className="text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          </div>

          {/* Optional Auto-Pay Opt-In */}
          {!entitlement.autoPayEnabled && canPayFromWallet && (
            <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableAutoPayToggle}
                onChange={(e) => setEnableAutoPayToggle(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-zinc-950 dark:accent-sky-400"
              />
              <span>
                Enable autonomous x402 Auto-Pay for future agent API calls (up to $25/call from wallet balance).
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={settling}
            onClick={onCancel}
            className="min-h-[40px] px-4 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-white/15 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={settling}
            onClick={handleConfirm}
            className="min-h-[42px] px-5 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            {settling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Settling via x402...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Pay ${challenge.amountUSD.toFixed(2)} {useWalletBalance && canPayFromWallet ? 'from Wallet' : `via ${selectedRail.replace('x402_', '').replace('_', ' ').toUpperCase()}`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
