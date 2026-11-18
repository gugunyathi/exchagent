import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  Navigation,
  Radio,
  MapPin,
  Play,
  Square,
  Compass,
  ShieldAlert,
  Briefcase,
  Wifi,
  Bluetooth,
  Share2,
  BookmarkPlus,
  Check,
  Zap,
  Search,
  Users,
  Sparkles,
  LocateFixed,
} from 'lucide-react';
import {
  AgentDoc,
  RfpDoc,
  JobPostingDoc,
  PasserbyHandshakeEvent,
  DispatchedUnit,
  ProximityPeerDoc,
  ProximityIntent,
  ProximityTransport,
  ContactSource,
  PersonalContactDoc,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';
import { CITY_PRESETS } from '../data/seedData';
import { SwipeScrollArea } from './SwipeScrollArea';
import { useTheme } from '../lib/theme';
import { emitToast } from '../lib/toast';

interface SpatialMapsDiscoveryProps {
  agents: AgentDoc[];
  rfps: RfpDoc[];
  jobs: JobPostingDoc[];
  activeUserAgent: AgentDoc | null;
  savedContactHandles: Set<string>;
  userLocation: { lat: number; lng: number };
  onUpdateUserLocation: (loc: { lat: number; lng: number }) => void;
  passerbyEvents: PasserbyHandshakeEvent[];
  onAddPasserbyEvent: (evt: PasserbyHandshakeEvent) => void;
  dispatchedUnits: DispatchedUnit[];
  googleMapsApiKey: string;
  mapboxAccessToken?: string;
  currency: CurrencyMode;
  onEngageAgent: (agent: AgentDoc) => void;
  onEngageProposal?: (params: {
    targetHandle: string;
    proposalTitle?: string;
    stickerPriceZAR?: number;
  }) => void;
  onSaveContact: (
    card: Partial<AgentDoc> & Partial<ProximityPeerDoc> & { handle: string; displayName: string },
    meta: {
      source: ContactSource;
      sharedAtLocation?: string;
      eventName?: string;
      notes?: string;
    }
  ) => Promise<unknown>;
  onAutoAddPeers?: (
    peers: ProximityPeerDoc[],
    opts: {
      scanRadiusMeters: number;
      myTopics: string[];
      requireTopicOverlap: boolean;
      roomCode: string;
    }
  ) => PersonalContactDoc[];
  onApplyJobFromRadar?: (job: JobPostingDoc) => void;
}

type RadarMode = 'all' | 'jobs' | 'events';
type JobRemoteFilter = 'All' | 'Remote' | 'Hybrid' | 'On-Site';

interface MatchedSpatialJob {
  job: JobPostingDoc;
  companyAgent?: AgentDoc;
  matchScore: number;
  distanceMeters: number;
  matchedSkills: string[];
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Math.round(2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function angularDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function bearingBetweenCoords(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => ((r * 180) / Math.PI + 360) % 360;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dLam = toRad(b.lng - a.lng);
  const y = Math.sin(dLam) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  return Math.round(toDeg(Math.atan2(y, x)));
}

function scoreJobMatch(
  job: JobPostingDoc,
  seeker: AgentDoc | null,
  companyAgent: AgentDoc | undefined,
  userLocation: { lat: number; lng: number }
): MatchedSpatialJob {
  const seekerSkills = new Set(
    [...(seeker?.skills || []), ...(seeker?.cvSummary?.parsedSkills || [])].map((s) =>
      s.toLowerCase()
    )
  );
  const matchedSkills = job.requiredSkills.filter((req) => {
    const lower = req.toLowerCase();
    for (const sk of seekerSkills) {
      if (sk.includes(lower) || lower.includes(sk)) return true;
    }
    return false;
  });

  const skillRatio =
    job.requiredSkills.length > 0 ? matchedSkills.length / job.requiredSkills.length : 0.6;
  const distMeters = companyAgent?.geoLocation
    ? haversineMeters(userLocation, companyAgent.geoLocation)
    : 320;
  const proximityBonus = distMeters <= 2500 ? 12 : distMeters <= 8000 ? 7 : 3;
  const baseScore = Math.round(62 + skillRatio * 26 + proximityBonus);

  return {
    job,
    companyAgent,
    matchScore: Math.min(99, Math.max(64, baseScore)),
    distanceMeters: distMeters,
    matchedSkills,
  };
}

const LiveGoogleMapCanvas: React.FC<{
  center: { lat: number; lng: number };
  agents: AgentDoc[];
  rfps: RfpDoc[];
  peers: ProximityPeerDoc[];
  userLocation: { lat: number; lng: number };
  isDark: boolean;
  onFallback: (reason: string) => void;
  onSelectAgent: (a: AgentDoc) => void;
}> = ({ center, agents, rfps, peers, userLocation, isDark, onFallback, onSelectAgent }) => {
  const status = useApiLoadingStatus();
  const [selectedAgent, setSelectedAgent] = useState<AgentDoc | null>(null);
  const triggeredRef = useRef(false);

  const triggerFallback = useCallback(
    (reason: string) => {
      if (triggeredRef.current) return;
      triggeredRef.current = true;
      onFallback(reason);
    },
    [onFallback]
  );

  useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
      triggerFallback(
        status === APILoadingStatus.AUTH_FAILURE
          ? 'Google Maps API authorization failed'
          : 'Google Maps failed to load'
      );
    }
  }, [status, triggerFallback]);

  useEffect(() => {
    const win = window as Window & { gm_authFailure?: () => void };
    const prevAuthFailure = win.gm_authFailure;
    win.gm_authFailure = () => {
      triggerFallback('Google Maps authentication error');
      if (typeof prevAuthFailure === 'function') {
        prevAuthFailure();
      }
    };

    const onQuotaExceeded = () => {
      triggerFallback('Google Maps quota exceeded');
    };
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);

    const watchdog = window.setTimeout(() => {
      if (status !== APILoadingStatus.LOADED) {
        triggerFallback('Google Maps connection timed out');
      }
    }, 8000);

    return () => {
      window.clearTimeout(watchdog);
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
      win.gm_authFailure = prevAuthFailure;
    };
  }, [status, triggerFallback]);

  return (
    <div className="w-full h-[270px] sm:h-[380px] lg:h-[460px] rounded-xl overflow-hidden border border-zinc-300 dark:border-white/10 relative">
      <GoogleMap
        defaultCenter={center}
        center={center}
        defaultZoom={13}
        mapId="DEMO_MAP_ID"
        colorScheme={isDark ? 'DARK' : 'LIGHT'}
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={userLocation} title="Your Personal Agent">
          <div className="w-4 h-4 rounded-full bg-sky-500 dark:bg-sky-400 border-2 border-white dark:border-zinc-950 shadow-md" />
        </AdvancedMarker>

        {agents
          .filter((a) => a.geoLocation && a.handle !== '911.emergency.agent')
          .map((agent) => (
            <AdvancedMarker
              key={agent.id}
              position={{ lat: agent.geoLocation!.lat, lng: agent.geoLocation!.lng }}
              onClick={() => setSelectedAgent(agent)}
              title={agent.handle}
            >
              <div className="px-2 py-1 rounded-md bg-white/95 dark:bg-zinc-950/90 border border-emerald-500/60 dark:border-emerald-400/50 text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-200 shadow-md">
                {agent.handle}
              </div>
            </AdvancedMarker>
          ))}

        {rfps
          .filter((r) => r.location)
          .map((rfp) => (
            <AdvancedMarker
              key={rfp.id}
              position={{ lat: rfp.location!.lat, lng: rfp.location!.lng }}
              title={rfp.title}
            >
              <div className="px-2 py-1 rounded-md bg-white/95 dark:bg-zinc-950/90 border border-amber-500/60 dark:border-amber-400/50 text-[10px] font-mono font-semibold text-amber-800 dark:text-amber-200 shadow-md">
                DOOH · {rfp.location!.billboardName?.slice(0, 18) || 'RFP'}
              </div>
            </AdvancedMarker>
          ))}

        {peers
          .filter((p) => p.lat !== undefined && p.lng !== undefined)
          .map((peer) => (
            <AdvancedMarker
              key={`map_peer_${peer.id}`}
              position={{ lat: peer.lat! + 0.0012, lng: peer.lng! + 0.0012 }}
              title={`${peer.displayName} (${peer.transport})`}
            >
              <div className="px-2 py-0.5 rounded-md bg-sky-600 text-white border border-white/40 text-[10px] font-mono font-semibold shadow-md">
                {peer.sameWifi ? 'Wi-Fi' : 'BLE'} · {peer.handle.replace('.agent', '')}
              </div>
            </AdvancedMarker>
          ))}

        {selectedAgent && selectedAgent.geoLocation && (
          <InfoWindow
            position={{ lat: selectedAgent.geoLocation.lat, lng: selectedAgent.geoLocation.lng }}
            onCloseClick={() => setSelectedAgent(null)}
          >
            <div className="text-zinc-900 p-1 max-w-xs">
              <p className="font-mono text-xs font-bold">{selectedAgent.handle}</p>
              <p className="text-xs font-semibold mt-0.5">{selectedAgent.displayName}</p>
              {selectedAgent.passerbyIncentive && (
                <p className="text-[11px] text-emerald-700 mt-1">{selectedAgent.passerbyIncentive}</p>
              )}
              <button
                onClick={() => onSelectAgent(selectedAgent)}
                className="mt-2 px-2.5 py-1 rounded bg-zinc-900 text-white text-[11px] font-medium"
              >
                Engage Agent
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

const LiveMapboxCanvas: React.FC<{
  accessToken: string;
  center: { lat: number; lng: number };
  agents: AgentDoc[];
  rfps: RfpDoc[];
  peers: ProximityPeerDoc[];
  userLocation: { lat: number; lng: number };
  isDark: boolean;
  isBroadcasting: boolean;
  currency: CurrencyMode;
  fallbackReason: string | null;
  canRetryGoogle: boolean;
  onRetryGoogle: () => void;
  onFallback: (reason: string) => void;
  onSelectNode: (agent: AgentDoc) => void;
  onSelectPeer: (peer: ProximityPeerDoc) => void;
}> = ({
  accessToken,
  center,
  agents,
  rfps,
  peers,
  userLocation,
  isDark,
  isBroadcasting,
  currency,
  fallbackReason,
  canRetryGoogle,
  onRetryGoogle,
  onFallback,
  onSelectNode,
  onSelectPeer,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const styleRef = useRef<string>('');
  const fallbackCalledRef = useRef(false);

  const safeFallback = useCallback(
    (reason: string) => {
      if (fallbackCalledRef.current) return;
      fallbackCalledRef.current = true;
      onFallback(reason);
    },
    [onFallback]
  );

  // Initialize Mapbox GL map
  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapboxgl.supported()) {
      safeFallback('WebGL unavailable for Mapbox — switched to Vector Radar');
      return;
    }

    mapboxgl.accessToken = accessToken;
    const styleUrl = isDark
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11';
    styleRef.current = styleUrl;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [center.lng, center.lat],
        zoom: 12.6,
        attributionControl: true,
      });
    } catch {
      safeFallback('Mapbox initialization failed — switched to Vector Radar');
      return;
    }

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('error', (evt) => {
      const errObj = evt as { error?: { status?: number; message?: string } };
      const status = errObj?.error?.status;
      const msg = String(errObj?.error?.message || '').toLowerCase();
      if (
        status === 401 ||
        status === 403 ||
        msg.includes('access token') ||
        msg.includes('unauthorized') ||
        msg.includes('forbidden')
      ) {
        safeFallback('Mapbox token rejected — switched to Vector Radar');
      }
    });

    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Intentionally initialize once per accessToken; center/style updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, safeFallback]);

  // Update center smoothly on city switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [center.lng, center.lat], zoom: 12.6, duration: 650 });
  }, [center.lat, center.lng]);

  // Update theme style on Light/Dark switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyle = isDark
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11';
    if (styleRef.current && styleRef.current !== nextStyle) {
      styleRef.current = nextStyle;
      map.setStyle(nextStyle);
    }
  }, [isDark]);

  // Render interactive DOM markers on Mapbox canvas
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. User location dot
    const userEl = document.createElement('div');
    userEl.className = 'flex flex-col items-center pointer-events-none';
    const dot = document.createElement('div');
    dot.className =
      'w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow-md ring-4 ring-sky-500/25';
    const userTag = document.createElement('span');
    userTag.className =
      'mt-1 px-1.5 py-0.5 rounded bg-white/95 dark:bg-zinc-950/95 border border-zinc-300 dark:border-white/20 text-[10px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 shadow-sm whitespace-nowrap';
    userTag.textContent = isBroadcasting ? 'Broadcasting' : 'You';
    userEl.appendChild(dot);
    userEl.appendChild(userTag);
    markersRef.current.push(
      new mapboxgl.Marker({ element: userEl })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map)
    );

    // 2. Discoverable Agent Nodes
    agents
      .filter((a) => a.geoLocation && a.handle !== '911.emergency.agent')
      .forEach((agent) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className =
          'px-2 py-1 rounded-md bg-white/95 dark:bg-zinc-950/95 border border-emerald-500/70 text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-200 shadow-md hover:scale-105 transition-transform cursor-pointer whitespace-nowrap';
        el.textContent = agent.handle;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectNode(agent);
        });
        markersRef.current.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([agent.geoLocation!.lng, agent.geoLocation!.lat])
            .addTo(map)
        );
      });

    // 3. DOOH RFP Geofences
    rfps
      .filter((r) => r.location)
      .forEach((rfp) => {
        const el = document.createElement('div');
        el.className =
          'px-2 py-0.5 rounded bg-white/95 dark:bg-zinc-950/90 border border-amber-500/70 text-[10px] font-mono font-semibold text-amber-800 dark:text-amber-200 shadow-sm whitespace-nowrap';
        el.textContent = `DOOH · ${formatMoney(rfp.budgetZAR, currency)}`;
        markersRef.current.push(
          new mapboxgl.Marker({ element: el, offset: [0, 22] })
            .setLngLat([rfp.location!.lng, rfp.location!.lat])
            .addTo(map)
        );
      });

    // 4. Wi-Fi & BLE Event Mesh Peers
    peers
      .filter((p) => p.lat !== undefined && p.lng !== undefined)
      .forEach((peer) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className =
          'px-1.5 py-0.5 rounded bg-sky-600 text-white border border-white/40 text-[10px] font-mono font-semibold shadow-md hover:bg-sky-500 transition-colors cursor-pointer whitespace-nowrap';
        el.textContent = `${peer.sameWifi ? 'Wi-Fi' : 'BLE'} · ${peer.handle.replace('.agent', '')}`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectPeer(peer);
        });
        markersRef.current.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng! + 0.0012, peer.lat! + 0.0012])
            .addTo(map)
        );
      });
  }, [agents, rfps, peers, userLocation, isBroadcasting, currency, onSelectNode, onSelectPeer]);

  return (
    <div className="w-full h-[270px] sm:h-[380px] lg:h-[460px] rounded-xl overflow-hidden border border-zinc-300 dark:border-white/10 relative">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-60px)]">
        <span className="rounded-lg bg-white/95 dark:bg-zinc-950/90 border border-zinc-300 dark:border-white/15 px-2.5 py-1 text-[11px] font-mono font-semibold text-zinc-900 dark:text-zinc-100 shadow-sm">
          {fallbackReason ? `Mapbox Backup (${fallbackReason})` : 'Mapbox Live'}
        </span>
        {canRetryGoogle && fallbackReason && (
          <button
            type="button"
            onClick={onRetryGoogle}
            className="rounded-lg bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 px-2.5 py-1 text-[11px] font-semibold shadow-sm hover:opacity-90"
          >
            Retry Google
          </button>
        )}
      </div>
    </div>
  );
};

type MapProviderMode = 'auto' | 'google' | 'mapbox' | 'vector';

export const SpatialMapsDiscovery: React.FC<SpatialMapsDiscoveryProps> = ({
  agents,
  rfps,
  jobs,
  activeUserAgent,
  savedContactHandles,
  userLocation,
  onUpdateUserLocation,
  passerbyEvents,
  onAddPasserbyEvent,
  dispatchedUnits,
  googleMapsApiKey,
  mapboxAccessToken = '',
  currency,
  onEngageAgent,
  onEngageProposal,
  onSaveContact,
  onAutoAddPeers,
  onApplyJobFromRadar,
}) => {
  const { isDark } = useTheme();
  const [radarMode, setRadarMode] = useState<RadarMode>('all');
  const [selectedCityId, setSelectedCityId] = useState('jhb');
  const [mapCenter, setMapCenter] = useState(CITY_PRESETS[0]);
  const [preferredProvider, setPreferredProvider] = useState<MapProviderMode>('auto');
  const [googleFailed, setGoogleFailed] = useState(false);
  const [mapboxFailed, setMapboxFailed] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AgentDoc | null>(null);
  const matchedSetRef = useRef<Set<string>>(new Set());

  // Job Radar Search State
  const [jobQuery, setJobQuery] = useState('');
  const [jobRemoteFilter, setJobRemoteFilter] = useState<JobRemoteFilter>('All');

  // Event Wi-Fi & Bluetooth Proximity Mesh State + Bi-Directional Compass/Gyro + Radius
  const nonEmergencyAgents = useMemo(
    () => agents.filter((a) => a.handle !== '911.emergency.agent'),
    [agents]
  );
  const [broadcastAgentHandle, setBroadcastAgentHandle] = useState<string>(
    activeUserAgent?.handle || nonEmergencyAgents[0]?.handle || 'alex.founder.agent'
  );
  const [eventRoom, setEventRoom] = useState<string>('sandton-summit-2026');
  const [eventIntent, setEventIntent] = useState<ProximityIntent>('networking');
  const [transportMode, setTransportMode] = useState<ProximityTransport>('same_wifi');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [scanningMesh, setScanningMesh] = useState(false);
  const [discoveredPeers, setDiscoveredPeers] = useState<ProximityPeerDoc[]>([]);
  const [meshStatusLabel, setMeshStatusLabel] = useState<string>('Ready to scan Wi-Fi & BLE mesh');
  const [wsConnected, setWsConnected] = useState(false);
  const [bleSupported] = useState<boolean>(
    typeof navigator !== 'undefined' && 'bluetooth' in navigator
  );

  // Compass / Gyroscope / Live GPS / Radius Controls
  const [headingDeg, setHeadingDeg] = useState<number>(35);
  const [pitchDeg, setPitchDeg] = useState<number>(12);
  const [rollDeg, setRollDeg] = useState<number>(0);
  const [gyroEnabled, setGyroEnabled] = useState<boolean>(false);
  const [gpsLiveEnabled, setGpsLiveEnabled] = useState<boolean>(false);
  const [broadcastRadiusMeters, setBroadcastRadiusMeters] = useState<number>(
    activeUserAgent?.geoLocation?.radiusMeters || 120
  );
  const [scanRadiusMeters, setScanRadiusMeters] = useState<number>(
    activeUserAgent?.impliedIntent?.maxDistanceMeters || 150
  );
  const [autoAddWithinRadius, setAutoAddWithinRadius] = useState<boolean>(
    activeUserAgent?.impliedIntent?.autoAddProximityContacts ?? false
  );
  const [requireIntentMatch, setRequireIntentMatch] = useState<boolean>(
    activeUserAgent?.impliedIntent?.requireTopicOverlapForAutoAdd ?? false
  );

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const activeMapEngine: 'google' | 'mapbox' | 'vector' = useMemo(() => {
    if (dispatchedUnits.length > 0) return 'vector';
    if (preferredProvider === 'vector') return 'vector';
    if (preferredProvider === 'mapbox' && mapboxAccessToken && !mapboxFailed) return 'mapbox';
    if (preferredProvider === 'google' && googleMapsApiKey && !googleFailed) return 'google';
    if (googleMapsApiKey && !googleFailed) return 'google';
    if (mapboxAccessToken && !mapboxFailed) return 'mapbox';
    return 'vector';
  }, [
    dispatchedUnits.length,
    preferredProvider,
    googleMapsApiKey,
    googleFailed,
    mapboxAccessToken,
    mapboxFailed,
  ]);

  const handleGoogleFallback = useCallback(
    (reason: string) => {
      setGoogleFailed(true);
      setFallbackReason(reason);
      if (preferredProvider === 'google') setPreferredProvider('auto');
      emitToast(
        mapboxAccessToken && !mapboxFailed
          ? `${reason} — switched to Mapbox backup`
          : `${reason} — switched to Vector Radar`,
        'warning'
      );
    },
    [mapboxAccessToken, mapboxFailed, preferredProvider]
  );

  const handleMapboxFallback = useCallback(
    (reason: string) => {
      setMapboxFailed(true);
      if (preferredProvider === 'mapbox') setPreferredProvider('auto');
      emitToast(reason, 'warning');
    },
    [preferredProvider]
  );

  const broadcastAgent = useMemo(
    () => nonEmergencyAgents.find((a) => a.handle === broadcastAgentHandle) || nonEmergencyAgents[0],
    [nonEmergencyAgents, broadcastAgentHandle]
  );

  // Nearby job search matching
  const matchedJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    return jobs
      .filter((j) => j.status === 'OPEN')
      .filter((j) => jobRemoteFilter === 'All' || j.remoteMode === jobRemoteFilter)
      .filter((j) => {
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          j.companyName.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          j.requiredSkills.some((s) => s.toLowerCase().includes(q))
        );
      })
      .map((j) => {
        const companyAgent = agents.find((a) => a.handle === j.companyAgentHandle);
        return scoreJobMatch(j, activeUserAgent, companyAgent, userLocation);
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [jobs, jobQuery, jobRemoteFilter, agents, activeUserAgent, userLocation]);

  const broadcastIntentTopics = useMemo(
    () =>
      Array.from(
        new Set([
          ...(broadcastAgent?.skills || []),
          ...(broadcastAgent?.impliedIntent?.topics || []),
        ])
      ),
    [broadcastAgent]
  );

  // Enrich discovered peers with real-time bi-directional compass bearing lock & intent topic overlap
  const telemetryPeers = useMemo(() => {
    const myTopicsLower = broadcastIntentTopics.map((t) => t.toLowerCase());
    return discoveredPeers.map((peer) => {
      const hasCoords =
        typeof peer.lat === 'number' &&
        typeof peer.lng === 'number' &&
        (Math.abs(userLocation.lat - peer.lat) > 0.00001 || Math.abs(userLocation.lng - peer.lng) > 0.00001);
      const relBearing = hasCoords
        ? bearingBetweenCoords(userLocation, { lat: peer.lat!, lng: peer.lng! })
        : peer.relativeBearingDeg ?? ((headingDeg + 180) % 360);
      const reverseBearing = hasCoords
        ? bearingBetweenCoords({ lat: peer.lat!, lng: peer.lng! }, userLocation)
        : (relBearing + 180) % 360;
      const peerHeading = peer.headingDeg;
      const mutualLock =
        typeof peerHeading === 'number'
          ? angularDiff(headingDeg, relBearing) <= 48 &&
            angularDiff(peerHeading, reverseBearing) <= 48 &&
            peer.distanceMeters <= Math.max(scanRadiusMeters, broadcastRadiusMeters)
          : false;

      const peerText = [
        peer.roleTitle,
        peer.summary || '',
        ...(peer.skills || []),
        ...(peer.impliedTopics || []),
      ]
        .join(' ')
        .toLowerCase();
      const topicHits = myTopicsLower.filter((t) => t.length >= 2 && peerText.includes(t));

      return {
        ...peer,
        relativeBearingDeg: relBearing,
        mutualBearingLock: mutualLock,
        matchedScore: Math.min(99, (peer.matchedScore || 88) + (mutualLock ? 5 : 0) + topicHits.length * 2),
      };
    });
  }, [discoveredPeers, userLocation, headingDeg, scanRadiusMeters, broadcastRadiusMeters, broadcastIntentTopics]);

  // Fetch nearby peers from Wi-Fi / Event Mesh server
  const fetchEventPeers = useCallback(async () => {
    setScanningMesh(true);
    try {
      const params = new URLSearchParams({
        room: eventRoom,
        selfHandle: broadcastAgentHandle,
        includeBeacons: 'true',
        lat: String(userLocation.lat),
        lng: String(userLocation.lng),
        heading: String(headingDeg),
      });
      const res = await fetch(`/api/proximity/peers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const serverPeers: ProximityPeerDoc[] = Array.isArray(data.peers) ? data.peers : [];
        setDiscoveredPeers((prev) => {
          const map = new Map<string, ProximityPeerDoc>();
          prev.filter((p) => p.transport === 'web_bluetooth').forEach((p) => map.set(p.handle, p));
          serverPeers.forEach((p) => map.set(p.handle, p));
          return Array.from(map.values());
        });
        setMeshStatusLabel(
          `Synced ${data.callerSubnet || 'Wi-Fi LAN'} · ${serverPeers.length} cards in room`
        );
      }
    } catch {
      setMeshStatusLabel('Event mesh offline — showing cached local peers');
    } finally {
      setScanningMesh(false);
    }
  }, [eventRoom, broadcastAgentHandle, userLocation.lat, userLocation.lng, headingDeg]);

  useEffect(() => {
    fetchEventPeers();
  }, [fetchEventPeers]);

  // Real-time WebSocket /ws/mesh sync
  useEffect(() => {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/mesh?room=${encodeURIComponent(eventRoom)}`;
    let closed = false;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!closed) setWsConnected(true);
      };
      ws.onclose = () => {
        if (!closed) setWsConnected(false);
      };
      ws.onerror = () => {
        if (!closed) setWsConnected(false);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type?: string;
            peers?: ProximityPeerDoc[];
            peer?: ProximityPeerDoc;
            handle?: string;
          };
          if (msg.type === 'room_snapshot' && Array.isArray(msg.peers)) {
            setDiscoveredPeers((prev) => {
              const map = new Map<string, ProximityPeerDoc>();
              prev.forEach((p) => map.set(p.handle.toLowerCase(), p));
              msg.peers!.forEach((p) => {
                if (p.handle.toLowerCase() !== broadcastAgentHandle.toLowerCase()) {
                  map.set(p.handle.toLowerCase(), p);
                }
              });
              return Array.from(map.values());
            });
          } else if (msg.type === 'peer_upsert' && msg.peer) {
            const incoming = msg.peer;
            if (incoming.handle.toLowerCase() === broadcastAgentHandle.toLowerCase()) return;
            setDiscoveredPeers((prev) => {
              const others = prev.filter((p) => p.handle.toLowerCase() !== incoming.handle.toLowerCase());
              return [incoming, ...others];
            });
          } else if (msg.type === 'peer_removed' && msg.handle) {
            setDiscoveredPeers((prev) =>
              prev.filter((p) => p.handle.toLowerCase() !== msg.handle!.toLowerCase())
            );
          }
        } catch {
          // ignore invalid frame
        }
      };
    } catch {
      setWsConnected(false);
    }

    return () => {
      closed = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [eventRoom, broadcastAgentHandle]);

  // Live DeviceOrientationEvent Compass & Gyroscope Sensor Listener
  useEffect(() => {
    if (!gyroEnabled || typeof window === 'undefined') return;
    const handleOrientation = (evt: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const nextHeading =
        typeof evt.webkitCompassHeading === 'number'
          ? Math.round(evt.webkitCompassHeading)
          : typeof evt.alpha === 'number'
          ? Math.round((360 - evt.alpha) % 360)
          : null;
      if (nextHeading !== null && Number.isFinite(nextHeading)) {
        setHeadingDeg(((nextHeading % 360) + 360) % 360);
      }
      if (typeof evt.beta === 'number' && Number.isFinite(evt.beta)) {
        setPitchDeg(Math.max(-90, Math.min(90, Math.round(evt.beta))));
      }
      if (typeof evt.gamma === 'number' && Number.isFinite(evt.gamma)) {
        setRollDeg(Math.max(-90, Math.min(90, Math.round(evt.gamma))));
      }
    };
    window.addEventListener('deviceorientation', handleOrientation as EventListener, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation as EventListener, true);
    };
  }, [gyroEnabled]);

  const handleToggleGyro = async () => {
    if (gyroEnabled) {
      setGyroEnabled(false);
      return;
    }
    const DevOrient = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> })
      | undefined;
    if (DevOrient && typeof DevOrient.requestPermission === 'function') {
      try {
        const perm = await DevOrient.requestPermission();
        if (perm !== 'granted') {
          emitToast('Compass/Gyro sensor permission denied — use manual azimuth dial.', 'warning');
          return;
        }
      } catch {
        emitToast('Using desktop interactive compass & gyro simulator.', 'info');
      }
    }
    setGyroEnabled(true);
    emitToast('Compass & Gyroscope sensor stream active', 'success');
  };

  // Real-time GPS watchPosition when Live GPS toggled ON
  useEffect(() => {
    if (!gpsLiveEnabled || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onUpdateUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)) {
          setHeadingDeg(Math.round(pos.coords.heading));
        }
      },
      () => {
        emitToast('GPS unavailable in browser — using room coordinates.', 'info');
        setGpsLiveEnabled(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsLiveEnabled, onUpdateUserLocation]);

  // Broadcast orientation & radius updates live over WebSocket while broadcasting
  useEffect(() => {
    if (!isBroadcasting || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'orientation_update',
        roomCode: eventRoom,
        handle: broadcastAgentHandle,
        headingDeg,
        pitchDeg,
        rollDeg,
        lat: userLocation.lat,
        lng: userLocation.lng,
        broadcastRadiusMeters,
        scanRadiusMeters,
        impliedTopics: broadcastIntentTopics,
      })
    );
  }, [
    isBroadcasting,
    eventRoom,
    broadcastAgentHandle,
    headingDeg,
    pitchDeg,
    rollDeg,
    userLocation.lat,
    userLocation.lng,
    broadcastRadiusMeters,
    scanRadiusMeters,
    broadcastIntentTopics,
  ]);

  // Autonomous Auto-Add Contacts within Scan Radius
  useEffect(() => {
    if (!autoAddWithinRadius || !onAutoAddPeers || telemetryPeers.length === 0) return;
    const added = onAutoAddPeers(telemetryPeers, {
      scanRadiusMeters,
      myTopics: broadcastIntentTopics,
      requireTopicOverlap: requireIntentMatch,
      roomCode: eventRoom,
    });
    if (added.length > 0) {
      added.forEach((c) => {
        onAddPasserbyEvent({
          id: `evt_autoadd_${c.id}`,
          agentHandle: broadcastAgentHandle,
          targetHandle: c.handle,
          locationLabel: c.sharedAtLocation || eventRoom,
          distanceMeters: 8,
          matchScore: 95,
          summary: `Auto-added ${c.displayName} within ${scanRadiusMeters}m scan radius.`,
          kind: 'event_peer',
          timestamp: new Date().toISOString(),
        });
      });
    }
  }, [
    autoAddWithinRadius,
    onAutoAddPeers,
    telemetryPeers,
    scanRadiusMeters,
    broadcastIntentTopics,
    requireIntentMatch,
    eventRoom,
    broadcastAgentHandle,
    onAddPasserbyEvent,
  ]);

  // Cross-tab BroadcastChannel for instant zero-latency local card broadcasting
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('switchboard_event_mesh');
    broadcastChannelRef.current = ch;
    ch.onmessage = (event) => {
      const payload = event.data as { type?: string; peer?: ProximityPeerDoc };
      if (payload?.type === 'PEER_ANNOUNCE' && payload.peer) {
        const peer = payload.peer;
        if (peer.handle.toLowerCase() === broadcastAgentHandle.toLowerCase()) return;
        setDiscoveredPeers((prev) => {
          const others = prev.filter((p) => p.handle.toLowerCase() !== peer.handle.toLowerCase());
          return [peer, ...others];
        });
      }
    };
    return () => {
      ch.close();
      broadcastChannelRef.current = null;
    };
  }, [broadcastAgentHandle]);

  const handleToggleBroadcast = async () => {
    if (!broadcastAgent) return;
    const nextActive = !isBroadcasting;
    setIsBroadcasting(nextActive);

    try {
      const res = await fetch('/api/proximity/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: nextActive,
          id: `live_${broadcastAgent.id}`,
          handle: broadcastAgent.handle,
          ownerUid: broadcastAgent.ownerUid,
          displayName: broadcastAgent.displayName,
          roleTitle: broadcastAgent.roleTitle,
          organization: broadcastAgent.organization,
          type: broadcastAgent.type,
          verified: broadcastAgent.verified,
          intent: eventIntent,
          skills: broadcastAgent.skills,
          impliedTopics: broadcastIntentTopics,
          summary: broadcastAgent.summary,
          imageUrl: broadcastAgent.imageUrl,
          brandLogoCode: broadcastAgent.brandLogoCode,
          brandColor: broadcastAgent.brandColor,
          cardStyle: broadcastAgent.cardStyle,
          voiceNumber: broadcastAgent.voiceNumber,
          agentEmail: broadcastAgent.agentEmail,
          locationLabel: `${mapCenter.name} · Event Room ${eventRoom}`,
          distanceMeters: 4,
          transport: transportMode,
          roomCode: eventRoom,
          lat: userLocation.lat,
          lng: userLocation.lng,
          headingDeg,
          pitchDeg,
          rollDeg,
          broadcastRadiusMeters,
          scanRadiusMeters,
          incentive: broadcastAgent.passerbyIncentive || `Open for ${eventIntent}`,
        }),
      });
      const data = await res.json();
      if (nextActive && data?.peer) {
        broadcastChannelRef.current?.postMessage({ type: 'PEER_ANNOUNCE', peer: data.peer });
        emitToast(`Broadcasting ${broadcastAgent.handle} (${broadcastRadiusMeters}m radius) on ${eventRoom}`, 'success');
      } else {
        emitToast(`Stopped broadcasting ${broadcastAgent.handle}`, 'info');
      }
      fetchEventPeers();
    } catch {
      emitToast('Could not reach proximity mesh endpoint', 'warning');
    }
  };

  const handleBluetoothBeaconScan = async () => {
    setScanningMesh(true);
    let hardwareDeviceName: string | null = null;
    if (bleSupported && (navigator as Navigator & { bluetooth?: { requestDevice: (opts: unknown) => Promise<{ name?: string }> } }).bluetooth) {
      try {
        const bt = (navigator as Navigator & { bluetooth: { requestDevice: (opts: unknown) => Promise<{ name?: string }> } }).bluetooth;
        const dev = await bt.requestDevice({ acceptAllDevices: true });
        hardwareDeviceName = dev?.name || 'Nearby BLE Beacon';
      } catch {
        // User cancelled or iframe permission policy restricts hardware chooser; continue with Switchboard BLE beacon sweep
      }
    }

    await fetchEventPeers();
    if (hardwareDeviceName) {
      emitToast(`Paired BLE beacon: ${hardwareDeviceName}`, 'success');
    } else {
      emitToast('Completed Switchboard 50m BLE & Wi-Fi proximity sweep', 'info');
    }
    setScanningMesh(false);
  };

  const handleShareAndNegotiatePeer = async (peer: ProximityPeerDoc, mode: 'card_share' | 'share_and_negotiate') => {
    const source: ContactSource =
      peer.transport === 'same_wifi' ? 'event_wifi' : 'event_ble';

    await onSaveContact(peer, {
      source,
      sharedAtLocation: peer.locationLabel,
      eventName: eventRoom,
      notes: peer.incentive ? `Event offer: ${peer.incentive}` : undefined,
    });

    try {
      await fetch('/api/proximity/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromHandle: broadcastAgentHandle,
          toHandle: peer.handle,
          roomCode: eventRoom,
          transport: peer.transport,
          mode,
        }),
      });
    } catch {
      // ignore network error; contact is already saved locally
    }

    onAddPasserbyEvent({
      id: `evt_share_${Date.now()}`,
      agentHandle: broadcastAgentHandle,
      targetHandle: peer.handle,
      locationLabel: `${peer.locationLabel} (${peer.sameWifi ? 'Same Wi-Fi' : 'BLE'})`,
      distanceMeters: peer.distanceMeters,
      matchScore: peer.matchedScore || 94,
      summary:
        mode === 'share_and_negotiate'
          ? `Exchanged agent cards & initiated negotiation with ${peer.displayName}.`
          : `Exchanged .agent card with ${peer.displayName} — saved to Contacts.`,
      incentive: peer.incentive,
      kind: 'event_peer',
      timestamp: new Date().toISOString(),
    });

    if (mode === 'share_and_negotiate') {
      const existingAgent = agents.find((a) => a.handle.toLowerCase() === peer.handle.toLowerCase());
      if (onEngageProposal) {
        onEngageProposal({
          targetHandle: peer.handle,
          proposalTitle: `${peer.incentive || peer.roleTitle} (${eventRoom})`,
          stickerPriceZAR: peer.type === 'business' ? 65000 : 35000,
        });
      } else if (existingAgent) {
        onEngageAgent(existingAgent);
      }
    }
  };

  // Walk simulator — logs both storefront BLE/DOOH handshakes AND nearby job matches!
  useEffect(() => {
    if (!walking) return;
    const waypoints = agents
      .filter((a) => a.geoLocation && a.discoverableByPassersby && a.handle !== '911.emergency.agent')
      .map((a) => ({ agent: a, lat: a.geoLocation!.lat, lng: a.geoLocation!.lng }));

    if (waypoints.length === 0) return;
    let stepIdx = 0;

    const timer = setInterval(async () => {
      const wp = waypoints[stepIdx % waypoints.length];
      const nextLoc = {
        lat: wp.lat + (Math.random() - 0.5) * 0.0004,
        lng: wp.lng + (Math.random() - 0.5) * 0.0004,
      };
      onUpdateUserLocation(nextLoc);
      const dist = Math.max(12, Math.min(48, haversineMeters(nextLoc, { lat: wp.lat, lng: wp.lng })));

      if (!matchedSetRef.current.has(wp.agent.id)) {
        matchedSetRef.current.add(wp.agent.id);

        // Check if this geofenced company has an open job matching the user
        const matchingJob = matchedJobs.find(
          (mj) => mj.job.companyAgentHandle.toLowerCase() === wp.agent.handle.toLowerCase()
        );
        if (matchingJob) {
          onAddPasserbyEvent({
            id: `pass_job_${Date.now()}`,
            agentHandle: activeUserAgent?.handle || 'alex.founder.agent',
            targetHandle: wp.agent.handle,
            locationLabel: wp.agent.geoLocation?.label || 'Sandton Corridor',
            distanceMeters: dist,
            matchScore: matchingJob.matchScore,
            summary: `Job Beacon Match: "${matchingJob.job.title}" (${matchingJob.job.remoteMode}) at ${matchingJob.job.companyName}`,
            incentive: `${formatMoney(matchingJob.job.salaryRangeZAR[0], currency)}–${formatMoney(matchingJob.job.salaryRangeZAR[1], currency)}`,
            kind: 'job',
            jobId: matchingJob.job.id,
            timestamp: new Date().toISOString(),
          });
        }

        try {
          const res = await fetch('/api/rfp/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userHandle: activeUserAgent?.handle || 'alex.founder.agent',
              targetHandle: wp.agent.handle,
              locationLabel: wp.agent.geoLocation?.label || 'Sandton Corridor',
              distanceMeters: dist,
            }),
          });
          const data = await res.json();
          onAddPasserbyEvent({
            id: `pass_${Date.now()}`,
            agentHandle: activeUserAgent?.handle || 'alex.founder.agent',
            targetHandle: wp.agent.handle,
            locationLabel: wp.agent.geoLocation?.label || 'Sandton Corridor',
            distanceMeters: dist,
            matchScore: data.matchScore || 94,
            summary: data.summary,
            incentive: data.incentive,
            kind: 'commerce',
            timestamp: new Date().toISOString(),
          });
        } catch {
          // ignore
        }
      }
      stepIdx += 1;
    }, 2400);

    return () => clearInterval(timer);
  }, [walking, agents, matchedJobs, activeUserAgent, currency, onUpdateUserLocation, onAddPasserbyEvent]);

  const handleCityChange = (id: string) => {
    setSelectedCityId(id);
    const preset = CITY_PRESETS.find((c) => c.id === id) || CITY_PRESETS[0];
    setMapCenter(preset);
    onUpdateUserLocation({ lat: preset.lat, lng: preset.lng });
  };

  const toRadarPct = (lat: number, lng: number) => {
    const dx = ((lng - mapCenter.lng) / 0.14) * 50 + 50;
    const dy = (-(lat - mapCenter.lat) / 0.09) * 50 + 50;
    return {
      left: `${Math.max(8, Math.min(92, dx))}%`,
      top: `${Math.max(10, Math.min(90, dy))}%`,
    };
  };

  return (
    <div className="space-y-4">
      {/* Header & Mode Selector */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Spatial Discovery Radar
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            50m BLE storefront beacons, DOOH job geofences &amp; Wi-Fi event card mesh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <SwipeScrollArea
            direction="horizontal"
            showArrows={true}
            arrowSize="sm"
            className="w-full sm:w-auto"
            innerClassName="inline-flex items-center gap-1 p-1 pr-7 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
          >
            {(
              [
                { id: 'all', label: 'All Radar' },
                { id: 'jobs', label: `Job Radar (${matchedJobs.length})`, icon: Briefcase },
                { id: 'events', label: `Event Mesh (${discoveredPeers.length})`, icon: Wifi },
              ] as Array<{ id: RadarMode; label: string; icon?: React.FC<{ className?: string }> }>
            ).map((m) => {
              const Icon = m.icon;
              const active = radarMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRadarMode(m.id)}
                  className={`min-h-[32px] px-2.5 rounded-lg text-[11.5px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 font-medium'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{m.label}</span>
                </button>
              );
            })}
          </SwipeScrollArea>

          <select
            value={selectedCityId}
            onChange={(e) => handleCityChange(e.target.value)}
            className="w-full sm:w-auto max-w-full min-w-0 min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
          >
            {CITY_PRESETS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {dispatchedUnits.length === 0 && (googleMapsApiKey || mapboxAccessToken) && (
            <SwipeScrollArea
              direction="horizontal"
              showArrows={true}
              arrowSize="sm"
              className="w-full sm:w-auto"
              innerClassName="inline-flex items-center gap-1 p-1 pr-7 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
            >
              {googleMapsApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setGoogleFailed(false);
                    setFallbackReason(null);
                    setPreferredProvider('google');
                  }}
                  title={googleFailed ? 'Google Maps failed — click to retry' : 'Use Google Maps'}
                  className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                    activeMapEngine === 'google'
                      ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                      : googleFailed
                      ? 'text-amber-700 dark:text-amber-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-900'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                  }`}
                >
                  Google{googleFailed ? ' (!)' : ''}
                </button>
              )}
              {mapboxAccessToken && (
                <button
                  type="button"
                  onClick={() => {
                    setMapboxFailed(false);
                    setPreferredProvider('mapbox');
                  }}
                  title="Use Mapbox backup map"
                  className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                    activeMapEngine === 'mapbox'
                      ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                  }`}
                >
                  Mapbox
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreferredProvider('vector')}
                className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                  activeMapEngine === 'vector'
                    ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                }`}
              >
                Radar
              </button>
            </SwipeScrollArea>
          )}

          <button
            onClick={() => {
              if (!walking) matchedSetRef.current.clear();
              setWalking((w) => !w);
            }}
            className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition-colors whitespace-nowrap ${
              walking
                ? 'bg-amber-500 text-white dark:bg-amber-400 dark:text-zinc-950 hover:bg-amber-600 dark:hover:bg-amber-300'
                : 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white'
            }`}
          >
            {walking ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {walking ? 'Stop Walk' : 'Simulate Walk'}
          </button>
        </div>
      </div>

      {/* Main Radar Canvas + Right Handshake & Proximity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 min-w-0 glass-panel rounded-2xl p-3 sm:p-4 space-y-3">
          {activeMapEngine === 'google' ? (
            <APIProvider apiKey={googleMapsApiKey} language="en" region="ZA">
              <LiveGoogleMapCanvas
                center={{ lat: mapCenter.lat, lng: mapCenter.lng }}
                agents={agents}
                rfps={rfps}
                peers={discoveredPeers}
                userLocation={userLocation}
                isDark={isDark}
                onFallback={handleGoogleFallback}
                onSelectAgent={onEngageAgent}
              />
            </APIProvider>
          ) : activeMapEngine === 'mapbox' ? (
            <div className="relative">
              <LiveMapboxCanvas
                accessToken={mapboxAccessToken}
                center={{ lat: mapCenter.lat, lng: mapCenter.lng }}
                agents={agents}
                rfps={rfps}
                peers={discoveredPeers}
                userLocation={userLocation}
                isDark={isDark}
                isBroadcasting={isBroadcasting}
                currency={currency}
                fallbackReason={fallbackReason}
                canRetryGoogle={Boolean(googleMapsApiKey)}
                onRetryGoogle={() => {
                  setGoogleFailed(false);
                  setFallbackReason(null);
                  setPreferredProvider('google');
                }}
                onFallback={handleMapboxFallback}
                onSelectNode={(agent) => setSelectedNode(agent)}
                onSelectPeer={(peer) => handleShareAndNegotiatePeer(peer, 'card_share')}
              />
              {selectedNode && (
                <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 p-3.5 z-30 shadow-2xl">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">{selectedNode.handle}</span>
                    <button onClick={() => setSelectedNode(null)} className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium">
                      Close
                    </button>
                  </div>
                  <p className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 mt-1">{selectedNode.displayName}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{selectedNode.geoLocation?.label}</p>
                  {selectedNode.passerbyIncentive && (
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-1.5">{selectedNode.passerbyIncentive}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onEngageAgent(selectedNode)}
                      className="flex-1 min-h-[36px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-3 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                    >
                      Open A2A Engage
                    </button>
                    <button
                      onClick={() =>
                        onSaveContact(selectedNode, {
                          source: 'ble_beacon',
                          sharedAtLocation: selectedNode.geoLocation?.label || mapCenter.name,
                        })
                      }
                      className="min-h-[36px] px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-[270px] sm:h-[380px] lg:h-[460px] rounded-xl bg-zinc-50 dark:bg-[#09090b] border border-zinc-300 dark:border-white/10 relative overflow-hidden">
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 460">
                <defs>
                  <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(9,9,11,0.06)'}
                      strokeWidth="1"
                    />
                  </pattern>
                  <linearGradient id="fovGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="rgba(14,165,233,0.28)" />
                    <stop offset="100%" stopColor="rgba(14,165,233,0.02)" />
                  </linearGradient>
                </defs>
                <rect width="800" height="460" fill="url(#radarGrid)" />
                {/* Compass Directional FOV Cone anchored at center (400, 230) */}
                <g transform={`rotate(${headingDeg} 400 230)`}>
                  <path
                    d={`M 400 230 L 325 ${Math.max(25, 230 - Math.round((scanRadiusMeters / 500) * 185))} A 200 200 0 0 1 475 ${Math.max(25, 230 - Math.round((scanRadiusMeters / 500) * 185))} Z`}
                    fill="url(#fovGrad)"
                  />
                  <line
                    x1="400"
                    y1="230"
                    x2="400"
                    y2={Math.max(35, 230 - Math.round((scanRadiusMeters / 500) * 190))}
                    stroke="rgba(14,165,233,0.65)"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                  />
                </g>
                {/* Live Broadcast Radius Ring */}
                <circle
                  cx="400"
                  cy="230"
                  r={Math.max(36, Math.round((broadcastRadiusMeters / 500) * 195))}
                  fill="none"
                  stroke={isBroadcasting ? 'rgba(16,185,129,0.55)' : isDark ? 'rgba(56,189,248,0.25)' : 'rgba(2,132,199,0.28)'}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                {/* Live Scan Radius Ring */}
                <circle
                  cx="400"
                  cy="230"
                  r={Math.max(48, Math.round((scanRadiusMeters / 500) * 225))}
                  fill="none"
                  stroke={isDark ? 'rgba(52,211,153,0.32)' : 'rgba(5,150,105,0.34)'}
                  strokeWidth="1.5"
                  strokeDasharray="6 6"
                />
                <circle
                  cx="400"
                  cy="230"
                  r="245"
                  fill="none"
                  stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(9,9,11,0.10)'}
                />
                <path
                  d="M 120 390 Q 340 260 400 230 T 710 85"
                  fill="none"
                  stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(9,9,11,0.14)'}
                  strokeWidth="2.5"
                />
                <path
                  d="M 160 95 Q 380 190 660 355"
                  fill="none"
                  stroke={isDark ? 'rgba(52,211,153,0.16)' : 'rgba(5,150,105,0.20)'}
                  strokeWidth="2"
                />
              </svg>

              <div className="absolute top-3 left-3 max-w-[calc(100%-24px)] rounded-lg bg-white/95 dark:bg-zinc-950/90 border border-zinc-300 dark:border-white/15 px-2.5 py-1 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 flex flex-wrap items-center gap-2 shadow-sm">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Compass className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="tabular-nums">{compassLabel(headingDeg)} {headingDeg}°</span>
                </span>
                <span className="text-zinc-400">·</span>
                <span className="tabular-nums text-[10.5px]">Gyro {pitchDeg}°/{rollDeg}°</span>
                <span className="text-zinc-400 hidden sm:inline">·</span>
                <span className="truncate tabular-nums hidden sm:inline">
                  {mapCenter.name} ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                </span>
              </div>

              <div
                style={toRadarPct(userLocation.lat, userLocation.lng)}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-700"
              >
                <div className="relative flex items-center justify-center">
                  <span className="w-8 h-8 rounded-full bg-sky-500/20 dark:bg-sky-400/15 border border-sky-600/50 dark:border-sky-400/40 absolute" />
                  <span className="w-3.5 h-3.5 rounded-full bg-sky-600 dark:bg-sky-400 border-2 border-white dark:border-zinc-950" />
                  <span className="absolute top-5 whitespace-nowrap rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-zinc-950 dark:text-zinc-100 shadow-sm tabular-nums">
                    {isBroadcasting ? `TX ${broadcastRadiusMeters}m` : `RX ${scanRadiusMeters}m`}
                  </span>
                </div>
              </div>

              {agents
                .filter((a) => a.geoLocation && a.handle !== '911.emergency.agent')
                .map((agent) => {
                  const pos = toRadarPct(agent.geoLocation!.lat, agent.geoLocation!.lng);
                  const hasOpenJob = matchedJobs.some(
                    (mj) => mj.job.companyAgentHandle.toLowerCase() === agent.handle.toLowerCase()
                  );
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedNode(agent)}
                      style={pos}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group text-left"
                    >
                      <div className="px-2 py-1 rounded-md bg-white/95 dark:bg-zinc-950/95 border border-emerald-500/60 dark:border-emerald-400/40 group-hover:border-zinc-950 dark:group-hover:border-white text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-200 whitespace-nowrap shadow-sm flex items-center gap-1">
                        {hasOpenJob && <Briefcase className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />}
                        <span>{agent.handle}</span>
                      </div>
                    </button>
                  );
                })}

              {rfps
                .filter((r) => r.location)
                .map((rfp) => {
                  const pos = toRadarPct(rfp.location!.lat, rfp.location!.lng);
                  return (
                    <div
                      key={rfp.id}
                      style={{ left: pos.left, top: `calc(${pos.top} + 26px)` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
                    >
                      <div className="px-2 py-0.5 rounded bg-white/95 dark:bg-zinc-950/90 border border-amber-500/60 dark:border-amber-400/40 text-[10px] font-mono font-semibold text-amber-800 dark:text-amber-200 whitespace-nowrap tabular-nums shadow-sm">
                        DOOH · {formatMoney(rfp.budgetZAR, currency)}
                      </div>
                    </div>
                  );
                })}

              {telemetryPeers
                .filter((p) => p.lat !== undefined && p.lng !== undefined)
                .map((peer) => {
                  const pos = toRadarPct(peer.lat! + 0.004, peer.lng! - 0.005);
                  const inScan = peer.distanceMeters <= scanRadiusMeters;
                  return (
                    <button
                      key={`vec_peer_${peer.id}`}
                      type="button"
                      onClick={() => handleShareAndNegotiatePeer(peer, 'card_share')}
                      style={pos}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-15"
                      title={`${peer.displayName} (${peer.distanceMeters}m${peer.mutualBearingLock ? ' · Mutual Bearing Lock' : ''})`}
                    >
                      <div
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold whitespace-nowrap shadow-sm flex items-center gap-1 ${
                          peer.mutualBearingLock
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/70'
                            : inScan
                            ? 'bg-sky-600 text-white'
                            : 'bg-zinc-700 text-zinc-200 opacity-75'
                        }`}
                      >
                        {peer.sameWifi ? <Wifi className="w-2.5 h-2.5" /> : <Bluetooth className="w-2.5 h-2.5" />}
                        <span>{peer.handle.replace('.agent', '')}</span>
                        {peer.mutualBearingLock && <Compass className="w-2.5 h-2.5" />}
                      </div>
                    </button>
                  );
                })}

              {dispatchedUnits.map((unit) => {
                const pos = toRadarPct(unit.lat, unit.lng);
                return (
                  <div key={unit.id} style={pos} className="absolute -translate-x-1/2 -translate-y-1/2 z-30">
                    <div className="px-2.5 py-1 rounded-md bg-rose-600 dark:bg-rose-950/95 border border-rose-700 dark:border-rose-400 text-[11px] font-mono font-semibold text-white dark:text-rose-100 flex items-center gap-1.5 whitespace-nowrap shadow-md">
                      <ShieldAlert className="w-3.5 h-3.5 text-white dark:text-rose-400" />
                      {unit.callsign} · {unit.etaMinutes}m
                    </div>
                  </div>
                );
              })}

              {selectedNode && (
                <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 p-3.5 z-30 shadow-2xl">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-sky-700 dark:text-sky-400">{selectedNode.handle}</span>
                    <button onClick={() => setSelectedNode(null)} className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium">
                      Close
                    </button>
                  </div>
                  <p className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 mt-1">{selectedNode.displayName}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{selectedNode.geoLocation?.label}</p>
                  {selectedNode.passerbyIncentive && (
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-1.5">{selectedNode.passerbyIncentive}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onEngageAgent(selectedNode)}
                      className="flex-1 min-h-[36px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-3 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                    >
                      Open A2A Engage
                    </button>
                    <button
                      onClick={() =>
                        onSaveContact(selectedNode, {
                          source: 'ble_beacon',
                          sharedAtLocation: selectedNode.geoLocation?.label || mapCenter.name,
                        })
                      }
                      className="min-h-[36px] px-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-400 px-1 tabular-nums">
            <span>
              <MapPin className="w-3.5 h-3.5 inline mr-1 text-emerald-600 dark:text-emerald-400" />
              {agents.filter((a) => a.discoverableByPassersby).length} Storefront Beacons
            </span>
            <span>
              <Briefcase className="w-3.5 h-3.5 inline mr-1 text-sky-600 dark:text-sky-400" />
              {matchedJobs.length} Job Beacons
            </span>
            <span>
              <Navigation className="w-3.5 h-3.5 inline mr-1 text-amber-600 dark:text-amber-400" />
              {rfps.filter((r) => r.broadcastChannels.includes('google_maps_billboard')).length} DOOH Geofences
            </span>
            <span>
              <Wifi className="w-3.5 h-3.5 inline mr-1 text-sky-600 dark:text-sky-400" />
              {discoveredPeers.length} Event Mesh Peers
            </span>
          </div>
        </div>

        {/* Right Column: Passerby Handshakes (Commerce + Job Matches + Event Exchanges) */}
        <div className="lg:col-span-4 min-w-0 glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Passerby Handshakes
            </h3>
            <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
              {walking ? 'Scanning...' : 'Idle'}
            </span>
          </div>

          {passerbyEvents.length === 0 ? (
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-4 text-center space-y-1.5">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">No handshakes captured</p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Run Simulate Walk to match nearby beacons &amp; jobs, or exchange cards in Event Mesh below.
              </p>
            </div>
          ) : (
            <SwipeScrollArea direction="vertical" showArrows={true} arrowSize="sm" className="max-h-[340px] sm:max-h-[410px]" innerClassName="space-y-2 pr-1">
              {passerbyEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-900 dark:text-zinc-200 font-semibold truncate">
                      {evt.kind === 'job' ? 'JOB · ' : evt.kind === 'event_peer' ? 'EVENT · ' : ''}
                      {evt.targetHandle}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold tabular-nums shrink-0">
                      {evt.distanceMeters}m · {evt.matchScore}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-400">{evt.summary}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{evt.locationLabel}</p>
                </div>
              ))}
            </SwipeScrollArea>
          )}
        </div>
      </div>

      {/* Geofenced Job Search & Matching Panel */}
      {(radarMode === 'all' || radarMode === 'jobs') && (
        <div className="glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-zinc-200 dark:border-white/10">
            <div>
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Spatial Job Beacon Matches
              </h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Jobs broadcast by nearby company BLE &amp; DOOH geofences, scored for{' '}
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  {activeUserAgent?.handle || 'alex.founder.agent'}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="relative flex-1 sm:flex-initial min-w-0">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={jobQuery}
                  onChange={(e) => setJobQuery(e.target.value)}
                  placeholder="Filter jobs, company, skills..."
                  className="min-h-[34px] w-full sm:w-56 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 pl-8 pr-2.5 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </div>

              <SwipeScrollArea
                direction="horizontal"
                showArrows={true}
                arrowSize="sm"
                className="w-full sm:w-auto"
                innerClassName="inline-flex items-center gap-1 p-0.5 pr-7 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10"
              >
                {(['All', 'Remote', 'Hybrid', 'On-Site'] as JobRemoteFilter[]).map((rm) => (
                  <button
                    key={rm}
                    type="button"
                    onClick={() => setJobRemoteFilter(rm)}
                    className={`min-h-[28px] px-2 rounded-md text-[11px] whitespace-nowrap shrink-0 transition-colors ${
                      jobRemoteFilter === rm
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 font-medium'
                    }`}
                  >
                    {rm}
                  </button>
                ))}
              </SwipeScrollArea>
            </div>
          </div>

          {matchedJobs.length === 0 ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 py-4 text-center">
              No open jobs match your spatial filter.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {matchedJobs.map(({ job, companyAgent, matchScore, distanceMeters, matchedSkills }) => (
                <div
                  key={job.id}
                  className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3.5 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-sky-700 dark:text-sky-400 truncate">
                        {job.companyAgentHandle}
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0">
                        {matchScore}% fit · {distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)}km` : `${distanceMeters}m`}
                      </span>
                    </div>

                    <h4 className="text-xs font-display font-bold text-zinc-950 dark:text-white leading-snug">
                      {job.title}
                    </h4>

                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 tabular-nums">
                      {job.companyName} · {job.remoteMode} · {formatMoney(job.salaryRangeZAR[0], currency)}–{formatMoney(job.salaryRangeZAR[1], currency)}
                    </p>

                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      {matchedSkills.length > 0
                        ? `Matched skills: ${matchedSkills.join(', ')}`
                        : `Skills: ${job.requiredSkills.slice(0, 3).join(', ')}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    {onApplyJobFromRadar && (
                      <button
                        type="button"
                        onClick={() => onApplyJobFromRadar(job)}
                        className="flex-1 min-h-[34px] rounded-lg bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-[11px] font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                      >
                        Apply (Poppy)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (onEngageProposal) {
                          onEngageProposal({
                            targetHandle: job.companyAgentHandle,
                            proposalTitle: `Role & Compensation Negotiation: ${job.title}`,
                            stickerPriceZAR: Math.round((job.salaryRangeZAR[0] + job.salaryRangeZAR[1]) / 2),
                          });
                        } else if (companyAgent) {
                          onEngageAgent(companyAgent);
                        }
                      }}
                      className="min-h-[34px] px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                    >
                      Negotiate Rate
                    </button>
                    {companyAgent && (
                      <button
                        type="button"
                        onClick={() =>
                          onSaveContact(companyAgent, {
                            source: 'ble_beacon',
                            sharedAtLocation: job.location,
                            notes: `Matched job: ${job.title}`,
                          })
                        }
                        className="w-8 h-[34px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shrink-0"
                        title="Save company agent to Contacts"
                        aria-label="Save company agent to Contacts"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event Wi-Fi, Bluetooth/BLE, Bi-Directional Compass/Gyro & Autonomous Radius Mesh */}
      {(radarMode === 'all' || radarMode === 'events') && (
        <div className="glass-panel rounded-2xl p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
            <div>
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Real-Time Proximity Mesh — Wi-Fi, BLE Beacon, Bi-Directional Compass &amp; Gyroscope
              </h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                Configure independent Broadcast &amp; Scan radii, fuse compass/gyro orientation &amp; live GPS, and auto-add matching contacts at events or in public.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <span
                className={`text-[10.5px] font-mono px-2 py-0.5 rounded-md border ${
                  wsConnected
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {wsConnected ? 'WS LIVE SYNC' : 'HTTP POLL'}
              </span>
              <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                {meshStatusLabel}
              </span>
            </div>
          </div>

          {/* Bi-Directional Compass / Gyroscope / GPS / Radius Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                <span className="inline-flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-sky-500" />
                  Compass Azimuth
                </span>
                <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                  {compassLabel(headingDeg)} {headingDeg}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={359}
                value={headingDeg}
                onChange={(e) => setHeadingDeg(Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleToggleGyro}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10.5px] font-semibold border transition-colors ${
                    gyroEnabled
                      ? 'bg-sky-600 text-white border-sky-600'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-white/15'
                  }`}
                >
                  {gyroEnabled ? `Gyro Live (${pitchDeg}°/${rollDeg}°)` : 'Enable Compass & Gyro'}
                </button>
                <button
                  type="button"
                  onClick={() => setGpsLiveEnabled((g) => !g)}
                  className={`py-1 px-2 rounded-lg text-[10.5px] font-semibold border inline-flex items-center gap-1 ${
                    gpsLiveEnabled
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-white/15'
                  }`}
                >
                  <LocateFixed className="w-3 h-3" />
                  {gpsLiveEnabled ? 'GPS Live' : 'GPS'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                <span>Broadcast Radius (TX)</span>
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {broadcastRadiusMeters}m
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={500}
                step={5}
                value={broadcastRadiusMeters}
                onChange={(e) => setBroadcastRadiusMeters(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Controls how far your card beacon &amp; intent are advertised
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                <span>Scan &amp; Auto-Add Radius (RX)</span>
                <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                  {scanRadiusMeters}m
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={500}
                step={5}
                value={scanRadiusMeters}
                onChange={(e) => setScanRadiusMeters(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Matches {telemetryPeers.filter((p) => p.distanceMeters <= scanRadiusMeters).length}/{telemetryPeers.length} detected peers in range
              </p>
            </div>

            <div className="space-y-2 flex flex-col justify-between">
              <label className="flex items-center justify-between gap-2 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <span>Auto-Add Contacts in Radius</span>
                <input
                  type="checkbox"
                  checked={autoAddWithinRadius}
                  onChange={(e) => setAutoAddWithinRadius(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <span>Only Matching Intent Topics</span>
                <input
                  type="checkbox"
                  checked={requireIntentMatch}
                  onChange={(e) => setRequireIntentMatch(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
              </label>
              {broadcastIntentTopics.length > 0 && (
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  Topics: {broadcastIntentTopics.slice(0, 3).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Broadcast Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
            <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 min-w-0">
              Card to Broadcast
              <select
                value={broadcastAgentHandle}
                onChange={(e) => setBroadcastAgentHandle(e.target.value)}
                className="mt-1 w-full max-w-full min-w-0 min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-mono text-zinc-950 dark:text-zinc-100"
              >
                {nonEmergencyAgents.map((a) => (
                  <option key={a.id} value={a.handle}>
                    {a.handle} ({a.type === 'business' ? 'Company' : 'Personal'})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 min-w-0">
              Event Room / Wi-Fi Mesh
              <input
                type="text"
                value={eventRoom}
                onChange={(e) => setEventRoom(e.target.value)}
                placeholder="sandton-summit-2026"
                className="mt-1 w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs font-mono text-zinc-950 dark:text-zinc-100"
              />
            </label>

            <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 min-w-0">
              Intent at Event
              <select
                value={eventIntent}
                onChange={(e) => setEventIntent(e.target.value as ProximityIntent)}
                className="mt-1 w-full max-w-full min-w-0 min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-zinc-100"
              >
                <option value="networking">Networking</option>
                <option value="job_seeking">Looking for Work</option>
                <option value="hiring">Hiring / Recruiting</option>
                <option value="commerce">B2B Sales / Deals</option>
                <option value="partnership">Partnership</option>
              </select>
            </label>

            <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 min-w-0">
              Transport
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value as ProximityTransport)}
                className="mt-1 w-full max-w-full min-w-0 min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-2.5 text-xs text-zinc-950 dark:text-zinc-100"
              >
                <option value="same_wifi">Same Wi-Fi Network</option>
                <option value="ble_beacon">Bluetooth BLE Beacon</option>
              </select>
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleBroadcast}
                className={`flex-1 min-h-[38px] px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  isBroadcasting
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                {isBroadcasting ? 'Broadcasting' : 'Broadcast Card'}
              </button>

              <button
                type="button"
                disabled={scanningMesh}
                onClick={handleBluetoothBeaconScan}
                className="min-h-[38px] px-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1 whitespace-nowrap"
                title={bleSupported ? 'Scan Same Wi-Fi & Bluetooth Beacons' : 'Scan Wi-Fi Mesh & BLE Beacons'}
              >
                <Bluetooth className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Scan
              </button>
            </div>
          </div>

          {/* Discovered Nearby Event Peers */}
          {telemetryPeers.length === 0 ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 py-4 text-center">
              No active peers detected in room <span className="font-mono">{eventRoom}</span> yet. Click Scan or Broadcast Card.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {telemetryPeers.map((peer) => {
                const isSaved = savedContactHandles.has(peer.handle.toLowerCase());
                const withinRadius = peer.distanceMeters <= scanRadiusMeters;
                return (
                  <div
                    key={peer.id}
                    className={`rounded-xl bg-zinc-50 dark:bg-zinc-950 border p-3.5 flex flex-col justify-between gap-2.5 ${
                      peer.mutualBearingLock
                        ? 'border-emerald-500/60 dark:border-emerald-400/50 ring-1 ring-emerald-500/20'
                        : 'border-zinc-200 dark:border-white/10'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-display font-bold text-zinc-950 dark:text-white truncate">
                            {peer.displayName}
                          </h4>
                          <p className="text-[11px] font-mono text-sky-700 dark:text-sky-400 truncate">
                            {peer.handle} · {peer.organization}
                          </p>
                        </div>
                        <span className="text-[10.5px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0 inline-flex items-center gap-1">
                          {peer.sameWifi ? (
                            <Wifi className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                          ) : (
                            <Bluetooth className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {peer.sameWifi ? 'Wi-Fi' : 'BLE'} · {peer.distanceMeters}m
                          {typeof peer.relativeBearingDeg === 'number' && (
                            <> · {compassLabel(peer.relativeBearingDeg)} {peer.relativeBearingDeg}°</>
                          )}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {peer.mutualBearingLock && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white inline-flex items-center gap-1">
                            <Compass className="w-3 h-3" /> Mutual Bearing Lock
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            withinRadius
                              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {withinRadius ? `In ${scanRadiusMeters}m Scan Radius` : 'Outside Scan Radius'}
                        </span>
                        {peer.matchedScore && (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> {peer.matchedScore}% Intent Fit
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-snug">
                        {peer.roleTitle} · <span className="capitalize">{peer.intent.replace('_', ' ')}</span>
                      </p>

                      {peer.summary && (
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {peer.summary}
                        </p>
                      )}

                      {peer.incentive && (
                        <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                          {peer.incentive}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleShareAndNegotiatePeer(peer, 'share_and_negotiate')}
                        className="flex-1 min-h-[34px] px-3 rounded-lg bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-[11px] font-semibold inline-flex items-center justify-center gap-1 hover:bg-zinc-800 dark:hover:bg-white whitespace-nowrap"
                      >
                        <Zap className="w-3 h-3" />
                        Share &amp; Negotiate
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareAndNegotiatePeer(peer, 'card_share')}
                        className={`min-h-[34px] px-3 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap ${
                          isSaved
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                            : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {isSaved ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                        {isSaved ? 'Saved · Share Back' : 'Save & Share Card'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
