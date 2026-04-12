import React, { useState } from "react";
import type { Provocation as ProvocationType, ProvocationOption } from "../lib/provocation-engine";

interface ProvocationProps {
  provocation: ProvocationType;
  onDismiss: (id: string) => void;
  onCopyPrompt: (text: string) => void;
  onNavigate: (flowId: string) => void;
}

export function ProvocationCard({
  provocation,
  onDismiss,
  onCopyPrompt,
  onNavigate,
}: ProvocationProps) {
  const [fading, setFading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOption = (opt: ProvocationOption) => {
    if (opt.action === "dismiss") {
      setFading(true);
      setTimeout(() => onDismiss(provocation.id), 300);
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

  return (
    <div
      className={`fq-provocation fq-provocation-${provocation.severity} ${fading ? "fq-provocation-fade" : ""}`}
    >
      <div className="fq-provocation-thesis">{provocation.thesis}</div>
      <div className="fq-provocation-why">{provocation.whyNow}</div>
      <div className="fq-provocation-options">
        {provocation.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={`fq-provocation-btn ${opt.action === "dismiss" ? "fq-provocation-btn-muted" : ""} ${copied && opt.action === "copy_prompt" ? "fq-provocation-btn-copied" : ""}`}
            onClick={() => handleOption(opt)}
          >
            {copied && opt.action === "copy_prompt" ? "Copied!" : opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
