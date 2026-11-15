import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  WifiOff,
  Share,
  X,
  Smartphone,
  Monitor,
  ExternalLink,
  Copy,
  Check,
  MoreVertical,
  PlusSquare,
  Menu,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { InstallGuideKey, usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface GuideDefinition {
  key: InstallGuideKey;
  category: 'ios' | 'android' | 'desktop';
  label: string;
  headline: string;
  steps: Array<{ title: string; detail: string }>;
  note?: string;
}

const GUIDES: Record<InstallGuideKey, GuideDefinition> = {
  'ios-safari': {
    key: 'ios-safari',
    category: 'ios',
    label: 'Safari (iOS)',
    headline: 'Install on iPhone / iPad via Safari',
    steps: [
      { title: 'Tap Share', detail: 'Tap the Share icon at the bottom (or top on iPad) of Safari.' },
      { title: 'Add to Home Screen', detail: 'Scroll down and tap "Add to Home Screen".' },
      { title: 'Confirm Add', detail: 'Tap "Add" to launch Switchboard full-screen from your Home Screen.' },
    ],
  },
  'ios-chromium': {
    key: 'ios-chromium',
    category: 'ios',
    label: 'Chrome / Edge (iOS)',
    headline: 'Install on iPhone / iPad',
    steps: [
      { title: 'Tap Share', detail: 'Tap the Share icon in the top-right address bar.' },
      { title: 'Add to Home Screen', detail: 'Select "Add to Home Screen" from the share sheet.' },
      { title: 'Best offline support', detail: 'For full standalone PWA caching on iOS, opening in Safari is recommended.' },
    ],
  },
  'android-chrome': {
    key: 'android-chrome',
    category: 'android',
    label: 'Chrome / Brave / Edge',
    headline: 'Install on Android',
    steps: [
      { title: 'Open Browser Menu', detail: 'Tap the 3-dot menu (⋮) in the top-right corner of Chrome or Edge.' },
      { title: 'Install App', detail: 'Tap "Install app" (or "Add to Home screen" -> "Install").' },
      { title: 'Launch from App Drawer', detail: 'Switchboard installs with its own icon and offline agent cache.' },
    ],
  },
  'android-samsung': {
    key: 'android-samsung',
    category: 'android',
    label: 'Samsung Internet',
    headline: 'Install via Samsung Internet',
    steps: [
      { title: 'Tap Menu or Install Icon', detail: 'Tap the download arrow in the address bar or the ☰ menu at bottom-right.' },
      { title: 'Add page to -> Apps screen', detail: 'Choose "Add page to" and select "Home screen" or "Install app".' },
    ],
  },
  'android-firefox': {
    key: 'android-firefox',
    category: 'android',
    label: 'Firefox Android',
    headline: 'Install via Firefox for Android',
    steps: [
      { title: 'Open Menu', detail: 'Tap the 3-dot menu (⋮) next to the address bar.' },
      { title: 'Install', detail: 'Tap "Install" (or "Add to Home screen") to place Switchboard on your launcher.' },
    ],
  },
  'macos-safari': {
    key: 'macos-safari',
    category: 'desktop',
    label: 'Safari (macOS)',
    headline: 'Add to Mac Dock via Safari',
    steps: [
      { title: 'Open File or Share Menu', detail: 'Click File in the top macOS menu bar (or the Share button in Safari).' },
      { title: 'Add to Dock', detail: 'Select "Add to Dock..." and click Add.' },
      { title: 'Run as Mac App', detail: 'Switchboard opens in its own standalone window directly from your Dock.' },
    ],
  },
  'desktop-chromium': {
    key: 'desktop-chromium',
    category: 'desktop',
    label: 'Chrome / Brave / Arc',
    headline: 'Install Desktop App',
    steps: [
      { title: 'Click Address Bar Install Icon', detail: 'Look for the Install monitor icon (⊕) on the right side of the URL bar.' },
      { title: 'Or Open Browser Menu', detail: 'Click ⋮ -> "Cast, save, and share" -> "Install Switchboard (AgentPages)".' },
    ],
  },
  'desktop-edge': {
    key: 'desktop-edge',
    category: 'desktop',
    label: 'Microsoft Edge',
    headline: 'Install via Microsoft Edge',
    steps: [
      { title: 'Click App Available Icon', detail: 'Click the App Available icon in the right side of the address bar.' },
      { title: 'Or Menu -> Apps', detail: 'Open ⋯ -> Apps -> "Install this site as an app" to pin to Taskbar/Start.' },
    ],
  },
  'desktop-firefox': {
    key: 'desktop-firefox',
    category: 'desktop',
    label: 'Firefox Desktop',
    headline: 'Install from Firefox Desktop',
    steps: [
      { title: 'Open in Chrome / Edge / Safari', detail: 'Desktop Firefox does not natively install Web Apps without a PWA add-on.' },
      { title: 'Copy URL or Open Directly', detail: 'Open Switchboard in Chrome, Edge, or Safari (macOS) for 1-click native installation, or pin this tab in Firefox.' },
    ],
  },
  'in-app': {
    key: 'in-app',
    category: 'android',
    label: 'In-App Browser',
    headline: 'Open in System Browser to Install',
    steps: [
      { title: 'Open Outside Embedded Browser', detail: 'Tap ⋯ or Share and choose "Open in Safari" or "Open in Chrome".' },
      { title: 'Install Standalone App', detail: 'Once opened in Safari or Chrome, tap Share / Menu -> Install App.' },
    ],
  },
};

const CATEGORY_DEFAULT_GUIDE: Record<'ios' | 'android' | 'desktop', InstallGuideKey[]> = {
  ios: ['ios-safari', 'ios-chromium'],
  android: ['android-chrome', 'android-samsung', 'android-firefox'],
  desktop: ['desktop-chromium', 'desktop-edge', 'macos-safari', 'desktop-firefox'],
};

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'drawer' }) => {
  const { isInstallable, isInstalled, env, needRefresh, install, applyUpdate } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<InstallGuideKey>(env.guideKey);
  const [copied, setCopied] = useState(false);

  // If a newer Service Worker is waiting, offer quick 1-tap refresh
  if (needRefresh) {
    return (
      <button
        type="button"
        onClick={applyUpdate}
        className={
          variant === 'header'
            ? 'h-9 px-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs font-semibold text-emerald-200 inline-flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 transition-colors whitespace-nowrap shrink-0'
        }
        title="New app version ready — tap to update"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Update</span>
      </button>
    );
  }

  // Suppress install affordance automatically when already running as an installed PWA
  if (isInstalled) return null;

  const handlePrimaryClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setSelectedGuide(env.guideKey);
    setModalOpen(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const activeGuide = GUIDES[selectedGuide] || GUIDES['desktop-chromium'];
  const activeCategory = activeGuide.category;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  const modalContent =
    modalOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl glass-panel border border-slate-700/80 p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src="/pwa-192x192.png"
                    alt="Switchboard"
                    className="w-11 h-11 rounded-xl border border-cyan-400/30 shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-base font-display font-bold text-white truncate">
                      Install Switchboard App
                    </h3>
                    <p className="text-xs text-cyan-300 font-mono truncate">
                      {env.osLabel} · {env.browserLabel}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center shrink-0"
                  aria-label="Close install guide"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Native prompt button if browser provided beforeinstallprompt */}
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setModalOpen(false);
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-cyan-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-cyan-300 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Install Now ({env.browserLabel})</span>
                </button>
              )}

              {/* Embedded iframe notice: browsers suppress install prompt inside iframes */}
              {env.isInIframe && !isInstallable && (
                <div className="rounded-xl bg-cyan-500/10 border border-cyan-400/30 p-3 space-y-2.5">
                  <p className="text-xs text-slate-200 leading-relaxed">
                    You are viewing Switchboard inside an embedded frame. Open it directly in your{' '}
                    <strong className="text-white">{env.browserLabel}</strong> tab to enable native device installation.
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-[38px] rounded-lg bg-cyan-400 text-slate-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-cyan-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in {env.browserLabel}</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="min-h-[38px] px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 hover:border-cyan-400/50"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy URL'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Device Selector Tabs */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                {(
                  [
                    { id: 'ios', label: 'iPhone / iPad', icon: Smartphone },
                    { id: 'android', label: 'Android', icon: Compass },
                    { id: 'desktop', label: 'Desktop / Mac', icon: Monitor },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedGuide(CATEGORY_DEFAULT_GUIDE[tab.id][0])}
                      className={`min-h-[36px] rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        active
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Browser sub-selector within active OS */}
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_DEFAULT_GUIDE[activeCategory].map((gKey) => {
                  const g = GUIDES[gKey];
                  const active = selectedGuide === gKey;
                  return (
                    <button
                      key={gKey}
                      type="button"
                      onClick={() => setSelectedGuide(gKey)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
                        active
                          ? 'bg-slate-800 text-white border-cyan-400/40'
                          : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>

              {/* Tailored Browser Instructions */}
              <div className="rounded-xl bg-slate-900/75 border border-slate-800 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">{activeGuide.headline}</p>
                  {activeCategory === 'ios' ? (
                    <Share className="w-4 h-4 text-cyan-300 shrink-0" />
                  ) : activeCategory === 'android' ? (
                    selectedGuide === 'android-samsung' ? (
                      <Menu className="w-4 h-4 text-cyan-300 shrink-0" />
                    ) : (
                      <MoreVertical className="w-4 h-4 text-cyan-300 shrink-0" />
                    )
                  ) : (
                    <PlusSquare className="w-4 h-4 text-cyan-300 shrink-0" />
                  )}
                </div>

                <ol className="space-y-2.5">
                  {activeGuide.steps.map((step, idx) => (
                    <li key={step.title} className="flex items-start gap-2.5 text-xs">
                      <span className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100">{step.title}</p>
                        <p className="text-slate-400 leading-relaxed">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                {!env.isInIframe && (
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="min-h-[38px] px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 inline-flex items-center gap-1.5 hover:border-cyan-400/40"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Link Copied' : 'Copy App Link'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="ml-auto min-h-[38px] px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handlePrimaryClick}
          className="h-9 px-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-400/50 text-cyan-300 inline-flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          aria-label="Install Switchboard App"
          title={`Install App (${env.browserLabel})`}
        >
          {env.isIOS ? <Share className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          <span className="hidden lg:inline">Install</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePrimaryClick}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/15 border border-cyan-400/35 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition-colors whitespace-nowrap shrink-0"
        >
          {env.isIOS ? <Share className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          <span>{isInstallable ? 'Install App' : `Install (${env.browserLabel})`}</span>
        </button>
      )}
      {modalContent}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-3 z-50 flex items-center gap-2 rounded-xl bg-amber-500/95 px-3 py-2 text-xs font-semibold text-slate-950 shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline — Cached agents ready</span>
    </div>
  );
};
