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
      const loadedJobs = parsed.jobs?.length ? parsed.jobs : SEED_JOBS;
      const mergedJobsMap = new Map<string, JobPostingDoc>();
      loadedJobs.forEach((j) => mergedJobsMap.set(j.id, j));
      SEED_JOBS.forEach((j) => {
        if (!mergedJobsMap.has(j.id)) mergedJobsMap.set(j.id, j);
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
        jobs: Array.from(mergedJobsMap.values()),
        matches: parsed.matches?.length ? parsed.matches : SEED_MATCHES,
        poppyOperations: parsed.poppyOperations?.length ? parsed.poppyOperations : SEED_POPPY_OPERATIONS,
        poppyConsents: parsed.poppyConsents?.length ? parsed.poppyConsents : SEED_POPPY_CONSENTS,
        poppyAuditLogs: parsed.poppyAuditLogs?.length ? parsed.poppyAuditLogs : SEED_POPPY_AUDIT_LOGS,
        contacts: parsed.contacts?.length ? parsed.contacts : SEED_CONTACTS,
        seededContactOwners: parsed.seededContactOwners?.length
          ? parsed.seededContactOwners
          : ['seed-persona-alex'],
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

  const [aiOpportunities, setAiOpportunities] = useState<AiOpportunitySuggestion[]>([]);
  const [aiOpportunitiesMeta, setAiOpportunitiesMeta] = useState<{
    engine?: string;
    generatedAt?: string;
    summary?: string;
  } | null>(null);
  const [aiOpportunitiesLoading, setAiOpportunitiesLoading] = useState(false);
  const [aiOpportunitiesError, setAiOpportunitiesError] = useState<string | null>(null);

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
    setAiOpportunities([]);
    setAiOpportunitiesMeta(null);
    setAiOpportunitiesError(null);
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
    contacts: userContacts,
    aiOpportunities,
    aiOpportunitiesMeta,
    aiOpportunitiesLoading,
    aiOpportunitiesError,
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
    saveContact,
    updateContact,
    toggleContactFavorite,
    deleteContact,
    scanOpportunitiesWithAi,
    resetDemoData,
  };
}
