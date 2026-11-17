import React from 'react';
import {
  Handshake,
  Megaphone,
  Sparkles,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { AgentStatusCategory } from '../types/firestore';

interface StatusCategoryBadgeProps {
  category: AgentStatusCategory;
  authorType: 'persona' | 'business';
  isEmergency?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * Circular corner/header status icon badge:
 * - 'hired': Deep blue circle with white Handshake icon (auto or manual job hire)
 * - 'deal_approved': Bright blue circle with white $ + bottom-right green checkmark (deal signed off)
 * - 'sponsored_ad': Amber circle with Megaphone Ad icon
 * - 'generic': LinkedIn 'in' for personal users or AI Sparkles for companies
 */
export const StatusCategoryBadge: React.FC<StatusCategoryBadgeProps> = ({
  category,
  authorType,
  isEmergency = false,
  size = 'sm',
  className = '',
}) => {
  if (isEmergency) {
    const dim = size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
    const iconDim = size === 'xs' ? 'w-2 h-2' : size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
    return (
      <span
        className={`${dim} rounded-full bg-rose-500 text-white border border-zinc-100 dark:border-[#09090b] inline-flex items-center justify-center shadow-xs ${className}`}
        title="Civic Emergency Dispatch"
      >
        <ShieldAlert className={iconDim} />
      </span>
    );
  }

  if (category === 'hired') {
    const dim = size === 'xs' ? 'w-4 h-4' : size === 'sm' ? 'w-[18px] h-[18px]' : 'w-7 h-7';
    const iconDim = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-2.5 h-2.5' : 'w-4 h-4';
    return (
      <span
        className={`${dim} rounded-full bg-[#0B4F9C] text-white border-[1.5px] border-white dark:border-[#09090b] inline-flex items-center justify-center shadow-sm ${className}`}
        title="Hired Status — Job Accepted / Signed Off"
      >
        <Handshake className={iconDim} />
      </span>
    );
  }

  if (category === 'deal_approved') {
    const dim = size === 'xs' ? 'w-4 h-4 text-[9px]' : size === 'sm' ? 'w-[18px] h-[18px] text-[10px]' : 'w-7 h-7 text-sm';
    const checkWrap =
      size === 'xs'
        ? 'w-2 h-2 -bottom-0.5 -right-0.5'
        : size === 'sm'
        ? 'w-2.5 h-2.5 -bottom-0.5 -right-0.5'
        : 'w-3.5 h-3.5 -bottom-0.5 -right-0.5';
    const checkIcon = size === 'xs' ? 'w-1.5 h-1.5' : size === 'sm' ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5';
    return (
      <span
        className={`relative ${dim} rounded-full bg-[#007BFF] text-white border-[1.5px] border-white dark:border-[#09090b] inline-flex items-center justify-center font-bold leading-none shadow-sm ${className}`}
        title="Business Deal Approved & Signed Off"
      >
        <span className="leading-none -mt-[0.5px]">$</span>
        <span
          className={`absolute ${checkWrap} rounded-full bg-emerald-500 text-white border border-white dark:border-[#09090b] inline-flex items-center justify-center`}
        >
          <Check className={`${checkIcon} stroke-[3]`} />
        </span>
      </span>
    );
  }

  if (category === 'sponsored_ad') {
    const dim = size === 'xs' ? 'w-4 h-4' : size === 'sm' ? 'w-[18px] h-[18px]' : 'w-7 h-7';
    const iconDim = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-2.5 h-2.5' : 'w-4 h-4';
    return (
      <span
        className={`${dim} rounded-full bg-amber-400 text-zinc-950 border-[1.5px] border-white dark:border-[#09090b] inline-flex items-center justify-center shadow-sm ${className}`}
        title="Sponsored Ad"
      >
        <Megaphone className={iconDim} />
      </span>
    );
  }

  // 'generic' -> LinkedIn 'in' for Persona users, AI Sparkles for Business/Companies
  const dim = size === 'xs' ? 'w-3.5 h-3.5 text-[7px]' : size === 'sm' ? 'w-4 h-4 text-[7.5px]' : 'w-7 h-7 text-[11px]';
  const iconDim = size === 'xs' ? 'w-2 h-2' : size === 'sm' ? 'w-2.5 h-2.5' : 'w-4 h-4';

  if (authorType === 'persona') {
    return (
      <span
        className={`${dim} rounded-full bg-[#0A66C2] text-white border border-zinc-100 dark:border-[#09090b] inline-flex items-center justify-center font-bold shadow-xs ${className}`}
        title="LinkedIn Verified User Status"
      >
        in
      </span>
    );
  }

  return (
    <span
      className={`${dim} rounded-full bg-white text-zinc-950 dark:bg-zinc-100 border border-zinc-200 dark:border-[#09090b] inline-flex items-center justify-center font-bold shadow-xs ${className}`}
      title="AI Company Agent Status"
    >
      <Sparkles className={iconDim} />
    </span>
  );
};

export function getStatusCategoryLabel(
  category: AgentStatusCategory,
  authorType: 'persona' | 'business'
): string {
  switch (category) {
    case 'hired':
      return 'Hired';
    case 'deal_approved':
      return 'Deal Approved';
    case 'sponsored_ad':
      return 'Sponsored Ad';
    case 'generic':
    default:
      return authorType === 'persona' ? 'LinkedIn Update' : 'AI Update';
  }
}
