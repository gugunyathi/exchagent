import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface SwipeScrollAreaProps {
  children: React.ReactNode;
  direction?: 'vertical' | 'horizontal' | 'both';
  className?: string;
  innerClassName?: string;
  showArrows?: boolean;
  arrowSize?: 'sm' | 'md';
  fadeEdges?: boolean;
  stepPx?: number;
}

export const SwipeScrollArea: React.FC<SwipeScrollAreaProps> = ({
  children,
  direction = 'vertical',
  className = '',
  innerClassName = '',
  showArrows = true,
  arrowSize,
  fadeEdges = true,
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

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (direction !== 'horizontal') return;
    const el = scrollerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 2) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
      el.scrollLeft += e.deltaY;
    }
  };

  const overflowClass =
    direction === 'horizontal'
      ? 'overflow-x-auto overflow-y-hidden touch-pan-x'
      : direction === 'both'
      ? 'overflow-auto'
      : 'overflow-y-auto overflow-x-hidden touch-pan-y';

  const allowV = direction === 'vertical' || direction === 'both';
  const resolvedArrowSize = arrowSize ?? (direction === 'horizontal' ? 'sm' : 'md');
  const arrowBtnSize =
    resolvedArrowSize === 'sm' ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-7 h-7 sm:w-8 sm:h-8';
  const arrowIconSize = resolvedArrowSize === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`relative min-h-0 min-w-0 ${className}`}>
      <div
        ref={scrollerRef}
        tabIndex={allowV ? 0 : undefined}
        data-swipe-vertical={allowV ? 'true' : undefined}
        onScroll={updateEdges}
        onWheel={handleWheel}
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

      {fadeEdges && edges.up && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-white/85 dark:from-zinc-950/85 to-transparent z-10 rounded-t-[inherit]"
        />
      )}
      {fadeEdges && edges.down && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white/85 dark:from-zinc-950/85 to-transparent z-10 rounded-b-[inherit]"
        />
      )}
      {fadeEdges && edges.left && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-white/95 dark:from-zinc-950/95 via-white/60 dark:via-zinc-950/60 to-transparent z-10 rounded-l-[inherit]"
        />
      )}
      {fadeEdges && edges.right && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-white/95 dark:from-zinc-950/95 via-white/60 dark:via-zinc-950/60 to-transparent z-10 rounded-r-[inherit]"
        />
      )}

      {showArrows && edges.up && (
        <button
          type="button"
          onClick={() => scrollByDir(0, -stepPx)}
          aria-label="Scroll up"
          className={`absolute top-1.5 left-1/2 -translate-x-1/2 z-20 ${arrowBtnSize} rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform active:scale-95`}
        >
          <ChevronUp className={arrowIconSize} />
        </button>
      )}

      {showArrows && edges.down && (
        <button
          type="button"
          onClick={() => scrollByDir(0, stepPx)}
          aria-label="Scroll down"
          className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 ${arrowBtnSize} rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform active:scale-95`}
        >
          <ChevronDown className={arrowIconSize} />
        </button>
      )}

      {showArrows && edges.left && (
        <button
          type="button"
          onClick={() => scrollByDir(-stepPx, 0)}
          aria-label="Scroll left"
          className={`absolute left-1 top-1/2 -translate-y-1/2 z-20 ${arrowBtnSize} rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform active:scale-95`}
        >
          <ChevronLeft className={arrowIconSize} />
        </button>
      )}

      {showArrows && edges.right && (
        <button
          type="button"
          onClick={() => scrollByDir(stepPx, 0)}
          aria-label="Scroll right"
          className={`absolute right-1 top-1/2 -translate-y-1/2 z-20 ${arrowBtnSize} rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform active:scale-95`}
        >
          <ChevronRight className={arrowIconSize} />
        </button>
      )}
    </div>
  );
};
