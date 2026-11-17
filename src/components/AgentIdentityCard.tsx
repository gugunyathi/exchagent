import React from 'react';
import { createPortal } from 'react-dom';
import {
  Phone,
  Globe,
  Wifi,
  ShieldCheck,
  Radio,
  ArrowUpRight,
  Mail,
  RotateCw,
  Copy,
  Check,
  Video,
  Zap,
  ShieldAlert,
  Palette,
  BookmarkPlus,
  History,
  Users,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Images,
} from 'lucide-react';
import {
  AgentDoc,
  BookingDoc,
  CurrencyMode,
  formatMoney,
  CardBannerStyle,
  CardBackgroundPattern,
} from '../types/firestore';
import { emitToast } from '../lib/toast';
import { resolveAgentImage, resolveAgentMediaGallery } from '../lib/agentImages';
import { AgentMediaGalleryModal } from './AgentMediaGalleryModal';

/** Square full-screen expand & exit icons matching the reference square frame geometry */
const SquareExpandIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="2.5" y="2.5" width="19" height="19" rx="3" />
    <path d="M14.5 6.5h3v3" />
    <path d="M17.5 6.5l-4.2 4.2" />
    <path d="M9.5 17.5h-3v-3" />
    <path d="M6.5 17.5l4.2-4.2" />
  </svg>
);

const SquareExitFullScreenIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.1"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="2.5" y="2.5" width="19" height="19" rx="3" />
    <path d="M14 10h3.5" />
    <path d="M14 10V6.5" />
    <path d="M14 10l4-4" />
    <path d="M10 14H6.5" />
    <path d="M10 14v3.5" />
    <path d="M10 14l-4 4" />
  </svg>
);

interface AgentIdentityCardProps {
  agent: AgentDoc;
  bookings: BookingDoc[];
  currency: CurrencyMode;
  flipped: boolean;
  isActive?: boolean;
  onFlipToggle: () => void;
  onEngage: (agent: AgentDoc) => void;
  onDial: (agent: AgentDoc) => void;
  onEmail: (agent: AgentDoc) => void;
  onToggleDiscoverable: (agentId: string) => void;
  onOpenVideoStudio?: (agent: AgentDoc) => void;
  onCustomize?: (agent: AgentDoc) => void;
  onSaveContact?: (agent: AgentDoc) => void;
  isSavedContact?: boolean;
  onOpenProfileHistory?: (agent: AgentDoc) => void;
  onOpenCompanyHr?: (agent: AgentDoc) => void;
  onUpdateAgentMedia?: (updated: AgentDoc) => void;
}

/** Deterministic crisp SVG QR matrix seeded from agent handle */
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
      className="w-10 h-10 sm:w-11 sm:h-11 rounded-md bg-white p-0.5 border border-zinc-300"
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
          fill="#09090b"
        />
      ))}
    </svg>
  );
};

/** Clean vector portrait for human personas */
const PersonaPortraitSvg: React.FC<{ variant?: AgentDoc['avatarVariant']; initials: string }> = ({
  variant,
  initials,
}) => {
  const palette =
    variant === 'chris'
      ? { bg: '#E4E4E7', skin: '#6F4533', suit: '#18181B', shirt: '#3F3F46', hair: '#18181B' }
      : variant === 'thandi'
      ? { bg: '#E0F2FE', skin: '#7C4B36', suit: '#0F766E', shirt: '#F8FAFC', hair: '#18181B' }
      : variant === 'alex'
      ? { bg: '#E4E4E7', skin: '#5E3828', suit: '#27272A', shirt: '#0EA5E9', hair: '#171717' }
      : { bg: '#E4E4E7', skin: '#7C533D', suit: '#1E293B', shirt: '#F4F4F5', hair: '#18181B' };

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
          opacity="0.9"
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

const BusinessLogoEmblem: React.FC<{ agent: AgentDoc; size?: 'sm' | 'lg' }> = ({
  agent,
  size = 'lg',
}) => {
  const code = agent.brandLogoCode || agent.displayName.slice(0, 2).toUpperCase();
  const bg = agent.brandColor || '#18181B';
  const isEmergency = agent.handle === '911.emergency.agent';

  if (size === 'sm') {
    return (
      <div
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center font-display font-bold text-[10px] text-white border border-white/20"
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
      <span
        className={`font-display font-bold tracking-tight relative z-10 ${
          code.length >= 3 ? 'text-base' : 'text-xl'
        } text-white`}
      >
        {code}
      </span>
      <span className="text-[7px] font-mono tracking-widest uppercase text-white/75 relative z-10 mt-0.5">
        {isEmergency ? 'SOS' : 'CORP'}
      </span>
    </div>
  );
};

/** Dynamic Banner Texture Motifs */
const BannerTextureOverlay: React.FC<{ style?: CardBannerStyle }> = ({ style }) => {
  if (!style || style === 'minimal') {
    return <div className="absolute bottom-0 inset-x-0 h-[1px] bg-white/20 pointer-events-none" />;
  }
  if (style === 'circuit') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 12 h30 l10 10 h40 M120 5 h30 l15 15 h50 M250 18 h25 l8 -8 h60" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="30" cy="12" r="2" fill="#fff" />
        <circle cx="80" cy="22" r="2" fill="#fff" />
        <circle cx="150" cy="5" r="2" fill="#fff" />
        <circle cx="275" cy="18" r="2" fill="#fff" />
      </svg>
    );
  }
  if (style === 'monogram') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-15" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="monogram-pat" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M12 0 L24 12 L12 24 L0 12 Z M12 4 L20 12 L12 20 L4 12 Z" fill="none" stroke="#fff" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#monogram-pat)" />
      </svg>
    );
  }
  if (style === 'geometric') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="geom-pat" width="32" height="20" patternUnits="userSpaceOnUse">
            <polygon points="0,0 16,20 32,0" fill="none" stroke="#fff" strokeWidth="0.8" />
            <polygon points="0,20 16,0 32,20" fill="none" stroke="#fff" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#geom-pat)" />
      </svg>
    );
  }
  if (style === 'mesh') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-6 -left-6 w-28 h-28 rounded-full bg-cyan-400/25 blur-xl" />
        <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-fuchsia-400/25 blur-xl" />
      </div>
    );
  }
  if (style === 'wave') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 200 40">
        <path d="M0 20 Q25 5, 50 20 T100 20 T150 20 T200 20" fill="none" stroke="#fff" strokeWidth="1.5" />
        <path d="M0 25 Q25 15, 50 25 T100 25 T150 25 T200 25" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.6" />
      </svg>
    );
  }
  if (style === 'horizon') {
    return <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/10 via-transparent to-black/35" />;
  }
  if (style === 'carbon') {
    return (
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 0, transparent 6px)',
        }}
      />
    );
  }
  // default gradient
  return <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-black/20 via-transparent to-white/15" />;
};

/** Dynamic Background Pattern Watermarks */
const CardBackgroundPatternOverlay: React.FC<{
  pattern?: CardBackgroundPattern;
  agentId: string;
}> = ({ pattern, agentId }) => {
  if (!pattern || pattern === 'none') return null;

  if (pattern === 'subtle-grid') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none text-zinc-950 dark:text-white opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`grid-pat-${agentId}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="currentColor" strokeWidth="0.75" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-pat-${agentId})`} />
      </svg>
    );
  }
  if (pattern === 'dots') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none text-zinc-950 dark:text-white opacity-[0.045]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`dot-pat-${agentId}`} width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#dot-pat-${agentId})`} />
      </svg>
    );
  }
  if (pattern === 'aurora') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full bg-sky-500/10 blur-2xl dark:bg-sky-500/15" />
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-violet-500/10 blur-2xl dark:bg-violet-500/15" />
      </div>
    );
  }
  if (pattern === 'topo') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.045] text-zinc-950 dark:text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" preserveAspectRatio="none">
        <path d="M0,50 Q75,100 150,40 T300,60 M0,110 Q75,160 150,100 T300,120 M0,170 Q75,220 150,160 T300,180 M0,230 Q75,280 150,220 T300,240" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  if (pattern === 'stripes') {
    return (
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] text-zinc-950 dark:text-white"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg, currentColor 0, currentColor 1px, transparent 0, transparent 8px)',
        }}
      />
    );
  }
  if (pattern === 'circuit') {
    return (
      <svg className="absolute top-0 right-0 w-36 h-36 pointer-events-none text-zinc-950 dark:text-white opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <path d="M36 0 v36 h36 v36 h64" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="36" cy="36" r="2.5" fill="currentColor" />
        <circle cx="72" cy="72" r="2.5" fill="currentColor" />
      </svg>
    );
  }
  return null;
};

export const AgentIdentityCard: React.FC<AgentIdentityCardProps> = ({
  agent,
  bookings,
  currency,
  flipped,
  isActive = true,
  onFlipToggle,
  onEngage,
  onDial,
  onEmail,
  onToggleDiscoverable,
  onOpenVideoStudio,
  onCustomize,
  onSaveContact,
  isSavedContact = false,
  onOpenProfileHistory,
  onOpenCompanyHr,
  onUpdateAgentMedia,
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [imgError, setImgError] = React.useState(false);
  const [isCardFullScreen, setIsCardFullScreen] = React.useState(false);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [galleryInitialIdx, setGalleryInitialIdx] = React.useState(0);
  const [cardVideoPlaying, setCardVideoPlaying] = React.useState(false);
  const [cardVideoMuted, setCardVideoMuted] = React.useState(true); // Default MUTE on card
  const [cardClipSec, setCardClipSec] = React.useState(0);

  const isPersona = agent.type === 'persona';
  const isEmergency = agent.handle === '911.emergency.agent';
  const cardStyle = agent.cardStyle;
  const picSrc = resolveAgentImage(agent);
  const mediaGallery = React.useMemo(() => resolveAgentMediaGallery(agent), [agent]);
  const shortVideoItem = React.useMemo(
    () =>
      mediaGallery.find((m) => m.kind === 'video') ||
      mediaGallery.find((m) => m.kind === 'motion_image') ||
      null,
    [mediaGallery]
  );

  React.useEffect(() => {
    setImgError(false);
    setCardVideoPlaying(false);
    setCardVideoMuted(true);
    setCardClipSec(0);
  }, [agent.id, agent.imageUrl, agent.introVideoUrl]);

  // 8-second max inline loop timer when playing a motion_image preview on card
  React.useEffect(() => {
    if (!cardVideoPlaying || !shortVideoItem || shortVideoItem.kind === 'video') return;
    const t = window.setInterval(() => {
      setCardClipSec((prev) => {
        const next = prev + 0.1;
        return next >= 8 ? 0 : Number(next.toFixed(1));
      });
    }, 100);
    return () => window.clearInterval(t);
  }, [cardVideoPlaying, shortVideoItem]);

  React.useEffect(() => {
    if (!isCardFullScreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !galleryOpen) {
        e.preventDefault();
        setIsCardFullScreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCardFullScreen, galleryOpen]);

  const handleBase = agent.handle.replace('.agent', '');
  const didValue =
    agent.did ||
    (isPersona
      ? `did:linkedin:${handleBase.replace(/\./g, '')}-agent-v1`
      : `did:web:${agent.websiteUrl || handleBase + '.co.za'}:agent-v1`);
  const protocolValue = agent.protocol || 'Poppy v1.0 · A2A · MCP';
  const endpointValue = agent.interactEndpoint || agent.mcpEndpoint;
  const authValue = agent.authMethods || 'OAuth2 · Bearer · Public-Key';
  const linkedinOrWeb = isPersona
    ? agent.linkedinUrl || `linkedin.com/in/${handleBase.replace(/\./g, '')}`
    : agent.websiteUrl || `${handleBase.replace(/\./g, '')}.co.za`;
  const poppyPath = isPersona
    ? `/u/${handleBase}/.well-known/poppy.json`
    : `/companies/${handleBase}/.well-known/poppy.json`;

  const agentBookings = bookings.filter(
    (b) => b.organizerHandle === agent.handle || b.attendeeHandle === agent.handle
  );

  const headerBg =
    cardStyle?.bannerBgColor ||
    (isEmergency
      ? '#881337'
      : isPersona
      ? '#18181b'
      : agent.brandColor || '#18181b');

  const bannerHeightClass =
    cardStyle?.bannerHeight === 'compact'
      ? 'h-11 sm:h-12'
      : cardStyle?.bannerHeight === 'tall'
      ? 'h-16 sm:h-18'
      : 'h-12 sm:h-14';

  const badgeFrameClass =
    cardStyle?.bannerBadgeStyle === 'pill'
      ? 'rounded-full bg-white/20 px-2.5 py-0.5 backdrop-blur-xs'
      : cardStyle?.bannerBadgeStyle === 'outline'
      ? 'rounded-md border border-white/40 px-2 py-0.5'
      : cardStyle?.bannerBadgeStyle === 'none'
      ? 'px-0 py-0'
      : 'rounded-md bg-white/10 border border-white/20 backdrop-blur-xs px-2 py-0.5';

  const bgTheme = cardStyle?.backgroundTheme || 'default';
  const surfaceThemeClass = {
    default: 'bg-white dark:bg-[#121215]',
    pearl: 'bg-zinc-50 dark:bg-[#16161a]',
    obsidian: 'bg-zinc-100 dark:bg-[#0c0c0e]',
    sapphire: 'bg-sky-50/50 dark:bg-[#081524]',
    emerald: 'bg-emerald-50/50 dark:bg-[#061812]',
    amber: 'bg-amber-50/50 dark:bg-[#1f1706]',
    amethyst: 'bg-purple-50/50 dark:bg-[#160c22]',
    cyber: 'bg-slate-50 dark:bg-[#0a0f1d]',
  }[bgTheme] || 'bg-white dark:bg-[#121215]';

  const edgeRadiusClass = cardStyle?.edgeRadius || 'rounded-2xl';
  const borderStyleKind = cardStyle?.borderStyle || 'hairline';
  const accentColor =
    cardStyle?.borderAccentColor ||
    cardStyle?.bannerBgColor ||
    agent.brandColor ||
    (isEmergency ? '#be123c' : '#0284c7');

  let borderClass = 'border border-zinc-300 dark:border-white/15';
  let borderStyleObj: React.CSSProperties = {};

  if (borderStyleKind === 'bold-accent') {
    borderClass = 'border-2';
    borderStyleObj = { borderColor: accentColor };
  } else if (borderStyleKind === 'cyber-glow') {
    borderClass = 'border';
    borderStyleObj = {
      borderColor: accentColor,
      boxShadow: `0 0 16px -2px ${accentColor}44`,
    };
  } else if (borderStyleKind === 'double') {
    borderClass = 'border-4 border-double';
    borderStyleObj = { borderColor: accentColor };
  } else if (borderStyleKind === 'dashed-tech') {
    borderClass = 'border-2 border-dashed';
    borderStyleObj = { borderColor: accentColor };
  } else if (borderStyleKind === 'frosted-glass') {
    borderClass = 'border border-white/50 dark:border-white/20 backdrop-blur-md shadow-lg';
  } else if (isEmergency) {
    borderClass = 'border border-rose-500/80';
  }

  const copyText = (e: React.MouseEvent, key: string, value: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    emitToast(`Copied ${label}`);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const summaryText =
    agent.summary ||
    agent.passerbyIncentive ||
    (isPersona
      ? `${agent.roleTitle} at ${agent.organization}.`
      : `${agent.organization} autonomous commerce desk.`);

  const renderCardBody = (expandedFull: boolean) => (
    <div
      className={`${
        expandedFull
          ? 'w-full max-w-[920px] h-[min(90dvh,640px)]'
          : 'w-full max-w-[376px] sm:max-w-[360px]'
      } mx-auto perspective-1200 select-none`}
    >
      <div
        className={`relative w-full ${
          expandedFull ? 'h-full' : 'h-[358px] sm:h-[404px]'
        } preserve-3d ${flipped ? 'rotate-y-180' : ''}`}
      >
        {/* FRONT FACE — High-contrast Tactile Editorial Business Card */}
        <div
          aria-hidden={flipped}
          className={`absolute inset-0 backface-hidden ${edgeRadiusClass} overflow-hidden shadow-lg dark:shadow-2xl flex flex-col justify-between ${surfaceThemeClass} text-zinc-950 dark:text-zinc-50 transition-all ${borderClass}`}
          style={{ ...borderStyleObj, pointerEvents: flipped ? 'none' : 'auto' }}
        >
          {/* Subtle Background Watermark Pattern */}
          <CardBackgroundPatternOverlay pattern={cardStyle?.backgroundPattern} agentId={`${expandedFull ? 'fs-' : ''}${agent.id}`} />

          {/* Personalized Top Accent Strip */}
          <div
            className={`relative ${expandedFull ? 'h-14 sm:h-16 px-5' : `${bannerHeightClass} px-3.5`} flex items-center justify-between shrink-0 overflow-hidden`}
            style={{ backgroundColor: headerBg }}
          >
            {/* Texture Motif */}
            <BannerTextureOverlay style={cardStyle?.bannerStyle} />

            <div className="relative z-10 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-zinc-100 uppercase ${badgeFrameClass}`}>
                {isEmergency ? (
                  <>
                    <ShieldAlert className="w-3 h-3 text-rose-300" />
                    Civic SOS
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    {agent.verified ? 'Verified' : 'Standard'}
                  </>
                )}
              </span>
            </div>

            <div className="relative z-10 flex items-center gap-1.5">
              {onSaveContact && !isEmergency && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveContact(agent);
                  }}
                  className={`w-6 h-6 rounded-md backdrop-blur-xs flex items-center justify-center transition-colors ${
                    isSavedContact
                      ? 'bg-emerald-500/80 text-white'
                      : 'bg-white/15 hover:bg-white/30 text-white'
                  }`}
                  title={isSavedContact ? 'Saved in Contacts' : 'Save to Personal Contacts'}
                  aria-label="Save to Personal Contacts"
                >
                  {isSavedContact ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                </button>
              )}

              {isPersona && onOpenProfileHistory && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfileHistory(agent);
                  }}
                  className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition-colors"
                  title="Agent History, CV & Cover Letter Docs (PDF/DOCX)"
                  aria-label="Open Agent History & Docs"
                >
                  <History className="w-3.5 h-3.5" />
                </button>
              )}

              {!isPersona && !isEmergency && onOpenCompanyHr && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCompanyHr(agent);
                  }}
                  className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition-colors"
                  title="HR Staff Portal: Top Appliers, Docs & History"
                  aria-label="Open HR Staff Portal"
                >
                  <Users className="w-3.5 h-3.5" />
                </button>
              )}

              {onCustomize && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCustomize(agent);
                  }}
                  className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition-colors"
                  title="Customize Card Style & Media"
                  aria-label="Customize Card Style"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
              )}

              {isActive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCardFullScreen((v) => !v);
                  }}
                  className="w-6 h-6 rounded-md bg-white/15 hover:bg-white/30 backdrop-blur-xs flex items-center justify-center text-white transition-colors"
                  title={expandedFull ? 'Exit Full Screen View' : 'Full Screen Card View'}
                  aria-label={expandedFull ? 'Exit Full Screen View' : 'Full Screen Card View'}
                >
                  {expandedFull ? (
                    <SquareExitFullScreenIcon className="w-3.5 h-3.5" />
                  ) : (
                    <SquareExpandIcon className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {isPersona ? (
                <a
                  href={`https://${linkedinOrWeb}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-6 h-6 rounded-md bg-white flex items-center justify-center shadow-xs hover:scale-105 transition-transform"
                  title={linkedinOrWeb}
                >
                  <span className="font-display font-bold text-xs leading-none text-[#0A66C2]">
                    in
                  </span>
                </a>
              ) : (
                <BusinessLogoEmblem agent={agent} size="sm" />
              )}
            </div>
          </div>

          {/* Card Core Content — Left Clickable Media/Video + Right Identity Details */}
          <div className={`relative z-10 ${expandedFull ? 'px-5 sm:px-7 py-4 sm:py-5 gap-4' : 'px-3.5 py-2.5 gap-2'} flex-1 min-h-0 flex flex-col justify-between`}>
            {/* Horizontal Split: Left Visual Frame + Right Text Stack */}
            <div className={`grid ${expandedFull ? 'grid-cols-[150px_1fr] sm:grid-cols-[240px_1fr] gap-5 sm:gap-6' : 'grid-cols-[106px_1fr] sm:grid-cols-[114px_1fr] gap-3'} flex-1 min-h-0 items-stretch`}>
              {/* Left Side: Clickable Portrait / Brand Media / 8s Intro Video Preview */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setGalleryInitialIdx(0);
                  setGalleryOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    setGalleryInitialIdx(0);
                    setGalleryOpen(true);
                  }
                }}
                title="Click to open Full-Screen Image & Video Gallery (Unmuted)"
                className="group/media relative h-full min-h-[146px] sm:min-h-[168px] rounded-xl overflow-hidden border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-zinc-900 shadow-xs cursor-pointer"
              >
                {cardVideoPlaying && shortVideoItem ? (
                  shortVideoItem.kind === 'video' ? (
                    <video
                      src={shortVideoItem.url}
                      poster={picSrc}
                      autoPlay
                      loop
                      playsInline
                      muted={cardVideoMuted}
                      onTimeUpdate={(e) => {
                        if (e.currentTarget.currentTime >= 8) {
                          e.currentTarget.currentTime = 0;
                        }
                        setCardClipSec(Number(Math.min(8, e.currentTarget.currentTime).toFixed(1)));
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={shortVideoItem.url}
                      alt={agent.displayName}
                      className={`w-full h-full object-cover animate-pulse transition-transform duration-1000 scale-110 ${
                        isPersona ? 'object-top' : 'object-center'
                      }`}
                    />
                  )
                ) : picSrc && !imgError ? (
                  <img
                    src={picSrc}
                    alt={agent.displayName}
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className={`w-full h-full object-cover group-hover/media:scale-[1.03] transition-transform duration-200 ${
                      isPersona ? 'object-top' : 'object-center'
                    }`}
                  />
                ) : isPersona ? (
                  <PersonaPortraitSvg
                    variant={agent.avatarVariant}
                    initials={agent.displayName.slice(0, 2).toUpperCase()}
                  />
                ) : (
                  <BusinessLogoEmblem agent={agent} size="lg" />
                )}

                {/* Subtle Bottom Scrim for Controls */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />

                {/* 8s Play Video & Mute Controls (Default Muted on Card) */}
                {shortVideoItem && (
                  <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardVideoPlaying((v) => !v);
                      }}
                      className="h-6 px-1.5 rounded-md bg-black/75 hover:bg-black text-white border border-white/20 inline-flex items-center gap-1 text-[9.5px] font-mono font-semibold transition-colors"
                      title={cardVideoPlaying ? 'Pause 8s preview' : 'Play 8s pitch / motion preview (muted)'}
                      aria-label={cardVideoPlaying ? 'Pause 8s preview' : 'Play 8s preview'}
                    >
                      {cardVideoPlaying ? (
                        <Pause className="w-2.5 h-2.5 fill-white" />
                      ) : (
                        <Play className="w-2.5 h-2.5 fill-white" />
                      )}
                      <span>{cardVideoPlaying ? `${cardClipSec.toFixed(0)}s` : '8s'}</span>
                    </button>

                    {cardVideoPlaying && shortVideoItem.kind === 'video' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardVideoMuted((m) => !m);
                        }}
                        className="w-6 h-6 rounded-md bg-black/75 hover:bg-black text-white border border-white/20 inline-flex items-center justify-center"
                        title={cardVideoMuted ? 'Unmute card preview' : 'Mute card preview'}
                        aria-label={cardVideoMuted ? 'Unmute' : 'Mute'}
                      >
                        {cardVideoMuted ? (
                          <VolumeX className="w-2.5 h-2.5" />
                        ) : (
                          <Volume2 className="w-2.5 h-2.5" />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Scrollable Gallery Count Indicator */}
                {mediaGallery.length > 1 && (
                  <span
                    className="absolute bottom-1.5 right-1.5 z-10 h-6 px-1.5 rounded-md bg-black/75 text-white border border-white/20 inline-flex items-center gap-1 text-[9.5px] font-mono tabular-nums pointer-events-none"
                    title="Open scrollable gallery"
                  >
                    <Images className="w-2.5 h-2.5" />
                    <span>{mediaGallery.length}</span>
                  </span>
                )}
              </div>

              {/* Right Side: Name, Handle, Role, Brief Bio & Skills */}
              <div className="min-w-0 flex flex-col justify-between text-left py-0.5">
                <div className="min-w-0 space-y-0.5">
                  <h3 className="font-display text-[16px] sm:text-[17.5px] font-bold text-zinc-950 dark:text-zinc-50 leading-tight tracking-tight truncate">
                    {agent.displayName}
                  </h3>
                  <p className="text-[10.5px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                    {agent.handle}
                  </p>
                  <p className="text-[11.5px] font-semibold text-zinc-800 dark:text-zinc-200 leading-snug truncate pt-0.5">
                    {agent.roleTitle}
                  </p>
                  <p className="text-[10.5px] sm:text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug line-clamp-3 pt-0.5">
                    {summaryText}
                  </p>
                </div>

                {/* Concise Skills */}
                <div className="flex flex-wrap items-center gap-1 pt-1.5">
                  {agent.skills.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="max-w-full truncate rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-300/80 dark:border-white/15 px-1.5 py-0.5 text-[9.5px] font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact Links + Handshake QR */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-white/10">
              <div className="space-y-1 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDial(agent);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white w-full text-left"
                >
                  <Phone className="w-3 h-3 text-zinc-600 dark:text-zinc-400 shrink-0" />
                  <span className="truncate font-mono tabular-nums">{agent.voiceNumber}</span>
                </button>

                <a
                  href={`https://${linkedinOrWeb}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white w-full"
                >
                  {isPersona ? (
                    <span className="w-3.5 h-3.5 rounded-[3px] bg-[#0A66C2] text-white font-bold text-[8.5px] flex items-center justify-center shrink-0">
                      in
                    </span>
                  ) : (
                    <Globe className="w-3 h-3 text-zinc-600 dark:text-zinc-400 shrink-0" />
                  )}
                  <span className="truncate">{linkedinOrWeb}</span>
                </a>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEmail(agent);
                  }}
                  className="flex items-center gap-1.5 text-[10.5px] font-mono text-sky-700 dark:text-sky-400 hover:underline w-full text-left"
                  title={`Email ${agent.agentEmail}`}
                >
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{agent.agentEmail}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={(e) => copyText(e, 'qr', endpointValue, 'agent endpoint')}
                className="flex flex-col items-center shrink-0 cursor-pointer group"
                title="Copy endpoint"
              >
                <DeterministicQrSvg seed={agent.handle} />
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-mono font-semibold text-zinc-600 dark:text-zinc-400">
                  <Wifi className="w-2.5 h-2.5 rotate-90 shrink-0" />
                  {copiedField === 'qr' ? 'COPIED' : 'NFC'}
                </span>
              </button>
            </div>
          </div>

          {/* Crisp Front Action Bar (Flip, Engage, Email, Dial) */}
          <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-white/10 flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFlipToggle();
              }}
              className="min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors shrink-0"
              aria-label="Flip Card"
              title="Flip Card"
            >
              <RotateCw className="w-3 h-3" />
              <span>Flip</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEngage(agent);
              }}
              className={`flex-1 min-w-0 min-h-[36px] px-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                isEmergency
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Engage</span>
            </button>

            <button
              type="button"
              disabled={isEmergency}
              onClick={(e) => {
                e.stopPropagation();
                onEmail(agent);
              }}
              className="w-9 min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-35 inline-flex items-center justify-center transition-colors shrink-0"
              aria-label={`Email ${agent.displayName}`}
              title={`Email ${agent.agentEmail}`}
            >
              <Mail className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDial(agent);
              }}
              className="min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-colors shrink-0"
            >
              <Phone className="w-3 h-3" />
              <span>Dial</span>
            </button>
          </div>
        </div>

        {/* BACK FACE — Key-Value Protocol Spec Sheet */}
        <div
          aria-hidden={!flipped}
          className={`absolute inset-0 backface-hidden rotate-y-180 ${edgeRadiusClass} ${surfaceThemeClass} ${borderClass} shadow-lg dark:shadow-2xl overflow-hidden flex flex-col justify-between p-4 text-left text-zinc-950 dark:text-zinc-100 transition-all`}
          style={{ ...borderStyleObj, pointerEvents: flipped ? 'auto' : 'none' }}
        >
          {/* Subtle Background Watermark Pattern */}
          <CardBackgroundPatternOverlay pattern={cardStyle?.backgroundPattern} agentId={`back-${agent.id}`} />

          {/* Back Header */}
          <div className="relative z-10 flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-200 dark:border-white/10 shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-sky-700 dark:text-sky-400 truncate">{agent.handle}</p>
              <h3 className="font-display text-sm font-semibold text-zinc-950 dark:text-white truncate">
                {agent.displayName}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isActive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCardFullScreen((v) => !v);
                  }}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0 transition-colors"
                  title={expandedFull ? 'Exit Full Screen View' : 'Full Screen Card View'}
                  aria-label={expandedFull ? 'Exit Full Screen View' : 'Full Screen Card View'}
                >
                  {expandedFull ? (
                    <SquareExitFullScreenIcon className="w-3.5 h-3.5" />
                  ) : (
                    <SquareExpandIcon className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              {onCustomize && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCustomize(agent);
                  }}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0 transition-colors"
                  title="Customize Card Style"
                  aria-label="Customize Card Style"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFlipToggle();
                }}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0 transition-colors"
                title="Flip to Front"
                aria-label="Flip to Front"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Key-Value Spec Sheet Body */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 divide-y divide-zinc-200 dark:divide-white/[0.07] text-[11px]">
            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Protocol</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-200 truncate">{protocolValue}</span>
            </div>

            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 shrink-0">DID</span>
              <button
                type="button"
                onClick={(e) => copyText(e, 'did', didValue, 'DID')}
                className="font-mono text-zinc-900 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 min-w-0"
              >
                <span className="truncate">{didValue}</span>
                {copiedField === 'did' ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-500 shrink-0" />
                )}
              </button>
            </div>

            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Agent Email</span>
              <button
                type="button"
                onClick={(e) => copyText(e, 'email', agent.agentEmail, 'agent email')}
                className="font-mono text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1 min-w-0"
              >
                <span className="truncate">{agent.agentEmail}</span>
                {copiedField === 'email' ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-500 shrink-0" />
                )}
              </button>
            </div>

            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Endpoint</span>
              <button
                type="button"
                onClick={(e) => copyText(e, 'ep', endpointValue, 'endpoint')}
                className="font-mono text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 min-w-0"
              >
                <span className="truncate">{endpointValue}</span>
                <Copy className="w-3 h-3 text-zinc-500 shrink-0" />
              </button>
            </div>

            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Poppy v1.0</span>
              <a
                href={poppyPath}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-sky-700 dark:text-sky-400 hover:underline truncate"
              >
                {poppyPath}
              </a>
            </div>

            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Auth</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-300 truncate">{authValue}</span>
            </div>

            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Spend Cap / Disc</span>
              <span className="font-mono tabular-nums text-zinc-950 dark:text-zinc-100 font-medium">
                {isEmergency ? 'CIVIC FREE' : formatMoney(agent.guardrails.maxAutoSpendZAR, currency)} ·{' '}
                <span className="text-amber-700 dark:text-amber-400">{agent.guardrails.minDiscountPct}%</span>
              </span>
            </div>

            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Hours · POPIA</span>
              <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-300">
                {agent.guardrails.workingHoursSAST || '08:00-17:00'} ·{' '}
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  {agent.popiaConsentActive ? 'Verified' : 'Standard'}
                </span>
              </span>
            </div>

            <div className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400 truncate">{agent.geoLocation?.label || 'Sandton Corridor'}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDiscoverable(agent.id);
                }}
                className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium inline-flex items-center gap-1 shrink-0 transition-colors ${
                  agent.discoverableByPassersby
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                    : 'bg-zinc-100 text-zinc-700 border border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-white/15'
                }`}
              >
                <Radio className="w-2.5 h-2.5" />
                {agent.discoverableByPassersby ? 'Beacon Live' : 'Off'}
              </button>
            </div>

            {(agent.interviewVideo || (isPersona && onOpenVideoStudio)) && (
              <div className="py-1.5 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 font-medium truncate ${
                    agent.interviewVideo
                      ? agent.interviewVideo.verification.verdict === 'VERIFIED_HUMAN'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <Video className="w-3 h-3 shrink-0" />
                  {agent.interviewVideo
                    ? agent.interviewVideo.verification.verdict === 'VERIFIED_HUMAN'
                      ? `Real (${agent.interviewVideo.verification.authenticityScore}%)`
                      : `Risk (${agent.interviewVideo.verification.deepfakeRiskPct}%)`
                    : 'Video Screen'}
                </span>
                {onOpenVideoStudio && isPersona && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenVideoStudio(agent);
                    }}
                    className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 font-medium text-[10.5px] hover:bg-zinc-200 dark:hover:bg-zinc-700 shrink-0"
                  >
                    Open Studio
                  </button>
                )}
              </div>
            )}

            {agentBookings.length > 0 && (
              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-zinc-800 dark:text-zinc-300 truncate">{agentBookings[0].title}</span>
                <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 shrink-0 tabular-nums">
                  {new Date(agentBookings[0].startTime).toLocaleDateString('en-ZA', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Back Actions Footer */}
          <div className="grid grid-cols-4 gap-2 pt-2.5 border-t border-zinc-200 dark:border-white/10 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEngage(agent);
              }}
              className="col-span-2 min-h-[38px] rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white font-semibold text-xs inline-flex items-center justify-center gap-1 transition-colors"
            >
              Engage <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            {!isEmergency ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEmail(agent);
                }}
                className="min-h-[38px] rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-900 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
                aria-label="Email"
                title="Email"
              >
                <Mail className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => copyText(e, 'did2', didValue, 'DID')}
                className="min-h-[38px] rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-900 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
                aria-label="Copy DID"
                title="Copy DID"
              >
                {copiedField === 'did2' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDial(agent);
              }}
              className={`min-h-[38px] rounded-lg font-semibold text-xs flex items-center justify-center transition-colors ${
                isEmergency
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'bg-zinc-100 border border-zinc-300 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-white/15 dark:text-white dark:hover:bg-zinc-700'
              }`}
              aria-label="Dial"
              title="Dial"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderCardBody(false)}

      {isCardFullScreen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[75] bg-zinc-950/88 backdrop-blur-xl flex flex-col items-center justify-center p-2.5 sm:p-6"
            onClick={() => setIsCardFullScreen(false)}
          >
            <div
              className="w-full max-w-[920px] flex items-center justify-between gap-2 pb-2.5 text-white shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-xs font-mono text-zinc-300 truncate">
                Full Screen Card · {agent.handle}
              </span>
              <button
                type="button"
                onClick={() => setIsCardFullScreen(false)}
                className="min-h-[34px] px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                aria-label="Exit Full Screen"
              >
                <SquareExitFullScreenIcon className="w-3.5 h-3.5" />
                <span>Exit Full Screen</span>
              </button>
            </div>

            <div className="w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {renderCardBody(true)}
            </div>
          </div>,
          document.body
        )}

      <AgentMediaGalleryModal
        open={galleryOpen}
        agent={agent}
        initialIndex={galleryInitialIdx}
        onClose={() => setGalleryOpen(false)}
        onUpdateAgentMedia={onUpdateAgentMedia}
      />
    </>
  );
};
