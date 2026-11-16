import React, { useState, useEffect } from 'react';
import {
  X,
  Palette,
  Sparkles,
  Layers,
  Square,
  Check,
  RotateCw,
  Sliders,
  Maximize2,
  Minimize2,
  RefreshCw,
  Eye,
  Camera,
} from 'lucide-react';
import {
  AgentDoc,
  AgentCardCustomization,
  CardBannerStyle,
  CardBackgroundPattern,
  CardBackgroundTheme,
  CardEdgeRadius,
  CardBorderStyle,
  BookingDoc,
  CurrencyMode,
} from '../types/firestore';
import { CARD_STYLE_PRESETS, CardStylePreset } from '../data/seedData';
import { AgentIdentityCard } from './AgentIdentityCard';
import { emitToast } from '../lib/toast';
import { AGENT_IMAGE_PRESETS, resolveAgentImage } from '../lib/agentImages';

interface CardCustomizationModalProps {
  isOpen: boolean;
  agent: AgentDoc | null;
  bookings: BookingDoc[];
  currency: CurrencyMode;
  onClose: () => void;
  onSave: (updated: AgentDoc) => void;
}

const BANNER_STYLES: Array<{ id: CardBannerStyle; label: string; desc: string }> = [
  { id: 'gradient', label: 'Gradient', desc: 'Smooth linear gradient transition' },
  { id: 'circuit', label: 'Circuit', desc: 'Tech printed PCB traces & vias' },
  { id: 'mesh', label: 'Mesh', desc: 'Multi-stop radiant ambient glow' },
  { id: 'geometric', label: 'Geometric', desc: 'Isometric architectural wireframe' },
  { id: 'horizon', label: 'Horizon', desc: 'Rich multi-band layered sunset' },
  { id: 'monogram', label: 'Monogram', desc: 'Luxury corporate diamond crest' },
  { id: 'wave', label: 'Wave', desc: 'High-frequency carrier sine waves' },
  { id: 'carbon', label: 'Carbon', desc: 'Industrial angled carbon fiber weave' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean matte hairline finish' },
];

const BACKGROUND_PATTERNS: Array<{ id: CardBackgroundPattern; label: string }> = [
  { id: 'none', label: 'Solid / None' },
  { id: 'subtle-grid', label: 'Subtle Grid' },
  { id: 'dots', label: 'Dot Matrix' },
  { id: 'aurora', label: 'Aurora Glow' },
  { id: 'topo', label: 'Topo Contours' },
  { id: 'stripes', label: 'Speed Stripes' },
  { id: 'circuit', label: 'Corner Traces' },
];

const BACKGROUND_THEMES: Array<{
  id: CardBackgroundTheme;
  label: string;
  bgLight: string;
  bgDark: string;
  swatch: string;
}> = [
  { id: 'default', label: 'Default', bgLight: '#FFFFFF', bgDark: '#121215', swatch: '#71717A' },
  { id: 'pearl', label: 'Pearl Luster', bgLight: '#FAFAFA', bgDark: '#16161A', swatch: '#E4E4E7' },
  { id: 'obsidian', label: 'Obsidian', bgLight: '#F4F4F5', bgDark: '#0C0C0E', swatch: '#18181B' },
  { id: 'sapphire', label: 'Sapphire', bgLight: '#F0F9FF', bgDark: '#081524', swatch: '#0284C7' },
  { id: 'emerald', label: 'Emerald', bgLight: '#ECFDF5', bgDark: '#061812', swatch: '#10B981' },
  { id: 'amber', label: 'Amber', bgLight: '#FFFBEB', bgDark: '#1F1706', swatch: '#F59E0B' },
  { id: 'amethyst', label: 'Amethyst', bgLight: '#FAF5FF', bgDark: '#160C22', swatch: '#9333EA' },
  { id: 'cyber', label: 'Cyber Steel', bgLight: '#F8FAFC', bgDark: '#0A0F1D', swatch: '#3B82F6' },
];

const EDGE_RADII: Array<{ id: CardEdgeRadius; label: string; preview: string }> = [
  { id: 'rounded-none', label: 'Sharp (0px)', preview: 'rounded-none' },
  { id: 'rounded-xl', label: 'Crisp (12px)', preview: 'rounded-xl' },
  { id: 'rounded-2xl', label: 'Modern (16px)', preview: 'rounded-2xl' },
  { id: 'rounded-3xl', label: 'Squircle (24px)', preview: 'rounded-3xl' },
  { id: 'rounded-[28px]', label: 'Organic (28px)', preview: 'rounded-[28px]' },
];

const BORDER_STYLES: Array<{ id: CardBorderStyle; label: string; desc: string }> = [
  { id: 'hairline', label: 'Hairline', desc: '1px clean architectural border' },
  { id: 'bold-accent', label: 'Bold Accent', desc: '2px solid brand perimeter' },
  { id: 'cyber-glow', label: 'Cyber Glow', desc: 'Ambient luminescence edge glow' },
  { id: 'double', label: 'Double Rim', desc: 'Classic luxury dual-line rim' },
  { id: 'dashed-tech', label: 'Dashed Tech', desc: 'Stitched blueprint schematic' },
  { id: 'frosted-glass', label: 'Frosted Glass', desc: 'Translucent glassmorphism' },
];

const COLOR_SWATCHES = [
  '#0284c7', // Sky Blue
  '#4f46e5', // Indigo
  '#0f766e', // Teal
  '#10b981', // Emerald
  '#ca8a04', // Amber Yellow
  '#d97706', // Champagne Gold
  '#7c2d12', // Warm Mahagony
  '#be123c', // Crimson
  '#1e293b', // Slate Dark
  '#09090b', // Obsidian
];

export const CardCustomizationModal: React.FC<CardCustomizationModalProps> = ({
  isOpen,
  agent,
  bookings,
  currency,
  onClose,
  onSave,
}) => {
  if (!isOpen || !agent) return null;

  const defaultStyle: AgentCardCustomization = {
    bannerStyle: 'gradient',
    bannerBgColor: agent.brandColor || (agent.type === 'persona' ? '#0284c7' : '#09090b'),
    bannerHeight: 'normal',
    bannerBadgeStyle: 'glass',
    backgroundPattern: 'subtle-grid',
    backgroundTheme: 'default',
    edgeRadius: 'rounded-2xl',
    borderStyle: 'hairline',
    borderAccentColor: agent.brandColor || '#0284c7',
  };

  const [activeTab, setActiveTab] = useState<'presets' | 'photo' | 'banner' | 'background' | 'edges'>('presets');
  const [draftStyle, setDraftStyle] = useState<AgentCardCustomization>(agent.cardStyle || defaultStyle);
  const [draftImageUrl, setDraftImageUrl] = useState<string>(agent.imageUrl || '');
  const [previewFlipped, setPreviewFlipped] = useState(false);

  // Sync draft when agent changes
  useEffect(() => {
    if (agent) {
      setDraftStyle(agent.cardStyle || defaultStyle);
      setDraftImageUrl(agent.imageUrl || '');
      setPreviewFlipped(false);
    }
  }, [agent.id]);

  const updateDraft = (patch: Partial<AgentCardCustomization>) => {
    setDraftStyle((prev) => ({ ...prev, ...patch }));
  };

  const applyPreset = (preset: CardStylePreset) => {
    setDraftStyle(preset.style);
    emitToast(`Applied ${preset.name} preset`);
  };

  const handleReset = () => {
    setDraftStyle(agent.cardStyle || defaultStyle);
    setDraftImageUrl(agent.imageUrl || '');
    emitToast('Reset to original style');
  };

  const handleSave = () => {
    const updated: AgentDoc = {
      ...agent,
      imageUrl: draftImageUrl.trim() || undefined,
      cardStyle: draftStyle,
      brandColor: draftStyle.bannerBgColor || agent.brandColor,
    };
    onSave(updated);
    emitToast(`Card style saved for ${agent.handle}`);
    onClose();
  };

  // Create preview agent with draft styling applied
  const previewAgent: AgentDoc = {
    ...agent,
    imageUrl: draftImageUrl.trim() || agent.imageUrl,
    cardStyle: draftStyle,
    brandColor: draftStyle.bannerBgColor || agent.brandColor,
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-2xl bg-white dark:bg-[#121215] border border-zinc-300 dark:border-white/15 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 bg-zinc-50/75 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm sm:text-base text-zinc-950 dark:text-white truncate">
                Card Customization Studio
              </h2>
              <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 truncate">
                {agent.displayName} · {agent.handle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="min-h-[32px] px-2.5 rounded-lg border border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-white dark:bg-zinc-900 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              title="Reset changes"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-zinc-300 dark:border-white/15 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Studio Body: Split View with Live Preview & Customizer Tabs */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT: Live Interactive Preview */}
          <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-white/10 bg-zinc-100/60 dark:bg-zinc-950/50">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-medium text-zinc-600 dark:text-zinc-400 inline-flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Live Card Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewFlipped((v) => !v)}
                className="min-h-[28px] px-2.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white text-[11px] font-medium inline-flex items-center gap-1 transition-colors shadow-2xs"
              >
                <RotateCw className="w-3 h-3" />
                <span>{previewFlipped ? 'View Front' : 'View Back'}</span>
              </button>
            </div>

            <div className="w-full flex-1 flex items-center justify-center py-2">
              <AgentIdentityCard
                agent={previewAgent}
                bookings={bookings}
                currency={currency}
                flipped={previewFlipped}
                isActive={true}
                onFlipToggle={() => setPreviewFlipped((v) => !v)}
                onPitch={() => emitToast('Preview interaction')}
                onDial={() => emitToast('Preview dialer')}
                onEmail={() => emitToast('Preview email')}
                onToggleDiscoverable={() => {}}
              />
            </div>

            <div className="w-full text-center mt-2">
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Click Flip or tap the card to verify both faces with your selected style.
              </p>
            </div>
          </div>

          {/* RIGHT: Controls & Tabs */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-white dark:bg-[#121215]">
            {/* Tab Bar */}
            <div className="shrink-0 flex items-center border-b border-zinc-200 dark:border-white/10 px-3 pt-2 bg-zinc-50 dark:bg-zinc-900/30 gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'presets', label: 'Presets', icon: Sparkles },
                { id: 'photo', label: 'Photo', icon: Camera },
                { id: 'banner', label: 'Banner', icon: Layers },
                { id: 'background', label: 'Background', icon: Palette },
                { id: 'edges', label: 'Edges & Frame', icon: Square },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={`min-h-[36px] px-3 rounded-t-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border-b-2 whitespace-nowrap ${
                      active
                        ? 'border-zinc-950 text-zinc-950 dark:border-white dark:text-white bg-white dark:bg-[#121215]'
                        : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content Panels */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5 no-scrollbar">
              {/* TAB 1: PRESETS */}
              {activeTab === 'presets' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                      Curated Card Styles
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Select a signature preset to instantly style banner, background, and edges.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {CARD_STYLE_PRESETS.map((preset) => {
                      const isCurrent =
                        draftStyle.bannerStyle === preset.style.bannerStyle &&
                        draftStyle.backgroundPattern === preset.style.backgroundPattern &&
                        draftStyle.edgeRadius === preset.style.edgeRadius &&
                        draftStyle.borderStyle === preset.style.borderStyle;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${
                            isCurrent
                              ? 'border-zinc-950 dark:border-white ring-2 ring-zinc-950/15 dark:ring-white/20 bg-zinc-50 dark:bg-zinc-900'
                              : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/25 bg-white dark:bg-zinc-900/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-display font-bold text-xs text-zinc-950 dark:text-white">
                              {preset.name}
                            </span>
                            {isCurrent && (
                              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
                            {preset.tagline}
                          </p>
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: preset.style.bannerBgColor }}
                            />
                            <span className="capitalize">{preset.style.bannerStyle}</span>
                            <span>·</span>
                            <span className="capitalize">{preset.style.borderStyle}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 1B: PHOTO / BRAND VISUAL */}
              {activeTab === 'photo' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white">
                      Portrait &amp; Brand Photography
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      Choose a curated studio photo or paste your own headshot / product image URL.
                    </p>
                  </div>

                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Custom Image URL (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={draftImageUrl}
                        onChange={(e) => setDraftImageUrl(e.target.value)}
                        placeholder={resolveAgentImage(agent)}
                        className="flex-1 min-h-[38px] px-3 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white placeholder:text-zinc-400"
                      />
                      {draftImageUrl && (
                        <button
                          type="button"
                          onClick={() => setDraftImageUrl('')}
                          className="min-h-[38px] px-3 rounded-lg border border-zinc-300 dark:border-white/15 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          Default
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-2">
                      Curated Visual Library
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {AGENT_IMAGE_PRESETS.map((preset) => {
                        const selected = (draftImageUrl || resolveAgentImage(agent)) === preset.src;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setDraftImageUrl(preset.src)}
                            className={`group rounded-xl border overflow-hidden text-left transition-all ${
                              selected
                                ? 'border-zinc-950 dark:border-white ring-2 ring-zinc-950/20 dark:ring-white/25'
                                : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/25'
                            }`}
                          >
                            <div className="aspect-[3/4] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 relative">
                              <img
                                src={preset.src}
                                alt={preset.label}
                                referrerPolicy="no-referrer"
                                className={`w-full h-full object-cover group-hover:scale-105 transition-transform ${
                                  preset.type === 'persona' ? 'object-top' : 'object-center'
                                }`}
                              />
                              {selected && (
                                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </span>
                              )}
                            </div>
                            <div className="px-2 py-1.5 bg-white dark:bg-zinc-900">
                              <span className="block text-[10.5px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                {preset.label}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BANNER */}
              {activeTab === 'banner' && (
                <div className="space-y-4">
                  {/* Banner Style Grid */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Banner Texture & Visual Motif
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BANNER_STYLES.map((bs) => (
                        <button
                          key={bs.id}
                          type="button"
                          onClick={() => updateDraft({ bannerStyle: bs.id })}
                          className={`p-2.5 rounded-xl border text-left transition-colors ${
                            draftStyle.bannerStyle === bs.id
                              ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 font-semibold'
                              : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-950 dark:text-white capitalize">{bs.label}</span>
                            {draftStyle.bannerStyle === bs.id && (
                              <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-600 dark:text-zinc-400 block mt-0.5 line-clamp-1">
                            {bs.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Banner Height */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Banner Height
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'compact', label: 'Compact', px: '44px' },
                        { id: 'normal', label: 'Standard', px: '52px' },
                        { id: 'tall', label: 'Tall Hero', px: '68px' },
                      ].map((bh) => (
                        <button
                          key={bh.id}
                          type="button"
                          onClick={() => updateDraft({ bannerHeight: bh.id as any })}
                          className={`min-h-[36px] px-3 rounded-lg border text-xs font-medium flex items-center justify-between transition-colors ${
                            draftStyle.bannerHeight === bh.id
                              ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold'
                              : 'border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                          }`}
                        >
                          <span>{bh.label}</span>
                          <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">{bh.px}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Banner Badge Style */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Verification Badge Frame
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'glass', label: 'Frosted Glass' },
                        { id: 'pill', label: 'Solid Pill' },
                        { id: 'outline', label: 'Outline Rim' },
                        { id: 'none', label: 'Minimal Plain' },
                      ].map((bb) => (
                        <button
                          key={bb.id}
                          type="button"
                          onClick={() => updateDraft({ bannerBadgeStyle: bb.id as any })}
                          className={`min-h-[34px] px-2 rounded-lg border text-[11px] font-medium flex items-center justify-center text-center transition-colors ${
                            draftStyle.bannerBadgeStyle === bb.id
                              ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold'
                              : 'border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                          }`}
                        >
                          {bb.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Banner Accent Color */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Banner Primary Color
                    </label>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {COLOR_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => updateDraft({ bannerBgColor: hex })}
                          className={`w-7 h-7 rounded-full border transition-transform ${
                            draftStyle.bannerBgColor?.toLowerCase() === hex.toLowerCase()
                              ? 'scale-110 ring-2 ring-zinc-950 dark:ring-white border-white'
                              : 'border-black/20 hover:scale-105'
                          }`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 max-w-xs">
                      <input
                        type="color"
                        value={draftStyle.bannerBgColor || '#0284c7'}
                        onChange={(e) => updateDraft({ bannerBgColor: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-zinc-300 dark:border-white/15 cursor-pointer bg-transparent p-0.5"
                      />
                      <input
                        type="text"
                        value={draftStyle.bannerBgColor || ''}
                        onChange={(e) => updateDraft({ bannerBgColor: e.target.value })}
                        placeholder="#0284c7"
                        className="flex-1 min-h-[36px] px-3 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: BACKGROUND */}
              {activeTab === 'background' && (
                <div className="space-y-4">
                  {/* Background Themes / Surface Tint */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Card Surface Tone & Tint
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {BACKGROUND_THEMES.map((bt) => (
                        <button
                          key={bt.id}
                          type="button"
                          onClick={() => updateDraft({ backgroundTheme: bt.id })}
                          className={`p-2.5 rounded-xl border text-left transition-colors flex items-center gap-2 ${
                            draftStyle.backgroundTheme === bt.id
                              ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 font-semibold'
                              : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: bt.swatch }}
                          />
                          <span className="text-xs text-zinc-950 dark:text-white truncate">{bt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Pattern */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Subtle Pattern Overlay
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BACKGROUND_PATTERNS.map((bp) => (
                        <button
                          key={bp.id}
                          type="button"
                          onClick={() => updateDraft({ backgroundPattern: bp.id })}
                          className={`min-h-[38px] px-3 rounded-lg border text-xs font-medium flex items-center justify-between transition-colors ${
                            draftStyle.backgroundPattern === bp.id
                              ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 text-zinc-950 dark:text-white font-bold'
                              : 'border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                          }`}
                        >
                          <span>{bp.label}</span>
                          {draftStyle.backgroundPattern === bp.id && (
                            <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EDGES & FRAME */}
              {activeTab === 'edges' && (
                <div className="space-y-4">
                  {/* Corner Radius */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Corner Curvature Radius
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {EDGE_RADII.map((er) => (
                        <button
                          key={er.id}
                          type="button"
                          onClick={() => updateDraft({ edgeRadius: er.id })}
                          className={`p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                            draftStyle.edgeRadius === er.id
                              ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 font-bold'
                              : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                          }`}
                        >
                          <span className="text-xs text-zinc-950 dark:text-white">{er.label}</span>
                          <div
                            className={`w-5 h-5 border-2 border-zinc-900 dark:border-white ${er.preview}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Border Style */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Card Border Edge Style
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BORDER_STYLES.map((bs) => (
                        <button
                          key={bs.id}
                          type="button"
                          onClick={() => updateDraft({ borderStyle: bs.id })}
                          className={`p-2.5 rounded-xl border text-left transition-colors ${
                            draftStyle.borderStyle === bs.id
                              ? 'border-zinc-950 dark:border-white bg-zinc-50 dark:bg-zinc-900 font-semibold'
                              : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-950 dark:text-white">{bs.label}</span>
                            {draftStyle.borderStyle === bs.id && (
                              <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-600 dark:text-zinc-400 block mt-0.5 line-clamp-1">
                            {bs.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Border Accent Color */}
                  <div>
                    <label className="block font-display font-bold text-xs text-zinc-950 dark:text-white mb-1.5">
                      Border Accent Color (for Glow & Bold edges)
                    </label>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {COLOR_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => updateDraft({ borderAccentColor: hex })}
                          className={`w-7 h-7 rounded-full border transition-transform ${
                            draftStyle.borderAccentColor?.toLowerCase() === hex.toLowerCase()
                              ? 'scale-110 ring-2 ring-zinc-950 dark:ring-white border-white'
                              : 'border-black/20 hover:scale-105'
                          }`}
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 max-w-xs">
                      <input
                        type="color"
                        value={draftStyle.borderAccentColor || '#0284c7'}
                        onChange={(e) => updateDraft({ borderAccentColor: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-zinc-300 dark:border-white/15 cursor-pointer bg-transparent p-0.5"
                      />
                      <input
                        type="text"
                        value={draftStyle.borderAccentColor || ''}
                        onChange={(e) => updateDraft({ borderAccentColor: e.target.value })}
                        placeholder="#0284c7"
                        className="flex-1 min-h-[36px] px-3 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="shrink-0 p-3 sm:p-4 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between gap-2 bg-zinc-50/75 dark:bg-zinc-900/50">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] px-4 rounded-xl border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="min-h-[38px] px-5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 text-xs font-bold inline-flex items-center gap-1.5 shadow-md transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Save Card Personalization</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
