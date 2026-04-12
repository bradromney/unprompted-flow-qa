import React, { useState } from "react";
import type { Provocation as ProvocationType, ProvocationOption } from "../lib/provocation-engine";

/* ─── Single Card ──────────────────────────────────────────────────────── */

interface ProvocationProps {
  provocation: ProvocationType;
  onDismiss: (id: string) => void;
  onCopyPrompt: (text: string) => void;
  onNavigate: (flowId: string) => void;
}

const SEVERITY_GLYPH: Record<string, string> = {
  critical: "\u26A1",  // ⚡
  important: "\u25D0", // ◐
  notable: "\u25CB",   // ○
};

function ProvocationCardInner({
  provocation,
  onDismiss,
  onCopyPrompt,
  onNavigate,
}: ProvocationProps) {
  const [fading, setFading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDismiss = () => {
    setFading(true);
    setTimeout(() => onDismiss(provocation.id), 300);
  };

  const handleOption = (opt: ProvocationOption) => {
    if (opt.action === "dismiss") {
      handleDismiss();
    } else if (opt.action === "copy_prompt") {
      const text = opt.promptOverride ?? provocation.promptFragment;
      onCopyPrompt(text);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setFading(true);
        setTimeout(() => onDismiss(provocation.id), 300);
      }, 1500);
    } else if (opt.action === "navigate") {
      if (opt.targetId) {
        onNavigate(opt.targetId);
      } else if (provocation.relatedIds.length > 0) {
        onNavigate(provocation.relatedIds[0]);
      }
    }
  };

  const glyph = SEVERITY_GLYPH[provocation.severity] ?? "";
  // Primary action = first non-dismiss option
  const primaryOpt = provocation.options.find((o) => o.action !== "dismiss");
  const secondaryOpts = provocation.options.filter((o) => o !== primaryOpt && o.action !== "dismiss");

  return (
    <div
      className={`fq-provocation fq-provocation-${provocation.severity} ${fading ? "fq-provocation-fade" : ""}`}
    >
      {/* × dismiss in top-right */}
      <button
        type="button"
        className="fq-provocation-close"
        onClick={handleDismiss}
        title="Dismiss"
      >
        ×
      </button>

      <div className="fq-provocation-thesis">
        <span className="fq-provocation-glyph">{glyph}</span>
        {provocation.thesis}
      </div>
      {provocation.whyNow && (
        <div className="fq-provocation-why">{provocation.whyNow}</div>
      )}
      <div className="fq-provocation-options">
        {primaryOpt && (
          <button
            type="button"
            className={`fq-provocation-btn fq-provocation-btn-primary ${copied ? "fq-provocation-btn-copied" : ""}`}
            onClick={() => handleOption(primaryOpt)}
          >
            {copied ? "Copied!" : primaryOpt.label}
          </button>
        )}
        {secondaryOpts.map((opt, i) => (
          <button
            key={i}
            type="button"
            className="fq-provocation-btn fq-provocation-btn-secondary"
            onClick={() => handleOption(opt)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Notable Teaser (single-line) ─────────────────────────────────────── */

function NotableTeaser({
  provocation,
  onDismiss,
  onCopyPrompt,
  onNavigate,
}: ProvocationProps) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <ProvocationCardInner
        provocation={provocation}
        onDismiss={onDismiss}
        onCopyPrompt={onCopyPrompt}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div
      className="fq-provocation-teaser"
      onClick={() => setExpanded(true)}
    >
      <span className="fq-provocation-glyph">{SEVERITY_GLYPH.notable}</span>
      <span className="fq-provocation-teaser-text">{provocation.thesis}</span>
      <span className="fq-provocation-teaser-arrow">›</span>
    </div>
  );
}

/* ─── Stack (collapsed list with expand) ───────────────────────────────── */

interface ProvocationStackProps {
  provocations: ProvocationType[];
  onDismiss: (id: string) => void;
  onCopyPrompt: (text: string) => void;
  onNavigate: (flowId: string) => void;
}

export function ProvocationStack({
  provocations,
  onDismiss,
  onCopyPrompt,
  onNavigate,
}: ProvocationStackProps) {
  const [showAll, setShowAll] = useState(false);

  if (provocations.length === 0) return null;

  // Split: critical/important get cards, notable gets teasers
  const cards = provocations.filter((p) => p.severity !== "notable");
  const teasers = provocations.filter((p) => p.severity === "notable");

  // Show first card expanded, collapse rest behind "N more"
  const visibleCards = showAll ? cards : cards.slice(0, 1);
  const hiddenCardCount = showAll ? 0 : Math.max(0, cards.length - 1);
  const visibleTeasers = showAll ? teasers : (hiddenCardCount === 0 ? teasers : []);

  return (
    <div className="fq-provocations">
      {visibleCards.map((p, i) => (
        <ProvocationCardInner
          key={p.id}
          provocation={p}
          onDismiss={onDismiss}
          onCopyPrompt={onCopyPrompt}
          onNavigate={onNavigate}
        />
      ))}

      {(hiddenCardCount > 0 || (!showAll && teasers.length > 0 && cards.length > 1)) && (
        <button
          type="button"
          className="fq-provocation-more"
          onClick={() => setShowAll(true)}
        >
          {hiddenCardCount + (showAll ? 0 : teasers.length)} more
        </button>
      )}

      {visibleTeasers.map((p) => (
        <NotableTeaser
          key={p.id}
          provocation={p}
          onDismiss={onDismiss}
          onCopyPrompt={onCopyPrompt}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

/* ─── Re-export single card for backwards compat ───────────────────────── */
export { ProvocationCardInner as ProvocationCard };
