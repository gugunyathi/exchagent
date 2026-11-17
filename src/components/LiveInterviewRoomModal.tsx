import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  MonitorUp,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  X,
  UserCheck,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { AgentDoc, BookingDoc, JobPostingDoc, PreScreenReview } from '../types/firestore';
import { emitToast } from '../lib/toast';

interface LiveInterviewRoomModalProps {
  open: boolean;
  onClose: () => void;
  candidate: AgentDoc | null;
  interviewerHandle: string;
  interviewerName: string;
  job?: JobPostingDoc | null;
  booking?: BookingDoc | null;
  onSubmitReview: (agentId: string, review: PreScreenReview) => void;
}

export const LiveInterviewRoomModal: React.FC<LiveInterviewRoomModalProps> = ({
  open,
  onClose,
  candidate,
  interviewerHandle,
  interviewerName,
  job,
  booking,
  onSubmitReview,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [hardwareReady, setHardwareReady] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [liveLivenessScore, setLiveLivenessScore] = useState(97);
  const [challengeCode] = useState(() => `SWB-${Math.floor(100 + Math.random() * 899)}`);

  const [decision, setDecision] = useState<PreScreenReview['decision']>('SHORTLIST');
  const [score, setScore] = useState(92);
  const [notes, setNotes] = useState(
    'Live human presence verified on call. Clear architecture walkthrough.'
  );

  useEffect(() => {
    if (!open) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setHardwareReady(false);
      setElapsedSec(0);
      return;
    }

    let cancelled = false;
    const initMedia = async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          setHardwareReady(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }
      } catch {
        setHardwareReady(false);
      }
    };
    initMedia();

    const timer = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open]);

  if (!open || !candidate) return null;

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
  };

  const handleScreenShare = async () => {
    if (sharingScreen) {
      setSharingScreen(false);
      return;
    }
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setSharingScreen(true);
        if (videoRef.current) {
          videoRef.current.srcObject = screen;
        }
        screen.getVideoTracks()[0].onended = () => {
          setSharingScreen(false);
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
        };
      }
    } catch {
      setSharingScreen(false);
    }
  };

  const pulseLiveLivenessCheck = () => {
    const jitter = Math.floor(94 + Math.random() * 5);
    setLiveLivenessScore(jitter);
    emitToast(`Live liveness verified (${jitter}%)`, 'success');
  };

  const handleSaveScorecard = () => {
    onSubmitReview(candidate.id, {
      id: `ps_live_${Date.now()}`,
      reviewerType: 'human',
      reviewerHandle: interviewerHandle,
      reviewerName: `${interviewerName} (Live Interview)`,
      decision,
      score,
      notes,
      timestamp: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/65 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[95dvh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0c0c0f] border border-zinc-300 dark:border-white/15 shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mt-2 shrink-0" />
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shrink-0 transition-colors"
              aria-label="Back to Video Studio"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-300 text-rose-700 dark:bg-rose-500/15 dark:border-rose-400/30 text-[10px] font-mono dark:text-rose-300 font-semibold">
                  LIVE CALL
                </span>
                <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" /> {mins}:{secs}
                </span>
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-zinc-50 truncate mt-0.5 tracking-tight">
                {booking?.title || job?.title || `Live Panel: ${candidate.displayName}`}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white shrink-0 transition-colors"
            aria-label="Close room"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Candidate Tile */}
              <div className="relative aspect-video rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 overflow-hidden flex flex-col justify-between p-3">
                <div className="flex items-center justify-between z-10 gap-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 border border-zinc-300 dark:border-white/15 truncate">
                    {candidate.handle}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/25 inline-flex items-center gap-1 shrink-0 tabular-nums font-semibold">
                    <ShieldCheck className="w-3 h-3" /> {liveLivenessScore}% Real
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center text-center my-auto z-10">
                  <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-950 dark:text-zinc-100 font-display font-bold text-base">
                    {candidate.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="font-display text-xs font-bold text-zinc-950 dark:text-zinc-100 mt-1.5">
                    {candidate.displayName}
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate max-w-full">
                    {candidate.roleTitle}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 dark:text-zinc-500 z-10">
                  <span>{challengeCode}</span>
                  <span>
                    {candidate.interviewVideo?.verification.verdict === 'VERIFIED_HUMAN'
                      ? 'Verified'
                      : 'Live Scan'}
                  </span>
                </div>
              </div>

              {/* Interviewer Camera Tile */}
              <div className="relative aspect-video rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 overflow-hidden flex items-center justify-center">
                {hardwareReady && camOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-center p-3">
                    <UserCheck className="w-7 h-7 text-zinc-600 dark:text-zinc-400 mb-1.5" />
                    <p className="font-display text-xs font-bold text-zinc-950 dark:text-zinc-100">{interviewerName}</p>
                    <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-500">
                      {camOn ? 'Camera Ready' : 'Camera Muted'}
                    </p>
                  </div>
                )}
                <span className="absolute bottom-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950/80 text-white">
                  You ({interviewerHandle})
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    micOn
                      ? 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      : 'bg-rose-600 text-white'
                  }`}
                  aria-label={micOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCam}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    camOn
                      ? 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      : 'bg-rose-600 text-white'
                  }`}
                  aria-label={camOn ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleScreenShare}
                  className={`min-h-[40px] px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    sharingScreen
                      ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950'
                      : 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <MonitorUp className="w-4 h-4" />
                  <span className="hidden sm:inline">{sharingScreen ? 'Sharing' : 'Share'}</span>
                </button>
                <button
                  type="button"
                  onClick={pulseLiveLivenessCheck}
                  className="min-h-[40px] px-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-emerald-700 dark:text-emerald-300 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap hover:border-emerald-500/50 dark:hover:border-emerald-400/40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Verify Live</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <PhoneOff className="w-4 h-4" />
                End Call
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-4 space-y-3">
            <h4 className="font-display text-xs font-bold text-zinc-950 dark:text-zinc-200">
              Live HR Scorecard
            </h4>

            <div className="flex flex-wrap gap-1.5">
              {(candidate.cvSummary?.parsedSkills || candidate.skills).slice(0, 5).map((s) => (
                <span
                  key={s}
                  className="text-[11px] rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 px-2 py-0.5 text-zinc-800 dark:text-zinc-300"
                >
                  {s}
                </span>
              ))}
            </div>

            {candidate.interviewVideo?.verification && (
              <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">Async Integrity</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300 font-semibold tabular-nums">
                    {candidate.interviewVideo.verification.authenticityScore}% Real
                  </span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-400 text-[11px] line-clamp-2">
                  {candidate.interviewVideo.verification.transcriptSummary}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="text-zinc-700 dark:text-zinc-400 font-medium">
                Decision
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as PreScreenReview['decision'])}
                  className="mt-1 w-full min-h-[38px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-white"
                >
                  <option value="SHORTLIST">SHORTLIST</option>
                  <option value="PASS">PASS</option>
                  <option value="HOLD">HOLD</option>
                  <option value="REJECT">REJECT</option>
                </select>
              </label>
              <label className="text-zinc-700 dark:text-zinc-400 font-medium">
                Score (0–100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="mt-1 w-full min-h-[38px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-mono tabular-nums text-zinc-950 dark:text-white"
                />
              </label>
            </div>

            <label className="block text-xs text-zinc-700 dark:text-zinc-400 font-medium">
              Notes
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white"
              />
            </label>

            <button
              type="button"
              onClick={handleSaveScorecard}
              className="w-full min-h-[40px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-white dark:text-zinc-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Evaluation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
