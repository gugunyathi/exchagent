import chrisMolemeImg from '../assets/images/person_chris_moleme_1794816507846.jpg';
import alexNkosiImg from '../assets/images/person_alex_nkosi_1794816508374.jpg';
import thandiDlaminiImg from '../assets/images/person_thandi_dlamini_1794816508586.jpg';
import woolworthsEsgImg from '../assets/images/brand_woolworths_esg_1794816508043.jpg';
import mtnSolarImg from '../assets/images/brand_mtn_solar_1794816509200.jpg';
import sandtonBistroImg from '../assets/images/brand_sandton_bistro_1794816510412.jpg';
import takealotFleetImg from '../assets/images/brand_takealot_fleet_1794816510253.jpg';
import webberLegalImg from '../assets/images/brand_webber_legal_1794816510643.jpg';
import emergency911Img from '../assets/images/civic_emergency_911_1794816511394.jpg';
import openAiCampusImg from '../assets/images/brand_openai_campus_1794909322157.jpg';
import heroSwitchzCommandImg from '../assets/images/hero_switchz_command_1794912243630.jpg';
import showcaseEventNetworkingImg from '../assets/images/showcase_event_networking_1794912245100.jpg';
import showcaseAiHiringImg from '../assets/images/showcase_ai_hiring_1794912244859.jpg';
import showcaseGlobalInfraImg from '../assets/images/showcase_global_infrastructure_1794912243795.jpg';
import type { AgentMediaItem } from '../types/firestore';

export const SHOWCASE_CORPORATE_IMAGES = {
  heroCommand: heroSwitchzCommandImg,
  eventNetworking: showcaseEventNetworkingImg,
  aiHiring: showcaseAiHiringImg,
  globalInfra: showcaseGlobalInfraImg,
};

export const AGENT_IMAGE_MAP: Record<string, string> = {
  agent_chris_moleme: chrisMolemeImg,
  'chris.moleme.agent': chrisMolemeImg,
  agent_alex_founder: alexNkosiImg,
  'alex.founder.agent': alexNkosiImg,
  agent_thandi_cto: thandiDlaminiImg,
  'thandi.cto.agent': thandiDlaminiImg,
  agent_woolworths_ceo: woolworthsEsgImg,
  'ceo.woolworths.agent': woolworthsEsgImg,
  agent_mtn_procurement: mtnSolarImg,
  'procurement.mtn.agent': mtnSolarImg,
  agent_sandton_bistro: sandtonBistroImg,
  'sandton.bistro.agent': sandtonBistroImg,
  agent_takealot_fleet: takealotFleetImg,
  'fleet.takealot.agent': takealotFleetImg,
  agent_webber_legal: webberLegalImg,
  'legal.webberwentzel.agent': webberLegalImg,
  agent_911_emergency: emergency911Img,
  '911.emergency.agent': emergency911Img,
  agent_openai_careers: openAiCampusImg,
  'careers.openai.agent': openAiCampusImg,
};

export interface ImagePresetOption {
  id: string;
  label: string;
  type: 'persona' | 'business';
  src: string;
}

export const AGENT_IMAGE_PRESETS: ImagePresetOption[] = [
  { id: 'chris', label: 'Exec Portrait M1', type: 'persona', src: chrisMolemeImg },
  { id: 'alex', label: 'Founder Portrait M2', type: 'persona', src: alexNkosiImg },
  { id: 'thandi', label: 'CTO Portrait F1', type: 'persona', src: thandiDlaminiImg },
  { id: 'openai', label: 'AI Research Lab', type: 'business', src: openAiCampusImg },
  { id: 'woolies', label: 'Retail & ESG', type: 'business', src: woolworthsEsgImg },
  { id: 'mtn', label: 'Solar & 5G Infra', type: 'business', src: mtnSolarImg },
  { id: 'bistro', label: 'Dining & Bistro', type: 'business', src: sandtonBistroImg },
  { id: 'takealot', label: 'EV Fleet Hub', type: 'business', src: takealotFleetImg },
  { id: 'webber', label: 'Legal Boardroom', type: 'business', src: webberLegalImg },
];

/**
 * Resolves the display image URL for an agent card, status circle, or reel slide.
 * Supports user-provided custom URLs, seed agent portraits/brand photos, and deterministic fallbacks.
 */
export function resolveAgentImage(agent: {
  id?: string;
  handle?: string;
  type?: 'persona' | 'business';
  avatarVariant?: string;
  imageUrl?: string;
}): string {
  if (agent.imageUrl && agent.imageUrl.trim().length > 0) {
    return agent.imageUrl.trim();
  }
  if (agent.id && AGENT_IMAGE_MAP[agent.id]) {
    return AGENT_IMAGE_MAP[agent.id];
  }
  if (agent.handle && AGENT_IMAGE_MAP[agent.handle]) {
    return AGENT_IMAGE_MAP[agent.handle];
  }
  if (agent.avatarVariant === 'chris') return chrisMolemeImg;
  if (agent.avatarVariant === 'alex') return alexNkosiImg;
  if (agent.avatarVariant === 'thandi') return thandiDlaminiImg;

  return agent.type === 'persona' ? chrisMolemeImg : webberLegalImg;
}

/**
 * Builds the scrollable media gallery (primary image, uploaded pitch video <=8s, motion images, and curated studio visuals)
 */
export function resolveAgentMediaGallery(agent: {
  id?: string;
  handle?: string;
  displayName?: string;
  roleTitle?: string;
  type?: 'persona' | 'business';
  avatarVariant?: string;
  imageUrl?: string;
  introVideoUrl?: string;
  mediaGallery?: AgentMediaItem[];
}): AgentMediaItem[] {
  const primaryImg = resolveAgentImage(agent);
  const customItems = Array.isArray(agent.mediaGallery) ? agent.mediaGallery : [];

  const items: AgentMediaItem[] = [];

  if (agent.introVideoUrl && !customItems.some((m) => m.url === agent.introVideoUrl)) {
    items.push({
      id: `${agent.id || 'agent'}_intro_video`,
      kind: 'video',
      url: agent.introVideoUrl,
      thumbnailUrl: primaryImg,
      title: `${agent.displayName || 'Agent'} — 8s Pitch Video`,
      durationSeconds: 8,
      caption: 'Uploaded 8-second intro pitch',
    });
  }

  for (const item of customItems) {
    items.push({
      ...item,
      durationSeconds: item.kind === 'video' ? Math.min(8, item.durationSeconds || 8) : item.durationSeconds,
      thumbnailUrl: item.thumbnailUrl || primaryImg,
    });
  }

  if (!items.some((m) => m.kind === 'image' && m.url === primaryImg)) {
    items.unshift({
      id: `${agent.id || 'agent'}_primary_photo`,
      kind: 'image',
      url: primaryImg,
      thumbnailUrl: primaryImg,
      title: `${agent.displayName || 'Agent'} — Identity Portrait`,
      caption: agent.roleTitle || 'Verified .agent visual identity',
    });
  }

  // Ensure every card has an 8s Motion / Pitch Reel + Scrollable Corporate Gallery out of the box
  if (!items.some((m) => m.kind === 'motion_image' || m.kind === 'video')) {
    items.push({
      id: `${agent.id || 'agent'}_motion_pitch`,
      kind: 'motion_image',
      url: primaryImg,
      thumbnailUrl: primaryImg,
      title: `${agent.displayName || 'Agent'} — 8s Motion Pitch`,
      durationSeconds: 8,
      caption: 'Interactive 8s pitch spotlight with audio summary in full screen',
    });
  }

  const secondaryGallerySrc =
    agent.type === 'persona' ? showcaseEventNetworkingImg : showcaseGlobalInfraImg;
  const tertiaryGallerySrc =
    agent.type === 'persona' ? showcaseAiHiringImg : heroSwitchzCommandImg;

  if (!items.some((m) => m.url === secondaryGallerySrc)) {
    items.push({
      id: `${agent.id || 'agent'}_gallery_2`,
      kind: 'image',
      url: secondaryGallerySrc,
      thumbnailUrl: secondaryGallerySrc,
      title: agent.type === 'persona' ? 'Summit & Proximity Exchange' : 'Global Enterprise Network',
      caption: 'Verified SWITCHZ proximity & commercial presence',
    });
  }

  if (!items.some((m) => m.url === tertiaryGallerySrc)) {
    items.push({
      id: `${agent.id || 'agent'}_gallery_3`,
      kind: 'image',
      url: tertiaryGallerySrc,
      thumbnailUrl: tertiaryGallerySrc,
      title: agent.type === 'persona' ? 'Verified Interview & Talent Desk' : 'Autonomous Command Desk',
      caption: 'Real-time A2A & hiring studio environment',
    });
  }

  return items;
}
