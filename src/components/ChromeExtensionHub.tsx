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
import { AgentDoc } from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';

interface ChromeExtensionHubProps {
  agents: AgentDoc[];
  onTriggerPitchFromSim: (agent: AgentDoc) => void;
}

export const ChromeExtensionHub: React.FC<ChromeExtensionHubProps> = ({
  agents,
  onTriggerPitchFromSim,
}) => {
  const [selectedSimAgent, setSelectedSimAgent] = useState<AgentDoc>(
    agents.find((a) => a.handle === 'ceo.woolworths.agent') || agents[0]
  );
  const [popupOpen, setPopupOpen] = useState(false);
  const [quickPitchText, setQuickPitchText] = useState(
    'Propose Q4 ESG cold-chain telemetry pilot at R92,000 (16% off list).'
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
        'Detects .agent handles on LinkedIn profiles and websites and launches instant Gemini A2A pitches.',
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
  badge.innerText = '⚡ Pitch ' + detectedHandle + ' via Switchboard';
  Object.assign(badge.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '2147483647',
    padding: '10px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(34,211,238,0.45)',
    background: 'rgba(5,8,17,0.92)',
    backdropFilter: 'blur(16px)',
    color: '#67e8f9',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 12px 32px rgba(0,0,0,0.45)'
  });
  badge.onclick = () => {
    window.open('${appOrigin}/?pitch=' + encodeURIComponent(detectedHandle), '_blank');
  };
  document.body.appendChild(badge);
})();`;

  const popupHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { width: 320px; margin: 0; padding: 16px; background: #050811; color: #f1f5f9; font-family: system-ui, sans-serif; }
    h3 { margin: 0 0 8px; font-size: 14px; color: #22d3ee; }
    .box { background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 10px; margin-bottom: 10px; font-size: 12px; }
    textarea { width: 100%; box-sizing: border-box; background: #020617; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 8px; font-size: 12px; }
    button { width: 100%; margin-top: 8px; padding: 9px; border: 0; border-radius: 8px; background: #22d3ee; color: #050811; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <h3>Switchboard AgentPages</h3>
  <div class="box" id="status">Scanning active tab for .agent handle...</div>
  <textarea id="pitch" rows="3" placeholder="Enter your A2A pitch or RFP offer..."></textarea>
  <button id="send">Launch Gemini A2A Pitch</button>
  <div id="result" style="margin-top:10px;font-size:11px;color:#6ee7b7;"></div>
  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `const API_BASE = '${appOrigin}';
chrome.storage.local.get(['lastDetectedAgent'], (data) => {
  const handle = data.lastDetectedAgent || 'ceo.woolworths.agent';
  document.getElementById('status').innerText = 'POPIA Verified Target: ' + handle;
  document.getElementById('send').onclick = async () => {
    const proposalTitle = document.getElementById('pitch').value || 'Quick Switchboard A2A Pitch';
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
      document.getElementById('result').innerText = 'Open Switchboard portal to complete pitch.';
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
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleRunSimPopupPitch = async () => {
    setSimResult('Running live Gemini A2A handshake from simulated toolbar...');
    const res = await fetch('/api/a2a/negotiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initiatorHandle: 'alex.founder.agent',
        targetHandle: selectedSimAgent.handle,
        proposalTitle: quickPitchText,
        stickerPriceZAR: 92000,
        surface: 'chrome-extension',
      }),
    });
    const data = await res.json();
    setSimResult(
      `${data.finalStatus} at R${Number(data.agreedPriceZAR || 78000).toLocaleString('en-ZA')} (${data.engine})`
    );
  };

  const copySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
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
    <div className="space-y-4 sm:space-y-5">
      {/* Header + 1-Click ZIP Download */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-cyan-400">
            Manifest V3 Extension &amp; Discovery Embeds
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            Chrome Extension &amp; Website Kit
          </h2>
        </div>

        <button
          onClick={handleDownloadExtensionZip}
          disabled={downloadingZip}
          className="min-h-[42px] w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          {downloadingZip ? 'Bundling ZIP...' : 'Download Extension (.zip)'}
        </button>
      </div>

      {/* Live In-Browser LinkedIn & Extension Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        <div className="lg:col-span-7 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              Live LinkedIn Profile Scanner Simulator
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
              className="min-h-[40px] rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-1.5 text-xs font-mono text-cyan-200"
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

          {/* Simulated LinkedIn Profile Card */}
          <div className="rounded-2xl bg-[#0B1120] border border-slate-800 overflow-hidden relative">
            <div className="h-24 bg-gradient-to-r from-cyan-950/80 via-slate-900 to-emerald-950/70 border-b border-slate-800" />
            <div className="p-5 pt-10 relative">
              <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-cyan-400/50 flex items-center justify-center text-lg font-bold text-cyan-200 absolute -top-8 left-5">
                {selectedSimAgent.displayName.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-white">
                    {selectedSimAgent.displayName}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {selectedSimAgent.roleTitle} at {selectedSimAgent.organization}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Bio: Reach my autonomous procurement delegate directly at{' '}
                    <span className="font-mono text-cyan-300 underline">
                      {selectedSimAgent.handle}
                    </span>{' '}
                    · Voice: {selectedSimAgent.voiceNumber}
                  </p>
                </div>

                {/* Injected Glassmorphic Extension Badge */}
                <button
                  onClick={() => setPopupOpen((v) => !v)}
                  className="min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 border border-cyan-400/50 px-3.5 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 shadow-lg whitespace-nowrap shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-300" />
                  Pitch via Switchboard Agent
                </button>
              </div>
            </div>

            {/* Simulated Toolbar Popup Drawer */}
            {popupOpen && (
              <div className="m-3 sm:m-4 rounded-xl bg-slate-950/95 border border-cyan-500/40 p-3.5 sm:p-4 space-y-3 shadow-2xl">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-300">
                    Extension Quick-Pitch Drawer
                  </span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    POPIA Verified
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={quickPitchText}
                  onChange={(e) => setQuickPitchText(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2.5 text-xs text-slate-100"
                />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    onClick={handleRunSimPopupPitch}
                    className="flex-1 min-h-[40px] rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                  >
                    Trigger Quick A2A Pitch
                  </button>
                  <button
                    onClick={() => onTriggerPitchFromSim(selectedSimAgent)}
                    className="min-h-[40px] rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-cyan-400 whitespace-nowrap"
                  >
                    Open in Full Arena
                  </button>
                </div>
                {simResult && (
                  <p className="text-xs font-mono text-emerald-300">{simResult}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Embeddable Website & LinkedIn Kit */}
        <div className="lg:col-span-5 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-4">
          <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-emerald-400" />
            Embeddable Website & Bio Kit
          </h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">1. HTML Meta & Well-Known Link</span>
              <button
                onClick={() => copySnippet('meta', metaTagSnippet)}
                className="min-h-[32px] px-2 inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
              >
                {copiedId === 'meta' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'meta' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <SwipeScrollArea direction="horizontal" showArrows={true}>
              <pre className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 text-[11px] font-mono text-slate-300 whitespace-pre">
                {metaTagSnippet}
              </pre>
            </SwipeScrollArea>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">2. /.well-known/agent.json</span>
              <button
                onClick={() => copySnippet('agentjson', agentJsonSnippet)}
                className="min-h-[32px] px-2 inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
              >
                {copiedId === 'agentjson' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'agentjson' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <SwipeScrollArea direction="horizontal" showArrows={true}>
              <pre className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 text-[11px] font-mono text-emerald-300 whitespace-pre">
                {agentJsonSnippet}
              </pre>
            </SwipeScrollArea>
          </div>

          <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3.5 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-200">Load Unpacked in Chrome:</p>
            <p>
              1. Click <strong>Download Unpacked Extension (.zip)</strong> and unzip.<br />
              2. Open <code className="text-cyan-300">chrome://extensions</code> → enable <strong>Developer mode</strong>.<br />
              3. Click <strong>Load unpacked</strong> and select the unzipped folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
