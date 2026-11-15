import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  RotateCw,
  Zap,
} from 'lucide-react';
import { AgentDoc, BookingDoc, CurrencyMode } from '../types/firestore';
import { AgentIdentityCard } from './AgentIdentityCard';

interface AgentCardCarouselProps {
  agents: AgentDoc[];
  bookings: BookingDoc[];
  currency: CurrencyMode;
  selectedAgentId?: string | null;
  onActiveAgentChange?: (agent: AgentDoc) => void;
  onSelectForPitch: (agent: AgentDoc) => void;
  onDialAgent: (agent: AgentDoc) => void;
  onEmailAgent: (agent: AgentDoc) => void;
  onToggleDiscoverable: (agentId: string) => void;
  onOpenVideoStudio?: (agent: AgentDoc) => void;
}

export const AgentCardCarousel: React.FC<AgentCardCarouselProps> = ({
  agents,
  bookings,
  currency,
  selectedAgentId,
  onActiveAgentChange,
  onSelectForPitch,
  onDialAgent,
  onEmailAgent,
  onToggleDiscoverable,
  onOpenVideoStudio,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({});
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<number | null>(null);

  const safeIndex = agents.length > 0 ? Math.min(activeIndex, agents.length - 1) : 0;
  const activeAgent = agents[safeIndex] || null;

  useEffect(() => {
    if (!selectedAgentId) return;
    const idx = agents.findIndex((a) => a.id === selectedAgentId);
    if (idx >= 0 && idx !== activeIndex) {
      setActiveIndex(idx);
    }
  }, [selectedAgentId, agents, activeIndex]);

  useEffect(() => {
    if (activeIndex >= agents.length && agents.length > 0) {
      setActiveIndex(0);
    }
  }, [agents.length, activeIndex]);

  const setIndexAndNotify = useCallback(
    (nextIdx: number) => {
      setActiveIndex(nextIdx);
      const next = agents[nextIdx];
      if (next && onActiveAgentChange) {
        onActiveAgentChange(next);
      }
    },
    [agents, onActiveAgentChange]
  );

  const goPrev = useCallback(() => {
    if (agents.length <= 1) return;
    setIndexAndNotify((safeIndex - 1 + agents.length) % agents.length);
  }, [agents.length, safeIndex, setIndexAndNotify]);

  const goNext = useCallback(() => {
    if (agents.length <= 1) return;
    setIndexAndNotify((safeIndex + 1) % agents.length);
  }, [agents.length, safeIndex, setIndexAndNotify]);

  const toggleFlipFor = useCallback((agentId: string) => {
    setFlippedMap((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (!activeAgent) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFlipFor(activeAgent.id);
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onSelectForPitch(activeAgent);
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onDialAgent(activeAgent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAgent, goPrev, goNext, toggleFlipFor, onSelectForPitch, onDialAgent]);

  const beginDrag = (clientX: number, clientY: number) => {
    pointerStartXRef.current = clientX;
    pointerStartYRef.current = clientY;
    didSwipeRef.current = false;
    setIsDragging(true);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (pointerStartXRef.current === null || pointerStartYRef.current === null) return;
    const dx = clientX - pointerStartXRef.current;
    const dy = clientY - pointerStartYRef.current;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      didSwipeRef.current = true;
      setDragOffsetX(Math.max(-140, Math.min(140, dx)));
    }
  };

  const endDrag = () => {
    if (pointerStartXRef.current === null) return;
    if (dragOffsetX < -44) {
      goNext();
    } else if (dragOffsetX > 44) {
      goPrev();
    }
    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
    setDragOffsetX(0);
    setIsDragging(false);
  };

  const handleCenterCardTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (didSwipeRef.current || !activeAgent) {
      didSwipeRef.current = false;
      return;
    }
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button, a')) return;

    const now = Date.now();
    const delta = now - lastTapTimeRef.current;
    lastTapTimeRef.current = now;

    if (delta > 0 && delta < 280) {
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      onSelectForPitch(activeAgent);
    } else {
      singleTapTimerRef.current = window.setTimeout(() => {
        toggleFlipFor(activeAgent.id);
        singleTapTimerRef.current = null;
      }, 220);
    }
  };

  if (agents.length === 0 || !activeAgent) {
    return null;
  }

  const prevIndex = (safeIndex - 1 + agents.length) % agents.length;
  const nextIndex = (safeIndex + 1) % agents.length;
  const prevAgent = agents.length > 1 ? agents[prevIndex] : null;
  const nextAgent = agents.length > 2 ? agents[nextIndex] : null;
  const isEmergency = activeAgent.handle === '911.emergency.agent';

  return (
    <div className="flex flex-col items-center justify-center gap-2 w-full">
      {/* 3-Card Perspective Carousel Stage (Mobile Chevrons Moved Out of Card Edges!) */}
      <div className="relative w-full flex items-center justify-center overflow-hidden py-0.5">
        {agents.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous card"
            className="hidden md:flex absolute left-4 lg:left-8 z-30 w-11 h-11 rounded-full glass-panel border border-slate-700/80 items-center justify-center text-slate-200 hover:text-white hover:border-cyan-400/60 transition-colors shadow-xl"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="w-full flex items-center justify-center gap-4 lg:gap-8 touch-pan-y px-1 sm:px-0">
          {prevAgent && (
            <div
              onClick={goPrev}
              className="hidden md:block w-[290px] shrink-0 opacity-45 scale-[0.84] hover:opacity-75 transition-all duration-200 cursor-pointer select-none"
              style={{ transform: `translateX(${dragOffsetX * 0.35}px) scale(0.84)` }}
            >
              <AgentIdentityCard
                agent={prevAgent}
                bookings={bookings}
                currency={currency}
                flipped={false}
                isActive={false}
                onFlipToggle={() => goPrev()}
                onPitch={onSelectForPitch}
                onDial={onDialAgent}
                onEmail={onEmailAgent}
                onToggleDiscoverable={onToggleDiscoverable}
                onOpenVideoStudio={onOpenVideoStudio}
              />
            </div>
          )}

          {/* Active Center Full-Mobile-Width Swipable Card */}
          <div
            className="w-full max-w-[376px] sm:max-w-[360px] shrink-0 z-20 cursor-grab active:cursor-grabbing touch-pan-y"
            style={{
              transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX * 0.03}deg)`,
              transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              beginDrag(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => moveDrag(e.clientX, e.clientY)}
            onPointerUp={() => endDrag()}
            onPointerCancel={() => endDrag()}
            onClick={handleCenterCardTap}
          >
            <AgentIdentityCard
              agent={activeAgent}
              bookings={bookings}
              currency={currency}
              flipped={Boolean(flippedMap[activeAgent.id])}
              isActive={true}
              onFlipToggle={() => toggleFlipFor(activeAgent.id)}
              onPitch={onSelectForPitch}
              onDial={onDialAgent}
              onEmail={onEmailAgent}
              onToggleDiscoverable={onToggleDiscoverable}
              onOpenVideoStudio={onOpenVideoStudio}
            />
          </div>

          {nextAgent && (
            <div
              onClick={goNext}
              className="hidden md:block w-[290px] shrink-0 opacity-45 scale-[0.84] hover:opacity-75 transition-all duration-200 cursor-pointer select-none"
              style={{ transform: `translateX(${dragOffsetX * 0.35}px) scale(0.84)` }}
            >
              <AgentIdentityCard
                agent={nextAgent}
                bookings={bookings}
                currency={currency}
                flipped={false}
                isActive={false}
                onFlipToggle={() => goNext()}
                onPitch={onSelectForPitch}
                onDial={onDialAgent}
                onEmail={onEmailAgent}
                onToggleDiscoverable={onToggleDiscoverable}
                onOpenVideoStudio={onOpenVideoStudio}
              />
            </div>
          )}
        </div>

        {agents.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Next card"
            className="hidden md:flex absolute right-4 lg:right-8 z-30 w-11 h-11 rounded-full glass-panel border border-slate-700/80 items-center justify-center text-slate-200 hover:text-white hover:border-cyan-400/60 transition-colors shadow-xl"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Thumb-Friendly Bottom Action Dock with Right Clearance for Mobile Dialer FAB */}
      <div className="w-full max-w-[376px] sm:max-w-[360px] flex flex-col items-center gap-1 pl-1 pr-14 md:px-1">
        <div className="w-full flex items-center justify-center gap-1.5">
          {agents.length > 1 && (
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous card"
              className="md:hidden w-9 h-9 rounded-full glass-panel border border-slate-700/80 flex items-center justify-center text-slate-200 active:scale-95 transition-transform shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div className="glass-panel rounded-full p-1 flex items-center gap-1 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onSelectForPitch(activeAgent)}
              className="flex-1 min-h-[36px] rounded-full bg-cyan-400 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-1 hover:bg-cyan-300 transition-colors whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Pitch</span>
            </button>

            <button
              type="button"
              disabled={isEmergency}
              onClick={() => onEmailAgent(activeAgent)}
              className="w-9 min-h-[36px] rounded-full bg-slate-900 border border-slate-700 text-slate-200 flex items-center justify-center hover:border-cyan-400 disabled:opacity-35 shrink-0"
              aria-label="Email"
              title="Email"
            >
              <Mail className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => toggleFlipFor(activeAgent.id)}
              className="w-9 min-h-[36px] rounded-full bg-slate-900 border border-slate-700 text-cyan-300 flex items-center justify-center hover:border-cyan-400 shrink-0"
              aria-label="Flip Card"
              title="Flip Card"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {agents.length > 1 && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Next card"
              className="md:hidden w-9 h-9 rounded-full glass-panel border border-slate-700/80 flex items-center justify-center text-slate-200 active:scale-95 transition-transform shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-[10px] text-slate-500 font-medium tracking-wide hidden sm:block">
          Tap card to flip · Double-tap to pitch · Arrow keys to navigate
        </p>
      </div>
    </div>
  );
};
