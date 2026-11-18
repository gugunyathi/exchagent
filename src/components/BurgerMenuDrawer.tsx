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
} from 'lucide-react';
import { CurrencyMode, SurfaceMode, formatMoney } from '../types/firestore';
import { LegalDocTab, COMPANY_LEGAL_DETAILS } from '../data/legalDocuments';
import { CURRENCY_LIST, LocalCurrencyCode, formatLocalRateBanner } from '../lib/fx';
import { SwipeScrollArea } from './SwipeScrollArea';
import { PWAInstallButton } from './PWAInstallButton';
import { emitToast } from '../lib/toast';
import { ThemeToggle } from '../lib/theme';

export type DrawerRouteTarget =
  | { tab: 'home' }
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
}) => {
  if (!open) return null;

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
      label: 'Audit Ledger',
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

          {/* Auth & Reset */}
          <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
            {userMode === 'guest' ? (
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
                  onClick={() => onLoginPasskey()}
                  className="min-h-[38px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Passkey
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] px-3 py-2">
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                  {userDisplayName}
                </span>
                <button
                  type="button"
                  onClick={() => onLogout()}
                  className="p-1 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
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
