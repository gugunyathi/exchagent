import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  Download,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Globe,
  FileCode2,
} from 'lucide-react';
import { AgentDoc, CurrencyMode, formatMoney } from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface ChromeExtensionHubProps {
  agents: AgentDoc[];
  currency?: CurrencyMode;
  onTriggerEngageFromSim: (agent: AgentDoc) => void;
}

export const ChromeExtensionHub: React.FC<ChromeExtensionHubProps> = ({
  agents,
  currency = 'USD',
  onTriggerEngageFromSim,
}) => {
  const [selectedSimAgent, setSelectedSimAgent] = useState<AgentDoc>(
    agents.find((a) => a.handle === 'ceo.woolworths.agent') || agents[0]
  );
  const [popupOpen, setPopupOpen] = useState(false);
  const [quickEngageText, setQuickEngageText] = useState(
    'Propose Q4 ESG cold-chain telemetry pilot at US$4,968 (16% off list).'
  );
  const [simResult, setSimResult] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://switchboard.agent';

  const manifestJson = JSON.stringify(
    {
      manifest_version: 3,
      name: 'Switchboard AgentPages Companion',
      version: '1.0.0',
      description:
        'Detects .agent handles on LinkedIn profiles and websites and launches instant Gemini A2A engagements.',
      permissions: ['activeTab', 'storage'],
      host_permissions: ['*://*/*', '<all_urls>'],
      action: {
        default_popup: 'popup.html',
        default_title: 'Switchboard AgentPages',
      },
      content_scripts: [
        {
          matches: ['*://*.linkedin.com/*', '<all_urls>'],
          js: ['content.js'],
          run_at: 'document_idle',
        },
      ],
    },
    null,
    2
  );

  const contentJs = `(() => {
  const HANDLE_REGEX = /\\b([a-z0-9][a-z0-9.-]{0,48}\\.agent)\\b/gi;
  const metaHandle = document.querySelector('meta[name="agent-handle"]')?.getAttribute('content');
  const bodyMatches = document.body?.innerText?.match(HANDLE_REGEX) || [];
  const detectedHandle = metaHandle || bodyMatches[0];
  if (!detectedHandle) return;

  chrome.storage.local.set({ lastDetectedAgent: detectedHandle, lastUrl: location.href });

  if (document.getElementById('switchboard-agent-badge')) return;
  const badge = document.createElement('button');
  badge.id = 'switchboard-agent-badge';
  badge.innerText = '⚡ Engage ' + detectedHandle + ' via Switchboard';
  Object.assign(badge.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '2147483647',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.16)',
    background: '#121215',
    color: '#f4f4f5',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 12px 32px rgba(0,0,0,0.45)'
  });
  badge.onclick = () => {
    window.open('${appOrigin}/?engage=' + encodeURIComponent(detectedHandle), '_blank');
  };
  document.body.appendChild(badge);
})();`;

  const popupHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { width: 320px; margin: 0; padding: 16px; background: #09090b; color: #f4f4f5; font-family: system-ui, sans-serif; }
    h3 { margin: 0 0 8px; font-size: 14px; color: #fafafa; }
    .box { background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 10px; margin-bottom: 10px; font-size: 12px; }
    textarea { width: 100%; box-sizing: border-box; background: #09090b; color: #e4e4e7; border: 1px solid #27272a; border-radius: 8px; padding: 8px; font-size: 12px; }
    button { width: 100%; margin-top: 8px; padding: 9px; border: 0; border-radius: 8px; background: #fafafa; color: #09090b; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <h3>Switchboard AgentPages</h3>
  <div class="box" id="status">Scanning active tab for .agent handle...</div>
  <textarea id="engage" rows="3" placeholder="Enter your A2A engage or RFP offer..."></textarea>
  <button id="send">Launch A2A Engage</button>
  <div id="result" style="margin-top:10px;font-size:11px;color:#6ee7b7;"></div>
  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `const API_BASE = '${appOrigin}';
chrome.storage.local.get(['lastDetectedAgent'], (data) => {
  const handle = data.lastDetectedAgent || 'ceo.woolworths.agent';
  document.getElementById('status').innerText = 'POPIA Verified Target: ' + handle;
  document.getElementById('send').onclick = async () => {
    const proposalTitle = document.getElementById('engage').value || 'Quick Switchboard A2A Engage';
    document.getElementById('result').innerText = 'Negotiating via Switchboard...';
    try {
      const res = await fetch(API_BASE + '/api/a2a/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetHandle: handle, proposalTitle, stickerPriceZAR: 85000 })
      });
      const json = await res.json();
      document.getElementById('result').innerText =
        'Status: ' + json.finalStatus + ' · Agreed R' + json.agreedPriceZAR;
    } catch (e) {
      document.getElementById('result').innerText = 'Open Switchboard portal to complete engage.';
    }
  };
});`;

  const handleDownloadExtensionZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      zip.file('manifest.json', manifestJson);
      zip.file('content.js', contentJs);
      zip.file('popup.html', popupHtml);
      zip.file('popup.js', popupJs);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'switchboard-agentpages-extension.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      emitToast('Downloaded extension ZIP', 'success');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleRunSimPopupEngage = async () => {
    setSimResult('Running A2A handshake...');
    const res = await fetch('/api/a2a/negotiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initiatorHandle: 'alex.founder.agent',
        targetHandle: selectedSimAgent.handle,
        proposalTitle: quickEngageText,
        stickerPriceZAR: 92000,
        surface: 'chrome-extension',
      }),
    });
    const data = await res.json();
    const summary = `${data.finalStatus} at ${formatMoney(Number(data.agreedPriceZAR || 78000), currency)}`;
    setSimResult(summary);
    emitToast(summary, 'success');
  };

  const copySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    emitToast('Snippet copied', 'success');
    setTimeout(() => setCopiedId(null), 1800);
  };

  const agentJsonSnippet = JSON.stringify(
    {
      handle: selectedSimAgent.handle,
      name: selectedSimAgent.displayName,
      popiaVerified: true,
      voice: selectedSimAgent.voiceNumber,
      email: selectedSimAgent.agentEmail,
      mcpEndpoint: selectedSimAgent.mcpEndpoint,
    },
    null,
    2
  );

  const metaTagSnippet = `<meta name="agent-handle" content="${selectedSimAgent.handle}" />\n<link rel="agent-manifest" href="${appOrigin}/.well-known/agent.json" />`;

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Chrome Extension &amp; Embeds
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Manifest V3 LinkedIn scanner &amp; `.well-known/agent.json` snippets
          </p>
        </div>

        <button
          onClick={handleDownloadExtensionZip}
          disabled={downloadingZip}
          className="min-h-[38px] w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          {downloadingZip ? 'Bundling...' : 'Download Extension (.zip)'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 glass-panel rounded-2xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              LinkedIn Badge Simulator
            </h3>
            <select
              value={selectedSimAgent.id}
              onChange={(e) => {
                const found = agents.find((a) => a.id === e.target.value);
                if (found) {
                  setSelectedSimAgent(found);
                  setSimResult(null);
                }
              }}
              className="min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-mono text-zinc-950 dark:text-zinc-200 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
            >
              {agents
                .filter((a) => a.handle !== '911.emergency.agent')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.handle}
                  </option>
                ))}
            </select>
          </div>

          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 overflow-hidden relative">
            <div className="h-20 bg-gradient-to-r from-[#0a66c2] to-[#004182] dark:from-zinc-900 dark:to-zinc-900 border-b border-zinc-300 dark:border-white/10" />
            <div className="p-4 pt-10 relative">
              <div className="w-14 h-14 rounded-full bg-white dark:bg-zinc-800 border-2 border-zinc-300 dark:border-zinc-950 flex items-center justify-center text-base font-bold text-zinc-900 dark:text-zinc-100 absolute -top-7 left-4 shadow-sm">
                {selectedSimAgent.displayName.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-display font-bold text-zinc-950 dark:text-zinc-50">
                    {selectedSimAgent.displayName}
                  </h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {selectedSimAgent.roleTitle} at {selectedSimAgent.organization}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 font-mono">
                    {selectedSimAgent.handle} · {selectedSimAgent.voiceNumber}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPopupOpen((v) => !v)}
                  className="min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-50 px-3 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white whitespace-nowrap shrink-0 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Engage Agent
                </button>
              </div>
            </div>

            {popupOpen && (
              <div className="m-3 sm:m-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display font-bold text-zinc-950 dark:text-zinc-100">Extension Quick-Engage</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    POPIA Verified
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={quickEngageText}
                  onChange={(e) => setQuickEngageText(e.target.value)}
                  className="w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 p-2.5 text-xs text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
                />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunSimPopupEngage}
                    className="flex-1 min-h-[36px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-3 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                  >
                    Send Quick Engage
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerEngageFromSim(selectedSimAgent)}
                    className="min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                  >
                    Open in Arena
                  </button>
                </div>
                {simResult && (
                  <p className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-300">{simResult}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 glass-panel rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Website &amp; Bio Snippets
          </h3>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">HTML Meta Tags</span>
              <button
                type="button"
                onClick={() => copySnippet('meta', metaTagSnippet)}
                className="min-h-[28px] px-2 inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 hover:text-zinc-950 dark:hover:text-white font-medium"
              >
                {copiedId === 'meta' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'meta' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <SwipeScrollArea direction="horizontal" showArrows={true}>
              <pre className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 text-[11px] font-mono text-zinc-800 dark:text-zinc-300 whitespace-pre">
                {metaTagSnippet}
              </pre>
            </SwipeScrollArea>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">/.well-known/agent.json</span>
              <button
                type="button"
                onClick={() => copySnippet('agentjson', agentJsonSnippet)}
                className="min-h-[28px] px-2 inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 hover:text-zinc-950 dark:hover:text-white font-medium"
              >
                {copiedId === 'agentjson' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'agentjson' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <SwipeScrollArea direction="horizontal" showArrows={true}>
              <pre className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 text-[11px] font-mono text-zinc-900 dark:text-emerald-300 whitespace-pre">
                {agentJsonSnippet}
              </pre>
            </SwipeScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};
