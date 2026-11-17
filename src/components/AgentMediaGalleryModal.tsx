import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Film,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { AgentDoc, AgentMediaItem } from '../types/firestore';
import { resolveAgentMediaGallery } from '../lib/agentImages';
import { emitToast } from '../lib/toast';

interface AgentMediaGalleryModalProps {
  open: boolean;
  agent: AgentDoc;
  initialIndex?: number;
  onClose: () => void;
  onUpdateAgentMedia?: (updated: AgentDoc) => void;
}

export const AgentMediaGalleryModal: React.FC<AgentMediaGalleryModalProps> = ({
  open,
  agent,
  initialIndex = 0,
  onClose,
  onUpdateAgentMedia,
}) => {
  const gallery = React.useMemo(() => resolveAgentMediaGallery(agent), [agent]);
  const [activeIdx, setActiveIdx] = useState(initialIndex);
  // IMPORTANT: Full-screen gallery defaults to UNMUTED per user specification
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [progressSec, setProgressSec] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbStripRef = useRef<HTMLDivElement | null>(null);

  const safeIdx = gallery.length > 0 ? Math.min(Math.max(0, activeIdx), gallery.length - 1) : 0;
  const currentItem: AgentMediaItem | undefined = gallery[safeIdx];

  useEffect(() => {
    if (open) {
      setActiveIdx(initialIndex);
      setMuted(false); // Unmuted default in full-screen gallery view
      setPlaying(true);
      setProgressSec(0);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [open, initialIndex]);

  useEffect(() => {
    setProgressSec(0);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [safeIdx]);

  // 8-second clock for motion_image items + optional voice intro when unmuted
  useEffect(() => {
    if (!open || !currentItem || currentItem.kind !== 'motion_image' || !playing) return;
    const maxDur = Math.min(8, currentItem.durationSeconds || 8);
    const interval = window.setInterval(() => {
      setProgressSec((prev) => {
        const next = prev + 0.1;
        return next >= maxDur ? 0 : Number(next.toFixed(1));
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [open, currentItem, playing]);

  // Speak concise pitch caption for motion_image when unmuted & playing in fullscreen gallery
  useEffect(() => {
    if (!open || !currentItem || currentItem.kind !== 'motion_image') return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!muted && playing) {
      try {
        const text = `${agent.displayName}. ${agent.roleTitle}. ${
          agent.summary || agent.tagline || 'Verified SWITCHZ agent ready for instant engagement.'
        }`;
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.05;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore if speech synthesis blocked by browser autoplay policy
      }
    }
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, [open, currentItem, muted, playing, agent.displayName, agent.roleTitle, agent.summary, agent.tagline]);

  // Sync HTMLVideoElement mute & play state
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = muted;
    if (playing) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [muted, playing, safeIdx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIdx((prev) => (prev - 1 + gallery.length) % gallery.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIdx((prev) => (prev + 1) % gallery.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, gallery.length, onClose]);

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isMotionGifOrWebp =
      file.type === 'image/gif' ||
      (file.type === 'image/webp' && file.name.toLowerCase().includes('motion'));
    const objectUrl = URL.createObjectURL(file);

    let durationSeconds = 8;
    if (isVideo) {
      durationSeconds = await new Promise<number>((resolve) => {
        const tempVid = document.createElement('video');
        tempVid.preload = 'metadata';
        tempVid.src = objectUrl;
        tempVid.onloadedmetadata = () => {
          resolve(Number.isFinite(tempVid.duration) ? tempVid.duration : 8);
        };
        tempVid.onerror = () => resolve(8);
      });
      if (durationSeconds > 8.2) {
        emitToast('Pitch videos are capped at 8 seconds max — auto-clipped to first 8s.', 'warning');
        durationSeconds = 8;
      }
    }

    const dataUrl = await new Promise<string>((resolve) => {
      if (file.size <= 4 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : objectUrl);
        reader.onerror = () => resolve(objectUrl);
        reader.readAsDataURL(file);
      } else {
        resolve(objectUrl);
      }
    });

    const newItem: AgentMediaItem = {
      id: `media_${Date.now()}`,
      kind: isVideo ? 'video' : isMotionGifOrWebp ? 'motion_image' : 'image',
      url: dataUrl,
      thumbnailUrl: isVideo ? undefined : dataUrl,
      title: file.name.replace(/\.[^.]+$/, ''),
      durationSeconds: isVideo || isMotionGifOrWebp ? Math.min(8, Math.round(durationSeconds) || 8) : undefined,
      caption: isVideo ? 'Uploaded 8s Pitch Video' : isMotionGifOrWebp ? 'Motion Image Loop' : 'Gallery Photo',
    };

    if (onUpdateAgentMedia) {
      const nextGallery = [newItem, ...(agent.mediaGallery || resolveAgentMediaGallery(agent))];
      onUpdateAgentMedia({
        ...agent,
        introVideoUrl: isVideo ? dataUrl : agent.introVideoUrl,
        mediaGallery: nextGallery,
      });
      setActiveIdx(0);
      setPlaying(true);
      emitToast(
        isVideo
          ? 'Added 8s pitch video to card gallery!'
          : isMotionGifOrWebp
          ? 'Added motion image to card gallery!'
          : 'Added photo to scrollable card gallery!',
        'success'
      );
    } else {
      emitToast('Open card directory or Studio to persist uploaded media.', 'info');
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-zinc-950/95 text-white flex flex-col justify-between backdrop-blur-xl select-none"
      onClick={onClose}
    >
      {/* Top Lightbox Chrome */}
      <div
        className="px-3 sm:px-6 py-3 flex items-center justify-between gap-3 border-b border-white/10 bg-zinc-950/70 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center shrink-0 transition-colors"
            aria-label="Back to card"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-bold truncate">
              {agent.displayName} — {currentItem?.title || 'Media Gallery'}
            </h2>
            <p className="text-[11px] font-mono text-zinc-400 truncate tabular-nums">
              {safeIdx + 1} / {gallery.length} ·{' '}
              {currentItem?.kind === 'video'
                ? 'Pitch Video (8s max)'
                : currentItem?.kind === 'motion_image'
                ? 'Motion Portrait (8s Loop)'
                : 'Identity & Workspace Photo'}{' '}
              · {muted ? 'Muted' : 'Unmuted'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*,.gif,.webp"
            onChange={handleUploadMedia}
            className="hidden"
          />
          {onUpdateAgentMedia && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[36px] px-3 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Upload photo, motion image, or 8s pitch video"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Photo / 8s Video</span>
              <span className="sm:hidden">Upload</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className={`min-h-[36px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
              !muted
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                : 'bg-white/10 border-white/15 text-zinc-300 hover:bg-white/20'
            }`}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{muted ? 'Muted' : 'Unmuted'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors"
            aria-label="Close Full Screen Gallery"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Centered Media Canvas + Left/Right Navigation */}
      <div
        className="flex-1 min-h-0 relative flex items-center justify-center p-3 sm:p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {gallery.length > 1 && (
          <button
            type="button"
            onClick={() => setActiveIdx((prev) => (prev - 1 + gallery.length) % gallery.length)}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-900/85 hover:bg-zinc-800 border border-white/20 flex items-center justify-center text-white shadow-xl"
            aria-label="Previous media"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="relative w-full max-w-4xl h-full max-h-[72dvh] flex items-center justify-center rounded-2xl overflow-hidden bg-zinc-900/70 border border-white/10 shadow-2xl">
          {currentItem?.kind === 'video' ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                src={currentItem.url}
                poster={currentItem.thumbnailUrl}
                controls
                autoPlay
                playsInline
                muted={muted}
                onTimeUpdate={(e) => {
                  const vid = e.currentTarget;
                  if (vid.currentTime >= 8) {
                    vid.currentTime = 0;
                    if (playing) vid.play().catch(() => {});
                  }
                  setProgressSec(Number(Math.min(8, vid.currentTime).toFixed(1)));
                }}
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 border border-white/15 text-[11px] font-mono tabular-nums flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-sky-400" />
                <span>8s Max Pitch · {progressSec.toFixed(1)}s</span>
              </div>
            </div>
          ) : currentItem?.kind === 'motion_image' ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
              <img
                src={currentItem.url}
                alt={currentItem.title || agent.displayName}
                className={`w-full h-full object-contain transition-transform duration-[4000ms] ease-out ${
                  playing ? 'scale-110 translate-y-[-1%]' : 'scale-100'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25 pointer-events-none" />

              {/* Play / Pause & 8s Motion Progress Overlay */}
              <div className="absolute bottom-4 inset-x-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    className="h-9 px-3.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg"
                  >
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{playing ? 'Pause Motion' : 'Play Motion'}</span>
                  </button>
                  <span className="text-xs font-mono text-zinc-200 bg-black/65 px-2.5 py-1 rounded-md border border-white/15 tabular-nums">
                    {progressSec.toFixed(1)}s / 8.0s
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 transition-all duration-100"
                    style={{ width: `${Math.min(100, (progressSec / 8) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={currentItem?.url}
              alt={currentItem?.title || agent.displayName}
              className="max-w-full max-h-full w-auto h-auto object-contain"
            />
          )}
        </div>

        {gallery.length > 1 && (
          <button
            type="button"
            onClick={() => setActiveIdx((prev) => (prev + 1) % gallery.length)}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-900/85 hover:bg-zinc-800 border border-white/20 flex items-center justify-center text-white shadow-xl"
            aria-label="Next media"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom Scrollable Thumbnail Gallery Strip */}
      <div
        className="px-3 sm:px-6 py-3 border-t border-white/10 bg-zinc-950/85 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={thumbStripRef}
          onWheel={(e) => {
            if (thumbStripRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              thumbStripRef.current.scrollLeft += e.deltaY;
            }
          }}
          className="max-w-4xl mx-auto flex items-center justify-start sm:justify-center gap-2.5 overflow-x-auto no-scrollbar py-0.5"
        >
          {gallery.map((item, idx) => {
            const isSelected = idx === safeIdx;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`relative w-16 h-14 sm:w-20 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  isSelected
                    ? 'border-white scale-105 shadow-lg'
                    : 'border-white/15 opacity-60 hover:opacity-100'
                }`}
              >
                {item.kind === 'video' ? (
                  <video
                    src={item.url}
                    poster={item.thumbnailUrl}
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={item.thumbnailUrl || item.url}
                    alt={item.title || `Slide ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
                <span className="absolute bottom-1 right-1 w-5 h-5 rounded-md bg-black/75 border border-white/20 flex items-center justify-center text-white">
                  {item.kind === 'video' ? (
                    <Play className="w-2.5 h-2.5 fill-white" />
                  ) : item.kind === 'motion_image' ? (
                    <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                  ) : (
                    <ImageIcon className="w-2.5 h-2.5" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};
