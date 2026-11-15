import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface SwipeScrollAreaProps {
  children: React.ReactNode;
  direction?: 'vertical' | 'horizontal' | 'both';
  className?: string;
  innerClassName?: string;
  showArrows?: boolean;
  stepPx?: number;
}

export const SwipeScrollArea: React.FC<SwipeScrollAreaProps> = ({
  children,
  direction = 'vertical',
  className = '',
  innerClassName = '',
  showArrows = true,
  stepPx = 220,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    moved: false,
  });

  const [edges, setEdges] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const allowV = direction === 'vertical' || direction === 'both';
    const allowH = direction === 'horizontal' || direction === 'both';

    const up = allowV && el.scrollTop > 6;
    const down = allowV && el.scrollTop + el.clientHeight < el.scrollHeight - 6;
    const left = allowH && el.scrollLeft > 6;
    const right = allowH && el.scrollLeft + el.clientWidth < el.scrollWidth - 6;

    setEdges((prev) =>
      prev.up === up && prev.down === down && prev.left === left && prev.right === right
        ? prev
        : { up, down, left, right }
    );
  }, [direction]);

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateEdges());
    ro.observe(el);
    if (el.firstElementChild) {
      ro.observe(el.firstElementChild);
    }
    window.addEventListener('resize', updateEdges);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateEdges);
    };
  }, [updateEdges, children]);

  // Global keyboard vertical scrolling for the active/primary visible vertical SwipeScrollArea
  useEffect(() => {
    const allowV = direction === 'vertical' || direction === 'both';
    if (!allowV) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      if (
        key !== 'ArrowDown' &&
        key !== 'ArrowUp' &&
        key !== 'PageDown' &&
        key !== 'PageUp' &&
        key !== 'Home' &&
        key !== 'End'
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }

      const el = scrollerRef.current;
      if (!el || el.scrollHeight <= el.clientHeight + 2) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const focusedInsideMe = Boolean(activeEl && el.contains(activeEl));

      if (!focusedInsideMe) {
        // Find all currently visible, vertically scrollable SwipeScrollAreas
        const topDialog = Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0')).pop();
        const searchRoot: ParentNode = topDialog || document;
        const candidates = Array.from(
          searchRoot.querySelectorAll<HTMLElement>('[data-swipe-vertical="true"]')
        ).filter((node) => {
          if (node.scrollHeight <= node.clientHeight + 2) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

        if (candidates.length === 0) return;

        // If focus is inside a DIFFERENT vertical scroller that can consume the scroll, defer to it
        const focusedOther = candidates.find(
          (node) => node !== el && activeEl && node.contains(activeEl)
        );
        if (focusedOther) return;

        // Otherwise only respond if THIS scroller is the largest visible vertical scroller in the active layer
        const primary = candidates.reduce((best, cur) =>
          cur.clientHeight > best.clientHeight ? cur : best
        );
        if (primary !== el) return;
      }

      const step = key === 'PageDown' || key === 'PageUp' ? Math.max(160, Math.round(el.clientHeight * 0.78)) : 110;
      if (key === 'ArrowDown' || key === 'PageDown') {
        e.preventDefault();
        el.scrollBy({ top: step, behavior: 'smooth' });
      } else if (key === 'ArrowUp' || key === 'PageUp') {
        e.preventDefault();
        el.scrollBy({ top: -step, behavior: 'smooth' });
      } else if (key === 'Home') {
        e.preventDefault();
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (key === 'End') {
        e.preventDefault();
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [direction]);

  const scrollByDir = (dx: number, dy: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-no-drag-scroll="true"]')) {
      return;
    }
    const el = scrollerRef.current;
    if (!el) return;
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds.active) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      ds.moved = true;
    }
    if (direction === 'horizontal' || direction === 'both') {
      el.scrollLeft = ds.scrollLeft - dx;
    }
    if (direction === 'vertical' || direction === 'both') {
      el.scrollTop = ds.scrollTop - dy;
    }
  };

  const handlePointerUp = () => {
    dragStateRef.current.active = false;
  };

  const overflowClass =
    direction === 'horizontal'
      ? 'overflow-x-auto overflow-y-hidden touch-pan-x'
      : direction === 'both'
      ? 'overflow-auto'
      : 'overflow-y-auto overflow-x-hidden touch-pan-y';

  const allowV = direction === 'vertical' || direction === 'both';

  return (
    <div className={`relative min-h-0 min-w-0 ${className}`}>
      <div
        ref={scrollerRef}
        tabIndex={allowV ? 0 : undefined}
        data-swipe-vertical={allowV ? 'true' : undefined}
        onScroll={updateEdges}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ WebkitOverflowScrolling: 'touch' }}
        className={`w-full h-full no-scrollbar overscroll-contain focus:outline-none ${overflowClass} ${innerClassName}`}
      >
        {children}
      </div>

      {showArrows && edges.up && (
        <button
          type="button"
          onClick={() => scrollByDir(0, -stepPx)}
          aria-label="Scroll up"
          className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/85 backdrop-blur-md border border-cyan-400/35 text-cyan-200 flex items-center justify-center shadow-lg hover:bg-slate-800 transition-transform active:scale-95"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      )}

      {showArrows && edges.down && (
        <button
          type="button"
          onClick={() => scrollByDir(0, stepPx)}
          aria-label="Scroll down"
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/85 backdrop-blur-md border border-cyan-400/35 text-cyan-200 flex items-center justify-center shadow-lg hover:bg-slate-800 transition-transform active:scale-95"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {showArrows && edges.left && (
        <button
          type="button"
          onClick={() => scrollByDir(-stepPx, 0)}
          aria-label="Scroll left"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/90 backdrop-blur-md border border-cyan-400/35 text-cyan-200 flex items-center justify-center shadow-lg hover:bg-slate-800 transition-transform active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {showArrows && edges.right && (
        <button
          type="button"
          onClick={() => scrollByDir(stepPx, 0)}
          aria-label="Scroll right"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-900/90 backdrop-blur-md border border-cyan-400/35 text-cyan-200 flex items-center justify-center shadow-lg hover:bg-slate-800 transition-transform active:scale-95"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
