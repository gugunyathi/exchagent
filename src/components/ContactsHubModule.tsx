import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Star,
  Trash2,
  Phone,
  Mail,
  Zap,
  Building2,
  User,
  Briefcase,
  Wifi,
  Bluetooth,
  MapPin,
  Plus,
  X,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ArrowUpRight,
  Tag,
} from 'lucide-react';
import {
  AgentDoc,
  PersonalContactDoc,
  ContactSource,
  JobPostingDoc,
  RfpDoc,
  NegotiationDoc,
  BookingDoc,
  AiOpportunitySuggestion,
  CurrencyMode,
  formatMoney,
} from '../types/firestore';
import { SwipeScrollArea } from './SwipeScrollArea';
import { emitToast } from '../lib/toast';
import { resolveAgentImage } from '../lib/agentImages';

interface ContactsHubModuleProps {
  contacts: PersonalContactDoc[];
  agents: AgentDoc[];
  jobs: JobPostingDoc[];
  rfps: RfpDoc[];
  currency: CurrencyMode;
  ownerUid: string;
  aiOpportunities: AiOpportunitySuggestion[];
  aiOpportunitiesMeta: { engine?: string; generatedAt?: string; summary?: string } | null;
  aiOpportunitiesLoading: boolean;
  aiOpportunitiesError: string | null;
  onSaveContact: (
    card: AgentDoc,
    meta: { source: ContactSource; sharedAtLocation?: string; notes?: string }
  ) => Promise<unknown>;
  onUpdateContact: (contactId: string, patch: Partial<PersonalContactDoc>) => Promise<void>;
  onToggleFavorite: (contactId: string) => Promise<void>;
  onDeleteContact: (contactId: string) => void;
  onScanOpportunities: (activeAgent: AgentDoc) => Promise<unknown>;
  onEngageProposal: (params: {
    targetHandle: string;
    proposalTitle?: string;
    stickerPriceZAR?: number;
  }) => void;
  onApplyJob?: (job: JobPostingDoc) => void;
  onDialHandle: (handle: string) => void;
  onEmailHandle: (handle: string) => void;
  onSaveNegotiation: (neg: NegotiationDoc) => Promise<void>;
  onAddBooking: (booking: BookingDoc) => Promise<void>;
}

type ContactCategoryFilter = 'all' | 'persona' | 'business' | 'hiring' | 'favorites';

function formatSourceLabel(source: ContactSource): string {
  switch (source) {
    case 'event_wifi':
      return 'Event Wi-Fi';
    case 'event_ble':
      return 'Event BLE';
    case 'ble_beacon':
      return 'BLE Beacon';
    case 'dooh_geofence':
      return 'DOOH Geofence';
    case 'direct_share':
      return 'Direct Share';
    default:
      return 'Directory';
  }
}

export const ContactsHubModule: React.FC<ContactsHubModuleProps> = ({
  contacts,
  agents,
  jobs,
  rfps,
  currency,
  ownerUid,
  aiOpportunities,
  aiOpportunitiesMeta,
  aiOpportunitiesLoading,
  aiOpportunitiesError,
  onSaveContact,
  onUpdateContact,
  onToggleFavorite,
  onDeleteContact,
  onScanOpportunities,
  onEngageProposal,
  onApplyJob,
  onDialHandle,
  onEmailHandle,
  onSaveNegotiation,
  onAddBooking,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ContactCategoryFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | ContactSource>('all');
  const [selectedContactId, setSelectedContactId] = useState<string>(contacts[0]?.id || '');
  const [importModalOpen, setImportModalOpen] = useState(false);

  const nonEmergencyAgents = useMemo(
    () => agents.filter((a) => a.handle !== '911.emergency.agent'),
    [agents]
  );
  const myOwnedAgents = useMemo(() => {
    const owned = nonEmergencyAgents.filter((a) => a.ownerUid === ownerUid);
    return owned.length > 0 ? owned : nonEmergencyAgents;
  }, [nonEmergencyAgents, ownerUid]);

  const [scoutingAgentHandle, setScoutingAgentHandle] = useState<string>(
    myOwnedAgents[0]?.handle || nonEmergencyAgents[0]?.handle || 'alex.founder.agent'
  );
  const [negotiatingOppId, setNegotiatingOppId] = useState<string | null>(null);
  const [oppOutcomeMap, setOppOutcomeMap] = useState<
    Record<string, { status: string; agreedZAR: number; negId: string }>
  >({});

  // Notes/tag editing state synced to selected contact
  const [noteDraft, setNoteDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter((c) => {
      if (categoryFilter === 'persona' && c.type !== 'persona') return false;
      if (categoryFilter === 'business' && c.type !== 'business') return false;
      if (
        categoryFilter === 'hiring' &&
        c.agentRoleCategory !== 'hiring' &&
        c.agentRoleCategory !== 'recruiter'
      ) {
        return false;
      }
      if (categoryFilter === 'favorites' && !c.favorite) return false;
      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;

      if (!q) return true;
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        c.organization.toLowerCase().includes(q) ||
        c.roleTitle.toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        (c.sharedAtLocation || '').toLowerCase().includes(q) ||
        (c.eventName || '').toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q)) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [contacts, categoryFilter, sourceFilter, searchQuery]);

  const selectedContact =
    filteredContacts.find((c) => c.id === selectedContactId) ||
    filteredContacts[0] ||
    null;

  React.useEffect(() => {
    if (selectedContact) {
      setNoteDraft(selectedContact.notes || '');
    }
  }, [selectedContact?.id]);

  const scoutingAgent =
    agents.find((a) => a.handle === scoutingAgentHandle) ||
    myOwnedAgents[0] ||
    nonEmergencyAgents[0];

  const handleSaveNotes = async () => {
    if (!selectedContact) return;
    await onUpdateContact(selectedContact.id, { notes: noteDraft });
    emitToast('Saved contact note', 'success');
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !tagDraft.trim()) return;
    const clean = tagDraft.trim();
    if (!selectedContact.tags.includes(clean)) {
      await onUpdateContact(selectedContact.id, {
        tags: [...selectedContact.tags, clean],
      });
    }
    setTagDraft('');
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedContact) return;
    await onUpdateContact(selectedContact.id, {
      tags: selectedContact.tags.filter((t) => t !== tag),
    });
  };

  const handleAutoNegotiateOpportunity = async (opp: AiOpportunitySuggestion) => {
    if (!scoutingAgent) return;
    const targetAgent = agents.find(
      (a) => a.handle.toLowerCase() === opp.targetHandle.toLowerCase()
    );
    const matchingContact = contacts.find(
      (c) => c.id === opp.contactId || c.handle.toLowerCase() === opp.targetHandle.toLowerCase()
    );

    setNegotiatingOppId(opp.id);
    try {
      const targetMaxSpendZAR =
        targetAgent?.guardrails.maxAutoSpendZAR ??
        matchingContact?.guardrails?.maxAutoSpendZAR ??
        Math.round(opp.recommendedDealZAR * 1.4);
      const targetMinDiscountPct =
        targetAgent?.guardrails.minDiscountPct ??
        matchingContact?.guardrails?.minDiscountPct ??
        10;

      const res = await fetch('/api/a2a/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initiatorHandle: scoutingAgent.handle,
          targetHandle: opp.targetHandle,
          proposalTitle: opp.suggestedProposalTitle,
          stickerPriceZAR: Math.max(1000, Math.round(opp.recommendedDealZAR || 25000)),
          surface: 'desktop',
          targetMaxSpendZAR,
          targetMinDiscountPct,
        }),
      });
      const data = await res.json();
      const sessionId = `neg_ai_${Date.now()}`;

      const negDoc: NegotiationDoc = {
        id: sessionId,
        initiatorAgentId: scoutingAgent.id,
        initiatorOwnerUid: ownerUid,
        targetAgentId: targetAgent?.id || matchingContact?.agentId || opp.targetHandle,
        targetOwnerUid: targetAgent?.ownerUid || ownerUid,
        initiatorHandle: scoutingAgent.handle,
        targetHandle: opp.targetHandle,
        surface: 'desktop',
        status: data.finalStatus || 'OFFER_ACCEPTED',
        stickerPriceZAR: Math.max(1000, Math.round(opp.recommendedDealZAR || 25000)),
        currentOfferZAR: data.agreedPriceZAR || opp.recommendedDealZAR,
        agreedPriceZAR:
          data.finalStatus === 'OFFER_ACCEPTED' ? data.agreedPriceZAR : undefined,
        messages: data.messages || [],
        popiaAuditHash: data.popiaAuditHash || 'popia_sha256_ai_scout',
        updatedAt: new Date().toISOString(),
      };

      await onSaveNegotiation(negDoc);
      if (matchingContact) {
        await onUpdateContact(matchingContact.id, {
          lastEngagedAt: new Date().toISOString(),
        });
      }

      if (negDoc.status === 'OFFER_ACCEPTED' && negDoc.agreedPriceZAR) {
        const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
        start.setHours(10, 0, 0, 0);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        await onAddBooking({
          id: `book_ai_${Date.now()}`,
          sessionId,
          organizerAgentId: scoutingAgent.id,
          organizerHandle: scoutingAgent.handle,
          attendeeAgentId: negDoc.targetAgentId,
          attendeeHandle: opp.targetHandle,
          ownerUid,
          title: data.calendarMeetingTitle || `${opp.suggestedProposalTitle} — Kickoff`,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          meetLink: `https://meet.google.com/swb-${Math.random().toString(36).slice(2, 6)}`,
          dealValueZAR: negDoc.agreedPriceZAR,
          googleSynced: false,
          status: 'CONFIRMED',
        });
        emitToast(
          `Agent agreed at ${formatMoney(negDoc.agreedPriceZAR, currency)} with ${opp.targetHandle}`,
          'success'
        );
      } else {
        emitToast(`Negotiation escalated for ${opp.targetHandle}`, 'warning');
      }

      setOppOutcomeMap((prev) => ({
        ...prev,
        [opp.id]: {
          status: negDoc.status,
          agreedZAR: negDoc.agreedPriceZAR || negDoc.currentOfferZAR,
          negId: sessionId,
        },
      }));
    } catch {
      emitToast('Failed to run autonomous negotiation', 'warning');
    } finally {
      setNegotiatingOppId(null);
    }
  };

  const savedHandles = useMemo(
    () => new Set(contacts.map((c) => c.handle.toLowerCase())),
    [contacts]
  );

  const importableAgents = nonEmergencyAgents.filter(
    (a) => !savedHandles.has(a.handle.toLowerCase())
  );

  const peopleCount = contacts.filter((c) => c.type === 'persona').length;
  const businessCount = contacts.filter((c) => c.type === 'business').length;
  const favCount = contacts.filter((c) => c.favorite).length;

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            Personal Contacts &amp; AI Opportunity Scout
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
            {contacts.length} shared cards · {peopleCount} people · {businessCount} businesses · {favCount} favorites
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 dark:hover:border-white/25 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add from Directory
          </button>

          <button
            type="button"
            disabled={aiOpportunitiesLoading || !scoutingAgent}
            onClick={() => scoutingAgent && onScanOpportunities(scoutingAgent)}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 px-4 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiOpportunitiesLoading ? 'Scouting Opportunities...' : 'Scan Opportunities (AI)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left & Center: Searchable Contacts List + Contact Inspector */}
        <div className="lg:col-span-7 min-w-0 space-y-3">
          <div className="glass-panel rounded-2xl p-3.5 sm:p-4 space-y-3">
            {/* Search & Source Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts by name, .agent handle, org, skill, tag, event, or note..."
                  className="w-full min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 pl-8 pr-8 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-600 dark:focus:border-sky-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as 'all' | ContactSource)}
                aria-label="Filter contacts by share source"
                className="w-full sm:w-auto max-w-full min-w-0 min-h-[38px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-medium text-zinc-900 dark:text-zinc-200 focus:outline-none"
              >
                <option value="all">All Sources</option>
                <option value="event_wifi">Event Wi-Fi Mesh</option>
                <option value="event_ble">Event BLE Beacon</option>
                <option value="ble_beacon">Storefront BLE</option>
                <option value="dooh_geofence">DOOH Geofence</option>
                <option value="direct_share">Direct Share</option>
                <option value="directory">Directory Save</option>
              </select>
            </div>

            {/* Category Tabs */}
            <SwipeScrollArea
              direction="horizontal"
              showArrows={true}
              arrowSize="sm"
              innerClassName="flex items-center gap-1 pr-7"
            >
              {(
                [
                  { id: 'all', label: `All (${contacts.length})` },
                  { id: 'persona', label: `People (${peopleCount})`, icon: User },
                  { id: 'business', label: `Businesses (${businessCount})`, icon: Building2 },
                  { id: 'hiring', label: 'Hiring / Recruiters', icon: Briefcase },
                  { id: 'favorites', label: `Favorites (${favCount})`, icon: Star },
                ] as Array<{
                  id: ContactCategoryFilter;
                  label: string;
                  icon?: React.FC<{ className?: string }>;
                }>
              ).map((tab) => {
                const Icon = tab.icon;
                const active = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`min-h-[34px] px-3 rounded-lg text-[11.5px] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950 font-semibold'
                        : 'bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 font-medium'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </SwipeScrollArea>

            {/* Contacts Directory Table / Rows */}
            {filteredContacts.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-6 text-center space-y-2">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  No contacts match your current filter
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Capture cards at events via Spatial Event Mesh (Wi-Fi / BLE) or save from the Directory.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Scrollable Contacts List */}
                <SwipeScrollArea
                  direction="vertical"
                  showArrows={true}
                  arrowSize="sm"
                  className="md:col-span-6 min-w-0 max-h-[430px] rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950/80"
                  innerClassName="divide-y divide-zinc-200 dark:divide-white/[0.08]"
                >
                  {filteredContacts.map((contact) => {
                    const isSelected = selectedContact?.id === contact.id;
                    const imgSrc = resolveAgentImage({
                      id: contact.agentId || contact.id,
                      handle: contact.handle,
                      type: contact.type,
                      imageUrl: contact.imageUrl,
                    });
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setSelectedContactId(contact.id)}
                        className={`w-full text-left p-3 transition-colors flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-zinc-100 dark:bg-zinc-900'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden border border-zinc-200 dark:border-white/15 bg-zinc-100 dark:bg-zinc-900 shrink-0 flex items-center justify-center">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={contact.displayName}
                              referrerPolicy="no-referrer"
                              className={`w-full h-full object-cover ${
                                contact.type === 'persona' ? 'object-top' : 'object-center'
                              }`}
                            />
                          ) : (
                            <span className="text-[11px] font-display font-bold text-zinc-700 dark:text-zinc-200">
                              {contact.brandLogoCode || contact.displayName.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-display font-bold text-zinc-950 dark:text-white truncate">
                              {contact.displayName}
                            </span>
                            {contact.favorite && (
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-sky-700 dark:text-sky-400 truncate">
                            {contact.handle}
                          </p>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                            {contact.roleTitle} · {contact.organization}
                          </p>
                          <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-500 truncate mt-1">
                            {formatSourceLabel(contact.source)}
                            {contact.sharedAtLocation ? ` · ${contact.sharedAtLocation}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </SwipeScrollArea>

                {/* Selected Contact Inspector */}
                {selectedContact && (
                  <div className="md:col-span-6 min-w-0 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-950 p-3.5 space-y-3">
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-zinc-200 dark:border-white/10">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white truncate">
                            {selectedContact.displayName}
                          </h3>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">
                            {selectedContact.type === 'business' ? 'BIZ' : 'PERSON'}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-sky-700 dark:text-sky-400 truncate">
                          {selectedContact.handle}
                        </p>
                        <p className="text-[11px] text-zinc-700 dark:text-zinc-300 mt-0.5">
                          {selectedContact.roleTitle} · {selectedContact.organization}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(selectedContact.id)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-amber-500"
                          title="Toggle favorite"
                          aria-label="Toggle favorite"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              selectedContact.favorite ? 'text-amber-500 fill-amber-500' : ''
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteContact(selectedContact.id)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
                          title="Remove contact"
                          aria-label="Remove contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Provenance / Event Attribution */}
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        {selectedContact.source === 'event_wifi' ? (
                          <Wifi className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        ) : selectedContact.source === 'event_ble' ||
                          selectedContact.source === 'ble_beacon' ? (
                          <Bluetooth className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        )}
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {formatSourceLabel(selectedContact.source)}
                        </span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(selectedContact.sharedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      {selectedContact.sharedAtLocation && (
                        <p className="truncate text-zinc-600 dark:text-zinc-400">
                          {selectedContact.sharedAtLocation}
                          {selectedContact.eventName ? ` · ${selectedContact.eventName}` : ''}
                        </p>
                      )}
                      {selectedContact.guardrails && (
                        <p className="font-mono text-[10.5px] text-zinc-600 dark:text-zinc-400 tabular-nums">
                          Spend Cap: {formatMoney(selectedContact.guardrails.maxAutoSpendZAR, currency)} · Min Disc:{' '}
                          {selectedContact.guardrails.minDiscountPct}%
                        </p>
                      )}
                    </div>

                    {/* Skills (typographic list) */}
                    {selectedContact.skills.length > 0 && (
                      <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Skills: </span>
                        {selectedContact.skills.join(' · ')}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {selectedContact.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-[10.5px] font-mono text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded px-1.5 py-0.5"
                          >
                            <Tag className="w-2.5 h-2.5 text-zinc-400" />
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white ml-0.5"
                              aria-label={`Remove tag ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <form onSubmit={handleAddTag} className="flex gap-1.5">
                        <input
                          type="text"
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          placeholder="Add tag (e.g. Q4 Vendor)..."
                          className="flex-1 min-h-[32px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 text-[11px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                        />
                        <button
                          type="submit"
                          className="min-h-[32px] px-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[11px] font-medium"
                        >
                          Tag
                        </button>
                      </form>
                    </div>

                    {/* Editable Notes */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                          Private Notes
                        </label>
                        {noteDraft !== (selectedContact.notes || '') && (
                          <button
                            type="button"
                            onClick={handleSaveNotes}
                            className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                          >
                            Save Note
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        onBlur={handleSaveNotes}
                        placeholder="Add meeting context, deal pricing, or follow-up reminder..."
                        className="w-full rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-sky-600"
                      />
                    </div>

                    {/* Direct Card Actions */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onEngageProposal({
                            targetHandle: selectedContact.handle,
                            proposalTitle: `Strategic Collaboration & Deal with ${selectedContact.displayName}`,
                            stickerPriceZAR: selectedContact.guardrails?.maxAutoSpendZAR
                              ? Math.min(95000, Math.round(selectedContact.guardrails.maxAutoSpendZAR * 0.4))
                              : 45000,
                          })
                        }
                        className="col-span-2 sm:col-span-1 min-h-[36px] rounded-lg bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-xs font-semibold inline-flex items-center justify-center gap-1 hover:bg-zinc-800 dark:hover:bg-white whitespace-nowrap"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Negotiate
                      </button>
                      <button
                        type="button"
                        onClick={() => onDialHandle(selectedContact.handle)}
                        className="min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-medium inline-flex items-center justify-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Dial
                      </button>
                      <button
                        type="button"
                        onClick={() => onEmailHandle(selectedContact.handle)}
                        className="min-h-[36px] rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-medium inline-flex items-center justify-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Mail
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Smart AI Opportunity Scout & Autonomous Negotiation */}
        <div className="lg:col-span-5 min-w-0 glass-panel rounded-2xl p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-zinc-200 dark:border-white/10">
            <div>
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Smart AI Opportunity Scout
              </h3>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 tabular-nums">
                Analyzes {contacts.length} contacts · {jobs.length} open jobs · {rfps.length} RFPs
              </p>
            </div>
            {aiOpportunitiesMeta?.engine && (
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
                {aiOpportunitiesMeta.engine}
              </span>
            )}
          </div>

          {/* Active User Agent Selector */}
          <div className="flex items-center gap-2">
            <label className="flex-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
              Your Negotiating Agent
              <select
                value={scoutingAgentHandle}
                onChange={(e) => setScoutingAgentHandle(e.target.value)}
                className="mt-1 w-full max-w-full min-w-0 min-h-[36px] rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 px-3 text-xs font-mono text-zinc-950 dark:text-zinc-100"
              >
                {nonEmergencyAgents.map((a) => (
                  <option key={a.id} value={a.handle}>
                    {a.handle} ({a.displayName})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            disabled={aiOpportunitiesLoading || !scoutingAgent}
            onClick={() => scoutingAgent && onScanOpportunities(scoutingAgent)}
            className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition-colors"
          >
            {aiOpportunitiesLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Scanning Contacts &amp; Deals with Gemini...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Find Opportunities &amp; Negotiable Deals
              </>
            )}
          </button>

          {aiOpportunitiesError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 p-3 space-y-2">
              <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div className="space-y-1">
                  <p className="font-semibold">AI Opportunity Scout Unavailable</p>
                  <p className="text-[11px] leading-relaxed">{aiOpportunitiesError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => scoutingAgent && onScanOpportunities(scoutingAgent)}
                className="min-h-[30px] px-3 rounded-lg bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-500/40 text-[11px] font-medium text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-950/60"
              >
                Retry AI Scan
              </button>
            </div>
          )}

          {aiOpportunitiesLoading && (
            <div className="space-y-2.5 py-2">
              <div className="skeleton-line h-20 w-full" />
              <div className="skeleton-line h-20 w-full" />
              <div className="skeleton-line h-16 w-4/5" />
            </div>
          )}

          {!aiOpportunitiesLoading && !aiOpportunitiesError && aiOpportunities.length === 0 && (
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Ready to uncover opportunities
              </p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Gemini cross-references your saved contacts, event notes, skills, open jobs, and Reverse-RFPs to recommend high-value introductions and let your agent negotiate automatically.
              </p>
            </div>
          )}

          {!aiOpportunitiesLoading && aiOpportunities.length > 0 && (
            <div className="space-y-2.5">
              {aiOpportunitiesMeta?.summary && (
                <p className="text-[11.5px] text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl p-2.5">
                  {aiOpportunitiesMeta.summary}
                </p>
              )}

              <SwipeScrollArea direction="vertical" showArrows={true} arrowSize="sm" className="max-h-[430px]" innerClassName="space-y-2.5 pr-1">
                {aiOpportunities.map((opp) => {
                  const outcome = oppOutcomeMap[opp.id];
                  const isBusy = negotiatingOppId === opp.id;
                  const linkedJob = opp.jobId ? jobs.find((j) => j.id === opp.jobId) : undefined;

                  return (
                    <div
                      key={opp.id}
                      className="rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wide tabular-nums">
                            {opp.category.replace('_', ' ')} · {opp.confidencePct}% match
                          </p>
                          <h4 className="text-xs font-display font-bold text-zinc-950 dark:text-white leading-snug mt-0.5">
                            {opp.title}
                          </h4>
                          <p className="text-[11px] font-mono text-sky-700 dark:text-sky-400 truncate mt-0.5">
                            {opp.targetHandle} · {opp.targetName}
                          </p>
                        </div>

                        <span className="font-mono tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                          {formatMoney(opp.recommendedDealZAR, currency)}
                        </span>
                      </div>

                      <p className="text-[11.5px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {opp.summary}
                      </p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">Angle: </span>
                        {opp.negotiationAngle}
                      </p>

                      {outcome && (
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] text-emerald-800 dark:text-emerald-200">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            {outcome.status === 'OFFER_ACCEPTED'
                              ? `Agent agreed at ${formatMoney(outcome.agreedZAR, currency)}`
                              : `Escalated (${outcome.status})`}
                          </span>
                          <span className="font-mono text-[10px]">Kickoff booked</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAutoNegotiateOpportunity(opp)}
                          className="flex-1 min-h-[34px] px-2.5 rounded-lg bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-[11px] font-semibold inline-flex items-center justify-center gap-1 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 whitespace-nowrap"
                        >
                          <Zap className="w-3 h-3" />
                          {isBusy ? 'Negotiating...' : 'Let Agent Negotiate'}
                        </button>

                        {linkedJob && onApplyJob && (
                          <button
                            type="button"
                            onClick={() => onApplyJob(linkedJob)}
                            className="min-h-[34px] px-2.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-emerald-700 whitespace-nowrap"
                          >
                            <Briefcase className="w-3 h-3" />
                            Apply
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            onEngageProposal({
                              targetHandle: opp.targetHandle,
                              proposalTitle: opp.suggestedProposalTitle,
                              stickerPriceZAR: opp.recommendedDealZAR,
                            })
                          }
                          className="min-h-[34px] px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium inline-flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                        >
                          Arena
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </SwipeScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Add Contact From Directory Modal */}
      {importModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setImportModalOpen(false)}
        >
          <div
            className="w-full max-w-md glass-panel rounded-t-3xl sm:rounded-2xl max-h-[90dvh] flex flex-col overflow-hidden pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mt-2 shrink-0" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/10 shrink-0">
              <h3 className="text-sm font-display font-bold text-zinc-950 dark:text-white">
                Save Directory Agent Card
              </h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 flex items-center justify-center text-zinc-600 dark:text-zinc-300"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {importableAgents.length === 0 ? (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 py-6 px-4 text-center">
                All directory agent cards are already saved in your Contacts list.
              </p>
            ) : (
              <SwipeScrollArea
                direction="vertical"
                showArrows={true}
                arrowSize="sm"
                className="flex-1 min-h-0 px-4 pt-3"
                innerClassName="space-y-1.5"
              >
                {importableAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                        {agent.displayName}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                        {agent.handle} · {agent.roleTitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await onSaveContact(agent, {
                          source: 'directory',
                          sharedAtLocation: agent.geoLocation?.label || 'Switchboard Directory',
                        });
                      }}
                      className="min-h-[32px] px-3 rounded-lg bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 text-[11px] font-semibold shrink-0"
                    >
                      Save
                    </button>
                  </div>
                ))}
              </SwipeScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
