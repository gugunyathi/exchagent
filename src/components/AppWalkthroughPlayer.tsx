import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  RotateCcw,
  Film,
  Compass,
  Briefcase,
  Building2,
} from 'lucide-react';

export interface WalkthroughScenario {
  id: 'a2a-radar' | 'career-agent' | 'hr-portal';
  indexLabel: string;
  title: string;
  subtitle: string;
  durationSec: number;
  icon: 'compass' | 'briefcase' | 'building';
  accentHex: string;
  voiceSummary: string;
  chapters: Array<{ timeSec: number; label: string; detail: string }>;
}

export const WALKTHROUGH_SCENARIOS: WalkthroughScenario[] = [
  {
    id: 'a2a-radar',
    indexLabel: '01',
    title: 'Discover Contacts & Negotiate Deals Automatically',
    subtitle: 'Find professionals and businesses nearby, pitch offers within your price rules, and close approved agreements.',
    durationSec: 10,
    icon: 'compass',
    accentHex: '#0284c7',
    voiceSummary:
      'Step one: Find professionals and companies near you, let your agent negotiate pricing inside your set budget, and close signed agreements automatically.',
    chapters: [
      { timeSec: 0, label: 'Nearby Contact Discovery', detail: 'Instantly exchange cards at conferences or across cities' },
      { timeSec: 3.3, label: 'Automated Deal Pitching', detail: 'Exchanges counter-offers safely inside your budget limits' },
      { timeSec: 6.8, label: 'Deal Approved & Signed', detail: 'Locks final agreement and notifies both teams immediately' },
    ],
  },
  {
    id: 'career-agent',
    indexLabel: '02',
    title: '1-Click Career Agent & Automatic CV Tailoring',
    subtitle: 'Add your LinkedIn URL to get matched to global jobs, customize your CV and cover letter, and apply on autopilot.',
    durationSec: 10,
    icon: 'briefcase',
    accentHex: '#10b981',
    voiceSummary:
      'Step two: Paste your LinkedIn URL once. Your personal career agent finds ten free job matches globally, writes custom CVs and cover letters in PDF and Word, and logs every submission in your profile.',
    chapters: [
      { timeSec: 0, label: 'LinkedIn Quick Setup', detail: 'Creates your personal card and agent inbox in one click' },
      { timeSec: 3.4, label: '10 Free Global Job Matches', detail: 'Finds top matches worldwide including OpenAI Remote & Labs' },
      { timeSec: 6.8, label: 'Tailored CV & Cover Letter', detail: 'Downloads in PDF & Word and saves your complete history' },
    ],
  },
  {
    id: 'hr-portal',
    indexLabel: '03',
    title: 'Company Hiring Portal & Live Video Screening',
    subtitle: 'Spin up an employer agent from your careers page, review ranked applicants, and verify real candidates on camera.',
    durationSec: 10,
    icon: 'building',
    accentHex: '#6366f1',
    voiceSummary:
      'Step three: Businesses add one job link to launch a hiring agent. HR teams review ranked applicants, verify live video interviews, and celebrate every new hire.',
    chapters: [
      { timeSec: 0, label: '1-Click Employer Agent', detail: 'Publishes your verified company card and open vacancies' },
      { timeSec: 3.5, label: 'Verified Live Screening', detail: 'Checks live video interviews to confirm candidate authenticity' },
      { timeSec: 7.0, label: 'Hire Confirmed & Announced', detail: 'Sends shortlist packs to HR and shares Hired updates' },
    ],
  },
];

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderWalkthroughFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scenarioId: WalkthroughScenario['id'],
  progress01: number
) {
  ctx.clearRect(0, 0, w, h);

  // Studio dark glass canvas backdrop
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#09090d');
  grad.addColorStop(0.55, '#11131a');
  grad.addColorStop(1, '#080a0f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Architectural dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  const spacing = 28;
  for (let gx = 20; gx < w; gx += spacing) {
    for (let gy = 20; gy < h; gy += spacing) {
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  }

  // Top App Window Chrome Bar
  ctx.fillStyle = 'rgba(24, 24, 29, 0.92)';
  ctx.fillRect(0, 0, w, 46);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.lineTo(w, 46);
  ctx.stroke();

  // Window traffic dots + SWITCHZ header text
  const dotColors = ['#ef4444', '#f59e0b', '#10b981'];
  dotColors.forEach((c, idx) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(24 + idx * 16, 23, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#e4e4e7';
  ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('SWITCHZ Workspace', 82, 27);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 11px "JetBrains Mono", monospace';
  const secStr = `${(progress01 * 10).toFixed(1)}s / 10.0s`;
  ctx.fillText(secStr, w - 98, 27);

  const bodyX = 28;
  const bodyY = 66;
  const bodyW = w - 56;
  const bodyH = h - 94;

  if (scenarioId === 'a2a-radar') {
    // Left panel: Spatial Radar Sweep
    const radarW = bodyW * 0.44;
    drawRoundedRect(ctx, bodyX, bodyY, radarW, bodyH, 14);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.stroke();

    const cx = bodyX + radarW / 2;
    const cy = bodyY + bodyH / 2 + 6;
    const maxR = Math.min(radarW, bodyH) * 0.36;

    // Concentric rings
    [0.35, 0.65, 1].forEach((mult) => {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * mult, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Sweeping beam
    const angle = progress01 * Math.PI * 4 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const beam = ctx.createRadialGradient(0, 0, 4, 0, 0, maxR);
    beam.addColorStop(0, 'rgba(14, 165, 233, 0.42)');
    beam.addColorStop(1, 'rgba(14, 165, 233, 0.02)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxR, -0.4, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Radar nodes
    const nodes = [
      { dx: -0.52, dy: -0.34, label: 'chris.moleme.agent', color: '#38bdf8', appearAt: 0.05 },
      { dx: 0.48, dy: -0.25, label: 'ceo.woolworths.agent', color: '#10b981', appearAt: 0.22 },
      { dx: 0.25, dy: 0.56, label: 'careers.openai.agent', color: '#a78bfa', appearAt: 0.4 },
    ];
    nodes.forEach((n) => {
      if (progress01 < n.appearAt) return;
      const nx = cx + n.dx * maxR;
      const ny = cy + n.dy * maxR;
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(nx, ny, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(9,9,11,0.86)';
      drawRoundedRect(ctx, nx - 52, ny + 10, 104, 20, 6);
      ctx.fill();
      ctx.fillStyle = '#f4f4f5';
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillText(n.label, nx - 46, ny + 23);
    });

    ctx.fillStyle = '#7dd3fc';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillText('BLE PROXIMITY RADAR · LIVE', bodyX + 16, bodyY + 26);

    // Right panel: Bilateral A2A Negotiation Stream
    const rightX = bodyX + radarW + 18;
    const rightW = bodyW - radarW - 18;
    drawRoundedRect(ctx, rightX, bodyY, rightW, bodyH, 14);
    ctx.fillStyle = 'rgba(24, 24, 28, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    ctx.fillStyle = '#f4f4f5';
    ctx.font = '700 15px "Space Grotesk", sans-serif';
    ctx.fillText('Bilateral A2A Negotiation Arena', rightX + 20, bodyY + 32);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 11.5px "JetBrains Mono", monospace';
    ctx.fillText('Gemini 2.5 Flash Guardrail Engine · Margin >= 18%', rightX + 20, bodyY + 52);

    const msgs = [
      {
        at: 0.12,
        sender: 'chris.moleme.agent',
        badge: 'PROPOSAL',
        text: 'Enterprise B2B Pipeline Retainer · R48,000 / mo (Net 14)',
        bg: 'rgba(2, 132, 199, 0.18)',
        border: 'rgba(56, 189, 248, 0.4)',
      },
      {
        at: 0.36,
        sender: 'ceo.woolworths.agent',
        badge: 'COUNTER',
        text: 'Approved scope @ R44,500 / mo + x402 USDC milestone release',
        bg: 'rgba(161, 161, 170, 0.12)',
        border: 'rgba(255, 255, 255, 0.18)',
      },
      {
        at: 0.62,
        sender: 'GEMINI ARENA CONSENSUS',
        badge: 'LOCKED',
        text: 'Agreement Signed · Margin 22.4% verified inside corridor',
        bg: 'rgba(16, 185, 129, 0.2)',
        border: 'rgba(52, 211, 153, 0.5)',
      },
    ];

    msgs.forEach((m, idx) => {
      if (progress01 < m.at) return;
      const my = bodyY + 74 + idx * 72;
      drawRoundedRect(ctx, rightX + 20, my, rightW - 40, 58, 10);
      ctx.fillStyle = m.bg;
      ctx.fill();
      ctx.strokeStyle = m.border;
      ctx.stroke();

      ctx.fillStyle = '#e4e4e7';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(`${m.sender}  ·  ${m.badge}`, rightX + 32, my + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '500 12.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(m.text, rightX + 32, my + 42);
    });

    if (progress01 >= 0.72) {
      drawRoundedRect(ctx, rightX + 20, bodyY + bodyH - 46, rightW - 40, 32, 8);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.fillStyle = '#052e16';
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('$ DEAL APPROVED — STATUS CARD BROADCAST TO FEED', rightX + 34, bodyY + bodyH - 25);
    }
  } else if (scenarioId === 'career-agent') {
    // 3-step pipeline cards across top
    const stages = [
      { label: '01 LinkedIn URL Ingest', at: 0.0, doneAt: 0.3, sub: 'linkedin.com/in/candidate' },
      { label: '02 10 Free Role Matches', at: 0.28, doneAt: 0.62, sub: 'OpenAI · Woolworths · MTN' },
      { label: '03 CV + Cover PDF/DOCX', at: 0.6, doneAt: 0.95, sub: 'Tailored & Dispatched' },
    ];
    const colGap = 14;
    const colW = (bodyW - colGap * 2) / 3;

    stages.forEach((st, idx) => {
      const sx = bodyX + idx * (colW + colGap);
      const active = progress01 >= st.at;
      const done = progress01 >= st.doneAt;
      drawRoundedRect(ctx, sx, bodyY, colW, 74, 12);
      ctx.fillStyle = done
        ? 'rgba(16, 185, 129, 0.16)'
        : active
        ? 'rgba(56, 189, 248, 0.14)'
        : 'rgba(24, 24, 29, 0.75)';
      ctx.fill();
      ctx.strokeStyle = done
        ? 'rgba(52, 211, 153, 0.5)'
        : active
        ? 'rgba(56, 189, 248, 0.45)'
        : 'rgba(255,255,255,0.08)';
      ctx.stroke();

      ctx.fillStyle = done ? '#6ee7b7' : active ? '#7dd3fc' : '#71717a';
      ctx.font = '700 12px "Space Grotesk", sans-serif';
      ctx.fillText(st.label, sx + 14, bodyY + 28);
      ctx.fillStyle = '#d4d4d8';
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillText(st.sub, sx + 14, bodyY + 50);
    });

    // Bottom workspace: OpenAI Matches + Gemini CV Formatter
    const panelY = bodyY + 90;
    const panelH = bodyH - 90;
    const leftW = bodyW * 0.54;

    drawRoundedRect(ctx, bodyX, panelY, leftW, panelH, 14);
    ctx.fillStyle = 'rgba(24, 24, 29, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px "Space Grotesk", sans-serif';
    ctx.fillText('Auto-Matched Global Roles (OpenAI Careers + 10 Regions)', bodyX + 18, panelY + 28);

    const roles = [
      { title: 'AI Deployment Strategist · Remote Global', score: '97%', at: 0.18 },
      { title: 'Solutions Architect · London, UK', score: '94%', at: 0.34 },
      { title: 'Enterprise Account Director · San Francisco, US', score: '91%', at: 0.5 },
    ];
    roles.forEach((r, idx) => {
      if (progress01 < r.at) return;
      const ry = panelY + 46 + idx * 54;
      drawRoundedRect(ctx, bodyX + 16, ry, leftW - 32, 44, 9);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.28)';
      ctx.stroke();

      ctx.fillStyle = '#f4f4f5';
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(r.title, bodyX + 28, ry + 26);

      drawRoundedRect(ctx, bodyX + leftW - 76, ry + 11, 48, 22, 6);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.fillStyle = '#052e16';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(r.score, bodyX + leftW - 65, ry + 26);
    });

    // Right side: CV + Cover Letter Generator Output
    const docX = bodyX + leftW + 16;
    const docW = bodyW - leftW - 16;
    drawRoundedRect(ctx, docX, panelY, docW, panelH, 14);
    ctx.fillStyle = 'rgba(24, 24, 29, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    ctx.fillStyle = '#a7f3d0';
    ctx.font = '600 11.5px "JetBrains Mono", monospace';
    ctx.fillText('GEMINI TAILORED APPLICATION PACK', docX + 18, panelY + 28);

    const docLines = [
      '✓ Tailored CV formatted to OpenAI rubric',
      '✓ Custom Cover Letter aligned to role',
      '✓ Export ready: .PDF & .DOCX bundled',
      '✓ Dispatched via @agentmail.to inbox',
    ];
    docLines.forEach((line, idx) => {
      if (progress01 < 0.45 + idx * 0.12) return;
      ctx.fillStyle = '#e4e4e7';
      ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(line, docX + 18, panelY + 62 + idx * 28);
    });

    if (progress01 >= 0.72) {
      drawRoundedRect(ctx, docX + 18, panelY + panelH - 46, docW - 36, 30, 8);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Saved to Personal Profile Audit Log', docX + 34, panelY + panelH - 27);
    }
  } else {
    // HR Portal & Anti-Deepfake Studio
    const leftW = bodyW * 0.56;
    drawRoundedRect(ctx, bodyX, bodyY, leftW, bodyH, 14);
    ctx.fillStyle = 'rgba(24, 24, 29, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px "Space Grotesk", sans-serif';
    ctx.fillText('Employer HR Portal · Top Applier Dossiers', bodyX + 20, bodyY + 30);
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillText('careers.openai.agent · 10 Countries Active', bodyX + 20, bodyY + 50);

    const candidates = [
      { name: 'Thandi Dlamini', match: '98% Match', docs: 'CV.pdf + Cover.docx + Liveness Pass', at: 0.1 },
      { name: 'Chris Moleme', match: '95% Match', docs: 'CV.pdf + Cover.docx + 8s Video Pitch', at: 0.28 },
      { name: 'Alex Nkosi', match: '92% Match', docs: 'CV.pdf + Cover.docx + Verified ID', at: 0.45 },
    ];

    candidates.forEach((c, idx) => {
      if (progress01 < c.at) return;
      const cy = bodyY + 72 + idx * 68;
      drawRoundedRect(ctx, bodyX + 18, cy, leftW - 36, 56, 10);
      ctx.fillStyle = idx === 0 && progress01 > 0.65 ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255,255,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = idx === 0 && progress01 > 0.65 ? '#818cf8' : 'rgba(255,255,255,0.1)';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${c.name}  ·  ${c.match}`, bodyX + 30, cy + 24);
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillText(c.docs, bodyX + 30, cy + 43);
    });

    // Right side: Anti-Deepfake Biometric Studio + Handshake
    const rX = bodyX + leftW + 18;
    const rW = bodyW - leftW - 18;
    drawRoundedRect(ctx, rX, bodyY, rW, bodyH, 14);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
    ctx.stroke();

    ctx.fillStyle = '#c7d2fe';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('ANTI-DEEPFAKE BIOMETRIC STUDIO', rX + 18, bodyY + 28);

    // Biometric wireframe ring
    const bx = rX + rW / 2;
    const by = bodyY + 128;
    ctx.beginPath();
    ctx.arc(bx, by, 54, 0, Math.PI * 2);
    ctx.strokeStyle = progress01 > 0.55 ? '#10b981' : '#818cf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Scan line oscillating across face ring
    const scanOffset = Math.sin(progress01 * Math.PI * 6) * 42;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 48, by + scanOffset);
    ctx.lineTo(bx + 48, by + scanOffset);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 18px "JetBrains Mono", monospace';
    const scorePct = progress01 > 0.55 ? '99.4%' : `${Math.round(62 + progress01 * 55)}%`;
    ctx.fillText(scorePct, bx - 24, by + 6);

    ctx.fillStyle = progress01 > 0.55 ? '#6ee7b7' : '#a5b4fc';
    ctx.font = '600 11.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      progress01 > 0.55 ? 'Human Liveness Passed · Zero Synthetic Frame' : 'Scanning Blink & Micro-Expression Cadence...',
      rX + 20,
      by + 84
    );

    if (progress01 >= 0.72) {
      drawRoundedRect(ctx, rX + 18, bodyY + bodyH - 46, rW - 36, 32, 8);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.fillStyle = '#052e16';
      ctx.font = '700 11.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('HIRED STATUS ISSUED · NET 14 SLA LOGGED', rX + 28, bodyY + bodyH - 25);
    }
  }
}

export interface AppWalkthroughPlayerProps {
  externalScenarioId?: WalkthroughScenario['id'];
  externalTriggerNonce?: number;
}

export const AppWalkthroughPlayer: React.FC<AppWalkthroughPlayerProps> = ({
  externalScenarioId,
  externalTriggerNonce,
}) => {
  const [activeScenarioIdx, setActiveScenarioIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  // Default muted inline so it respects browser audio policy; explicit unmute button plays crisp step narration
  const [muted, setMuted] = useState(true);
  const [progress01, setProgress01] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fsCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!externalScenarioId) return;
    const idx = WALKTHROUGH_SCENARIOS.findIndex((s) => s.id === externalScenarioId);
    if (idx >= 0) {
      setActiveScenarioIdx(idx);
      setProgress01(0);
      setPlaying(true);
    }
  }, [externalScenarioId, externalTriggerNonce]);

  const scenario = WALKTHROUGH_SCENARIOS[activeScenarioIdx] || WALKTHROUGH_SCENARIOS[0];

  // Animation loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      if (playing) {
        setProgress01((prev) => {
          const next = prev + dt / scenario.durationSec;
          return next >= 1 ? 0 : next;
        });
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [playing, scenario.durationSec]);

  // Draw active canvas frames
  useEffect(() => {
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext('2d');
      if (ctx) renderWalkthroughFrame(ctx, c.width, c.height, scenario.id, progress01);
    }
    const fsc = fsCanvasRef.current;
    if (fullscreen && fsc) {
      const ctx = fsc.getContext('2d');
      if (ctx) renderWalkthroughFrame(ctx, fsc.width, fsc.height, scenario.id, progress01);
    }
  }, [progress01, scenario.id, fullscreen]);

  // Synchronized voice narration when unmuted
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (!muted && playing) {
      try {
        const utter = new SpeechSynthesisUtterance(scenario.voiceSummary);
        utter.rate = 1.03;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore if blocked
      }
    }
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    };
  }, [muted, playing, scenario.id]);

  // Escape exits cinema fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const currentSec = progress01 * scenario.durationSec;
  const activeChapter = [...scenario.chapters].reverse().find((ch) => currentSec >= ch.timeSec) || scenario.chapters[0];

  const getScenarioIcon = (icon: WalkthroughScenario['icon']) => {
    if (icon === 'compass') return Compass;
    if (icon === 'briefcase') return Briefcase;
    return Building2;
  };

  return (
    <div className="space-y-5">
      {/* Selector Tabs for the 3 App Video Examples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {WALKTHROUGH_SCENARIOS.map((sc, idx) => {
          const Icon = getScenarioIcon(sc.icon);
          const isActive = idx === activeScenarioIdx;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => {
                setActiveScenarioIdx(idx);
                setProgress01(0);
                setPlaying(true);
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                isActive
                  ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900/70 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 hover:border-zinc-400 dark:hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-mono opacity-75">
                  {sc.indexLabel} · VIDEO DEMO
                </span>
                <Icon className="w-4 h-4 opacity-80 shrink-0" />
              </div>
              <h3 className="font-display font-bold text-sm tracking-tight leading-snug">
                {sc.title}
              </h3>
              <p className={`mt-1 text-xs line-clamp-2 ${isActive ? 'opacity-80' : 'text-zinc-600 dark:text-zinc-400'}`}>
                {sc.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Video Showcase Player Frame */}
      <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-950 overflow-hidden shadow-xl">
        <div className="relative aspect-[16/9] w-full bg-[#09090d]">
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            onClick={() => setPlaying((p) => !p)}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Bottom Overlay Controls */}
          <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent space-y-2.5">
            {/* Scrubbable Timeline */}
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(progress01 * 1000)}
                onChange={(e) => setProgress01(Number(e.target.value) / 1000)}
                aria-label="Seek video walkthrough timeline"
                className="flex-1 h-1.5 accent-white cursor-pointer"
              />
              <span className="text-[11px] font-mono text-zinc-300 tabular-nums shrink-0">
                {currentSec.toFixed(1)}s / {scenario.durationSec}.0s
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="min-h-[34px] px-3 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{playing ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProgress01(0);
                    setPlaying(true);
                  }}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  title="Restart Demo"
                  aria-label="Restart Demo"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className={`min-h-[34px] px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border transition-colors ${
                    muted
                      ? 'bg-white/10 border-white/15 text-zinc-200 hover:bg-white/20'
                      : 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200'
                  }`}
                >
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{muted ? 'Muted · Unmute Audio' : 'Audio On'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-300">
                  <Film className="w-3.5 h-3.5 text-sky-400" />
                  <span>{activeChapter.label}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMuted(false);
                    setFullscreen(true);
                  }}
                  className="min-h-[34px] px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Full Screen</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Synchronized Chapter Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10 bg-zinc-900/90 border-t border-white/10">
          {scenario.chapters.map((ch) => {
            const isCurrent = activeChapter.timeSec === ch.timeSec;
            return (
              <button
                key={ch.label}
                type="button"
                onClick={() => {
                  setProgress01(ch.timeSec / scenario.durationSec);
                  setPlaying(true);
                }}
                className={`p-3 text-left transition-colors ${
                  isCurrent ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span className="block text-[10px] font-mono text-sky-400 tabular-nums">
                  {ch.timeSec.toFixed(1)}s · {ch.label}
                </span>
                <span className="block text-xs text-zinc-300 mt-0.5 line-clamp-1">{ch.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cinema Fullscreen Portal */}
      {fullscreen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[85] bg-black/95 backdrop-blur-md flex flex-col p-3 sm:p-6"
            onClick={() => setFullscreen(false)}
          >
            <div
              className="flex items-center justify-between gap-3 mb-3 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="font-display font-bold text-base sm:text-lg">{scenario.title}</h3>
                <p className="text-xs text-zinc-400">{activeChapter.label} — {activeChapter.detail}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className="min-h-[36px] px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium inline-flex items-center gap-1.5"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{muted ? 'Unmute' : 'Audio On'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreen(false)}
                  className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center"
                  aria-label="Exit Full Screen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              className="flex-1 min-h-0 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <canvas
                ref={fsCanvasRef}
                width={1280}
                height={720}
                onClick={() => setPlaying((p) => !p)}
                className="max-w-full max-h-full rounded-xl border border-white/15 bg-[#09090d] cursor-pointer"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
