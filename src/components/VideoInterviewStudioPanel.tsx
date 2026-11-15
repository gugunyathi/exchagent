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
          // ignore frame seek failure
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

  // Store session-only playable video URLs in state (avoids localStorage quota issues)
  const [sessionVideoUrls, setSessionVideoUrls] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const [challengeCode] = useState(() => `SWB-${Math.floor(100 + Math.random() * 899)}`);
  const [verifying, setVerifying] = useState(false);
  const [showAllForensics, setShowAllForensics] = useState(false);
  const [videoTitle, setVideoTitle] = useState(`${candidate.displayName} — Video Intro`);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Pre-screen state
  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || '');
  const [prescreening, setPrescreening] = useState(false);
  const [humanDecision, setHumanDecision] = useState<PreScreenReview['decision']>('SHORTLIST');
  const [humanScore, setHumanScore] = useState(91);
  const [humanNotes, setHumanNotes] = useState('Verified authentic human presenter; articulate architecture walkthrough.');

  // Interview Scheduler state
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
    setStatusMsg(null);
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
      setStatusMsg(
        vData.verdict === 'VERIFIED_HUMAN'
          ? `Deepfake Check Passed: ${vData.authenticityScore}% Real Human (${vData.verifierEngine})`
          : `Deepfake Alert: Flagged as ${vData.verdict} (${vData.deepfakeRiskPct}% synthetic risk)`
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    setStatusMsg(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setStatusMsg('Camera MediaRecorder unavailable in this browser — use Video Upload or Simulated Deepfake Test.');
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
      setStatusMsg('Camera access blocked — upload a video file or run forensic sample test below.');
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
      setStatusMsg(
        newBooking.googleSynced
          ? 'Live Interview scheduled and synced directly to Google Calendar!'
          : 'Live Interview scheduled! Use Google, Outlook, Office 365, or Download .ics below.'
      );
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Row 1: Video Upload/Record + Deepfake Forensic Verdict */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        <div className="lg:col-span-6 glass-panel rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-1.5">
              <Video className="w-4 h-4 text-cyan-300 shrink-0" />
              Profile Video &amp; Liveness
            </h3>
            <span className="text-xs font-mono text-amber-300 tabular-nums">
              {challengeCode}
            </span>
          </div>

          <input
            type="text"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="Video intro title..."
            className="w-full min-h-[40px] rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs sm:text-sm text-white"
          />

          {/* Upload / Webcam Record Controls */}
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
              className="min-h-[40px] rounded-xl bg-cyan-400 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              {verifying ? 'Analyzing...' : 'Upload Video'}
            </button>

            {!recording ? (
              <button
                type="button"
                disabled={verifying}
                onClick={handleStartRecording}
                className="min-h-[40px] rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5" />
                Record Live
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopRecording}
                className="min-h-[40px] rounded-xl bg-rose-500 px-3 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 animate-pulse whitespace-nowrap"
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
              className="col-span-2 sm:col-span-1 min-h-[40px] rounded-xl bg-slate-900 border border-slate-700 px-3 text-xs text-amber-300 hover:border-amber-400 whitespace-nowrap"
              title="Simulate testing a synthetic deepfake clip"
            >
              Test Deepfake Check
            </button>
          </div>

          {recording && (
            <video
              ref={recVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-video rounded-xl bg-black border border-emerald-400/40 object-cover"
            />
          )}

          {!recording && playableUrl && (
            <video
              src={playableUrl}
              controls
              playsInline
              className="w-full aspect-video rounded-xl bg-black border border-slate-800"
            />
          )}

          {statusMsg && (
            <p className="text-xs font-medium text-cyan-200 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">
              {statusMsg}
            </p>
          )}

          {/* Deepfake & Liveness Forensic Scorecard */}
          {currentVideo && (
            <div
              className={`rounded-xl border p-3.5 space-y-2.5 ${
                currentVideo.verification.verdict === 'VERIFIED_HUMAN'
                  ? 'bg-emerald-950/25 border-emerald-500/35'
                  : 'bg-rose-950/30 border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {currentVideo.verification.verdict === 'VERIFIED_HUMAN' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    {currentVideo.verification.verdict === 'VERIFIED_HUMAN'
                      ? 'Verified Human'
                      : 'Deepfake Flagged'}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
                  {currentVideo.verification.authenticityScore}% Real · {currentVideo.verification.deepfakeRiskPct}% Risk
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                {[
                  { label: 'Micro-Expr', val: currentVideo.verification.livenessSignals.facialMicroExpressions },
                  { label: 'Lip Sync', val: currentVideo.verification.livenessSignals.lipAudioSync },
                  { label: 'Texture', val: currentVideo.verification.livenessSignals.lightingSkinTexture },
                  { label: 'Codec', val: currentVideo.verification.livenessSignals.compressionArtifactCheck },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-lg bg-slate-950/80 p-2 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-slate-400 truncate text-[11px]">{metric.label}</span>
                      <span className="text-cyan-300 font-semibold tabular-nums text-[11px]">{metric.val}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          metric.val >= 75 ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, metric.val))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                {currentVideo.verification.transcriptSummary}
              </p>

              {currentVideo.verification.forensicNotes.length > 0 && (
                <div className="space-y-1">
                  <ul className="space-y-0.5 text-xs text-slate-300 list-disc pl-4">
                    {(showAllForensics
                      ? currentVideo.verification.forensicNotes
                      : currentVideo.verification.forensicNotes.slice(0, 2)
                    ).map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                  {currentVideo.verification.forensicNotes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setShowAllForensics((v) => !v)}
                      className="text-xs text-cyan-300 hover:underline"
                    >
                      {showAllForensics ? 'Show less' : `Show all ${currentVideo.verification.forensicNotes.length} checks`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Agent & Human Pre-Screening Reviews */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
              Pre-Screening
            </h3>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="min-h-[38px] rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs text-cyan-200 max-w-full sm:max-w-[220px]"
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
              className="min-h-[40px] rounded-xl bg-cyan-400 px-3.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5" />
              {prescreening ? 'Agent Screening...' : 'Run Agent Pre-Screen'}
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
              className="min-h-[40px] rounded-xl bg-rose-500 px-3.5 text-xs font-semibold text-white hover:bg-rose-400 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Video className="w-3.5 h-3.5" />
              Start Live Video Interview
            </button>
          </div>

          {/* Human Pre-Screen Entry */}
          <div className="rounded-xl bg-slate-950/75 border border-slate-800 p-3 space-y-2 text-xs">
            <p className="font-semibold text-slate-200 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-300" />
              Human HR Pre-Screen Evaluation
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={humanDecision}
                onChange={(e) => setHumanDecision(e.target.value as PreScreenReview['decision'])}
                className="min-h-[38px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white"
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
                className="min-h-[38px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono tabular-nums text-white"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={humanNotes}
                onChange={(e) => setHumanNotes(e.target.value)}
                className="flex-1 min-h-[38px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                disabled={!currentVideo}
                onClick={handleSaveHumanPreScreen}
                className="min-h-[38px] rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50 whitespace-nowrap"
              >
                Log Review
              </button>
            </div>
          </div>

          {/* Review Feed */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar">
            {(currentVideo?.preScreenReviews || []).map((rev) => (
              <div key={rev.id} className="rounded-xl bg-slate-950/80 border border-slate-800 p-2.5 space-y-1">
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="font-semibold text-white inline-flex items-center gap-1.5 truncate">
                    {rev.reviewerType === 'agent' ? (
                      <Bot className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    )}
                    {rev.reviewerName}
                  </span>
                  <span className="font-mono text-emerald-300 font-bold tabular-nums shrink-0">
                    {rev.decision} · {rev.score}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{rev.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Live Video Interview Scheduler + Multi-Calendar Export */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-300 shrink-0" />
              Interview Scheduler &amp; Calendar Sync
            </h3>
            <p className="text-xs text-slate-400">
              Google, Outlook, Office 365, Apple `.ics` &amp; `.csv` exports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {!workspaceToken && (
              <button
                type="button"
                onClick={() => onConnectGoogle()}
                className="min-h-[36px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 text-[11px] text-cyan-300 hover:border-cyan-400 whitespace-nowrap"
              >
                Connect Google OAuth
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadScheduleIcs(interviewBookings)}
              className="min-h-[36px] rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2.5 text-[11px] font-medium text-emerald-200 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <Download className="w-3 h-3" />
              Schedule (.ics)
            </button>
            <button
              type="button"
              onClick={() => downloadScheduleCsv(interviewBookings)}
              className="min-h-[36px] rounded-lg bg-slate-900 border border-slate-700 px-2.5 text-[11px] text-slate-200 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3 h-3" />
              Agenda (.csv)
            </button>
          </div>
        </div>

        <form onSubmit={handleScheduleInterview} className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          <label className="col-span-2 sm:col-span-1 text-slate-400">
            Company / Recruiter
            <select
              value={interviewerHandle}
              onChange={(e) => setInterviewerHandle(e.target.value)}
              className="mt-1 w-full min-h-[40px] rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-white"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.handle}>
                  {b.organization}
                </option>
              ))}
            </select>
          </label>
          <label className="text-slate-400">
            Date
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="mt-1 w-full min-h-[40px] rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-white"
              required
            />
          </label>
          <label className="text-slate-400">
            Start (SAST)
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="mt-1 w-full min-h-[40px] rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-white"
              required
            />
          </label>
          <label className="col-span-2 sm:col-span-1 text-slate-400">
            Duration
            <select
              value={durationMins}
              onChange={(e) => setDurationMins(Number(e.target.value))}
              className="mt-1 w-full min-h-[40px] rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-2 text-xs text-white"
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
              className="w-full min-h-[40px] rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs whitespace-nowrap"
            >
              {scheduling ? 'Booking...' : 'Schedule Interview'}
            </button>
          </div>
        </form>

        {/* Scheduled Interview Cards with Join + Calendar Provider Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {interviewBookings.map((b) => (
            <div key={b.id} className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{b.title}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                    {new Date(b.startTime).toLocaleString('en-ZA', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {b.organizerHandle} ↔ {b.attendeeHandle}
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
                  className="shrink-0 min-h-[36px] rounded-lg bg-rose-500 hover:bg-rose-400 px-3 text-[11px] font-semibold text-white inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Play className="w-3 h-3" />
                  Join Call
                </button>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-800/80 text-[10.5px]">
                <a
                  href={buildGoogleCalendarUrl(b)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[34px] rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1 text-cyan-300 hover:border-cyan-400 inline-flex items-center justify-center gap-1"
                >
                  Google <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <a
                  href={buildOutlookCalendarUrl(b)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[34px] rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1 text-sky-300 hover:border-sky-400 inline-flex items-center justify-center gap-1"
                >
                  Outlook <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <a
                  href={buildOffice365CalendarUrl(b)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[34px] rounded-md bg-slate-900 border border-slate-700 px-2.5 py-1 text-indigo-300 hover:border-indigo-400 inline-flex items-center justify-center gap-1"
                >
                  Office 365 <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={() => downloadIcsFile(b)}
                  className="min-h-[34px] rounded-md bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 text-emerald-300 inline-flex items-center justify-center gap-1"
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
