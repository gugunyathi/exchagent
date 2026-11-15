import React, { useState } from 'react';
import {
  Send,
  Zap,
  ShieldCheck,
  Radio,
  CreditCard,
  CalendarCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  AgentDoc,
  RfpDoc,
  NegotiationDoc,
  BookingDoc,
  CurrencyMode,
  PaymentRail,
  BroadcastChannel,
  ZAR_PER_USD,
  formatMoney,
} from '../types/firestore';
import { createX402Challenge } from '../services/paymentRails';
import { evaluateCalendarGuardrails } from '../services/calendarAgentTool';
import { SwipeScrollArea } from './SwipeScrollArea';

interface NegotiationArenaModuleProps {
  agents: AgentDoc[];
  rfps: RfpDoc[];
  negotiations: NegotiationDoc[];
  selectedTargetAgent: AgentDoc | null;
  currency: CurrencyMode;
  ownerUid: string;
  onSaveNegotiation: (neg: NegotiationDoc) => Promise<void>;
  onSettleDeal: (params: {
    sessionId: string;
    buyerHandle: string;
    sellerHandle: string;
    channel: string;
    stickerPriceZAR: number;
    agreedPriceZAR: number;
    rail: PaymentRail;
  }) => Promise<unknown>;
  onPublishRfp: (rfp: RfpDoc) => Promise<void>;
  onAddBooking: (booking: BookingDoc) => Promise<void>;
}

export const NegotiationArenaModule: React.FC<NegotiationArenaModuleProps> = ({
  agents,
  rfps,
  negotiations,
  selectedTargetAgent,
  currency,
  ownerUid,
  onSaveNegotiation,
  onSettleDeal,
  onPublishRfp,
  onAddBooking,
}) => {
  const nonEmergencyAgents = agents.filter((a) => a.handle !== '911.emergency.agent');
  const [subTab, setSubTab] = useState<'arena' | 'rfp'>('arena');

  // A2A Arena State
  const [initiatorHandle, setInitiatorHandle] = useState(
    nonEmergencyAgents.find((a) => a.handle === 'alex.founder.agent')?.handle ||
      nonEmergencyAgents[0]?.handle ||
      ''
  );
  const [targetHandle, setTargetHandle] = useState(
    selectedTargetAgent?.handle ||
      nonEmergencyAgents.find((a) => a.handle === 'ceo.woolworths.agent')?.handle ||
      nonEmergencyAgents[1]?.handle ||
      ''
  );
  const [proposalTitle, setProposalTitle] = useState(
    'Zero-Emission Sandton Last-Mile EV & Cold-Chain Telemetry Suite'
  );
  const [stickerPriceZAR, setStickerPriceZAR] = useState(145000);
  const [selectedRail, setSelectedRail] = useState<PaymentRail>('paypal_vault');
  const [runningNeg, setRunningNeg] = useState(false);
  const [activeNegId, setActiveNegId] = useState<string>(negotiations[0]?.id || '');
  const [x402StatusBanner, setX402StatusBanner] = useState<string | null>(null);
  const [settlementBanner, setSettlementBanner] = useState<string | null>(null);

  // Reverse-RFP State
  const [rfpTitle, setRfpTitle] = useState('Solar Smart Inverter Fleet for Randburg Retail Strip');
  const [rfpDesc, setRfpDesc] = useState(
    'Require 12 hybrid 15kVA smart inverters with automated telemetry and x402 milestone payouts.'
  );
  const [rfpBudgetZAR, setRfpBudgetZAR] = useState(210000);
  const [rfpCategory, setRfpCategory] = useState('Clean Energy & Telecom');
  const [rfpChannels, setRfpChannels] = useState<BroadcastChannel[]>([
    'directory',
    'google_maps_billboard',
    'ble_beacon',
    'carplay',
  ]);
  const [broadcasting, setBroadcasting] = useState(false);
  const [rfpProposals, setRfpProposals] = useState<
    Array<{ vendorHandle: string; bidZAR: number; matchScore: number; pitchSummary: string }>
  >([]);

  React.useEffect(() => {
    if (selectedTargetAgent && selectedTargetAgent.handle !== '911.emergency.agent') {
      setTargetHandle(selectedTargetAgent.handle);
      setSubTab('arena');
    }
  }, [selectedTargetAgent]);

  const activeNeg = negotiations.find((n) => n.id === activeNegId) || negotiations[0] || null;

  const handleRunNegotiation = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = agents.find((a) => a.handle === targetHandle);
    const initiator = agents.find((a) => a.handle === initiatorHandle);
    if (!target || !initiator) return;

    setRunningNeg(true);
    setSettlementBanner(null);
    setX402StatusBanner(null);

    try {
      const res = await fetch('/api/a2a/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiatorHandle: initiator.handle,
          targetHandle: target.handle,
          proposalTitle,
          stickerPriceZAR: Number(stickerPriceZAR),
          surface: 'desktop',
          targetMaxSpendZAR: target.guardrails.maxAutoSpendZAR,
          targetMinDiscountPct: target.guardrails.minDiscountPct,
        }),
      });
      const data = await res.json();

      const sessionId = `neg_${Date.now()}`;
      const newNeg: NegotiationDoc = {
        id: sessionId,
        initiatorAgentId: initiator.id,
        initiatorOwnerUid: ownerUid,
        targetAgentId: target.id,
        targetOwnerUid: target.ownerUid,
        initiatorHandle: initiator.handle,
        targetHandle: target.handle,
        surface: 'desktop',
        status: data.finalStatus || 'OFFER_ACCEPTED',
        stickerPriceZAR: Number(stickerPriceZAR),
        currentOfferZAR: data.agreedPriceZAR,
        agreedPriceZAR: data.finalStatus === 'OFFER_ACCEPTED' ? data.agreedPriceZAR : undefined,
        messages: data.messages || [],
        popiaAuditHash: data.popiaAuditHash || 'popia_sha256_verified',
        updatedAt: new Date().toISOString(),
      };

      await onSaveNegotiation(newNeg);
      setActiveNegId(sessionId);

      // Autonomous Calendar Scheduling when deal is accepted
      if (newNeg.status === 'OFFER_ACCEPTED' && newNeg.agreedPriceZAR) {
        const calCheck = evaluateCalendarGuardrails(target, newNeg.agreedPriceZAR);
        if (calCheck.guardrailCheckPassed) {
          await onAddBooking({
            id: `book_${Date.now()}`,
            sessionId,
            organizerAgentId: initiator.id,
            organizerHandle: initiator.handle,
            attendeeAgentId: target.id,
            attendeeHandle: target.handle,
            ownerUid,
            title: data.calendarMeetingTitle || `${proposalTitle} — SLA Kickoff`,
            startTime: calCheck.suggestedStartISO,
            endTime: calCheck.suggestedEndISO,
            meetLink: `https://meet.google.com/swb-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`,
            dealValueZAR: newNeg.agreedPriceZAR,
            googleSynced: false,
            status: 'CONFIRMED',
          });
        }
      }
    } finally {
      setRunningNeg(false);
    }
  };

  const handleTriggerSettlement = async () => {
    if (!activeNeg || !activeNeg.agreedPriceZAR) return;
    if (selectedRail.startsWith('x402_')) {
      const challenge = createX402Challenge(activeNeg.agreedPriceZAR, selectedRail);
      setX402StatusBanner(
        `HTTP 402 Payment Required Challenge issued (${challenge.nonce}) → ${challenge.payToAddress} ($${challenge.amountUSD} USDC). Signing X-402-Payment-Token...`
      );
      await new Promise((r) => setTimeout(r, 450));
    }
    await onSettleDeal({
      sessionId: activeNeg.id,
      buyerHandle: activeNeg.targetHandle,
      sellerHandle: activeNeg.initiatorHandle,
      channel: 'A2A Arena',
      stickerPriceZAR: activeNeg.stickerPriceZAR,
      agreedPriceZAR: activeNeg.agreedPriceZAR,
      rail: selectedRail,
    });
    setSettlementBanner(
      `Settled ${formatMoney(activeNeg.agreedPriceZAR, currency)} via ${selectedRail.toUpperCase()} — Enterprise Audit Ledger updated.`
    );
  };

  const handleBroadcastRfp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcasting(true);
    try {
      const publisher = nonEmergencyAgents[0];
      const rfp: RfpDoc = {
        id: `rfp_${Date.now()}`,
        publisherAgentId: publisher?.id || 'agent_alex_founder',
        publisherOwnerUid: ownerUid,
        publisherHandle: publisher?.handle || 'alex.founder.agent',
        title: rfpTitle,
        description: rfpDesc,
        budgetZAR: Number(rfpBudgetZAR),
        budgetUSD: Number((Number(rfpBudgetZAR) / ZAR_PER_USD).toFixed(2)),
        category: rfpCategory,
        broadcastChannels: rfpChannels,
        location: {
          lat: -26.0594,
          lng: 27.9583,
          billboardName: 'Sandton / William Nicol Live Corridor',
          radiusMeters: 600,
        },
        status: 'OPEN',
        expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        matchedProposalsCount: 3,
      };
      await onPublishRfp(rfp);

      const res = await fetch('/api/rfp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: rfpTitle,
          description: rfpDesc,
          budgetZAR: Number(rfpBudgetZAR),
          category: rfpCategory,
          broadcastChannels: rfpChannels,
        }),
      });
      const data = await res.json();
      setRfpProposals(data.proposals || []);
    } finally {
      setBroadcasting(false);
    }
  };

  const toggleChannel = (ch: BroadcastChannel) => {
    setRfpChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const activeSavingsPct =
    activeNeg && activeNeg.stickerPriceZAR > 0
      ? Math.round(
          ((activeNeg.stickerPriceZAR - (activeNeg.agreedPriceZAR || activeNeg.currentOfferZAR)) /
            activeNeg.stickerPriceZAR) *
            100
        )
      : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Sub-navigation bar */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-cyan-400">
            Gemini A2A · POPIA Guardrails
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            Negotiation Arena
          </h2>
        </div>

        <SwipeScrollArea
          direction="horizontal"
          innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-950/75 border border-slate-800"
        >
          <button
            type="button"
            onClick={() => setSubTab('arena')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'arena'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bilateral A2A
          </button>
          <button
            type="button"
            onClick={() => setSubTab('rfp')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'rfp'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Reverse-RFP ({rfps.length})
          </button>
        </SwipeScrollArea>
      </div>

      {subTab === 'arena' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          {/* Left: Pitch Initiator Console */}
          <form onSubmit={handleRunNegotiation} className="lg:col-span-5 glass-panel rounded-2xl p-3.5 sm:p-4 space-y-3">
            <h3 className="text-sm sm:text-base font-semibold text-white">New A2A Pitch</h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                From Agent
              </label>
              <select
                value={initiatorHandle}
                onChange={(e) => setInitiatorHandle(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-100"
              >
                {nonEmergencyAgents.map((a) => (
                  <option key={a.id} value={a.handle}>
                    {a.handle} ({a.organization})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                To Agent
              </label>
              <select
                value={targetHandle}
                onChange={(e) => setTargetHandle(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs font-mono text-cyan-200"
              >
                {nonEmergencyAgents.map((a) => (
                  <option key={a.id} value={a.handle}>
                    {a.handle} · Cap {formatMoney(a.guardrails.maxAutoSpendZAR, currency)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Proposal
              </label>
              <textarea
                rows={2}
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Sticker (ZAR)
                </label>
                <input
                  type="number"
                  min={500}
                  value={stickerPriceZAR}
                  onChange={(e) => setStickerPriceZAR(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  USD Value
                </label>
                <div className="w-full min-h-[42px] rounded-xl bg-slate-950/50 border border-slate-800/70 px-3 py-2 flex items-center text-sm font-mono tabular-nums text-slate-300">
                  ${(stickerPriceZAR / ZAR_PER_USD).toFixed(2)}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={runningNeg}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition-colors"
            >
              <Zap className="w-4 h-4" />
              {runningNeg ? 'Negotiating...' : 'Launch A2A Pitch'}
            </button>

            {/* Recent Session Switcher */}
            <div className="pt-3 border-t border-slate-800/80">
              <p className="text-xs font-medium text-slate-400 mb-2">Recent Negotiation Sessions</p>
              <SwipeScrollArea direction="vertical" className="max-h-40" innerClassName="space-y-1.5">
                {negotiations.map((neg) => (
                  <button
                    key={neg.id}
                    type="button"
                    onClick={() => setActiveNegId(neg.id)}
                    className={`w-full min-h-[38px] text-left rounded-lg px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                      activeNeg?.id === neg.id
                        ? 'bg-cyan-500/15 border border-cyan-400/30 text-white'
                        : 'bg-slate-950/50 border border-slate-800/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-mono truncate">
                      {neg.initiatorHandle} → {neg.targetHandle}
                    </span>
                    <span className="font-mono tabular-nums text-emerald-300 shrink-0 ml-2">
                      {neg.status}
                    </span>
                  </button>
                ))}
              </SwipeScrollArea>
            </div>
          </form>

          {/* Right: Live A2A Packet Stream + Dual Payment Settlement */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-4">
            {activeNeg ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                      <span className="font-mono text-cyan-300 truncate">{activeNeg.initiatorHandle}</span>
                      <span>→</span>
                      <span className="font-mono text-emerald-300 truncate">{activeNeg.targetHandle}</span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                      POPIA Audit: {activeNeg.popiaAuditHash}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:text-right shrink-0">
                    <div>
                      <p className="text-[11px] text-slate-500">
                        Sticker → Agreed {activeSavingsPct > 0 ? `(−${activeSavingsPct}%)` : ''}
                      </p>
                      <p className="text-sm font-mono tabular-nums text-white">
                        {formatMoney(activeNeg.stickerPriceZAR, currency)} →{' '}
                        <span className="text-emerald-400 font-semibold">
                          {formatMoney(activeNeg.agreedPriceZAR || activeNeg.currentOfferZAR, currency)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Structured JSON A2A Packet Messages */}
                <div className="space-y-2.5">
                  {activeNeg.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl p-3.5 border ${
                        msg.senderRole === 'seller'
                          ? 'bg-slate-950/60 border-slate-800'
                          : 'bg-cyan-950/20 border-cyan-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-medium text-slate-200 truncate">
                          {msg.sender} · {msg.type.toUpperCase()}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-emerald-300 shrink-0">
                          {formatMoney(msg.priceZAR, currency)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">{msg.rationale}</p>
                      {msg.toolCall && (
                        <p className="mt-1.5 text-xs font-mono text-cyan-400 truncate">
                          Tool: {msg.toolCall}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Payment Settlement Rail Selector */}
                {activeNeg.status === 'OFFER_ACCEPTED' && (
                  <div className="pt-3.5 border-t border-slate-800/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Accepted Within Guardrails</span>
                      </div>
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <CalendarCheck className="w-3.5 h-3.5 text-cyan-400" />
                        Auto-Booked
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          { id: 'paypal_vault', label: 'PayPal Vault' },
                          { id: 'x402_base', label: 'x402 Base USDC' },
                          { id: 'x402_arc', label: 'x402 Arc' },
                          { id: 'x402_solana', label: 'x402 Solana' },
                        ] as const
                      ).map((rail) => (
                        <button
                          key={rail.id}
                          type="button"
                          onClick={() => setSelectedRail(rail.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                            selectedRail === rail.id
                              ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {rail.label}
                        </button>
                      ))}
                    </div>

                    {x402StatusBanner && (
                      <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3 text-xs font-mono text-amber-200">
                        {x402StatusBanner}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleTriggerSettlement}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Execute Autonomous Settlement ({formatMoney(activeNeg.agreedPriceZAR || 0, currency)})
                    </button>
                  </div>
                )}

                {activeNeg.status === 'SETTLED' && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4 flex items-center gap-3 text-sm text-emerald-200">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span>
                      {settlementBanner ||
                        'Deal settled on-chain / PayPal Vault and recorded in the Enterprise Audit Ledger.'}
                    </span>
                  </div>
                )}

                {activeNeg.status === 'REJECTED' && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-400/30 p-4 flex items-center gap-3 text-sm text-rose-200">
                    <XCircle className="w-5 h-5 shrink-0" />
                    <span>Offer rejected by buyer margin/spend guardrails. Escalated to human owner.</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">Launch a negotiation on the left to stream live A2A packets.</p>
            )}
          </div>
        </div>
      ) : (
        /* Reverse-RFP Broadcaster */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          <form onSubmit={handleBroadcastRfp} className="lg:col-span-5 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3.5">
            <h3 className="text-sm sm:text-base font-semibold text-white">Broadcast Ambient Reverse-RFP</h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">RFP Title</label>
              <input
                type="text"
                required
                value={rfpTitle}
                onChange={(e) => setRfpTitle(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Requirements</label>
              <textarea
                rows={3}
                value={rfpDesc}
                onChange={(e) => setRfpDesc(e.target.value)}
                className="w-full rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-sm text-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Budget (ZAR)</label>
                <input
                  type="number"
                  value={rfpBudgetZAR}
                  onChange={(e) => setRfpBudgetZAR(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <input
                  type="text"
                  value={rfpCategory}
                  onChange={(e) => setRfpCategory(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Broadcast Channels
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'directory', label: 'Online Directory' },
                    { id: 'google_maps_billboard', label: 'DOOH Billboards' },
                    { id: 'ble_beacon', label: 'BLE 50m Mesh' },
                    { id: 'carplay', label: 'CarPlay / Auto' },
                  ] as const
                ).map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium border text-left transition-colors ${
                      rfpChannels.includes(ch.id)
                        ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={broadcasting}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50 transition-colors"
            >
              <Radio className="w-4 h-4" />
              {broadcasting ? 'Broadcasting & Matching...' : 'Publish Reverse-RFP'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {rfpProposals.length > 0 && (
              <div className="glass-panel rounded-2xl p-5 border-emerald-500/30 space-y-3">
                <h4 className="text-sm font-semibold text-emerald-300">
                  Instant Gemini Auto-Matched Vendor Proposals
                </h4>
                <div className="space-y-2.5">
                  {rfpProposals.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-xs font-mono text-cyan-300">
                          {p.vendorHandle} · Match {p.matchScore}%
                        </p>
                        <p className="text-xs text-slate-300 mt-1">{p.pitchSummary}</p>
                      </div>
                      <span className="font-mono tabular-nums text-sm font-semibold text-emerald-300 shrink-0">
                        {formatMoney(p.bidZAR, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3">
              <h3 className="text-sm sm:text-base font-semibold text-white">Active Reverse-RFPs</h3>
              <div className="space-y-2.5">
                {rfps.map((rfp) => (
                  <div
                    key={rfp.id}
                    className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <span className="font-mono text-cyan-300 truncate">{rfp.publisherHandle}</span>
                      <span className="font-mono text-emerald-400 shrink-0">{rfp.status}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{rfp.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{rfp.description}</p>
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-800/60">
                      <span className="text-slate-400 truncate">
                        {rfp.broadcastChannels.join(' · ')}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-white shrink-0">
                        {formatMoney(rfp.budgetZAR, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
