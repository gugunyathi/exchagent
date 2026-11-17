import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Play,
  ExternalLink,
  Bot,
  FileCode2,
  ShieldCheck,
} from 'lucide-react';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';

interface SkillSpec {
  id: string;
  name: string;
  method: 'GET' | 'POST';
  endpoint: string;
  auth: string;
  summary: string;
  sampleBody?: Record<string, unknown>;
}

const SWITCHBOARD_SKILLS: SkillSpec[] = [
  {
    id: 'directory_search',
    name: 'directory.lookup',
    method: 'GET',
    endpoint: '/api/agents/directory?q=chris',
    auth: 'Public',
    summary: 'Lookup verified human & business .agent cards and endpoints.',
  },
  {
    id: 'a2a_negotiate',
    name: 'a2a.negotiate',
    method: 'POST',
    endpoint: '/api/a2a/negotiate',
    auth: 'A2A / x402',
    summary: '4-turn Gemini A2A negotiation within spend & discount guardrails.',
    sampleBody: {
      initiatorHandle: 'chris.moleme.agent',
      targetHandle: 'ceo.woolworths.agent',
      proposalTitle: 'Q4 B2B Lead Gen & ESG Audit',
      stickerPriceZAR: 95000,
      surface: 'agent-skill-api',
      targetMaxSpendZAR: 450000,
      targetMinDiscountPct: 14,
    },
  },
  {
    id: 'rfp_broadcast',
    name: 'rfp.broadcast',
    method: 'POST',
    endpoint: '/api/rfp/broadcast',
    auth: 'Bearer',
    summary: 'Broadcast Reverse-RFP to Directory, Maps DOOH, BLE & CarPlay.',
    sampleBody: {
      title: 'Sandton Solar & Edge IoT Fleet',
      description: '10 telemetry hubs with x402 payouts.',
      budgetZAR: 165000,
      category: 'Clean Energy',
      broadcastChannels: ['directory', 'google_maps_billboard', 'ble_beacon'],
    },
  },
  {
    id: 'names_search',
    name: 'names.search',
    method: 'GET',
    endpoint: '/api/names/search?q=007',
    auth: 'Public',
    summary: 'Check handle pricing, live auctions, and civic locks.',
  },
  {
    id: 'spatial_match',
    name: 'spatial.match',
    method: 'POST',
    endpoint: '/api/rfp/match',
    auth: 'BLE Geofence',
    summary: 'Evaluate 20m–50m physical passerby beacon handshake.',
    sampleBody: {
      userHandle: 'chris.moleme.agent',
      targetHandle: 'sandton.bistro.agent',
      locationLabel: 'Nicolway BLE 45m',
      distanceMeters: 28,
    },
  },
  {
    id: 'email_triage',
    name: 'comms.email_triage',
    method: 'POST',
    endpoint: '/api/email/triage',
    auth: 'OAuth2',
    summary: 'Classify inbound engage & trigger auto-counter or calendar hold.',
    sampleBody: {
      fromAddress: 'chris.moleme@switchboard.agent',
      toAddress: 'engage@ceo.woolworths.agent',
      subject: 'B2B Growth Proposal — R85,000',
      body: 'Full-stack B2B lead gen suite for R85,000 with 16% discount.',
      targetMinDiscountPct: 14,
      minExecMeetingValueZAR: 25000,
    },
  },
  {
    id: 'voice_turn',
    name: 'voice.dial_or_sos',
    method: 'POST',
    endpoint: '/api/voice/turn',
    auth: 'Civic / Bearer',
    summary: 'Send voice/SOS turn to any agent line or 911.emergency.agent.',
    sampleBody: {
      targetHandle: 'chris.moleme.agent',
      dialedNumber: '+27 83 338 4670',
      userMessage: 'Book a B2B lead gen discovery call tomorrow morning.',
      isEmergency: false,
      gpsCoords: { lat: -26.1041, lng: 28.0512 },
    },
  },
  {
    id: 'poppy_discovery',
    name: 'poppy.discovery',
    method: 'GET',
    endpoint: '/.well-known/poppy.json',
    auth: 'Public',
    summary: 'Inspect Personal Agent Protocol v1.0 discovery manifest & 6 extensions.',
  },
  {
    id: 'poppy_tasks',
    name: 'poppy.tasks',
    method: 'GET',
    endpoint: '/api/poppy/tasks',
    auth: 'Public',
    summary: 'Inspect Poppy §9 excluded_tasks, compliant alternatives & feedback URL.',
  },
  {
    id: 'recruitment_match',
    name: 'recruitment.match',
    method: 'POST',
    endpoint: '/api/recruitment/match',
    auth: 'Poppy OAuth2',
    summary: 'Run explainable multi-signal CV-to-Job matching with blind mode support.',
    sampleBody: {
      job: {
        id: 'job_woolies_growth_01',
        companyName: 'Woolworths Holdings SA',
        title: 'Head of Agentic Growth',
        remoteMode: 'Hybrid',
        salaryRangeZAR: [95000, 135000],
        requiredSkills: ['B2B Lead Generation', 'Growth Automation', 'SQL'],
        minYearsExp: 6,
      },
      seeker: {
        handle: 'chris.moleme.agent',
        displayName: 'Chris Moleme',
        skills: ['B2B Lead Generation', 'Full Stack Marketing', 'Growth Automation', 'SQL'],
        yearsExp: 8,
        salaryMinZAR: 85000,
        blindScreening: false,
      },
    },
  },
];

export const AgentSkillsPage: React.FC = () => {
  const [selectedSkill, setSelectedSkill] = useState<SkillSpec>(SWITCHBOARD_SKILLS[0]);
  const [liveOutput, setLiveOutput] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://switchboard.agent';

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    emitToast('Copied to clipboard', 'success');
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const executeSkill = async (skill: SkillSpec) => {
    setSelectedSkill(skill);
    setRunning(true);
    setLiveOutput('');
    try {
      const res = await fetch(skill.endpoint, {
        method: skill.method,
        headers: skill.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: skill.method === 'POST' ? JSON.stringify(skill.sampleBody || {}) : undefined,
      });
      const data = await res.json();
      setLiveOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      setLiveOutput(JSON.stringify({ error: err instanceof Error ? err.message : 'Request failed' }, null, 2));
    } finally {
      setRunning(false);
    }
  };

  const curlSnippet =
    selectedSkill.method === 'GET'
      ? `curl -s "${origin}${selectedSkill.endpoint}"`
      : `curl -s -X POST "${origin}${selectedSkill.endpoint}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(selectedSkill.sampleBody || {})}'`;

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-display font-bold text-zinc-950 dark:text-zinc-50 truncate">
              Agent Skills &amp; Discovery
            </h2>
            <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
              {origin}/skills.md
            </p>
          </div>
        </div>

        <SwipeScrollArea direction="horizontal" className="w-full sm:w-auto max-w-full" innerClassName="flex items-center gap-1.5">
          {[
            { id: 'poppy_json', label: 'poppy.json', path: '/.well-known/poppy.json' },
            { id: 'skills_idx', label: 'skills-index', path: '/.well-known/agent-skills/index.json' },
            { id: 'skills_md', label: '/skills.md', path: '/skills.md' },
            { id: 'api_skills', label: '/api/skills', path: '/api/skills' },
            { id: 'skill_json', label: 'OpenAPI', path: '/api/skill.json' },
            { id: 'well_known', label: 'agent.json', path: '/.well-known/agent.json' },
          ].map((item) => (
            <div key={item.id} className="inline-flex items-center rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 overflow-hidden shrink-0">
              <a
                href={item.path}
                target="_blank"
                rel="noreferrer"
                className="min-h-[34px] px-2.5 text-[11px] font-mono font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 whitespace-nowrap"
              >
                <FileCode2 className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                {item.label}
                <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
              </a>
              <button
                type="button"
                onClick={() => copyText(item.id, `${origin}${item.path}`)}
                className="min-h-[34px] px-2 border-l border-zinc-300 dark:border-white/15 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                aria-label={`Copy ${item.path}`}
              >
                {copiedKey === item.id ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          ))}
        </SwipeScrollArea>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-5 glass-panel rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-display font-bold text-zinc-950 dark:text-zinc-100">Skills ({SWITCHBOARD_SKILLS.length})</span>
            <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> MCP Ready
            </span>
          </div>

          <SwipeScrollArea direction="vertical" className="max-h-[360px]" innerClassName="space-y-1.5 pr-1">
            {SWITCHBOARD_SKILLS.map((skill) => {
              const active = selectedSkill.id === skill.id;
              return (
                <div
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  className={`rounded-xl p-3 border cursor-pointer transition-colors ${
                    active
                      ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-400 dark:border-white/25'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                          skill.method === 'GET'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-400/25 dark:text-emerald-300'
                            : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-500/15 dark:border-amber-400/25 dark:text-amber-300'
                        }`}
                      >
                        {skill.method}
                      </span>
                      <span className="text-xs font-mono font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                        {skill.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        executeSkill(skill);
                      }}
                      className="w-8 h-8 rounded-lg bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-white shrink-0 transition-colors"
                      aria-label={`Run ${skill.name}`}
                      title="Run Live"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 truncate">{skill.summary}</p>
                </div>
              );
            })}
          </SwipeScrollArea>
        </div>

        <div className="lg:col-span-7 glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                {selectedSkill.method} {selectedSkill.endpoint}
              </p>
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50">{selectedSkill.name}</h3>
            </div>
            <button
              type="button"
              disabled={running}
              onClick={() => executeSkill(selectedSkill)}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-50 px-3.5 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 shrink-0 whitespace-nowrap transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {running ? 'Running...' : 'Test'}
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => copyText('curl', curlSnippet)}
              className="absolute right-2 top-2 p-1.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white z-10"
              aria-label="Copy cURL"
            >
              {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <SwipeScrollArea direction="horizontal" showArrows={true}>
              <pre className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 pr-10 text-[11px] font-mono text-zinc-900 dark:text-zinc-200 whitespace-pre">
                {curlSnippet}
              </pre>
            </SwipeScrollArea>
          </div>

          {running ? (
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-4 space-y-2.5">
              <div className="skeleton-line h-3 w-1/2" />
              <div className="skeleton-line h-3 w-4/5" />
              <div className="skeleton-line h-3 w-2/3" />
            </div>
          ) : (
            <SwipeScrollArea direction="vertical" className="max-h-[220px]">
              <pre className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 text-[11px] font-mono text-zinc-900 dark:text-emerald-300 whitespace-pre-wrap">
                {liveOutput || 'Tap Test to inspect live JSON response.'}
              </pre>
            </SwipeScrollArea>
          )}

          <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 px-3 py-2 text-xs">
            <span className="font-mono text-zinc-800 dark:text-zinc-300 truncate flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              {origin}/skills.md
            </span>
            <button
              type="button"
              onClick={() => copyText('prompt', `${origin}/skills.md`)}
              className="text-sky-700 dark:text-sky-400 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 shrink-0 text-[11px] font-medium"
            >
              {copiedKey === 'prompt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copy URL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
