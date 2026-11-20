import {
  LocalCurrencyCode,
  formatCurrencyFromUsd,
  getFxRatePerUsd,
} from '../lib/fx';

export const ZAR_PER_USD = 18.52;

export type CurrencyMode = LocalCurrencyCode;

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

export interface HrTeamMember {
  id: string;
  name: string;
  roleTitle: string;
  email: string;
  agentHandle: string;
  permissions: Array<'view_docs' | 'shortlist' | 'interview' | 'offer' | 'manage_team'>;
  addedAt: string;
}

export interface AgentMediaItem {
  id: string;
  kind: 'image' | 'video' | 'motion_image';
  url: string;
  thumbnailUrl?: string;
  title?: string;
  durationSeconds?: number;
  caption?: string;
}

export type IntentCategory =
  | 'career_role'
  | 'commercial_deal'
  | 'rfp_sourcing'
  | 'partnership'
  | 'investment'
  | 'event_networking';

export interface AgentIntentProfile {
  categories: IntentCategory[];
  headline: string;
  desiredOutcomes: string[];
  topics: string[];
  targetBudgetMinZAR?: number;
  targetBudgetMaxZAR?: number;
  preferredRemoteModes?: Array<'Remote' | 'Hybrid' | 'On-Site'>;
  maxDistanceMeters?: number;
  autoMatchEnabled: boolean;
  autoAddProximityContacts: boolean;
  requireTopicOverlapForAutoAdd: boolean;
  updatedAt: string;
}

export interface AutonomousMatchItem {
  id: string;
  kind: 'job' | 'rfp' | 'agent' | 'proximity_peer';
  score: number;
  title: string;
  subtitle: string;
  targetHandle: string;
  targetName: string;
  rationale: string;
  matchedKeywords: string[];
  valueZAR?: number;
  distanceMeters?: number;
  bearingDeg?: number;
  mutualFacing?: boolean;
  recommendedAction: 'apply' | 'pitch_rfp' | 'engage' | 'add_contact' | 'invite_candidate';
  jobId?: string;
  rfpId?: string;
  createdAt: string;
}

export interface AgentDoc {
  id: string;
  handle: string;
  ownerUid: string;
  createdByDeviceId?: string;
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
  hrTeam?: HrTeamMember[];
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
  imageUrl?: string;
  introVideoUrl?: string;
  mediaGallery?: AgentMediaItem[];
  cardStyle?: AgentCardCustomization;
  did?: string;
  protocol?: string;
  interactEndpoint?: string;
  authMethods?: string;
  tagline?: string;
  summary?: string;
  skills: string[];
  impliedIntent?: AgentIntentProfile;
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
  department?: string;
  location: string;
  regionZone?: string;
  country?: string;
  remoteMode: 'Remote' | 'Hybrid' | 'On-Site';
  salaryRangeZAR: [number, number];
  requiredSkills: string[];
  minYearsExp: number;
  description?: string;
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

export interface TailoredCvDocument {
  candidateName: string;
  candidateHandle: string;
  email: string;
  linkedinUrl?: string;
  location: string;
  targetRole: string;
  targetCompany: string;
  targetRegion: string;
  professionalSummary: string;
  coreCompetencies: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  experienceHighlights: Array<{
    role: string;
    org: string;
    period: string;
    bullets: string[];
  }>;
  education: string[];
  certifications: string[];
  formattedAt: string;
}

export interface TailoredCoverLetterDocument {
  date: string;
  recipientName: string;
  recipientTitle: string;
  companyName: string;
  companyHandle: string;
  subject: string;
  greeting: string;
  openingParagraph: string;
  bodyParagraphs: string[];
  closingParagraph: string;
  signatureName: string;
  signatureContact: string;
}

export interface HrReviewNote {
  id: string;
  authorName: string;
  authorRole: string;
  note: string;
  createdAt: string;
}

export interface AgentApplicationPackage {
  id: string;
  jobId: string;
  jobTitle: string;
  companyAgentHandle: string;
  companyName: string;
  regionZone: string;
  seekerAgentId: string;
  seekerHandle: string;
  seekerName: string;
  seekerEmail: string;
  linkedinUrl?: string;
  matchScore: number;
  status: 'applied' | 'screening' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';
  cvDoc: TailoredCvDocument;
  coverLetterDoc: TailoredCoverLetterDocument;
  interviewPrepQuestions: string[];
  hrNotes: HrReviewNote[];
  reviewedByHr: Array<{
    name: string;
    role: string;
    viewedAt: string;
  }>;
  submittedVia: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentActionHistoryEntry {
  id: string;
  agentId: string;
  agentHandle: string;
  ownerUid?: string;
  deviceId?: string;
  actorType: 'personal_agent' | 'company_agent' | 'hr_staff' | 'user';
  actorName: string;
  actionType:
    | 'AUTO_MATCH'
    | 'CV_UPDATED'
    | 'CV_FORMATTED'
    | 'COVER_LETTER_GENERATED'
    | 'APPLICATION_SUBMITTED'
    | 'EMAIL_DISPATCHED'
    | 'INTERVIEW_REQUESTED'
    | 'DOC_EXPORTED'
    | 'HR_VIEWED_DOCS'
    | 'HR_SHORTLISTED'
    | 'HR_NOTE_ADDED'
    | 'EMPLOYER_AGENT_LAUNCHED'
    | 'HR_TEAM_UPDATED';
  title: string;
  details: string;
  relatedJobId?: string;
  relatedJobTitle?: string;
  relatedPackageId?: string;
  targetHandle?: string;
  channel?: string;
  timestamp: string;
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
  interviewPitch?: string;
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
  entityType?: 'personal' | 'business';
  billingCycle?: 'monthly' | 'annual' | 'one_time' | 'free_random';
  ownerUid: string;
  ownerDisplayName: string;
  tierPriceUSD: number;
  paidVia: 'free_human' | 'free_random' | 'x402_usdc' | 'paypal_vault' | 'auction_win';
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
  aiClassification: 'QUALIFIED_ENGAGE' | 'RFP_RESPONSE' | 'SPAM_BLOCKED' | 'MEETING_CONFIRMED';
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
  kind?: 'commerce' | 'job' | 'event_peer';
  jobId?: string;
  timestamp: string;
}

export type ProximityTransport = 'same_wifi' | 'ble_beacon' | 'dooh_geofence' | 'web_bluetooth';

export type ProximityIntent = 'networking' | 'job_seeking' | 'hiring' | 'commerce' | 'partnership';

export interface ProximityPeerDoc {
  id: string;
  handle: string;
  ownerUid?: string;
  displayName: string;
  roleTitle: string;
  organization: string;
  type: 'persona' | 'business';
  verified: boolean;
  intent: ProximityIntent;
  skills: string[];
  impliedTopics?: string[];
  summary?: string;
  imageUrl?: string;
  brandLogoCode?: string;
  brandColor?: string;
  cardStyle?: AgentCardCustomization;
  voiceNumber?: string;
  agentEmail?: string;
  locationLabel: string;
  distanceMeters: number;
  transport: ProximityTransport;
  roomCode: string;
  subnetTag?: string;
  sameWifi?: boolean;
  lat?: number;
  lng?: number;
  headingDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
  broadcastRadiusMeters?: number;
  scanRadiusMeters?: number;
  mutualBearingLock?: boolean;
  relativeBearingDeg?: number;
  incentive?: string;
  matchedScore?: number;
  lastSeenAt: string;
}

export type ContactSource =
  | 'event_wifi'
  | 'event_ble'
  | 'ble_beacon'
  | 'dooh_geofence'
  | 'direct_share'
  | 'directory';

export interface PersonalContactDoc {
  id: string;
  ownerUid: string;
  agentId?: string;
  handle: string;
  displayName: string;
  roleTitle: string;
  organization: string;
  type: 'persona' | 'business';
  agentRoleCategory?: AgentRoleCategory;
  verified: boolean;
  voiceNumber: string;
  agentEmail: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  skills: string[];
  summary?: string;
  imageUrl?: string;
  brandColor?: string;
  brandLogoCode?: string;
  cardStyle?: AgentCardCustomization;
  guardrails?: AgentGuardrails;
  source: ContactSource;
  sharedAtLocation?: string;
  eventName?: string;
  sharedByHandle?: string;
  favorite: boolean;
  tags: string[];
  notes: string;
  sharedAt: string;
  lastEngagedAt?: string;
}

export interface AiOpportunitySuggestion {
  id: string;
  title: string;
  category: 'job_match' | 'b2b_deal' | 'partnership' | 'service_pitch' | 'event_followup';
  contactId?: string;
  targetHandle: string;
  targetName: string;
  summary: string;
  rationale: string;
  suggestedProposalTitle: string;
  recommendedDealZAR: number;
  confidencePct: number;
  negotiationAngle: string;
  jobId?: string;
}

export type AgentStatusCategory =
  | 'hired'
  | 'deal_approved'
  | 'sponsored_ad'
  | 'generic';

export interface AgentStatusPostDoc {
  id: string;
  agentId: string;
  agentHandle: string;
  authorName: string;
  authorOrg: string;
  authorType: 'persona' | 'business';
  category: AgentStatusCategory;
  headline: string;
  body: string;
  accentColor?: string;
  partnerName?: string;
  partnerHandle?: string;
  roleTitle?: string;
  regionZone?: string;
  dealValueZAR?: number;
  savingsLabel?: string;
  ctaLabel?: string;
  autoGenerated?: boolean;
  createdAt: string;
}

export interface DevicePasskeyRecord {
  id?: string;
  credentialId: string;
  ownerUid: string;
  deviceId: string;
  deviceLabel: string;
  userDisplayName: string;
  userEmail: string;
  publicKeySpki: string;
  algorithm: 'WEBAUTHN_FIDO2' | 'DEVICE_KEY_P256';
  transports: string[];
  counter: number;
  rememberedAgentIds: string[];
  rememberedAgentHandles: string[];
  createdAt: string;
  lastUsedAt: string;
}

export interface UserSessionRecord {
  id: string;
  ownerUid: string;
  deviceId: string;
  deviceLabel?: string;
  authMode: 'google' | 'passkey_sim' | 'guest';
  passkeyCredentialId?: string;
  userDisplayName: string;
  userEmail: string;
  activeAgentId?: string;
  activeAgentHandle?: string;
  agentIds: string[];
  agentHandles: string[];
  networkAutopilotEnabled?: boolean;
  locationLabel?: string;
  lastTab?: string;
  userAgent?: string;
  status?: 'active' | 'idle' | 'signed_out';
  createdAt: string;
  lastActiveAt: string;
}

export type ActivityCategory =
  | 'auth'
  | 'autopilot'
  | 'proximity'
  | 'match'
  | 'negotiation'
  | 'recruitment'
  | 'comms'
  | 'registry'
  | 'session'
  | 'system';

export interface UserAgentActivityEntry {
  id: string;
  ownerUid?: string;
  deviceId?: string;
  sessionId?: string;
  agentId?: string;
  agentHandle?: string;
  targetHandle?: string;
  category: ActivityCategory;
  title: string;
  detail: string;
  locationLabel?: string;
  distanceMeters?: number;
  matchScore?: number;
  valueZAR?: number;
  metadata?: Record<string, string | number | boolean>;
  timestamp: string;
}

export const FREE_MATCH_LIMIT = 10;

export type X402PayableCategory =
  | 'matches_pack'
  | 'ad_boost'
  | 'domain_name'
  | 'email_inbox'
  | 'rfp_boost'
  | 'autopilot_pass'
  | 'video_audit'
  | 'api_pack'
  | 'placement_escrow'
  | 'wallet_topup';

export interface X402SkuCatalogItem {
  sku: string;
  category: X402PayableCategory;
  title: string;
  description: string;
  priceUSD: number;
  billingMode: 'one_time' | 'monthly' | 'annual' | 'per_unit';
  targetBuyer: 'human' | 'agent' | 'both';
  creditsGranted?: {
    matches?: number;
    unlimitedMatches?: boolean;
    adDays?: number;
    inboxes?: number;
    outboundEmails?: number;
    autopilotPro?: boolean;
    videoAudits?: number;
    apiCalls?: number;
    priorityRfps?: number;
  };
}

export const X402_REVENUE_CATALOG: X402SkuCatalogItem[] = [
  {
    sku: 'matches_pack_25',
    category: 'matches_pack',
    title: '+25 AI Match Unlocks',
    description: 'Unlock 25 additional AI-scored job, RFP & proximity opportunity matches beyond your 10 free matches.',
    priceUSD: 4.99,
    billingMode: 'one_time',
    targetBuyer: 'both',
    creditsGranted: { matches: 25 },
  },
  {
    sku: 'matches_pack_100',
    category: 'matches_pack',
    title: '+100 AI Match Unlocks',
    description: 'High-volume autonomous matching bundle for active talent, sales, or recruiting agents.',
    priceUSD: 14.99,
    billingMode: 'one_time',
    targetBuyer: 'both',
    creditsGranted: { matches: 100 },
  },
  {
    sku: 'matches_unlimited_mo',
    category: 'matches_pack',
    title: 'Unlimited Matches Pro (Monthly)',
    description: 'Uncapped autonomous matching across jobs, RFPs, and BLE/Wi-Fi proximity radar for 30 days.',
    priceUSD: 19.0,
    billingMode: 'monthly',
    targetBuyer: 'both',
    creditsGranted: { unlimitedMatches: true, matches: 9999 },
  },
  {
    sku: 'ad_status_boost_7d',
    category: 'ad_boost',
    title: 'Sponsored Status Ad (7 Days)',
    description: 'Promote an offer or vacancy in the top gold Status Circles & Stories feed with click tracking.',
    priceUSD: 15.0,
    billingMode: 'one_time',
    targetBuyer: 'both',
    creditsGranted: { adDays: 7 },
  },
  {
    sku: 'ad_directory_featured_7d',
    category: 'ad_boost',
    title: 'Featured Directory Card (7 Days)',
    description: 'Pin your agent card to position #1 in directory search & AI recommendations.',
    priceUSD: 29.0,
    billingMode: 'one_time',
    targetBuyer: 'both',
    creditsGranted: { adDays: 7 },
  },
  {
    sku: 'ad_radar_beacon_7d',
    category: 'ad_boost',
    title: 'Event & Geo-Radar Beacon Ad (7 Days)',
    description: 'Broadcast sponsored proximity offers to nearby conference attendees and passersby within radius.',
    priceUSD: 39.0,
    billingMode: 'one_time',
    targetBuyer: 'both',
    creditsGranted: { adDays: 7 },
  },
  {
    sku: 'domain_personal_mo',
    category: 'domain_name',
    title: 'Personal Custom .agent Domain',
    description: 'Register a custom personal .agent handle ($2/mo min vs free random personalagentXXXX.agent).',
    priceUSD: 2.0,
    billingMode: 'monthly',
    targetBuyer: 'both',
  },
  {
    sku: 'domain_business_mo',
    category: 'domain_name',
    title: 'Business Custom .agent Domain',
    description: 'Register a verified company .agent handle ($10/mo base vs free random businessagentXXXX.agent).',
    priceUSD: 10.0,
    billingMode: 'monthly',
    targetBuyer: 'both',
  },
  {
    sku: 'email_dedicated_inbox',
    category: 'email_inbox',
    title: 'Dedicated @agentmail.to Inbox',
    description: 'Provision an extra dedicated autonomous email inbox beyond 1 free subaddressed inbox.',
    priceUSD: 5.0,
    billingMode: 'monthly',
    targetBuyer: 'both',
    creditsGranted: { inboxes: 1 },
  },
  {
    sku: 'email_outreach_500',
    category: 'email_inbox',
    title: '500 AI Email Auto-Triages & Sends',
    description: 'Outbound pitch & RFQ auto-reply capacity powered by AgentMail + Gemini triage.',
    priceUSD: 9.0,
    billingMode: 'one_time',
    targetBuyer: 'both',
    creditsGranted: { outboundEmails: 500 },
  },
  {
    sku: 'rfp_priority_broadcast',
    category: 'rfp_boost',
    title: 'Priority Reverse-RFP Broadcast',
    description: 'Blast an RFP across DOOH billboards, BLE beacons, and top matching vendor agents.',
    priceUSD: 12.0,
    billingMode: 'per_unit',
    targetBuyer: 'both',
    creditsGranted: { priorityRfps: 1 },
  },
  {
    sku: 'autopilot_event_pro_mo',
    category: 'autopilot_pass',
    title: '+Network Event Autopilot Pro',
    description: 'Unlimited autonomous event contact capture, AI deal negotiation & closing while on the move.',
    priceUSD: 15.0,
    billingMode: 'monthly',
    targetBuyer: 'both',
    creditsGranted: { autopilotPro: true },
  },
  {
    sku: 'video_forensic_pack',
    category: 'video_audit',
    title: '5x Anti-Deepfake Video Liveness Audits',
    description: 'Biometric micro-expression & lip-sync verification certificates for hiring & executive KYC.',
    priceUSD: 7.0,
    billingMode: 'one_time',
    targetBuyer: 'both',
    creditsGranted: { videoAudits: 5 },
  },
  {
    sku: 'api_credits_1000',
    category: 'api_pack',
    title: '1,000 External A2A / MCP Calls',
    description: 'Metered programmatic directory lookups, autonomous matching & webhook invocations for third-party bots.',
    priceUSD: 10.0,
    billingMode: 'one_time',
    targetBuyer: 'agent',
    creditsGranted: { apiCalls: 1000 },
  },
];

export interface X402ChallengePayload {
  paymentId: string;
  nonce: string;
  protocol: 'x402';
  version: '1.0';
  sku: string;
  category: X402PayableCategory;
  title: string;
  description: string;
  amountUSD: number;
  amountZAR: number;
  currency: 'USDC';
  chains: Array<'base' | 'arc' | 'solana' | 'paypal_vault'>;
  payToAddresses: {
    base: string;
    arc: string;
    solana: string;
    paypalVault: string;
  };
  hmacChallenge: string;
  expiresAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface X402PaymentReceipt {
  id: string;
  paymentId: string;
  nonce: string;
  sku: string;
  category: X402PayableCategory;
  title: string;
  ownerUid: string;
  deviceId?: string;
  payerType: 'human' | 'agent';
  payerHandle: string;
  payerName?: string;
  rail: PaymentRail;
  amountUSD: number;
  amountZAR: number;
  txHash: string;
  x402Token: string;
  status: 'SETTLED';
  metadata?: Record<string, string | number | boolean>;
  settledAt: string;
}

export interface X402AccountEntitlement {
  key: string;
  ownerUid: string;
  deviceId?: string;
  freeMatchesUsed: number;
  freeMatchLimit: number;
  bonusMatchCredits: number;
  unlimitedMatchesUntil?: string;
  inboxesIncludedFree: number;
  inboxesUsed: number;
  bonusInboxes: number;
  outboundEmailCredits: number;
  priorityRfpCredits: number;
  videoAuditCredits: number;
  apiCredits: number;
  autopilotProUntil?: string;
  walletBalanceUSD: number;
  autoPayEnabled: boolean;
  maxAutoPayPerCallUSD: number;
  totalSpentUSD: number;
  updatedAt: string;
}

export interface AdCampaignDoc {
  id: string;
  ownerUid: string;
  agentId: string;
  agentHandle: string;
  sponsorName: string;
  placement: 'status_circle' | 'directory_featured' | 'radar_beacon';
  headline: string;
  body: string;
  ctaLabel: string;
  targetUrl?: string;
  budgetUSD: number;
  impressions: number;
  clicks: number;
  receiptId: string;
  txHash: string;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED';
  startsAt: string;
  expiresAt: string;
}

export function zarToUsd(zar: number): number {
  const rate = getFxRatePerUsd('ZAR');
  return Number((zar / rate).toFixed(2));
}

export function usdToZar(usd: number): number {
  const rate = getFxRatePerUsd('ZAR');
  return Math.round(usd * rate);
}

export function formatMoney(amountZAR: number, currency: CurrencyMode): string {
  const usd = zarToUsd(amountZAR);
  return formatCurrencyFromUsd(usd, currency);
}
