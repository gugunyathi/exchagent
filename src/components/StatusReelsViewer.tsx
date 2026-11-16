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
} from 'lucide-react';
import { AgentDoc, BookingDoc, CurrencyMode, formatMoney } from '../types/firestore';
import { AgentIdentityCard } from './AgentIdentityCard';
import { resolveAgentImage } from '../lib/agentImages';

type ReelSlide =
  | { kind: 'agent'; id: string; agent: AgentDoc }
  | {
      kind: 'ad';
      id: string;
      sponsorHandle: string;
      brandName: string;
      brandCode: string;
      accentColor: string;
      headline: string;
      offerValueZAR: number;
      savingsLabel: string;
      targetAgent?: AgentDoc;
    };

interface StatusReelsViewerProps {
  open: boolean;
  initialAgentId: string | null;
  agents: AgentDoc[];
  bookings: BookingDoc[];
  currency: CurrencyMode;
  onClose: () => void;
  onActiveAgentChange: (agent: AgentDoc) => void;
  onPitchAgent: (agent: AgentDoc) => void;
  onDialAgent: (agent: AgentDoc) => void;
  onEmailAgent: (agent: AgentDoc) => void;
  onToggleDiscoverable: (agentId: string) => void;
  onOpenVideoStudio?: (agent: AgentDoc) => void;
}

const SLIDE_DURATION_MS = 6500;

export const StatusReelsViewer: React.FC<StatusReelsViewerProps> = ({
  open,
  initialAgentId,
  agents,
  bookings,
  currency,
  onClose,
  onActiveAgentChange,
  onPitchAgent,
  onDialAgent,
  onEmailAgent,
  onToggleDiscoverable,
  onOpenVideoStudio,
}) => {
  const slides: ReelSlide[] = useMemo(() => {
    if (agents.length === 0) return [];

    const startIdx = initialAgentId ? agents.findIndex((a) => a.id === initialAgentId) : 0;
    const ordered =
      startIdx > 0
        ? [...agents.slice(startIdx), ...agents.slice(0, startIdx)]
        : [...agents];

    const findByHandle = (h: string) => agents.find((a) => a.handle === h) || ordered[0];

    const adTemplates = [
      {
        id: 'ad_woolies',
        sponsorHandle: 'ceo.woolworths.agent',
        brandName: 'Woolworths SA',
        brandCode: 'W',
        accentColor: '#18181b',
        headline: '12% WRewards Corporate Fleet Rebate',
        offerValueZAR: 295000,
        savingsLabel: 'Save 12% via x402',
        targetAgent: findByHandle('ceo.woolworths.agent'),
      },
      {
        id: 'ad_bistro',
        sponsorHandle: 'sandton.bistro.agent',
        brandName: 'Marble & Flame',
        brandCode: 'M&F',
        accentColor: '#065F46',
        headline: '22% Off Executive Tasting · BLE Beacon',
        offerValueZAR: 28500,
        savingsLabel: '22% Passing Offer',
        targetAgent: findByHandle('sandton.bistro.agent'),
      },
      {
        id: 'ad_mtn',
        sponsorHandle: 'procurement.mtn.agent',
        brandName: 'MTN Enterprise',
        brandCode: 'MTN',
        accentColor: '#92400E',
        headline: 'Open 5G Solar Tower Tender',
        offerValueZAR: 420000,
        savingsLabel: 'Live Reverse-RFP',
        targetAgent: findByHandle('procurement.mtn.agent'),
      },
      {
        id: 'ad_takealot',
        sponsorHandle: 'fleet.takealot.agent',
        brandName: 'Takealot Logistics',
        brandCode: 'TKL',
        accentColor: '#075985',
        headline: 'Same-Day EV Dispatch Slot',
        offerValueZAR: 280000,
        savingsLabel: 'Save 18% Fleet SLA',
        targetAgent: findByHandle('fleet.takealot.agent'),
      },
    ];

    const list: ReelSlide[] = [];
    let adIdx = 0;

    ordered.forEach((agent, idx) => {
      list.push({
        kind: 'agent',
        id: `reel_${agent.id}`,
        agent,
      });

      if ((idx + 1) % 2 === 0 && idx < ordered.length - 1) {
        const ad = adTemplates[adIdx % adTemplates.length];
        adIdx += 1;
        list.push({
          kind: 'ad',
          ...ad,
          id: `${ad.id}_${idx}`,
        });
      }
    });

    return list;
  }, [agents, initialAgentId]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holdPaused, setHoldPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});
  const [adImgErrors, setAdImgErrors] = useState<Record<string, boolean>>({});
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
  }, [open, initialAgentId]);

  const activeSlide = slides[currentIdx] || null;

  useEffect(() => {
    if (open && activeSlide?.kind === 'agent' && lastSyncedIdRef.current !== activeSlide.agent.id) {
      lastSyncedIdRef.current = activeSlide.agent.id;
      onActiveAgentChange(activeSlide.agent);
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
                <div
                  className={`h-full transition-none ${
                    s.kind === 'ad' ? 'bg-amber-500 dark:bg-amber-400' : 'bg-zinc-950 dark:bg-white'
                  }`}
                  style={{ width: `${fillPct}%` }}
                />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {activeSlide.kind === 'ad' ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-400/15 dark:border-amber-400/30 dark:text-amber-300 px-2 py-0.5 text-[10px] font-mono font-semibold">
                <Megaphone className="w-3 h-3" />
                SPONSORED
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
                onPitch={(a) => {
                  onClose();
                  onPitchAgent(a);
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
              const adImage = activeSlide.targetAgent
                ? resolveAgentImage(activeSlide.targetAgent)
                : undefined;
              const showAdPhoto = Boolean(adImage) && !adImgErrors[activeSlide.id];
              return (
                <div
                  className="w-full max-w-[376px] sm:max-w-[360px] mx-auto rounded-2xl overflow-hidden shadow-2xl border border-amber-400/40 text-white flex flex-col justify-between h-[358px] sm:h-[404px] p-5 relative"
                  style={{
                    backgroundColor: activeSlide.accentColor,
                  }}
                >
                  {showAdPhoto && (
                    <>
                      <img
                        src={adImage}
                        alt={activeSlide.brandName}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setAdImgErrors((prev) => ({ ...prev, [activeSlide.id]: true }))
                        }
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/45 pointer-events-none" />
                    </>
                  )}

                  <div className="relative z-10 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-400 text-zinc-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-xs">
                      <Megaphone className="w-3 h-3" /> Sponsored
                    </span>
                    <button
                      type="button"
                      onClick={goNext}
                      className="min-h-[30px] text-xs font-mono text-white/90 hover:text-white inline-flex items-center gap-1 bg-black/45 backdrop-blur-xs border border-white/15 px-2.5 py-1 rounded-lg"
                    >
                      Skip <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="relative z-10 my-auto py-2 text-center space-y-2.5">
                    <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center font-display font-bold text-base border border-white/30 bg-black/45 backdrop-blur-sm shadow-md">
                      {activeSlide.brandCode}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-mono text-amber-300 flex items-center justify-center gap-1 drop-shadow-xs">
                        <Building2 className="w-3.5 h-3.5" />
                        {activeSlide.brandName}
                      </p>
                      <h3 className="font-display text-lg sm:text-xl font-bold leading-tight text-white drop-shadow-sm">
                        {activeSlide.headline}
                      </h3>
                    </div>

                    <div className="inline-flex flex-col items-center rounded-xl bg-black/55 backdrop-blur-sm border border-white/20 px-4 py-2">
                      <span className="text-[11px] font-mono text-emerald-300">
                        {activeSlide.savingsLabel}
                      </span>
                      <span className="font-mono text-base font-bold text-white tabular-nums">
                        {formatMoney(activeSlide.offerValueZAR, currency)}
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 grid grid-cols-3 gap-2 pt-3 border-t border-white/20">
                    {activeSlide.targetAgent && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onPitchAgent(activeSlide.targetAgent!);
                          }}
                          className="col-span-2 min-h-[40px] rounded-xl bg-white text-zinc-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-zinc-100 shadow-sm"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Claim Offer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onDialAgent(activeSlide.targetAgent!);
                          }}
                          className="min-h-[40px] rounded-xl bg-black/50 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center hover:bg-black/65"
                          aria-label="Dial Sponsor"
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
                onPitchAgent(activeSlide.agent);
              }}
              className="flex-1 min-h-[38px] rounded-full bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 font-semibold text-xs inline-flex items-center justify-center gap-1 dark:hover:bg-white"
            >
              <Zap className="w-3.5 h-3.5" />
              Pitch
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
                  onPitchAgent(activeSlide.targetAgent!);
                }}
                className="flex-1 min-h-[38px] rounded-full bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                Claim Deal
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
