import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone,
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Send,
  ShieldAlert,
  MapPin,
  Delete,
  User,
  Building2,
} from 'lucide-react';
import {
  AgentDoc,
  VoiceChatSessionDoc,
  DispatchedUnit,
} from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';

interface AgentDialerModalProps {
  open: boolean;
  onClose: () => void;
  agents: AgentDoc[];
  initialAgent: AgentDoc | null;
  userLocation: { lat: number; lng: number };
  callerUid: string;
  onSaveVoiceSession: (session: VoiceChatSessionDoc) => Promise<void>;
}

const KEYPAD_BUTTONS: Array<{ digit: string; letters: string }> = [
  { digit: '1', letters: 'SOS' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

const T9_DIGIT_MAP: Record<string, string> = {
  a: '2', b: '2', c: '2',
  d: '3', e: '3', f: '3',
  g: '4', h: '4', i: '4',
  j: '5', k: '5', l: '5',
  m: '6', n: '6', o: '6',
  p: '7', q: '7', r: '7', s: '7',
  t: '8', u: '8', v: '8',
  w: '9', x: '9', y: '9', z: '9',
};

function toT9Digits(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => (ch >= '0' && ch <= '9' ? ch : T9_DIGIT_MAP[ch] || ''))
    .join('');
}

function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('27') && digits.length >= 11) {
    return `${digits} 0${digits.slice(2)}`;
  }
  return digits;
}

function playDtmfTone(digit: string) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freqs: Record<string, number> = {
      '1': 697, '2': 740, '3': 784,
      '4': 830, '5': 880, '6': 932,
      '7': 987, '8': 1046, '9': 1108,
      '*': 622, '0': 1174, '#': 1244,
    };
    osc.frequency.value = freqs[digit] || 800;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 80);
  } catch {
    // ignore
  }
}

export const AgentDialerModal: React.FC<AgentDialerModalProps> = ({
  open,
  onClose,
  agents,
  initialAgent,
  userLocation,
  callerUid,
  onSaveVoiceSession,
}) => {
  const [dialInput, setDialInput] = useState(initialAgent?.handle || '');
  const [channel, setChannel] = useState<'voice' | 'chat'>('voice');
  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [dispatchedUnits, setDispatchedUnits] = useState<DispatchedUnit[]>([]);
  const [transcript, setTranscript] = useState<
    Array<{ role: 'user' | 'agent'; text: string; timestamp: string }>
  >([]);
  const sessionIdRef = useRef(`call_${Date.now()}`);

  useEffect(() => {
    if (open) {
      if (initialAgent) {
        setDialInput(
          initialAgent.handle === '911.emergency.agent' ? '911' : initialAgent.handle
        );
      } else {
        setDialInput('');
      }
      setTranscript([]);
      setDispatchedUnits([]);
      setInCall(false);
    }
  }, [open, initialAgent]);

  const predictiveMatches = useMemo(() => {
    const raw = dialInput.trim().toLowerCase();
    if (!raw) return agents.slice(0, 4);

    const digitsOnly = raw.replace(/\D/g, '');

    const scored = agents
      .map((agent) => {
        let score = 0;
        const phonePool = normalizePhoneDigits(agent.voiceNumber);
        const shortcode = (agent.shortcode || '').toLowerCase();
        const nameLower = agent.displayName.toLowerCase();
        const handleLower = agent.handle.toLowerCase();
        const orgLower = agent.organization.toLowerCase();
        const t9Name = toT9Digits(agent.displayName);
        const t9Handle = toT9Digits(agent.handle.replace('.agent', ''));

        if (handleLower === raw || shortcode === raw) score += 100;
        if (digitsOnly) {
          if (shortcode.startsWith(digitsOnly)) score += 90;
          if (phonePool.includes(digitsOnly)) score += 80;
          if (t9Name.includes(digitsOnly) || t9Handle.includes(digitsOnly)) score += 65;
        }
        if (nameLower.includes(raw) || handleLower.includes(raw) || orgLower.includes(raw)) {
          score += 75;
        }

        return { agent, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.agent);

    return scored.slice(0, 5);
  }, [agents, dialInput]);

  if (!open) return null;

  const isEmergency = ['911', '999', '112', '10111', '10177', '911.emergency.agent'].includes(
    dialInput.trim().toLowerCase()
  );

  const exactAgent = agents.find(
    (a) =>
      a.handle.toLowerCase() === dialInput.trim().toLowerCase() ||
      a.shortcode === dialInput.trim() ||
      a.voiceNumber.replace(/\D/g, '') === dialInput.replace(/\D/g, '')
  );

  const matchedAgent = exactAgent || (dialInput.trim() ? predictiveMatches[0] : undefined);

  const speakText = (text: string) => {
    if (!speakerOn || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.04;
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore
    }
  };

  const startSession = async (mode: 'voice' | 'chat', forcedAgent?: AgentDoc) => {
    const targetAgent = forcedAgent || matchedAgent;
    const isSos =
      isEmergency || targetAgent?.handle === '911.emergency.agent';

    if (forcedAgent) {
      setDialInput(
        forcedAgent.handle === '911.emergency.agent' ? '911' : forcedAgent.handle
      );
    }

    setChannel(mode);
    setInCall(true);
    sessionIdRef.current = `call_${Date.now()}`;
    const targetHandle = isSos
      ? '911.emergency.agent'
      : targetAgent?.handle || dialInput.trim() || 'chris.moleme.agent';

    const greetingPrompt = isSos
      ? 'Emergency call initiated. Please confirm GPS coordinates and status.'
      : 'Connected. Introduce your capabilities briefly.';

    await sendTurn(greetingPrompt, mode, true, targetHandle, isSos);
  };

  const sendTurn = async (
    text: string,
    activeMode: 'voice' | 'chat' = channel,
    isInitialGreeting = false,
    forcedHandle?: string,
    forcedSos?: boolean
  ) => {
    if (!text.trim()) return;
    setSending(true);
    const sosFlag = forcedSos ?? isEmergency;
    const targetHandle =
      forcedHandle ||
      (sosFlag
        ? '911.emergency.agent'
        : matchedAgent?.handle || dialInput.trim() || 'chris.moleme.agent');

    const nextTranscript = isInitialGreeting
      ? [...transcript]
      : [
          ...transcript,
          { role: 'user' as const, text: text.trim(), timestamp: new Date().toISOString() },
        ];
    if (!isInitialGreeting) setTranscript(nextTranscript);
    setMessageInput('');

    try {
      const res = await fetch('/api/voice/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetHandle,
          dialedNumber: dialInput.trim(),
          userMessage: text.trim(),
          isEmergency: sosFlag,
          gpsCoords: userLocation,
          history: nextTranscript.slice(-6),
        }),
      });
      const data = await res.json();
      const agentEntry = {
        role: 'agent' as const,
        text: data.reply,
        timestamp: new Date().toISOString(),
      };
      const updated = [...nextTranscript, agentEntry];
      setTranscript(updated);
      if (data.dispatchedUnits) {
        setDispatchedUnits(data.dispatchedUnits);
      }
      if (activeMode === 'voice') {
        speakText(data.reply);
      }

      await onSaveVoiceSession({
        id: sessionIdRef.current,
        callerUid,
        targetHandle,
        dialedNumber: dialInput.trim(),
        channel: activeMode,
        isEmergency: sosFlag,
        feeUSD: 0,
        gpsCoords: userLocation,
        transcript: updated,
        dispatchedUnits: data.dispatchedUnits,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  };

  const toggleMicSpeech = () => {
    interface SpeechRecognitionResultEvent {
      results: ArrayLike<ArrayLike<{ transcript: string }>>;
    }
    interface SpeechRecognitionInstance {
      lang: string;
      interimResults: boolean;
      onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    }
    type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      sendTurn('Please confirm availability and current offer terms.');
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'en-ZA';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (event) => {
      const spoken = event.results[0]?.[0]?.transcript;
      setListening(false);
      if (spoken) sendTurn(spoken, 'voice');
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-zinc-950/60 dark:bg-black/75 backdrop-blur-sm p-0 sm:p-6"
      onClick={() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        onClose();
      }}
    >
      <div
        className="w-full sm:w-[400px] max-h-[92dvh] rounded-t-3xl sm:rounded-2xl glass-panel shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mt-2 shrink-0" />
        {/* Header */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
            isEmergency
              ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/50 dark:border-rose-500/30'
              : 'border-zinc-200 dark:border-white/10'
          }`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
              {isEmergency ? 'CIVIC SOS · FREE' : 'Predictive Voice & Chat'}
            </p>
            <h3 className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-white truncate tracking-tight">
              {isEmergency
                ? '911 Dispatch Agent'
                : matchedAgent?.displayName || 'Dial Number or Handle'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              onClose();
            }}
            className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center shrink-0"
            aria-label="Close Dialer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <SwipeScrollArea direction="vertical" className="flex-1 min-h-0" innerClassName="p-3.5 sm:p-4 space-y-3">
          {/* Dial Input + Backspace */}
          <div className="relative flex items-center">
            <input
              type="text"
              value={dialInput}
              onChange={(e) => setDialInput(e.target.value)}
              placeholder="Digits (e.g. 083, 24747) or .agent handle..."
              className="w-full min-h-[42px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 pl-3.5 pr-11 py-2 text-sm font-mono text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-sky-400/60"
            />
            {dialInput && (
              <button
                type="button"
                onClick={() => setDialInput((prev) => prev.slice(0, -1))}
                className="absolute right-1.5 w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center"
                aria-label="Backspace"
                title="Backspace"
              >
                <Delete className="w-4 h-4" />
              </button>
            )}
          </div>

          {!inCall ? (
            <>
              <div className="space-y-1.5">
                {predictiveMatches.length === 0 ? (
                  <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-500 px-1">
                    No matching directory card — tap Call to dial direct.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {predictiveMatches.map((agent) => (
                      <div
                        key={agent.id}
                        onClick={() =>
                          setDialInput(
                            agent.handle === '911.emergency.agent' ? '911' : agent.handle
                          )
                        }
                        className={`min-h-[46px] rounded-xl px-3 py-2 border cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                          matchedAgent?.id === agent.id
                            ? 'bg-zinc-100 border-zinc-400 dark:bg-zinc-800 dark:border-white/25'
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-300 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-300">
                            {agent.type === 'persona' ? (
                              <User className="w-3.5 h-3.5" />
                            ) : (
                              <Building2 className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                              {agent.displayName}
                            </p>
                            <p className="text-[10.5px] font-mono text-zinc-600 dark:text-zinc-400 truncate tabular-nums">
                              {agent.voiceNumber} · {agent.handle}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startSession('voice', agent);
                          }}
                          className="w-8 h-8 rounded-full bg-emerald-600 text-white dark:bg-emerald-400 dark:text-zinc-950 flex items-center justify-center hover:bg-emerald-500 dark:hover:bg-emerald-300 shrink-0 transition-transform active:scale-95"
                          aria-label={`Call ${agent.displayName}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* T9 DTMF Keypad */}
              <div className="grid grid-cols-3 gap-1.5">
                {KEYPAD_BUTTONS.map(({ digit, letters }) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      playDtmfTone(digit);
                      setDialInput((prev) =>
                        prev.includes('.agent') ? digit : prev + digit
                      );
                    }}
                    className="h-11 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/25 hover:bg-zinc-100 dark:hover:bg-zinc-900 flex flex-col items-center justify-center transition-all active:scale-95"
                  >
                    <span className="text-sm font-mono font-semibold text-zinc-950 dark:text-zinc-100 leading-none tabular-nums">
                      {digit}
                    </span>
                    {letters && (
                      <span className="text-[8.5px] font-mono tracking-widest text-zinc-600 dark:text-zinc-500 mt-0.5 leading-none">
                        {letters}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startSession('voice')}
                  className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors ${
                    isEmergency
                      ? 'bg-rose-600 text-white hover:bg-rose-500'
                      : 'bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Call
                </button>
                <button
                  type="button"
                  onClick={() => startSession('chat')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-4 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 p-3 flex items-center justify-between text-xs">
                <span className="font-mono text-zinc-800 dark:text-zinc-300 flex items-center gap-1.5 tabular-nums">
                  <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </span>
                <div className="flex items-end gap-1 h-4">
                  {[1, 2, 3, 4, 5].map((bar) => (
                    <span
                      key={bar}
                      className={`w-1 rounded-full ${
                        isEmergency ? 'bg-rose-500 dark:bg-rose-400' : 'bg-emerald-600 dark:bg-emerald-400'
                      } ${listening || sending ? 'animate-bounce' : ''}`}
                      style={{ height: `${6 + ((bar * 3) % 10)}px` }}
                    />
                  ))}
                </div>
              </div>

              {dispatchedUnits.length > 0 && (
                <div className="rounded-xl bg-rose-50 border border-rose-300 dark:bg-rose-950/30 dark:border-rose-500/35 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Responders Dispatched
                  </p>
                  {dispatchedUnits.map((u) => (
                    <div key={u.id} className="text-[11px] font-mono text-rose-700 dark:text-rose-100 flex justify-between">
                      <span>{u.unitType}: {u.callsign}</span>
                      <span>ETA {u.etaMinutes}m</span>
                    </div>
                  ))}
                </div>
              )}

              <SwipeScrollArea direction="vertical" className="max-h-52" innerClassName="space-y-2 pr-1">
                {transcript.map((entry, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-2.5 text-xs leading-relaxed ${
                      entry.role === 'user'
                        ? 'bg-zinc-900 border border-zinc-900 text-white dark:bg-zinc-800 dark:border-white/15 ml-6'
                        : 'bg-zinc-50 border border-zinc-300 text-zinc-800 dark:bg-zinc-950 dark:border-white/10 dark:text-zinc-300 mr-4'
                    }`}
                  >
                    {entry.text}
                  </div>
                ))}
              </SwipeScrollArea>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (muted) setMuted(false);
                    toggleMicSpeech();
                  }}
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                    listening
                      ? 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-400 dark:text-zinc-950 dark:border-emerald-300'
                      : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                  title="Voice Mic"
                >
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakerOn((s) => !s)}
                  className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0"
                  title="Speaker"
                >
                  {speakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendTurn(messageInput);
                  }}
                  placeholder={isEmergency ? 'Silent SOS...' : 'Message...'}
                  className="flex-1 min-h-[40px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 py-2 text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-950 dark:focus:border-sky-400/60"
                />
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => sendTurn(messageInput)}
                  className="w-10 h-10 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white disabled:opacity-50 flex items-center justify-center shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInCall(false)}
                className="w-full min-h-[42px] rounded-xl bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:border-rose-500/30 py-2 text-xs font-semibold dark:text-rose-300 dark:hover:bg-rose-500/25"
              >
                End Call
              </button>
            </div>
          )}
        </SwipeScrollArea>
      </div>
    </div>
  );
};
