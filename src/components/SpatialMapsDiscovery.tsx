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
  Sparkles,
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
  onFallback: () => void;
  onSelectAgent: (a: AgentDoc) => void;
}> = ({ center, agents, rfps, userLocation, onFallback, onSelectAgent }) => {
  const status = useApiLoadingStatus();
  const [selectedAgent, setSelectedAgent] = useState<AgentDoc | null>(null);

  useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
      onFallback();
    }
  }, [status, onFallback]);

  return (
    <div className="w-full h-[270px] sm:h-[380px] lg:h-[460px] rounded-2xl overflow-hidden border border-slate-800 relative">
      <GoogleMap
        defaultCenter={center}
        center={center}
        defaultZoom={13}
        mapId="DEMO_MAP_ID"
        colorScheme="DARK"
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={userLocation} title="Your Personal Agent">
          <div className="w-5 h-5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-lg" />
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
              <div className="px-2 py-1 rounded-lg bg-slate-950/90 border border-emerald-400/60 text-[11px] font-mono text-emerald-200 shadow-md">
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
              <div className="px-2 py-1 rounded-lg bg-amber-950/90 border border-amber-400/60 text-[10px] font-mono text-amber-200 shadow-md">
                DOOH · {rfp.location!.billboardName?.slice(0, 18) || 'RFP'}
              </div>
            </AdvancedMarker>
          ))}

        {selectedAgent && selectedAgent.geoLocation && (
          <InfoWindow
            position={{ lat: selectedAgent.geoLocation.lat, lng: selectedAgent.geoLocation.lng }}
            onCloseClick={() => setSelectedAgent(null)}
          >
            <div className="text-slate-900 p-1 max-w-xs">
              <p className="font-mono text-xs font-bold">{selectedAgent.handle}</p>
              <p className="text-xs font-semibold mt-0.5">{selectedAgent.displayName}</p>
              {selectedAgent.passerbyIncentive && (
                <p className="text-[11px] text-emerald-700 mt-1">{selectedAgent.passerbyIncentive}</p>
              )}
              <button
                onClick={() => onSelectAgent(selectedAgent)}
                className="mt-2 px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-medium"
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
  const [selectedCityId, setSelectedCityId] = useState('jhb');
  const [mapCenter, setMapCenter] = useState(CITY_PRESETS[0]);
  const [forceVectorRadar, setForceVectorRadar] = useState(false);
  const [walking, setWalking] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AgentDoc | null>(null);
  const matchedSetRef = useRef<Set<string>>(new Set());

  const showLiveGoogleMap = Boolean(googleMapsApiKey) && !forceVectorRadar && dispatchedUnits.length === 0;

  // Passerby Pedestrian / Commuter Walk Simulator
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

  // Vector radar coordinate mapper relative to mapCenter
  const toRadarPct = (lat: number, lng: number) => {
    const dx = ((lng - mapCenter.lng) / 0.14) * 50 + 50;
    const dy = (-(lat - mapCenter.lat) / 0.09) * 50 + 50;
    return {
      left: `${Math.max(8, Math.min(92, dx))}%`,
      top: `${Math.max(10, Math.min(90, dy))}%`,
    };
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header & Controls */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-cyan-400">
            BLE Mesh · Outdoor Corridor Geofences
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            Spatial Discovery Radar
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCityId}
            onChange={(e) => handleCityChange(e.target.value)}
            className="min-h-[40px] rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2 text-xs text-slate-200"
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
              className="min-h-[40px] rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-400/50 whitespace-nowrap"
            >
              {forceVectorRadar ? 'Switch to Google Map' : 'Vector BLE Radar'}
            </button>
          )}

          <button
            onClick={() => {
              if (!walking) matchedSetRef.current.clear();
              setWalking((w) => !w);
            }}
            className={`min-h-[40px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              walking
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
            }`}
          >
            {walking ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {walking ? 'Stop Commuter Walk' : 'Simulate Walk'}
          </button>
        </div>
      </div>

      {/* Main Map + Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        <div className="lg:col-span-8 glass-panel rounded-2xl p-3 sm:p-4 space-y-3">
          {showLiveGoogleMap ? (
            <APIProvider apiKey={googleMapsApiKey} language="en" region="ZA">
              <LiveGoogleMapCanvas
                center={{ lat: mapCenter.lat, lng: mapCenter.lng }}
                agents={agents}
                rfps={rfps}
                userLocation={userLocation}
                onFallback={() => setForceVectorRadar(true)}
                onSelectAgent={onPitchAgent}
              />
            </APIProvider>
          ) : (
            /* Interactive Dark-Mode Vector Spatial Radar Fallback & Simulated Responder Overlay */
            <div className="w-full h-[270px] sm:h-[380px] lg:h-[460px] rounded-2xl bg-[#040710] border border-slate-800/90 relative overflow-hidden">
              {/* Grid & Radar Rings */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 460">
                <defs>
                  <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="800" height="460" fill="url(#radarGrid)" />
                <circle cx="400" cy="230" r="85" fill="none" stroke="rgba(6,182,212,0.18)" strokeDasharray="4 4" />
                <circle cx="400" cy="230" r="165" fill="none" stroke="rgba(16,185,129,0.14)" strokeDasharray="6 6" />
                <circle cx="400" cy="230" r="245" fill="none" stroke="rgba(245,158,11,0.10)" />
                {/* Simulated Sandton / William Nicol Arterial Corridor */}
                <path
                  d="M 120 390 Q 340 260 400 230 T 710 85"
                  fill="none"
                  stroke="rgba(34,211,238,0.22)"
                  strokeWidth="3"
                />
                <path
                  d="M 160 95 Q 380 190 660 355"
                  fill="none"
                  stroke="rgba(16,185,129,0.16)"
                  strokeWidth="2"
                />
              </svg>

              {/* Top-left coordinate badge */}
              <div className="absolute top-3 left-3 max-w-[calc(100%-24px)] rounded-lg bg-slate-950/85 border border-slate-800 px-2.5 py-1.5 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">
                  {mapCenter.name} ({userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)})
                </span>
              </div>

              {/* User Moving Agent Marker */}
              <div
                style={toRadarPct(userLocation.lat, userLocation.lng)}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-700"
              >
                <div className="relative flex items-center justify-center">
                  <span className="w-10 h-10 rounded-full bg-cyan-400/15 border border-cyan-400/50 absolute" />
                  <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-lg" />
                  <span className="absolute top-5 whitespace-nowrap rounded bg-slate-950/90 border border-cyan-500/40 px-1.5 py-0.5 text-[10px] font-mono text-cyan-200">
                    You (alex.founder.agent)
                  </span>
                </div>
              </div>

              {/* Business Storefront & BLE Beacon Agents */}
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
                      <span className="w-12 h-12 rounded-full border border-emerald-400/20 bg-emerald-400/5 absolute -inset-4 pointer-events-none" />
                      <div className="px-2 py-1 rounded-lg bg-slate-950/90 border border-emerald-400/40 group-hover:border-cyan-300 text-[11px] font-mono text-emerald-200 shadow-lg whitespace-nowrap">
                        {agent.handle}
                      </div>
                    </button>
                  );
                })}

              {/* DOOH Billboard RFPs */}
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
                      <div className="px-2 py-0.5 rounded bg-amber-950/85 border border-amber-400/40 text-[10px] font-mono text-amber-200 whitespace-nowrap">
                        DOOH · {formatMoney(rfp.budgetZAR, currency)}
                      </div>
                    </div>
                  );
                })}

              {/* Simulated Emergency Dispatch Responder Units (Local Telemetry Overlay) */}
              {dispatchedUnits.map((unit) => {
                const pos = toRadarPct(unit.lat, unit.lng);
                return (
                  <div
                    key={unit.id}
                    style={pos}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
                  >
                    <div className="px-2.5 py-1 rounded-lg bg-rose-950/95 border border-rose-400 text-[11px] font-mono text-rose-100 shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      {unit.callsign} · ETA {unit.etaMinutes}m
                    </div>
                  </div>
                );
              })}

              {/* Selected Node Popup */}
              {selectedNode && (
                <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 rounded-xl bg-slate-950/95 border border-slate-700 p-4 z-30 shadow-2xl">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-cyan-300">{selectedNode.handle}</span>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-white mt-1">{selectedNode.displayName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedNode.geoLocation?.label}</p>
                  {selectedNode.passerbyIncentive && (
                    <p className="text-xs text-emerald-300 mt-2">{selectedNode.passerbyIncentive}</p>
                  )}
                  <button
                    onClick={() => onPitchAgent(selectedNode)}
                    className="mt-3 w-full rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                  >
                    Open A2A Pitch
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
            <span>
              <MapPin className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
              {agents.filter((a) => a.discoverableByPassersby).length} Discoverable Storefront Beacons
            </span>
            <span>
              <Navigation className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
              {rfps.filter((r) => r.broadcastChannels.includes('google_maps_billboard')).length} Live DOOH Billboard Geofences
            </span>
          </div>
        </div>

        {/* Right: Passerby Traffic Telemetry Feed */}
        <div className="lg:col-span-4 glass-panel rounded-2xl p-3.5 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              Passerby Handshake Feed
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {walking ? 'Scanning 50m...' : 'Idle'}
            </span>
          </div>

          {passerbyEvents.length === 0 ? (
            <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 text-center space-y-2">
              <Sparkles className="w-5 h-5 text-cyan-400 mx-auto" />
              <p className="text-xs font-medium text-slate-200">
                No ambient handshakes captured yet
              </p>
              <p className="text-[11px] text-slate-400">
                Tap "Simulate Walk" above to move your agent along Sandton corridors and auto-match nearby beacons.
              </p>
            </div>
          ) : (
            <SwipeScrollArea direction="vertical" className="max-h-[340px] sm:max-h-[410px]" innerClassName="space-y-2.5 pr-1">
              {passerbyEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-cyan-300 truncate">{evt.targetHandle}</span>
                    <span className="text-emerald-400 tabular-nums shrink-0">{evt.distanceMeters}m · {evt.matchScore}%</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{evt.summary}</p>
                  <p className="text-[11px] text-slate-500">{evt.locationLabel}</p>
                </div>
              ))}
            </SwipeScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};
