import React, { useState } from 'react';
import {
  Phone,
  QrCode,
  Check,
  Navigation,
  Eye,
  Volume2,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import {
  SurfaceMode,
  AgentDoc,
  RfpDoc,
  SettlementDoc,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';

interface SurfaceSimulatorFrameProps {
  surface: SurfaceMode;
  agents: AgentDoc[];
  rfps: RfpDoc[];
  settlements: SettlementDoc[];
  currency: CurrencyMode;
  onPitchAgent: (agent: AgentDoc) => void;
  onDialNumber: (num: string) => void;
  onSwitchToDesktop: () => void;
}

export const SurfaceSimulatorFrame: React.FC<SurfaceSimulatorFrameProps> = ({
  surface,
  agents,
  rfps,
  settlements,
  currency,
  onPitchAgent,
  onDialNumber,
  onSwitchToDesktop,
}) => {
  const [mobileIdx, setMobileIdx] = useState(0);
  const [watchActionNote, setWatchActionNote] = useState<string | null>(null);
  const [qrScanned, setQrScanned] = useState(false);

  const nonEmergency = agents.filter((a) => a.handle !== '911.emergency.agent');
  const activeMobileAgent = nonEmergency[mobileIdx % nonEmergency.length] || nonEmergency[0];
  const totalSavedZAR = settlements.reduce((sum, s) => sum + s.savedZAR, 0);
  const featuredRfp = rfps[0];

  if (surface === 'mobile') {
    return (
      <div className="flex flex-col items-center py-2 sm:py-4">
        <div className="w-full max-w-[375px] rounded-[34px] border-4 border-slate-800 bg-[#050811] p-3.5 sm:p-4 shadow-2xl space-y-3.5">
          <div className="w-24 h-1.5 rounded-full bg-slate-800 mx-auto" />
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-display font-semibold text-white">Switchboard PWA</span>
            <button onClick={() => setQrScanned((v) => !v)} className="min-h-[36px] text-cyan-300 flex items-center gap-1">
              <QrCode className="w-4 h-4" />
              {qrScanned ? 'Scanned Sandton BLE' : 'Scan QR'}
            </button>
          </div>

          {activeMobileAgent && (
            <div className="rounded-2xl glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono gap-2">
                <span className="text-cyan-300 truncate">{activeMobileAgent.handle}</span>
                <span className="text-emerald-400 shrink-0">POPIA Verified</span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-white">{activeMobileAgent.displayName}</h3>
              <p className="text-xs text-slate-400">
                {activeMobileAgent.roleTitle} · {activeMobileAgent.organization}
              </p>
              <div className="pt-2 border-t border-slate-800/80 flex justify-between text-xs">
                <span className="text-slate-400">Auto-Spend Cap</span>
                <span className="font-mono tabular-nums text-emerald-300">
                  {formatMoney(activeMobileAgent.guardrails.maxAutoSpendZAR, currency)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => onPitchAgent(activeMobileAgent)}
                  className="min-h-[44px] rounded-xl bg-cyan-400 py-2.5 text-xs font-semibold text-slate-950"
                >
                  Voice / Text Pitch
                </button>
                <button
                  onClick={() => setMobileIdx((i) => i + 1)}
                  className="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 py-2.5 text-xs font-medium text-slate-200 flex items-center justify-center gap-1"
                >
                  Next Card <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Savings</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-300">
              {formatMoney(totalSavedZAR, currency)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onDialNumber('911')}
              className="min-h-[44px] rounded-xl bg-rose-500/20 border border-rose-500/40 py-2.5 text-xs font-semibold text-rose-200"
            >
              911 SOS Priority
            </button>
            <button
              onClick={onSwitchToDesktop}
              className="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 py-2.5 text-xs text-slate-300"
            >
              Exit Mobile View
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (surface === 'watch') {
    return (
      <div className="flex flex-col items-center py-4 sm:py-8 space-y-4">
        <div className="w-[min(82vw,310px)] aspect-square rounded-full border-[6px] border-slate-800 bg-[#040710] p-5 sm:p-7 shadow-2xl flex flex-col items-center justify-between text-center">
          <div>
            <p className="text-[10px] font-mono text-cyan-400">SAVED THIS MONTH</p>
            <p className="text-lg sm:text-xl font-mono font-bold text-emerald-300 tabular-nums">
              {formatMoney(totalSavedZAR, currency)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-white line-clamp-2">
              {featuredRfp?.title || 'Sandton 5G Solar RFP'}
            </p>
            <p className="text-[11px] font-mono tabular-nums text-amber-300">
              Offer: {formatMoney(Math.round((featuredRfp?.budgetZAR || 120000) * 0.86), currency)}
            </p>
            {watchActionNote && (
              <p className="text-[10px] text-emerald-300">{watchActionNote}</p>
            )}
          </div>

          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => setWatchActionNote('Deal Approved via Vault!')}
              className="flex-1 min-h-[40px] rounded-full bg-emerald-400 py-2 text-xs font-bold text-slate-950"
            >
              Approve
            </button>
            <button
              onClick={() => setWatchActionNote('Counter -5% Sent')}
              className="flex-1 min-h-[40px] rounded-full bg-slate-800 py-2 text-xs font-semibold text-white"
            >
              Counter
            </button>
          </div>
        </div>
        <button
          onClick={onSwitchToDesktop}
          className="min-h-[38px] px-3 text-xs text-slate-400 hover:text-white underline"
        >
          Return to Desktop Portal
        </button>
      </div>
    );
  }

  if (surface === 'ar') {
    return (
      <div className="glass-panel rounded-3xl p-3.5 sm:p-6 min-h-[380px] sm:min-h-[440px] relative overflow-hidden bg-gradient-to-br from-slate-950/90 via-[#050b18]/80 to-cyan-950/30 border-cyan-500/30 flex flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-2 text-xs font-mono text-cyan-300">
          <span className="flex items-center gap-1.5 truncate">
            <Eye className="w-4 h-4 shrink-0" />
            <span className="truncate">AR SPATIAL HUD · SANDTON ATRIUM BLE MESH</span>
          </span>
          <button onClick={onSwitchToDesktop} className="min-h-[36px] px-2 text-slate-300 hover:text-white shrink-0">
            Exit HUD
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 my-2 sm:my-4">
          {nonEmergency.slice(0, 3).map((agent, idx) => (
            <div
              key={agent.id}
              className="rounded-2xl bg-slate-950/60 backdrop-blur-xl border border-cyan-400/35 p-3.5 sm:p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-cyan-300">{18 + idx * 14}m AHEAD</span>
                <span className="text-emerald-400">BLE LOCK</span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{agent.displayName}</p>
              <p className="text-xs font-mono text-slate-300 truncate">{agent.handle}</p>
              <p className="text-[11px] text-emerald-300">
                {agent.passerbyIncentive || 'Instant A2A Negotiation Ready'}
              </p>
              <button
                onClick={() => onPitchAgent(agent)}
                className="w-full min-h-[42px] mt-2 rounded-xl bg-cyan-400/20 border border-cyan-400/40 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/30"
              >
                Gaze-Lock & Pitch
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-800/70 pt-3">
          <span>3 Spatial Beacons · 1 DOOH Gantry Active</span>
          <button
            onClick={() => onDialNumber('911')}
            className="min-h-[36px] text-rose-300 font-semibold flex items-center gap-1"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Voice SOS 911
          </button>
        </div>
      </div>
    );
  }

  // CarPlay / Android Auto Dashboard
  return (
    <div className="glass-panel rounded-3xl p-3.5 sm:p-6 border-slate-700 bg-[#040711] space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Navigation className="w-6 h-6 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-mono text-cyan-300 truncate">CARPLAY / ANDROID AUTO VOICE-FIRST</p>
            <h3 className="text-base sm:text-lg font-semibold text-white truncate">William Nicol Dr Commuter Corridor</h3>
          </div>
        </div>
        <button
          onClick={onSwitchToDesktop}
          className="min-h-[40px] rounded-xl bg-slate-900 border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 whitespace-nowrap"
        >
          Exit Drive Mode
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {rfps.slice(0, 2).map((rfp) => (
          <div key={rfp.id} className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5 sm:p-5 space-y-3">
            <p className="text-xs font-mono text-amber-300 truncate">
              {rfp.location?.billboardName || 'Roadside DOOH Beacon'}
            </p>
            <h4 className="text-sm sm:text-base font-semibold text-white">{rfp.title}</h4>
            <p className="text-sm font-mono tabular-nums text-emerald-300">
              Budget: {formatMoney(rfp.budgetZAR, currency)}
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
              <button
                onClick={() => {
                  const target = agents.find((a) => a.handle === rfp.publisherHandle);
                  if (target) onPitchAgent(target);
                }}
                className="min-h-[46px] rounded-xl bg-emerald-400 text-slate-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Check className="w-4 h-4" /> Auto-Bid
              </button>
              <button
                onClick={() => {
                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(
                      new SpeechSynthesisUtterance(
                        `Nearby billboard RFP from ${rfp.publisherHandle}: ${rfp.title}, budget ${rfp.budgetZAR} Rand.`
                      )
                    );
                  }
                }}
                className="min-h-[46px] rounded-xl bg-slate-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Volume2 className="w-4 h-4" /> Read Aloud
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onDialNumber('sandton.bistro.agent')}
          className="min-h-[48px] rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 font-semibold text-sm flex items-center justify-center gap-2"
        >
          <Phone className="w-4 h-4" /> Voice Dial Nearby Bistro
        </button>
        <button
          onClick={() => onDialNumber('911')}
          className="min-h-[48px] rounded-2xl bg-rose-500/20 border border-rose-500/50 text-rose-100 font-semibold text-sm flex items-center justify-center gap-2"
        >
          <ShieldAlert className="w-4 h-4" /> Hands-Free 911 Emergency
        </button>
      </div>
    </div>
  );
};
