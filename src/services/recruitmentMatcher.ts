import {
  AgentDoc,
  JobPostingDoc,
  RecruitmentMatchDoc,
} from '../types/firestore';

/**
 * Calculates a scored RecruitmentMatchDoc between a candidate agent and a job vacancy.
 */
export function matchCandidateToJob(
  seeker: AgentDoc,
  job: JobPostingDoc,
  existingMatch?: RecruitmentMatchDoc
): RecruitmentMatchDoc {
  const seekerSkills = Array.from(
    new Set([
      ...(seeker.skills || []),
      ...(seeker.cvSummary?.parsedSkills || []),
      ...(seeker.impliedIntent?.topics || []),
      ...(seeker.impliedIntent?.desiredOutcomes || []),
      ...(seeker.roleTitle ? seeker.roleTitle.split(/[/,&·]/) : []),
    ])
  )
    .map((s) => s.trim())
    .filter(Boolean);

  const reqSkills = job.requiredSkills && job.requiredSkills.length > 0
    ? job.requiredSkills
    : ['Technical Competency', 'Communication', 'Execution'];

  const matchedSkills = reqSkills.filter((req) =>
    seekerSkills.some(
      (sk) =>
        sk.toLowerCase().includes(req.toLowerCase()) ||
        req.toLowerCase().includes(sk.toLowerCase())
    )
  );

  const missingSkills = reqSkills.filter((req) => !matchedSkills.includes(req));

  const overlapRatio = matchedSkills.length / Math.max(1, reqSkills.length);
  const skillsOverlap = Math.min(98, Math.max(58, Math.round(overlapRatio * 40 + 58)));

  const yearsExp = seeker.cvSummary?.yearsExp ?? 5;
  const expDiff = yearsExp - (job.minYearsExp || 3);
  const experienceFit = Math.min(98, Math.max(65, 85 + (expDiff >= 0 ? Math.min(expDiff * 3, 12) : expDiff * 6)));

  const candidateMin = seeker.cvSummary?.salaryMinZAR || 85000;
  const jobMax = job.salaryRangeZAR ? job.salaryRangeZAR[1] : 120000;
  const compensationFit = candidateMin <= jobMax ? 94 : Math.max(68, Math.round(94 - ((candidateMin - jobMax) / 10000) * 4));

  const locationCultureFit =
    job.remoteMode === 'Remote'
      ? 96
      : job.remoteMode === 'Hybrid'
      ? 90
      : 84;

  const rawW = job.weights || { skills: 0.45, experience: 0.25, compensation: 0.15, location: 0.15 };
  const norm = (val: number, fallback: number) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return n > 1 ? n / 100 : n;
  };
  const wSkills = norm(rawW.skills, 0.45);
  const wExp = norm(rawW.experience, 0.25);
  const wComp = norm(rawW.compensation, 0.15);
  const wLoc = norm(rawW.location, 0.15);
  const wSum = wSkills + wExp + wComp + wLoc || 1;
  const rawScore = Math.round(
    (skillsOverlap * wSkills +
      experienceFit * wExp +
      compensationFit * wComp +
      locationCultureFit * wLoc) /
      wSum
  );
  const score = Math.min(98, Math.max(68, rawScore));

  const explanation = matchedSkills.length > 0
    ? `Strong match in ${matchedSkills.slice(0, 3).join(', ')} with ${yearsExp} yrs experience fit for ${job.title} (${job.remoteMode}).`
    : `Transferable alignment for ${job.title} at ${job.companyName} based on verified competencies and ${job.remoteMode} availability.`;

  const strengths = [
    matchedSkills.length > 0
      ? `Direct competency match: ${matchedSkills.slice(0, 3).join(', ')}`
      : `${yearsExp} years verified experience in domain`,
    `${job.remoteMode} availability · Verified Poppy Protocol identifier (${seeker.handle})`,
  ];

  const gaps = missingSkills.length > 0
    ? [missingSkills[0], ...(missingSkills[1] ? [missingSkills[1]] : [])]
    : ['Role-specific environment briefing'];

  const matchId = `match_${job.id}_${seeker.id}`;
  const now = new Date().toISOString();

  const interviewPitch =
    existingMatch?.interviewPitch ||
    `Hi ${job.companyName} Hiring Agent — representing ${seeker.displayName} (${seeker.handle}) for ${job.title}. ${seeker.displayName} brings ${yearsExp}+ years experience with core focus in ${matchedSkills.slice(0, 2).join(' & ') || 'modern systems'}. Available for a screening video interview.`;

  return {
    id: matchId,
    jobId: job.id,
    jobTitle: job.title,
    companyAgentHandle: job.companyAgentHandle,
    seekerHandle: seeker.handle,
    seekerName: seeker.displayName,
    score,
    factors: {
      skillsOverlap,
      experienceFit,
      compensationFit,
      locationCultureFit,
    },
    explanation,
    strengths,
    gaps,
    blindMode: Boolean(seeker.cvSummary?.blindScreening),
    status: existingMatch?.status || 'suggested',
    operationId: existingMatch?.operationId,
    interviewPitch,
    updatedAt: now,
  };
}

/**
 * Matches a single candidate agent to all available job vacancies.
 */
export function matchCandidateToAllJobs(
  seeker: AgentDoc,
  jobs: JobPostingDoc[],
  existingMatches: RecruitmentMatchDoc[] = []
): RecruitmentMatchDoc[] {
  const matchMap = new Map<string, RecruitmentMatchDoc>();
  existingMatches.forEach((m) => matchMap.set(`${m.jobId}_${m.seekerHandle}`, m));

  return jobs
    .filter((j) => j.status === 'OPEN')
    .map((job) => {
      const existing = matchMap.get(`${job.id}_${seeker.handle}`);
      return matchCandidateToJob(seeker, job, existing);
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Matches a newly created job vacancy to all available candidate/persona agents.
 */
export function matchJobToAllCandidates(
  job: JobPostingDoc,
  candidates: AgentDoc[],
  existingMatches: RecruitmentMatchDoc[] = []
): RecruitmentMatchDoc[] {
  const matchMap = new Map<string, RecruitmentMatchDoc>();
  existingMatches.forEach((m) => matchMap.set(`${m.jobId}_${m.seekerHandle}`, m));

  return candidates
    .filter((c) => c.type === 'persona' && c.handle !== '911.emergency.agent')
    .map((candidate) => {
      const existing = matchMap.get(`${job.id}_${candidate.handle}`);
      return matchCandidateToJob(candidate, job, existing);
    })
    .sort((a, b) => b.score - a.score);
}
