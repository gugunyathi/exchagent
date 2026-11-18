import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  AgentDoc,
  RfpDoc,
  NegotiationDoc,
  SettlementDoc,
  AgentHandleDoc,
  AuctionDoc,
  SecondaryListingDoc,
  BookingDoc,
  AgentEmailDoc,
  VoiceChatSessionDoc,
  PasserbyHandshakeEvent,
  DispatchedUnit,
  JobPostingDoc,
  RecruitmentMatchDoc,
  PoppyOperation,
  PoppyConsentGrant,
  PoppyAuditLogEntry,
  SeekerCvProfile,
  InterviewVideoRecord,
  PreScreenReview,
  SurfaceMode,
  CurrencyMode,
  PaymentRail,
  PersonalContactDoc,
  ContactSource,
  ProximityPeerDoc,
  AiOpportunitySuggestion,
  AgentApplicationPackage,
  AgentActionHistoryEntry,
  HrTeamMember,
  HrReviewNote,
  AgentStatusPostDoc,
  AgentIntentProfile,
  AutonomousMatchItem,
  zarToUsd,
} from '../types/firestore';
import {
  DEFAULT_RATES_PER_USD,
  LocalCurrencyCode,
  detectCurrencyFromBrowser,
  detectCurrencyFromCoords,
  isSupportedCurrency,
  setLiveFxRates,
} from '../lib/fx';
import { matchCandidateToAllJobs, matchJobToAllCandidates } from '../services/recruitmentMatcher';
import { AGENT_IMAGE_PRESETS } from '../lib/agentImages';
import { AI_OUTREACH_DISCLAIMER_TEXT } from '../data/legalDocuments';
import { emitToast } from '../lib/toast';
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
  JOHANNESBURG_CENTER,
} from '../data/seedData';
import {
  db,
  subscribeAuth,
  signInWithGoogleWorkspace,
  signOutFirebase,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { executeSimulatedSettlement } from '../services/paymentRails';

const STORAGE_KEY = 'switchboard_agentpages_state_v3';

interface PersistedSlice {
  agents: AgentDoc[];
  rfps: RfpDoc[];
  negotiations: NegotiationDoc[];
  settlements: SettlementDoc[];
  claimedHandles: AgentHandleDoc[];
  auctions: AuctionDoc[];
  secondaryListings: SecondaryListingDoc[];
  bookings: BookingDoc[];
  emails: AgentEmailDoc[];
  voiceSessions: VoiceChatSessionDoc[];
  jobs?: JobPostingDoc[];
  matches?: RecruitmentMatchDoc[];
  poppyOperations?: PoppyOperation[];
  poppyConsents?: PoppyConsentGrant[];
  poppyAuditLogs?: PoppyAuditLogEntry[];
  contacts?: PersonalContactDoc[];
  seededContactOwners?: string[];
  applicationPackages?: AgentApplicationPackage[];
  agentActionHistory?: AgentActionHistoryEntry[];
  matchedUserOwners?: string[];
  statusPosts?: AgentStatusPostDoc[];
}

function mergeById<T extends { id: string }>(loaded: T[] | undefined, seeded: T[]): T[] {
  if (!loaded || loaded.length === 0) return seeded;
  const map = new Map<string, T>();
  loaded.forEach((item) => map.set(item.id, item));
  seeded.forEach((item) => {
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function loadInitialSlice(): Required<PersistedSlice> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSlice>;
      const mergedAgents = mergeById(parsed.agents, SEED_AGENTS).map((a) => {
        const cleanEmail = a.agentEmail?.startsWith('pitch@')
          ? a.agentEmail.replace(/^pitch@/, 'engage@')
          : a.agentEmail;
        const seed = SEED_AGENTS.find((s) => s.id === a.id);
        if (!seed) {
          return cleanEmail !== a.agentEmail ? { ...a, agentEmail: cleanEmail } : a;
        }
        return {
          ...a,
          agentEmail: cleanEmail,
          cardStyle: a.cardStyle || seed.cardStyle,
          hrTeam: a.hrTeam?.length ? a.hrTeam : seed.hrTeam,
          careersUrl: a.careersUrl || seed.careersUrl,
          impliedIntent: a.impliedIntent || seed.impliedIntent,
        };
      });
      return {
        agents: mergedAgents,
        rfps: parsed.rfps?.length ? parsed.rfps : SEED_RFPS,
        negotiations: parsed.negotiations?.length ? parsed.negotiations : SEED_NEGOTIATIONS,
        settlements: parsed.settlements?.length ? parsed.settlements : SEED_SETTLEMENTS,
        claimedHandles: parsed.claimedHandles?.length ? parsed.claimedHandles : SEED_CLAIMED_HANDLES,
        auctions: parsed.auctions?.length ? parsed.auctions : SEED_AUCTIONS,
        secondaryListings: parsed.secondaryListings?.length ? parsed.secondaryListings : SEED_SECONDARY_LISTINGS,
        bookings: parsed.bookings?.length ? parsed.bookings : SEED_BOOKINGS,
        emails: parsed.emails?.length ? parsed.emails : SEED_EMAILS,
        voiceSessions: parsed.voiceSessions?.length ? parsed.voiceSessions : SEED_VOICE_SESSIONS,
        jobs: mergeById(parsed.jobs, SEED_JOBS),
        matches: mergeById(parsed.matches, SEED_MATCHES),
        poppyOperations: parsed.poppyOperations?.length ? parsed.poppyOperations : SEED_POPPY_OPERATIONS,
        poppyConsents: parsed.poppyConsents?.length ? parsed.poppyConsents : SEED_POPPY_CONSENTS,
        poppyAuditLogs: parsed.poppyAuditLogs?.length ? parsed.poppyAuditLogs : SEED_POPPY_AUDIT_LOGS,
        contacts: parsed.contacts?.length ? parsed.contacts : SEED_CONTACTS,
        seededContactOwners: parsed.seededContactOwners?.length
          ? parsed.seededContactOwners
          : ['seed-persona-alex'],
        applicationPackages: mergeById(parsed.applicationPackages, SEED_APPLICATION_PACKAGES),
        agentActionHistory: mergeById(parsed.agentActionHistory, SEED_AGENT_HISTORY),
        matchedUserOwners: parsed.matchedUserOwners?.length
          ? parsed.matchedUserOwners
          : ['seed-persona-alex'],
        statusPosts: mergeById(parsed.statusPosts, SEED_STATUS_POSTS),
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    agents: SEED_AGENTS,
    rfps: SEED_RFPS,
    negotiations: SEED_NEGOTIATIONS,
    settlements: SEED_SETTLEMENTS,
    claimedHandles: SEED_CLAIMED_HANDLES,
    auctions: SEED_AUCTIONS,
    secondaryListings: SEED_SECONDARY_LISTINGS,
    bookings: SEED_BOOKINGS,
    emails: SEED_EMAILS,
    voiceSessions: SEED_VOICE_SESSIONS,
    jobs: SEED_JOBS,
    matches: SEED_MATCHES,
    poppyOperations: SEED_POPPY_OPERATIONS,
    poppyConsents: SEED_POPPY_CONSENTS,
    poppyAuditLogs: SEED_POPPY_AUDIT_LOGS,
    contacts: SEED_CONTACTS,
    seededContactOwners: ['seed-persona-alex'],
    applicationPackages: SEED_APPLICATION_PACKAGES,
    agentActionHistory: SEED_AGENT_HISTORY,
    matchedUserOwners: ['seed-persona-alex'],
    statusPosts: SEED_STATUS_POSTS,
  };
}

export interface AuthSessionUser {
  uid: string;
  displayName: string;
  email: string;
  mode: 'google' | 'passkey_sim' | 'guest';
}

export function useSwitchboardStore() {
  const initial = loadInitialSlice();
  const [agents, setAgents] = useState<AgentDoc[]>(initial.agents);
  const [rfps, setRfps] = useState<RfpDoc[]>(initial.rfps);
  const [negotiations, setNegotiations] = useState<NegotiationDoc[]>(initial.negotiations);
  const [settlements, setSettlements] = useState<SettlementDoc[]>(initial.settlements);
  const [claimedHandles, setClaimedHandles] = useState<AgentHandleDoc[]>(initial.claimedHandles);
  const [auctions, setAuctions] = useState<AuctionDoc[]>(initial.auctions);
  const [secondaryListings, setSecondaryListings] = useState<SecondaryListingDoc[]>(initial.secondaryListings);
  const [bookings, setBookings] = useState<BookingDoc[]>(initial.bookings);
  const [emails, setEmails] = useState<AgentEmailDoc[]>(initial.emails);
  const [voiceSessions, setVoiceSessions] = useState<VoiceChatSessionDoc[]>(initial.voiceSessions);
  const [jobs, setJobs] = useState<JobPostingDoc[]>(initial.jobs);
  const [matches, setMatches] = useState<RecruitmentMatchDoc[]>(initial.matches);
  const [poppyOperations, setPoppyOperations] = useState<PoppyOperation[]>(initial.poppyOperations);
  const [poppyConsents, setPoppyConsents] = useState<PoppyConsentGrant[]>(initial.poppyConsents);
  const [poppyAuditLogs, setPoppyAuditLogs] = useState<PoppyAuditLogEntry[]>(initial.poppyAuditLogs);
  const [contacts, setContacts] = useState<PersonalContactDoc[]>(initial.contacts);
  const [seededContactOwners, setSeededContactOwners] = useState<string[]>(initial.seededContactOwners);
  const [applicationPackages, setApplicationPackages] = useState<AgentApplicationPackage[]>(
    initial.applicationPackages
  );
  const [agentActionHistory, setAgentActionHistory] = useState<AgentActionHistoryEntry[]>(
    initial.agentActionHistory
  );
  const [matchedUserOwners, setMatchedUserOwners] = useState<string[]>(initial.matchedUserOwners);
  const [statusPosts, setStatusPosts] = useState<AgentStatusPostDoc[]>(initial.statusPosts);

  const [aiOpportunities, setAiOpportunities] = useState<AiOpportunitySuggestion[]>([]);
  const [aiOpportunitiesMeta, setAiOpportunitiesMeta] = useState<{
    engine?: string;
    generatedAt?: string;
    summary?: string;
  } | null>(null);
  const [aiOpportunitiesLoading, setAiOpportunitiesLoading] = useState(false);
  const [aiOpportunitiesError, setAiOpportunitiesError] = useState<string | null>(null);

  const [autonomousMatches, setAutonomousMatches] = useState<AutonomousMatchItem[]>([]);
  const [autonomousMatchLoading, setAutonomousMatchLoading] = useState(false);
  const [autonomousMatchMeta, setAutonomousMatchMeta] = useState<{
    engine?: string;
    generatedAt?: string;
    executiveSummary?: string;
    sourceHandle?: string;
  } | null>(null);

  const [surface, setSurface] = useState<SurfaceMode>('desktop');
  const [currency, setCurrencyState] = useState<CurrencyMode>('USD');
  const initialBrowserGeo = detectCurrencyFromBrowser();
  const [localCurrency, setLocalCurrency] = useState<LocalCurrencyCode>(initialBrowserGeo.currency);
  const [locationLabel, setLocationLabel] = useState<string>(initialBrowserGeo.locationLabel);
  const [fxRates, setFxRates] = useState<Record<LocalCurrencyCode, number>>({ ...DEFAULT_RATES_PER_USD });
  const [fxSource, setFxSource] = useState<'live' | 'reference'>('reference');
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [passkeyUser, setPasskeyUser] = useState<AuthSessionUser | null>(null);
  const [firestoreOnline, setFirestoreOnline] = useState(false);

  const [userLocation, setUserLocationRaw] = useState<{ lat: number; lng: number }>(JOHANNESBURG_CENTER);
  const [passerbyEvents, setPasserbyEvents] = useState<PasserbyHandshakeEvent[]>([]);
  const [dispatchedUnits, setDispatchedUnits] = useState<DispatchedUnit[]>([]);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [mapboxAccessToken, setMapboxAccessToken] = useState<string>(
    import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || import.meta.env.VITE_MAPBOX_API_KEY || ''
  );

  const setCurrency = useCallback((next: CurrencyMode) => {
    setCurrencyState(next);
    if (next !== 'USD' && isSupportedCurrency(next)) {
      setLocalCurrency(next);
    }
  }, []);

  const setUserLocation = useCallback(
    (loc: { lat: number; lng: number }) => {
      setUserLocationRaw(loc);
      const hit = detectCurrencyFromCoords(loc.lat, loc.lng);
      if (hit) {
        setLocalCurrency(hit.currency);
        setLocationLabel(hit.locationLabel);
      }
    },
    []
  );

  const detectLocationAndCurrency = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      emitToast('Browser geolocation unavailable — using regional locale', 'info');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
        };
        setUserLocationRaw(coords);
        const localHit = detectCurrencyFromCoords(coords.lat, coords.lng);
        if (localHit) {
          setLocalCurrency(localHit.currency);
          setLocationLabel(localHit.locationLabel);
        }
        try {
          const res = await fetch(`/api/fx/rates?lat=${coords.lat}&lng=${coords.lng}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.rates) {
              setLiveFxRates(data.rates);
              setFxRates((prev) => ({ ...prev, ...data.rates }));
              setFxSource(data.source === 'live' ? 'live' : 'reference');
            }
            if (isSupportedCurrency(data?.suggestedCurrency)) {
              setLocalCurrency(data.suggestedCurrency);
              setLocationLabel(data.suggestedLocationLabel || localHit?.locationLabel || 'Detected GPS');
              emitToast(
                `Location detected: ${data.suggestedLocationLabel || localHit?.locationLabel} (${data.suggestedCurrency})`,
                'success'
              );
            }
          }
        } catch {
          if (localHit) {
            emitToast(`Location detected: ${localHit.locationLabel} (${localHit.currency})`, 'success');
          }
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setDetectingLocation(false);
        emitToast('Location permission declined — select local currency manually', 'info');
      },
      { enableHighAccuracy: false, timeout: 7000 }
    );
  }, []);

  // Persist to localStorage automatically
  useEffect(() => {
    try {
      const payload: PersistedSlice = {
        agents,
        rfps,
        negotiations,
        settlements,
        claimedHandles,
        auctions,
        secondaryListings,
        bookings,
        emails,
        voiceSessions,
        jobs,
        matches,
        poppyOperations,
        poppyConsents,
        poppyAuditLogs,
        contacts,
        seededContactOwners,
        applicationPackages,
        agentActionHistory,
        matchedUserOwners,
        statusPosts,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [
    agents,
    rfps,
    negotiations,
    settlements,
    claimedHandles,
    auctions,
    secondaryListings,
    bookings,
    emails,
    voiceSessions,
    jobs,
    matches,
    poppyOperations,
    poppyConsents,
    poppyAuditLogs,
    contacts,
    seededContactOwners,
    applicationPackages,
    agentActionHistory,
    matchedUserOwners,
    statusPosts,
  ]);

  // Boot connection check, public config & live FX rates
  useEffect(() => {
    testFirestoreConnection().then(setFirestoreOnline);
    fetch('/api/config/public')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.googleMapsApiKey && !googleMapsApiKey) {
          setGoogleMapsApiKey(cfg.googleMapsApiKey);
        }
        if (cfg?.mapboxAccessToken && !mapboxAccessToken) {
          setMapboxAccessToken(cfg.mapboxAccessToken);
        }
      })
      .catch(() => {});

    fetch('/api/fx/rates')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.rates) {
          setLiveFxRates(data.rates);
          setFxRates((prev) => ({ ...prev, ...data.rates }));
          setFxSource(data.source === 'live' ? 'live' : 'reference');
        }
        if (
          isSupportedCurrency(data.suggestedCurrency) &&
          (data.geoMatched || initialBrowserGeo.isFallback)
        ) {
          setLocalCurrency(data.suggestedCurrency);
          setLocationLabel(data.suggestedLocationLabel || initialBrowserGeo.locationLabel);
        }
      })
      .catch(() => {});
  }, [googleMapsApiKey, mapboxAccessToken, initialBrowserGeo.isFallback, initialBrowserGeo.locationLabel]);

  // Auth listener
  useEffect(() => {
    return subscribeAuth((u, token) => {
      setFirebaseUser(u);
      setWorkspaceToken(token);
    });
  }, []);

  // Firestore real-time listeners only when signed in with Firebase Auth
  useEffect(() => {
    if (!db || !firebaseUser || !firestoreOnline) return;
    const unsubs: Array<() => void> = [];

    try {
      unsubs.push(
        onSnapshot(
          collection(db, 'agents'),
          (snap) => {
            if (!snap.empty) {
              const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AgentDoc));
              setAgents((prev) => {
                const map = new Map<string, AgentDoc>();
                prev.forEach((p) => map.set(p.id, p));
                docs.forEach((d) => map.set(d.id, d));
                return Array.from(map.values());
              });
            }
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, 'agents');
            } catch {
              // keep local seed active
            }
          }
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'rfps'), where('status', '==', 'OPEN')),
          (snap) => {
            if (!snap.empty) {
              const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RfpDoc));
              setRfps((prev) => {
                const map = new Map<string, RfpDoc>();
                prev.forEach((p) => map.set(p.id, p));
                docs.forEach((d) => map.set(d.id, d));
                return Array.from(map.values());
              });
            }
          },
          () => {}
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'contacts'), where('ownerUid', '==', firebaseUser.uid)),
          (snap) => {
            if (!snap.empty) {
              const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PersonalContactDoc));
              setContacts((prev) => {
                const map = new Map<string, PersonalContactDoc>();
                prev.forEach((p) => map.set(p.id, p));
                docs.forEach((d) => map.set(d.id, d));
                return Array.from(map.values());
              });
            }
          },
          () => {}
        )
      );
    } catch {
      // keep local fallback
    }

    return () => unsubs.forEach((u) => u());
  }, [firebaseUser, firestoreOnline]);

  const currentUser: AuthSessionUser = firebaseUser
    ? {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'SWITCHZ Operator',
        email: firebaseUser.email || '',
        mode: 'google',
      }
    : passkeyUser || {
        uid: 'seed-persona-alex',
        displayName: 'Alex Nkosi (Local Workspace)',
        email: 'alex@veldcompute.co.za',
        mode: 'guest',
      };

  // Ensure every signed-in or passkey user gets an isolated, ready-to-use personal contact book
  useEffect(() => {
    const uid = currentUser.uid;
    if (!uid || seededContactOwners.includes(uid)) return;
    setSeededContactOwners((prev) => (prev.includes(uid) ? prev : [...prev, uid]));
    setContacts((prev) => {
      if (prev.some((c) => c.ownerUid === uid)) return prev;
      const cloned = SEED_CONTACTS.map((c) => ({
        ...c,
        id: `${c.id}_${uid.slice(0, 8)}`,
        ownerUid: uid,
      }));
      return [...cloned, ...prev];
    });
  }, [currentUser.uid, seededContactOwners]);

  // Auto-provision personal agent & auto-match to OpenAI + open employer vacancies on user signup/login
  useEffect(() => {
    const uid = currentUser.uid;
    if (!uid || uid === 'seed-persona-alex' || matchedUserOwners.includes(uid)) return;
    setMatchedUserOwners((prev) => (prev.includes(uid) ? prev : [...prev, uid]));

    const now = new Date().toISOString();
    let userAgent = agents.find(
      (a) => a.ownerUid === uid && a.type === 'persona' && a.handle !== '911.emergency.agent'
    );

    if (!userAgent) {
      const slug =
        currentUser.displayName
          .toLowerCase()
          .replace(/\(.*?\)/g, '')
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.+|\.+$/g, '')
          .slice(0, 22) || `member.${uid.slice(0, 6)}`;
      const handle = `${slug}.agent`;
      userAgent = {
        id: `agent_user_${uid.slice(0, 12)}`,
        handle,
        ownerUid: uid,
        displayName: currentUser.displayName.replace(/\s*\(.*?\)\s*/g, '').trim() || 'SWITCHZ Member',
        roleTitle: 'AI Product, Cloud & Growth Specialist',
        organization: 'Verified Human Member',
        type: 'persona',
        agentRoleCategory: 'job_seeker',
        poppySubdomain: `${slug.replace(/\./g, '')}.poppy.switchboard.agent`,
        poppyScopes: ['profile:read', 'cv:read', 'apply', 'calendar'],
        cvSummary: {
          headline: 'AI Product, Engineering & Growth Specialist',
          yearsExp: 6,
          parsedSkills: ['TypeScript', 'React', 'Product Strategy', 'SQL', 'AI Agents'],
          preferredRoles: ['Staff Product & AI Agent Reliability Engineer (Remote)', 'Solutions Architect'],
          salaryMinZAR: 95000,
          remoteOnly: true,
          blindScreening: false,
        },
        verified: true,
        popiaConsentActive: true,
        voiceNumber: `+27 87 243 ${Math.floor(500 + Math.random() * 499)}`,
        shortcode: String(Math.floor(500 + Math.random() * 499)),
        agentEmail: `engage@${handle}`,
        mcpEndpoint: `https://switchboard.agent/mcp/${handle}`,
        linkedinUrl: `linkedin.com/in/${slug.replace(/\./g, '')}`,
        brandColor: '#0284c7',
        avatarVariant: 'persona',
        imageUrl: AGENT_IMAGE_PRESETS[0]?.src,
        did: `did:switchboard:${uid.slice(0, 12)}`,
        protocol: 'Poppy v1.0 / A2A / MCP',
        interactEndpoint: `https://switchboard.agent/u/${slug}`,
        authMethods: 'OAuth2 / Passkey / Poppy',
        tagline: 'Free Standard Human Agent · Auto-matching open vacancies.',
        summary: `Auto-provisioned personal career agent for ${currentUser.displayName}, synced on signup to match open employer roles.`,
        skills: ['TypeScript', 'Product Strategy', 'SQL', 'AI Agents'],
        guardrails: {
          maxAutoSpendZAR: 0,
          minDiscountPct: 0,
          blockedCategories: ['unverified-spam'],
          workingHoursSAST: '08:00-18:00',
          meetingBufferMins: 15,
        },
        walletAddresses: {},
        geoLocation: {
          lat: userLocation.lat,
          lng: userLocation.lng,
          radiusMeters: 250,
          label: locationLabel || 'Global Remote Candidate Mesh',
        },
        discoverableByPassersby: true,
        passerbyIncentive: 'Open to Interviews · Auto-Matched on Signup',
        calendarSyncEnabled: true,
        gmailBridgeEnabled: true,
        createdAt: now,
      };
      setAgents((prev) => [userAgent!, ...prev]);
    }

    const computed = matchCandidateToAllJobs(userAgent, jobs, matches).slice(0, 12);
    if (computed.length > 0) {
      setMatches((prev) => {
        const map = new Map<string, RecruitmentMatchDoc>();
        prev.forEach((m) => map.set(m.id, m));
        computed.forEach((m) => map.set(m.id, m));
        return Array.from(map.values());
      });
      const topHit = computed[0];
      setAgentActionHistory((prev) => [
        {
          id: `hist_signup_${Date.now()}`,
          agentId: userAgent!.id,
          agentHandle: userAgent!.handle,
          actorType: 'personal_agent',
          actorName: `${userAgent!.displayName} Personal Agent`,
          actionType: 'AUTO_MATCH',
          title: `Signup Auto-Match Completed (${computed.length} Roles Scored)`,
          details: `On account sign-in, your personal agent automatically matched against OpenAI & verified employer agents. Top match: ${topHit.jobTitle} (${topHit.score}% fit).`,
          relatedJobId: topHit.jobId,
          relatedJobTitle: topHit.jobTitle,
          targetHandle: topHit.companyAgentHandle,
          channel: 'Signup Auto-Matcher',
          timestamp: now,
        },
        ...prev,
      ]);
      emitToast(`Welcome! Auto-matched ${userAgent.handle} to ${computed.length} open vacancies`, 'success');
    }
  }, [currentUser.uid, currentUser.displayName, matchedUserOwners, agents, jobs, matches, userLocation.lat, userLocation.lng, locationLabel]);

  const loginGoogle = useCallback(async () => {
    const res = await signInWithGoogleWorkspace();
    setFirebaseUser(res.user);
    setWorkspaceToken(res.accessToken);
    return res;
  }, []);

  const loginPasskeySim = useCallback((displayName = 'Gugu Nyathi (Passkey Verified)') => {
    setPasskeyUser({
      uid: `passkey_${Date.now()}`,
      displayName,
      email: 'passkey@switchboard.agent',
      mode: 'passkey_sim',
    });
  }, []);

  const logout = useCallback(async () => {
    await signOutFirebase();
    setFirebaseUser(null);
    setWorkspaceToken(null);
    setPasskeyUser(null);
  }, []);

  const addOrUpdateAgent = useCallback(
    async (agent: AgentDoc) => {
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.id === agent.id || a.handle === agent.handle);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = agent;
          return copy;
        }
        return [agent, ...prev];
      });
      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'agents', agent.id), { ...agent, ownerUid: firebaseUser.uid });
        } catch (err) {
          console.warn('Firestore agent sync skipped:', err);
        }
      }
    },
    [firebaseUser, firestoreOnline]
  );

  const toggleAgentDiscoverability = useCallback(
    async (agentId: string) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? { ...a, discoverableByPassersby: !a.discoverableByPassersby }
            : a
        )
      );
      if (db && firebaseUser && firestoreOnline) {
        const target = agents.find((a) => a.id === agentId);
        if (target && target.ownerUid === firebaseUser.uid) {
          try {
            await updateDoc(doc(db, 'agents', agentId), {
              discoverableByPassersby: !target.discoverableByPassersby,
            });
          } catch {
            // ignore
          }
        }
      }
    },
    [agents, firebaseUser, firestoreOnline]
  );

  const publishRfp = useCallback(
    async (rfp: RfpDoc) => {
      setRfps((prev) => [rfp, ...prev]);
      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'rfps', rfp.id), { ...rfp, publisherOwnerUid: firebaseUser.uid });
        } catch {
          // ignore
        }
      }
    },
    [firebaseUser, firestoreOnline]
  );

  const createStatusPost = useCallback(
    (input: Omit<AgentStatusPostDoc, 'id' | 'createdAt'>) => {
      const record: AgentStatusPostDoc = {
        ...input,
        id: `status_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setStatusPosts((prev) => [record, ...prev].slice(0, 60));
      return record;
    },
    []
  );

  const saveNegotiation = useCallback(
    async (neg: NegotiationDoc) => {
      const alreadyAccepted = negotiations.some(
        (n) => n.id === neg.id && (n.status === 'OFFER_ACCEPTED' || n.status === 'SETTLED')
      );
      setNegotiations((prev) => {
        const idx = prev.findIndex((n) => n.id === neg.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = neg;
          return copy;
        }
        return [neg, ...prev];
      });

      if (!alreadyAccepted && neg.status === 'OFFER_ACCEPTED' && neg.agreedPriceZAR) {
        const initiatorAgent = agents.find((a) => a.handle === neg.initiatorHandle);
        const targetAgent = agents.find((a) => a.handle === neg.targetHandle);
        const savedPct =
          neg.stickerPriceZAR > 0
            ? Number(
                (
                  (Math.max(0, neg.stickerPriceZAR - neg.agreedPriceZAR) / neg.stickerPriceZAR) *
                  100
                ).toFixed(1)
              )
            : 0;
        const poster = targetAgent || initiatorAgent;
        const counterparty = targetAgent ? initiatorAgent : targetAgent;
        if (poster) {
          createStatusPost({
            agentId: poster.id,
            agentHandle: poster.handle,
            authorName: poster.displayName,
            authorOrg: poster.organization,
            authorType: poster.type,
            category: 'deal_approved',
            headline: `Deal Approved with ${counterparty?.displayName || neg.initiatorHandle}`,
            body: `Signed off commercial A2A proposal on ${poster.handle} at ${
              savedPct > 0 ? `${savedPct}% below initial quote` : 'agreed terms'
            }.`,
            accentColor: '#007BFF',
            partnerName: counterparty?.displayName || neg.initiatorHandle,
            partnerHandle: counterparty?.handle || neg.initiatorHandle,
            dealValueZAR: neg.agreedPriceZAR,
            savingsLabel: savedPct > 0 ? `Saved ${savedPct}% · Deal Signed Off` : 'Deal Approved',
            ctaLabel: 'View Deal & Engage',
            autoGenerated: true,
          });
        }
      }

      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'negotiations', neg.id), neg);
        } catch {
          // ignore
        }
      }
    },
    [agents, createStatusPost, firebaseUser, firestoreOnline, negotiations]
  );

  const settleDeal = useCallback(
    async (params: {
      sessionId: string;
      buyerHandle: string;
      sellerHandle: string;
      channel: string;
      stickerPriceZAR: number;
      agreedPriceZAR: number;
      rail: PaymentRail;
    }) => {
      const { txHash } = executeSimulatedSettlement(params.rail, params.agreedPriceZAR);
      const savedZAR = Math.max(0, params.stickerPriceZAR - params.agreedPriceZAR);
      const savedPct =
        params.stickerPriceZAR > 0
          ? Number(((savedZAR / params.stickerPriceZAR) * 100).toFixed(1))
          : 0;

      const tx: SettlementDoc = {
        id: `tx_${Date.now()}`,
        sessionId: params.sessionId,
        buyerHandle: params.buyerHandle,
        sellerHandle: params.sellerHandle,
        ownerUid: currentUser.uid,
        channel: params.channel,
        stickerPriceZAR: params.stickerPriceZAR,
        amountZAR: params.agreedPriceZAR,
        amountUSD: zarToUsd(params.agreedPriceZAR),
        savedZAR,
        savedPct,
        rail: params.rail,
        txHash,
        status: 'SETTLED',
        settledAt: new Date().toISOString(),
      };

      setSettlements((prev) => [tx, ...prev]);
      setNegotiations((prev) =>
        prev.map((n) => (n.id === params.sessionId ? { ...n, status: 'SETTLED' } : n))
      );

      const buyerAgent = agents.find((a) => a.handle === params.buyerHandle);
      const sellerAgent = agents.find((a) => a.handle === params.sellerHandle);
      const poster = buyerAgent || sellerAgent;
      if (poster) {
        createStatusPost({
          agentId: poster.id,
          agentHandle: poster.handle,
          authorName: poster.displayName,
          authorOrg: poster.organization,
          authorType: poster.type,
          category: 'deal_approved',
          headline: `Deal Signed Off with ${sellerAgent?.displayName || params.sellerHandle}`,
          body: `Approved and settled deal pitched by ${sellerAgent?.displayName || params.sellerHandle} via ${params.rail.toUpperCase()} settlement.`,
          accentColor: '#007BFF',
          partnerName: sellerAgent?.displayName || params.sellerHandle,
          partnerHandle: sellerAgent?.handle || params.sellerHandle,
          dealValueZAR: params.agreedPriceZAR,
          savingsLabel:
            savedPct > 0
              ? `Saved ${savedPct}% · ${params.rail.toUpperCase()} Settled`
              : `${params.rail.toUpperCase()} Settled`,
          ctaLabel: 'View Deal & Engage',
          autoGenerated: true,
        });
      }

      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'settlements', tx.id), tx);
        } catch {
          // ignore
        }
      }
      return tx;
    },
    [agents, createStatusPost, currentUser.uid, firebaseUser, firestoreOnline]
  );

  const claimHandleRecord = useCallback((record: AgentHandleDoc) => {
    setClaimedHandles((prev) => [record, ...prev]);
  }, []);

  const placeAuctionBid = useCallback(
    (auctionId: string, amountUSD: number, bidderHandle: string) => {
      setAuctions((prev) =>
        prev.map((auc) => {
          if (auc.id !== auctionId) return auc;
          if (amountUSD <= auc.currentBidUSD) return auc;
          return {
            ...auc,
            currentBidUSD: amountUSD,
            highestBidderHandle: bidderHandle,
            bidsCount: auc.bidsCount + 1,
            bids: [
              {
                bidderUid: currentUser.uid,
                bidderHandle,
                amountUSD,
                timestamp: new Date().toISOString(),
              },
              ...auc.bids,
            ],
          };
        })
      );
    },
    [currentUser.uid]
  );

  const buyoutSecondaryListing = useCallback(
    (listingId: string, buyerHandle: string) => {
      const target = secondaryListings.find((l) => l.id === listingId);
      if (!target || target.status !== 'AVAILABLE') return null;

      setSecondaryListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: 'SOLD' } : l))
      );

      const newHandle: AgentHandleDoc = {
        id: `h_${Date.now()}`,
        handle: target.handle,
        category: 'short_handle',
        charLength: target.handle.replace('.agent', '').length,
        ownerUid: currentUser.uid,
        ownerDisplayName: buyerHandle,
        tierPriceUSD: target.buyoutPriceUSD,
        paidVia: 'x402_usdc',
        status: 'ACTIVE',
        claimedAt: new Date().toISOString(),
      };
      setClaimedHandles((prev) => [newHandle, ...prev]);
      return newHandle;
    },
    [currentUser.uid, secondaryListings]
  );

  const addBooking = useCallback(
    async (booking: BookingDoc) => {
      setBookings((prev) => [booking, ...prev]);
      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'bookings', booking.id), { ...booking, ownerUid: firebaseUser.uid });
        } catch {
          // ignore
        }
      }
    },
    [firebaseUser, firestoreOnline]
  );

  const addEmail = useCallback(
    async (email: AgentEmailDoc) => {
      setEmails((prev) => [email, ...prev]);
      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'agent_emails', email.id), { ...email, ownerUid: firebaseUser.uid });
        } catch {
          // ignore
        }
      }
    },
    [firebaseUser, firestoreOnline]
  );

  const saveVoiceSession = useCallback(
    async (session: VoiceChatSessionDoc) => {
      setVoiceSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === session.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = session;
          return copy;
        }
        return [session, ...prev];
      });
      if (session.dispatchedUnits?.length) {
        setDispatchedUnits(session.dispatchedUnits);
      }
      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'voice_chat_sessions', session.id), {
            ...session,
            callerUid: firebaseUser.uid,
          });
        } catch {
          // ignore
        }
      }
    },
    [firebaseUser, firestoreOnline]
  );

  const addPasserbyEvent = useCallback((evt: PasserbyHandshakeEvent) => {
    setPasserbyEvents((prev) => [evt, ...prev].slice(0, 20));
  }, []);

  const logPoppyAudit = useCallback((entry: Omit<PoppyAuditLogEntry, 'id' | 'timestamp'>) => {
    const record: PoppyAuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    setPoppyAuditLogs((prev) => [record, ...prev].slice(0, 50));
    return record;
  }, []);

  const createJob = useCallback((job: JobPostingDoc) => {
    setJobs((prev) => [job, ...prev]);
    const newMatches = matchJobToAllCandidates(job, agents, matches);
    if (newMatches.length > 0) {
      setMatches((prev) => {
        const map = new Map<string, RecruitmentMatchDoc>();
        prev.forEach((m) => map.set(m.id, m));
        newMatches.forEach((m: RecruitmentMatchDoc) => map.set(m.id, m));
        return Array.from(map.values());
      });
      emitToast(`Auto-matched ${newMatches.length} candidates for ${job.title}!`, 'info');
    }
    logPoppyAudit({
      actorHandle: job.companyAgentHandle,
      targetHandle: job.poppyDiscoveryPath,
      action: 'JOB_AGENT_SPAWNED',
      protocol: 'Poppy v1.0',
      details: `Published Hiring Agent for ${job.title} (${job.remoteMode}).`,
      popiaMinimized: true,
    });
  }, [agents, matches, logPoppyAudit]);

  const createJobsBulk = useCallback((newJobs: JobPostingDoc[]) => {
    if (!newJobs.length) return;
    setJobs((prev) => {
      const map = new Map<string, JobPostingDoc>();
      prev.forEach((j) => map.set(j.id, j));
      newJobs.forEach((j) => map.set(j.id, j));
      return Array.from(map.values());
    });
    const allNewMatches: RecruitmentMatchDoc[] = [];
    newJobs.forEach((job) => {
      const matched = matchJobToAllCandidates(job, agents, matches);
      allNewMatches.push(...matched);
      logPoppyAudit({
        actorHandle: job.companyAgentHandle,
        targetHandle: job.poppyDiscoveryPath,
        action: 'JOB_AGENT_SPAWNED',
        protocol: 'Poppy v1.0',
        details: `Published Hiring Agent for ${job.title} (${job.remoteMode}).`,
        popiaMinimized: true,
      });
    });
    if (allNewMatches.length > 0) {
      setMatches((prev) => {
        const map = new Map<string, RecruitmentMatchDoc>();
        prev.forEach((m) => map.set(m.id, m));
        allNewMatches.forEach((m: RecruitmentMatchDoc) => map.set(m.id, m));
        return Array.from(map.values());
      });
    }
  }, [agents, matches, logPoppyAudit]);



  const updateSeekerCv = useCallback((agentId: string, cvSummary: SeekerCvProfile) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? {
              ...a,
              agentRoleCategory: a.agentRoleCategory || 'job_seeker',
              cvSummary,
              skills: cvSummary.parsedSkills.slice(0, 3),
            }
          : a
      )
    );
  }, []);

  const upsertRecruitmentMatch = useCallback(
    (match: RecruitmentMatchDoc) => {
      const wasHired = matches.some((m) => m.id === match.id && m.status === 'hired');
      setMatches((prev) => {
        const idx = prev.findIndex((m) => m.id === match.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = match;
          return copy;
        }
        return [match, ...prev];
      });
      if (!wasHired && match.status === 'hired') {
        const seeker = agents.find((a) => a.handle === match.seekerHandle);
        const matchedJob = jobs.find((j) => j.id === match.jobId);
        const companyAgent = agents.find((a) => a.handle === match.companyAgentHandle);
        const resolvedCompanyName =
          matchedJob?.companyName || companyAgent?.displayName || match.companyAgentHandle;
        if (seeker) {
          createStatusPost({
            agentId: seeker.id,
            agentHandle: seeker.handle,
            authorName: seeker.displayName,
            authorOrg: seeker.organization,
            authorType: seeker.type,
            category: 'hired',
            headline: `Hired as ${match.jobTitle} at ${resolvedCompanyName}!`,
            body: `${resolvedCompanyName} and ${seeker.displayName} confirmed onboarding via Poppy v1.0 protocol.`,
            accentColor: '#0B4F9C',
            partnerName: resolvedCompanyName,
            partnerHandle: match.companyAgentHandle,
            roleTitle: match.jobTitle,
            regionZone: matchedJob?.regionZone || matchedJob?.location,
            savingsLabel: 'Auto-Posted · Hired via Poppy',
            ctaLabel: 'Congratulate & Engage',
            autoGenerated: true,
          });
        }
      }
    },
    [agents, createStatusPost, jobs, matches]
  );

  const upsertRecruitmentMatchesBulk = useCallback((incoming: RecruitmentMatchDoc[]) => {
    if (!incoming.length) return;
    setMatches((prev) => {
      const map = new Map<string, RecruitmentMatchDoc>();
      prev.forEach((m) => map.set(m.id, m));
      incoming.forEach((m) => map.set(m.id, m));
      return Array.from(map.values());
    });
  }, []);

  const proposePoppyOperation = useCallback((op: PoppyOperation) => {
    setPoppyOperations((prev) => [op, ...prev.filter((o) => o.operation_id !== op.operation_id)]);
  }, []);

  const executePoppyOperation = useCallback(
    (
      opId: string,
      approver: 'user' | 'agent',
      reference: string,
      matchUpdate?: { matchId: string; nextStatus: RecruitmentMatchDoc['status'] }
    ) => {
      const now = new Date().toISOString();
      setPoppyOperations((prev) =>
        prev.map((o) =>
          o.operation_id === opId && o.status !== 'performed'
            ? { ...o, status: 'performed', approver, reference, executedAt: now }
            : o
        )
      );
      if (matchUpdate) {
        setMatches((prev) =>
          prev.map((m) =>
            m.id === matchUpdate.matchId
              ? { ...m, status: matchUpdate.nextStatus, operationId: opId, updatedAt: now }
              : m
          )
        );
        if (matchUpdate.nextStatus === 'hired') {
          const hit = matches.find((m) => m.id === matchUpdate.matchId);
          const seeker = hit ? agents.find((a) => a.handle === hit.seekerHandle) : undefined;
          const job = hit ? jobs.find((j) => j.id === hit.jobId) : undefined;
          const compAgent = hit ? agents.find((a) => a.handle === hit.companyAgentHandle) : undefined;
          const resolvedCompanyName =
            job?.companyName || compAgent?.displayName || hit?.companyAgentHandle || 'Hiring Company';
          if (hit && seeker) {
            createStatusPost({
              agentId: seeker.id,
              agentHandle: seeker.handle,
              authorName: seeker.displayName,
              authorOrg: seeker.organization,
              authorType: seeker.type,
              category: 'hired',
              headline: `Hired as ${hit.jobTitle} at ${resolvedCompanyName}!`,
              body: `Offer accepted and countersigned via Poppy Operations v3 (${reference}).`,
              accentColor: '#0B4F9C',
              partnerName: resolvedCompanyName,
              partnerHandle: job?.companyAgentHandle || hit.companyAgentHandle,
              roleTitle: hit.jobTitle,
              regionZone: job?.regionZone || job?.location,
              savingsLabel: 'Auto-Posted · Offer Signed Off',
              ctaLabel: 'Congratulate & Engage',
              autoGenerated: true,
            });
          }
        }
      }
      const targetOp = poppyOperations.find((o) => o.operation_id === opId);
      logPoppyAudit({
        actorHandle: targetOp?.actorHandle || 'user.agent',
        targetHandle: targetOp?.targetHandle || 'switchboard.agent',
        action: 'OPERATIONS_V3_EXECUTED',
        protocol: 'Poppy v1.0 + operations/v3',
        operationId: opId,
        reference,
        details: `${targetOp?.summary || opId} executed once (approver=${approver}).`,
        popiaMinimized: true,
      });
    },
    [agents, createStatusPost, jobs, logPoppyAudit, matches, poppyOperations]
  );

  const declinePoppyOperation = useCallback(
    (opId: string) => {
      setPoppyOperations((prev) =>
        prev.map((o) => (o.operation_id === opId ? { ...o, status: 'declined' } : o))
      );
      logPoppyAudit({
        actorHandle: 'user.human',
        targetHandle: 'poppy.operations',
        action: 'OPERATIONS_V3_DECLINED',
        protocol: 'Poppy v1.0 + operations/v3',
        operationId: opId,
        details: 'Operation explicitly declined by human supervisor.',
        popiaMinimized: true,
      });
    },
    [logPoppyAudit]
  );

  const toggleConsentScope = useCallback(
    (consentId: string) => {
      const now = new Date().toISOString();
      setPoppyConsents((prev) =>
        prev.map((c) => {
          if (c.id !== consentId) return c;
          const nextGranted = !c.granted;
          logPoppyAudit({
            actorHandle: c.agentHandle,
            targetHandle: c.targetHandle,
            action: nextGranted ? 'SCOPE_GRANTED' : 'SCOPE_REVOKED',
            protocol: 'Poppy v1.0 OAuth Scopes',
            details: `${c.scope} ${nextGranted ? 'enabled' : 'revoked instantaneously'}`,
            popiaMinimized: true,
          });
          return {
            ...c,
            granted: nextGranted,
            revokedAt: nextGranted ? undefined : now,
          };
        })
      );
    },
    [logPoppyAudit]
  );

  const addConsentGrant = useCallback((grant: PoppyConsentGrant) => {
    setPoppyConsents((prev) => [grant, ...prev]);
  }, []);

  const revokeAllConsents = useCallback(() => {
    const now = new Date().toISOString();
    setPoppyConsents((prev) => prev.map((c) => ({ ...c, granted: false, revokedAt: now })));
    logPoppyAudit({
      actorHandle: 'user.human',
      targetHandle: 'all.agents',
      action: 'ALL_SCOPES_REVOKED',
      protocol: 'Poppy v1.0 + POPIA §11',
      details: 'Emergency kill-switch revoked all active agent consent scopes.',
      popiaMinimized: true,
    });
  }, [logPoppyAudit]);

  const updateCandidateVideo = useCallback(
    (agentId: string, interviewVideo: InterviewVideoRecord) => {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, interviewVideo } : a))
      );
      const target = agents.find((a) => a.id === agentId);
      logPoppyAudit({
        actorHandle: target?.handle || agentId,
        targetHandle: 'poppy.video-forensics',
        action:
          interviewVideo.verification.verdict === 'VERIFIED_HUMAN'
            ? 'VIDEO_VERIFIED_HUMAN'
            : 'VIDEO_DEEPFAKE_FLAGGED',
        protocol: `Multimodal (${interviewVideo.verification.verifierEngine})`,
        details: `${interviewVideo.title} scored ${interviewVideo.verification.authenticityScore}% real (${interviewVideo.verification.deepfakeRiskPct}% synthetic risk).`,
        popiaMinimized: true,
      });
    },
    [agents, logPoppyAudit]
  );

  const addPreScreenReview = useCallback(
    (agentId: string, review: PreScreenReview) => {
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== agentId || !a.interviewVideo) return a;
          return {
            ...a,
            interviewVideo: {
              ...a.interviewVideo,
              preScreenReviews: [review, ...a.interviewVideo.preScreenReviews],
            },
          };
        })
      );
      const target = agents.find((a) => a.id === agentId);
      logPoppyAudit({
        actorHandle: review.reviewerHandle,
        targetHandle: target?.handle || agentId,
        action: `PRESCREEN_${review.reviewerType.toUpperCase()}_${review.decision}`,
        protocol: 'Poppy HR Pre-Screen',
        details: `${review.reviewerName} scored ${review.score}% (${review.decision}): ${review.notes}`,
        popiaMinimized: true,
      });
    },
    [agents, logPoppyAudit]
  );

  const logAgentHistory = useCallback(
    (entry: Omit<AgentActionHistoryEntry, 'id' | 'timestamp'>) => {
      const record: AgentActionHistoryEntry = {
        ...entry,
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
      };
      setAgentActionHistory((prev) => [record, ...prev].slice(0, 120));
      return record;
    },
    []
  );

  const tailorAndSubmitApplication = useCallback(
    async (
      seeker: AgentDoc,
      job: JobPostingDoc,
      existingMatch?: RecruitmentMatchDoc
    ): Promise<AgentApplicationPackage | null> => {
      try {
        const res = await fetch('/api/recruitment/tailor-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seeker, job, existingMatch }),
        });
        const data = await res.json();
        if (!res.ok || !data?.cvDoc || !data?.coverLetterDoc) {
          emitToast(data?.error || 'Failed to tailor CV and cover letter', 'warning');
          return null;
        }

        const now = new Date().toISOString();
        const pkgId = `pkg_${job.id}_${seeker.id}_${Date.now().toString(36)}`;
        const score = existingMatch?.score || 89;

        const pkg: AgentApplicationPackage = {
          id: pkgId,
          jobId: job.id,
          jobTitle: job.title,
          companyAgentHandle: job.companyAgentHandle,
          companyName: job.companyName,
          regionZone: job.regionZone || job.location,
          seekerAgentId: seeker.id,
          seekerHandle: seeker.handle,
          seekerName: seeker.displayName,
          seekerEmail: seeker.agentEmail,
          linkedinUrl: seeker.linkedinUrl,
          matchScore: score,
          status: 'applied',
          cvDoc: data.cvDoc,
          coverLetterDoc: data.coverLetterDoc,
          interviewPrepQuestions: Array.isArray(data.interviewPrepQuestions)
            ? data.interviewPrepQuestions
            : [],
          hrNotes: [],
          reviewedByHr: [],
          submittedVia: ['Poppy v1.0 Operations', 'AgentMail Dispatch'],
          createdAt: now,
          updatedAt: now,
        };

        // 1. Save Application Package
        setApplicationPackages((prev) => [
          pkg,
          ...prev.filter((p) => !(p.jobId === job.id && p.seekerHandle === seeker.handle)),
        ]);

        // 2. Update candidate CV profile formatted to the job specs
        if (data.updatedCvSummary) {
          setAgents((prev) =>
            prev.map((a) =>
              a.id === seeker.id
                ? {
                    ...a,
                    agentRoleCategory: a.agentRoleCategory || 'job_seeker',
                    cvSummary: data.updatedCvSummary,
                    skills: Array.isArray(data.updatedCvSummary.parsedSkills)
                      ? data.updatedCvSummary.parsedSkills.slice(0, 4)
                      : a.skills,
                  }
                : a
            )
          );
        }

        // 3. Upsert Match record with applied status
        const opId = `op_tailor_${Date.now()}`;
        const matchId = existingMatch?.id || `match_${job.id}_${seeker.id}`;
        const nextMatch: RecruitmentMatchDoc = {
          id: matchId,
          jobId: job.id,
          jobTitle: job.title,
          companyAgentHandle: job.companyAgentHandle,
          seekerHandle: seeker.handle,
          seekerName: seeker.displayName,
          score,
          factors: existingMatch?.factors || {
            skillsOverlap: 91,
            experienceFit: 89,
            compensationFit: 90,
            locationCultureFit: job.remoteMode === 'Remote' ? 96 : 89,
          },
          explanation: `Personal agent tailored CV to ${job.companyName} specs, drafted cover letter & submitted dossier.`,
          strengths:
            data.cvDoc.matchedKeywords?.length > 0
              ? data.cvDoc.matchedKeywords
              : existingMatch?.strengths || job.requiredSkills.slice(0, 2),
          gaps: data.cvDoc.missingKeywords || [],
          blindMode: Boolean(seeker.cvSummary?.blindScreening),
          status: 'applied',
          operationId: opId,
          interviewPitch: data.coverLetterDoc.openingParagraph,
          updatedAt: now,
        };
        setMatches((prev) => {
          const idx = prev.findIndex((m) => m.id === nextMatch.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = nextMatch;
            return copy;
          }
          return [nextMatch, ...prev];
        });

        // 4. Record Poppy Operations receipt & Audit Log
        setPoppyOperations((prev) => [
          {
            operation_id: opId,
            revision: `rev_${Math.random().toString(36).slice(2, 10)}`,
            actionType: 'apply_job',
            summary: `Tailor CV & Submit Application: ${seeker.displayName} -> ${job.title} (${job.companyName})`,
            terms: {
              jobId: job.id,
              regionZone: job.regionZone || job.location,
              tailoredEngine: data.engine || 'gemini-4-hydrogen',
              packageId: pkgId,
            },
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            status: 'performed',
            approver: 'agent',
            reference: `poppy_app_${Date.now().toString().slice(-6)}`,
            createdAt: now,
            executedAt: now,
            targetHandle: job.companyAgentHandle,
            actorHandle: seeker.handle,
          },
          ...prev,
        ]);

        logPoppyAudit({
          actorHandle: seeker.handle,
          targetHandle: job.companyAgentHandle,
          action: 'CV_TAILORED_AND_APPLIED',
          protocol: `Poppy v1.0 (${data.engine || 'gemini-4-hydrogen'})`,
          operationId: opId,
          details: `Updated & formatted CV + custom Cover Letter for ${job.title} (${job.regionZone || job.location}).`,
          popiaMinimized: true,
        });

        // 5. Save full transparent action trail on both personal & company agent histories
        const companyAgent = agents.find((a) => a.handle === job.companyAgentHandle);
        setAgentActionHistory((prev) => [
          {
            id: `hist_app_${Date.now()}_3`,
            agentId: seeker.id,
            agentHandle: seeker.handle,
            actorType: 'personal_agent',
            actorName: `${seeker.displayName} Personal Agent`,
            actionType: 'APPLICATION_SUBMITTED',
            title: `Submitted Tailored CV & Cover Letter to ${job.companyName}`,
            details: `Dispatched spec-formatted CV + bespoke Cover Letter for "${job.title}" (${job.regionZone || job.location}) via Poppy Operations & AgentMail.`,
            relatedJobId: job.id,
            relatedJobTitle: job.title,
            relatedPackageId: pkgId,
            targetHandle: job.companyAgentHandle,
            channel: 'Poppy v1.0 + AgentMail',
            timestamp: now,
          },
          {
            id: `hist_app_${Date.now()}_2`,
            agentId: seeker.id,
            agentHandle: seeker.handle,
            actorType: 'personal_agent',
            actorName: `${seeker.displayName} Personal Agent`,
            actionType: 'COVER_LETTER_GENERATED',
            title: `Drafted Cover Letter for ${job.title}`,
            details: `Personalized cover letter highlighting ${data.cvDoc.matchedKeywords?.slice(0, 3).join(', ') || 'role competencies'} addressed to ${job.companyName} hiring committee.`,
            relatedJobId: job.id,
            relatedJobTitle: job.title,
            relatedPackageId: pkgId,
            targetHandle: job.companyAgentHandle,
            channel: data.engine || 'gemini-4-hydrogen',
            timestamp: now,
          },
          {
            id: `hist_app_${Date.now()}_1`,
            agentId: seeker.id,
            agentHandle: seeker.handle,
            actorType: 'personal_agent',
            actorName: `${seeker.displayName} Personal Agent`,
            actionType: 'CV_FORMATTED',
            title: `Updated & Formatted CV to ${job.companyName} Job Specs`,
            details: `Aligned summary & experience highlights to ${job.requiredSkills.join(', ')}; saved downloadable PDF & DOCX versions.`,
            relatedJobId: job.id,
            relatedJobTitle: job.title,
            relatedPackageId: pkgId,
            targetHandle: job.companyAgentHandle,
            channel: data.engine || 'gemini-4-hydrogen',
            timestamp: now,
          },
          ...(companyAgent
            ? [
                {
                  id: `hist_biz_${Date.now()}`,
                  agentId: companyAgent.id,
                  agentHandle: companyAgent.handle,
                  actorType: 'company_agent' as const,
                  actorName: `${job.companyName} Talent Agent`,
                  actionType: 'APPLICATION_SUBMITTED' as const,
                  title: `Received Tailored Dossier: ${seeker.displayName} (${score}% Fit)`,
                  details: `Intake logged for "${job.title}" (${job.regionZone || job.location}). Tailored CV & Cover Letter ready for HR review.`,
                  relatedJobId: job.id,
                  relatedJobTitle: job.title,
                  relatedPackageId: pkgId,
                  targetHandle: seeker.handle,
                  channel: 'HR Intake Pipeline',
                  timestamp: now,
                },
              ]
            : []),
          ...prev,
        ]);

        // 6. Non-blocking AgentMail transmission
        fetch('/api/agentmail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inbox: seeker.agentEmail,
            to: companyAgent?.agentEmail || 'exchagent@agentmail.to',
            subject: data.coverLetterDoc.subject,
            text: `${data.coverLetterDoc.openingParagraph}\n\n${data.coverLetterDoc.bodyParagraphs.join('\n\n')}\n\n${data.coverLetterDoc.closingParagraph}\n\n${data.coverLetterDoc.signatureContact}\n\n---\n${AI_OUTREACH_DISCLAIMER_TEXT}`,
          }),
        }).catch(() => {});

        emitToast(`Agent tailored CV & Cover Letter and applied to ${job.companyName}!`, 'success');
        return pkg;
      } catch (err) {
        console.warn('Tailor & apply failed:', err);
        emitToast('Unable to reach tailoring service right now', 'warning');
        return null;
      }
    },
    [agents, logPoppyAudit]
  );

  const recordHrDocView = useCallback(
    (packageId: string, reviewer: { name: string; role: string }) => {
      const now = new Date().toISOString();
      let targetPkg: AgentApplicationPackage | undefined;
      setApplicationPackages((prev) =>
        prev.map((pkg) => {
          if (pkg.id !== packageId) return pkg;
          targetPkg = pkg;
          const alreadyRecent = pkg.reviewedByHr.some(
            (r) => r.name === reviewer.name && Date.now() - new Date(r.viewedAt).getTime() < 60_000
          );
          if (alreadyRecent) return pkg;
          return {
            ...pkg,
            reviewedByHr: [{ name: reviewer.name, role: reviewer.role, viewedAt: now }, ...pkg.reviewedByHr].slice(0, 15),
          };
        })
      );
      if (targetPkg) {
        const companyAgent = agents.find((a) => a.handle === targetPkg!.companyAgentHandle);
        if (companyAgent) {
          logAgentHistory({
            agentId: companyAgent.id,
            agentHandle: companyAgent.handle,
            actorType: 'hr_staff',
            actorName: `${reviewer.name} (${reviewer.role})`,
            actionType: 'HR_VIEWED_DOCS',
            title: `HR Inspected Dossier: ${targetPkg.seekerName}`,
            details: `Viewed tailored CV & Cover Letter for "${targetPkg.jobTitle}".`,
            relatedJobId: targetPkg.jobId,
            relatedJobTitle: targetPkg.jobTitle,
            relatedPackageId: packageId,
            targetHandle: targetPkg.seekerHandle,
            channel: 'HR Staff Portal',
          });
        }
      }
    },
    [agents, logAgentHistory]
  );

  const addHrReviewNote = useCallback(
    (packageId: string, authorName: string, authorRole: string, note: string) => {
      const cleanNote = note.trim();
      if (!cleanNote) return;
      const now = new Date().toISOString();
      const newNote: HrReviewNote = {
        id: `hrn_${Date.now()}`,
        authorName,
        authorRole,
        note: cleanNote,
        createdAt: now,
      };
      let targetPkg: AgentApplicationPackage | undefined;
      setApplicationPackages((prev) =>
        prev.map((pkg) => {
          if (pkg.id !== packageId) return pkg;
          targetPkg = pkg;
          return {
            ...pkg,
            hrNotes: [newNote, ...pkg.hrNotes],
            updatedAt: now,
          };
        })
      );
      if (targetPkg) {
        const companyAgent = agents.find((a) => a.handle === targetPkg!.companyAgentHandle);
        if (companyAgent) {
          logAgentHistory({
            agentId: companyAgent.id,
            agentHandle: companyAgent.handle,
            actorType: 'hr_staff',
            actorName: `${authorName} (${authorRole})`,
            actionType: 'HR_NOTE_ADDED',
            title: `HR Note Added on ${targetPkg.seekerName}`,
            details: cleanNote,
            relatedJobId: targetPkg.jobId,
            relatedJobTitle: targetPkg.jobTitle,
            relatedPackageId: packageId,
            targetHandle: targetPkg.seekerHandle,
            channel: 'HR Staff Portal',
          });
        }
      }
      emitToast('HR review note saved', 'success');
    },
    [agents, logAgentHistory]
  );

  const updateApplicationStatus = useCallback(
    (
      packageId: string,
      nextStatus: AgentApplicationPackage['status'],
      reviewer?: { name: string; role: string }
    ) => {
      const now = new Date().toISOString();
      let targetPkg: AgentApplicationPackage | undefined;
      setApplicationPackages((prev) =>
        prev.map((pkg) => {
          if (pkg.id !== packageId) return pkg;
          targetPkg = pkg;
          return { ...pkg, status: nextStatus, updatedAt: now };
        })
      );
      if (targetPkg) {
        setMatches((prev) =>
          prev.map((m) =>
            m.jobId === targetPkg!.jobId && m.seekerHandle === targetPkg!.seekerHandle
              ? { ...m, status: nextStatus, updatedAt: now }
              : m
          )
        );
        const companyAgent = agents.find((a) => a.handle === targetPkg!.companyAgentHandle);
        const actor = reviewer ? `${reviewer.name} (${reviewer.role})` : 'HR Recruiting Team';
        if (companyAgent) {
          logAgentHistory({
            agentId: companyAgent.id,
            agentHandle: companyAgent.handle,
            actorType: 'hr_staff',
            actorName: actor,
            actionType: 'HR_SHORTLISTED',
            title: `Updated ${targetPkg.seekerName} -> ${nextStatus.toUpperCase()}`,
            details: `Changed candidate stage for "${targetPkg.jobTitle}" (${targetPkg.regionZone}) to ${nextStatus}.`,
            relatedJobId: targetPkg.jobId,
            relatedJobTitle: targetPkg.jobTitle,
            relatedPackageId: packageId,
            targetHandle: targetPkg.seekerHandle,
            channel: 'HR Staff Portal',
          });
        }
          logAgentHistory({
            agentId: targetPkg.seekerAgentId,
            agentHandle: targetPkg.seekerHandle,
            actorType: 'company_agent',
            actorName: `${targetPkg.companyName} HR Desk`,
            actionType: 'HR_SHORTLISTED',
            title: `Application Update from ${targetPkg.companyName}: ${nextStatus.toUpperCase()}`,
            details: `${actor} moved your application for "${targetPkg.jobTitle}" to "${nextStatus}".`,
            relatedJobId: targetPkg.jobId,
            relatedJobTitle: targetPkg.jobTitle,
            relatedPackageId: packageId,
            targetHandle: targetPkg.companyAgentHandle,
            channel: 'Poppy HR Status Sync',
          });

          if (nextStatus === 'hired') {
            createStatusPost({
              agentId: targetPkg.seekerAgentId,
              agentHandle: targetPkg.seekerHandle,
              authorName: targetPkg.seekerName,
              authorOrg: `${targetPkg.companyName} (New Hire)`,
              authorType: 'persona',
              category: 'hired',
              headline: `Hired as ${targetPkg.jobTitle} at ${targetPkg.companyName}!`,
              body: `${actor} signed off on ${targetPkg.seekerName}'s hire for ${targetPkg.jobTitle} (${targetPkg.regionZone}).`,
              accentColor: '#0B4F9C',
              partnerName: targetPkg.companyName,
              partnerHandle: targetPkg.companyAgentHandle,
              roleTitle: targetPkg.jobTitle,
              regionZone: targetPkg.regionZone,
              savingsLabel: 'Auto-Posted · Hired via Poppy',
              ctaLabel: 'Congratulate & Engage',
              autoGenerated: true,
            });
          }
      }
      emitToast(`Applicant status updated to ${nextStatus}`, 'success');
    },
    [agents, createStatusPost, logAgentHistory]
  );

  const addHrTeamMember = useCallback(
    (
      companyAgentId: string,
      member: Omit<HrTeamMember, 'id' | 'addedAt'>
    ) => {
      const now = new Date().toISOString();
      const created: HrTeamMember = {
        ...member,
        id: `hr_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        addedAt: now,
      };
      let compHandle = '';
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== companyAgentId) return a;
          compHandle = a.handle;
          return {
            ...a,
            hrTeam: [...(a.hrTeam || []), created],
          };
        })
      );
      if (compHandle) {
        logAgentHistory({
          agentId: companyAgentId,
          agentHandle: compHandle,
          actorType: 'hr_staff',
          actorName: created.name,
          actionType: 'HR_TEAM_UPDATED',
          title: `Authorized HR Access Granted: ${created.name}`,
          details: `Added ${created.name} (${created.roleTitle}) with permissions: ${created.permissions.join(', ')}.`,
          channel: 'HR Access Roster',
        });
      }
      emitToast(`Granted HR portal access to ${created.name}`, 'success');
      return created;
    },
    [logAgentHistory]
  );

  const userContacts = contacts.filter((c) => c.ownerUid === currentUser.uid);

  const saveContact = useCallback(
    async (
      card: Partial<AgentDoc> & Partial<ProximityPeerDoc> & { handle: string; displayName: string },
      meta: {
        source: ContactSource;
        sharedAtLocation?: string;
        eventName?: string;
        sharedByHandle?: string;
        notes?: string;
        tags?: string[];
      }
    ) => {
      const existing = contacts.find(
        (c) => c.ownerUid === currentUser.uid && c.handle.toLowerCase() === card.handle.toLowerCase()
      );
      const now = new Date().toISOString();
      const record: PersonalContactDoc = existing
        ? {
            ...existing,
            displayName: card.displayName || existing.displayName,
            roleTitle: card.roleTitle || existing.roleTitle,
            organization: card.organization || existing.organization,
            skills: card.skills?.length ? card.skills : existing.skills,
            summary: card.summary || existing.summary,
            imageUrl: card.imageUrl || existing.imageUrl,
            cardStyle: card.cardStyle || existing.cardStyle,
            source: meta.source || existing.source,
            sharedAtLocation: meta.sharedAtLocation || existing.sharedAtLocation,
            eventName: meta.eventName || existing.eventName,
            notes: meta.notes ? `${existing.notes ? existing.notes + '\n' : ''}${meta.notes}` : existing.notes,
            tags: meta.tags ? Array.from(new Set([...existing.tags, ...meta.tags])) : existing.tags,
            sharedAt: existing.sharedAt,
          }
        : {
            id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ownerUid: currentUser.uid,
            agentId: card.id,
            handle: card.handle,
            displayName: card.displayName,
            roleTitle: card.roleTitle || 'Verified Agent',
            organization: card.organization || card.displayName,
            type: card.type === 'business' ? 'business' : 'persona',
            agentRoleCategory: card.agentRoleCategory,
            verified: card.verified !== false,
            voiceNumber: card.voiceNumber || '+27-87-AGENT-000',
            agentEmail: card.agentEmail || `engage@${card.handle}`,
            linkedinUrl: card.linkedinUrl,
            websiteUrl: card.websiteUrl,
            skills: card.skills || [],
            summary: card.summary,
            imageUrl: card.imageUrl,
            brandColor: card.brandColor,
            brandLogoCode: card.brandLogoCode,
            cardStyle: card.cardStyle,
            guardrails: card.guardrails,
            source: meta.source,
            sharedAtLocation: meta.sharedAtLocation,
            eventName: meta.eventName,
            sharedByHandle: meta.sharedByHandle || card.handle,
            favorite: false,
            tags: meta.tags || (card.skills ? card.skills.slice(0, 2) : []),
            notes: meta.notes || '',
            sharedAt: now,
          };

      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.id === record.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = record;
          return copy;
        }
        return [record, ...prev];
      });

      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'contacts', record.id), { ...record, ownerUid: firebaseUser.uid });
        } catch {
          // keep local persistence
        }
      }

      emitToast(
        existing ? `Updated ${record.handle} in Contacts` : `Saved ${record.displayName} to Contacts`,
        'success'
      );
      return record;
    },
    [contacts, currentUser.uid, firebaseUser, firestoreOnline]
  );

  const updateContact = useCallback(
    async (contactId: string, patch: Partial<PersonalContactDoc>) => {
      let updated: PersonalContactDoc | null = null;
      setContacts((prev) =>
        prev.map((c) => {
          if (c.id !== contactId) return c;
          updated = { ...c, ...patch };
          return updated;
        })
      );
      if (updated && db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'contacts', contactId), updated);
        } catch {
          // ignore
        }
      }
    },
    [firebaseUser, firestoreOnline]
  );

  const toggleContactFavorite = useCallback(
    async (contactId: string) => {
      const target = contacts.find((c) => c.id === contactId);
      if (!target) return;
      await updateContact(contactId, { favorite: !target.favorite });
    },
    [contacts, updateContact]
  );

  const deleteContact = useCallback((contactId: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    emitToast('Removed contact from personal list', 'info');
  }, []);

  const scanOpportunitiesWithAi = useCallback(
    async (activeAgent: AgentDoc, recentPeers: ProximityPeerDoc[] = []) => {
      setAiOpportunitiesLoading(true);
      setAiOpportunitiesError(null);
      try {
        const res = await fetch('/api/ai/opportunities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAgent: activeAgent,
            contacts: contacts.filter((c) => c.ownerUid === currentUser.uid),
            jobs,
            rfps,
            recentPeers,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const message = data?.error || `AI Opportunity Scout failed (${res.status})`;
          setAiOpportunitiesError(message);
          emitToast(message, 'warning');
          return null;
        }
        setAiOpportunities(Array.isArray(data.opportunities) ? data.opportunities : []);
        setAiOpportunitiesMeta({
          engine: data.engine,
          generatedAt: data.generatedAt,
          summary: data.summary,
        });
        emitToast(`Found ${data.opportunities?.length || 0} opportunities via Gemini`, 'success');
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error calling AI Opportunity Scout.';
        setAiOpportunitiesError(message);
        return null;
      } finally {
        setAiOpportunitiesLoading(false);
      }
    },
    [contacts, currentUser.uid, jobs, rfps]
  );

  const updateAgentIntent = useCallback(
    async (agentId: string, intent: AgentIntentProfile) => {
      let targetAgent: AgentDoc | undefined;
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== agentId) return a;
          const mergedTopics = Array.from(new Set([...(a.skills || []), ...(intent.topics || [])])).slice(0, 12);
          targetAgent = {
            ...a,
            skills: mergedTopics.length > 0 ? mergedTopics : a.skills,
            impliedIntent: {
              ...intent,
              updatedAt: new Date().toISOString(),
            },
          };
          return targetAgent;
        })
      );

      if (targetAgent && db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'agents', targetAgent.id), targetAgent);
        } catch {
          // keep local persistence
        }
      }

      if (targetAgent) {
        logAgentHistory({
          agentId: targetAgent.id,
          agentHandle: targetAgent.handle,
          actorType: targetAgent.type === 'business' ? 'company_agent' : 'personal_agent',
          actorName: `${targetAgent.displayName} Agent`,
          actionType: 'AUTO_MATCH',
          title: 'Implied Intent Profile Updated',
          details: `${intent.headline || `${intent.categories.join(', ')} intent active`} (${intent.autoMatchEnabled ? 'AUTO-MATCH ON' : 'SAVED'})`,
          channel: 'Intent & Auto-Match Hub',
        });
        emitToast(`Updated Intent profile for ${targetAgent.displayName}`, 'success');
      }
      return targetAgent || null;
    },
    [firebaseUser, firestoreOnline, logAgentHistory]
  );

  const updateJobStatus = useCallback((jobId: string, status: JobPostingDoc['status']) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
    emitToast(`Vacancy marked ${status}`, 'info');
  }, []);

  const updateRfpStatus = useCallback((rfpId: string, status: RfpDoc['status']) => {
    setRfps((prev) => prev.map((r) => (r.id === rfpId ? { ...r, status } : r)));
    emitToast(`RFP marked ${status}`, 'info');
  }, []);

  const runAutonomousIntentMatch = useCallback(
    async (sourceAgent: AgentDoc, livePeers: ProximityPeerDoc[] = []) => {
      setAutonomousMatchLoading(true);
      try {
        const res = await fetch('/api/agents/autonomous-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceAgent,
            agents,
            jobs,
            rfps,
            peers: livePeers,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          emitToast(data?.error || 'Autonomous matcher could not complete', 'warning');
          return null;
        }
        const items = Array.isArray(data.matches) ? (data.matches as AutonomousMatchItem[]) : [];
        setAutonomousMatches(items);
        setAutonomousMatchMeta({
          engine: data.engine,
          generatedAt: data.generatedAt,
          executiveSummary: data.executiveSummary,
          sourceHandle: sourceAgent.handle,
        });
        return items;
      } catch (err) {
        emitToast(err instanceof Error ? err.message : 'Network error running autonomous match', 'warning');
        return null;
      } finally {
        setAutonomousMatchLoading(false);
      }
    },
    [agents, jobs, rfps]
  );

  const autoAddProximityPeers = useCallback(
    (
      peers: ProximityPeerDoc[],
      opts: {
        scanRadiusMeters: number;
        myTopics: string[];
        requireTopicOverlap: boolean;
        roomCode: string;
      }
    ): PersonalContactDoc[] => {
      const normalizedTopics = opts.myTopics.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2);
      const existingHandles = new Set(
        contacts.filter((c) => c.ownerUid === currentUser.uid).map((c) => c.handle.toLowerCase())
      );

      const added: PersonalContactDoc[] = [];
      const now = new Date().toISOString();

      for (const peer of peers) {
        if (peer.distanceMeters > opts.scanRadiusMeters) continue;
        if (existingHandles.has(peer.handle.toLowerCase())) continue;

        const peerHay = [
          peer.roleTitle,
          peer.summary || '',
          ...(peer.skills || []),
          ...(peer.impliedTopics || []),
        ]
          .join(' ')
          .toLowerCase();
        const topicOverlap = normalizedTopics.filter((t) => peerHay.includes(t));

        if (opts.requireTopicOverlap && normalizedTopics.length > 0 && topicOverlap.length === 0) {
          continue;
        }

        existingHandles.add(peer.handle.toLowerCase());
        added.push({
          id: `contact_auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ownerUid: currentUser.uid,
          handle: peer.handle,
          displayName: peer.displayName,
          roleTitle: peer.roleTitle,
          organization: peer.organization,
          type: peer.type === 'business' ? 'business' : 'persona',
          verified: peer.verified !== false,
          voiceNumber: peer.voiceNumber || '+27-87-AGENT-000',
          agentEmail: peer.agentEmail || `engage@${peer.handle}`,
          skills: peer.skills || [],
          summary: peer.summary,
          imageUrl: peer.imageUrl,
          brandColor: peer.brandColor,
          brandLogoCode: peer.brandLogoCode,
          cardStyle: peer.cardStyle,
          source: peer.sameWifi ? 'event_wifi' : 'event_ble',
          sharedAtLocation: peer.locationLabel,
          eventName: opts.roomCode,
          sharedByHandle: peer.handle,
          favorite: false,
          tags: Array.from(new Set(['auto-radar', ...topicOverlap.slice(0, 2), ...(peer.skills || []).slice(0, 2)])),
          notes: `Auto-added via proximity radar (${peer.distanceMeters}m${peer.mutualBearingLock ? ', mutual compass bearing lock' : ''})${topicOverlap.length ? ` · Matched intent: ${topicOverlap.join(', ')}` : ''}`,
          sharedAt: now,
        });
      }

      if (added.length > 0) {
        setContacts((prev) => [...added, ...prev]);
        emitToast(
          added.length === 1
            ? `Auto-added ${added[0].displayName} (${added[0].tags[0]}) within ${opts.scanRadiusMeters}m`
            : `Auto-added ${added.length} nearby contacts within ${opts.scanRadiusMeters}m`,
          'success'
        );
      }

      return added;
    },
    [contacts, currentUser.uid]
  );

  const resetDemoData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAgents(SEED_AGENTS);
    setRfps(SEED_RFPS);
    setNegotiations(SEED_NEGOTIATIONS);
    setSettlements(SEED_SETTLEMENTS);
    setClaimedHandles(SEED_CLAIMED_HANDLES);
    setAuctions(SEED_AUCTIONS);
    setSecondaryListings(SEED_SECONDARY_LISTINGS);
    setBookings(SEED_BOOKINGS);
    setEmails(SEED_EMAILS);
    setVoiceSessions(SEED_VOICE_SESSIONS);
    setJobs(SEED_JOBS);
    setMatches(SEED_MATCHES);
    setPoppyOperations(SEED_POPPY_OPERATIONS);
    setPoppyConsents(SEED_POPPY_CONSENTS);
    setPoppyAuditLogs(SEED_POPPY_AUDIT_LOGS);
    setContacts(SEED_CONTACTS);
    setSeededContactOwners(['seed-persona-alex']);
    setApplicationPackages(SEED_APPLICATION_PACKAGES);
    setAgentActionHistory(SEED_AGENT_HISTORY);
    setMatchedUserOwners(['seed-persona-alex']);
    setStatusPosts(SEED_STATUS_POSTS);
    setAiOpportunities([]);
    setAiOpportunitiesMeta(null);
    setAiOpportunitiesError(null);
    setAutonomousMatches([]);
    setAutonomousMatchMeta(null);
    setPasserbyEvents([]);
    setDispatchedUnits([]);
  }, []);

  return {
    agents,
    rfps,
    negotiations,
    settlements,
    claimedHandles,
    auctions,
    secondaryListings,
    bookings,
    emails,
    voiceSessions,
    jobs,
    matches,
    poppyOperations,
    poppyConsents,
    poppyAuditLogs,
    applicationPackages,
    agentActionHistory,
    statusPosts,
    contacts: userContacts,
    aiOpportunities,
    aiOpportunitiesMeta,
    aiOpportunitiesLoading,
    aiOpportunitiesError,
    autonomousMatches,
    autonomousMatchLoading,
    autonomousMatchMeta,
    passerbyEvents,
    dispatchedUnits,
    userLocation,
    setUserLocation,
    surface,
    setSurface,
    currency,
    setCurrency,
    localCurrency,
    setLocalCurrency,
    locationLabel,
    fxRates,
    fxSource,
    detectingLocation,
    detectLocationAndCurrency,
    currentUser,
    workspaceToken,
    firestoreOnline,
    googleMapsApiKey,
    setGoogleMapsApiKey,
    mapboxAccessToken,
    setMapboxAccessToken,
    loginGoogle,
    loginPasskeySim,
    logout,
    addOrUpdateAgent,
    toggleAgentDiscoverability,
    publishRfp,
    saveNegotiation,
    settleDeal,
    claimHandleRecord,
    placeAuctionBid,
    buyoutSecondaryListing,
    addBooking,
    addEmail,
    saveVoiceSession,
    addPasserbyEvent,
    createJob,
    createJobsBulk,
    updateSeekerCv,
    upsertRecruitmentMatch,

    upsertRecruitmentMatchesBulk,
    proposePoppyOperation,
    executePoppyOperation,
    declinePoppyOperation,
    toggleConsentScope,
    addConsentGrant,
    revokeAllConsents,
    updateCandidateVideo,
    addPreScreenReview,
    logPoppyAudit,
    logAgentHistory,
    tailorAndSubmitApplication,
    recordHrDocView,
    addHrReviewNote,
    updateApplicationStatus,
    addHrTeamMember,
    createStatusPost,
    saveContact,
    updateContact,
    toggleContactFavorite,
    deleteContact,
    scanOpportunitiesWithAi,
    updateAgentIntent,
    updateJobStatus,
    updateRfpStatus,
    runAutonomousIntentMatch,
    autoAddProximityPeers,
    resetDemoData,
  };
}
