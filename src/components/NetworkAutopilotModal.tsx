import React from 'react';
import {
  X,
  Radio,
  MapPin,
  Wifi,
  Bluetooth,
  Users,
  Target,
  Handshake,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  Sliders,
} from 'lucide-react';
import { AgentDoc, CurrencyMode, formatMoney } from '../types/firestore';
import {
  NetworkAutopilotConfig,
  NetworkAutopilotEvent,
  NetworkAutopilotStats,
} from '../hooks/useNetworkAutopilot';
import { SwipeScrollArea } from './SwipeScrollArea';

interface NetworkAutopilotModalProps {
  open: boolean;
  onClose: () => void;
  agent: AgentDoc | null;
  currency: CurrencyMode;
  config: NetworkAutopilotConfig;
  stats: NetworkAutopilotStats;
  activityLog: NetworkAutopilotEvent[];
  isScanning: boolean;
  gpsStatus: 'off' | 'watching' | 'fallback';
  wifiMeshConnected: boolean;
  blePairedBeacon: string | null;
  lastScanAt: string | null;
  onToggleEnabled: () => void;
  onUpdateConfig: (patch: Partial<NetworkAutopilotConfig>) => void;
  onRunCycleNow: () => void;
  onPairBleBeacon: () => void;
  onOpenContacts: () => void;
  onOpenIntentHub: () => void;
  onOpenArena: () => void;
}

const CONTEXT_PRESETS = [
  { label: 'Event / Summit', room: 'sandton-summit-2026', radius: 150 },
  { label: 'Public Venue', room: 'public-commons-mesh', radius: 250 },
  { label: 'On the Road', room: 'highway-transit-corridor', radius: 500 },
];

const RADIUS_OPTIONS = [50, 150, 250, 500, 1000];

export const NetworkAutopilotModal: React.FC<NetworkAutopilotModalProps> = ({
  open,
  onClose,
  agent,
  currency,
  config,
  stats,
  activityLog,
  isScanning,
  gpsStatus,
  wifiMeshConnected,
  blePairedBeacon,
  lastScanAt,
  onToggleEnabled,
  onUpdateConfig,
  onRunCycleNow,
  onPairBleBeacon,
  onOpenContacts,
  onOpenIntentHub,
  onOpenArena,
}) => {
  if (!open) return null;

  const maxSpendZAR = agent?.guardrails?.maxAutoSpendZAR ?? 85000;
  const minDiscountPct = agent?.guardrails?.minDiscountPct ?? 10;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[90dvh] rounded-t-3xl sm:rounded-2xl glass-panel border border-zinc-300 dark:border-white/15 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="+Network Autonomous Scanning & Deal Closing"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  config.enabled
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <Radio className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-bold text-sm sm:text-base text-zinc-950 dark:text-white truncate">
                  +Network Autopilot
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {agent ? `${agent.displayName} (@${agent.handle})` : 'Personal Agent'}
                  {lastScanAt ? ` · Last sweep ${new Date(lastScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleEnabled}
              className={`min-h-[40px] sm:min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                config.enabled
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span>{config.enabled ? 'Autopilot On' : 'Turn On'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
              aria-label="Close +Network drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="p-4 sm:p-5 space-y-4">
          {/* Active Sensor Status */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/70 dark:bg-zinc-900/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="truncate">GPS Watch</span>
              </div>
              <p className="mt-1 font-mono text-xs font-semibold text-zinc-950 dark:text-white truncate">
                {gpsStatus === 'watching' ? 'Locked' : gpsStatus === 'fallback' ? 'Room Coords' : 'Standby'}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/70 dark:bg-zinc-900/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Wi-Fi Mesh</span>
              </div>
              <p className="mt-1 font-mono text-xs font-semibold text-zinc-950 dark:text-white truncate">
                {wifiMeshConnected ? 'Connected' : config.enabled ? 'Polling' : 'Off'}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50/70 dark:bg-zinc-900/50 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                <Bluetooth className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">BLE Beacons</span>
              </div>
              <p className="mt-1 font-mono text-xs font-semibold text-zinc-950 dark:text-white truncate">
                {blePairedBeacon || (config.enabled ? 'Scanning' : 'Standby')}
              </p>
            </div>
          </div>

          {/* 4 Live Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-3">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Peers in Range</p>
              <p className="mt-0.5 text-xl font-display font-bold tabular-nums text-zinc-950 dark:text-white">
                {stats.peersInRange}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-3">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Contacts Added</p>
              <p className="mt-0.5 text-xl font-display font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {stats.contactsAdded}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-3">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Intent Matches</p>
              <p className="mt-0.5 text-xl font-display font-bold tabular-nums text-sky-600 dark:text-sky-400">
                {stats.opportunitiesMatched}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-3">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Deals Closed</p>
              <p className="mt-0.5 text-xl font-display font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {stats.dealsClosed}
              </p>
            </div>
          </div>

          {/* Environment & Guardrails */}
          <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                Range &amp; Autonomous Rules
              </span>
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Max Spend {formatMoney(maxSpendZAR, currency)} · Min {minDiscountPct}% off
              </span>
            </div>

            {/* Scenario Presets */}
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_PRESETS.map((preset) => {
                const selected = config.roomCode === preset.room;
                return (
                  <button
                    key={preset.room}
                    type="button"
                    onClick={() =>
                      onUpdateConfig({ roomCode: preset.room, scanRadiusMeters: preset.radius })
                    }
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
                      selected
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:border-zinc-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Radius Selector + Custom Room */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Broadcast &amp; Scan Radius
                </label>
                <div className="flex flex-wrap gap-1">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onUpdateConfig({ scanRadiusMeters: r })}
                      className={`min-h-[34px] px-2.5 rounded-lg text-xs font-mono border transition-colors ${
                        config.scanRadiusMeters === r
                          ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                      }`}
                    >
                      {r >= 1000 ? '1km' : `${r}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="autopilot-room-input"
                  className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
                >
                  Mesh Zone / Event Code
                </label>
                <input
                  id="autopilot-room-input"
                  type="text"
                  value={config.roomCode}
                  onChange={(e) => onUpdateConfig({ roomCode: e.target.value })}
                  placeholder="sandton-summit-2026"
                  className="w-full min-h-[36px] px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Behavior Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <label className="flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-zinc-200 dark:border-white/10 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={config.autoAddContacts}
                  onChange={(e) => onUpdateConfig({ autoAddContacts: e.target.checked })}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">Auto-add contacts</span>
              </label>

              <label className="flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-zinc-200 dark:border-white/10 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={config.autoMatchIntents}
                  onChange={(e) => onUpdateConfig({ autoMatchIntents: e.target.checked })}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">Match per intents</span>
              </label>

              <label className="flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-zinc-200 dark:border-white/10 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={config.autoNegotiateAndClose}
                  onChange={(e) => onUpdateConfig({ autoNegotiateAndClose: e.target.checked })}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">Negotiate &amp; close</span>
              </label>
            </div>

            {/* Instant Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onRunCycleNow}
                disabled={isScanning}
                className="min-h-[40px] px-3.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-60 text-white dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning Mesh...' : 'Run Sweep Now'}</span>
              </button>

              <button
                type="button"
                onClick={onPairBleBeacon}
                className="min-h-[40px] px-3.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Bluetooth className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Pair BLE Beacon</span>
              </button>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Autopilot Activity Log ({activityLog.length})
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenContacts();
                  }}
                  className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5 font-medium"
                >
                  Contacts <ArrowUpRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenIntentHub();
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-medium"
                >
                  Intents <ArrowUpRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenArena();
                  }}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-medium"
                >
                  Deals <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {activityLog.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 dark:border-white/15 p-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Turn on <strong className="text-zinc-900 dark:text-zinc-100">+Network</strong> or run a sweep to automatically add nearby peers, match opportunities per your implied intents, and negotiate deals inside your guardrails.
              </div>
            ) : (
              <div className="space-y-1.5">
                {activityLog.map((evt) => {
                  const Icon =
                    evt.kind === 'contact_added'
                      ? Users
                      : evt.kind === 'intent_matched'
                      ? Target
                      : evt.kind === 'deal_closed' || evt.kind === 'negotiated'
                      ? Handshake
                      : Radio;
                  const accentClass =
                    evt.kind === 'deal_closed'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : evt.kind === 'contact_added'
                      ? 'text-sky-600 dark:text-sky-400'
                      : evt.kind === 'intent_matched'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-zinc-600 dark:text-zinc-400';

                  return (
                    <div
                      key={evt.id}
                      className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white/70 dark:bg-zinc-900/50 px-3 py-2.5 flex items-start justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${accentClass}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                            {evt.title}
                          </p>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                            {evt.detail}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0 tabular-nums">
                        {new Date(evt.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SwipeScrollArea>
      </div>
    </div>
  );
};
