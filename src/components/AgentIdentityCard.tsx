import React from 'react';
import {
  Phone,
  Globe,
  Wifi,
  ShieldCheck,
  Calendar,
  MapPin,
  Radio,
  ArrowUpRight,
  Mail,
  RotateCw,
  Copy,
  Check,
  Video,
} from 'lucide-react';
import {
  AgentDoc,
  BookingDoc,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';

interface AgentIdentityCardProps {
  agent: AgentDoc;
  bookings: BookingDoc[];
  currency: CurrencyMode;
  flipped: boolean;
  isActive?: boolean;
  onFlipToggle: () => void;
  onPitch: (agent: AgentDoc) => void;
  onDial: (agent: AgentDoc) => void;
  onEmail: (agent: AgentDoc) => void;
  onToggleDiscoverable: (agentId: string) => void;
  onOpenVideoStudio?: (agent: AgentDoc) => void;
}

/** Deterministic crisp SVG QR matrix seeded from agent handle/endpoint */
const DeterministicQrSvg: React.FC<{ seed: string }> = ({ seed }) => {
  const size = 21;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinder = (r: number, c: number) => {
    const inTopLeft = r < 7 && c < 7;
    const inTopRight = r < 7 && c >= size - 7;
    const inBottomLeft = r >= size - 7 && c < 7;
    if (!inTopLeft && !inTopRight && !inBottomLeft) return null;
    const lr = r >= size - 7 ? r - (size - 7) : r;
    const lc = c >= size - 7 ? c - (size - 7) : c;
    if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
    if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
    return false;
  };

  const cells: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const finder = isFinder(r, c);
      if (finder === true) {
        cells.push({ r, c });
      } else if (finder === null) {
        const bit = ((hash ^ (r * 31 + c * 17) ^ ((r + 3) * (c + 5))) >>> 0) % 11;
        if (bit < 5) cells.push({ r, c });
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-12 h-12 sm:w-14 sm:h-14 rounded bg-white p-0.5 border border-slate-200 shadow-xs"
      aria-label={`Agent Handshake QR for ${seed}`}
    >
      <rect width={size} height={size} fill="#ffffff" />
      {cells.map((cell) => (
        <rect
          key={`${cell.r}-${cell.c}`}
          x={cell.c}
          y={cell.r}
          width={0.92}
          height={0.92}
          fill="#0f172a"
        />
      ))}
    </svg>
  );
};

/** Clean illustrated vector portraits for personal human agents */
const PersonaPortraitSvg: React.FC<{ variant?: AgentDoc['avatarVariant']; initials: string }> = ({
  variant,
  initials,
}) => {
  const palette =
    variant === 'chris'
      ? { bg: '#E2E8F0', skin: '#6F4533', suit: '#1D4ED8', shirt: '#0F172A', hair: '#1E1B18' }
      : variant === 'thandi'
      ? { bg: '#E0F2FE', skin: '#7C4B36', suit: '#0F766E', shirt: '#F8FAFC', hair: '#18181B' }
      : variant === 'alex'
      ? { bg: '#E2E8F0', skin: '#5E3828', suit: '#1E293B', shirt: '#0EA5E9', hair: '#171717' }
      : { bg: '#E2E8F0', skin: '#7C533D', suit: '#1E40AF', shirt: '#E2E8F0', hair: '#1E293B' };

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-label={initials}>
      <rect width="100" height="100" fill={palette.bg} />
      <circle cx="50" cy="48" r="46" fill={palette.bg} />
      <path d="M16 102 C18 74, 34 68, 50 68 C66 68, 82 74, 84 102 Z" fill={palette.suit} />
      <path d="M40 68 L50 86 L60 68 Z" fill={palette.shirt} />
      <rect x="43" y="54" width="14" height="16" rx="6" fill={palette.skin} />
      <ellipse cx="50" cy="40" rx="16.5" ry="19.5" fill={palette.skin} />
      {variant === 'thandi' ? (
        <path
          d="M32 39 C31 22, 42 15, 50 15 C58 15, 69 22, 68 39 C65 28, 58 24, 50 24 C42 24, 35 28, 32 39 Z"
          fill={palette.hair}
        />
      ) : (
        <path
          d="M34 34 C34 21, 41 18, 50 18 C59 18, 66 21, 66 34 C61 27, 39 27, 34 34 Z"
          fill={palette.hair}
          opacity="0.88"
        />
      )}
      <circle cx="44" cy="40" r="1.6" fill="#18100C" />
      <circle cx="56" cy="40" r="1.6" fill="#18100C" />
      <path
        d="M45 48 Q50 51 55 48"
        fill="none"
        stroke="#2C1810"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** Crisp corporate emblem/logo mark for Business Agents */
const BusinessLogoEmblem: React.FC<{ agent: AgentDoc; size?: 'sm' | 'lg' }> = ({
  agent,
  size = 'lg',
}) => {
  const code = agent.brandLogoCode || agent.displayName.slice(0, 2).toUpperCase();
  const bg = agent.brandColor || '#0F172A';
  const isEmergency = agent.handle === '911.emergency.agent';

  if (size === 'sm') {
    return (
      <div
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-display font-bold text-xs text-white shadow-sm border border-white/25"
        style={{ backgroundColor: bg }}
      >
        {code.slice(0, 3)}
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-white relative overflow-hidden"
      style={{ backgroundColor: bg }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d="M10 50 H90 M50 10 V90" stroke="white" strokeWidth="0.7" />
      </svg>
      <span
        className={`font-display font-extrabold tracking-tight relative z-10 ${
          code.length >= 3 ? 'text-lg' : 'text-2xl'
        } text-white`}
      >
        {code}
      </span>
      <span className="text-[7.5px] font-mono tracking-widest uppercase text-white/80 relative z-10 mt-0.5">
        {isEmergency ? 'CIVIC SOS' : 'VERIFIED'}
      </span>
    </div>
  );
};

export const AgentIdentityCard: React.FC<AgentIdentityCardProps> = ({
  agent,
  bookings,
  currency,
  flipped,
  isActive = true,
  onFlipToggle,
  onPitch,
  onDial,
  onEmail,
  onToggleDiscoverable,
  onOpenVideoStudio,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const isPersona = agent.type === 'persona';
  const isEmergency = agent.handle === '911.emergency.agent';

  const handleBase = agent.handle.replace('.agent', '');
  const didValue =
    agent.did ||
    (isPersona
      ? `did:linkedin:${handleBase.replace(/\./g, '')}-agent-v1`
      : `did:web:${agent.websiteUrl || handleBase + '.co.za'}:agent-v1`);
  const protocolValue = agent.protocol || 'Poppy v1.0 / A2A / MCP';
  const endpointValue = agent.interactEndpoint || agent.mcpEndpoint;
  const authValue = agent.authMethods || 'OAuth2 / Bearer / Public-Key';
  const linkedinOrWeb = isPersona
    ? agent.linkedinUrl || `linkedin.com/in/${handleBase.replace(/\./g, '')}`
    : agent.websiteUrl || `${handleBase.replace(/\./g, '')}.co.za`;
  const poppyPath = isPersona
    ? `/u/${handleBase}/.well-known/poppy.json`
    : `/companies/${handleBase}/.well-known/poppy.json`;

  const agentBookings = bookings.filter(
    (b) => b.organizerHandle === agent.handle || b.attendeeHandle === agent.handle
  );

  const headerGradient = isPersona
    ? 'linear-gradient(135deg, #0B4C84 0%, #06325C 100%)'
    : isEmergency
    ? 'linear-gradient(135deg, #9F1239 0%, #4C0519 100%)'
    : `linear-gradient(135deg, ${agent.brandColor || '#0F172A'} 0%, #07192E 100%)`;

  const capabilitySlugs = agent.skills.slice(0, 3).map((s) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  );

  const copyText = (e: React.MouseEvent, key: string, value: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1600);
  };

  const summaryText =
    agent.summary ||
    agent.passerbyIncentive ||
    (isPersona
      ? `${agent.roleTitle} at ${agent.organization}.`
      : `${agent.organization} automated agent desk.`);

  return (
    <div className="w-full max-w-[376px] sm:max-w-[360px] mx-auto perspective-1200 select-none">
      <div
        className={`relative w-full h-[364px] sm:h-[416px] preserve-3d ${
          flipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* FRONT FACE */}
        <div
          aria-hidden={flipped}
          className={`absolute inset-0 backface-hidden rounded-[22px] overflow-hidden shadow-2xl border flex flex-col justify-between transition-colors ${
            isActive
              ? isEmergency
                ? 'border-rose-400/60 shadow-rose-950/50'
                : 'border-sky-300/40 shadow-sky-950/60'
              : 'border-slate-700/60'
          }`}
          style={{
            backgroundColor: '#073763',
            pointerEvents: flipped ? 'none' : 'auto',
          }}
        >
          {/* TOP HEADER BANNER */}
          <div
            className="relative h-[52px] sm:h-[64px] px-3 pt-2 flex items-start justify-between overflow-hidden shrink-0"
            style={{ background: headerGradient }}
          >
            <svg
              className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
              viewBox="0 0 360 110"
              preserveAspectRatio="none"
            >
              <path
                d="M 0 32 H 75 L 95 52 H 150 M 210 26 H 280 L 305 50 H 360 M 20 82 H 95 L 118 65"
                fill="none"
                stroke="#7DD3FC"
                strokeWidth="1.2"
              />
              <circle cx="150" cy="52" r="3" fill="#7DD3FC" />
              <circle cx="210" cy="26" r="3" fill="#7DD3FC" />
              <circle cx="118" cy="65" r="2.5" fill="#7DD3FC" />
            </svg>

            <span className="relative z-10 px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-sm border border-white/20 text-[9px] font-semibold tracking-wider text-white uppercase">
              {isPersona ? 'AI AGENT IDENTITY' : isEmergency ? 'CIVIC SOS' : 'BUSINESS AGENT'}
            </span>

            {/* Top-Right Badge */}
            <div className="relative z-10">
              {isPersona ? (
                <a
                  href={`https://${linkedinOrWeb}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-white flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
                  title={linkedinOrWeb}
                >
                  <span className="font-display font-extrabold text-sm sm:text-base leading-none text-[#0A66C2]">
                    in
                  </span>
                </a>
              ) : (
                <BusinessLogoEmblem agent={agent} size="sm" />
              )}
            </div>
          </div>

          {/* WHITE BODY SECTION WITH OVERLAPPING AVATAR / LOGO */}
          <div className="relative bg-white text-slate-900 rounded-b-[18px] px-3.5 pt-7 sm:pt-9 pb-2 shadow-md flex-1 min-h-0 flex flex-col justify-between">
            <div className="absolute -top-7 sm:-top-8 left-1/2 -translate-x-1/2 w-[56px] h-[56px] sm:w-[68px] sm:h-[68px] rounded-full p-0.5 bg-white shadow-lg">
              <div
                className="w-full h-full rounded-full overflow-hidden border-[2.5px]"
                style={{ borderColor: isPersona ? '#0B4C84' : agent.brandColor || '#0F172A' }}
              >
                {isPersona ? (
                  <PersonaPortraitSvg
                    variant={agent.avatarVariant}
                    initials={agent.displayName.slice(0, 2).toUpperCase()}
                  />
                ) : (
                  <BusinessLogoEmblem agent={agent} size="lg" />
                )}
              </div>
            </div>

            {/* Name, Subtitle & Brief Summary */}
            <div className="text-center">
              <h3 className="font-display text-[16px] sm:text-[18px] font-extrabold text-slate-950 leading-tight tracking-tight truncate">
                {agent.displayName}
              </h3>
              <p
                className="text-[11px] font-semibold mt-0.5 truncate"
                style={{
                  color: isPersona ? '#0A66C2' : isEmergency ? '#BE123C' : agent.brandColor || '#0B4C84',
                }}
              >
                {agent.roleTitle}
              </p>
              <p className="text-[10.5px] sm:text-[11px] text-slate-600 leading-snug mt-0.5 line-clamp-2 px-1">
                {summaryText}
              </p>
            </div>

            {/* Info + QR Code Split */}
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDial(agent);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 hover:text-[#0A66C2] text-left w-full"
                >
                  <Phone className="w-3 h-3 text-[#0B4C84] shrink-0" />
                  <span className="truncate font-mono tabular-nums">{agent.voiceNumber}</span>
                </button>

                <a
                  href={`https://${linkedinOrWeb}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 hover:text-[#0A66C2] w-full"
                >
                  {isPersona ? (
                    <span className="w-3.5 h-3.5 rounded-[3px] bg-[#0A66C2] text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                      in
                    </span>
                  ) : (
                    <Globe className="w-3 h-3 text-[#0B4C84] shrink-0" />
                  )}
                  <span className="truncate">{linkedinOrWeb}</span>
                </a>

                <div className="pt-0.5 flex flex-wrap gap-1">
                  {agent.skills.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="inline-block max-w-full truncate rounded-md bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right QR + NFC Handshake Block */}
              <button
                type="button"
                onClick={(e) => copyText(e, 'qr', endpointValue)}
                className="flex flex-col items-center shrink-0 group cursor-pointer"
                title="Copy endpoint"
              >
                <DeterministicQrSvg seed={agent.handle} />
                <div className="mt-0.5 flex items-center gap-0.5 text-[8px] font-bold tracking-tight text-slate-800 leading-tight text-center">
                  <Wifi className="w-2.5 h-2.5 rotate-90 text-slate-900 shrink-0" />
                  <span>
                    {copiedField === 'qr' ? (
                      <span className="text-emerald-700">COPIED</span>
                    ) : (
                      <>SCAN / NFC</>
                    )}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* DARK NAVY PROTOCOL & ENDPOINTS FOOTER */}
          <div
            className="px-2.5 pt-1.5 pb-1.5 shrink-0"
            style={{
              background: isEmergency
                ? 'linear-gradient(180deg, #4C0519 0%, #310412 100%)'
                : 'linear-gradient(180deg, #073763 0%, #042545 100%)',
            }}
          >
            <div className="rounded-xl bg-[#0D1B2E]/95 border border-sky-300/20 overflow-hidden shadow-inner">
              <div className="px-2.5 py-0.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <span className="text-[8.5px] font-semibold tracking-wider text-slate-200 uppercase">
                  AGENT PROTOCOL &amp; ENDPOINTS
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFlipToggle();
                  }}
                  className="text-[9.5px] font-mono text-cyan-300 hover:text-white inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10"
                  aria-label="Flip card"
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  <span>Specs</span>
                </button>
              </div>

              <div className="px-2 py-1.5 space-y-0.5 font-mono text-[9px] sm:text-[9.5px] leading-tight text-slate-200">
                <div className="flex gap-1.5">
                  <span className="text-sky-300 shrink-0">agent_id:</span>
                  <span className="truncate text-white">{didValue}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-sky-300 shrink-0">protocol:</span>
                  <span className="truncate text-slate-200">{protocolValue}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-sky-300 shrink-0">endpoint:</span>
                  <span className="truncate text-emerald-300">{endpointValue}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-sky-300 shrink-0">skills:</span>
                  <span className="truncate text-amber-200">
                    [{capabilitySlugs.map((c) => `"${c}"`).join(', ')}]
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-sky-300 shrink-0">auth:</span>
                  <span className="truncate text-slate-200">{authValue}</span>
                </div>
              </div>
            </div>

            <p className="mt-1 text-center text-[9.5px] italic text-sky-100/85 truncate">
              {agent.tagline ||
                (isPersona
                  ? 'Human-verified identity. Agent-ready interface.'
                  : 'Enterprise-verified identity. Agent-ready commerce.')}
            </p>
          </div>
        </div>

        {/* BACK FACE (Smoothly rotated 180deg) */}
        <div
          aria-hidden={!flipped}
          className={`absolute inset-0 backface-hidden rotate-y-180 rounded-[24px] glass-panel border ${
            isEmergency ? 'border-rose-500/50' : 'border-cyan-400/35'
          } shadow-2xl overflow-hidden flex flex-col justify-between p-4 text-left`}
          style={{
            pointerEvents: flipped ? 'auto' : 'none',
          }}
        >
          {/* Back Header */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800 shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-cyan-300 truncate">{agent.handle}</p>
              <h3 className="text-sm sm:text-base font-semibold text-white truncate">{agent.displayName}</h3>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFlipToggle();
              }}
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:border-cyan-400 flex items-center justify-center shrink-0"
              title="Flip to Front"
              aria-label="Flip to Front"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Middle Spec Content (prevents clipping on short phones) */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2.5 space-y-2.5">
            {(agent.summary || agent.passerbyIncentive) && (
              <p className="text-xs text-slate-300 leading-relaxed">
                {agent.summary || agent.passerbyIncentive}
              </p>
            )}

            {/* Clean Typographic Metric Grid (minimal boxed clutter) */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 py-2 border-y border-slate-800/80 text-[11px]">
              <div>
                <span className="text-slate-400 block">Auto-Spend Cap</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-300">
                  {isEmergency ? 'CIVIC FREE' : formatMoney(agent.guardrails.maxAutoSpendZAR, currency)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Min Discount</span>
                <span className="font-mono tabular-nums font-semibold text-amber-300">
                  {agent.guardrails.minDiscountPct}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Hours
                </span>
                <span className="font-mono text-slate-200">
                  {agent.guardrails.workingHoursSAST || '08:00-17:00'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Compliance
                </span>
                <span className="text-emerald-300 font-medium">
                  {agent.popiaConsentActive ? 'POPIA Verified' : 'Standard'}
                </span>
              </div>
            </div>

            {/* Presence & BLE Toggle */}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-300 inline-flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{agent.geoLocation?.label || 'Sandton Corridor'}</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDiscoverable(agent.id);
                }}
                className={`min-h-[34px] px-3 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors ${
                  agent.discoverableByPassersby
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-slate-900 text-slate-400 border border-slate-700'
                }`}
              >
                <Radio className="w-3 h-3" />
                {agent.discoverableByPassersby ? 'Beacon Live' : 'Off'}
              </button>
            </div>

            {/* Poppy Discovery Route */}
            <div className="flex items-center justify-between gap-2 text-[10.5px] pt-1 border-t border-slate-800/60">
              <div className="min-w-0">
                <span className="text-slate-400 block font-medium">
                  Poppy v1.0 · {agent.agentRoleCategory || (isPersona ? 'job_seeker' : 'commerce')}
                </span>
                <a
                  href={poppyPath}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-cyan-300 hover:underline truncate block"
                >
                  {poppyPath}
                </a>
              </div>
              <span className="font-mono text-[10px] text-emerald-300 shrink-0">
                {agent.poppyScopes?.length || 2} scopes
              </span>
            </div>

            {/* Verified Video + 1-Tap Video Studio Jump */}
            {(agent.interviewVideo || (isPersona && onOpenVideoStudio)) && (
              <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-2.5 flex items-center justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <span
                    className={`inline-flex items-center gap-1.5 font-medium truncate ${
                      agent.interviewVideo
                        ? agent.interviewVideo.verification.verdict === 'VERIFIED_HUMAN'
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                        : 'text-slate-300'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5 shrink-0" />
                    {agent.interviewVideo
                      ? agent.interviewVideo.verification.verdict === 'VERIFIED_HUMAN'
                        ? `Video Real (${agent.interviewVideo.verification.authenticityScore}%)`
                        : `Deepfake Risk (${agent.interviewVideo.verification.deepfakeRiskPct}%)`
                      : 'Video Screening Studio'}
                  </span>
                  {agent.interviewVideo && (
                    <span className="block font-mono text-[10px] text-slate-400">
                      {agent.interviewVideo.preScreenReviews.length} pre-screen(s)
                    </span>
                  )}
                </div>
                {onOpenVideoStudio && isPersona && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenVideoStudio(agent);
                    }}
                    className="min-h-[32px] px-2.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-semibold text-[10.5px] hover:bg-cyan-500/30 shrink-0"
                  >
                    Open Video
                  </button>
                )}
              </div>
            )}

            {agentBookings.length > 0 && (
              <div className="text-xs pt-1 border-t border-slate-800/60">
                <p className="font-medium text-white truncate">{agentBookings[0].title}</p>
                <p className="text-[10.5px] font-mono text-slate-400 mt-0.5">
                  Next Call ·{' '}
                  {new Date(agentBookings[0].startTime).toLocaleString('en-ZA', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Back Actions Footer */}
          <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPitch(agent);
              }}
              className="col-span-2 min-h-[44px] rounded-xl bg-cyan-400 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-1 hover:bg-cyan-300"
            >
              Pitch <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDial(agent);
              }}
              className={`min-h-[44px] rounded-xl font-semibold text-xs flex items-center justify-center ${
                isEmergency
                  ? 'bg-rose-500 text-white hover:bg-rose-400'
                  : 'bg-slate-800 text-white hover:bg-slate-700'
              }`}
              aria-label="Dial"
              title="Dial"
            >
              <Phone className="w-4 h-4" />
            </button>
            {!isEmergency ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEmail(agent);
                }}
                className="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 text-slate-200 flex items-center justify-center hover:border-cyan-400"
                aria-label="Email"
                title="Email"
              >
                <Mail className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => copyText(e, 'did', didValue)}
                className="min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 text-slate-200 flex items-center justify-center hover:border-cyan-400"
                aria-label="Copy DID"
                title="Copy DID"
              >
                {copiedField === 'did' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
