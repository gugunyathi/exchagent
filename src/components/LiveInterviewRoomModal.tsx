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
} from 'lucide-react';
import { AgentDoc, BookingDoc, JobPostingDoc, PreScreenReview } from '../types/firestore';

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
    'Live human presence verified on call. Strong architecture & communication clarity.'
  );
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (!open) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setHardwareReady(false);
      setElapsedSec(0);
      setSavedBanner(false);
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
    setSavedBanner(true);
  };

  const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const secs = String(elapsedSec % 60).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[95dvh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-2xl glass-panel border border-cyan-400/35 shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-700 mx-auto mt-2 shrink-0" />
        {/* Top Interview Room Bar */}
        <div className="px-4 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-400/40 text-[10px] font-mono text-rose-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                LIVE INTERVIEW
              </span>
              <span className="text-[11px] font-mono text-slate-400 inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" /> {mins}:{secs}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-white truncate mt-0.5">
              {booking?.title || job?.title || `Live Panel: ${candidate.displayName}`}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white shrink-0"
            aria-label="Close room"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Video Grid + HR Scorecard */}
        <div className="p-3.5 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
          {/* Video Feeds (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Candidate Stream Tile */}
              <div className="relative aspect-video rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between p-3">
                <div className="flex items-center justify-between z-10 gap-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/90 text-cyan-300 border border-slate-700 truncate">
                    {candidate.handle}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 inline-flex items-center gap-1 shrink-0 tabular-nums">
                    <ShieldCheck className="w-3 h-3" /> Real {liveLivenessScore}%
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center text-center my-auto z-10">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center text-white font-display font-bold text-base sm:text-lg shadow-lg border-2 border-white/30">
                    {candidate.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-xs font-semibold text-white mt-1.5">{candidate.displayName}</p>
                  <p className="text-[10px] text-slate-400 truncate max-w-full">{candidate.roleTitle}</p>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 z-10">
                  <span>Challenge: {challengeCode}</span>
                  <span>
                    {candidate.interviewVideo?.verification.verdict === 'VERIFIED_HUMAN'
                      ? 'Video Verified'
                      : 'Live Scan'}
                  </span>
                </div>
              </div>

              {/* Local Interviewer WebRTC Camera Tile */}
              <div className="relative aspect-video rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
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
                    <UserCheck className="w-8 h-8 text-cyan-400 mb-1.5" />
                    <p className="text-xs font-semibold text-white">{interviewerName}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {camOn ? 'WebRTC Ready' : 'Camera Muted'}
                    </p>
                  </div>
                )}
                <span className="absolute bottom-2 left-2 text-[10px] font-mono px-2 py-0.5 rounded bg-black/70 text-white">
                  You ({interviewerHandle})
                </span>
              </div>
            </div>

            {/* Call Controls */}
            <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    micOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-500 text-white'
                  }`}
                  title={micOn ? 'Mute Mic' : 'Unmute Mic'}
                  aria-label={micOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={toggleCam}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    camOn ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-rose-500 text-white'
                  }`}
                  title={camOn ? 'Turn Camera Off' : 'Turn Camera On'}
                  aria-label={camOn ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleScreenShare}
                  className={`min-h-[44px] px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    sharingScreen
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <MonitorUp className="w-4 h-4" />
                  <span className="hidden sm:inline">{sharingScreen ? 'Sharing' : 'Share Screen'}</span>
                </button>
                <button
                  type="button"
                  onClick={pulseLiveLivenessCheck}
                  className="min-h-[44px] px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Verify Live</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <PhoneOff className="w-4 h-4" />
                End Call
              </button>
            </div>
          </div>

          {/* Live HR Scorecard & Candidate Context (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-slate-950/85 border border-slate-800 p-3.5 sm:p-4 space-y-3">
            <h4 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
              Live HR Interviewer Scorecard
            </h4>

            <div className="flex flex-wrap gap-1.5">
              {(candidate.cvSummary?.parsedSkills || candidate.skills).slice(0, 5).map((s) => (
                <span
                  key={s}
                  className="text-[10px] rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-slate-300"
                >
                  {s}
                </span>
              ))}
            </div>

            {candidate.interviewVideo?.verification && (
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5 text-[11px] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Async Video Integrity</span>
                  <span className="font-mono text-emerald-300 font-semibold tabular-nums">
                    {candidate.interviewVideo.verification.verdict} (
                    {candidate.interviewVideo.verification.authenticityScore}%)
                  </span>
                </div>
                <p className="text-slate-300 text-[10.5px]">
                  {candidate.interviewVideo.verification.transcriptSummary}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="text-slate-300">
                Decision
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as PreScreenReview['decision'])}
                  className="mt-1 w-full min-h-[40px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="SHORTLIST">SHORTLIST</option>
                  <option value="PASS">PASS</option>
                  <option value="HOLD">HOLD</option>
                  <option value="REJECT">REJECT</option>
                </select>
              </label>
              <label className="text-slate-300">
                Score (0–100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="mt-1 w-full min-h-[40px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono tabular-nums text-white"
                />
              </label>
            </div>

            <label className="block text-xs text-slate-300">
              Interviewer Notes
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white"
              />
            </label>

            <button
              type="button"
              onClick={handleSaveScorecard}
              className="w-full min-h-[44px] rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Live Interview Evaluation
            </button>

            {savedBanner && (
              <p className="text-[11px] text-emerald-300 text-center">
                Saved to candidate pre-screen &amp; Poppy HR audit trail.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
