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
        accentColor: '#0F172A',
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
        accentColor: '#047857',
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
        accentColor: '#CA8A04',
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
        accentColor: '#0284C7',
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
      className="fixed inset-0 z-50 bg-[#03060E]/95 backdrop-blur-xl flex flex-col items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-5 overflow-hidden select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Top Reels Progress Bars + Controls */}
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
                className={`h-1 flex-1 rounded-full overflow-hidden ${
                  s.kind === 'ad' ? 'bg-amber-500/25' : 'bg-white/20'
                }`}
              >
                <div
                  className={`h-full transition-none ${
                    s.kind === 'ad' ? 'bg-amber-400' : 'bg-cyan-400'
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
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                <Megaphone className="w-3 h-3" />
                SPONSORED AD
              </span>
            ) : (
              <span className="text-xs font-mono text-cyan-300 truncate">
                {activeSlide.agent.handle}
              </span>
            )}
            <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
              {currentIdx + 1}/{slides.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 flex items-center justify-center hover:border-cyan-400"
              aria-label={paused ? 'Play' : 'Pause'}
              title={paused ? 'Play' : 'Pause'}
            >
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 flex items-center justify-center hover:border-rose-400"
              aria-label="Close Reels"
              title="Close"
            >
              <X className="w-4 h-4" />
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
          className="hidden sm:flex absolute left-0 z-30 w-11 h-11 rounded-full glass-panel border border-slate-700 items-center justify-center text-slate-200 hover:border-cyan-400 shadow-xl"
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
            <div
              className="w-full max-w-[376px] sm:max-w-[360px] mx-auto rounded-[22px] overflow-hidden shadow-2xl border border-amber-400/50 text-white flex flex-col justify-between h-[364px] sm:h-[416px] p-4 relative"
              style={{
                background: `linear-gradient(155deg, ${activeSlide.accentColor} 0%, #060D1E 80%)`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400 text-slate-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  <Megaphone className="w-3 h-3" /> Ad
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  className="min-h-[32px] text-xs font-mono text-white/80 hover:text-white inline-flex items-center gap-1 bg-black/30 px-2.5 py-1 rounded-lg"
                >
                  Skip <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="my-auto py-2 text-center space-y-3">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center font-display font-extrabold text-xl border-2 border-white/30 shadow-2xl"
                  style={{ backgroundColor: activeSlide.accentColor }}
                >
                  {activeSlide.brandCode}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-mono text-amber-300 flex items-center justify-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {activeSlide.brandName}
                  </p>
                  <h3 className="font-display text-lg sm:text-xl font-extrabold leading-tight text-white">
                    {activeSlide.headline}
                  </h3>
                </div>

                <div className="inline-flex flex-col items-center rounded-2xl bg-black/35 border border-white/15 px-4 py-2">
                  <span className="text-[11px] font-mono text-emerald-300">
                    {activeSlide.savingsLabel}
                  </span>
                  <span className="font-mono text-base font-bold text-white tabular-nums">
                    {formatMoney(activeSlide.offerValueZAR, currency)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/15">
                {activeSlide.targetAgent && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onPitchAgent(activeSlide.targetAgent!);
                      }}
                      className="col-span-2 min-h-[44px] rounded-xl bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-amber-300"
                    >
                      <Zap className="w-4 h-4" />
                      Claim Offer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onDialAgent(activeSlide.targetAgent!);
                      }}
                      className="min-h-[44px] rounded-xl bg-white/15 text-white flex items-center justify-center hover:bg-white/25"
                      aria-label="Dial Sponsor"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Desktop Vertical Reels Controls */}
          <div className="hidden sm:flex flex-col gap-2.5 absolute -right-14 top-1/2 -translate-y-1/2 z-30">
            <button
              type="button"
              onClick={goPrev}
              className="w-10 h-10 rounded-full glass-panel border border-slate-700 text-slate-200 flex items-center justify-center hover:border-cyan-400"
              aria-label="Previous card up"
              title="Prev"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="w-10 h-10 rounded-full glass-panel border border-slate-700 text-slate-200 flex items-center justify-center hover:border-cyan-400"
              aria-label="Next card down"
              title="Next"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label="Next reel"
          className="hidden sm:flex absolute right-0 z-30 w-11 h-11 rounded-full glass-panel border border-slate-700 items-center justify-center text-slate-200 hover:border-cyan-400 shadow-xl"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Reels Controls Bar (44px ergonomic buttons) */}
      <div className="w-full max-w-md flex items-center justify-between gap-2 shrink-0 z-30">
        <button
          type="button"
          onClick={goPrev}
          className="w-11 h-11 rounded-full glass-panel border border-slate-700 text-slate-200 flex items-center justify-center hover:border-cyan-400 shrink-0"
          aria-label="Previous reel"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {activeSlide.kind === 'agent' ? (
          <div className="flex-1 glass-panel rounded-full p-1 flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onPitchAgent(activeSlide.agent);
              }}
              className="flex-1 min-h-[40px] rounded-full bg-cyan-400 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-1 hover:bg-cyan-300"
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
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isEmergency
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-900 border border-slate-700 text-emerald-300'
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
              className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-35"
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
              className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 text-cyan-300 flex items-center justify-center"
              aria-label="Flip"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex-1 glass-panel rounded-full p-1 flex items-center justify-center gap-1.5">
            {activeSlide.targetAgent && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPitchAgent(activeSlide.targetAgent!);
                }}
                className="flex-1 min-h-[40px] rounded-full bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                Claim Deal
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="px-4 min-h-[40px] rounded-full bg-slate-900 border border-slate-700 text-white text-xs font-medium inline-flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={goNext}
          className="w-11 h-11 rounded-full glass-panel border border-slate-700 text-slate-200 flex items-center justify-center hover:border-cyan-400 shrink-0"
          aria-label="Next reel"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
