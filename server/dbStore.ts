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
  SecondaryListingDoc,
  SettlementDoc,
  UserAgentActivityEntry,
  UserSessionRecord,
  VoiceChatSessionDoc,
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
