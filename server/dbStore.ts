import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  SEED_AGENTS,
  SEED_RFPS,
  SEED_NEGOTIATIONS,
  SEED_SETTLEMENTS,
  SEED_CLAIMED_HANDLES,
  SEED_AUCTIONS,
  SEED_SECONDARY_LISTINGS,
  SEED_BOOKINGS,
  SEED_EMAILS,
  SEED_VOICE_SESSIONS,
  SEED_JOBS,
  SEED_MATCHES,
  SEED_POPPY_OPERATIONS,
  SEED_POPPY_CONSENTS,
  SEED_POPPY_AUDIT_LOGS,
  SEED_CONTACTS,
  SEED_APPLICATION_PACKAGES,
  SEED_AGENT_HISTORY,
  SEED_STATUS_POSTS,
} from '../src/data/seedData';
import {
  AgentActionHistoryEntry,
  AgentApplicationPackage,
  AgentDoc,
  AgentEmailDoc,
  AgentHandleDoc,
  AgentStatusPostDoc,
  AuctionDoc,
  BookingDoc,
  DevicePasskeyRecord,
  JobPostingDoc,
  NegotiationDoc,
  PersonalContactDoc,
  PoppyAuditLogEntry,
  PoppyConsentGrant,
  PoppyConversation,
  PoppyOperation,
  RecruitmentMatchDoc,
  RfpDoc,
  AdCampaignDoc,
  FREE_MATCH_LIMIT,
  SecondaryListingDoc,
  SettlementDoc,
  UserAgentActivityEntry,
  UserSessionRecord,
  VoiceChatSessionDoc,
  X402AccountEntitlement,
  X402ChallengePayload,
  X402PayableCategory,
  X402PaymentReceipt,
  X402_REVENUE_CATALOG,
} from '../src/types/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', '.data');
const DB_FILE = path.join(DATA_DIR, 'switchz-db.json');

const SESSION_SECRET =
  process.env.SWITCHZ_SESSION_SECRET ||
  process.env.POPPY_HMAC_SECRET ||
  'switchz-device-session-secret-v1';

export interface SwitchzDatabaseState {
  version: number;
  updatedAt: string;
  agents: AgentDoc[];
  rfps: RfpDoc[];
  jobs: JobPostingDoc[];
  matches: RecruitmentMatchDoc[];
  applicationPackages: AgentApplicationPackage[];
  agentActionHistory: AgentActionHistoryEntry[];
  activities: UserAgentActivityEntry[];
  negotiations: NegotiationDoc[];
  settlements: SettlementDoc[];
  bookings: BookingDoc[];
  emails: AgentEmailDoc[];
  voiceSessions: VoiceChatSessionDoc[];
  claimedHandles: AgentHandleDoc[];
  auctions: AuctionDoc[];
  secondaryListings: SecondaryListingDoc[];
  poppyConversations: PoppyConversation[];
  poppyOperations: PoppyOperation[];
  poppyConsents: PoppyConsentGrant[];
  poppyAuditLogs: PoppyAuditLogEntry[];
  statusPosts: AgentStatusPostDoc[];
  contacts: PersonalContactDoc[];
  passkeys: DevicePasskeyRecord[];
  sessions: UserSessionRecord[];
  x402Receipts: X402PaymentReceipt[];
  x402Entitlements: Record<string, X402AccountEntitlement>;
  adCampaigns: AdCampaignDoc[];
}

interface StoredChallenge {
  challenge: string;
  mode: 'register' | 'login';
  ownerUid?: string;
  deviceId: string;
  displayName?: string;
  email?: string;
  expiresAtMs: number;
}

const challengesMap = new Map<string, StoredChallenge>();

function mergeByKey<T>(existing: T[], incoming: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    const k = keyFn(item);
    if (k) map.set(k, item);
  }
  for (const item of incoming) {
    const k = keyFn(item);
    if (k) map.set(k, item);
  }
  return Array.from(map.values());
}

function mergeSeedFallback<T>(loaded: T[] | undefined, seeded: T[], keyFn: (item: T) => string): T[] {
  if (!loaded || !Array.isArray(loaded) || loaded.length === 0) return [...seeded];
  return mergeByKey(seeded, loaded, keyFn);
}

function createDefaultState(): SwitchzDatabaseState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    agents: [...SEED_AGENTS],
    rfps: [...SEED_RFPS],
    jobs: [...SEED_JOBS],
    matches: [...SEED_MATCHES],
    applicationPackages: [...SEED_APPLICATION_PACKAGES],
    agentActionHistory: [...SEED_AGENT_HISTORY],
    activities: [],
    negotiations: [...SEED_NEGOTIATIONS],
    settlements: [...SEED_SETTLEMENTS],
    bookings: [...SEED_BOOKINGS],
    emails: [...SEED_EMAILS],
    voiceSessions: [...SEED_VOICE_SESSIONS],
    claimedHandles: [...SEED_CLAIMED_HANDLES],
    auctions: [...SEED_AUCTIONS],
    secondaryListings: [...SEED_SECONDARY_LISTINGS],
    poppyConversations: [],
    poppyOperations: [...SEED_POPPY_OPERATIONS],
    poppyConsents: [...SEED_POPPY_CONSENTS],
    poppyAuditLogs: [...SEED_POPPY_AUDIT_LOGS],
    statusPosts: [...SEED_STATUS_POSTS],
    contacts: [...SEED_CONTACTS],
    passkeys: [],
    sessions: [],
    x402Receipts: [],
    x402Entitlements: {},
    adCampaigns: [],
  };
}

function loadFromDisk(): SwitchzDatabaseState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as Partial<SwitchzDatabaseState>;
        return {
          version: 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          agents: mergeSeedFallback(parsed.agents, SEED_AGENTS, (a) => a.id),
          rfps: mergeSeedFallback(parsed.rfps, SEED_RFPS, (r) => r.id),
          jobs: mergeSeedFallback(parsed.jobs, SEED_JOBS, (j) => j.id),
          matches: mergeSeedFallback(parsed.matches, SEED_MATCHES, (m) => m.id),
          applicationPackages: mergeSeedFallback(
            parsed.applicationPackages,
            SEED_APPLICATION_PACKAGES,
            (p) => p.id
          ),
          agentActionHistory: mergeSeedFallback(
            parsed.agentActionHistory,
            SEED_AGENT_HISTORY,
            (h) => h.id
          ),
          activities: Array.isArray(parsed.activities) ? parsed.activities : [],
          negotiations: mergeSeedFallback(parsed.negotiations, SEED_NEGOTIATIONS, (n) => n.id),
          settlements: mergeSeedFallback(parsed.settlements, SEED_SETTLEMENTS, (s) => s.id),
          bookings: mergeSeedFallback(parsed.bookings, SEED_BOOKINGS, (b) => b.id),
          emails: mergeSeedFallback(parsed.emails, SEED_EMAILS, (e) => e.id),
          voiceSessions: mergeSeedFallback(
            parsed.voiceSessions,
            SEED_VOICE_SESSIONS,
            (v) => v.id
          ),
          claimedHandles: mergeSeedFallback(
            parsed.claimedHandles,
            SEED_CLAIMED_HANDLES,
            (h) => h.id
          ),
          auctions: mergeSeedFallback(parsed.auctions, SEED_AUCTIONS, (a) => a.id),
          secondaryListings: mergeSeedFallback(
            parsed.secondaryListings,
            SEED_SECONDARY_LISTINGS,
            (s) => s.id
          ),
          poppyConversations: Array.isArray(parsed.poppyConversations)
            ? parsed.poppyConversations
            : [],
          poppyOperations: mergeSeedFallback(
            parsed.poppyOperations,
            SEED_POPPY_OPERATIONS,
            (o) => o.operation_id
          ),
          poppyConsents: mergeSeedFallback(
            parsed.poppyConsents,
            SEED_POPPY_CONSENTS,
            (c) => c.id
          ),
          poppyAuditLogs: mergeSeedFallback(
            parsed.poppyAuditLogs,
            SEED_POPPY_AUDIT_LOGS,
            (l) => l.id
          ),
          statusPosts: mergeSeedFallback(parsed.statusPosts, SEED_STATUS_POSTS, (p) => p.id),
          contacts: mergeSeedFallback(parsed.contacts, SEED_CONTACTS, (c) => c.id),
          passkeys: Array.isArray(parsed.passkeys) ? parsed.passkeys : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          x402Receipts: Array.isArray(parsed.x402Receipts) ? parsed.x402Receipts : [],
          x402Entitlements:
            parsed.x402Entitlements && typeof parsed.x402Entitlements === 'object'
              ? parsed.x402Entitlements
              : {},
          adCampaigns: Array.isArray(parsed.adCampaigns) ? parsed.adCampaigns : [],
        };
      }
    }
  } catch (err) {
    console.warn('Database hydration warning (starting from clean seed):', err);
  }
  return createDefaultState();
}

const dbState: SwitchzDatabaseState = loadFromDisk();
let pendingWriteTimer: NodeJS.Timeout | null = null;

export function saveNow(): void {
  try {
    if (pendingWriteTimer) {
      clearTimeout(pendingWriteTimer);
      pendingWriteTimer = null;
    }
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    dbState.updatedAt = new Date().toISOString();
    const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(dbState, null, 2), 'utf8');
    fs.renameSync(tmpPath, DB_FILE);
  } catch (err) {
    console.error('Failed to flush switchz-db.json:', err);
  }
}

export function saveSoon(): void {
  if (pendingWriteTimer) return;
  pendingWriteTimer = setTimeout(() => {
    pendingWriteTimer = null;
    saveNow();
  }, 200);
}

export function getDbState(): SwitchzDatabaseState {
  return dbState;
}

export function appendHistory(
  entry: Omit<AgentActionHistoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): AgentActionHistoryEntry {
  const full: AgentActionHistoryEntry = {
    ...entry,
    id: entry.id || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
  };
  dbState.agentActionHistory = [
    full,
    ...dbState.agentActionHistory.filter((h) => h.id !== full.id),
  ].slice(0, 500);
  saveSoon();
  return full;
}

export function appendActivity(
  entry: Omit<UserAgentActivityEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): UserAgentActivityEntry {
  const full: UserAgentActivityEntry = {
    ...entry,
    id: entry.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
  };
  dbState.activities = [full, ...dbState.activities.filter((a) => a.id !== full.id)].slice(0, 600);
  saveSoon();
  return full;
}

export function upsertAgents(incoming: AgentDoc[], flush = false): AgentDoc[] {
  dbState.agents = mergeByKey(dbState.agents, incoming, (a) => a.id);
  if (flush) saveNow();
  else saveSoon();
  return dbState.agents;
}

export function upsertJobs(incoming: JobPostingDoc[]): JobPostingDoc[] {
  dbState.jobs = mergeByKey(dbState.jobs, incoming, (j) => j.id);
  saveSoon();
  return dbState.jobs;
}

export function upsertMatches(incoming: RecruitmentMatchDoc[]): RecruitmentMatchDoc[] {
  dbState.matches = mergeByKey(dbState.matches, incoming, (m) => m.id);
  saveSoon();
  return dbState.matches;
}

export function upsertPoppyOperation(op: PoppyOperation): void {
  dbState.poppyOperations = [
    op,
    ...dbState.poppyOperations.filter((o) => o.operation_id !== op.operation_id),
  ].slice(0, 300);
  saveSoon();
}

export function upsertPoppyConversation(conv: PoppyConversation): void {
  dbState.poppyConversations = [
    conv,
    ...dbState.poppyConversations.filter((c) => c.id !== conv.id),
  ].slice(0, 200);
  saveSoon();
}

export function appendPoppyAudit(entry: PoppyAuditLogEntry): void {
  dbState.poppyAuditLogs = [
    entry,
    ...dbState.poppyAuditLogs.filter((l) => l.id !== entry.id),
  ].slice(0, 400);
  saveSoon();
}

export function syncSliceToDb(
  patch: Partial<
    Pick<
      SwitchzDatabaseState,
      | 'agents'
      | 'rfps'
      | 'jobs'
      | 'matches'
      | 'applicationPackages'
      | 'agentActionHistory'
      | 'activities'
      | 'negotiations'
      | 'settlements'
      | 'bookings'
      | 'emails'
      | 'voiceSessions'
      | 'claimedHandles'
      | 'auctions'
      | 'secondaryListings'
      | 'poppyOperations'
      | 'poppyConsents'
      | 'poppyAuditLogs'
      | 'statusPosts'
      | 'contacts'
      | 'x402Receipts'
      | 'adCampaigns'
    >
  >
): { updatedCounts: Record<string, number>; updatedAt: string } {
  const counts: Record<string, number> = {};

  if (Array.isArray(patch.agents)) {
    dbState.agents = mergeByKey(dbState.agents, patch.agents, (a) => a.id);
    counts.agents = patch.agents.length;
  }
  if (Array.isArray(patch.rfps)) {
    dbState.rfps = mergeByKey(dbState.rfps, patch.rfps, (r) => r.id);
    counts.rfps = patch.rfps.length;
  }
  if (Array.isArray(patch.jobs)) {
    dbState.jobs = mergeByKey(dbState.jobs, patch.jobs, (j) => j.id);
    counts.jobs = patch.jobs.length;
  }
  if (Array.isArray(patch.matches)) {
    dbState.matches = mergeByKey(dbState.matches, patch.matches, (m) => m.id);
    counts.matches = patch.matches.length;
  }
  if (Array.isArray(patch.applicationPackages)) {
    dbState.applicationPackages = mergeByKey(
      dbState.applicationPackages,
      patch.applicationPackages,
      (p) => p.id
    );
    counts.applicationPackages = patch.applicationPackages.length;
  }
  if (Array.isArray(patch.agentActionHistory)) {
    dbState.agentActionHistory = mergeByKey(
      dbState.agentActionHistory,
      patch.agentActionHistory,
      (h) => h.id
    ).slice(0, 500);
    counts.agentActionHistory = patch.agentActionHistory.length;
  }
  if (Array.isArray(patch.activities)) {
    dbState.activities = mergeByKey(dbState.activities, patch.activities, (a) => a.id).slice(
      0,
      600
    );
    counts.activities = patch.activities.length;
  }
  if (Array.isArray(patch.negotiations)) {
    dbState.negotiations = mergeByKey(dbState.negotiations, patch.negotiations, (n) => n.id);
    counts.negotiations = patch.negotiations.length;
  }
  if (Array.isArray(patch.settlements)) {
    dbState.settlements = mergeByKey(dbState.settlements, patch.settlements, (s) => s.id);
    counts.settlements = patch.settlements.length;
  }
  if (Array.isArray(patch.bookings)) {
    dbState.bookings = mergeByKey(dbState.bookings, patch.bookings, (b) => b.id);
    counts.bookings = patch.bookings.length;
  }
  if (Array.isArray(patch.emails)) {
    dbState.emails = mergeByKey(dbState.emails, patch.emails, (e) => e.id);
    counts.emails = patch.emails.length;
  }
  if (Array.isArray(patch.voiceSessions)) {
    dbState.voiceSessions = mergeByKey(dbState.voiceSessions, patch.voiceSessions, (v) => v.id);
    counts.voiceSessions = patch.voiceSessions.length;
  }
  if (Array.isArray(patch.claimedHandles)) {
    dbState.claimedHandles = mergeByKey(
      dbState.claimedHandles,
      patch.claimedHandles,
      (c) => c.id
    );
    counts.claimedHandles = patch.claimedHandles.length;
  }
  if (Array.isArray(patch.auctions)) {
    dbState.auctions = mergeByKey(dbState.auctions, patch.auctions, (a) => a.id);
    counts.auctions = patch.auctions.length;
  }
  if (Array.isArray(patch.secondaryListings)) {
    dbState.secondaryListings = mergeByKey(
      dbState.secondaryListings,
      patch.secondaryListings,
      (s) => s.id
    );
    counts.secondaryListings = patch.secondaryListings.length;
  }
  if (Array.isArray(patch.poppyOperations)) {
    dbState.poppyOperations = mergeByKey(
      dbState.poppyOperations,
      patch.poppyOperations,
      (o) => o.operation_id
    );
    counts.poppyOperations = patch.poppyOperations.length;
  }
  if (Array.isArray(patch.poppyConsents)) {
    dbState.poppyConsents = mergeByKey(dbState.poppyConsents, patch.poppyConsents, (c) => c.id);
    counts.poppyConsents = patch.poppyConsents.length;
  }
  if (Array.isArray(patch.poppyAuditLogs)) {
    dbState.poppyAuditLogs = mergeByKey(
      dbState.poppyAuditLogs,
      patch.poppyAuditLogs,
      (l) => l.id
    ).slice(0, 400);
    counts.poppyAuditLogs = patch.poppyAuditLogs.length;
  }
  if (Array.isArray(patch.statusPosts)) {
    dbState.statusPosts = mergeByKey(dbState.statusPosts, patch.statusPosts, (s) => s.id).slice(
      0,
      120
    );
    counts.statusPosts = patch.statusPosts.length;
  }
  if (Array.isArray(patch.contacts)) {
    dbState.contacts = mergeByKey(dbState.contacts, patch.contacts, (c) => c.id);
    counts.contacts = patch.contacts.length;
  }
  if (Array.isArray(patch.x402Receipts)) {
    dbState.x402Receipts = mergeByKey(dbState.x402Receipts, patch.x402Receipts, (r) => r.id).slice(0, 500);
    counts.x402Receipts = patch.x402Receipts.length;
  }
  if (Array.isArray(patch.adCampaigns)) {
    dbState.adCampaigns = mergeByKey(dbState.adCampaigns, patch.adCampaigns, (a) => a.id).slice(0, 200);
    counts.adCampaigns = patch.adCampaigns.length;
  }

  saveNow();
  return { updatedCounts: counts, updatedAt: dbState.updatedAt };
}

// ---------- Challenge, WebAuthn Passkey & Session Binding ----------

export function createChallenge(params: {
  mode: 'register' | 'login';
  ownerUid?: string;
  deviceId: string;
  displayName?: string;
  email?: string;
}): string {
  const now = Date.now();
  for (const [k, v] of challengesMap.entries()) {
    if (v.expiresAtMs < now) challengesMap.delete(k);
  }
  const challenge = crypto.randomBytes(32).toString('base64url');
  challengesMap.set(challenge, {
    challenge,
    mode: params.mode,
    ownerUid: params.ownerUid,
    deviceId: params.deviceId,
    displayName: params.displayName,
    email: params.email,
    expiresAtMs: now + 5 * 60 * 1000,
  });
  return challenge;
}

export function consumeChallenge(challenge: string): StoredChallenge | null {
  const entry = challengesMap.get(challenge);
  if (!entry) return null;
  challengesMap.delete(challenge);
  if (entry.expiresAtMs < Date.now()) return null;
  return entry;
}

export function verifyEcdsaP256Signature(
  publicKeySpkiBase64: string,
  challenge: string,
  signatureBase64Url: string
): boolean {
  try {
    const derBuffer = Buffer.from(publicKeySpkiBase64, 'base64');
    const keyObj = crypto.createPublicKey({ key: derBuffer, format: 'der', type: 'spki' });
    const sigBuf = Buffer.from(signatureBase64Url, 'base64url');
    // WebCrypto ECDSA P-256 produces raw IEEE P1363 (r || s, 64 bytes); Node crypto supports ieee-p1363
    const ok = crypto.verify(
      'sha256',
      Buffer.from(challenge, 'utf8'),
      { key: keyObj, dsaEncoding: 'ieee-p1363' },
      sigBuf
    );
    if (ok) return true;
    // Fallback check in case DER signature was provided
    return crypto.verify('sha256', Buffer.from(challenge, 'utf8'), keyObj, sigBuf);
  } catch {
    return false;
  }
}

export function signSessionToken(payload: {
  sessionId: string;
  ownerUid: string;
  deviceId: string;
  credentialId?: string;
  expMs: number;
}): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string
): {
  sessionId: string;
  ownerUid: string;
  deviceId: string;
  credentialId?: string;
  expMs: number;
} | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encoded)
      .digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      sessionId: string;
      ownerUid: string;
      deviceId: string;
      credentialId?: string;
      expMs: number;
    };
    if (!parsed?.sessionId || !parsed?.ownerUid || parsed.expMs < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function upsertPasskey(record: DevicePasskeyRecord): DevicePasskeyRecord {
  dbState.passkeys = [
    record,
    ...dbState.passkeys.filter((p) => p.credentialId !== record.credentialId),
  ];
  saveNow();
  return record;
}

export function removePasskey(credentialId: string): boolean {
  const before = dbState.passkeys.length;
  dbState.passkeys = dbState.passkeys.filter((p) => p.credentialId !== credentialId);
  const removed = dbState.passkeys.length !== before;
  if (removed) saveNow();
  return removed;
}

export function upsertSession(session: UserSessionRecord): UserSessionRecord {
  dbState.sessions = [
    session,
    ...dbState.sessions.filter((s) => s.id !== session.id),
  ].slice(0, 200);
  saveNow();
  return session;
}

export function linkAgentsToDeviceAndUser(params: {
  ownerUid: string;
  deviceId: string;
  credentialId?: string;
  sessionId?: string;
  agentIds?: string[];
  agentHandles?: string[];
  activeAgentId?: string;
  activeAgentHandle?: string;
}): {
  passkey: DevicePasskeyRecord | null;
  session: UserSessionRecord | null;
  rememberedAgents: AgentDoc[];
} {
  const now = new Date().toISOString();
  const idsToAdd = (params.agentIds || []).filter(Boolean);
  const handlesToAdd = (params.agentHandles || []).filter(Boolean);

  // Also infer any agents in DB belonging to ownerUid
  const ownerAgents = dbState.agents.filter(
    (a) => a.ownerUid === params.ownerUid && a.handle !== '911.emergency.agent'
  );
  const mergedIds = Array.from(
    new Set([
      ...ownerAgents.map((a) => a.id),
      ...idsToAdd,
      ...(params.activeAgentId ? [params.activeAgentId] : []),
    ])
  );
  const mergedHandles = Array.from(
    new Set([
      ...ownerAgents.map((a) => a.handle),
      ...handlesToAdd,
      ...(params.activeAgentHandle ? [params.activeAgentHandle] : []),
    ])
  );

  let updatedPasskey: DevicePasskeyRecord | null = null;
  dbState.passkeys = dbState.passkeys.map((pk) => {
    const matchByCred = params.credentialId && pk.credentialId === params.credentialId;
    const matchByOwnerDevice = pk.ownerUid === params.ownerUid && pk.deviceId === params.deviceId;
    if (!matchByCred && !matchByOwnerDevice) return pk;
    const next: DevicePasskeyRecord = {
      ...pk,
      rememberedAgentIds: Array.from(new Set([...pk.rememberedAgentIds, ...mergedIds])),
      rememberedAgentHandles: Array.from(new Set([...pk.rememberedAgentHandles, ...mergedHandles])),
      lastUsedAt: now,
    };
    updatedPasskey = next;
    return next;
  });

  let updatedSession: UserSessionRecord | null = null;
  dbState.sessions = dbState.sessions.map((sess) => {
    const matchById = params.sessionId && sess.id === params.sessionId;
    const matchByOwnerDevice =
      sess.ownerUid === params.ownerUid && sess.deviceId === params.deviceId;
    if (!matchById && !matchByOwnerDevice) return sess;
    const next: UserSessionRecord = {
      ...sess,
      agentIds: Array.from(new Set([...sess.agentIds, ...mergedIds])),
      agentHandles: Array.from(new Set([...sess.agentHandles, ...mergedHandles])),
      activeAgentId: params.activeAgentId || sess.activeAgentId,
      activeAgentHandle: params.activeAgentHandle || sess.activeAgentHandle,
      lastActiveAt: now,
    };
    updatedSession = next;
    return next;
  });

  saveNow();

  const rememberedAgents = dbState.agents.filter(
    (a) =>
      mergedIds.includes(a.id) ||
      mergedHandles.map((h) => h.toLowerCase()).includes(a.handle.toLowerCase()) ||
      a.ownerUid === params.ownerUid
  );

  return { passkey: updatedPasskey, session: updatedSession, rememberedAgents };
}

// ---------- x402 Protocol, Quota Metering, Wallet & Sponsored Ads ----------

const x402ChallengeStore = new Map<string, X402ChallengePayload>();

export function resolveEntitlementKey(ownerUid?: string, deviceId?: string): string {
  const uid = String(ownerUid || '').trim();
  const dev = String(deviceId || '').trim();
  if (uid && uid !== 'seed-persona-alex') return `uid:${uid}`;
  if (dev) return `dev:${dev}`;
  return 'uid:seed-persona-alex';
}

export function getOrCreateEntitlement(
  ownerUid?: string,
  deviceId?: string
): X402AccountEntitlement {
  const key = resolveEntitlementKey(ownerUid, deviceId);
  const existing = dbState.x402Entitlements[key];
  if (existing) return existing;
  const fresh: X402AccountEntitlement = {
    key,
    ownerUid: String(ownerUid || 'seed-persona-alex'),
    deviceId: deviceId ? String(deviceId) : undefined,
    freeMatchesUsed: 0,
    freeMatchLimit: FREE_MATCH_LIMIT,
    bonusMatchCredits: 0,
    inboxesIncludedFree: 1,
    inboxesUsed: 0,
    bonusInboxes: 0,
    outboundEmailCredits: 25,
    priorityRfpCredits: 0,
    videoAuditCredits: 1,
    apiCredits: 100,
    walletBalanceUSD: 25,
    autoPayEnabled: false,
    maxAutoPayPerCallUSD: 25,
    totalSpentUSD: 0,
    updatedAt: new Date().toISOString(),
  };
  dbState.x402Entitlements[key] = fresh;
  saveSoon();
  return fresh;
}

export function hasActiveUnlimitedMatches(ent: X402AccountEntitlement): boolean {
  if (!ent.unlimitedMatchesUntil) return false;
  return new Date(ent.unlimitedMatchesUntil).getTime() > Date.now();
}

export function getMatchQuotaSnapshot(ent: X402AccountEntitlement): {
  freeLimit: number;
  freeUsed: number;
  freeRemaining: number;
  bonusCredits: number;
  totalRemaining: number | 'unlimited';
  unlimitedActive: boolean;
} {
  const unlimitedActive = hasActiveUnlimitedMatches(ent);
  const freeRemaining = Math.max(0, ent.freeMatchLimit - ent.freeMatchesUsed);
  return {
    freeLimit: ent.freeMatchLimit,
    freeUsed: ent.freeMatchesUsed,
    freeRemaining,
    bonusCredits: ent.bonusMatchCredits,
    totalRemaining: unlimitedActive ? 'unlimited' : freeRemaining + ent.bonusMatchCredits,
    unlimitedActive,
  };
}

export function consumeMatchQuota(params: {
  ownerUid?: string;
  deviceId?: string;
  requestedCount: number;
}): {
  allowed: boolean;
  consumed: number;
  freeMatchesAllowed: number;
  paidNeededCount: number;
  quota: ReturnType<typeof getMatchQuotaSnapshot>;
} {
  const ent = getOrCreateEntitlement(params.ownerUid, params.deviceId);
  const count = Math.max(1, Math.round(params.requestedCount || 1));

  if (hasActiveUnlimitedMatches(ent)) {
    ent.updatedAt = new Date().toISOString();
    saveSoon();
    return {
      allowed: true,
      consumed: count,
      freeMatchesAllowed: count,
      paidNeededCount: 0,
      quota: getMatchQuotaSnapshot(ent),
    };
  }

  const freeRem = Math.max(0, ent.freeMatchLimit - ent.freeMatchesUsed);
  const available = freeRem + ent.bonusMatchCredits;
  if (available <= 0) {
    return {
      allowed: false,
      consumed: 0,
      freeMatchesAllowed: 0,
      paidNeededCount: count,
      quota: getMatchQuotaSnapshot(ent),
    };
  }

  const deliverable = Math.min(count, available);
  const fromFree = Math.min(freeRem, deliverable);
  const fromBonus = deliverable - fromFree;

  ent.freeMatchesUsed += fromFree;
  ent.bonusMatchCredits = Math.max(0, ent.bonusMatchCredits - fromBonus);
  ent.updatedAt = new Date().toISOString();
  saveSoon();

  return {
    allowed: true,
    consumed: deliverable,
    freeMatchesAllowed: deliverable,
    paidNeededCount: Math.max(0, count - deliverable),
    quota: getMatchQuotaSnapshot(ent),
  };
}

export function createX402ChallengeRecord(params: {
  sku?: string;
  category: X402PayableCategory;
  title: string;
  description?: string;
  amountUSD: number;
  metadata?: Record<string, string | number | boolean>;
}): X402ChallengePayload {
  const now = Date.now();
  for (const [id, ch] of x402ChallengeStore.entries()) {
    if (new Date(ch.expiresAt).getTime() < now) x402ChallengeStore.delete(id);
  }
  const paymentId = `x402_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const nonce = crypto.randomBytes(12).toString('hex');
  const cleanUsd = Number(Math.max(0.01, params.amountUSD).toFixed(2));
  const hmacChallenge = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${paymentId}:${nonce}:${params.sku || params.category}:${cleanUsd}`)
    .digest('hex');

  const payload: X402ChallengePayload = {
    paymentId,
    nonce,
    protocol: 'x402',
    version: '1.0',
    sku: params.sku || params.category,
    category: params.category,
    title: params.title,
    description: params.description || params.title,
    amountUSD: cleanUsd,
    amountZAR: Math.round(cleanUsd * 18.52),
    currency: 'USDC',
    chains: ['base', 'arc', 'solana', 'paypal_vault'],
    payToAddresses: {
      base: '0x8F2aSwitchboardBaseUSDC9104E',
      arc: 'arc1qswitchboardsettlement008a',
      solana: 'SwB8x402SolanaEscrow9pQ4kL',
      paypalVault: 'VAULT_SWITCHZ_REVENUE_01',
    },
    hmacChallenge,
    expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    metadata: params.metadata,
  };
  x402ChallengeStore.set(paymentId, payload);
  return payload;
}

export function verifyX402ReceiptToken(token: string | undefined): X402PaymentReceipt | null {
  if (!token) return null;
  const clean = token.trim();
  const existing = dbState.x402Receipts.find(
    (r) => r.x402Token === clean || r.paymentId === clean || r.txHash === clean
  );
  if (existing) return existing;
  // Also allow signed receipt tokens formatted as x402r_<paymentId>.<sig>
  if (clean.startsWith('x402r_')) {
    const body = clean.slice(6);
    const [pid, sig] = body.split('.');
    if (pid && sig) {
      const expected = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(pid)
        .digest('base64url')
        .slice(0, 16);
      if (sig === expected) {
        return dbState.x402Receipts.find((r) => r.paymentId === pid) || null;
      }
    }
  }
  return null;
}

export function settleX402Payment(params: {
  paymentId?: string;
  nonce?: string;
  hmacChallenge?: string;
  sku?: string;
  category?: X402PayableCategory;
  title?: string;
  amountUSD?: number;
  rail: 'paypal_vault' | 'x402_base' | 'x402_arc' | 'x402_solana';
  payerType: 'human' | 'agent';
  payerHandle: string;
  payerName?: string;
  ownerUid?: string;
  deviceId?: string;
  useWalletBalance?: boolean;
  txHash?: string;
  metadata?: Record<string, string | number | boolean>;
}): {
  ok: boolean;
  error?: string;
  receipt?: X402PaymentReceipt;
  entitlement?: X402AccountEntitlement;
  adCampaign?: AdCampaignDoc;
} {
  let challenge = params.paymentId ? x402ChallengeStore.get(params.paymentId) : undefined;

  if (params.paymentId && challenge) {
    if (params.nonce && challenge.nonce !== params.nonce) {
      return { ok: false, error: 'x402 nonce mismatch.' };
    }
    if (params.hmacChallenge && challenge.hmacChallenge !== params.hmacChallenge) {
      return { ok: false, error: 'x402 challenge HMAC verification failed.' };
    }
    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      x402ChallengeStore.delete(challenge.paymentId);
      return { ok: false, error: 'x402 challenge expired. Request a fresh HTTP 402 quote.' };
    }
  }

  // Idempotency check if paymentId was already settled
  if (params.paymentId) {
    const already = dbState.x402Receipts.find((r) => r.paymentId === params.paymentId);
    if (already) {
      return {
        ok: true,
        receipt: already,
        entitlement: getOrCreateEntitlement(params.ownerUid, params.deviceId),
      };
    }
  }

  const catalogItem = X402_REVENUE_CATALOG.find(
    (s) => s.sku === (challenge?.sku || params.sku)
  );
  const resolvedSku = challenge?.sku || catalogItem?.sku || params.sku || 'custom_x402';
  const resolvedCategory: X402PayableCategory =
    challenge?.category || catalogItem?.category || params.category || 'matches_pack';
  const resolvedTitle = challenge?.title || catalogItem?.title || params.title || 'x402 Payment';
  const resolvedUsd = Number(
    (challenge?.amountUSD ?? catalogItem?.priceUSD ?? params.amountUSD ?? 4.99).toFixed(2)
  );
  const resolvedZar = Math.round(resolvedUsd * 18.52);
  const mergedMeta = { ...(challenge?.metadata || {}), ...(params.metadata || {}) };

  const ent = getOrCreateEntitlement(params.ownerUid, params.deviceId);
  if (params.useWalletBalance && resolvedCategory !== 'wallet_topup') {
    if (ent.walletBalanceUSD < resolvedUsd) {
      return {
        ok: false,
        error: `Insufficient x402 wallet balance ($${ent.walletBalanceUSD.toFixed(2)} available, $${resolvedUsd.toFixed(2)} required).`,
      };
    }
    ent.walletBalanceUSD = Number((ent.walletBalanceUSD - resolvedUsd).toFixed(2));
  }

  const paymentId = challenge?.paymentId || params.paymentId || `x402_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nonce = challenge?.nonce || params.nonce || crypto.randomBytes(10).toString('hex');
  if (challenge) x402ChallengeStore.delete(challenge.paymentId);

  const randHex = crypto.randomBytes(12).toString('hex');
  const computedTxHash =
    params.txHash ||
    (params.rail === 'paypal_vault'
      ? `PAYPAL_VAULT_${randHex.slice(0, 12).toUpperCase()}`
      : params.rail === 'x402_solana'
      ? `5xSol${randHex.slice(0, 18)}`
      : params.rail === 'x402_arc'
      ? `arc_${randHex.slice(0, 18)}`
      : `0x${randHex}`);

  const receiptSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(paymentId)
    .digest('base64url')
    .slice(0, 16);
  const x402Token = `x402r_${paymentId}.${receiptSig}`;
  const nowIso = new Date().toISOString();

  const receipt: X402PaymentReceipt = {
    id: `rec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    paymentId,
    nonce,
    sku: resolvedSku,
    category: resolvedCategory,
    title: resolvedTitle,
    ownerUid: ent.ownerUid,
    deviceId: params.deviceId,
    payerType: params.payerType,
    payerHandle: params.payerHandle || 'anonymous.agent',
    payerName: params.payerName,
    rail: params.rail,
    amountUSD: resolvedUsd,
    amountZAR: resolvedZar,
    txHash: computedTxHash,
    x402Token,
    status: 'SETTLED',
    metadata: mergedMeta,
    settledAt: nowIso,
  };
  dbState.x402Receipts = [receipt, ...dbState.x402Receipts].slice(0, 500);

  // Apply entitlement credits based on SKU or category
  if (resolvedCategory === 'wallet_topup') {
    ent.walletBalanceUSD = Number((ent.walletBalanceUSD + resolvedUsd).toFixed(2));
  } else {
    ent.totalSpentUSD = Number((ent.totalSpentUSD + resolvedUsd).toFixed(2));
  }

  if (catalogItem?.creditsGranted) {
    const g = catalogItem.creditsGranted;
    if (g.unlimitedMatches) {
      ent.unlimitedMatchesUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (g.matches) {
      ent.bonusMatchCredits += g.matches;
    }
    if (g.inboxes) ent.bonusInboxes += g.inboxes;
    if (g.outboundEmails) ent.outboundEmailCredits += g.outboundEmails;
    if (g.priorityRfps) ent.priorityRfpCredits += g.priorityRfps;
    if (g.videoAudits) ent.videoAuditCredits += g.videoAudits;
    if (g.apiCalls) ent.apiCredits += g.apiCalls;
    if (g.autopilotPro) {
      ent.autopilotProUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  } else if (resolvedCategory === 'matches_pack') {
    ent.bonusMatchCredits += 25;
  } else if (resolvedCategory === 'email_inbox') {
    ent.bonusInboxes += 1;
  } else if (resolvedCategory === 'rfp_boost') {
    ent.priorityRfpCredits += 1;
  } else if (resolvedCategory === 'autopilot_pass') {
    ent.autopilotProUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  ent.updatedAt = nowIso;

  // Activate Sponsored Ad campaign when category === 'ad_boost'
  let createdAd: AdCampaignDoc | undefined;
  if (resolvedCategory === 'ad_boost') {
    const placement =
      resolvedSku === 'ad_directory_featured_7d'
        ? 'directory_featured'
        : resolvedSku === 'ad_radar_beacon_7d'
        ? 'radar_beacon'
        : 'status_circle';
    createdAd = {
      id: `ad_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      ownerUid: ent.ownerUid,
      agentId: String(mergedMeta.agentId || ''),
      agentHandle: String(mergedMeta.agentHandle || params.payerHandle),
      sponsorName: String(mergedMeta.sponsorName || params.payerName || params.payerHandle),
      placement,
      headline: String(mergedMeta.headline || `${params.payerHandle} Featured Promotion`),
      body: String(mergedMeta.body || 'Sponsored SWITCHZ offer settled via HTTP 402 (x402).'),
      ctaLabel: String(mergedMeta.ctaLabel || 'Engage Offer'),
      targetUrl: mergedMeta.targetUrl ? String(mergedMeta.targetUrl) : undefined,
      budgetUSD: resolvedUsd,
      impressions: 1,
      clicks: 0,
      receiptId: receipt.id,
      txHash: computedTxHash,
      status: 'ACTIVE',
      startsAt: nowIso,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    dbState.adCampaigns = [createdAd, ...dbState.adCampaigns].slice(0, 200);
  }

  // Record in main settlement ledger so all UI views reflect x402 platform revenue
  const settlementDoc: SettlementDoc = {
    id: `settle_x402_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
    sessionId: paymentId,
    buyerHandle: params.payerHandle || 'member.agent',
    sellerHandle: 'treasury.switchz.agent',
    ownerUid: ent.ownerUid,
    channel: `x402 · ${resolvedTitle}`,
    stickerPriceZAR: resolvedZar,
    amountZAR: resolvedZar,
    amountUSD: resolvedUsd,
    savedZAR: 0,
    savedPct: 0,
    rail: params.rail,
    txHash: computedTxHash,
    status: 'SETTLED',
    settledAt: nowIso,
  };
  dbState.settlements = [settlementDoc, ...dbState.settlements].slice(0, 300);

  appendActivity({
    ownerUid: ent.ownerUid,
    deviceId: params.deviceId,
    agentHandle: params.payerHandle,
    targetHandle: 'treasury.switchz.agent',
    category: 'negotiation',
    title: `x402 Settled: ${resolvedTitle} ($${resolvedUsd.toFixed(2)})`,
    detail: `Paid by ${params.payerType} (${params.payerHandle}) via ${params.rail.toUpperCase()} · ${computedTxHash.slice(0, 14)}…`,
    valueZAR: resolvedZar,
  });

  saveNow();
  return { ok: true, receipt, entitlement: ent, adCampaign: createdAd };
}

export function listX402RevenueSummary(): {
  totalReceiptsCount: number;
  totalX402VolumeUSD: number;
  totalSettlementsVolumeUSD: number;
  byCategory: Record<string, { count: number; totalUSD: number }>;
  activeAdsCount: number;
} {
  const byCategory: Record<string, { count: number; totalUSD: number }> = {};
  let totalX402VolumeUSD = 0;
  for (const r of dbState.x402Receipts) {
    totalX402VolumeUSD += r.amountUSD;
    if (!byCategory[r.category]) byCategory[r.category] = { count: 0, totalUSD: 0 };
    byCategory[r.category].count += 1;
    byCategory[r.category].totalUSD = Number((byCategory[r.category].totalUSD + r.amountUSD).toFixed(2));
  }
  const totalSettlementsVolumeUSD = dbState.settlements.reduce((sum, s) => sum + (s.amountUSD || 0), 0);
  return {
    totalReceiptsCount: dbState.x402Receipts.length,
    totalX402VolumeUSD: Number(totalX402VolumeUSD.toFixed(2)),
    totalSettlementsVolumeUSD: Number(totalSettlementsVolumeUSD.toFixed(2)),
    byCategory,
    activeAdsCount: dbState.adCampaigns.filter((a) => a.status === 'ACTIVE').length,
  };
}

