import { AgentDoc, JobPostingDoc, PoppyDocument } from '../types/firestore';

export const POPPY_PROTOCOL_VERSION = '1.0';
export const POPPY_SUPPORTED_VERSIONS = ['1.0', '0.4'];

export const OFFICIAL_POPPY_EXTENSIONS = [
  {
    name: 'operations',
    version: 3,
    summary: 'Explicit human or pre-authorized agent approval of exact terms with at-most-once idempotent replay safety.',
  },
  {
    name: 'links',
    version: 1,
    summary: 'Messages carry verified web pages and job/careers links as structured references.',
  },
  {
    name: 'disclosures',
    version: 1,
    summary: 'Marks mandatory notices, blind screening advisories, and compliance warnings apart from conversation text.',
  },
  {
    name: 'browser-control',
    version: 1,
    summary: 'Explicit handoff signaling whether agent or user controls interactive web checkout or portal steps.',
  },
  {
    name: 'mediated-sign-in',
    version: 1,
    summary: 'Transitional encrypted credential/OTP bridge for legacy portals without Direct or Device Sign-In.',
  },
  {
    name: 'ucp',
    version: 1,
    summary: 'Universal Commerce Protocol bridge for cart settlement and instant commerce handoff.',
  },
] as const;

export function buildPlatformPoppyDoc(origin: string): PoppyDocument {
  return {
    protocol_version: '1.0',
    supported_versions: ['1.0', '0.4'],
    organization: {
      name: 'Switchboard (AgentPages)',
      website: origin,
      contact: 'agent-support@switchboard.agent',
      privacy_policy: `${origin}/skills.md`,
      terms: `${origin}/api/poppy/tasks`,
    },
    auth: {
      client_metadata_document: `${origin}/agent.json`,
      sign_in_types: ['direct', 'device', 'mediated'],
      scopes: [
        'profile:read',
        'cv:read',
        'apply',
        'calendar',
        'ucp:checkout',
        'poppy:browser-sign-in',
      ],
      scope_hints: {
        'profile:read': {
          summary: 'Read verified public .agent card, headline, and LinkedIn reference URL.',
          changes: 'none',
          personal_data: true,
        },
        'cv:read': {
          summary: 'Read structured skills graph, years of experience, and salary preferences.',
          changes: 'none',
          personal_data: true,
        },
        apply: {
          summary: 'Submit candidate job application or respond to hiring screen under Operations v3 approval.',
          changes: 'irreversible',
          personal_data: true,
        },
        calendar: {
          summary: 'Propose or book mutual interview & commercial SLA meeting slots.',
          changes: 'reversible',
          personal_data: true,
        },
        'ucp:checkout': {
          summary: 'Initiate Universal Commerce Protocol settlement via x402 or PayPal Vault.',
          changes: 'irreversible',
          personal_data: true,
        },
        'poppy:browser-sign-in': {
          summary: 'Join an authorized web browser session directly from a Poppy Agent session.',
          changes: 'reversible',
          personal_data: true,
        },
      },
    },
    agent: {
      protocols: {
        conversations: {
          version: '1.0',
          endpoint: `${origin}/api/poppy/conversations`,
          modes: ['sync', 'polling', 'sse', 'direct', 'handoff'],
        },
      },
      handle: 'directory.switchboard.agent',
    },
    web: {
      browser_session_endpoint: `${origin}/api/poppy/browser-session`,
    },
    tasks: {
      endpoint: `${origin}/api/poppy/tasks`,
    },
    apis: {
      openapi: `${origin}/api/skill.json`,
      mcp: `${origin}/skills.md`,
    },
    extensions: {
      operations: {
        version: 3,
        endpoint: `${origin}/api/poppy/operations/execute`,
        description: 'Human-in-the-loop approval & at-most-once execution for apply, shortlist, interview, and settlement actions.',
      },
      links: {
        version: 1,
        description: 'Structured verified company careers, LinkedIn, and JD URL attachments.',
      },
      disclosures: {
        version: 1,
        description: 'POPIA/GDPR notices, AI matching transparency & blind screening advisories.',
      },
      'browser-control': {
        version: 1,
        description: 'Agent/user web handoff coordination during portal or checkout steps.',
      },
      'mediated-sign-in': {
        version: 1,
        modes: ['otp', 'vault_token'],
        description: 'Transitional sign-in adapter where Direct/Device OAuth is unavailable.',
      },
      ucp: {
        version: 1,
        supported_providers: ['x402_base', 'paypal_vault', 'x402_solana'],
        description: 'Universal Commerce Protocol checkout & escrow settlement bridge.',
      },
    },
  };
}

export function buildEntityPoppyDoc(
  origin: string,
  opts: {
    entityType: 'user' | 'company' | 'job';
    agent?: AgentDoc;
    job?: JobPostingDoc;
  }
): PoppyDocument {
  const base = buildPlatformPoppyDoc(origin);
  if (opts.entityType === 'job' && opts.job) {
    return {
      ...base,
      organization: {
        name: `${opts.job.companyName} — ${opts.job.title}`,
        website: opts.job.careersUrl,
        contact: opts.job.companyAgentHandle,
      },
      auth: {
        ...base.auth,
        scopes: ['profile:read', 'cv:read', 'apply', 'calendar'],
      },
      agent: {
        ...base.agent,
        entity_role: 'hiring',
        handle: opts.job.companyAgentHandle,
      },
    };
  }

  const a = opts.agent;
  if (!a) return base;
  const website = a.websiteUrl
    ? `https://${a.websiteUrl.replace(/^https?:\/\//, '')}`
    : a.linkedinUrl
    ? `https://${a.linkedinUrl.replace(/^https?:\/\//, '')}`
    : origin;

  return {
    ...base,
    organization: {
      name: a.displayName,
      website,
      contact: a.agentEmail,
    },
    auth: {
      ...base.auth,
      scopes: a.poppyScopes?.length ? a.poppyScopes : ['profile:read', 'calendar'],
    },
    agent: {
      ...base.agent,
      entity_role: a.agentRoleCategory || (a.type === 'persona' ? 'job_seeker' : 'commerce'),
      handle: a.handle,
    },
  };
}

/**
 * RFC 9651 Dictionary header parser for Poppy-Extensions
 * e.g. `"operations";v="3", "links";v="1", "disclosures";v="1"`
 * or bare tokens `operations;v=3, links;v=1`
 */
export function parsePoppyExtensionsHeader(headerValue: string | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  if (!headerValue || typeof headerValue !== 'string') return result;

  const entries = headerValue.split(',').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const [rawName, ...params] = entry.split(';').map((s) => s.trim());
    const name = rawName.replace(/^["']|["']$/g, '').split('=')[0].trim().toLowerCase();
    let version = 1;
    for (const p of params) {
      const m = p.match(/^v\s*=\s*"?(\d+)"?$/i);
      if (m) version = Number(m[1]);
    }
    if (name) {
      result[name] = version;
    }
  }
  return result;
}

export interface PoppyValidationCheck {
  field: string;
  passed: boolean;
  detail: string;
}

export interface PoppyValidationReport {
  valid: boolean;
  score: number;
  checks: PoppyValidationCheck[];
}

export function validatePoppyDocument(doc: unknown): PoppyValidationReport {
  const checks: PoppyValidationCheck[] = [];
  const d = (doc && typeof doc === 'object' ? doc : {}) as Partial<PoppyDocument>;

  checks.push({
    field: 'protocol_version',
    passed: typeof d.protocol_version === 'string' && d.protocol_version.length > 0,
    detail: d.protocol_version ? `Declared v${d.protocol_version}` : 'Missing protocol_version string',
  });

  checks.push({
    field: 'supported_versions',
    passed: Array.isArray(d.supported_versions) && d.supported_versions.includes('1.0'),
    detail: Array.isArray(d.supported_versions)
      ? `Supports [${d.supported_versions.join(', ')}]`
      : 'supported_versions array missing or lacks "1.0"',
  });

  checks.push({
    field: 'organization',
    passed: Boolean(d.organization?.name && d.organization?.website),
    detail: d.organization?.name ? `${d.organization.name} (${d.organization.website})` : 'organization.name & website required',
  });

  checks.push({
    field: 'auth.scopes & scope_hints',
    passed: Array.isArray(d.auth?.scopes) && d.auth.scopes.length > 0 && Boolean(d.auth?.scope_hints),
    detail: `${d.auth?.scopes?.length || 0} scopes declared with scope_hints risk annotations`,
  });

  const convEndpoint = d.agent?.protocols?.conversations?.endpoint;
  checks.push({
    field: 'agent.protocols.conversations',
    passed: Boolean(convEndpoint && /^https?:\/\//.test(convEndpoint)),
    detail: convEndpoint || 'Missing conversations protocol endpoint',
  });

  checks.push({
    field: 'web.browser_session_endpoint',
    passed: Boolean(d.web?.browser_session_endpoint),
    detail: d.web?.browser_session_endpoint || 'Missing browser_session_endpoint for Browser Session Join (§6)',
  });

  checks.push({
    field: 'tasks.endpoint',
    passed: Boolean(d.tasks?.endpoint),
    detail: d.tasks?.endpoint || 'Missing tasks.endpoint for excluded_tasks & feedback (§9)',
  });

  const extCount = d.extensions ? Object.keys(d.extensions).length : 0;
  checks.push({
    field: 'extensions',
    passed: extCount > 0,
    detail: `${extCount} Poppy extension(s) advertised`,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    valid: passedCount === checks.length,
    score: Math.round((passedCount / checks.length) * 100),
    checks,
  };
}
