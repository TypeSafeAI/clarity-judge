"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Info, X } from "lucide-react";
import type { Axis } from "@/types/axis";

type Props = {
  builtInAxes: Axis[];
  customAxes: Axis[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onRemoveCustom: (id: string) => void;
};

/** The checks as toggle chips, the way the playground picks fields to extract. */
export function CheckChips({ builtInAxes, customAxes, selectedIds, onToggle, onRemoveCustom }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRegionId = useId();
  const previewRef = useRef<HTMLElement>(null);
  const axes = [...builtInAxes, ...customAxes];
  const preview = axes.find((axis) => axis.id === previewId);

  useEffect(() => {
    const element = previewRef.current;
    const panel = element?.closest<HTMLElement>(".panel-content");
    if (!element || !panel) return;
    const panelScrolls = getComputedStyle(panel).overflowY === "auto";
    const scroller = panelScrolls ? panel : panel.closest("main");
    if (!scroller) return;
    const bounds = element.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    // Reveal the preview inside its pane, reserving room for the mobile toolbar.
    const overflow = bounds.bottom - viewport.bottom + (panelScrolls ? 12 : 88);
    if (overflow > 0) scroller.scrollTop += Math.max(0, Math.min(overflow, bounds.top - viewport.top - 12));
  }, [preview]);
  return (
    <>
      <div className="field-options" role="group" aria-label="Checks">
        {axes.map((axis) => (
          <span className="chip-group" key={axis.id}>
            <Chip axis={axis} selected={selectedIds.has(axis.id)} onToggle={onToggle} />
            <button type="button" className="chip-info" aria-label={`About ${axis.name}`} aria-expanded={previewId === axis.id} aria-controls={previewId === axis.id ? previewRegionId : undefined} onClick={() => setPreviewId(previewId === axis.id ? null : axis.id)}>
              <Info size={14} aria-hidden />
            </button>
            {!axis.builtIn && <button type="button" className="chip-remove" aria-label={`Remove ${axis.name}`} title="Remove this custom check" onClick={() => onRemoveCustom(axis.id)}>
              <X size={13} />
            </button>}
          </span>
        ))}
      </div>
      {preview && (
        <section ref={previewRef} className="check-preview" id={previewRegionId} aria-label={`${preview.name} check details`}>
          <h3>{preview.name}</h3>
          <p>{preview.question}</p>
          {preview.kind === "yes_no" ? (
            <p><strong>Counts as an issue:</strong> {preview.issueWhen ? "Yes" : "No"}</p>
          ) : (
            <>
              <p><strong>Options:</strong> {preview.options.map((option) => option.label).join(" · ")}</p>
              <p><strong>Counts as an issue:</strong> {preview.options.filter((option) => preview.issueOptions.includes(option.value)).map((option) => option.label).join(" · ") || "None of the options"}</p>
            </>
          )}
          {preview.goodLooksLike && <p><strong>Good looks like:</strong> {preview.goodLooksLike}</p>}
        </section>
      )}
    </>
  );
}

function Chip({ axis, selected, onToggle }: { axis: Axis; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <label className={`chip${selected ? " selected" : ""}`} title={axis.description}>
      <input type="checkbox" aria-label={axis.name} checked={selected} onChange={() => onToggle(axis.id)} />
      <Check size={13} strokeWidth={2.25} aria-hidden />
      {axis.name}
      <span className="chip-kind" aria-hidden>{axis.kind === "yes_no" ? "Yes / No" : "Choose one"}</span>
    </label>
  );
}
