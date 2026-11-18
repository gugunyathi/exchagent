import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AgentActionHistoryEntry,
  AgentDoc,
  AutonomousMatchItem,
  NegotiationDoc,
  PasserbyHandshakeEvent,
  PaymentRail,
  PersonalContactDoc,
  ProximityPeerDoc,
  SettlementDoc,
} from '../types/firestore';
import { emitToast } from '../lib/toast';

const AUTOPILOT_STORAGE_KEY = 'switchz_network_autopilot_v1';

export interface NetworkAutopilotConfig {
  enabled: boolean;
  scanRadiusMeters: number;
  autoAddContacts: boolean;
  autoMatchIntents: boolean;
  autoNegotiateAndClose: boolean;
  requireTopicOverlap: boolean;
  roomCode: string;
}

export type AutopilotActivityKind =
  | 'broadcast'
  | 'contact_added'
  | 'intent_matched'
  | 'negotiated'
  | 'deal_closed'
  | 'error';

export interface NetworkAutopilotEvent {
  id: string;
  kind: AutopilotActivityKind;
  title: string;
  detail: string;
  targetHandle?: string;
  valueZAR?: number;
  timestamp: string;
}

export interface NetworkAutopilotStats {
  scansCompleted: number;
  peersInRange: number;
  contactsAdded: number;
  opportunitiesMatched: number;
  negotiationsRun: number;
  dealsClosed: number;
}

interface UseNetworkAutopilotParams {
  activeUserAgent: AgentDoc | null;
  userLocation: { lat: number; lng: number };
  onUpdateUserLocation: (coords: { lat: number; lng: number }) => void;
  negotiations: NegotiationDoc[];
  settlements: SettlementDoc[];
  onAutoAddPeers: (
    peers: ProximityPeerDoc[],
    opts: {
      scanRadiusMeters: number;
      myTopics: string[];
      requireTopicOverlap: boolean;
      roomCode: string;
    }
  ) => PersonalContactDoc[];
  onRunAutonomousIntentMatch: (
    sourceAgent: AgentDoc,
    livePeers?: ProximityPeerDoc[]
  ) => Promise<AutonomousMatchItem[] | null>;
  onSaveNegotiation: (neg: NegotiationDoc) => Promise<void> | void;
  onSettleDeal: (params: {
    sessionId: string;
    buyerHandle: string;
    sellerHandle: string;
    channel: string;
    stickerPriceZAR: number;
    agreedPriceZAR: number;
    rail: PaymentRail;
  }) => Promise<SettlementDoc>;
  onAddPasserbyEvent: (evt: PasserbyHandshakeEvent) => void;
  onLogAgentHistory: (entry: Omit<AgentActionHistoryEntry, 'id' | 'timestamp'>) => void;
}

const DEFAULT_CONFIG: NetworkAutopilotConfig = {
  enabled: false,
  scanRadiusMeters: 250,
  autoAddContacts: true,
  autoMatchIntents: true,
  autoNegotiateAndClose: true,
  requireTopicOverlap: false,
  roomCode: 'sandton-summit-2026',
};

function loadSavedConfig(): NetworkAutopilotConfig {
  try {
    const raw = localStorage.getItem(AUTOPILOT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NetworkAutopilotConfig>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        scanRadiusMeters:
          typeof parsed.scanRadiusMeters === 'number' && parsed.scanRadiusMeters >= 25
            ? parsed.scanRadiusMeters
            : DEFAULT_CONFIG.scanRadiusMeters,
        roomCode: parsed.roomCode?.trim() || DEFAULT_CONFIG.roomCode,
      };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_CONFIG;
}

export function useNetworkAutopilot({
  activeUserAgent,
  userLocation,
  onUpdateUserLocation,
  negotiations,
  settlements,
  onAutoAddPeers,
  onRunAutonomousIntentMatch,
  onSaveNegotiation,
  onSettleDeal,
  onAddPasserbyEvent,
  onLogAgentHistory,
}: UseNetworkAutopilotParams) {
  const [config, setConfig] = useState<NetworkAutopilotConfig>(() => loadSavedConfig());
  const [isScanning, setIsScanning] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'off' | 'watching' | 'fallback'>('off');
  const [wifiMeshConnected, setWifiMeshConnected] = useState(false);
  const [blePairedBeacon, setBlePairedBeacon] = useState<string | null>(null);
  const [headingDeg, setHeadingDeg] = useState<number>(38);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [nearbyPeers, setNearbyPeers] = useState<ProximityPeerDoc[]>([]);
  const [activityLog, setActivityLog] = useState<NetworkAutopilotEvent[]>([]);
  const [stats, setStats] = useState<NetworkAutopilotStats>({
    scansCompleted: 0,
    peersInRange: 0,
    contactsAdded: 0,
    opportunitiesMatched: 0,
    negotiationsRun: 0,
    dealsClosed: 0,
  });

  const bleSupported =
    typeof navigator !== 'undefined' &&
    Boolean((navigator as Navigator & { bluetooth?: unknown }).bluetooth);

  const cycleLockRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const negotiatedTargetsRef = useRef<Set<string>>(new Set());
  const wsPeersRef = useRef<ProximityPeerDoc[]>([]);

  const pushActivity = useCallback(
    (event: Omit<NetworkAutopilotEvent, 'id' | 'timestamp'>) => {
      const full: NetworkAutopilotEvent = {
        ...event,
        id: `ap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
      };
      setActivityLog((prev) => [full, ...prev].slice(0, 40));
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(AUTOPILOT_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore storage errors
    }
  }, [config]);

  const updateConfig = useCallback((patch: Partial<NetworkAutopilotConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const announcePresence = useCallback(
    async (active: boolean) => {
      if (!activeUserAgent) return;
      const myTopics = Array.from(
        new Set([
          ...(activeUserAgent.skills || []),
          ...(activeUserAgent.impliedIntent?.topics || []),
        ])
      );
      try {
        const res = await fetch('/api/proximity/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            active,
            id: `autopilot_${activeUserAgent.id}`,
            handle: activeUserAgent.handle,
            ownerUid: activeUserAgent.ownerUid,
            displayName: activeUserAgent.displayName,
            roleTitle: activeUserAgent.roleTitle,
            organization: activeUserAgent.organization,
            type: activeUserAgent.type,
            verified: activeUserAgent.verified,
            intent: activeUserAgent.type === 'business' ? 'hiring' : 'networking',
            skills: activeUserAgent.skills,
            impliedTopics: myTopics,
            summary: activeUserAgent.summary,
            imageUrl: activeUserAgent.imageUrl,
            brandLogoCode: activeUserAgent.brandLogoCode,
            brandColor: activeUserAgent.brandColor,
            cardStyle: activeUserAgent.cardStyle,
            voiceNumber: activeUserAgent.voiceNumber,
            agentEmail: activeUserAgent.agentEmail,
            locationLabel: `Live +Network (${config.roomCode})`,
            distanceMeters: 4,
            transport: 'same_wifi',
            roomCode: config.roomCode,
            lat: userLocation.lat,
            lng: userLocation.lng,
            headingDeg,
            broadcastRadiusMeters: config.scanRadiusMeters,
            scanRadiusMeters: config.scanRadiusMeters,
            incentive:
              activeUserAgent.passerbyIncentive ||
              activeUserAgent.impliedIntent?.headline ||
              'Open to autonomous networking & instant deals',
          }),
        });
        if (active && res.ok) {
          const data = await res.json();
          if (data?.peer) {
            broadcastChannelRef.current?.postMessage({ type: 'PEER_ANNOUNCE', peer: data.peer });
          }
        }
      } catch {
        // non-blocking
      }
    },
    [activeUserAgent, config.roomCode, config.scanRadiusMeters, headingDeg, userLocation.lat, userLocation.lng]
  );

  const runAutopilotCycle = useCallback(async () => {
    if (!activeUserAgent || cycleLockRef.current) return;
    cycleLockRef.current = true;
    setIsScanning(true);

    try {
      const myTopics = Array.from(
        new Set([
          ...(activeUserAgent.skills || []),
          ...(activeUserAgent.impliedIntent?.topics || []),
        ])
      );

      // 1. Broadcast live presence across Wi-Fi LAN, GPS & beacon mesh
      await announcePresence(true);

      // 2. Fetch nearby peers across Wi-Fi & BLE beacons within coords
      const params = new URLSearchParams({
        room: config.roomCode,
        selfHandle: activeUserAgent.handle,
        includeBeacons: 'true',
        lat: String(userLocation.lat),
        lng: String(userLocation.lng),
        heading: String(headingDeg),
      });

      let fetchedPeers: ProximityPeerDoc[] = [];
      try {
        const peersRes = await fetch(`/api/proximity/peers?${params.toString()}`);
        if (peersRes.ok) {
          const peersData = await peersRes.json();
          fetchedPeers = Array.isArray(peersData.peers) ? peersData.peers : [];
        }
      } catch {
        fetchedPeers = [];
      }

      // Merge server peers + WebSocket / BroadcastChannel peers
      const peerMap = new Map<string, ProximityPeerDoc>();
      for (const p of [...wsPeersRef.current, ...fetchedPeers]) {
        if (p.handle.toLowerCase() === activeUserAgent.handle.toLowerCase()) continue;
        peerMap.set(p.handle.toLowerCase(), p);
      }
      const allPeers = Array.from(peerMap.values());
      const peersWithinRadius = allPeers.filter(
        (p) => p.distanceMeters <= config.scanRadiusMeters
      );
      setNearbyPeers(peersWithinRadius);

      // Push live orientation update over WS if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'orientation_update',
            roomCode: config.roomCode,
            handle: activeUserAgent.handle,
            headingDeg,
            lat: userLocation.lat,
            lng: userLocation.lng,
            broadcastRadiusMeters: config.scanRadiusMeters,
            scanRadiusMeters: config.scanRadiusMeters,
            impliedTopics: myTopics,
          })
        );
      }

      // 3. Auto-Add nearby contacts matching intent & range
      let addedNow: PersonalContactDoc[] = [];
      if (config.autoAddContacts && peersWithinRadius.length > 0) {
        addedNow = onAutoAddPeers(peersWithinRadius, {
          scanRadiusMeters: config.scanRadiusMeters,
          myTopics,
          requireTopicOverlap: config.requireTopicOverlap,
          roomCode: config.roomCode,
        });

        for (const c of addedNow) {
          onAddPasserbyEvent({
            id: `evt_net_${c.id}`,
            agentHandle: activeUserAgent.handle,
            targetHandle: c.handle,
            locationLabel: c.sharedAtLocation || config.roomCode,
            distanceMeters: 12,
            matchScore: 95,
            summary: `+Network auto-added ${c.displayName} within ${config.scanRadiusMeters}m.`,
            kind: 'event_peer',
            timestamp: new Date().toISOString(),
          });

          fetch('/api/proximity/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fromHandle: activeUserAgent.handle,
              toHandle: c.handle,
              roomCode: config.roomCode,
              transport: c.source === 'event_wifi' ? 'same_wifi' : 'ble_beacon',
              mode: 'card_share',
            }),
          }).catch(() => {});

          pushActivity({
            kind: 'contact_added',
            title: `Added ${c.displayName}`,
            detail: `${c.roleTitle} · ${c.organization} saved within ${config.scanRadiusMeters}m`,
            targetHandle: c.handle,
          });
        }
      }

      // 4. Autonomously match open jobs, RFPs, and nearby peers against implied intent
      let matchedItems: AutonomousMatchItem[] = [];
      if (config.autoMatchIntents) {
        const result = await onRunAutonomousIntentMatch(activeUserAgent, peersWithinRadius);
        if (result && result.length > 0) {
          matchedItems = result;
          setStats((prev) => ({
            ...prev,
            opportunitiesMatched: Math.max(prev.opportunitiesMatched, result.length),
          }));
          if (prevActivityNeedsMatchSummary(activityLog)) {
            pushActivity({
              kind: 'intent_matched',
              title: `Matched ${result.length} opportunities per intents`,
              detail: `Top match: ${result[0].title} (${result[0].score}% fit)`,
              targetHandle: result[0].targetHandle,
            });
          }
        }
      }

      // 5. Autonomously negotiate & close 1 eligible commercial deal per cycle within guardrails
      let negotiatedCountDelta = 0;
      let closedCountDelta = 0;
      if (config.autoNegotiateAndClose && matchedItems.length > 0) {
        const maxSpend = activeUserAgent.guardrails?.maxAutoSpendZAR ?? 85000;
        const minDiscount = activeUserAgent.guardrails?.minDiscountPct ?? 10;

        const existingSettledPairs = new Set(
          settlements.map((s) => `${s.sellerHandle.toLowerCase()}::${s.buyerHandle.toLowerCase()}`)
        );
        const existingNegHandles = new Set(
          negotiations
            .filter(
              (n) =>
                n.initiatorHandle.toLowerCase() === activeUserAgent.handle.toLowerCase() &&
                (n.status === 'OFFER_ACCEPTED' || n.status === 'SETTLED')
            )
            .map((n) => n.targetHandle.toLowerCase())
        );

        const candidate = matchedItems.find((item) => {
          if (!item.targetHandle) return false;
          const tLower = item.targetHandle.toLowerCase();
          if (tLower === activeUserAgent.handle.toLowerCase() || tLower === '911.emergency.agent') {
            return false;
          }
          if (negotiatedTargetsRef.current.has(tLower) || existingNegHandles.has(tLower)) {
            return false;
          }
          if (existingSettledPairs.has(`${activeUserAgent.handle.toLowerCase()}::${tLower}`)) {
            return false;
          }
          const isCommercial =
            item.kind === 'rfp' ||
            item.recommendedAction === 'pitch_rfp' ||
            item.recommendedAction === 'engage';
          if (!isCommercial) return false;
          const sticker = item.valueZAR && item.valueZAR > 0 ? item.valueZAR : 24000;
          return sticker <= maxSpend * 1.15;
        });

        if (candidate) {
          const targetLower = candidate.targetHandle.toLowerCase();
          negotiatedTargetsRef.current.add(targetLower);
          const stickerPriceZAR =
            candidate.valueZAR && candidate.valueZAR > 0 ? candidate.valueZAR : 24000;

          try {
            const negRes = await fetch('/api/a2a/negotiate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                initiatorHandle: activeUserAgent.handle,
                targetHandle: candidate.targetHandle,
                proposalTitle: candidate.title,
                stickerPriceZAR,
                surface: 'spatial',
                targetMaxSpendZAR: maxSpend,
                targetMinDiscountPct: minDiscount,
              }),
            });

            if (negRes.ok) {
              const negData = await negRes.json();
              negotiatedCountDelta = 1;
              const sessionId = `neg_auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const agreedPriceZAR = Number(
                negData.agreedPriceZAR || Math.round(stickerPriceZAR * (1 - minDiscount / 100))
              );
              const accepted =
                negData.finalStatus === 'OFFER_ACCEPTED' && agreedPriceZAR <= maxSpend;

              const negDoc: NegotiationDoc = {
                id: sessionId,
                rfpId: candidate.rfpId,
                initiatorAgentId: activeUserAgent.id,
                initiatorOwnerUid: activeUserAgent.ownerUid,
                targetAgentId: candidate.id,
                targetOwnerUid: candidate.targetHandle,
                initiatorHandle: activeUserAgent.handle,
                targetHandle: candidate.targetHandle,
                surface: 'spatial',
                status: accepted ? 'OFFER_ACCEPTED' : 'REJECTED',
                stickerPriceZAR,
                currentOfferZAR: agreedPriceZAR,
                agreedPriceZAR: accepted ? agreedPriceZAR : undefined,
                messages: Array.isArray(negData.messages) ? negData.messages : [],
                popiaAuditHash:
                  negData.popiaAuditHash || `popia_sha256_${Math.random().toString(36).slice(2, 12)}`,
                updatedAt: new Date().toISOString(),
              };

              await onSaveNegotiation(negDoc);

              pushActivity({
                kind: 'negotiated',
                title: `Negotiated with ${candidate.targetName}`,
                detail: accepted
                  ? `Agreed R${agreedPriceZAR.toLocaleString('en-ZA')} (sticker R${stickerPriceZAR.toLocaleString('en-ZA')})`
                  : `Outside guardrails — declined safely`,
                targetHandle: candidate.targetHandle,
                valueZAR: agreedPriceZAR,
              });

              if (accepted) {
                await onSettleDeal({
                  sessionId,
                  buyerHandle: candidate.targetHandle,
                  sellerHandle: activeUserAgent.handle,
                  channel: 'spatial',
                  stickerPriceZAR,
                  agreedPriceZAR,
                  rail: 'x402_base',
                });
                closedCountDelta = 1;

                fetch('/api/proximity/exchange', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fromHandle: activeUserAgent.handle,
                    toHandle: candidate.targetHandle,
                    roomCode: config.roomCode,
                    transport: 'same_wifi',
                    mode: 'share_and_negotiate',
                  }),
                }).catch(() => {});

                onLogAgentHistory({
                  agentId: activeUserAgent.id,
                  agentHandle: activeUserAgent.handle,
                  actorType: activeUserAgent.type === 'business' ? 'company_agent' : 'personal_agent',
                  actorName: `${activeUserAgent.displayName} (+Network Autopilot)`,
                  actionType: 'AUTO_MATCH',
                  title: `Auto-Negotiated & Closed Deal with ${candidate.targetName}`,
                  details: `"${candidate.title}" negotiated and settled for R${agreedPriceZAR.toLocaleString('en-ZA')} within guardrails.`,
                  targetHandle: candidate.targetHandle,
                  channel: '+Network Autopilot',
                });

                pushActivity({
                  kind: 'deal_closed',
                  title: `Closed & settled deal with ${candidate.targetName}`,
                  detail: `R${agreedPriceZAR.toLocaleString('en-ZA')} via x402 · POPIA audit logged`,
                  targetHandle: candidate.targetHandle,
                  valueZAR: agreedPriceZAR,
                });

                emitToast(
                  `+Network closed deal with ${candidate.targetName} (R${agreedPriceZAR.toLocaleString('en-ZA')})`,
                  'success'
                );
              }
            }
          } catch {
            // keep scanning non-fatally
          }
        }
      }

      setLastScanAt(new Date().toISOString());
      setStats((prev) => ({
        scansCompleted: prev.scansCompleted + 1,
        peersInRange: peersWithinRadius.length,
        contactsAdded: prev.contactsAdded + addedNow.length,
        opportunitiesMatched: Math.max(prev.opportunitiesMatched, matchedItems.length),
        negotiationsRun: prev.negotiationsRun + negotiatedCountDelta,
        dealsClosed: prev.dealsClosed + closedCountDelta,
      }));
    } finally {
      cycleLockRef.current = false;
      setIsScanning(false);
    }
  }, [
    activeUserAgent,
    activityLog,
    announcePresence,
    config.autoAddContacts,
    config.autoMatchIntents,
    config.autoNegotiateAndClose,
    config.requireTopicOverlap,
    config.roomCode,
    config.scanRadiusMeters,
    headingDeg,
    negotiations,
    onAddPasserbyEvent,
    onAutoAddPeers,
    onLogAgentHistory,
    onRunAutonomousIntentMatch,
    onSaveNegotiation,
    onSettleDeal,
    pushActivity,
    settlements,
    userLocation.lat,
    userLocation.lng,
  ]);

  // Persistent background sensor, WebSocket, and autonomous scan loop whenever config.enabled is ON
  useEffect(() => {
    if (!config.enabled || !activeUserAgent) {
      setGpsStatus('off');
      setWifiMeshConnected(false);
      return;
    }

    // GPS watchPosition
    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setGpsStatus('watching');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          onUpdateUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)) {
            setHeadingDeg(Math.round(pos.coords.heading));
          }
          setGpsStatus('watching');
        },
        () => {
          setGpsStatus('fallback');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else {
      setGpsStatus('fallback');
    }

    // Real-time WebSocket /ws/mesh listener
    let closed = false;
    if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/mesh?room=${encodeURIComponent(config.roomCode)}`;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          if (!closed) setWifiMeshConnected(true);
        };
        ws.onclose = () => {
          if (!closed) setWifiMeshConnected(false);
        };
        ws.onerror = () => {
          if (!closed) setWifiMeshConnected(false);
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as {
              type?: string;
              peers?: ProximityPeerDoc[];
              peer?: ProximityPeerDoc;
            };
            if (msg.type === 'room_snapshot' && Array.isArray(msg.peers)) {
              wsPeersRef.current = msg.peers;
            } else if (msg.type === 'peer_upsert' && msg.peer) {
              wsPeersRef.current = [
                msg.peer,
                ...wsPeersRef.current.filter(
                  (p) => p.handle.toLowerCase() !== msg.peer!.handle.toLowerCase()
                ),
              ];
            }
          } catch {
            // ignore malformed ws frame
          }
        };
      } catch {
        setWifiMeshConnected(false);
      }
    }

    // BroadcastChannel listener
    let ch: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel('switchboard_event_mesh');
      broadcastChannelRef.current = ch;
      ch.onmessage = (event) => {
        const payload = event.data as { type?: string; peer?: ProximityPeerDoc };
        if (payload?.type === 'PEER_ANNOUNCE' && payload.peer) {
          wsPeersRef.current = [
            payload.peer,
            ...wsPeersRef.current.filter(
              (p) => p.handle.toLowerCase() !== payload.peer!.handle.toLowerCase()
            ),
          ];
        }
      };
    }

    // Compass heading passive listener if supported
    const onOrient = (evt: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const h =
        typeof evt.webkitCompassHeading === 'number'
          ? Math.round(evt.webkitCompassHeading)
          : typeof evt.alpha === 'number'
          ? Math.round((360 - evt.alpha) % 360)
          : null;
      if (h !== null && Number.isFinite(h)) {
        setHeadingDeg(((h % 360) + 360) % 360);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientation', onOrient as EventListener, true);
    }

    // Immediate scan + periodic cycle every 22s
    runAutopilotCycle();
    const timer = window.setInterval(() => {
      runAutopilotCycle();
    }, 22000);

    return () => {
      closed = true;
      window.clearInterval(timer);
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', onOrient as EventListener, true);
      }
      wsRef.current?.close();
      wsRef.current = null;
      ch?.close();
      broadcastChannelRef.current = null;
    };
    // Intentionally tied to config.enabled + roomCode + activeUserAgent?.id so it stays stable without thrashing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enabled, config.roomCode, activeUserAgent?.id]);

  const toggleEnabled = useCallback(() => {
    setConfig((prev) => {
      const nextEnabled = !prev.enabled;
      if (nextEnabled) {
        pushActivity({
          kind: 'broadcast',
          title: '+Network Autopilot activated',
          detail: `Scanning GPS, Wi-Fi & beacons within ${prev.scanRadiusMeters}m (${prev.roomCode})`,
        });
        emitToast(
          `+Network ON — ${activeUserAgent?.displayName || 'Your agent'} is scanning & closing deals in range`,
          'success'
        );
      } else {
        announcePresence(false);
        pushActivity({
          kind: 'broadcast',
          title: '+Network Autopilot paused',
          detail: 'Background scanning and auto-negotiation paused by user',
        });
        emitToast('+Network Autopilot paused', 'info');
      }
      return { ...prev, enabled: nextEnabled };
    });
  }, [activeUserAgent?.displayName, announcePresence, pushActivity]);

  const pairBleBeacon = useCallback(async () => {
    if (
      bleSupported &&
      (navigator as Navigator & {
        bluetooth?: { requestDevice: (opts: unknown) => Promise<{ name?: string }> };
      }).bluetooth
    ) {
      try {
        const bt = (
          navigator as Navigator & {
            bluetooth: { requestDevice: (opts: unknown) => Promise<{ name?: string }> };
          }
        ).bluetooth;
        const dev = await bt.requestDevice({ acceptAllDevices: true });
        const name = dev?.name || 'Nearby BLE Beacon';
        setBlePairedBeacon(name);
        emitToast(`Paired BLE beacon: ${name}`, 'success');
      } catch {
        emitToast('Completed Switchboard BLE beacon & Wi-Fi mesh sweep', 'info');
      }
    } else {
      emitToast('Completed Switchboard BLE beacon & Wi-Fi mesh sweep', 'info');
    }
    await runAutopilotCycle();
  }, [bleSupported, runAutopilotCycle]);

  return {
    config,
    updateConfig,
    toggleEnabled,
    isScanning,
    gpsStatus,
    wifiMeshConnected,
    bleSupported,
    blePairedBeacon,
    lastScanAt,
    nearbyPeers,
    activityLog,
    stats,
    runCycleNow: runAutopilotCycle,
    pairBleBeacon,
  };
}

function prevActivityNeedsMatchSummary(log: NetworkAutopilotEvent[]): boolean {
  if (log.length === 0) return true;
  return log[0].kind !== 'intent_matched';
}
