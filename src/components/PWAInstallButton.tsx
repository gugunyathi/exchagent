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
  ArrowLeft,
} from 'lucide-react';
import { InstallGuideKey, usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { emitToast } from '../lib/toast';
import { SwipeScrollArea } from './SwipeScrollArea';

interface GuideDefinition {
  key: InstallGuideKey;
  category: 'ios' | 'android' | 'desktop';
  label: string;
  headline: string;
  steps: Array<{ title: string; detail: string }>;
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
      { title: 'Confirm Add', detail: 'Tap "Add" to launch Switchboard full-screen.' },
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
      { title: 'Offline caching', detail: 'Open in Safari for full standalone PWA caching on iOS.' },
    ],
  },
  'android-chrome': {
    key: 'android-chrome',
    category: 'android',
    label: 'Chrome / Brave / Edge',
    headline: 'Install on Android',
    steps: [
      { title: 'Open Browser Menu', detail: 'Tap the 3-dot menu (⋮) in the top-right corner.' },
      { title: 'Install App', detail: 'Tap "Install app" or "Add to Home screen".' },
    ],
  },
  'android-samsung': {
    key: 'android-samsung',
    category: 'android',
    label: 'Samsung Internet',
    headline: 'Install via Samsung Internet',
    steps: [
      { title: 'Tap Menu or Install Icon', detail: 'Tap the download arrow or ☰ menu at bottom-right.' },
      { title: 'Add page to Home screen', detail: 'Choose "Add page to" and select "Home screen".' },
    ],
  },
  'android-firefox': {
    key: 'android-firefox',
    category: 'android',
    label: 'Firefox Android',
    headline: 'Install via Firefox for Android',
    steps: [
      { title: 'Open Menu', detail: 'Tap the 3-dot menu (⋮) next to the address bar.' },
      { title: 'Install', detail: 'Tap "Install" to place Switchboard on your launcher.' },
    ],
  },
  'macos-safari': {
    key: 'macos-safari',
    category: 'desktop',
    label: 'Safari (macOS)',
    headline: 'Add to Mac Dock via Safari',
    steps: [
      { title: 'Open File or Share Menu', detail: 'Click File in the macOS menu bar or Share in Safari.' },
      { title: 'Add to Dock', detail: 'Select "Add to Dock..." and confirm.' },
    ],
  },
  'desktop-chromium': {
    key: 'desktop-chromium',
    category: 'desktop',
    label: 'Chrome / Brave / Arc',
    headline: 'Install Desktop App',
    steps: [
      { title: 'Click Address Bar Install Icon', detail: 'Select the Install monitor icon (⊕) in the URL bar.' },
      { title: 'Or Browser Menu', detail: 'Click ⋮ -> "Cast, save, and share" -> "Install Switchboard".' },
    ],
  },
  'desktop-edge': {
    key: 'desktop-edge',
    category: 'desktop',
    label: 'Microsoft Edge',
    headline: 'Install via Microsoft Edge',
    steps: [
      { title: 'Click App Available Icon', detail: 'Select the App Available icon in the URL bar.' },
      { title: 'Or Menu -> Apps', detail: 'Open ⋯ -> Apps -> "Install this site as an app".' },
    ],
  },
  'desktop-firefox': {
    key: 'desktop-firefox',
    category: 'desktop',
    label: 'Firefox Desktop',
    headline: 'Install from Firefox Desktop',
    steps: [
      { title: 'Open in Chrome, Edge, or Safari', detail: 'Desktop Firefox requires a PWA add-on or Chromium/Safari for standalone installation.' },
    ],
  },
  'in-app': {
    key: 'in-app',
    category: 'android',
    label: 'In-App Browser',
    headline: 'Open in System Browser',
    steps: [
      { title: 'Open Outside Frame', detail: 'Tap Share or ⋯ and choose "Open in Safari" or "Open in Chrome".' },
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

  if (needRefresh) {
    return (
      <button
        type="button"
        onClick={applyUpdate}
        className={
          variant === 'header'
            ? 'h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-400/30 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 transition-colors whitespace-nowrap shrink-0'
        }
        title="New app version ready — tap to update"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span className={variant === 'header' ? 'hidden sm:inline' : ''}>Update</span>
      </button>
    );
  }

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
      emitToast('App link copied to clipboard.');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  React.useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const activeGuide = GUIDES[selectedGuide] || GUIDES['desktop-chromium'];
  const activeCategory = activeGuide.category;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  const modalContent =
    modalOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/45 dark:bg-black/75 backdrop-blur-sm p-2 sm:p-4"
            onClick={() => setModalOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl glass-panel border border-zinc-300 dark:border-white/15 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-zinc-200 dark:border-white/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
                    aria-label="Back"
                    title="Back"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <img
                    src="/pwa-192x192.png"
                    alt="Switchboard"
                    className="w-10 h-10 rounded-xl border border-zinc-300 dark:border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-display font-semibold text-zinc-950 dark:text-white truncate">
                      Install Switchboard App
                    </h3>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono truncate">
                      {env.osLabel} · {env.browserLabel}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
                  aria-label="Close install guide"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <SwipeScrollArea
                direction="vertical"
                arrowSize="sm"
                showArrows={true}
                className="flex-1 min-h-0"
                innerClassName="px-4 sm:px-5 py-4 space-y-4"
              >

              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) setModalOpen(false);
                  }}
                  className="w-full min-h-[42px] rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Install Now ({env.browserLabel})</span>
                </button>
              )}

              {env.isInIframe && !isInstallable && (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] p-3 space-y-2.5">
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Embedded view detected. Open directly in <strong className="text-zinc-950 dark:text-white">{env.browserLabel}</strong> for native device installation.
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-[36px] rounded-lg bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-zinc-800 dark:hover:bg-white"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Tab</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="min-h-[36px] px-3 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-300 dark:border-white/10">
                {(
                  [
                    { id: 'ios', label: 'iOS', icon: Smartphone },
                    { id: 'android', label: 'Android', icon: Compass },
                    { id: 'desktop', label: 'Desktop', icon: Monitor },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedGuide(CATEGORY_DEFAULT_GUIDE[tab.id][0])}
                      className={`min-h-[34px] rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        active
                          ? 'bg-white text-zinc-950 font-semibold shadow-2xs border border-zinc-200 dark:bg-zinc-800 dark:text-white dark:border-white/15'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

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
                          ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-800 dark:text-white dark:border-white/20'
                          : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-white/10 hover:text-zinc-950 dark:hover:text-zinc-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.08] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-950 dark:text-white">{activeGuide.headline}</p>
                  {activeCategory === 'ios' ? (
                    <Share className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                  ) : activeCategory === 'android' ? (
                    selectedGuide === 'android-samsung' ? (
                      <Menu className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                    ) : (
                      <MoreVertical className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                    )
                  ) : (
                    <PlusSquare className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                  )}
                </div>

                <ol className="space-y-2">
                  {activeGuide.steps.map((step, idx) => (
                    <li key={step.title} className="flex items-start gap-2.5 text-xs">
                      <span className="w-5 h-5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 font-mono text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</p>
                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{step.detail}</p>
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
                    className="min-h-[36px] px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Link'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="ml-auto min-h-[36px] px-4 rounded-lg bg-zinc-950 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
                >
                  Done
                </button>
              </div>
              </SwipeScrollArea>
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
          className="w-8 h-8 sm:w-auto sm:h-9 px-0 sm:px-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 hover:border-zinc-400 dark:hover:border-white/25 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          aria-label="Install Switchboard App"
          title={`Install App (${env.browserLabel})`}
        >
          {env.isIOS ? <Share className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          <span className="hidden xl:inline">Install</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePrimaryClick}
          className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
        >
          {env.isIOS ? <Share className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          <span>{isInstallable ? 'Install App' : 'Install Guide'}</span>
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
    <div className="fixed bottom-16 md:bottom-4 left-3 z-50 flex items-center gap-2 rounded-lg bg-amber-400 border border-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline — Cached agents active</span>
    </div>
  );
};
