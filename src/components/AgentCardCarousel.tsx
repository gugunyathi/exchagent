import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AgentDoc, BookingDoc, CurrencyMode } from '../types/firestore';
import { AgentIdentityCard } from './AgentIdentityCard';

interface AgentCardCarouselProps {
  agents: AgentDoc[];
  bookings: BookingDoc[];
  currency: CurrencyMode;
  selectedAgentId?: string | null;
  onActiveAgentChange?: (agent: AgentDoc) => void;
  onSelectForEngage: (agent: AgentDoc) => void;
  onDialAgent: (agent: AgentDoc) => void;
  onEmailAgent: (agent: AgentDoc) => void;
  onToggleDiscoverable: (agentId: string) => void;
  onOpenVideoStudio?: (agent: AgentDoc) => void;
  onCustomizeCard?: (agent: AgentDoc) => void;
  onSaveContact?: (agent: AgentDoc) => void;
  savedContactHandles?: Set<string>;
  onOpenProfileHistory?: (agent: AgentDoc) => void;
  onOpenCompanyHr?: (agent: AgentDoc) => void;
  onUpdateAgentMedia?: (updated: AgentDoc) => void;
}

export const AgentCardCarousel: React.FC<AgentCardCarouselProps> = ({
  agents,
  bookings,
  currency,
  selectedAgentId,
  onActiveAgentChange,
  onSelectForEngage,
  onDialAgent,
  onEmailAgent,
  onToggleDiscoverable,
  onOpenVideoStudio,
  onCustomizeCard,
  onSaveContact,
  savedContactHandles,
  onOpenProfileHistory,
  onOpenCompanyHr,
  onUpdateAgentMedia,
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
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        onSelectForEngage(activeAgent);
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onDialAgent(activeAgent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAgent, goPrev, goNext, toggleFlipFor, onSelectForEngage, onDialAgent]);

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
      onSelectForEngage(activeAgent);
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

  return (
    <div className="flex flex-col items-center justify-center gap-2 w-full">
      <div className="relative w-full flex items-center justify-center overflow-x-clip py-1">
        <div className="w-full flex items-center justify-center gap-4 lg:gap-8 touch-pan-y px-1.5 sm:px-0">
          {prevAgent && (
            <div
              onClick={goPrev}
              className="hidden md:block w-[286px] shrink-0 opacity-40 scale-[0.84] hover:opacity-70 transition-all duration-200 cursor-pointer select-none"
              style={{ transform: `translateX(${dragOffsetX * 0.35}px) scale(0.84)` }}
            >
              <AgentIdentityCard
                agent={prevAgent}
                bookings={bookings}
                currency={currency}
                flipped={false}
                isActive={false}
                onFlipToggle={() => goPrev()}
                onEngage={onSelectForEngage}
                onDial={onDialAgent}
                onEmail={onEmailAgent}
                onToggleDiscoverable={onToggleDiscoverable}
                onOpenVideoStudio={onOpenVideoStudio}
              />
            </div>
          )}

          {/* Active Center Swipable Card with Floating Left/Right Edge Scroll Buttons */}
          <div
            className="relative w-full max-w-[376px] sm:max-w-[360px] shrink-0 z-20 cursor-grab active:cursor-grabbing touch-pan-y"
            style={{
              transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX * 0.025}deg)`,
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
            {agents.length > 1 && (
              <>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  aria-label="Previous card"
                  title="Previous card"
                  className="absolute left-0.5 sm:-left-4 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-300 dark:border-white/20 flex items-center justify-center text-zinc-800 dark:text-zinc-100 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all shadow-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  aria-label="Next card"
                  title="Next card"
                  className="absolute right-0.5 sm:-right-4 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-300 dark:border-white/20 flex items-center justify-center text-zinc-800 dark:text-zinc-100 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all shadow-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            <AgentIdentityCard
              agent={activeAgent}
              bookings={bookings}
              currency={currency}
              flipped={Boolean(flippedMap[activeAgent.id])}
              isActive={true}
              onFlipToggle={() => toggleFlipFor(activeAgent.id)}
              onEngage={onSelectForEngage}
              onDial={onDialAgent}
              onEmail={onEmailAgent}
              onToggleDiscoverable={onToggleDiscoverable}
              onOpenVideoStudio={onOpenVideoStudio}
              onCustomize={onCustomizeCard}
              onSaveContact={onSaveContact}
              isSavedContact={Boolean(savedContactHandles?.has(activeAgent.handle.toLowerCase()))}
              onOpenProfileHistory={onOpenProfileHistory}
              onOpenCompanyHr={onOpenCompanyHr}
              onUpdateAgentMedia={onUpdateAgentMedia}
            />
          </div>

          {nextAgent && (
            <div
              onClick={goNext}
              className="hidden md:block w-[286px] shrink-0 opacity-40 scale-[0.84] hover:opacity-70 transition-all duration-200 cursor-pointer select-none"
              style={{ transform: `translateX(${dragOffsetX * 0.35}px) scale(0.84)` }}
            >
              <AgentIdentityCard
                agent={nextAgent}
                bookings={bookings}
                currency={currency}
                flipped={false}
                isActive={false}
                onFlipToggle={() => goNext()}
                onEngage={onSelectForEngage}
                onDial={onDialAgent}
                onEmail={onEmailAgent}
                onToggleDiscoverable={onToggleDiscoverable}
                onOpenVideoStudio={onOpenVideoStudio}
                onCustomize={onCustomizeCard}
              />
            </div>
          )}
        </div>
      </div>

      <p className="text-[10.5px] text-zinc-600 dark:text-zinc-500 font-medium hidden sm:block">
        Click card to flip · Double-click to engage · Arrow keys to navigate
      </p>
    </div>
  );
};
