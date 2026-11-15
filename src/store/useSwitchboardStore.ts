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
  ZAR_PER_USD,
} from '../types/firestore';
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
}

function loadInitialSlice(): Required<PersistedSlice> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSlice>;
      const loadedAgents = parsed.agents?.length ? parsed.agents : SEED_AGENTS;
      const mergedAgents = loadedAgents.map((a) => {
        const seed = SEED_AGENTS.find((s) => s.id === a.id);
        if (seed?.cardStyle && !a.cardStyle) {
          return { ...a, cardStyle: seed.cardStyle };
        }
        return a;
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
        jobs: parsed.jobs?.length ? parsed.jobs : SEED_JOBS,
        matches: parsed.matches?.length ? parsed.matches : SEED_MATCHES,
        poppyOperations: parsed.poppyOperations?.length ? parsed.poppyOperations : SEED_POPPY_OPERATIONS,
        poppyConsents: parsed.poppyConsents?.length ? parsed.poppyConsents : SEED_POPPY_CONSENTS,
        poppyAuditLogs: parsed.poppyAuditLogs?.length ? parsed.poppyAuditLogs : SEED_POPPY_AUDIT_LOGS,
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

  const [surface, setSurface] = useState<SurfaceMode>('desktop');
  const [currency, setCurrency] = useState<CurrencyMode>('ZAR');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(null);
  const [passkeyUser, setPasskeyUser] = useState<AuthSessionUser | null>(null);
  const [firestoreOnline, setFirestoreOnline] = useState(false);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>(JOHANNESBURG_CENTER);
  const [passerbyEvents, setPasserbyEvents] = useState<PasserbyHandshakeEvent[]>([]);
  const [dispatchedUnits, setDispatchedUnits] = useState<DispatchedUnit[]>([]);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );

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
  ]);

  // Boot connection check & public config
  useEffect(() => {
    testFirestoreConnection().then(setFirestoreOnline);
    fetch('/api/config/public')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.googleMapsApiKey && !googleMapsApiKey) {
          setGoogleMapsApiKey(cfg.googleMapsApiKey);
        }
      })
      .catch(() => {});
  }, [googleMapsApiKey]);

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
    } catch {
      // keep local fallback
    }

    return () => unsubs.forEach((u) => u());
  }, [firebaseUser, firestoreOnline]);

  const currentUser: AuthSessionUser = firebaseUser
    ? {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || 'Switchboard Operator',
        email: firebaseUser.email || '',
        mode: 'google',
      }
    : passkeyUser || {
        uid: 'seed-persona-alex',
        displayName: 'Alex Nkosi (Local Workspace)',
        email: 'alex@veldcompute.co.za',
        mode: 'guest',
      };

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

  const saveNegotiation = useCallback(
    async (neg: NegotiationDoc) => {
      setNegotiations((prev) => {
        const idx = prev.findIndex((n) => n.id === neg.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = neg;
          return copy;
        }
        return [neg, ...prev];
      });
      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'negotiations', neg.id), neg);
        } catch {
          // ignore
        }
      }
    },
    [firebaseUser, firestoreOnline]
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
        amountUSD: Number((params.agreedPriceZAR / ZAR_PER_USD).toFixed(2)),
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

      if (db && firebaseUser && firestoreOnline) {
        try {
          await setDoc(doc(db, 'settlements', tx.id), tx);
        } catch {
          // ignore
        }
      }
      return tx;
    },
    [currentUser.uid, firebaseUser, firestoreOnline]
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
    logPoppyAudit({
      actorHandle: job.companyAgentHandle,
      targetHandle: job.poppyDiscoveryPath,
      action: 'JOB_AGENT_SPAWNED',
      protocol: 'Poppy v1.0',
      details: `Published Hiring Agent for "${job.title}" (${job.remoteMode}).`,
      popiaMinimized: true,
    });
  }, [logPoppyAudit]);

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

  const upsertRecruitmentMatch = useCallback((match: RecruitmentMatchDoc) => {
    setMatches((prev) => {
      const idx = prev.findIndex((m) => m.id === match.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = match;
        return copy;
      }
      return [match, ...prev];
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
    [logPoppyAudit, poppyOperations]
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
    passerbyEvents,
    dispatchedUnits,
    userLocation,
    setUserLocation,
    surface,
    setSurface,
    currency,
    setCurrency,
    currentUser,
    workspaceToken,
    firestoreOnline,
    googleMapsApiKey,
    setGoogleMapsApiKey,
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
    updateSeekerCv,
    upsertRecruitmentMatch,
    proposePoppyOperation,
    executePoppyOperation,
    declinePoppyOperation,
    toggleConsentScope,
    addConsentGrant,
    revokeAllConsents,
    updateCandidateVideo,
    addPreScreenReview,
    logPoppyAudit,
    resetDemoData,
  };
}
