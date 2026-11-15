import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Terminal,
  Play,
  ExternalLink,
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
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Audit Ledger &amp; OpenAPI
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Cryptographic settlements, Poppy operations &amp; discovery endpoints
          </p>
        </div>

        <SwipeScrollArea
          direction="horizontal"
          className="w-full lg:w-auto"
          innerClassName="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
        >
          <button
            onClick={() => setSubTab('ledger')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'ledger'
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
            }`}
          >
            Settlements ({settlements.length})
          </button>
          <button
            onClick={() => setSubTab('poppy_audit')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'poppy_audit'
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
            }`}
          >
            Poppy Ops ({poppyOperations.length})
          </button>
          <button
            onClick={() => setSubTab('openapi')}
            className={`min-h-[36px] px-3.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'openapi'
                ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
            }`}
          >
            OpenAPI
          </button>
        </SwipeScrollArea>
      </div>

      {subTab === 'ledger' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="glass-panel rounded-xl p-3.5">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Negotiated Savings</p>
              <p className="text-lg sm:text-2xl font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {formatMoney(totalSavedZAR, currency)}
              </p>
            </div>
            <div className="glass-panel rounded-xl p-3.5">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Settled Volume</p>
              <p className="text-lg sm:text-2xl font-mono tabular-nums font-bold text-zinc-950 dark:text-zinc-50 mt-1">
                {formatMoney(totalVolumeZAR, currency)}
              </p>
            </div>
            <div className="glass-panel rounded-xl p-3.5 col-span-2 sm:col-span-1 flex flex-col justify-between">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Payment Rail</p>
              <SwipeScrollArea direction="horizontal" innerClassName="flex items-center gap-1 mt-1.5">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'paypal_vault', label: 'PayPal' },
                    { id: 'x402_base', label: 'Base' },
                    { id: 'x402_arc', label: 'Arc' },
                    { id: 'x402_solana', label: 'Solana' },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRailFilter(r.id)}
                    className={`min-h-[28px] px-2 rounded-md text-[11px] whitespace-nowrap border transition-colors ${
                      railFilter === r.id
                        ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white font-semibold'
                        : 'bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-white/10 hover:text-zinc-950 dark:hover:text-zinc-200 font-medium'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </SwipeScrollArea>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">Cryptographic Ledger</h3>
            </div>

            <div className="md:hidden space-y-2">
              {filteredSettlements.map((tx) => (
                <div key={tx.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
                      {new Date(tx.settledAt).toLocaleString('en-ZA', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {tx.rail.toUpperCase()}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">-{tx.savedPct}%</span>
                  </div>
                  <p className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-200 truncate">
                    {tx.buyerHandle} ← {tx.sellerHandle}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-zinc-200 dark:border-white/10">
                    <span className="font-mono text-[11px] text-zinc-500 truncate">{tx.txHash}</span>
                    <span className="font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-50 shrink-0">
                      <span className="text-zinc-500 line-through font-normal mr-1.5">
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
                <tr className="border-b border-zinc-300 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-semibold">Timestamp</th>
                  <th className="py-2 px-3 font-semibold">Counterparties</th>
                  <th className="py-2 px-3 font-semibold">Channel</th>
                  <th className="py-2 px-3 font-semibold text-right">Sticker</th>
                  <th className="py-2 px-3 font-semibold text-right">Settled</th>
                  <th className="py-2 px-3 font-semibold text-right">Saved</th>
                  <th className="py-2 px-3 font-semibold">Rail</th>
                  <th className="py-2 pl-3 font-semibold">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                {filteredSettlements.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50 h-10">
                    <td className="py-2 pr-3 font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                      {new Date(tx.settledAt).toLocaleString('en-ZA', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-3 font-mono font-medium text-zinc-900 dark:text-zinc-200 whitespace-nowrap">
                      {tx.buyerHandle} ← {tx.sellerHandle}
                    </td>
                    <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{tx.channel}</td>
                    <td className="py-2 px-3 font-mono tabular-nums text-zinc-500 text-right whitespace-nowrap">
                      {formatMoney(tx.stickerPriceZAR, currency)}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums font-semibold text-zinc-950 dark:text-zinc-50 text-right whitespace-nowrap">
                      {formatMoney(tx.amountZAR, currency)}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-300 text-right whitespace-nowrap">
                      -{tx.savedPct}%
                    </td>
                    <td className="py-2 px-3 font-mono text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {tx.rail.toUpperCase()}
                    </td>
                    <td className="py-2 pl-3 font-mono text-zinc-500 max-w-[160px] truncate">
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
          <div className="glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">Operations v3 Ledger</h3>

            <div className="md:hidden space-y-2">
              {poppyOperations.map((op) => (
                <div key={op.operation_id} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="text-zinc-900 dark:text-zinc-200 font-semibold truncate">{op.operation_id}</span>
                    <span className="uppercase font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">{op.status}</span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">{op.summary}</p>
                  <p className="text-[11px] font-mono text-zinc-500 truncate">
                    {op.approver || 'pending'} · {op.reference || '—'}
                  </p>
                </div>
              ))}
            </div>

            <table className="hidden md:table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-300 dark:border-white/10 text-zinc-600 dark:text-zinc-400">
                  <th className="py-2 pr-3 font-semibold">Operation ID</th>
                  <th className="py-2 px-3 font-semibold">Summary</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                  <th className="py-2 px-3 font-semibold">Approver</th>
                  <th className="py-2 pl-3 font-semibold">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                {poppyOperations.map((op) => (
                  <tr key={op.operation_id} className="h-10">
                    <td className="py-2 pr-3 font-mono font-medium text-zinc-900 dark:text-zinc-200">{op.operation_id}</td>
                    <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">{op.summary}</td>
                    <td className="py-2 px-3 font-mono font-semibold uppercase text-emerald-700 dark:text-emerald-300">{op.status}</td>
                    <td className="py-2 px-3 font-mono text-zinc-600 dark:text-zinc-400">{op.approver || 'pending'}</td>
                    <td className="py-2 pl-3 font-mono text-zinc-600 dark:text-zinc-400">{op.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-panel rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">Compliance Log</h3>
            {poppyAuditLogs.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">{entry.action}</span>
                  <span className="text-zinc-400 dark:text-zinc-600 mx-2">·</span>
                  <span className="text-zinc-600 dark:text-zinc-400">{entry.details}</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                  {entry.popiaMinimized ? 'POPIA Minimized' : 'Standard'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-5 glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Endpoints &amp; Runtime
            </h3>

            <div className="space-y-1.5 text-xs">
              {(
                [
                  { ep: '/.well-known/poppy.json', label: 'GET /.well-known/poppy.json' },
                  { ep: '/api/poppy/tasks', label: 'GET /api/poppy/tasks' },
                  { ep: '/.well-known/oauth-authorization-server', label: 'GET /.well-known/oauth-authorization-server' },
                  { ep: '/api/agents/directory', label: 'GET /api/agents/directory' },
                  { ep: '/api/skill.json', label: 'GET /api/skill.json' },
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
                  className={`w-full text-left rounded-lg px-3 py-2 font-mono border flex items-center justify-between transition-colors ${
                    selectedEndpoint === item.ep
                      ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-white/20 text-zinc-950 dark:text-zinc-50 font-semibold'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-white/10 text-zinc-700 dark:text-zinc-400 hover:border-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <Play className="w-3 h-3 shrink-0" />
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-white/10 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span>Firestore</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
                  {firestoreOnline ? 'Connected' : 'Local Adapter'}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span>Maps Platform</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
                  {hasGoogleMapsKey ? 'Live JS + Radar' : 'Vector Radar'}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span>Workspace OAuth</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-200">
                  {workspaceConnected ? 'Active' : 'Ready'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3 text-xs">
              <a
                href="/llms.txt"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 hover:underline font-mono font-medium"
              >
                /llms.txt <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="/api/skill.json"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 hover:underline font-mono font-medium"
              >
                /api/skill.json <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-200 truncate">{selectedEndpoint}</span>
              <button
                onClick={() => runEndpointTest(selectedEndpoint)}
                disabled={loadingApi}
                className="min-h-[34px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-3 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white whitespace-nowrap"
              >
                {loadingApi ? 'Fetching...' : 'Execute'}
              </button>
            </div>

            {loadingApi ? (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-4 space-y-2.5">
                <div className="skeleton-line h-3 w-1/2" />
                <div className="skeleton-line h-3 w-4/5" />
                <div className="skeleton-line h-3 w-2/3" />
              </div>
            ) : (
              <SwipeScrollArea direction="both" className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 max-h-[360px]">
                <pre className="p-3.5 text-xs font-mono text-zinc-900 dark:text-emerald-300 whitespace-pre">
                  {apiResponse || 'Select any endpoint to inspect JSON output.'}
                </pre>
              </SwipeScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
