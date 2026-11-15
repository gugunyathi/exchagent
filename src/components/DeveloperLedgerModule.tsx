import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Terminal,
  Play,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import {
  SettlementDoc,
  PoppyOperation,
  PoppyAuditLogEntry,
  CurrencyMode,
  PaymentRail,
  formatMoney,
} from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';

interface DeveloperLedgerModuleProps {
  settlements: SettlementDoc[];
  poppyOperations?: PoppyOperation[];
  poppyAuditLogs?: PoppyAuditLogEntry[];
  currency: CurrencyMode;
  firestoreOnline: boolean;
  hasGoogleMapsKey: boolean;
  workspaceConnected: boolean;
}

export const DeveloperLedgerModule: React.FC<DeveloperLedgerModuleProps> = ({
  settlements,
  poppyOperations = [],
  poppyAuditLogs = [],
  currency,
  firestoreOnline,
  hasGoogleMapsKey,
  workspaceConnected,
}) => {
  const [subTab, setSubTab] = useState<'ledger' | 'poppy_audit' | 'openapi'>('ledger');
  const [railFilter, setRailFilter] = useState<'all' | PaymentRail>('all');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/.well-known/poppy.json');
  const [apiResponse, setApiResponse] = useState<string>('');
  const [loadingApi, setLoadingApi] = useState(false);

  const filteredSettlements = settlements.filter((s) =>
    railFilter === 'all' ? true : s.rail === railFilter
  );

  const totalSavedZAR = settlements.reduce((acc, s) => acc + s.savedZAR, 0);
  const totalVolumeZAR = settlements.reduce((acc, s) => acc + s.amountZAR, 0);

  const runEndpointTest = async (ep: string) => {
    setLoadingApi(true);
    try {
      const res = await fetch(ep);
      const text = await res.text();
      try {
        setApiResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setApiResponse(text);
      }
    } finally {
      setLoadingApi(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-cyan-400">
            x402 &amp; PayPal Audit · OpenAPI 3.1
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            Audit Ledger &amp; Developer Hub
          </h2>
        </div>

        <SwipeScrollArea direction="horizontal" className="w-full lg:w-auto" innerClassName="flex items-center gap-1 p-1 rounded-xl bg-slate-950/70 border border-slate-800">
          <button
            onClick={() => setSubTab('ledger')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
              subTab === 'ledger'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Audit Ledger ({settlements.length})
          </button>
          <button
            onClick={() => setSubTab('poppy_audit')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
              subTab === 'poppy_audit'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Poppy Ops ({poppyOperations.length})
          </button>
          <button
            onClick={() => setSubTab('openapi')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
              subTab === 'openapi'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            OpenAPI & SDK Tools
          </button>
        </SwipeScrollArea>
      </div>

      {subTab === 'ledger' ? (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="glass-panel rounded-xl p-3.5 sm:p-4">
              <p className="text-[11px] sm:text-xs text-slate-400">Negotiated Savings</p>
              <p className="text-lg sm:text-2xl font-mono tabular-nums font-semibold text-emerald-300 mt-1">
                {formatMoney(totalSavedZAR, currency)}
              </p>
            </div>
            <div className="glass-panel rounded-xl p-3.5 sm:p-4">
              <p className="text-[11px] sm:text-xs text-slate-400">Settled Volume</p>
              <p className="text-lg sm:text-2xl font-mono tabular-nums font-semibold text-white mt-1">
                {formatMoney(totalVolumeZAR, currency)}
              </p>
            </div>
            <div className="glass-panel rounded-xl p-3.5 sm:p-4 col-span-2 sm:col-span-1">
              <p className="text-[11px] sm:text-xs text-slate-400">Rail Filter</p>
              <select
                value={railFilter}
                onChange={(e) => setRailFilter(e.target.value as 'all' | PaymentRail)}
                className="mt-1.5 w-full min-h-[38px] rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="all">All Payment Rails</option>
                <option value="paypal_vault">PayPal Agentic Vault</option>
                <option value="x402_base">x402 Base USDC</option>
                <option value="x402_arc">x402 Arc Network</option>
                <option value="x402_solana">x402 Solana USDC</option>
              </select>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm sm:text-base font-semibold text-white">Cryptographic Settlement Ledger</h3>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-2.5">
              {filteredSettlements.map((tx) => (
                <div key={tx.id} className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-slate-400">
                      {new Date(tx.settledAt).toLocaleString('en-ZA', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {tx.channel} · <span className="text-cyan-300">{tx.rail.toUpperCase()}</span>
                    </span>
                    <span className="font-mono tabular-nums text-emerald-300 shrink-0">-{tx.savedPct}%</span>
                  </div>
                  <p className="text-xs font-mono text-slate-200 truncate">
                    {tx.buyerHandle} ← {tx.sellerHandle}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-800/70">
                    <span className="font-mono text-[11px] text-slate-500 truncate">{tx.txHash}</span>
                    <span className="font-mono tabular-nums font-semibold text-white shrink-0">
                      <span className="text-slate-500 line-through font-normal mr-1.5">
                        {formatMoney(tx.stickerPriceZAR, currency)}
                      </span>
                      {formatMoney(tx.amountZAR, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <table className="hidden md:table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-3 font-medium">Timestamp</th>
                  <th className="py-2.5 px-3 font-medium">Counterparties</th>
                  <th className="py-2.5 px-3 font-medium">Channel</th>
                  <th className="py-2.5 px-3 font-medium text-right">Sticker</th>
                  <th className="py-2.5 px-3 font-medium text-right">Settled</th>
                  <th className="py-2.5 px-3 font-medium text-right">Savings</th>
                  <th className="py-2.5 px-3 font-medium">Rail</th>
                  <th className="py-2.5 pl-3 font-medium">Settlement Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredSettlements.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-900/40">
                    <td className="py-3 pr-3 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(tx.settledAt).toLocaleString('en-ZA', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-200 whitespace-nowrap">
                      {tx.buyerHandle} ← {tx.sellerHandle}
                    </td>
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{tx.channel}</td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-400 text-right whitespace-nowrap">
                      {formatMoney(tx.stickerPriceZAR, currency)}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums font-semibold text-white text-right whitespace-nowrap">
                      {formatMoney(tx.amountZAR, currency)}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-emerald-300 text-right whitespace-nowrap">
                      -{tx.savedPct}%
                    </td>
                    <td className="py-3 px-3 font-mono text-cyan-300 whitespace-nowrap">
                      {tx.rail.toUpperCase()}
                    </td>
                    <td className="py-3 pl-3 font-mono text-slate-400 max-w-[160px] truncate">
                      {tx.txHash}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : subTab === 'poppy_audit' ? (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3">
            <h3 className="text-sm sm:text-base font-semibold text-white">
              Poppy Operations v3 Approval & Execution Ledger
            </h3>

            {/* Mobile Operation Cards */}
            <div className="md:hidden space-y-2.5">
              {poppyOperations.map((op) => (
                <div key={op.operation_id} className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-cyan-300 truncate">{op.operation_id}</span>
                    <span className="uppercase text-emerald-300 shrink-0">{op.status}</span>
                  </div>
                  <p className="text-xs text-slate-200">{op.summary}</p>
                  <p className="text-[11px] font-mono text-slate-400 truncate">
                    Approver: {op.approver || 'pending'} · Ref: <span className="text-amber-300">{op.reference || '—'}</span>
                  </p>
                </div>
              ))}
            </div>

            <table className="hidden md:table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Operation ID</th>
                  <th className="py-2 px-3 font-medium">Summary</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Approver</th>
                  <th className="py-2 pl-3 font-medium">Idempotent Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {poppyOperations.map((op) => (
                  <tr key={op.operation_id}>
                    <td className="py-2.5 pr-3 font-mono text-cyan-300">{op.operation_id}</td>
                    <td className="py-2.5 px-3 text-slate-200">{op.summary}</td>
                    <td className="py-2.5 px-3 font-mono uppercase text-emerald-300">{op.status}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{op.approver || 'pending'}</td>
                    <td className="py-2.5 pl-3 font-mono text-amber-300">{op.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-panel rounded-2xl p-3.5 sm:p-5 space-y-2.5">
            <h3 className="text-sm font-semibold text-white">Poppy Compliance & Consent Audit Log</h3>
            {poppyAuditLogs.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-cyan-300">{entry.action}</span>
                  <span className="text-slate-500 mx-2">·</span>
                  <span className="text-slate-300">{entry.details}</span>
                </div>
                <span className="font-mono text-[10px] text-emerald-300 shrink-0">
                  {entry.popiaMinimized ? 'POPIA Minimized' : 'Standard'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Developer & OpenAPI Hub */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          <div className="lg:col-span-5 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Live OpenAPI & Agent Endpoints
            </h3>

            <div className="space-y-2 text-xs">
              {(
                [
                  { ep: '/.well-known/poppy.json', label: 'GET /.well-known/poppy.json' },
                  { ep: '/api/poppy/tasks', label: 'GET /api/poppy/tasks' },
                  { ep: '/.well-known/oauth-authorization-server', label: 'GET /.well-known/oauth-authorization-server' },
                  { ep: '/api/agents/directory', label: 'GET /api/agents/directory' },
                  { ep: '/api/skill.json', label: 'GET /api/skill.json (OpenAPI 3.1)' },
                  { ep: '/api/names/search?q=007', label: 'GET /api/names/search?q=007' },
                  { ep: '/.well-known/agent.json', label: 'GET /.well-known/agent.json' },
                ] as const
              ).map((item) => (
                <button
                  key={item.ep}
                  onClick={() => {
                    setSelectedEndpoint(item.ep);
                    runEndpointTest(item.ep);
                  }}
                  className={`w-full text-left rounded-xl px-3.5 py-2.5 font-mono border flex items-center justify-between transition-colors ${
                    selectedEndpoint === item.ep
                      ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span>{item.label}</span>
                  <Play className="w-3.5 h-3.5 shrink-0" />
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs">
              <p className="font-semibold text-slate-200">Runtime Integration State</p>
              <div className="flex items-center justify-between text-slate-400">
                <span>Cloud Firestore</span>
                <span className="font-mono text-emerald-300">
                  {firestoreOnline ? 'Connected (with local cache)' : 'Local Adapter Active'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Google Maps Platform</span>
                <span className="font-mono text-emerald-300">
                  {hasGoogleMapsKey ? 'Live Maps JS + Vector Fallback' : 'Interactive Vector Radar'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Calendar & Gmail OAuth</span>
                <span className="font-mono text-emerald-300">
                  {workspaceConnected ? 'Authorized Token Active' : 'Simulated Engine Ready'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3 text-xs">
              <a
                href="/llms.txt"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan-300 hover:underline font-mono"
              >
                /llms.txt <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="/api/skill.json"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan-300 hover:underline font-mono"
              >
                /api/skill.json <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-cyan-300 truncate">{selectedEndpoint}</span>
              <button
                onClick={() => runEndpointTest(selectedEndpoint)}
                disabled={loadingApi}
                className="min-h-[38px] rounded-xl bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 whitespace-nowrap"
              >
                {loadingApi ? 'Fetching...' : 'Execute Request'}
              </button>
            </div>
            <SwipeScrollArea direction="both" className="rounded-xl bg-slate-950/90 border border-slate-800 max-h-[360px]">
              <pre className="p-3.5 text-xs font-mono text-emerald-300 whitespace-pre">
                {apiResponse || 'Tap any endpoint to inspect live JSON output.'}
              </pre>
            </SwipeScrollArea>
          </div>
        </div>
      )}
    </div>
  );
};
