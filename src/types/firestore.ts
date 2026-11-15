export const ZAR_PER_USD = 18.52;

export type CurrencyMode = 'ZAR' | 'USD';

export type SurfaceMode = 'desktop' | 'mobile' | 'watch' | 'ar' | 'carplay';

export type BroadcastChannel = 'directory' | 'google_maps_billboard' | 'ble_beacon' | 'carplay';

export type PaymentRail = 'paypal_vault' | 'x402_base' | 'x402_arc' | 'x402_solana';

export interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

export interface AgentGuardrails {
  maxAutoSpendZAR: number;
  minDiscountPct: number;
  blockedCategories: string[];
  workingHoursSAST?: string;
  meetingBufferMins?: number;
  minExecMeetingValueZAR?: number;
}

export interface AgentWalletAddresses {
  base?: string;
  solana?: string;
  arc?: string;
  paypalVaultId?: string;
}

export interface AgentGeoLocation {
  lat: number;
  lng: number;
  radiusMeters: number;
  label?: string;
}

export type AgentRoleCategory = 'commerce' | 'job_seeker' | 'hiring' | 'recruiter' | 'civic';

export interface InterviewVideoVerification {
  verdict: 'VERIFIED_HUMAN' | 'SUSPICIOUS_SYNTHETIC' | 'PENDING_REVIEW';
  authenticityScore: number;
  deepfakeRiskPct: number;
  livenessSignals: {
    facialMicroExpressions: number;
    lipAudioSync: number;
    lightingSkinTexture: number;
    compressionArtifactCheck: number;
  };
  forensicNotes: string[];
  transcriptSummary: string;
  extractedCompetencies: string[];
  verifierEngine: string;
  sha256Digest: string;
  verifiedAt: string;
}

export interface PreScreenReview {
  id: string;
  reviewerType: 'agent' | 'human';
  reviewerHandle: string;
  reviewerName: string;
  decision: 'PASS' | 'SHORTLIST' | 'HOLD' | 'REJECT';
  score: number;
  notes: string;
  timestamp: string;
}

export interface InterviewVideoRecord {
  id: string;
  title: string;
  capturedVia: 'upload' | 'webcam_record';
  mimeType: string;
  durationSeconds: number;
  challengeCode?: string;
  posterFrameDataUrl?: string;
  uploadedAt: string;
  verification: InterviewVideoVerification;
  preScreenReviews: PreScreenReview[];
}

export interface SeekerCvProfile {
  headline: string;
  yearsExp: number;
  parsedSkills: string[];
  preferredRoles: string[];
  salaryMinZAR?: number;
  remoteOnly?: boolean;
  blindScreening?: boolean;
  rawCvExcerpt?: string;
}

export type CardBannerStyle =
  | 'gradient'
  | 'circuit'
  | 'mesh'
  | 'geometric'
  | 'horizon'
  | 'monogram'
  | 'wave'
  | 'carbon'
  | 'minimal';

export type CardBackgroundPattern =
  | 'none'
  | 'subtle-grid'
  | 'dots'
  | 'aurora'
  | 'topo'
  | 'stripes'
  | 'circuit';

export type CardBackgroundTheme =
  | 'default'
  | 'pearl'
  | 'obsidian'
  | 'emerald'
  | 'sapphire'
  | 'amber'
  | 'amethyst'
  | 'cyber';

export type CardEdgeRadius =
  | 'rounded-none'
  | 'rounded-xl'
  | 'rounded-2xl'
  | 'rounded-3xl'
  | 'rounded-[28px]';

export type CardBorderStyle =
  | 'hairline'
  | 'bold-accent'
  | 'cyber-glow'
  | 'double'
  | 'dashed-tech'
  | 'frosted-glass';

export interface AgentCardCustomization {
  bannerStyle: CardBannerStyle;
  bannerBgColor?: string;
  bannerTextColor?: string;
  bannerHeight?: 'compact' | 'normal' | 'tall';
  bannerBadgeStyle?: 'pill' | 'outline' | 'glass' | 'none';
  backgroundPattern: CardBackgroundPattern;
  backgroundTheme: CardBackgroundTheme;
  customBgColor?: string;
  edgeRadius: CardEdgeRadius;
  borderStyle: CardBorderStyle;
  borderAccentColor?: string;
}

export interface AgentDoc {
  id: string;
  handle: string;
  ownerUid: string;
  displayName: string;
  roleTitle: string;
  organization: string;
  type: 'persona' | 'business';
  agentRoleCategory?: AgentRoleCategory;
  poppySubdomain?: string;
  poppyScopes?: string[];
  cvSummary?: SeekerCvProfile;
  interviewVideo?: InterviewVideoRecord;
  careersUrl?: string;
  verified: boolean;
  popiaConsentActive: boolean;
  voiceNumber: string;
  shortcode?: string;
  agentEmail: string;
  mcpEndpoint: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  brandColor?: string;
  brandLogoCode?: string;
  avatarVariant?: 'chris' | 'alex' | 'thandi' | 'persona';
  cardStyle?: AgentCardCustomization;
  did?: string;
  protocol?: string;
  interactEndpoint?: string;
  authMethods?: string;
  tagline?: string;
  summary?: string;
  skills: string[];
  guardrails: AgentGuardrails;
  walletAddresses: AgentWalletAddresses;
  geoLocation?: AgentGeoLocation;
  discoverableByPassersby?: boolean;
  passerbyIncentive?: string;
  calendarSyncEnabled?: boolean;
  gmailBridgeEnabled?: boolean;
  createdAt: string | FirestoreTimestampLike;
}

// Poppy Protocol v1.0 + Official Extensions Types
export type PoppyExtensionName =
  | 'operations'
  | 'links'
  | 'disclosures'
  | 'browser-control'
  | 'mediated-sign-in'
  | 'ucp';

export interface PoppyScopeHint {
  summary: string;
  changes?: 'none' | 'reversible' | 'irreversible';
  personal_data?: boolean;
  sensitive?: boolean;
}

export interface PoppyDocument {
  protocol_version: string;
  supported_versions: string[];
  organization: {
    name: string;
    website: string;
    contact?: string;
    privacy_policy?: string;
    terms?: string;
  };
  auth: {
    client_metadata_document?: string;
    scopes: string[];
    scope_hints?: Record<string, PoppyScopeHint>;
    sign_in_types?: string[];
  };
  agent: {
    protocols: Record<
      string,
      {
        version: string;
        endpoint: string;
        modes?: string[];
      }
    >;
    entity_role?: AgentRoleCategory;
    handle?: string;
  };
  web?: {
    browser_session_endpoint?: string;
  };
  tasks?: {
    endpoint: string;
  };
  apis?: {
    openapi?: string;
    mcp?: string;
  };
  extensions?: Record<
    string,
    {
      version: number;
      endpoint?: string;
      description?: string;
      modes?: string[];
      supported_providers?: string[];
    }
  >;
}

export interface PoppyOperation {
  operation_id: string;
  revision: string;
  actionType: 'apply_job' | 'shortlist_candidate' | 'book_interview' | 'send_offer' | 'settle_fee' | 'grant_scope';
  summary: string;
  terms: Record<string, string | number | boolean>;
  expires_at: string;
  status: 'pending' | 'approved' | 'performing' | 'performed' | 'declined';
  approver?: 'user' | 'agent';
  reference?: string;
  createdAt: string;
  executedAt?: string;
  targetHandle?: string;
  actorHandle?: string;
}

export interface PoppyLinkItem {
  url: string;
  title: string;
}

export interface PoppyDisclosureItem {
  id: string;
  severity: 'info' | 'notice' | 'mandatory';
  category: string;
  text: string;
}

export interface PoppyMessageExtensionPayload {
  links?: { items: PoppyLinkItem[] };
  disclosures?: { items: PoppyDisclosureItem[] };
  'browser-control'?: { controller: 'agent' | 'user'; step?: string; url?: string };
  'mediated-sign-in'?: { mode: 'credential_vault' | 'otp_bridge'; provider: string; status: string };
  ucp?: { merchant_id: string; cart_ref?: string; checkout_url?: string };
  operations?: {
    operation_id: string;
    revision: string;
    summary: string;
    expires_at: string;
    terms: Record<string, string | number | boolean>;
    user_requested?: boolean;
  };
}

export interface PoppyConversationEvent {
  id: string;
  cursor: string;
  type: 'message' | 'status' | 'handoff' | 'handoff_cancelled' | 'operation_required' | 'operation_performed' | 'closed';
  author: {
    type: 'agent' | 'human';
    name: string;
    handle?: string;
  };
  text: string;
  timestamp: string;
  extensions?: PoppyMessageExtensionPayload;
  directConversationId?: string;
}

export interface PoppyConversation {
  id: string;
  targetHandle: string;
  initiatorHandle: string;
  status: 'working' | 'handoff' | 'responder' | 'closed';
  protocolVersion: string;
  negotiatedExtensions: Record<string, number>;
  parentConversationId?: string;
  browserController: 'agent' | 'user';
  events: PoppyConversationEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PoppyConsentGrant {
  id: string;
  agentHandle: string;
  targetHandle: string;
  scope: string;
  summary: string;
  changes: 'none' | 'reversible' | 'irreversible';
  personalData: boolean;
  granted: boolean;
  grantedAt: string;
  revokedAt?: string;
}

export interface PoppyAuditLogEntry {
  id: string;
  timestamp: string;
  actorHandle: string;
  targetHandle: string;
  action: string;
  protocol: string;
  operationId?: string;
  reference?: string;
  details: string;
  popiaMinimized: boolean;
}

export interface JobPostingDoc {
  id: string;
  companyAgentHandle: string;
  companyName: string;
  title: string;
  location: string;
  remoteMode: 'Remote' | 'Hybrid' | 'On-Site';
  salaryRangeZAR: [number, number];
  requiredSkills: string[];
  minYearsExp: number;
  status: 'OPEN' | 'PAUSED' | 'FILLED';
  autonomyLevel: 'approve_each' | 'shortlist_auto_offer_approve' | 'blind_screening_first';
  careersUrl: string;
  poppyDiscoveryPath: string;
  weights: {
    skills: number;
    experience: number;
    compensation: number;
    location: number;
  };
  createdAt: string;
}

export interface RecruitmentMatchDoc {
  id: string;
  jobId: string;
  jobTitle: string;
  companyAgentHandle: string;
  seekerHandle: string;
  seekerName: string;
  recruiterHandle?: string;
  score: number;
  factors: {
    skillsOverlap: number;
    experienceFit: number;
    compensationFit: number;
    locationCultureFit: number;
  };
  explanation: string;
  strengths: string[];
  gaps: string[];
  blindMode: boolean;
  status: 'suggested' | 'applied' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';
  operationId?: string;
  updatedAt: string;
}

export interface RfpDoc {
  id: string;
  publisherAgentId: string;
  publisherOwnerUid: string;
  publisherHandle: string;
  title: string;
  description: string;
  budgetZAR: number;
  budgetUSD: number;
  category: string;
  broadcastChannels: BroadcastChannel[];
  location?: {
    lat: number;
    lng: number;
    billboardName?: string;
    radiusMeters: number;
  };
  status: 'OPEN' | 'NEGOTIATING' | 'AWARDED' | 'EXPIRED';
  expiresAt: string;
  matchedProposalsCount?: number;
}

export interface NegotiationMessage {
  sender: string;
  senderRole: 'seller' | 'buyer';
  type: 'offer' | 'counter_offer' | 'accept' | 'reject';
  priceZAR: number;
  rationale: string;
  timestamp: string;
  toolCall?: string;
}

export interface NegotiationDoc {
  id: string;
  rfpId?: string;
  initiatorAgentId: string;
  initiatorOwnerUid: string;
  targetAgentId: string;
  targetOwnerUid: string;
  initiatorHandle: string;
  targetHandle: string;
  surface: SurfaceMode | string;
  status: 'BARGAINING' | 'OFFER_ACCEPTED' | 'REJECTED' | 'SETTLED';
  stickerPriceZAR: number;
  currentOfferZAR: number;
  agreedPriceZAR?: number;
  messages: NegotiationMessage[];
  popiaAuditHash: string;
  updatedAt: string;
}

export interface SettlementDoc {
  id: string;
  sessionId: string;
  buyerHandle: string;
  sellerHandle: string;
  ownerUid: string;
  channel: string;
  stickerPriceZAR: number;
  amountZAR: number;
  amountUSD: number;
  savedZAR: number;
  savedPct: number;
  rail: PaymentRail;
  txHash: string;
  status: 'SETTLED';
  settledAt: string;
}

// Part 2: .agent Handle, Number & Brand Identity Registry, Auctions, Secondary Marketplace
export interface AgentHandleDoc {
  id: string;
  handle: string;
  category: 'brand' | 'iconic_number' | 'short_handle' | 'standard' | 'protected';
  charLength: number;
  ownerUid: string;
  ownerDisplayName: string;
  tierPriceUSD: number;
  paidVia: 'free_human' | 'x402_usdc' | 'paypal_vault' | 'auction_win';
  status: 'ACTIVE' | 'RESERVED_PROTECTED' | 'IN_AUCTION' | 'LISTED_FOR_SALE';
  claimedAt: string;
}

export interface AuctionBid {
  bidderUid: string;
  bidderHandle: string;
  amountUSD: number;
  timestamp: string;
}

export interface AuctionDoc {
  id: string;
  handle: string;
  kind: 'iconic_number' | 'enterprise_brand';
  description: string;
  reserveUSD: number;
  currentBidUSD: number;
  highestBidderHandle: string;
  bidsCount: number;
  bids: AuctionBid[];
  status: 'LIVE' | 'SETTLED';
  endsAt: string;
}

export interface SecondaryListingDoc {
  id: string;
  handle: string;
  sellerUid: string;
  sellerHandle: string;
  buyoutPriceUSD: number;
  minOfferUSD: number;
  category: string;
  status: 'AVAILABLE' | 'SOLD';
  listedAt: string;
}

// Part 3: Calendar Bookings, Agentic Emails, Voice & Chat Dialer Sessions
export interface BookingDoc {
  id: string;
  sessionId?: string;
  organizerAgentId: string;
  organizerHandle: string;
  attendeeAgentId: string;
  attendeeHandle: string;
  ownerUid: string;
  title: string;
  jobId?: string;
  jobTitle?: string;
  interviewMode?: 'live_video' | 'agent_screen' | 'commercial';
  startTime: string;
  endTime: string;
  meetLink: string;
  dealValueZAR: number;
  googleSynced: boolean;
  status: 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED';
}

export interface AgentEmailDoc {
  id: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  body: string;
  replyBody?: string;
  threadId: string;
  ownerUid: string;
  aiClassification: 'QUALIFIED_PITCH' | 'RFP_RESPONSE' | 'SPAM_BLOCKED' | 'MEETING_CONFIRMED';
  autoReplied: boolean;
  proposedPriceZAR?: number;
  timestamp: string;
}

export interface VoiceTranscriptEntry {
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

export interface DispatchedUnit {
  id: string;
  unitType: 'Ambulance' | 'Fire' | 'Metro Police' | 'Armed Response';
  callsign: string;
  etaMinutes: number;
  lat: number;
  lng: number;
  status: 'DISPATCHED' | 'EN_ROUTE' | 'ARRIVED';
}

export interface VoiceChatSessionDoc {
  id: string;
  callerUid: string;
  targetHandle: string;
  dialedNumber: string;
  channel: 'voice' | 'chat';
  isEmergency: boolean;
  feeUSD: number;
  gpsCoords?: { lat: number; lng: number };
  transcript: VoiceTranscriptEntry[];
  dispatchedUnits?: DispatchedUnit[];
  createdAt: string;
}

export interface PasserbyHandshakeEvent {
  id: string;
  agentHandle: string;
  targetHandle: string;
  locationLabel: string;
  distanceMeters: number;
  matchScore: number;
  summary: string;
  incentive?: string;
  timestamp: string;
}

export function zarToUsd(zar: number): number {
  return Number((zar / ZAR_PER_USD).toFixed(2));
}

export function usdToZar(usd: number): number {
  return Math.round(usd * ZAR_PER_USD);
}

export function formatMoney(amountZAR: number, currency: CurrencyMode): string {
  if (currency === 'USD') {
    const usd = zarToUsd(amountZAR);
    return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `R${Math.round(amountZAR).toLocaleString('en-ZA')}`;
}
