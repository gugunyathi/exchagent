import React from 'react';
import { Sparkles, ShieldAlert, Play } from 'lucide-react';
import { AgentDoc } from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';

interface PromotedStatusCirclesProps {
  agents: AgentDoc[];
  selectedAgentId?: string | null;
  onOpenReelForAgent: (agent: AgentDoc) => void;
}

export const PromotedStatusCircles: React.FC<PromotedStatusCirclesProps> = ({
  agents,
  selectedAgentId,
  onOpenReelForAgent,
}) => {
  const promoted = React.useMemo(() => {
    const withPromo = agents.filter((a) => a.discoverableByPassersby || a.passerbyIncentive);
    const rest = agents.filter((a) => !a.discoverableByPassersby && !a.passerbyIncentive);
    return [...withPromo, ...rest];
  }, [agents]);

  if (promoted.length === 0) return null;

  return (
    <div className="shrink-0 z-20 -mx-1 px-1 pb-1">
      <SwipeScrollArea
        direction="horizontal"
        stepPx={180}
        className="w-full"
        innerClassName="flex items-center gap-2.5 sm:gap-3 px-6 sm:px-8 py-0.5"
      >
        {promoted.map((agent) => {
          const isSelected = selectedAgentId === agent.id;
          const isEmergency = agent.handle === '911.emergency.agent';
          const isPersona = agent.type === 'persona';
          const shortName = isEmergency
            ? '911'
            : agent.displayName.split(' ')[0].slice(0, 8);
          const initials =
            agent.brandLogoCode ||
            agent.displayName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

          const ringClass = isEmergency
            ? 'from-rose-500 via-amber-400 to-rose-600'
            : isPersona
            ? 'from-cyan-400 via-sky-500 to-emerald-400'
            : 'from-amber-400 via-emerald-400 to-cyan-400';

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onOpenReelForAgent(agent)}
              className="group flex flex-col items-center gap-0.5 shrink-0 min-w-[50px] min-h-[44px] justify-center focus:outline-none cursor-pointer active:scale-95 transition-transform"
              title={`${agent.displayName} Reel`}
              aria-label={`Open ${agent.displayName} reel`}
            >
              <div
                className={`relative p-[2px] rounded-full bg-gradient-to-tr ${ringClass} shadow-[0_4px_14px_rgba(2,6,23,0.65)] transition-transform duration-150 ${
                  isSelected ? 'scale-105 ring-2 ring-white/75' : 'opacity-95 group-hover:scale-105'
                }`}
              >
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-[#050811] flex items-center justify-center overflow-hidden text-white font-display font-bold text-[10.5px] relative"
                  style={{
                    background: isPersona
                      ? 'linear-gradient(135deg, #0B4C84 0%, #06325C 100%)'
                      : agent.brandColor || '#0F172A',
                  }}
                >
                  {isEmergency ? (
                    <ShieldAlert className="w-4 h-4 text-white" />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <span className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-3 h-3 text-white fill-white" />
                  </span>
                </div>

                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-[#050811] flex items-center justify-center text-[7px] font-bold ${
                    isEmergency
                      ? 'bg-rose-500 text-white'
                      : isPersona
                      ? 'bg-[#0A66C2] text-white'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {isPersona ? 'in' : <Sparkles className="w-2 h-2" />}
                </span>
              </div>

              <span
                className={`px-1 rounded text-[9.5px] font-medium truncate max-w-[54px] ${
                  isSelected ? 'text-cyan-300 font-semibold' : 'text-slate-300'
                }`}
              >
                {shortName}
              </span>
            </button>
          );
        })}
      </SwipeScrollArea>
    </div>
  );
};
