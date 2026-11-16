import chrisMolemeImg from '../assets/images/person_chris_moleme_1794816507846.jpg';
import alexNkosiImg from '../assets/images/person_alex_nkosi_1794816508374.jpg';
import thandiDlaminiImg from '../assets/images/person_thandi_dlamini_1794816508586.jpg';
import woolworthsEsgImg from '../assets/images/brand_woolworths_esg_1794816508043.jpg';
import mtnSolarImg from '../assets/images/brand_mtn_solar_1794816509200.jpg';
import sandtonBistroImg from '../assets/images/brand_sandton_bistro_1794816510412.jpg';
import takealotFleetImg from '../assets/images/brand_takealot_fleet_1794816510253.jpg';
import webberLegalImg from '../assets/images/brand_webber_legal_1794816510643.jpg';
import emergency911Img from '../assets/images/civic_emergency_911_1794816511394.jpg';

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
