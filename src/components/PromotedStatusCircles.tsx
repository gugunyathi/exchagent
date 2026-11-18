import React from 'react';
import { ShieldAlert, Play, Plus } from 'lucide-react';
import { AgentDoc, AgentStatusPostDoc } from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';
import { resolveAgentImage } from '../lib/agentImages';
import { StatusCategoryBadge, getStatusCategoryLabel } from './StatusCategoryBadge';

interface PromotedStatusCirclesProps {
  agents: AgentDoc[];
  statusPosts?: AgentStatusPostDoc[];
  selectedAgentId?: string | null;
  onOpenReelForAgent: (agent: AgentDoc) => void;
  onOpenReelForStatus?: (status: AgentStatusPostDoc) => void;
  onOpenPostStatus?: () => void;
}

export const PromotedStatusCircles: React.FC<PromotedStatusCirclesProps> = ({
  agents,
  statusPosts = [],
  selectedAgentId,
  onOpenReelForAgent,
  onOpenReelForStatus,
  onOpenPostStatus,
}) => {
  const [imgErrors, setImgErrors] = React.useState<Record<string, boolean>>({});

  const agentById = React.useMemo(() => {
    const map = new Map<string, AgentDoc>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const remainingAgents = React.useMemo(() => {
    const postedAgentIds = new Set(statusPosts.map((s) => s.agentId));
    const filtered = agents.filter((a) => !postedAgentIds.has(a.id));
    const withPromo = filtered.filter((a) => a.discoverableByPassersby || a.passerbyIncentive);
    const rest = filtered.filter((a) => !a.discoverableByPassersby && !a.passerbyIncentive);
    return [...withPromo, ...rest];
  }, [agents, statusPosts]);

  if (statusPosts.length === 0 && agents.length === 0) return null;

  return (
    <div className="shrink-0 z-20 -mx-1 px-1 pb-1.5">
      <SwipeScrollArea
        direction="horizontal"
        showArrows={true}
        arrowSize="sm"
        stepPx={180}
        className="w-full"
        innerClassName="flex items-center gap-2.5 sm:gap-3 px-7 sm:px-8 py-0.5"
      >
        {/* 1-Click + Post Status Circle */}
        {onOpenPostStatus && (
          <button
            type="button"
            onClick={onOpenPostStatus}
            className="group flex flex-col items-center gap-0.5 shrink-0 min-w-[50px] min-h-[44px] justify-center focus:outline-none cursor-pointer active:scale-95 transition-transform"
            title="Post a Hired, Deal Approved, Sponsored Ad, or Generic Status"
            aria-label="Post new status"
          >
            <div className="relative p-[2px] rounded-full border-2 border-dashed border-sky-500/75 dark:border-sky-400/75 group-hover:scale-105 transition-transform">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
            </div>
            <span className="px-1 rounded text-[9.5px] font-semibold text-sky-700 dark:text-sky-400 truncate max-w-[54px]">
              Post
            </span>
          </button>
        )}

        {/* Dedicated Status Circles (Hired Handshake, Deal Approved $, Sponsored Ad, Generic in/AI) */}
        {statusPosts.map((status) => {
          const author = agentById.get(status.agentId);
          const isSelected = selectedAgentId === status.agentId;
          const isPersona = status.authorType === 'persona';
          const picSrc = author ? resolveAgentImage(author) : undefined;
          const hasImg = Boolean(picSrc) && !imgErrors[status.id];
          const firstWord = status.authorName.split(' ')[0].slice(0, 7);
          const tagSuffix =
            status.category === 'hired'
              ? '·Hire'
              : status.category === 'deal_approved'
              ? '·Deal'
              : status.category === 'sponsored_ad'
              ? '·Ad'
              : '';
          const label = `${firstWord}${tagSuffix}`;
          const initials =
            author?.brandLogoCode ||
            status.authorName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

          const ringClass =
            status.category === 'hired'
              ? 'bg-[#0B4F9C]'
              : status.category === 'deal_approved'
              ? 'bg-[#007BFF]'
              : status.category === 'sponsored_ad'
              ? 'bg-amber-400'
              : 'bg-emerald-500 dark:bg-emerald-400';

          return (
            <button
              key={status.id}
              type="button"
              onClick={() => {
                if (onOpenReelForStatus) {
                  onOpenReelForStatus(status);
                } else if (author) {
                  onOpenReelForAgent(author);
                }
              }}
              className="group flex flex-col items-center gap-0.5 shrink-0 min-w-[50px] min-h-[44px] justify-center focus:outline-none cursor-pointer active:scale-95 transition-transform"
              title={`${status.authorName} — ${getStatusCategoryLabel(status.category, status.authorType)}: ${status.headline}`}
              aria-label={`Open ${status.authorName} ${getStatusCategoryLabel(status.category, status.authorType)} status`}
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
                    backgroundColor: isPersona
                      ? '#18181b'
                      : author?.brandColor || status.accentColor || '#18181b',
                  }}
                >
                  {hasImg ? (
                    <img
                      src={picSrc}
                      alt={status.authorName}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrors((prev) => ({ ...prev, [status.id]: true }))
                      }
                      className={`w-full h-full object-cover ${
                        isPersona ? 'object-top' : 'object-center'
                      }`}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-3 h-3 text-white fill-white" />
                  </span>
                </div>

                <span className="absolute -bottom-0.5 -right-0.5">
                  <StatusCategoryBadge
                    category={status.category}
                    authorType={status.authorType}
                    size="sm"
                  />
                </span>
              </div>

              <span
                className={`px-1 rounded text-[9.5px] font-medium truncate max-w-[58px] ${
                  isSelected
                    ? 'text-zinc-950 dark:text-white font-semibold'
                    : status.category === 'hired'
                    ? 'text-[#0B4F9C] dark:text-sky-300 font-semibold'
                    : status.category === 'deal_approved'
                    ? 'text-[#0062CC] dark:text-sky-300 font-semibold'
                    : status.category === 'sponsored_ad'
                    ? 'text-amber-700 dark:text-amber-400 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}

        {/* Remaining Directory Agent Circles (Default LinkedIn 'in' or AI Sparkles) */}
        {remainingAgents.map((agent) => {
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

                <span className="absolute -bottom-0.5 -right-0.5">
                  <StatusCategoryBadge
                    category="generic"
                    authorType={agent.type}
                    isEmergency={isEmergency}
                    size="xs"
                  />
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
