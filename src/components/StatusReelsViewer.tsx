import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  Phone,
  Mail,
  RotateCw,
  Pause,
  Play,
  Megaphone,
  ArrowRight,
  Building2,
  ArrowLeft,
  Handshake,
  Briefcase,
  MapPin,
  Plus,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  AgentDoc,
  AgentStatusPostDoc,
  BookingDoc,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';
import { AgentIdentityCard } from './AgentIdentityCard';
import { resolveAgentImage } from '../lib/agentImages';
import { StatusCategoryBadge, getStatusCategoryLabel } from './StatusCategoryBadge';

type ReelSlide =
  | { kind: 'status'; id: string; status: AgentStatusPostDoc; targetAgent?: AgentDoc }
  | { kind: 'agent'; id: string; agent: AgentDoc };

interface StatusReelsViewerProps {
  open: boolean;
  initialAgentId: string | null;
  initialStatusId?: string | null;
  agents: AgentDoc[];
  statusPosts?: AgentStatusPostDoc[];
  bookings: BookingDoc[];
  currency: CurrencyMode;
  onClose: () => void;
  onActiveAgentChange: (agent: AgentDoc) => void;
  onEngageAgent: (agent: AgentDoc) => void;
  onDialAgent: (agent: AgentDoc) => void;
  onEmailAgent: (agent: AgentDoc) => void;
  onToggleDiscoverable: (agentId: string) => void;
  onOpenVideoStudio?: (agent: AgentDoc) => void;
  onOpenPostStatus?: () => void;
}

const SLIDE_DURATION_MS = 7000;

export const StatusReelsViewer: React.FC<StatusReelsViewerProps> = ({
  open,
  initialAgentId,
  initialStatusId,
  agents,
  statusPosts = [],
  bookings,
  currency,
  onClose,
  onActiveAgentChange,
  onEngageAgent,
  onDialAgent,
  onEmailAgent,
  onToggleDiscoverable,
  onOpenVideoStudio,
  onOpenPostStatus,
}) => {
  const slides: ReelSlide[] = useMemo(() => {
    const findAgent = (id: string, handle?: string) =>
      agents.find((a) => a.id === id || (handle && a.handle === handle));

    const statusSlides: ReelSlide[] = statusPosts.map((status) => ({
      kind: 'status',
      id: `status_${status.id}`,
      status,
      targetAgent: findAgent(status.agentId, status.agentHandle),
    }));

    const agentSlides: ReelSlide[] = agents.map((agent) => ({
      kind: 'agent',
      id: `reel_${agent.id}`,
      agent,
    }));

    // Order interleaved status cards followed by directory cards, rotated to requested starting item
    const combined: ReelSlide[] = [];
    const maxLen = Math.max(statusSlides.length, agentSlides.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < statusSlides.length) combined.push(statusSlides[i]);
      if (i < agentSlides.length) combined.push(agentSlides[i]);
    }

    if (combined.length === 0) return [];

    let startIdx = -1;
    if (initialStatusId) {
      startIdx = combined.findIndex(
        (s) => s.kind === 'status' && s.status.id === initialStatusId
      );
    }
    if (startIdx < 0 && initialAgentId) {
      startIdx = combined.findIndex(
        (s) =>
          (s.kind === 'status' && s.status.agentId === initialAgentId) ||
          (s.kind === 'agent' && s.agent.id === initialAgentId)
      );
    }

    if (startIdx > 0) {
      return [...combined.slice(startIdx), ...combined.slice(0, startIdx)];
    }
    return combined;
  }, [agents, statusPosts, initialAgentId, initialStatusId]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holdPaused, setHoldPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});
  const [statusImgErrors, setStatusImgErrors] = useState<Record<string, boolean>>({});
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [dragDeltaX, setDragDeltaX] = useState(0);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);
  const lastSyncedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentIdx(0);
      setProgress(0);
      setPaused(false);
      setHoldPaused(false);
      lastSyncedIdRef.current = null;
    }
  }, [open, initialAgentId, initialStatusId]);

  const activeSlide = slides[currentIdx] || null;

  useEffect(() => {
    if (!open || !activeSlide) return;
    const target =
      activeSlide.kind === 'agent' ? activeSlide.agent : activeSlide.targetAgent;
    if (target && lastSyncedIdRef.current !== target.id) {
      lastSyncedIdRef.current = target.id;
      onActiveAgentChange(target);
    }
  }, [open, activeSlide, onActiveAgentChange]);

  const goNext = useCallback(() => {
    setProgress(0);
    setCurrentIdx((prev) => (prev + 1 < slides.length ? prev + 1 : 0));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setProgress(0);
    setCurrentIdx((prev) => (prev - 1 >= 0 ? prev - 1 : Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    if (!open || paused || holdPaused || slides.length === 0) return;
    const isFlipped =
      activeSlide?.kind === 'agent' && Boolean(flippedIds[activeSlide.agent.id]);
    if (isFlipped) return;

    const tickMs = 50;
    const increment = (tickMs / SLIDE_DURATION_MS) * 100;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev + increment >= 100) {
          goNext();
          return 0;
        }
        return prev + increment;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [open, paused, holdPaused, slides.length, activeSlide, flippedIds, goNext]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, goNext, goPrev]);

  if (!open || !activeSlide) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    didSwipeRef.current = false;
    setHoldPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      didSwipeRef.current = true;
    }
    if (Math.abs(dy) >= Math.abs(dx)) {
      setDragDeltaY(Math.max(-120, Math.min(120, dy)));
      setDragDeltaX(0);
    } else {
      setDragDeltaX(Math.max(-120, Math.min(120, dx)));
      setDragDeltaY(0);
    }
  };

  const handlePointerUp = () => {
    setHoldPaused(false);
    if (!dragStartRef.current) return;
    if (dragDeltaY < -44 || dragDeltaX < -44) {
      goNext();
    } else if (dragDeltaY > 44 || dragDeltaX > 44) {
      goPrev();
    }
    dragStartRef.current = null;
    setDragDeltaY(0);
    setDragDeltaX(0);
  };

  const handleCardAreaClick = (e: React.MouseEvent<HTMLDivElement>, agent: AgentDoc) => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button, a')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width);

    if (relX < 0.22) {
      goPrev();
    } else if (relX > 0.78) {
      goNext();
    } else {
      setFlippedIds((p) => ({
        ...p,
        [agent.id]: !p[agent.id],
      }));
    }
  };

  const isEmergency =
    activeSlide.kind === 'agent' && activeSlide.agent.handle === '911.emergency.agent';

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-100/95 dark:bg-[#09090b]/95 backdrop-blur-lg flex flex-col items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-5 overflow-hidden select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Top Reels Progress Bars */}
      <div className="w-full max-w-md space-y-2 shrink-0 z-30">
        <div className="flex items-center gap-1">
          {slides.map((s, idx) => {
            const fillPct =
              idx < currentIdx ? 100 : idx === currentIdx ? progress : 0;
            const barClass =
              s.kind === 'status'
                ? s.status.category === 'hired'
                  ? 'bg-[#0B4F9C] dark:bg-sky-400'
                  : s.status.category === 'deal_approved'
                  ? 'bg-[#007BFF] dark:bg-sky-400'
                  : s.status.category === 'sponsored_ad'
                  ? 'bg-amber-500 dark:bg-amber-400'
                  : 'bg-emerald-600 dark:bg-emerald-400'
                : 'bg-zinc-950 dark:bg-white';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setCurrentIdx(idx);
                  setProgress(0);
                }}
                aria-label={`Reel ${idx + 1}`}
                className="h-1 flex-1 rounded-full overflow-hidden bg-zinc-300 dark:bg-white/15"
              >
                <div className={`h-full transition-none ${barClass}`} style={{ width: `${fillPct}%` }} />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (currentIdx > 0) {
                  goPrev();
                } else {
                  onClose();
                }
              }}
              className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs shrink-0"
              aria-label={currentIdx > 0 ? 'Back to previous reel' : 'Back to Directory'}
              title={currentIdx > 0 ? 'Previous reel' : 'Back to Directory'}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            {activeSlide.kind === 'status' ? (
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <StatusCategoryBadge
                  category={activeSlide.status.category}
                  authorType={activeSlide.status.authorType}
                  size="sm"
                />
                <span className="text-xs font-mono text-zinc-900 dark:text-zinc-100 font-semibold truncate">
                  {getStatusCategoryLabel(activeSlide.status.category, activeSlide.status.authorType)}
                </span>
              </span>
            ) : (
              <span className="text-xs font-mono text-zinc-900 dark:text-zinc-200 truncate font-medium">
                {activeSlide.agent.handle}
              </span>
            )}

            <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-500 tabular-nums shrink-0">
              {currentIdx + 1}/{slides.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenPostStatus && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPostStatus();
                }}
                className="h-9 px-3 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-xs"
                title="Post a new Hired, Deal Approved, Sponsored Ad, or Generic status"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs"
              aria-label={paused ? 'Play' : 'Pause'}
              title={paused ? 'Play' : 'Pause'}
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs"
              aria-label="Close Reels"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Center Reels Stage */}
      <div className="relative flex-1 w-full max-w-2xl flex items-center justify-center min-h-0 my-1">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous reel"
          className="hidden sm:flex absolute left-0 z-30 w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          className="w-full max-w-[392px] sm:max-w-[364px] relative flex items-center justify-center"
          style={{
            transform: `translate(${dragDeltaX}px, ${dragDeltaY}px)`,
            transition: dragStartRef.current ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {activeSlide.kind === 'agent' ? (
            <div
              onClick={(e) => handleCardAreaClick(e, activeSlide.agent)}
              className="w-full cursor-pointer"
            >
              <AgentIdentityCard
                agent={activeSlide.agent}
                bookings={bookings}
                currency={currency}
                flipped={Boolean(flippedIds[activeSlide.agent.id])}
                isActive={true}
                onFlipToggle={() =>
                  setFlippedIds((p) => ({
                    ...p,
                    [activeSlide.agent.id]: !p[activeSlide.agent.id],
                  }))
                }
                onEngage={(a) => {
                  onClose();
                  onEngageAgent(a);
                }}
                onDial={(a) => {
                  onClose();
                  onDialAgent(a);
                }}
                onEmail={(a) => {
                  onClose();
                  onEmailAgent(a);
                }}
                onToggleDiscoverable={onToggleDiscoverable}
                onOpenVideoStudio={
                  onOpenVideoStudio
                    ? (a) => {
                        onClose();
                        onOpenVideoStudio(a);
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            (() => {
              const st = activeSlide.status;
              const authorAgent = activeSlide.targetAgent;
              const bgPhoto = authorAgent ? resolveAgentImage(authorAgent) : undefined;
              const showPhoto = Boolean(bgPhoto) && !statusImgErrors[st.id];
              const cardThemeBg =
                st.category === 'hired'
                  ? '#0B3B75'
                  : st.category === 'deal_approved'
                  ? '#07438E'
                  : st.category === 'sponsored_ad'
                  ? st.accentColor || '#78350F'
                  : st.accentColor || '#18181b';

              const bannerTag =
                st.category === 'hired'
                  ? 'HIRED · OFFER SIGNED'
                  : st.category === 'deal_approved'
                  ? 'DEAL APPROVED & SIGNED'
                  : st.category === 'sponsored_ad'
                  ? 'SPONSORED AD'
                  : st.authorType === 'persona'
                  ? 'LINKEDIN STATUS'
                  : 'AI AGENT UPDATE';

              return (
                <div
                  className="w-full max-w-[376px] sm:max-w-[360px] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-white/25 text-white flex flex-col justify-between h-[372px] sm:h-[416px] p-4 sm:p-5 relative"
                  style={{ backgroundColor: cardThemeBg }}
                >
                  {showPhoto && (
                    <>
                      <img
                        src={bgPhoto}
                        alt={st.authorName}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setStatusImgErrors((prev) => ({ ...prev, [st.id]: true }))
                        }
                        className={`absolute inset-0 w-full h-full object-cover ${
                          st.authorType === 'persona' ? 'object-top' : 'object-center'
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/60 pointer-events-none" />
                    </>
                  )}

                  {/* Top Row: Category Badge Pill + Auto/Skip */}
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md border border-white/20 pl-1 pr-2.5 py-1">
                      <StatusCategoryBadge
                        category={st.category}
                        authorType={st.authorType}
                        size="md"
                      />
                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-white">
                        {bannerTag}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {st.autoGenerated && (
                        <span className="text-[9.5px] font-mono bg-emerald-500/25 border border-emerald-300/40 text-emerald-200 px-2 py-0.5 rounded-full">
                          Auto-Post
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={goNext}
                        className="min-h-[28px] text-[11px] font-mono text-white/90 hover:text-white inline-flex items-center gap-1 bg-black/45 backdrop-blur-xs border border-white/15 px-2 py-0.5 rounded-lg"
                      >
                        Next <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Author Identity + Dedicated Status Content */}
                  <div className="relative z-10 my-auto space-y-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/75 bg-zinc-900 flex items-center justify-center font-bold text-xs shadow-md">
                          {showPhoto ? (
                            <img
                              src={bgPhoto}
                              alt={st.authorName}
                              className={`w-full h-full object-cover ${
                                st.authorType === 'persona' ? 'object-top' : 'object-center'
                              }`}
                            />
                          ) : (
                            <span>{st.authorName.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <StatusCategoryBadge
                            category={st.category}
                            authorType={st.authorType}
                            size="xs"
                          />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm text-white truncate drop-shadow-xs">
                          {st.authorName}
                        </p>
                        <p className="text-[11px] font-mono text-sky-200 truncate">
                          {st.agentHandle}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="font-display text-base sm:text-lg font-bold leading-snug text-white drop-shadow-sm">
                        {st.headline}
                      </h3>
                      <p className="text-xs text-zinc-200 leading-relaxed line-clamp-3">
                        {st.body}
                      </p>
                    </div>

                    {/* Structured Info Box per Status Category */}
                    {st.category === 'hired' && (
                      <div className="rounded-xl bg-[#0B4F9C]/55 backdrop-blur-sm border border-sky-300/35 p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <Handshake className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                            {st.partnerName || st.authorOrg}
                          </span>
                          {st.savingsLabel && (
                            <span className="text-[10px] font-mono text-emerald-300 shrink-0">
                              {st.savingsLabel}
                            </span>
                          )}
                        </div>
                        {st.roleTitle && (
                          <p className="text-[11px] text-sky-100 flex items-center gap-1 truncate">
                            <Briefcase className="w-3 h-3 shrink-0" />
                            {st.roleTitle}
                          </p>
                        )}
                        {st.regionZone && (
                          <p className="text-[10.5px] font-mono text-sky-200 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {st.regionZone}
                          </p>
                        )}
                      </div>
                    )}

                    {st.category === 'deal_approved' && (
                      <div className="rounded-xl bg-[#007BFF]/40 backdrop-blur-sm border border-sky-300/40 p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[11px] font-semibold text-white flex items-center gap-1 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                            {st.partnerName ? `Signed with ${st.partnerName}` : 'Business Deal Signed Off'}
                          </p>
                          <p className="text-[10.5px] font-mono text-emerald-200 truncate">
                            {st.savingsLabel || 'Approved & Settled'}
                          </p>
                        </div>
                        {st.dealValueZAR !== undefined && (
                          <div className="text-right shrink-0">
                            <p className="text-[9.5px] font-mono uppercase text-sky-200">Deal Value</p>
                            <p className="font-mono text-sm font-bold text-white tabular-nums">
                              {formatMoney(st.dealValueZAR, currency)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {st.category === 'sponsored_ad' && (
                      <div className="rounded-xl bg-amber-500/25 backdrop-blur-sm border border-amber-300/40 p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-amber-200 flex items-center gap-1 truncate">
                            <Megaphone className="w-3.5 h-3.5 shrink-0" />
                            {st.savingsLabel || 'Promoted Offer'}
                          </p>
                          <p className="text-[10.5px] font-mono text-white/80 truncate">
                            {st.authorOrg}
                          </p>
                        </div>
                        {st.dealValueZAR !== undefined && (
                          <span className="font-mono text-sm font-bold text-white tabular-nums shrink-0">
                            {formatMoney(st.dealValueZAR, currency)}
                          </span>
                        )}
                      </div>
                    )}

                    {st.category === 'generic' && (
                      <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-zinc-100 inline-flex items-center gap-1.5">
                          {st.authorType === 'persona' ? (
                            <span className="w-4 h-4 rounded bg-[#0A66C2] text-white font-bold text-[9px] inline-flex items-center justify-center">
                              in
                            </span>
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                          )}
                          {st.authorOrg}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-300">
                          {new Date(st.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Action Row: Engage + Email + Dial */}
                  <div className="relative z-10 flex items-center gap-1.5 pt-2.5 border-t border-white/20">
                    {authorAgent && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEngageAgent(authorAgent);
                          }}
                          className="flex-1 min-h-[38px] rounded-xl bg-white text-zinc-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-zinc-100 shadow-sm"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span className="truncate">{st.ctaLabel || 'Engage'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEmailAgent(authorAgent);
                          }}
                          className="w-10 min-h-[38px] rounded-xl bg-black/50 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center hover:bg-black/65 shrink-0"
                          aria-label={`Email ${authorAgent.displayName}`}
                          title="Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onDialAgent(authorAgent);
                          }}
                          className="w-10 min-h-[38px] rounded-xl bg-black/50 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center hover:bg-black/65 shrink-0"
                          aria-label={`Dial ${authorAgent.displayName}`}
                          title="Dial"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()
          )}

          {/* Desktop Vertical Reels Controls */}
          <div className="hidden sm:flex flex-col gap-2 absolute -right-14 top-1/2 -translate-y-1/2 z-30">
            <button
              type="button"
              onClick={goPrev}
              className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs"
              aria-label="Previous card up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs"
              aria-label="Next card down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label="Next reel"
          className="hidden sm:flex absolute right-0 z-30 w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Controls Bar */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 shrink-0 z-30">
        <button
          type="button"
          onClick={goPrev}
          className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 shadow-xs"
          aria-label="Previous reel"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {activeSlide.kind === 'agent' ? (
          <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 rounded-full p-1 flex items-center justify-center gap-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEngageAgent(activeSlide.agent);
              }}
              className="flex-1 min-h-[38px] rounded-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 font-semibold text-xs inline-flex items-center justify-center gap-1 dark:hover:bg-white"
            >
              <Zap className="w-3.5 h-3.5" />
              Engage
            </button>
            <button
              type="button"
              disabled={isEmergency}
              onClick={() => {
                onClose();
                onEmailAgent(activeSlide.agent);
              }}
              className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center disabled:opacity-35"
              aria-label="Email"
            >
              <Mail className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onDialAgent(activeSlide.agent);
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                isEmergency
                  ? 'bg-rose-600 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200'
              }`}
              aria-label="Dial"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setFlippedIds((p) => ({
                  ...p,
                  [activeSlide.agent.id]: !p[activeSlide.agent.id],
                }))
              }
              className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center"
              aria-label="Flip"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 rounded-full p-1 flex items-center justify-center gap-1.5 shadow-sm">
            {activeSlide.targetAgent && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEngageAgent(activeSlide.targetAgent!);
                }}
                className="flex-1 min-h-[38px] rounded-full bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                {activeSlide.status.ctaLabel || 'Engage'}
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="px-4 min-h-[38px] rounded-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white text-xs font-medium inline-flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={goNext}
          className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 shadow-xs"
          aria-label="Next reel"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
