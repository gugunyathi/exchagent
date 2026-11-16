import React from 'react';
import { Sparkles, ShieldAlert, Play } from 'lucide-react';
import { AgentDoc } from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';
import { resolveAgentImage } from '../lib/agentImages';

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
  const [imgErrors, setImgErrors] = React.useState<Record<string, boolean>>({});

  const promoted = React.useMemo(() => {
    const withPromo = agents.filter((a) => a.discoverableByPassersby || a.passerbyIncentive);
    const rest = agents.filter((a) => !a.discoverableByPassersby && !a.passerbyIncentive);
    return [...withPromo, ...rest];
  }, [agents]);

  if (promoted.length === 0) return null;

  return (
    <div className="shrink-0 z-20 -mx-1 px-1 pb-1.5">
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
          const picSrc = resolveAgentImage(agent);
          const hasImg = Boolean(picSrc) && !imgErrors[agent.id];
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
            ? 'bg-rose-500'
            : agent.discoverableByPassersby
            ? 'bg-emerald-500 dark:bg-emerald-400'
            : 'bg-zinc-400 dark:bg-zinc-600';

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
                className={`relative p-[2px] rounded-full ${ringClass} transition-transform duration-150 ${
                  isSelected
                    ? 'scale-105 ring-2 ring-zinc-950/75 dark:ring-white/80'
                    : 'opacity-95 group-hover:scale-105'
                }`}
              >
                <div
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-zinc-100 dark:border-[#09090b] flex items-center justify-center overflow-hidden text-white font-display font-bold text-[10.5px] relative"
                  style={{
                    backgroundColor: isPersona ? '#18181b' : agent.brandColor || '#18181b',
                  }}
                >
                  {hasImg ? (
                    <img
                      src={picSrc}
                      alt={agent.displayName}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrors((prev) => ({ ...prev, [agent.id]: true }))
                      }
                      className={`w-full h-full object-cover ${
                        isPersona ? 'object-top' : 'object-center'
                      }`}
                    />
                  ) : isEmergency ? (
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-3 h-3 text-white fill-white" />
                  </span>
                </div>

                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-zinc-100 dark:border-[#09090b] flex items-center justify-center text-[7px] font-bold ${
                    isEmergency
                      ? 'bg-rose-500 text-white'
                      : isPersona
                      ? 'bg-[#0A66C2] text-white'
                      : 'bg-white text-zinc-950 dark:bg-zinc-100'
                  }`}
                >
                  {isPersona ? 'in' : <Sparkles className="w-2 h-2" />}
                </span>
              </div>

              <span
                className={`px-1 rounded text-[9.5px] font-medium truncate max-w-[54px] ${
                  isSelected
                    ? 'text-zinc-950 dark:text-white font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400'
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
