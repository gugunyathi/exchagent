import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import {
  AgentDoc,
  RfpDoc,
  PasserbyHandshakeEvent,
  DispatchedUnit,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';
import { CITY_PRESETS } from '../data/seedData';
import { SwipeScrollArea } from './SwipeScrollArea';
import { useTheme } from '../lib/theme';

interface SpatialMapsDiscoveryProps {
  agents: AgentDoc[];
  rfps: RfpDoc[];
  userLocation: { lat: number; lng: number };
  onUpdateUserLocation: (loc: { lat: number; lng: number }) => void;
  passerbyEvents: PasserbyHandshakeEvent[];
  onAddPasserbyEvent: (evt: PasserbyHandshakeEvent) => void;
  dispatchedUnits: DispatchedUnit[];
  googleMapsApiKey: string;
  currency: CurrencyMode;
  onPitchAgent: (agent: AgentDoc) => void;
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

const LiveGoogleMapCanvas: React.FC<{
  center: { lat: number; lng: number };
  agents: AgentDoc[];
  rfps: RfpDoc[];
  userLocation: { lat: number; lng: number };
  isDark: boolean;
  onFallback: () => void;
  onSelectAgent: (a: AgentDoc) => void;
}> = ({ center, agents, rfps, userLocation, isDark, onFallback, onSelectAgent }) => {
  const status = useApiLoadingStatus();
  const [selectedAgent, setSelectedAgent] = useState<AgentDoc | null>(null);

  useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
      onFallback();
    }
  }, [status, onFallback]);

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
                Pitch Agent
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export const SpatialMapsDiscovery: React.FC<SpatialMapsDiscoveryProps> = ({
  agents,
  rfps,
  userLocation,
  onUpdateUserLocation,
  passerbyEvents,
  onAddPasserbyEvent,
  dispatchedUnits,
  googleMapsApiKey,
  currency,
  onPitchAgent,
}) => {
  const { isDark } = useTheme();
  const [selectedCityId, setSelectedCityId] = useState('jhb');
  const [mapCenter, setMapCenter] = useState(CITY_PRESETS[0]);
  const [forceVectorRadar, setForceVectorRadar] = useState(false);
  const [walking, setWalking] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AgentDoc | null>(null);
  const matchedSetRef = useRef<Set<string>>(new Set());

  const showLiveGoogleMap = Boolean(googleMapsApiKey) && !forceVectorRadar && dispatchedUnits.length === 0;

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
        try {
          const res = await fetch('/api/rfp/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userHandle: 'alex.founder.agent',
              targetHandle: wp.agent.handle,
              locationLabel: wp.agent.geoLocation?.label || 'Sandton Corridor',
              distanceMeters: dist,
            }),
          });
          const data = await res.json();
          onAddPasserbyEvent({
            id: `pass_${Date.now()}`,
            agentHandle: 'alex.founder.agent',
            targetHandle: wp.agent.handle,
            locationLabel: wp.agent.geoLocation?.label || 'Sandton Corridor',
            distanceMeters: dist,
            matchScore: data.matchScore || 94,
            summary: data.summary,
            incentive: data.incentive,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // ignore
        }
      }
      stepIdx += 1;
    }, 2400);

    return () => clearInterval(timer);
  }, [walking, agents, onUpdateUserLocation, onAddPasserbyEvent]);

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
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Spatial Discovery Radar
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            50m BLE storefront beacons &amp; DOOH billboard geofences
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCityId}
            onChange={(e) => handleCityChange(e.target.value)}
            className="min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-950 dark:text-zinc-100 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
          >
            {CITY_PRESETS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {googleMapsApiKey && dispatchedUnits.length === 0 && (
            <button
              onClick={() => setForceVectorRadar((v) => !v)}
              className="min-h-[38px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 whitespace-nowrap transition-colors"
            >
              {forceVectorRadar ? 'Google Map' : 'Vector Radar'}
            </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 glass-panel rounded-2xl p-3 sm:p-4 space-y-3">
          {showLiveGoogleMap ? (
            <APIProvider apiKey={googleMapsApiKey} language="en" region="ZA">
              <LiveGoogleMapCanvas
                center={{ lat: mapCenter.lat, lng: mapCenter.lng }}
                agents={agents}
                rfps={rfps}
                userLocation={userLocation}
                isDark={isDark}
                onFallback={() => setForceVectorRadar(true)}
                onSelectAgent={onPitchAgent}
              />
            </APIProvider>
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
                </defs>
                <rect width="800" height="460" fill="url(#radarGrid)" />
                <circle
                  cx="400"
                  cy="230"
                  r="85"
                  fill="none"
                  stroke={isDark ? 'rgba(56,189,248,0.22)' : 'rgba(2,132,199,0.25)'}
                  strokeDasharray="4 4"
                />
                <circle
                  cx="400"
                  cy="230"
                  r="165"
                  fill="none"
                  stroke={isDark ? 'rgba(52,211,153,0.18)' : 'rgba(5,150,105,0.22)'}
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

              <div className="absolute top-3 left-3 max-w-[calc(100%-24px)] rounded-lg bg-white/95 dark:bg-zinc-950/90 border border-zinc-300 dark:border-white/15 px-2.5 py-1 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 shadow-sm">
                <Compass className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="truncate tabular-nums">
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
                  <span className="absolute top-5 whitespace-nowrap rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-zinc-950 dark:text-zinc-100 shadow-sm">
                    You
                  </span>
                </div>
              </div>

              {agents
                .filter((a) => a.geoLocation && a.handle !== '911.emergency.agent')
                .map((agent) => {
                  const pos = toRadarPct(agent.geoLocation!.lat, agent.geoLocation!.lng);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedNode(agent)}
                      style={pos}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group text-left"
                    >
                      <div className="px-2 py-1 rounded-md bg-white/95 dark:bg-zinc-950/95 border border-emerald-500/60 dark:border-emerald-400/40 group-hover:border-zinc-950 dark:group-hover:border-white text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-200 whitespace-nowrap shadow-sm">
                        {agent.handle}
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
                  <button
                    onClick={() => onPitchAgent(selectedNode)}
                    className="mt-3 w-full min-h-[36px] rounded-lg bg-zinc-950 dark:bg-zinc-50 px-3 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                  >
                    Open A2A Pitch
                  </button>
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
              <Navigation className="w-3.5 h-3.5 inline mr-1 text-amber-600 dark:text-amber-400" />
              {rfps.filter((r) => r.broadcastChannels.includes('google_maps_billboard')).length} DOOH Geofences
            </span>
          </div>
        </div>

        <div className="lg:col-span-4 glass-panel rounded-2xl p-4 space-y-3">
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
                Run Simulate Walk to match nearby beacons.
              </p>
            </div>
          ) : (
            <SwipeScrollArea direction="vertical" className="max-h-[340px] sm:max-h-[410px]" innerClassName="space-y-2 pr-1">
              {passerbyEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-900 dark:text-zinc-200 font-semibold truncate">{evt.targetHandle}</span>
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold tabular-nums shrink-0">{evt.distanceMeters}m · {evt.matchScore}%</span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-400">{evt.summary}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{evt.locationLabel}</p>
                </div>
              ))}
            </SwipeScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};
