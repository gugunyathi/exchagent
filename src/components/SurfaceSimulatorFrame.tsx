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
  ArrowLeft,
  X,
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
  onEngageAgent: (agent: AgentDoc) => void;
  onDialNumber: (num: string) => void;
  onSwitchToDesktop: () => void;
  onGoBack?: () => void;
}

export const SurfaceSimulatorFrame: React.FC<SurfaceSimulatorFrameProps> = ({
  surface,
  agents,
  rfps,
  settlements,
  currency,
  onEngageAgent,
  onDialNumber,
  onSwitchToDesktop,
  onGoBack,
}) => {
  const handleBack = onGoBack || onSwitchToDesktop;
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
        <div className="w-full max-w-[375px] rounded-[30px] border-2 border-zinc-300 dark:border-white/15 bg-zinc-100 dark:bg-[#09090b] p-4 shadow-2xl space-y-3.5">
          <div className="w-20 h-1 rounded-full bg-zinc-300 dark:bg-zinc-800 mx-auto" />
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleBack}
                className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300"
                aria-label="Back"
                title="Back"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-display font-bold text-zinc-950 dark:text-white">Switchboard Mobile</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setQrScanned((v) => !v)} className="min-h-[34px] text-sky-700 dark:text-sky-400 flex items-center gap-1 font-medium">
                <QrCode className="w-3.5 h-3.5" />
                {qrScanned ? 'Sandton BLE' : 'Scan QR'}
              </button>
              <button
                type="button"
                onClick={onSwitchToDesktop}
                className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300"
                aria-label="Close mobile simulator"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {activeMobileAgent && (
            <div className="rounded-xl glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono gap-2">
                <span className="text-sky-700 dark:text-sky-400 truncate">{activeMobileAgent.handle}</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium shrink-0">Verified</span>
              </div>
              <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                {activeMobileAgent.displayName}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {activeMobileAgent.roleTitle} · {activeMobileAgent.organization}
              </p>
              <div className="pt-2 border-t border-zinc-200 dark:border-white/10 flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Auto-Spend Cap</span>
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                  {formatMoney(activeMobileAgent.guardrails.maxAutoSpendZAR, currency)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onEngageAgent(activeMobileAgent)}
                  className="min-h-[42px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold"
                >
                  Engage Agent
                </button>
                <button
                  onClick={() => setMobileIdx((i) => i + 1)}
                  className="min-h-[42px] rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-900 dark:text-zinc-200 flex items-center justify-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-white/10 p-3 flex items-center justify-between text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">Total Saved</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
              {formatMoney(totalSavedZAR, currency)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onDialNumber('911')}
              className="min-h-[42px] rounded-lg bg-rose-50 border border-rose-300 text-rose-700 dark:bg-rose-500/15 dark:border-rose-500/30 text-xs font-semibold dark:text-rose-300"
            >
              911 SOS
            </button>
            <button
              onClick={onSwitchToDesktop}
              className="min-h-[42px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-300"
            >
              Exit View
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (surface === 'watch') {
    return (
      <div className="flex flex-col items-center py-4 sm:py-8 space-y-4">
        <div className="w-[min(82vw,300px)] aspect-square rounded-full border-4 border-zinc-300 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-5 sm:p-7 shadow-2xl flex flex-col items-center justify-between text-center">
          <div>
            <p className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">SAVED THIS MONTH</p>
            <p className="text-lg sm:text-xl font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {formatMoney(totalSavedZAR, currency)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="font-display text-xs font-semibold text-zinc-950 dark:text-white line-clamp-2">
              {featuredRfp?.title || 'Sandton 5G Solar RFP'}
            </p>
            <p className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 font-semibold">
              {formatMoney(Math.round((featuredRfp?.budgetZAR || 120000) * 0.86), currency)}
            </p>
            {watchActionNote && (
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">{watchActionNote}</p>
            )}
          </div>

          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => setWatchActionNote('Approved')}
              className="flex-1 min-h-[38px] rounded-full bg-zinc-950 text-white dark:bg-zinc-50 text-xs font-semibold dark:text-zinc-950"
            >
              Approve
            </button>
            <button
              onClick={() => setWatchActionNote('Counter -5%')}
              className="flex-1 min-h-[38px] rounded-full bg-zinc-100 border border-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:border-white/10 text-xs font-medium dark:text-white"
            >
              Counter
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="min-h-[36px] px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="min-h-[36px] px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Close Watch View
          </button>
        </div>
      </div>
    );
  }

  if (surface === 'ar') {
    return (
      <div className="glass-panel rounded-2xl p-4 sm:p-6 min-h-[380px] sm:min-h-[420px] flex flex-col justify-between gap-4">
        <div className="flex items-center justify-between gap-2 text-xs font-mono text-zinc-700 dark:text-zinc-300">
          <span className="flex items-center gap-1.5 truncate">
            <button
              type="button"
              onClick={handleBack}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shrink-0"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="truncate font-semibold">AR SPATIAL HUD · BLE MESH</span>
          </span>
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="min-h-[34px] px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shrink-0 inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 my-2">
          {nonEmergency.slice(0, 3).map((agent, idx) => (
            <div
              key={agent.id}
              className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-sky-700 dark:text-sky-400 tabular-nums">{18 + idx * 14}m away</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">BLE Lock</span>
              </div>
              <p className="font-display text-sm font-bold text-zinc-950 dark:text-white truncate">{agent.displayName}</p>
              <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">{agent.handle}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
                {agent.passerbyIncentive || 'A2A Ready'}
              </p>
              <button
                onClick={() => onEngageAgent(agent)}
                className="w-full min-h-[40px] mt-1 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white"
              >
                Gaze-Lock &amp; Engage
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400 border-t border-zinc-200 dark:border-white/10 pt-3">
          <span>3 Spatial Beacons · 1 DOOH Gantry</span>
          <button
            onClick={() => onDialNumber('911')}
            className="min-h-[34px] text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Voice SOS 911
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shrink-0"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Navigation className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">CARPLAY / ANDROID AUTO</p>
            <h3 className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-white truncate">
              William Nicol Corridor
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onSwitchToDesktop}
          className="min-h-[38px] rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap inline-flex items-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          <span>Close Drive Mode</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {rfps.slice(0, 2).map((rfp) => (
          <div key={rfp.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-4 space-y-3">
            <p className="text-xs font-mono text-amber-700 dark:text-amber-400 truncate">
              {rfp.location?.billboardName || 'Roadside DOOH Beacon'}
            </p>
            <h4 className="font-display text-sm font-bold text-zinc-950 dark:text-white">{rfp.title}</h4>
            <p className="text-sm font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
              {formatMoney(rfp.budgetZAR, currency)}
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => {
                  const target = agents.find((a) => a.handle === rfp.publisherHandle);
                  if (target) onEngageAgent(target);
                }}
                className="min-h-[44px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap dark:hover:bg-white"
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
                className="min-h-[44px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white font-medium text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
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
          className="min-h-[46px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-zinc-100 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Phone className="w-4 h-4" /> Voice Dial Nearby Bistro
        </button>
        <button
          onClick={() => onDialNumber('911')}
          className="min-h-[46px] rounded-xl bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-300 font-semibold text-xs flex items-center justify-center gap-2"
        >
          <ShieldAlert className="w-4 h-4" /> Hands-Free 911 SOS
        </button>
      </div>
    </div>
  );
};
