import React from 'react';
import {
  X,
  Compass,
  Zap,
  Tag,
  MapPin,
  Mail,
  Bot,
  Puzzle,
  Terminal,
  Monitor,
  Smartphone,
  Watch,
  Glasses,
  Car,
  KeyRound,
  LogOut,
  RotateCcw,
  Briefcase,
  ArrowLeft,
  LocateFixed,
  Users,
  Linkedin,
  Building2,
  Home,
  Scale,
  ShieldCheck,
  FileText,
  Target,
  Fingerprint,
  Trash2,
  PlusCircle,
} from 'lucide-react';
import { CurrencyMode, DevicePasskeyRecord, SurfaceMode, formatMoney } from '../types/firestore';
import { LegalDocTab, COMPANY_LEGAL_DETAILS } from '../data/legalDocuments';
import { CURRENCY_LIST, LocalCurrencyCode, formatLocalRateBanner } from '../lib/fx';
import { SwipeScrollArea } from './SwipeScrollArea';
import { PWAInstallButton } from './PWAInstallButton';
import { emitToast } from '../lib/toast';
import { ThemeToggle } from '../lib/theme';

export type DrawerRouteTarget =
  | { tab: 'home' }
  | { tab: 'pricing' }
  | { tab: 'legal'; doc: LegalDocTab }
  | { tab: 'directory' }
  | { tab: 'intent' }
  | { tab: 'arena' }
  | { tab: 'hiring' }
  | { tab: 'registry' }
  | { tab: 'spatial'; sub: 'maps' | 'contacts' | 'comms' | 'agentmail' }
  | { tab: 'toolkit'; sub: 'skills' | 'extension' | 'ledger' };

interface BurgerMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: string;
  spatialSubView: 'maps' | 'contacts' | 'comms' | 'agentmail';
  toolkitSubView: 'skills' | 'extension' | 'ledger';
  surface: SurfaceMode;
  currency: CurrencyMode;
  localCurrency: LocalCurrencyCode;
  locationLabel: string;
  fxRates: Record<LocalCurrencyCode, number>;
  agentsCount: number;
  contactsCount?: number;
  openRfpCount: number;
  totalSavedZAR: number;
  settlementsCount: number;
  userMode: 'guest' | 'google' | 'passkey_sim' | string;
  userDisplayName: string;
  onNavigate: (target: DrawerRouteTarget) => void;
  onSetSurface: (surface: SurfaceMode) => void;
  onSetCurrency: (currency: CurrencyMode) => void;
  onSetLocalCurrency: (currency: LocalCurrencyCode) => void;
  onDetectLocation: () => void;
  onLoginGoogle: () => Promise<unknown>;
  onLoginPasskey: () => void;
  onLogout: () => Promise<unknown>;
  onResetDemo: () => void;
  onOpenQuickJobAgent?: () => void;
  onOpenQuickEmployerAgent?: () => void;
  devicePasskeys?: DevicePasskeyRecord[];
  rememberedAgentHandles?: string[];
  onRegisterPasskey?: (params: { displayName: string; email: string }) => Promise<unknown>;
  onLoginWithPasskey?: (credentialId?: string) => Promise<unknown>;
  onRevokePasskey?: (credentialId: string) => Promise<unknown>;
}

export const BurgerMenuDrawer: React.FC<BurgerMenuDrawerProps> = ({
  open,
  onClose,
  activeTab,
  spatialSubView,
  toolkitSubView,
  surface,
  currency,
  localCurrency,
  locationLabel,
  fxRates,
  agentsCount,
  contactsCount = 0,
  openRfpCount,
  totalSavedZAR,
  settlementsCount,
  userMode,
  userDisplayName,
  onNavigate,
  onSetSurface,
  onSetCurrency,
  onSetLocalCurrency,
  onDetectLocation,
  onLoginGoogle,
  onLoginPasskey,
  onLogout,
  onResetDemo,
  onOpenQuickJobAgent,
  onOpenQuickEmployerAgent,
  devicePasskeys = [],
  rememberedAgentHandles = [],
  onRegisterPasskey,
  onLoginWithPasskey,
  onRevokePasskey,
}) => {
  const [passkeyFormOpen, setPasskeyFormOpen] = React.useState(false);
  const [passkeyName, setPasskeyName] = React.useState('Gugu Nyathi');
  const [passkeyEmail, setPasskeyEmail] = React.useState('');
  const [passkeyBusy, setPasskeyBusy] = React.useState(false);

  if (!open) return null;

  const handleRegisterPasskeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRegisterPasskey) {
      onLoginPasskey();
      return;
    }
    setPasskeyBusy(true);
    try {
      await onRegisterPasskey({
        displayName: passkeyName.trim() || 'SWITCHZ Member',
        email: passkeyEmail.trim(),
      });
      setPasskeyFormOpen(false);
    } catch (err) {
      emitToast(
        err instanceof Error ? err.message : 'Unable to register device passkey.',
        'warning'
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleQuickAuthorizePasskey = async (credentialId?: string) => {
    if (!onLoginWithPasskey) {
      onLoginPasskey();
      return;
    }
    setPasskeyBusy(true);
    try {
      await onLoginWithPasskey(credentialId);
    } catch (err) {
      emitToast(
        err instanceof Error ? err.message : 'Unable to authorize device passkey.',
        'warning'
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  const navItems: Array<{
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    target: DrawerRouteTarget;
    active: boolean;
  }> = [
    {
      id: 'home',
      label: 'Overview',
      icon: Home,
      target: { tab: 'home' },
      active: surface === 'desktop' && activeTab === 'home',
    },
    {
      id: 'dir',
      label: 'Directory',
      icon: Compass,
      target: { tab: 'directory' },
      active: surface === 'desktop' && activeTab === 'directory',
    },
    {
      id: 'intent',
      label: 'Intent & Match',
      icon: Target,
      target: { tab: 'intent' },
      active: surface === 'desktop' && activeTab === 'intent',
    },
    {
      id: 'arena',
      label: 'Negotiate',
      icon: Zap,
      target: { tab: 'arena' },
      active: surface === 'desktop' && activeTab === 'arena',
    },
    {
      id: 'hiring',
      label: 'Poppy Hiring',
      icon: Briefcase,
      target: { tab: 'hiring' },
      active: surface === 'desktop' && activeTab === 'hiring',
    },
    {
      id: 'reg',
      label: '.agent Registry',
      icon: Tag,
      target: { tab: 'registry' },
      active: surface === 'desktop' && activeTab === 'registry',
    },
    {
      id: 'maps',
      label: 'Maps & Events',
      icon: MapPin,
      target: { tab: 'spatial', sub: 'maps' },
      active: surface === 'desktop' && activeTab === 'spatial' && spatialSubView === 'maps',
    },
    {
      id: 'contacts',
      label: `Contacts (${contactsCount})`,
      icon: Users,
      target: { tab: 'spatial', sub: 'contacts' },
      active: surface === 'desktop' && activeTab === 'spatial' && spatialSubView === 'contacts',
    },
    {
      id: 'comms',
      label: 'Inbox & Cal',
      icon: Mail,
      target: { tab: 'spatial', sub: 'comms' },
      active: surface === 'desktop' && activeTab === 'spatial' && spatialSubView === 'comms',
    },
    {
      id: 'skills',
      label: 'Agent Skills',
      icon: Bot,
      target: { tab: 'toolkit', sub: 'skills' },
      active: surface === 'desktop' && activeTab === 'toolkit' && toolkitSubView === 'skills',
    },
    {
      id: 'ext',
      label: 'Chrome Kit',
      icon: Puzzle,
      target: { tab: 'toolkit', sub: 'extension' },
      active: surface === 'desktop' && activeTab === 'toolkit' && toolkitSubView === 'extension',
    },
    {
      id: 'ledger',
      label: 'Ledger & x402',
      icon: Terminal,
      target: { tab: 'toolkit', sub: 'ledger' },
      active: surface === 'desktop' && activeTab === 'toolkit' && toolkitSubView === 'ledger',
    },
  ];

  const surfaces: Array<{
    id: SurfaceMode;
    label: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'desktop', label: 'Web', icon: Monitor },
    { id: 'mobile', label: 'PWA', icon: Smartphone },
    { id: 'watch', label: 'Watch', icon: Watch },
    { id: 'ar', label: 'AR', icon: Glasses },
    { id: 'carplay', label: 'Auto', icon: Car },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-black/45 dark:bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 w-[308px] max-w-[88vw] h-full bg-white dark:bg-[#0c0c0f] border-r border-zinc-200 dark:border-white/[0.08] flex flex-col shadow-2xl">
        <div className="h-14 px-4 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <img
              src="/icon.svg"
              alt="SWITCHZ"
              className="w-6 h-6 rounded-md border border-zinc-300 dark:border-white/15"
            />
            <span className="font-display font-semibold text-sm text-zinc-950 dark:text-white tracking-tight">
              SWITCHZ
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
            aria-label="Close menu"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <SwipeScrollArea direction="vertical" showArrows={true} arrowSize="sm" className="flex-1 min-h-0" innerClassName="p-4 space-y-5">
          {/* Compact 4-Metric Strip */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/[0.08] p-2.5">
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Agents</span>
              <p className="font-mono font-semibold text-zinc-950 dark:text-white text-sm tabular-nums mt-0.5">
                {agentsCount}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/[0.08] p-2.5">
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Open RFPs</span>
              <p className="font-mono font-semibold text-zinc-950 dark:text-zinc-100 text-sm tabular-nums mt-0.5">
                {openRfpCount}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/[0.08] p-2.5">
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Saved</span>
              <p className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 text-sm tabular-nums mt-0.5">
                {formatMoney(totalSavedZAR, currency)}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/[0.08] p-2.5">
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Settled</span>
              <p className="font-mono font-semibold text-zinc-950 dark:text-zinc-100 text-sm tabular-nums mt-0.5">
                {settlementsCount}
              </p>
            </div>
          </div>

          {/* Pages */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1 uppercase tracking-wide">
              Workspaces
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.target);
                      onClose();
                    }}
                    className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors border ${
                      item.active
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white font-semibold'
                        : 'bg-zinc-50 dark:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            {onOpenQuickJobAgent && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQuickJobAgent();
                }}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-between gap-2 transition-colors shadow-2xs"
              >
                <span className="inline-flex items-center gap-2">
                  <Linkedin className="w-3.5 h-3.5 shrink-0" />
                  <span>LinkedIn Job Agent</span>
                </span>
                <span className="text-[10px] font-mono opacity-90">10 Free</span>
              </button>
            )}
            {onOpenQuickEmployerAgent && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQuickEmployerAgent();
                }}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-between gap-2 transition-colors shadow-2xs"
              >
                <span className="inline-flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Hire: Post Job URL</span>
                </span>
                <span className="text-[10px] font-mono opacity-90">Auto-Match</span>
              </button>
            )}
          </div>

          {/* 5-Surface Device Switcher */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1 uppercase tracking-wide">
              Surface Simulator
            </p>
            <div className="grid grid-cols-5 gap-1">
              {surfaces.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSetSurface(s.id);
                      onClose();
                    }}
                    className={`min-h-[42px] min-w-0 px-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors border ${
                      surface === s.id
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white font-semibold'
                        : 'bg-zinc-50 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border-zinc-200 dark:border-white/[0.08]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-full">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Selector (Light Default / Dark) */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1 uppercase tracking-wide">
              Appearance
            </p>
            <ThemeToggle variant="segmented" />
          </div>

          {/* Currency & Local FX + Install */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1 uppercase tracking-wide">
                Currency ({locationLabel})
              </p>
              <button
                type="button"
                onClick={onDetectLocation}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:underline"
              >
                <LocateFixed className="w-3 h-3" />
                Detect GPS
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 p-0.5 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => onSetCurrency('USD')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    currency === 'USD'
                      ? 'bg-white text-zinc-950 font-semibold shadow-2xs dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  US$
                </button>
                <button
                  type="button"
                  onClick={() => onSetCurrency(localCurrency === 'USD' ? 'ZAR' : localCurrency)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    currency !== 'USD'
                      ? 'bg-white text-zinc-950 font-semibold shadow-2xs dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {localCurrency === 'USD' ? 'ZAR' : localCurrency}
                </button>
              </div>
              <PWAInstallButton />
            </div>
            <div className="flex items-center justify-between gap-2">
              <select
                aria-label="Select local exchange currency"
                value={currency === 'USD' ? localCurrency : currency}
                onChange={(e) => {
                  const next = e.target.value as LocalCurrencyCode;
                  onSetLocalCurrency(next);
                  if (currency !== 'USD') onSetCurrency(next);
                }}
                className="flex-1 min-w-0 max-w-full min-h-[34px] rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-[11px] font-mono text-zinc-800 dark:text-zinc-200"
              >
                {CURRENCY_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400 px-1 tabular-nums">
              {formatLocalRateBanner(localCurrency === 'USD' ? 'ZAR' : localCurrency, fxRates)}
            </p>
          </div>

          {/* Passkey Device Authorization & Account Memory */}
          <div className="space-y-2.5 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide inline-flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Passkey &amp; Session
              </p>
              {rememberedAgentHandles.length > 0 && (
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                  {rememberedAgentHandles.length} Agent{rememberedAgentHandles.length === 1 ? '' : 's'} Saved
                </span>
              )}
            </div>

            {userMode === 'guest' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onLoginGoogle().catch(() => {})}
                    className="min-h-[38px] rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white"
                  >
                    Google Sign In
                  </button>
                  <button
                    type="button"
                    disabled={passkeyBusy}
                    onClick={() => {
                      if (devicePasskeys.length > 0) {
                        handleQuickAuthorizePasskey(devicePasskeys[0].credentialId);
                      } else {
                        setPasskeyFormOpen((v) => !v);
                      }
                    }}
                    className="min-h-[38px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    {devicePasskeys.length > 0 ? 'Unlock Passkey' : 'Setup Passkey'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 px-3 py-2">
                <div className="min-w-0">
                  <span className="block text-xs text-emerald-800 dark:text-emerald-300 font-semibold truncate">
                    {userDisplayName}
                  </span>
                  <span className="block text-[10px] font-mono text-emerald-700/80 dark:text-emerald-400/80">
                    {userMode === 'passkey_sim' ? 'Device Passkey Authorized' : 'Google Cloud Session'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onLogout()}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white hover:bg-white/70 dark:hover:bg-zinc-800"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Existing Passkeys bound to this device */}
            {devicePasskeys.length > 0 && (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/[0.08] p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Device Passkeys ({devicePasskeys.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setPasskeyFormOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-[10.5px] font-medium text-sky-700 dark:text-sky-400 hover:underline"
                  >
                    <PlusCircle className="w-3 h-3" />
                    New Passkey
                  </button>
                </div>
                <div className="space-y-1.5">
                  {devicePasskeys.map((pk) => (
                    <div
                      key={pk.credentialId}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-zinc-950/80 border border-zinc-200 dark:border-white/[0.06] px-2 py-1.5"
                    >
                      <button
                        type="button"
                        disabled={passkeyBusy}
                        onClick={() => handleQuickAuthorizePasskey(pk.credentialId)}
                        className="flex-1 min-w-0 text-left"
                        title="Authorize with this passkey and restore remembered agents"
                      >
                        <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {pk.userDisplayName}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                          {pk.deviceLabel} · {pk.rememberedAgentHandles.length} agent(s)
                        </p>
                      </button>
                      {onRevokePasskey && (
                        <button
                          type="button"
                          onClick={() => onRevokePasskey(pk.credentialId)}
                          className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
                          title="Revoke device passkey"
                          aria-label="Revoke passkey"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {rememberedAgentHandles.length > 0 && (
                  <div className="pt-1 border-t border-zinc-200/80 dark:border-white/[0.06]">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1">
                      Remembered on this device:
                    </p>
                    <p className="text-[10.5px] font-mono text-zinc-800 dark:text-zinc-200 break-all leading-relaxed">
                      {rememberedAgentHandles.slice(0, 6).join(' · ')}
                      {rememberedAgentHandles.length > 6
                        ? ` +${rememberedAgentHandles.length - 6} more`
                        : ''}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Add / Register Passkey inline form */}
            {(passkeyFormOpen || (devicePasskeys.length === 0 && userMode !== 'guest')) && (
              <form
                onSubmit={handleRegisterPasskeySubmit}
                className="rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-sky-200 dark:border-sky-500/30 p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Bind Passkey to Device Agents
                  </span>
                  {passkeyFormOpen && (
                    <button
                      type="button"
                      onClick={() => setPasskeyFormOpen(false)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full min-h-[34px] rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-900 dark:text-white"
                />
                <input
                  type="email"
                  value={passkeyEmail}
                  onChange={(e) => setPasskeyEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full min-h-[34px] rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={passkeyBusy}
                  className="w-full min-h-[34px] rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  {passkeyBusy ? 'Binding Device Key…' : 'Register & Remember Agents'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                onResetDemo();
                emitToast('Workspace seed reset to defaults.', 'info');
                onClose();
              }}
              className="w-full min-h-[36px] rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-300 dark:border-white/10 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Seed Data
            </button>
          </div>

          {/* Legal & Compliance Links */}
          <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-1 uppercase tracking-wide">
              Legal &amp; Compliance
            </p>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  onNavigate({ tab: 'pricing' });
                  onClose();
                }}
                className="min-h-[34px] px-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" />
                  Pricing &amp; Fee Schedule
                </span>
                <span className="font-mono text-[10px] text-zinc-500">/pricing</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate({ tab: 'legal', doc: 'terms' });
                  onClose();
                }}
                className="min-h-[34px] px-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <Scale className="w-3.5 h-3.5" />
                  Terms of Use
                </span>
                <span className="font-mono text-[10px] text-zinc-500">/term</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate({ tab: 'legal', doc: 'privacy' });
                  onClose();
                }}
                className="min-h-[34px] px-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Privacy &amp; Candidate AI
                </span>
                <span className="font-mono text-[10px] text-zinc-500">/terms</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate({ tab: 'legal', doc: 'employer' });
                  onClose();
                }}
                className="min-h-[34px] px-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-between"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Employer Fee Agreement
                </span>
                <span className="font-mono text-[10px] text-zinc-500">/employeragreement</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1 leading-relaxed">
              {COMPANY_LEGAL_DETAILS.operator} · {COMPANY_LEGAL_DETAILS.jurisdiction} · Essential local storage only.
            </p>
          </div>
        </SwipeScrollArea>
      </aside>
    </div>
  );
};
