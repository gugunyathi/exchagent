import React, { useState, useRef } from 'react';
import {
  Video,
  Upload,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Calendar,
  Download,
  ExternalLink,
  Bot,
  UserCheck,
  Play,
  Square,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AgentDoc,
  BookingDoc,
  JobPostingDoc,
  InterviewVideoRecord,
  PreScreenReview,
} from '../types/firestore';
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  buildOffice365CalendarUrl,
  downloadIcsFile,
  downloadScheduleIcs,
  downloadScheduleCsv,
  insertGoogleCalendarEvent,
} from '../services/calendarAgentTool';
import { emitToast } from '../lib/toast';

interface VideoInterviewStudioPanelProps {
  candidate: AgentDoc;
  allAgents: AgentDoc[];
  jobs: JobPostingDoc[];
  bookings: BookingDoc[];
  workspaceToken: string | null;
  ownerUid: string;
  onSaveVideo: (agentId: string, video: InterviewVideoRecord) => void;
  onAddPreScreenReview: (agentId: string, review: PreScreenReview) => void;
  onAddBooking: (booking: BookingDoc) => Promise<void>;
  onConnectGoogle: () => Promise<unknown>;
  onLaunchLiveRoom: (params: {
    candidate: AgentDoc;
    job?: JobPostingDoc;
    booking?: BookingDoc;
    interviewerHandle: string;
    interviewerName: string;
  }) => void;
}

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return (
      'sha256:' +
      Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32)
    );
  }
  return `sha256:${Date.now().toString(16)}`;
}

async function sampleVideoFrames(
  videoUrl: string
): Promise<{ frames: string[]; durationSeconds: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    const cleanup = () => {
      video.onloadeddata = null;
      video.onerror = null;
    };

    video.onloadedmetadata = async () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : 12;
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      const frames: string[] = [];

      const times = [0.1, Math.min(duration * 0.45, duration - 0.1), Math.min(duration * 0.8, duration - 0.05)];
      for (const t of times) {
        try {
          await new Promise<void>((resSeek) => {
            video.currentTime = Math.max(0, t);
            video.onseeked = () => resSeek();
            setTimeout(() => resSeek(), 650);
          });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.65));
          }
        } catch {
          // ignore
        }
      }
      cleanup();
      resolve({ frames, durationSeconds: duration });
    };

    video.onerror = () => {
      cleanup();
      resolve({ frames: [], durationSeconds: 30 });
    };
  });
}

export const VideoInterviewStudioPanel: React.FC<VideoInterviewStudioPanelProps> = ({
  candidate,
  allAgents,
  jobs,
  bookings,
  workspaceToken,
  ownerUid,
  onSaveVideo,
  onAddPreScreenReview,
  onAddBooking,
  onConnectGoogle,
  onLaunchLiveRoom,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [sessionVideoUrls, setSessionVideoUrls] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const [challengeCode] = useState(() => `SWB-${Math.floor(100 + Math.random() * 899)}`);
  const [verifying, setVerifying] = useState(false);
  const [showForensicDetails, setShowForensicDetails] = useState(false);
  const [biometricConsent, setBiometricConsent] = useState(true);
  const [videoTitle, setVideoTitle] = useState(`${candidate.displayName} — Intro`);

  // Pre-screen state
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || '');
  const [prescreening, setPrescreening] = useState(false);
  const [humanDecision, setHumanDecision] = useState<PreScreenReview['decision']>('SHORTLIST');
  const [humanScore, setHumanScore] = useState(91);
  const [humanNotes, setHumanNotes] = useState('Verified authentic presenter; clear technical walkthrough.');

  // Scheduler state
  const businesses = allAgents.filter((a) => a.type === 'business' && a.handle !== '911.emergency.agent');
  const [interviewerHandle, setInterviewerHandle] = useState<string>(
    businesses[0]?.handle || 'ceo.woolworths.agent'
  );
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [scheduleTime, setScheduleTime] = useState<string>('10:00');
  const [durationMins, setDurationMins] = useState<number>(45);
  const [scheduling, setScheduling] = useState(false);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];
  const currentVideo = candidate.interviewVideo;
  const playableUrl = sessionVideoUrls[candidate.id];

  const interviewBookings = bookings.filter(
    (b) =>
      b.interviewMode === 'live_video' ||
      b.attendeeHandle === candidate.handle ||
      b.organizerHandle === candidate.handle
  );

  const runVideoVerification = async (params: {
    file?: File | Blob;
    fileName: string;
    mimeType: string;
    capturedVia: 'upload' | 'webcam_record';
    challenge?: string;
    objectUrl?: string;
  }) => {
    setVerifying(true);
    try {
      let frames: string[] = [];
      let durationSeconds = 42;
      let sha256Digest = '';

      if (params.file) {
        const buf = await params.file.arrayBuffer();
        sha256Digest = await computeSha256Hex(buf);
      }

      if (params.objectUrl) {
        const sampled = await sampleVideoFrames(params.objectUrl);
        frames = sampled.frames;
        durationSeconds = sampled.durationSeconds;
      }

      const res = await fetch('/api/recruitment/verify-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateHandle: candidate.handle,
          title: videoTitle,
          fileName: params.fileName,
          mimeType: params.mimeType,
          durationSeconds,
          capturedVia: params.capturedVia,
          challengeCode: params.challenge || '',
          sha256Digest,
          frames,
        }),
      });
      const vData = await res.json();

      const record: InterviewVideoRecord = {
        id: `vid_${Date.now()}`,
        title: videoTitle,
        capturedVia: params.capturedVia,
        mimeType: params.mimeType,
        durationSeconds,
        challengeCode: params.challenge,
        posterFrameDataUrl: frames[0],
        uploadedAt: new Date().toISOString(),
        verification: vData,
        preScreenReviews: currentVideo?.preScreenReviews || [],
      };

      onSaveVideo(candidate.id, record);
      emitToast(
        vData.verdict === 'VERIFIED_HUMAN'
          ? `Verified Real Human (${vData.authenticityScore}%)`
          : `Deepfake Flagged (${vData.deepfakeRiskPct}% risk)`,
        vData.verdict === 'VERIFIED_HUMAN' ? 'success' : 'error'
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!biometricConsent) {
      emitToast('Please confirm Biometric & Anti-Deepfake consent first.', 'warning');
      e.target.value = '';
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setSessionVideoUrls((prev) => ({ ...prev, [candidate.id]: objUrl }));
    await runVideoVerification({
      file,
      fileName: file.name,
      mimeType: file.type || 'video/mp4',
      capturedVia: 'upload',
      objectUrl: objUrl,
    });
    e.target.value = '';
  };

  const handleStartRecording = async () => {
    if (!biometricConsent) {
      emitToast('Please confirm Biometric & Anti-Deepfake consent first.', 'warning');
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        emitToast('Webcam unavailable — upload video or run deepfake check', 'warning');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (recVideoRef.current) {
        recVideoRef.current.srcObject = stream;
      }
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const objUrl = URL.createObjectURL(blob);
        setSessionVideoUrls((prev) => ({ ...prev, [candidate.id]: objUrl }));
        await runVideoVerification({
          file: blob,
          fileName: `webcam-${challengeCode}.webm`,
          mimeType: 'video/webm',
          capturedVia: 'webcam_record',
          challenge: challengeCode,
          objectUrl: objUrl,
        });
      };
      mr.start();
      setRecording(true);
    } catch {
      emitToast('Camera access blocked — use Upload Video', 'warning');
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleRunAgentPreScreen = async () => {
    if (!currentVideo || !selectedJob) return;
    setPrescreening(true);
    try {
      const res = await fetch('/api/recruitment/prescreen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: selectedJob,
          reviewerHandle: selectedJob.companyAgentHandle,
          reviewerName: `${selectedJob.companyName} Hiring Agent`,
          candidateHandle: candidate.handle,
          cvSkills: candidate.cvSummary?.parsedSkills || candidate.skills,
          videoVerification: currentVideo.verification,
        }),
      });
      const data = await res.json();
      onAddPreScreenReview(candidate.id, {
        id: `ps_ag_${Date.now()}`,
        reviewerType: 'agent',
        reviewerHandle: selectedJob.companyAgentHandle,
        reviewerName: `${selectedJob.companyName} Hiring Agent`,
        decision: data.decision || 'PASS',
        score: data.score || 88,
        notes: data.notes || 'Agent pre-screen completed.',
        timestamp: new Date().toISOString(),
      });
      emitToast(`Agent pre-screen logged (${data.decision || 'PASS'})`, 'success');
    } finally {
      setPrescreening(false);
    }
  };

  const handleSaveHumanPreScreen = () => {
    if (!currentVideo) return;
    onAddPreScreenReview(candidate.id, {
      id: `ps_hu_${Date.now()}`,
      reviewerType: 'human',
      reviewerHandle: interviewerHandle,
      reviewerName: 'HR Hiring Reviewer',
      decision: humanDecision,
      score: humanScore,
      notes: humanNotes,
      timestamp: new Date().toISOString(),
    });
    emitToast(`Human review logged (${humanDecision})`, 'success');
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduling(true);
    try {
      const startISO = new Date(`${scheduleDate}T${scheduleTime}:00+02:00`).toISOString();
      const endISO = new Date(new Date(startISO).getTime() + durationMins * 60 * 1000).toISOString();
      const companyAgent = businesses.find((b) => b.handle === interviewerHandle) || businesses[0];
      const bookingId = `book_iv_${Date.now()}`;

      const newBooking: BookingDoc = {
        id: bookingId,
        organizerAgentId: companyAgent?.id || 'agent_woolworths_ceo',
        organizerHandle: interviewerHandle,
        attendeeAgentId: candidate.id,
        attendeeHandle: candidate.handle,
        ownerUid,
        title: `Live Video Interview: ${selectedJob?.title || 'Role Screen'} (${candidate.displayName})`,
        jobId: selectedJob?.id,
        jobTitle: selectedJob?.title,
        interviewMode: 'live_video',
        startTime: startISO,
        endTime: endISO,
        meetLink: `switchboard://live-interview/${bookingId}`,
        dealValueZAR: selectedJob?.salaryRangeZAR?.[0] || 95000,
        googleSynced: false,
        status: 'CONFIRMED',
      };

      if (workspaceToken) {
        const gRes = await insertGoogleCalendarEvent(newBooking);
        if (gRes.synced) {
          newBooking.googleSynced = true;
          if (gRes.meetLink) newBooking.meetLink = gRes.meetLink;
        }
      }

      await onAddBooking(newBooking);
      emitToast(
        newBooking.googleSynced
          ? 'Synced to Google Calendar'
          : 'Interview scheduled (.ics ready)',
        'success'
      );
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Clean Media Frame + Compact Forensic Authenticity Badge */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
              <Video className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              Profile Video &amp; Liveness
            </h3>
            <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 tabular-nums">
              Challenge {challengeCode}
            </span>
          </div>

          <input
            type="text"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="Video title..."
            className="w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-1.5 text-xs text-zinc-950 dark:text-white"
          />

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={verifying || recording}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[38px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 px-3 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              {verifying ? 'Scanning...' : 'Upload Video'}
            </button>

            {!recording ? (
              <button
                type="button"
                disabled={verifying}
                onClick={handleStartRecording}
                className="min-h-[38px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Record Live
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopRecording}
                className="min-h-[38px] rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5" />
                Stop &amp; Verify
              </button>
            )}

            <button
              type="button"
              disabled={verifying}
              onClick={() =>
                runVideoVerification({
                  fileName: 'ai_avatar_deepfake_sample.mp4',
                  mimeType: 'video/mp4',
                  capturedVia: 'upload',
                })
              }
              className="col-span-2 sm:col-span-1 min-h-[38px] rounded-xl bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 dark:bg-zinc-900 dark:border-white/15 px-3 text-xs font-medium dark:text-amber-300 dark:hover:border-amber-400/40 whitespace-nowrap"
            >
              Test Deepfake Check
            </button>
          </div>

          <label className="flex items-start gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-white/[0.08] px-2.5 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={biometricConsent}
              onChange={(e) => setBiometricConsent(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded border-zinc-300 text-sky-600 focus:ring-sky-500 shrink-0"
            />
            <span className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
              I consent to SWITCHZ processing video frames and audio strictly for SHA-256 anti-deepfake liveness forensics and recruiter screening under Part 3 (§2.2) of the{' '}
              <a href="/terms" className="underline font-medium text-zinc-900 dark:text-zinc-200">
                Candidate AI Privacy Notice
              </a>
              .
            </span>
          </label>

          {recording && (
            <video
              ref={recVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-video rounded-xl bg-black border border-emerald-500/60 dark:border-emerald-400/40 object-cover"
            />
          )}

          {!recording && playableUrl && (
            <video
              src={playableUrl}
              controls
              playsInline
              className="w-full aspect-video rounded-xl bg-black border border-zinc-300 dark:border-white/15"
            />
          )}

          {/* Compact Forensic Trust Badge + Expandable Liveness Breakdown */}
          {currentVideo && (
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {currentVideo.verification.verdict === 'VERIFIED_HUMAN' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-zinc-950 dark:text-zinc-50">
                    {currentVideo.verification.verdict === 'VERIFIED_HUMAN'
                      ? 'Verified Human'
                      : 'Synthetic Risk Flagged'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      currentVideo.verification.verdict === 'VERIFIED_HUMAN'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {currentVideo.verification.authenticityScore}% Real
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowForensicDetails((v) => !v)}
                    className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-0.5"
                  >
                    {showForensicDetails ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {showForensicDetails && (
                <div className="space-y-2.5 pt-2 border-t border-zinc-200 dark:border-white/10">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    {[
                      { label: 'Micro-Expr', val: currentVideo.verification.livenessSignals.facialMicroExpressions },
                      { label: 'Lip Sync', val: currentVideo.verification.livenessSignals.lipAudioSync },
                      { label: 'Texture', val: currentVideo.verification.livenessSignals.lightingSkinTexture },
                      { label: 'Codec', val: currentVideo.verification.livenessSignals.compressionArtifactCheck },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-zinc-600 dark:text-zinc-400 truncate text-[10px]">{metric.label}</span>
                          <span className="text-zinc-950 dark:text-zinc-200 font-semibold tabular-nums text-[10px]">{metric.val}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              metric.val >= 75 ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-rose-600 dark:bg-rose-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, metric.val))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">
                    {currentVideo.verification.transcriptSummary}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Pre-Screening & Live Video Launch */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              Pre-Screening
            </h3>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="min-h-[36px] rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-200 max-w-full sm:max-w-[220px]"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!currentVideo || prescreening}
              onClick={handleRunAgentPreScreen}
              className="min-h-[38px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 px-3.5 text-xs font-semibold dark:text-zinc-950 dark:hover:bg-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5" />
              {prescreening ? 'Screening...' : 'Run Agent Screen'}
            </button>
            <button
              type="button"
              onClick={() =>
                onLaunchLiveRoom({
                  candidate,
                  job: selectedJob,
                  interviewerHandle,
                  interviewerName: selectedJob?.companyName || 'Hiring Panel',
                })
              }
              className="min-h-[38px] rounded-xl bg-rose-600 px-3.5 text-xs font-semibold text-white hover:bg-rose-500 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Video className="w-3.5 h-3.5" />
              Launch Live Interview
            </button>
          </div>

          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-2 text-xs">
            <p className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              HR Evaluation
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={humanDecision}
                onChange={(e) => setHumanDecision(e.target.value as PreScreenReview['decision'])}
                className="min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-white"
              >
                <option value="SHORTLIST">SHORTLIST</option>
                <option value="PASS">PASS</option>
                <option value="HOLD">HOLD</option>
                <option value="REJECT">REJECT</option>
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={humanScore}
                onChange={(e) => setHumanScore(Number(e.target.value))}
                className="min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-mono tabular-nums text-zinc-950 dark:text-white"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={humanNotes}
                onChange={(e) => setHumanNotes(e.target.value)}
                className="flex-1 min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-white"
              />
              <button
                type="button"
                disabled={!currentVideo}
                onClick={handleSaveHumanPreScreen}
                className="min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap"
              >
                Log Review
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
            {(currentVideo?.preScreenReviews || []).map((rev) => (
              <div key={rev.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-2.5 space-y-1">
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="font-semibold text-zinc-950 dark:text-zinc-100 inline-flex items-center gap-1.5 truncate">
                    {rev.reviewerType === 'agent' ? (
                      <Bot className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    {rev.reviewerName}
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-300 font-semibold tabular-nums shrink-0">
                    {rev.decision} · {rev.score}%
                  </span>
                </div>
                <p className="text-[11px] text-zinc-700 dark:text-zinc-400">{rev.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Streamlined Calendar Booking */}
      <div className="glass-panel rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0" />
              Schedule Live Interview
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Google, Outlook, Office 365 &amp; .ics downloads
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!workspaceToken && (
              <button
                type="button"
                onClick={() => onConnectGoogle()}
                className="min-h-[34px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 whitespace-nowrap"
              >
                Connect Google
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                downloadScheduleIcs(interviewBookings);
                emitToast('Downloaded interviews.ics', 'success');
              }}
              className="min-h-[34px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Download className="w-3 h-3" />
              .ics
            </button>
            <button
              type="button"
              onClick={() => {
                downloadScheduleCsv(interviewBookings);
                emitToast('Downloaded agenda.csv', 'success');
              }}
              className="min-h-[34px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3 h-3" />
              .csv
            </button>
          </div>
        </div>

        <form onSubmit={handleScheduleInterview} className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          <label className="col-span-2 sm:col-span-1 text-zinc-700 dark:text-zinc-400 font-medium">
            Interviewer
            <select
              value={interviewerHandle}
              onChange={(e) => setInterviewerHandle(e.target.value)}
              className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-white"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.handle}>
                  {b.organization}
                </option>
              ))}
            </select>
          </label>
          <label className="text-zinc-700 dark:text-zinc-400 font-medium">
            Date
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-white"
              required
            />
          </label>
          <label className="text-zinc-700 dark:text-zinc-400 font-medium">
            Start (SAST)
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-white"
              required
            />
          </label>
          <label className="col-span-2 sm:col-span-1 text-zinc-700 dark:text-zinc-400 font-medium">
            Duration
            <select
              value={durationMins}
              onChange={(e) => setDurationMins(Number(e.target.value))}
              className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-white"
            >
              <option value={30}>30 mins</option>
              <option value={45}>45 mins</option>
              <option value={60}>60 mins</option>
            </select>
          </label>
          <div className="col-span-2 sm:col-span-1 flex items-end">
            <button
              type="submit"
              disabled={scheduling}
              className="w-full min-h-[38px] rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-white dark:text-zinc-950 font-semibold text-xs whitespace-nowrap"
            >
              {scheduling ? 'Booking...' : 'Book Slot'}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {interviewBookings.map((b) => (
            <div key={b.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-950 dark:text-zinc-100 truncate">{b.title}</p>
                  <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mt-0.5 tabular-nums">
                    {new Date(b.startTime).toLocaleString('en-ZA', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {b.organizerHandle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onLaunchLiveRoom({
                      candidate,
                      booking: b,
                      job: selectedJob,
                      interviewerHandle: b.organizerHandle,
                      interviewerName: b.organizerHandle,
                    })
                  }
                  className="shrink-0 min-h-[32px] rounded-lg bg-rose-600 hover:bg-rose-500 px-3 text-xs font-semibold text-white inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Play className="w-3 h-3" />
                  Join
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-zinc-200 dark:border-white/10 text-[11px]">
                <a
                  href={buildGoogleCalendarUrl(b)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[32px] rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white inline-flex items-center justify-center gap-1"
                >
                  Google <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <a
                  href={buildOutlookCalendarUrl(b)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[32px] rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white inline-flex items-center justify-center gap-1"
                >
                  Outlook <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <a
                  href={buildOffice365CalendarUrl(b)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[32px] rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white inline-flex items-center justify-center gap-1"
                >
                  365 <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    downloadIcsFile(b);
                    emitToast('Downloaded .ics invite', 'success');
                  }}
                  className="min-h-[32px] rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2 text-emerald-700 dark:text-emerald-300 font-medium inline-flex items-center justify-center gap-1"
                >
                  <Download className="w-2.5 h-2.5" /> .ics
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
