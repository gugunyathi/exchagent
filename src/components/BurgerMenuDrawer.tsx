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
} from 'lucide-react';
import { CurrencyMode, SurfaceMode, formatMoney } from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';
import { PWAInstallButton } from './PWAInstallButton';

export type DrawerRouteTarget =
  | { tab: 'directory' }
  | { tab: 'arena'; sub?: 'a2a' | 'poppy' }
  | { tab: 'registry' }
  | { tab: 'spatial'; sub: 'maps' | 'comms' }
  | { tab: 'toolkit'; sub: 'skills' | 'extension' | 'ledger' };

interface BurgerMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: string;
  arenaSubView?: 'a2a' | 'poppy';
  spatialSubView: 'maps' | 'comms';
  toolkitSubView: 'skills' | 'extension' | 'ledger';
  surface: SurfaceMode;
  currency: CurrencyMode;
  agentsCount: number;
  openRfpCount: number;
  totalSavedZAR: number;
  settlementsCount: number;
  userMode: 'guest' | 'google' | 'passkey_sim' | string;
  userDisplayName: string;
  onNavigate: (target: DrawerRouteTarget) => void;
  onSetSurface: (surface: SurfaceMode) => void;
  onSetCurrency: (currency: CurrencyMode) => void;
  onLoginGoogle: () => Promise<unknown>;
  onLoginPasskey: () => void;
  onLogout: () => Promise<unknown>;
  onResetDemo: () => void;
}

export const BurgerMenuDrawer: React.FC<BurgerMenuDrawerProps> = ({
  open,
  onClose,
  activeTab,
  arenaSubView = 'a2a',
  spatialSubView,
  toolkitSubView,
  surface,
  currency,
  agentsCount,
  openRfpCount,
  totalSavedZAR,
  settlementsCount,
  userMode,
  userDisplayName,
  onNavigate,
  onSetSurface,
  onSetCurrency,
  onLoginGoogle,
  onLoginPasskey,
  onLogout,
  onResetDemo,
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
      id: 'dir',
      label: 'Agent Cards',
      icon: Compass,
      target: { tab: 'directory' },
      active: surface === 'desktop' && activeTab === 'directory',
    },
    {
      id: 'arena',
      label: 'A2A Arena',
      icon: Zap,
      target: { tab: 'arena', sub: 'a2a' },
      active: surface === 'desktop' && activeTab === 'arena' && arenaSubView === 'a2a',
    },
    {
      id: 'poppy',
      label: 'Poppy & Hiring',
      icon: Briefcase,
      target: { tab: 'arena', sub: 'poppy' },
      active: surface === 'desktop' && activeTab === 'arena' && arenaSubView === 'poppy',
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
      label: 'Maps Radar',
      icon: MapPin,
      target: { tab: 'spatial', sub: 'maps' },
      active: surface === 'desktop' && activeTab === 'spatial' && spatialSubView === 'maps',
    },
    {
      id: 'comms',
      label: 'Mail & Cal',
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
        className="fixed inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 w-[300px] max-w-[85vw] h-full bg-[#070C18] border-r border-slate-800 flex flex-col shadow-2xl">
        <div className="h-14 px-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="Switchboard" className="w-7 h-7 rounded-lg" />
            <span className="font-display font-bold text-sm text-white">Switchboard</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="p-4 space-y-5">
          {/* Compact 4-Metric Strip */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5">
              <span className="text-[10px] text-slate-400">Agents</span>
              <p className="font-mono font-bold text-white text-sm tabular-nums">{agentsCount}</p>
            </div>
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5">
              <span className="text-[10px] text-slate-400">Live RFPs</span>
              <p className="font-mono font-bold text-cyan-300 text-sm tabular-nums">{openRfpCount}</p>
            </div>
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5">
              <span className="text-[10px] text-slate-400">Saved</span>
              <p className="font-mono font-bold text-emerald-300 text-sm tabular-nums">
                {formatMoney(totalSavedZAR, currency)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5">
              <span className="text-[10px] text-slate-400">Settled</span>
              <p className="font-mono font-bold text-amber-300 text-sm tabular-nums">{settlementsCount}</p>
            </div>
          </div>

          {/* Pages */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-slate-500 uppercase px-1">Pages</p>
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
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors ${
                      item.active
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                        : 'bg-slate-900/60 text-slate-300 border border-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5-Surface Device Switcher */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono text-slate-500 uppercase px-1">Surface</p>
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
                    className={`min-h-[44px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                      surface === s.id
                        ? 'bg-cyan-400 text-slate-950 font-semibold'
                        : 'bg-slate-900/70 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Currency & Install */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1 text-xs font-mono">
              <button
                type="button"
                onClick={() => onSetCurrency('ZAR')}
                className={`px-3 py-1.5 rounded-lg ${
                  currency === 'ZAR' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
                }`}
              >
                ZAR
              </button>
              <button
                type="button"
                onClick={() => onSetCurrency('USD')}
                className={`px-3 py-1.5 rounded-lg ${
                  currency === 'USD' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
                }`}
              >
                USD
              </button>
            </div>
            <PWAInstallButton />
          </div>

          {/* Auth & Reset */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {userMode === 'guest' ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onLoginGoogle().catch(() => {})}
                  className="min-h-[40px] rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-white hover:border-cyan-400"
                >
                  Google Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onLoginPasskey()}
                  className="min-h-[40px] rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-cyan-300 inline-flex items-center justify-center gap-1.5 hover:border-cyan-400"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Passkey
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2">
                <span className="text-xs text-emerald-300 truncate">{userDisplayName}</span>
                <button
                  type="button"
                  onClick={() => onLogout()}
                  className="p-1.5 text-slate-400 hover:text-white"
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
                onClose();
              }}
              className="w-full min-h-[38px] rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 hover:text-cyan-300 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Seed
            </button>
          </div>
        </SwipeScrollArea>
      </aside>
    </div>
  );
};
