"use client";

import { ChevronDown, FileText, ListChecks, Plus } from "lucide-react";
import { useRef, useState } from "react";
import type { Axis } from "@/types/axis";
import { splitSentences } from "@/lib/evidenceHeuristic";
import { WRITING_EXAMPLES } from "@/lib/sampleText";
import { CheckChips } from "./CheckChips";
import { CustomAxisBuilder } from "./CustomAxisBuilder";
import { RunButton } from "./ui";

type Props = {
  text: string;
  onText: (value: string) => void;
  onLoadSample: () => void;
  onClear: () => void;
  onLoadExample: (text: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  replacementMessage: string;
  evidenceReturnName?: string;
  onReturnToEvidence: () => void;
  builtInAxes: Axis[];
  customAxes: Axis[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  onAddCustom: (axis: Axis) => void;
  onRemoveCustom: (id: string) => void;
  onUpdateCustom: (axis: Axis) => void;
  removedCheckName?: string;
  onUndoRemoveCustom: () => void;
  demoMode: boolean;
  running: boolean;
  onRun: () => void;
  /** Keyboard shortcut shown on the run button, e.g. "⌘ ↵". */
  runHint: string;
};

/** Left panel: the text, the checks to run, and the run button. */
export function SourcePanel({
  text,
  onText,
  onLoadSample,
  onClear,
  onLoadExample,
  canUndo,
  onUndo,
  replacementMessage,
  evidenceReturnName,
  onReturnToEvidence,
  builtInAxes,
  customAxes,
  selectedIds,
  onToggle,
  onSelectAll,
  onAddCustom,
  onRemoveCustom,
  onUpdateCustom,
  removedCheckName,
  onUndoRemoveCustom,
  demoMode,
  running,
  onRun,
  runHint,
}: Props) {
  const [examplesOpen, setExamplesOpen] = useState(true);
  const [editingAxis, setEditingAxis] = useState<Axis | null>(null);
  // The name of the check added most recently, so the panel can say so and land focus on its chip.
  const [addedName, setAddedName] = useState<string | null>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const undoRemoval = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  function focusChip(name: string) {
    const chip = Array.from(panelRef.current?.querySelectorAll<HTMLInputElement>('.field-options input[type="checkbox"]') ?? []).find(
      (input) => input.getAttribute("aria-label") === name,
    );
    chip?.focus();
  }
  function addCheck(axis: Axis) {
    onAddCustom(axis);
    setAddedName(axis.name);
    requestAnimationFrame(() => focusChip(axis.name));
  }
  function finishEditing() {
    setEditingAxis(null);
    requestAnimationFrame(() => {
      if (editTrigger.current?.isConnected) editTrigger.current.focus();
      else panelRef.current?.querySelector<HTMLButtonElement>(".chip-info")?.focus();
    });
  }
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = splitSentences(text).length;
  const total = builtInAxes.length + customAxes.length;
  const selected = selectedIds.size;
  const allSelected = selected === total && total > 0;

  return (
    <section ref={panelRef} className="panel source-panel" aria-labelledby="source-title">
      <div className="panel-heading">
        <div>
          <FileText size={18} strokeWidth={1.5} />
          <h2 id="source-title">Your writing</h2>
        </div>
        <div className="panel-heading-actions">
          <button type="button" className="button quiet" disabled={running || !text} onClick={onClear}>Clear text</button>
          <button type="button" className="button quiet" disabled={running} onClick={onLoadSample}>Load sample</button>
        </div>
      </div>

      <div className="panel-content grow" role="region" aria-label="Writing and checks" tabIndex={0}>
        <div className="replacement-feedback">
          <p role="status" aria-atomic="true">{replacementMessage}</p>
          {canUndo && <button type="button" className="button small" disabled={running} onClick={onUndo} aria-label="Undo replacement">Undo</button>}
        </div>
        <fieldset disabled={running} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", flex: 1 }}>
          <details className="disclosure example-disclosure" open={examplesOpen} onToggle={(event) => setExamplesOpen(event.currentTarget.open)}>
            <summary><span>Try an example</span><ChevronDown size={14} className="marker" aria-hidden /></summary>
            <p className="field-hint">{demoMode ? "Simulated in demo mode" : "Synthetic examples · run to get live verdicts"}</p>
            <div className="example-options" role="group" aria-label="Writing examples">
              {WRITING_EXAMPLES.map((example) => (
                <button key={example.id} type="button" className="example-option" aria-pressed={text === example.text} onClick={() => onLoadExample(example.text)}>
                  <strong>{example.title}</strong>
                  <span>{example.description}</span>
                </button>
              ))}
            </div>
          </details>
          <label className="field-label" htmlFor="judge-text">
            Paste the text to judge
          </label>
          <textarea
            id="judge-text"
            className="document-input"
            value={text}
            maxLength={150_000}
            spellCheck={false}
            placeholder="Paste or type the text you want judged…"
            onChange={(event) => { setExamplesOpen(false); onText(event.target.value); }}
          />
          {evidenceReturnName && <button type="button" className="button quiet evidence-return" onClick={onReturnToEvidence}>Back to {evidenceReturnName} verdict</button>}
          <div className="input-meta">
            <span>
              {words} {words === 1 ? "word" : "words"} · {sentences} {sentences === 1 ? "sentence" : "sentences"}
            </span>
            <span>{text.length.toLocaleString()} chars</span>
          </div>

          <div className="field-label" style={{ marginTop: 20 }}>
            <ListChecks size={14} />
            Checks to run
            <span className="count" style={{ marginLeft: "auto" }}>
              {selected}/{total} on
            </span>
          </div>
          <CheckChips builtInAxes={builtInAxes} customAxes={customAxes} selectedIds={selectedIds} onToggle={onToggle} onRemoveCustom={(id) => {
            if (editingAxis?.id === id) setEditingAxis(null);
            setAddedName(null);
            onRemoveCustom(id);
            requestAnimationFrame(() => undoRemoval.current?.focus());
          }} onEditCustom={(axis, trigger) => { editTrigger.current = trigger; setEditingAxis(axis); }} />
          <div className="replacement-feedback">
            <p role="status" aria-atomic="true">
              {removedCheckName ? `Removed ${removedCheckName}.` : addedName ? `Added ${addedName}. It's switched on for the next run.` : ""}
            </p>
            {removedCheckName && <button ref={undoRemoval} type="button" className="button small" aria-label="Undo check removal" onClick={() => {
              onUndoRemoveCustom();
              requestAnimationFrame(() => {
                const button = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>(".chip-info") ?? []).find((element) => element.getAttribute("aria-label") === `About ${removedCheckName}`);
                button?.focus();
              });
            }}>Undo</button>}
          </div>
          <div className="chip-actions">
            <span className="field-hint" style={{ margin: 0 }}>
              Use a check&apos;s info button to preview its question and what counts as an issue.
            </span>
            <button type="button" className="button quiet" onClick={() => onSelectAll(!allSelected)}>
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          {editingAxis ? (
            <section className="check-editor disclosure card" aria-label={`Edit ${editingAxis.name}`}>
              <h3>Edit {editingAxis.name}</h3>
              <CustomAxisBuilder key={editingAxis.id} initialAxis={editingAxis} onAdd={(axis) => { onUpdateCustom(axis); finishEditing(); }} onCancel={finishEditing} />
            </section>
          ) : <details className="disclosure card">
            <summary>
              <Plus size={14} />
              Add a custom check
              <ChevronDown size={14} className="marker" style={{ marginLeft: "auto" }} />
            </summary>
            <div className="disclosure-body">
              <CustomAxisBuilder onAdd={addCheck} />
            </div>
          </details>}

          <details className="disclosure method-disclosure">
            <summary>How judgments work <ChevronDown size={14} className="marker" aria-hidden /></summary>
            <div className="method-note">
              <span>
                01<strong>Ask Jev</strong>
              </span>
              <span>
                02<strong>Read the verdicts</strong>
              </span>
              <p>
                {demoMode ? "Demo mode simulates these steps locally. " : ""}
                In live mode, selected checks are sent in one batched verdict request, with an optional separate evidence request.
                Yes/No checks return a probability of yes; option checks return a choice and confidence.
              </p>
            </div>
          </details>
        </fieldset>
      </div>

      <div className="panel-bottom">
        <span className="muted">
          {selected} {selected === 1 ? "check" : "checks"} · 1 verdict request{demoMode ? " · simulated" : " · plus an optional evidence request"}
        </span>
        <RunButton busy={running} disabled={!text.trim() || selected === 0} onClick={onRun} hint={runHint}>
          Run judgment
        </RunButton>
      </div>
    </section>
  );
}
