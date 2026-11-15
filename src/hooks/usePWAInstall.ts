import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type OSPlatform =
  | 'ios'
  | 'ipados'
  | 'android'
  | 'macos'
  | 'windows'
  | 'linux'
  | 'chromeos'
  | 'other';

export type BrowserFamily =
  | 'safari'
  | 'chrome'
  | 'edge'
  | 'samsung'
  | 'firefox'
  | 'opera'
  | 'brave'
  | 'arc'
  | 'in-app'
  | 'other';

export type InstallGuideKey =
  | 'ios-safari'
  | 'ios-chromium'
  | 'android-chrome'
  | 'android-samsung'
  | 'android-firefox'
  | 'macos-safari'
  | 'desktop-chromium'
  | 'desktop-edge'
  | 'desktop-firefox'
  | 'in-app';

interface DetectedEnv {
  os: OSPlatform;
  browser: BrowserFamily;
  osLabel: string;
  browserLabel: string;
  guideKey: InstallGuideKey;
  isIOS: boolean;
  isMobile: boolean;
  isInIframe: boolean;
}

function detectEnvironment(): DetectedEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'other',
      browser: 'other',
      osLabel: 'Device',
      browserLabel: 'Browser',
      guideKey: 'desktop-chromium',
      isIOS: false,
      isMobile: false,
      isInIframe: false,
    };
  }

  const ua = navigator.userAgent || '';
  const lower = ua.toLowerCase();
  const maxTouch = navigator.maxTouchPoints || 0;

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  // OS detection (including iPadOS desktop-class Safari UA)
  const isIPhoneOrIPod = /iphone|ipod/.test(lower);
  const isIPad = /ipad/.test(lower) || (/macintosh/.test(lower) && maxTouch > 1);
  const isIOS = isIPhoneOrIPod || isIPad;

  let os: OSPlatform = 'other';
  let osLabel = 'Desktop';
  if (isIPad) {
    os = 'ipados';
    osLabel = 'iPadOS';
  } else if (isIPhoneOrIPod) {
    os = 'ios';
    osLabel = 'iPhone';
  } else if (/android/.test(lower)) {
    os = 'android';
    osLabel = 'Android';
  } else if (/cros/.test(lower)) {
    os = 'chromeos';
    osLabel = 'ChromeOS';
  } else if (/windows/.test(lower)) {
    os = 'windows';
    osLabel = 'Windows';
  } else if (/macintosh|mac os x/.test(lower)) {
    os = 'macos';
    osLabel = 'macOS';
  } else if (/linux/.test(lower)) {
    os = 'linux';
    osLabel = 'Linux';
  }

  // Browser detection
  let browser: BrowserFamily = 'other';
  let browserLabel = 'Browser';

  const isInApp =
    /fban|fbav|instagram|linkedinapp|line\/|micromessenger|snapchat|twitter|wv\)/.test(lower) ||
    (isIOS && !/safari/.test(lower) && !/crios|fxios|edgios|opios/.test(lower));

  const hasBrave = Boolean((navigator as unknown as { brave?: unknown }).brave);

  if (isInApp) {
    browser = 'in-app';
    browserLabel = 'In-App Browser';
  } else if (/samsungbrowser/.test(lower)) {
    browser = 'samsung';
    browserLabel = 'Samsung Internet';
  } else if (/edg|edga|edgios/.test(lower)) {
    browser = 'edge';
    browserLabel = 'Microsoft Edge';
  } else if (/opr\/|opera|opt\//.test(lower)) {
    browser = 'opera';
    browserLabel = 'Opera';
  } else if (/firefox|fxios/.test(lower)) {
    browser = 'firefox';
    browserLabel = 'Firefox';
  } else if (hasBrave) {
    browser = 'brave';
    browserLabel = 'Brave';
  } else if (/crios|chrome|chromium/.test(lower)) {
    browser = 'chrome';
    browserLabel = 'Chrome';
  } else if (/safari/.test(lower)) {
    browser = 'safari';
    browserLabel = 'Safari';
  }

  // Resolve optimal guide key
  let guideKey: InstallGuideKey = 'desktop-chromium';
  if (browser === 'in-app') {
    guideKey = 'in-app';
  } else if (isIOS) {
    guideKey = browser === 'safari' ? 'ios-safari' : 'ios-chromium';
  } else if (os === 'android') {
    if (browser === 'samsung') guideKey = 'android-samsung';
    else if (browser === 'firefox') guideKey = 'android-firefox';
    else guideKey = 'android-chrome';
  } else if (os === 'macos' && browser === 'safari') {
    guideKey = 'macos-safari';
  } else if (browser === 'edge') {
    guideKey = 'desktop-edge';
  } else if (browser === 'firefox') {
    guideKey = 'desktop-firefox';
  } else {
    guideKey = 'desktop-chromium';
  }

  return {
    os,
    browser,
    osLabel,
    browserLabel,
    guideKey,
    isIOS,
    isMobile: isIOS || os === 'android',
    isInIframe,
  };
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalone());
  const [env] = useState<DetectedEnv>(() => detectEnvironment());
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateCallback, setUpdateCallback] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    setIsInstalled(checkIsStandalone());

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = () => setIsInstalled(checkIsStandalone());
    standaloneQuery.addEventListener?.('change', onDisplayChange);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const handleNeedRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ updateSW?: (reloadPage?: boolean) => Promise<void> }>).detail;
      setNeedRefresh(true);
      if (detail?.updateSW) {
        setUpdateCallback(() => detail.updateSW!);
      }
    };

    const handleOfflineReady = () => {
      setOfflineReady(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-need-refresh', handleNeedRefresh);
    window.addEventListener('pwa-offline-ready', handleOfflineReady);

    return () => {
      standaloneQuery.removeEventListener?.('change', onDisplayChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-need-refresh', handleNeedRefresh);
      window.removeEventListener('pwa-offline-ready', handleOfflineReady);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const applyUpdate = useCallback(async () => {
    if (updateCallback) {
      await updateCallback(true);
    } else {
      window.location.reload();
    }
  }, [updateCallback]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS: env.isIOS,
    env,
    needRefresh,
    offlineReady,
    install,
    applyUpdate,
  };
}
